import { describe, expect, it } from 'vitest';
import {
  createBlockArrowCode,
  createDiagramBranch,
  moveDiagramElementCode,
  moveTimelinePeriodCode,
  resizePacketFieldCode
} from './diagramBranch';
import {
  findQuadrantPoint,
  findRequirementFieldRange,
  findVisualTextRange,
  findVisibleTextRange,
  findWardleyPoint,
  removeDiagramElementCode,
  replaceDiagramVisualText,
  replaceQuadrantPoint,
  replaceWardleyPoint
} from './visualTextEdit';
import { parse } from './mermaid';

const requireRange = (range: ReturnType<typeof findVisibleTextRange>) => {
  expect(range).toBeDefined();
  if (!range) throw new Error('Expected an editable source range.');
  return range;
};

describe('special diagram branch strategies', () => {
  it('does not report a fake branch when the diagram or target is unsupported', () => {
    expect(createDiagramBranch({ code: 'info\n  showInfo', label: '不存在' })).toBeUndefined();
    expect(
      createDiagramBranch({ code: 'flowchart LR\n  A[开始]', label: '不存在', sourceId: 'missing' })
    ).toBeUndefined();
  });

  it.each([
    ['mindmap', 'mindmap\n  root((根节点))'],
    ['sequence', 'sequenceDiagram\n  participant A as 用户'],
    ['class', 'classDiagram\n  class User'],
    ['state', 'stateDiagram-v2\n  A --> B'],
    ['gantt', 'gantt\n  section 开发\n  编码 :task1, 2026-01-01, 1d'],
    ['treemap', 'treemap-beta\n  "产品"\n    "编辑器": 1'],
    ['packet', 'packet\n  0-7: "类型"'],
    ['timeline', 'timeline\n  2026 : 发布'],
    ['C4', 'C4Container\n  System(system, "系统")'],
    [
      'requirement',
      'requirementDiagram\n  requirement req {\n    id: R1\n    text: "需求"\n    risk: low\n    verifymethod: test\n  }'
    ],
    ['architecture', 'architecture-beta\n  service api(server)[API]'],
    ['ER', 'erDiagram\n  USER {\n    string id PK\n  }'],
    ['Wardley', 'wardley-beta\n  component API [0.5, 0.5]'],
    ['ZenUML', 'zenuml\n  @Actor Customer'],
    ['Git', 'gitGraph\n  commit id: "初始"'],
    ['block', 'block-beta\n  A["模块"]']
  ])('does not attach a %s branch to a fallback node when selection is stale', (_name, code) => {
    expect(createDiagramBranch({ code, label: '已经不存在', sourceId: 'missing' })).toBeUndefined();
  });

  it('attaches a Sankey expansion to the selected flow instead of an unrelated pair', async () => {
    const code = 'sankey-beta\n"访问","注册",10';
    const added = createDiagramBranch({ code, label: '注册' })?.code ?? '';
    expect(added).toContain('"注册","新分支",1');
    await expect(parse(added)).resolves.toBeDefined();
  });

  it('adds a sequence branch from an implicitly declared participant', async () => {
    const code = 'sequenceDiagram\n  Alice->>Bob: 你好';
    const added = createDiagramBranch({ code, label: 'Alice', sourceId: 'actor-0' })?.code ?? '';
    expect(added).toContain('participant Branch1 as 新分支');
    expect(added).toContain('Alice->>Branch1: 新分支');
    await expect(parse(added)).resolves.toBeDefined();
  });

  it('edits a node label rather than its identical source id', () => {
    const code = 'flowchart LR\n  A[A] --> B[目标]';
    const range = requireRange(findVisualTextRange(code, { sourceId: 'A', text: 'A' }));
    expect(code.slice(range.start, range.end)).toBe('A');
    expect(replaceDiagramVisualText(code, range, 'A', '开始').code).toContain('A[开始]');
  });

  it('keeps the other inline flowchart node when deleting its connected peer', async () => {
    const code = `flowchart LR
  A[开始] --> B[处理]
  B --> C[结束]`;
    const removed = removeDiagramElementCode(code, { sourceId: 'B', text: '处理' }) ?? '';
    expect(removed).toContain('A[开始]');
    expect(removed).toContain('C[结束]');
    expect(removed).not.toContain('B[处理]');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('deletes an implicit state node together with its transitions', async () => {
    const code = `stateDiagram-v2
  A --> B
  B --> C`;
    const removed = removeDiagramElementCode(code, { text: 'B' }) ?? '';
    expect(removed).not.toMatch(/\bB\b/);
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('edits a requirement value when it is identical to its field name', () => {
    const code = `requirementDiagram
  requirement req {
    id: id
    text: "需求"
    risk: low
    verifymethod: test
  }`;
    const range = requireRange(findRequirementFieldRange(code, 'ID: id', 'req'));
    expect(range.start).toBe(code.lastIndexOf('id'));
    expect(replaceDiagramVisualText(code, range, 'id', 'R001').code).toContain('id: R001');
  });

  it('locates a ZenUML participant capture instead of its identical directive name', () => {
    const code = 'zenuml\n  @Actor Actor\n  @Starter(Actor)';
    const range = requireRange(findVisibleTextRange(code, 'Actor'));
    expect(range.start).toBe(code.indexOf('Actor', code.indexOf('@Actor') + '@Actor'.length));
  });

  it('preserves a treemap leaf value when converting it into a parent branch', async () => {
    const initial = `treemap-beta
  "交易能力"
    "订单服务": 20`;
    const added = createDiagramBranch({ code: initial, label: '订单服务' })?.code ?? '';
    expect(added).toContain('"订单服务"');
    expect(added).toContain('"原有内容": 20');
    expect(added).toContain('"新分支": 1');
    await expect(parse(added)).resolves.toBeDefined();
  });

  it('creates editable flowchart edge labels in the source model', async () => {
    const initial = `flowchart LR
  A[开始]`;
    const added = createDiagramBranch({ code: initial, label: '开始', sourceId: 'A' })?.code ?? '';
    expect(added).toContain('A -->|关系| A_branch_1[新分支]');
    const range = requireRange(findVisualTextRange(added, { text: '关系' }));
    const edited = replaceDiagramVisualText(added, range, '关系', '通过校验').code;
    expect(edited).toContain('-->|通过校验|');
    await expect(parse(edited)).resolves.toBeDefined();
  });

  it('creates editable class members and extends the selected member owner', async () => {
    const initial = `classDiagram
  class Root {
    +String name
    +save()
  }`;
    const added =
      createDiagramBranch({ code: initial, label: 'Root', sourceId: 'Root' })?.code ?? '';
    expect(added).toContain('class Branch1["新分支"] {');
    expect(added).toContain('+String 新字段');
    expect(added).toContain('+新方法()');
    const extended =
      createDiagramBranch({ code: added, label: '+String 新字段', sourceId: 'Branch1' })?.code ??
      '';
    expect(extended).toContain('+String 新字段2');
    await expect(parse(extended)).resolves.toBeDefined();
  });

  it('keeps requirement children attached when branching from an attribute row', async () => {
    const initial = `requirementDiagram
  functionalRequirement root {
    id: R1
    text: "主需求"
    risk: high
    verifymethod: inspection
  }`;
    const added =
      createDiagramBranch({ code: initial, label: 'high', sourceId: 'root' })?.code ?? '';
    expect(added).toContain('functionalRequirement branch1');
    expect(added).toContain('root - contains -> branch1');
    const range = requireRange(findVisualTextRange(added, { text: 'Inspection' }));
    expect(added.slice(range.start, range.end)).toBe('inspection');
    const verification = requireRange(
      findRequirementFieldRange(added, 'Verification: Test', 'branch1')
    );
    expect(added.slice(verification.start, verification.end)).toBe('test');
    await expect(parse(added)).resolves.toBeDefined();
  });

  it('edits a requirement type through its rendered declaration label', async () => {
    const initial = `requirementDiagram
  functionalRequirement branch1 {
    id: R1
    text: "登录需求"
    risk: low
    verifymethod: test
  }`;
    const range = requireRange(
      findRequirementFieldRange(initial, '<<Functional Requirement>>', 'branch1')
    );
    expect(initial.slice(range.start, range.end)).toBe('functionalRequirement');
    const edited = replaceDiagramVisualText(
      initial,
      range,
      'Functional Requirement',
      '接口需求'
    ).code;
    expect(edited).toContain('interfaceRequirement branch1');
    await expect(parse(edited)).resolves.toBeDefined();
  });

  it('locates quoted block labels without replacing their quotes', () => {
    const code = 'block-beta\n  Branch1["新分支"]';
    const range = requireRange(findVisualTextRange(code, { sourceId: 'Branch1', text: '新分支' }));
    expect(code.slice(range.start, range.end)).toBe('新分支');
  });

  it('falls back to visible requirement text instead of replacing the whole data block', () => {
    const code = `requirementDiagram
  requirement branch1 {
    id: R1
    text: "新分支"
    risk: low
    verifymethod: test
  }`;
    const range = requireRange(findVisualTextRange(code, { sourceId: 'branch1', text: '新分支' }));
    expect(code.slice(range.start, range.end)).toBe('新分支');
  });

  it('parses the redesigned requirement, gantt, and block starter diagrams', async () => {
    const diagrams = [
      `requirementDiagram
  requirement order_requirement {
    id: R001
    text: "支持在线创建订单"
    risk: medium
    verifymethod: test
  }
  functionalRequirement payment_requirement {
    id: R002
    text: "支持安全支付"
    risk: high
    verifymethod: inspection
  }
  element order_service {
    type: "订单服务"
    docref: "产品需求文档"
  }
  order_requirement - contains -> payment_requirement
  payment_requirement - satisfies -> order_service`,
      `gantt
  title 产品发布计划
  dateFormat YYYY-MM-DD
  section 需求分析
  用户调研 :done, research, 2026-07-01, 3d
  需求确认 :milestone, confirm, after research, 0d`,
      `block-beta
  columns 3
  input["需求输入"] analysis["需求分析"] plan["方案设计"]
  input --> analysis
  analysis --> plan`
    ];
    for (const diagram of diagrams) await expect(parse(diagram)).resolves.toBeDefined();
  });
  it('creates connected and removable C4 children', async () => {
    const initial = `C4Context
    Person(user, "用户")
    System(app, "应用")
    Rel(user, app, "使用")`;
    const added = createDiagramBranch({ code: initial, label: '应用' })?.code ?? '';
    expect(added).toContain('System(Branch1, "新分支", "新增模块")');
    expect(added).toContain('Rel(app, Branch1, "包含")');
    await expect(parse(added)).resolves.toBeDefined();
    const removed = removeDiagramElementCode(added, { text: '新分支' }) ?? '';
    expect(removed).not.toContain('Branch1');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('adds multiple gantt tasks under a section with unique ids', async () => {
    let code = `gantt
    dateFormat YYYY-MM-DD
    section 设计
    调研 :a1, 2026-07-01, 2d
    section 开发
    编码 :b1, 2026-07-03, 2d`;
    code = createDiagramBranch({ code, label: '设计' })?.code ?? '';
    code = createDiagramBranch({ code, label: '设计' })?.code ?? '';
    expect(code.match(/新分支(?: 2)?\s+:task[12]/g)).toHaveLength(2);
    expect(code.indexOf('新分支 2')).toBeLessThan(code.indexOf('section 开发'));
    await expect(parse(code)).resolves.toBeDefined();
  });

  it('creates nested requirement data and removes its full block and relation', async () => {
    const initial = `requirementDiagram
    requirement root {
      id: R1
      text: "根需求"
      risk: low
      verifymethod: test
    }`;
    const added = createDiagramBranch({ code: initial, label: '根需求' })?.code ?? '';
    expect(added).toContain('root - contains -> branch1');
    await expect(parse(added)).resolves.toBeDefined();
    const removed = removeDiagramElementCode(added, { text: '新分支' }) ?? '';
    expect(removed).not.toContain('branch1');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('inherits requirement types and removes a contains subtree without orphan data', async () => {
    const initial = `requirementDiagram
    functionalRequirement root {
      id: R1
      text: "主需求"
      risk: medium
      verifymethod: test
    }`;
    let code = createDiagramBranch({ code: initial, label: '主需求' })?.code ?? '';
    expect(code).toContain('functionalRequirement branch1');
    code = createDiagramBranch({ code, label: '新分支' })?.code ?? '';
    expect(code).toContain('branch1 - contains -> branch2');
    const removed = removeDiagramElementCode(code, { text: '主需求' }) ?? '';
    expect(removed).not.toContain('branch1');
    expect(removed).not.toContain('branch2');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('adds and removes radar axes while keeping every curve aligned', async () => {
    const initial = `radar-beta
  axis a["速度"], b["质量"]
  curve x["方案"]{60, 70}`;
    const added = createDiagramBranch({ code: initial, label: '速度' })?.code ?? '';
    expect(added).toContain('dimension1["新分支"]');
    expect(added).toContain('{60, 70, 50}');
    await expect(parse(added)).resolves.toBeDefined();
    const removed = removeDiagramElementCode(added, { text: '新分支' }) ?? '';
    expect(removed).not.toContain('dimension1');
    expect(removed).toContain('{60, 70}');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('adds and removes XY categories while keeping every series aligned', async () => {
    const initial = `xychart-beta
    x-axis ["一月", "二月"]
    bar [10, 20]
    line [15, 25]`;
    const added = createDiagramBranch({ code: initial, label: '一月' })?.code ?? '';
    expect(added).toContain('x-axis ["一月", "二月", "新分支"]');
    expect(added).toContain('bar [10, 20, 0]');
    expect(added).toContain('line [15, 25, 0]');
    await expect(parse(added)).resolves.toBeDefined();
    const removed = removeDiagramElementCode(added, { text: '新分支' }) ?? '';
    expect(removed).toContain('x-axis ["一月", "二月"]');
    expect(removed).toContain('bar [10, 20]');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('moves a timeline period together with all its child events', async () => {
    const initial = `timeline
    2001 : 起步
         : 调研
    2007 : 发布
         : 增长`;
    const moved = moveTimelinePeriodCode(initial, '2007', -1) ?? '';
    expect(moved.indexOf('2007')).toBeLessThan(moved.indexOf('2001'));
    expect(moved.indexOf('增长')).toBeLessThan(moved.indexOf('2001'));
    await expect(parse(moved)).resolves.toBeDefined();
  });

  it('updates quadrant coordinates without changing its label', async () => {
    const initial = `quadrantChart
    机会: [0.20, 0.70]`;
    expect(findQuadrantPoint(initial, '机会')).toEqual({ x: 0.2, y: 0.7 });
    const moved = replaceQuadrantPoint(initial, '机会', { x: 0.55, y: 0.35 }) ?? '';
    expect(moved).toContain('机会: [0.55, 0.35]');
    await expect(parse(moved)).resolves.toBeDefined();
  });

  it('creates connected architecture services and removes their edges', async () => {
    const initial = `architecture-beta
    group api(cloud)[API]
    service server(server)[服务] in api`;
    const added = createDiagramBranch({ code: initial, label: '服务' })?.code ?? '';
    expect(added).toContain('service service1(server)[新分支] in api');
    expect(added).toContain('server:R -- L:service1');
    await expect(parse(added)).resolves.toBeDefined();
    const removed = removeDiagramElementCode(added, { text: '新分支' }) ?? '';
    expect(removed).not.toContain('service1');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('creates Venn sets with intersections and removes dependent unions', async () => {
    const initial = `venn-beta
    set A["集合甲"]
    set B["集合乙"]`;
    const added = createDiagramBranch({ code: initial, label: '集合甲' })?.code ?? '';
    expect(added).toContain('set Set1["新分支"]');
    expect(added).toContain('union A,Set1["交集1"]');
    await expect(parse(added)).resolves.toBeDefined();
    const removed = removeDiagramElementCode(added, { text: '新分支' }) ?? '';
    expect(removed).not.toContain('Set1');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('creates Git branches and commits, renames references, and removes branch history', async () => {
    const initial = `gitGraph
    commit id: "初始"
    branch develop
    checkout develop
    commit id: "开发"`;
    let added =
      createDiagramBranch({ code: initial, label: 'develop', mode: 'branch' })?.code ?? '';
    expect(added).toContain('branch branch1');
    added = createDiagramBranch({ code: added, label: 'branch1', mode: 'commit' })?.code ?? '';
    expect(added.match(/checkout branch1/g)?.length).toBeGreaterThanOrEqual(2);
    await expect(parse(added)).resolves.toBeDefined();
    const branchRange = added.match(/^\s*branch\s+(branch1)/m);
    expect(branchRange?.index).toBeDefined();
    const start = (branchRange?.index ?? 0) + (branchRange?.[0].indexOf('branch1') ?? 0);
    const renamed = replaceDiagramVisualText(
      added,
      { start, end: start + 'branch1'.length },
      'branch1',
      '功能分支'
    ).code;
    expect(renamed).toContain('branch "功能分支"');
    expect(renamed).not.toContain('checkout branch1');
    await expect(parse(renamed)).resolves.toBeDefined();
    const removed = removeDiagramElementCode(renamed, { text: '功能分支' }) ?? '';
    expect(removed).not.toContain('功能分支');
    expect(removed).toContain('commit id: "初始"');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('inserts, splits, and resizes packet fields while keeping contiguous ranges', async () => {
    const initial = `packet
0-15: "字段A"
16-31: "字段B"`;
    let code = createDiagramBranch({ code: initial, label: '字段B', mode: 'before' })?.code ?? '';
    expect(code).toContain('16-31: "新分支"');
    expect(code).toContain('32-47: "字段B"');
    code = createDiagramBranch({ code, label: '字段A', mode: 'split' })?.code ?? '';
    expect(code).toContain('0-7: "字段A"');
    expect(code).toContain('8-15: "新分支 2"');
    code = resizePacketFieldCode(code, '新分支', 'large') ?? '';
    expect(code).toContain('16-47: "新分支"');
    await expect(parse(code)).resolves.toBeDefined();
  });

  it('connects block nodes and removes related arrows with a deleted node', async () => {
    const initial = `block-beta
  columns 2
  A["甲"]
  B["乙"]`;
    const connected = createBlockArrowCode(initial, '甲', '乙') ?? '';
    expect(connected).toContain('A -- "箭头1" --> B');
    await expect(parse(connected)).resolves.toBeDefined();
    const removed = removeDiagramElementCode(connected, { text: '乙' }) ?? '';
    expect(removed).not.toContain('--> B');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('does not duplicate an existing unlabeled block arrow', () => {
    const initial = `block-beta
  A["甲"]
  B["乙"]
  A --> B`;

    expect(createBlockArrowCode(initial, '甲', '乙')).toBeUndefined();
  });

  it('adds editable gantt section groups without disturbing tasks', async () => {
    const initial = `gantt
    dateFormat YYYY-MM-DD
    section 设计
    调研 :a1, 2026-07-01, 2d`;
    const added =
      createDiagramBranch({ code: initial, label: '设计', mode: 'section' })?.code ?? '';
    expect(added).toContain('section 新分组');
    expect(added).toMatch(/新任务 :(?:active|crit), task1/);
    expect(added).toContain('调研 :a1');
    await expect(parse(added)).resolves.toBeDefined();
  });

  it('keeps architecture children unique, grouped, connected, and independently removable', async () => {
    const initial = `architecture-beta
    group api(cloud)[API]
    service server(server)[服务] in api`;
    let code = createDiagramBranch({ code: initial, label: '服务' })?.code ?? '';
    code = createDiagramBranch({ code, label: '服务' })?.code ?? '';
    expect(code).toContain('service service1(server)[新分支] in api');
    expect(code).toContain('service service2(server)[新分支 2] in api');
    expect(code).toContain('server:R -- L:service1');
    expect(code).toContain('server:B -- T:service2');
    await expect(parse(code)).resolves.toBeDefined();
    const removed = removeDiagramElementCode(code, { text: '新分支' }) ?? '';
    expect(removed).not.toContain('service1');
    expect(removed).toContain('service2');
  });

  it('inserts C4 children into the selected boundary and removes a complete boundary subtree', async () => {
    const initial = `C4Container
    System_Boundary(order, "订单系统") {
      Container(api, "订单 API", "Node", "处理订单")
    }
    System_Ext(pay, "支付平台")`;
    const added = createDiagramBranch({ code: initial, label: '订单 API' })?.code ?? '';
    const boundaryEnd = added.indexOf('\n    }');
    expect(added.indexOf('Container(Branch1')).toBeLessThan(boundaryEnd);
    expect(added.indexOf('Rel(api, Branch1, "包含")')).toBeGreaterThan(boundaryEnd);
    expect(added.indexOf('Rel(api, Branch1, "包含")')).toBeLessThan(
      added.indexOf('UpdateLayoutConfig')
    );
    expect(added).toContain('UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="2")');
    await expect(parse(added)).resolves.toBeDefined();

    const removed = removeDiagramElementCode(added, { text: '订单系统' }) ?? '';
    expect(removed).not.toContain('order');
    expect(removed).not.toContain('api');
    expect(removed).not.toContain('Branch1');
    expect(removed).toContain('pay');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('deletes a C4 relation without deleting either connected element', async () => {
    const initial = `C4Context
    Person(user, "用户")
    System(app, "应用")
    Rel(user, app, "使用")`;
    const removed = removeDiagramElementCode(initial, { text: '使用' }) ?? '';
    expect(removed).toContain('Person(user');
    expect(removed).toContain('System(app');
    expect(removed).not.toContain('Rel(user, app');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('deletes a C4 relation selected through its generated visual text id', async () => {
    const initial = `C4Container
    System_Boundary(order, "订单系统") {
      Container(api, "订单 API", "Node", "处理订单")
    }
    System_Ext(pay, "支付平台")
    Rel(api, pay, "调用支付")`;
    const removed =
      removeDiagramElementCode(initial, {
        sourceId: 'text-23',
        styleId: 'text-23',
        text: '调用支付'
      }) ?? '';
    expect(removed).toContain('Container(api');
    expect(removed).toContain('System_Ext(pay');
    expect(removed).not.toContain('Rel(api, pay');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('deletes original C4 elements through labels, descriptions, or generated category text', async () => {
    const initial = `C4Component
    Person(user, "用户", "发起请求")
    Container_Boundary(web, "网站") {
      Container(api, "接口", "Node", "处理请求")
      Component(auth, "鉴权", "模块", "校验身份")
      Rel(api, auth, "调用")
    }
    Rel(user, api, "访问")`;
    const withoutComponent = removeDiagramElementCode(initial, { text: '校验身份' }) ?? '';
    expect(withoutComponent).not.toContain('Component(auth');
    expect(withoutComponent).not.toContain('Rel(api, auth');
    const withoutPerson =
      removeDiagramElementCode(withoutComponent, {
        styleId: 'user',
        text: 'person'
      }) ?? '';
    expect(withoutPerson).not.toContain('Person(user');
    expect(withoutPerson).not.toContain('Rel(user, api');
    await expect(parse(withoutPerson)).resolves.toBeDefined();
  });

  it('adds ER entities to the selected entity instead of a hard-coded root', async () => {
    const initial = `erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER {
      string name
    }
    ORDER {
      string number
    }`;
    const added = createDiagramBranch({ code: initial, label: 'ORDER' })?.code ?? '';
    expect(added).toContain('ORDER ||--o{ ENTITY1 : "包含"');
    expect(added).not.toContain('ROOT ||--');
    await expect(parse(added)).resolves.toBeDefined();
    const removed = removeDiagramElementCode(added, { text: 'ENTITY1' }) ?? '';
    expect(removed).not.toContain('ENTITY1');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('deletes original unlabeled block arrows by their rendered edge id', async () => {
    const initial = `block-beta
  A["甲"]
  B["乙"]
  A --> B`;
    const removed = removeDiagramElementCode(initial, { styleId: 'L_A_B_0', text: '箭头' }) ?? '';
    expect(removed).not.toContain('A --> B');
    expect(removed).toContain('A["甲"]');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('deletes the exact block arrow when node ids contain underscores', () => {
    const initial = `block-beta
  A_node["甲"]
  B_node["乙"]
  C_node["丙"]
  A_node --> B_node
  A_node --> C_node`;
    const removed =
      removeDiagramElementCode(initial, {
        styleId: 'L_A_node_C_node_1',
        text: '箭头'
      }) ?? '';
    expect(removed).toContain('A_node --> B_node');
    expect(removed).not.toContain('A_node --> C_node');
  });

  it('keeps CRLF block node declarations when deleting an arrow', () => {
    const initial = 'block-beta\r\n  A["甲"]\r\n  B["乙"]\r\n  A --> B';
    const removed = removeDiagramElementCode(initial, {
      styleId: 'L_A_B_0',
      text: '箭头'
    });
    expect(removed).toContain('A["甲"]');
    expect(removed).toContain('B["乙"]');
    expect(removed).not.toContain('A --> B');
  });

  it('reorders block nodes, gantt sections, and requirement blocks without changing relations', () => {
    const block = `block-beta
  A["甲"]
  B["乙"]
  A --> B`;
    const movedBlock = moveDiagramElementCode(block, '乙', '甲') ?? '';
    expect(movedBlock.indexOf('B["乙"]')).toBeLessThan(movedBlock.indexOf('A["甲"]'));
    expect(movedBlock).toContain('A --> B');

    const gantt = `gantt
  section 设计
  设计任务 :a1, 2026-07-01, 1d
  section 开发
  开发任务 :b1, 2026-07-02, 1d`;
    const movedGantt = moveDiagramElementCode(gantt, '开发', '设计') ?? '';
    expect(movedGantt.indexOf('section 开发')).toBeLessThan(movedGantt.indexOf('section 设计'));
    expect(movedGantt.indexOf('开发任务')).toBeLessThan(movedGantt.indexOf('section 设计'));

    const requirement = `requirementDiagram
  requirement first {
    id: R1
    text: "第一项"
    risk: low
    verifymethod: test
  }
  requirement second {
    id: R2
    text: "第二项"
    risk: low
    verifymethod: test
  }
  first - contains -> second`;
    const movedRequirement = moveDiagramElementCode(requirement, '第二项', '第一项') ?? '';
    expect(movedRequirement.indexOf('requirement second')).toBeLessThan(
      movedRequirement.indexOf('requirement first')
    );
    expect(movedRequirement).toContain('first - contains -> second');
  });

  it('edits C4 category, node, and description text through the shared text ranges', async () => {
    const initial = `C4Context
    Enterprise_Boundary(boundary, "system") {
      System(app, "应用", "说明文字")
    }`;
    for (const text of ['system', '应用', '说明文字']) {
      const range = findVisibleTextRange(initial, text);
      expect(range).toBeDefined();
    }
    const range = requireRange(findVisibleTextRange(initial, 'system'));
    const renamed = replaceDiagramVisualText(initial, range, 'system', '系统').code;
    expect(renamed).toContain('Enterprise_Boundary(boundary, "系统")');
    await expect(parse(renamed)).resolves.toBeDefined();
  });

  it('keeps each new gantt section independent and visually distinguished', async () => {
    const initial = `gantt
    dateFormat YYYY-MM-DD
    section 设计
    调研 :a1, 2026-07-01, 2d`;
    let code = createDiagramBranch({ code: initial, label: '设计', mode: 'section' })?.code ?? '';
    code = createDiagramBranch({ code, label: '设计', mode: 'section' })?.code ?? '';
    expect(code).toMatch(/section 新分组\n\s*新任务 :crit, task1/);
    expect(code).toMatch(/section 新分组 2\n\s*新任务 :active, task2/);
    const removed = removeDiagramElementCode(code, { text: '新分组' }) ?? '';
    expect(removed).not.toContain('task1');
    expect(removed).toContain('task2');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('adds, moves, renames, and removes connected Wardley components', async () => {
    const initial = `wardley-beta
title Map
component Product [0.80, 0.50]`;
    const added = createDiagramBranch({ code: initial, label: 'Product' })?.code ?? '';
    expect(added).toContain('component Component1 [0.50, 0.50]');
    expect(added).toContain('Product -> Component1');
    expect(findWardleyPoint(added, 'Component1')).toEqual({ x: 0.5, y: 0.5 });
    await expect(parse(added)).resolves.toBeDefined();
    const moved = replaceWardleyPoint(added, 'Component1', { x: 0.72, y: 0.31 }) ?? '';
    const range = requireRange(findVisibleTextRange(moved, 'Component1'));
    const renamed = replaceDiagramVisualText(moved, range, 'Component1', '支付').code;
    expect(renamed).toContain('component 支付 [0.72, 0.31]');
    expect(renamed).toContain('Product -> 支付');
    await expect(parse(renamed)).resolves.toBeDefined();
    const removed = removeDiagramElementCode(renamed, { text: '支付' }) ?? '';
    expect(removed).not.toContain('支付');

    const addedFromRenderedId =
      createDiagramBranch({
        code: initial,
        label: 'Product',
        sourceId: 'wardley-component-1'
      })?.code ?? '';
    expect(addedFromRenderedId).toContain('Product -> Component1');
  });

  it('adds editable and removable ZenUML steps without changing its outer structure', async () => {
    const initial = `zenuml
    @Actor Client
    @Starter(Client)
    Service.create()`;
    const actorRange = requireRange(findVisibleTextRange(initial, 'Client'));
    const actorRenamed = replaceDiagramVisualText(initial, actorRange, 'Client', 'Customer').code;
    expect(actorRenamed).toContain('@Actor Customer');
    expect(actorRenamed).toContain('@Starter(Customer)');
    const added = createDiagramBranch({ code: actorRenamed, label: 'Customer' })?.code ?? '';
    expect(added).toContain('Customer.newStep1()');
    const range = requireRange(findVisibleTextRange(added, 'newStep1()'));
    const renamed = replaceDiagramVisualText(added, range, 'newStep1()', 'confirm()').code;
    expect(renamed).toContain('Customer.confirm()');
    const removed = removeDiagramElementCode(renamed, { text: 'confirm()' }) ?? '';
    expect(removed).not.toContain('confirm()');
  });

  it('removes requirement elements and every relation that references them', async () => {
    const initial = `requirementDiagram
  requirement req {
    id: R1
    text: "下单"
    risk: low
    verifymethod: test
  }
  element service {
    type: "订单服务"
    docref: "需求文档"
  }
  req - satisfies -> service`;
    const removed =
      removeDiagramElementCode(initial, { sourceId: 'service', text: '订单服务' }) ?? '';
    expect(removed).not.toContain('element service');
    expect(removed).not.toContain('satisfies');
    expect(removed).toContain('requirement req');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('adds services inside a selected architecture group and removes group descendants', async () => {
    const initial = `architecture-beta
  group edge(cloud)[接入层]
  group core(cloud)[核心层]
  service gateway(server)[网关] in edge
  service order(server)[订单] in core
  gateway:R -- L:order`;
    const added = createDiagramBranch({ code: initial, label: '核心层' })?.code ?? '';
    expect(added).toContain('service service1(server)[新分支] in core');
    const removed = removeDiagramElementCode(added, { text: '核心层' }) ?? '';
    expect(removed).not.toContain('group core');
    expect(removed).not.toContain('service order');
    expect(removed).not.toContain('service1');
    expect(removed).not.toContain('gateway:R -- L:order');
    expect(removed).toContain('service gateway');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('finds and removes a block declared after another node on the same legacy line', async () => {
    const initial = `block-beta
  columns 2
  A["甲"] B["乙"]
  A -- "关系" --> B`;
    const added = createDiagramBranch({ code: initial, label: '乙' })?.code ?? '';
    expect(added).toContain('B --> Branch1');
    const removed = removeDiagramElementCode(initial, { text: '乙' }) ?? '';
    expect(removed).toContain('A["甲"]');
    expect(removed).not.toContain('B["乙"]');
    expect(removed).not.toContain('关系');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('removes quoted git commits whose ids contain spaces', async () => {
    const initial = `gitGraph
  commit id: "项目 初始化"
  commit id: "第二次提交"`;
    const removed = removeDiagramElementCode(initial, { text: '项目 初始化' }) ?? '';
    expect(removed).not.toContain('项目 初始化');
    expect(removed).toContain('第二次提交');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('removes a ZenUML participant with its balanced call block', async () => {
    const initial = `zenuml
  @Actor Client
  @Participant Service
  @Starter(Client)
  Service.create() {
    Service.validate()
  }
  Client.finish()`;
    const removed = removeDiagramElementCode(initial, { text: 'Service' }) ?? '';
    expect(removed).not.toContain('Service');
    expect(removed).not.toMatch(/^\s*\}/m);
    expect(removed).toContain('Client.finish()');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('continues a state-marked gantt task from its real task id', async () => {
    const initial = `gantt
  dateFormat YYYY-MM-DD
  section 设计
  用户调研 :done, research, 2026-07-01, 3d`;
    const added = createDiagramBranch({ code: initial, label: '用户调研' })?.code ?? '';
    expect(added).toContain('after research, 1d');
    expect(added).not.toContain('after done');
    await expect(parse(added)).resolves.toBeDefined();
  });

  it('uses the selected C4 source id when branching from descriptive text', async () => {
    const initial = `C4Container
  System_Boundary(order, "订单系统") {
    Container(api, "订单 API", "Node", "处理订单")
  }`;
    const added =
      createDiagramBranch({ code: initial, label: '处理订单', sourceId: 'api' })?.code ?? '';
    expect(added).toContain('Container(Branch1, "新分支", "新增模块")');
    expect(added).toContain('Rel(api, Branch1, "包含")');
    expect(added.indexOf('Container(Branch1')).toBeLessThan(added.indexOf('\n  }'));
    await expect(parse(added)).resolves.toBeDefined();
  });

  it('does not confuse a C4 node label with an identical relation label', async () => {
    const initial = `C4Context
  Person(user, "用户")
  System(app, "使用", "业务系统")
  Rel(user, app, "使用")`;
    const removed = removeDiagramElementCode(initial, { sourceId: 'app', text: '使用' }) ?? '';
    expect(removed).not.toContain('System(app');
    expect(removed).not.toContain('Rel(user, app');
    expect(removed).toContain('Person(user');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('allocates a unique label for every block arrow', async () => {
    const initial = `block-beta
  A["甲"]
  B["乙"]
  C["丙"]`;
    const first = createBlockArrowCode(initial, '甲', '乙') ?? '';
    const second = createBlockArrowCode(first, '甲', '丙') ?? '';
    expect(second).toContain('A -- "箭头1" --> B');
    expect(second).toContain('A -- "箭头2" --> C');
    await expect(parse(second)).resolves.toBeDefined();
  });

  it('removes a complete nested ZenUML message block', async () => {
    const initial = `zenuml
  @Actor Customer
  @Boundary WebApp
  @EC2 Service
  WebApp.submit() {
    Service.create() {
      Service.persist()
    }
  }
  WebApp.finish()`;
    const removed = removeDiagramElementCode(initial, { text: 'submit()' }) ?? '';
    expect(removed).not.toContain('submit()');
    expect(removed).not.toContain('create()');
    expect(removed).not.toContain('persist()');
    expect(removed).toContain('finish()');
    await expect(parse(removed)).resolves.toBeDefined();
  });

  it('removes structural nodes and their references across common initial diagrams', async () => {
    const cases = [
      {
        code: `flowchart LR
  A[开始] --> B[处理]
  B --> C[结束]
  C --> D[归档]`,
        removedText: '处理',
        sourceId: 'B',
        retainedText: '归档'
      },
      {
        code: `classDiagram
  class A["订单"] {
    +save()
  }
  class B["仓库"]
  A --> B`,
        removedText: '订单',
        retainedText: '仓库'
      },
      {
        code: `sequenceDiagram
  participant A as 用户
  participant B as 服务
  participant C as 仓库
  A->>B: 请求
  B->>C: 写入`,
        removedText: '服务',
        retainedText: '仓库'
      },
      {
        code: `stateDiagram-v2
  Pending: 待处理
  Paid: 已支付
  Done: 已完成
  Pending --> Paid: 支付
  Paid --> Done: 完成`,
        removedText: '已支付',
        retainedText: '已完成'
      },
      {
        code: `kanban
  todo[待办]
    first[第一项]
    second[第二项]
  done[完成]
    third[第三项]`,
        removedText: '待办',
        retainedText: '第三项'
      }
    ];
    for (const item of cases) {
      const removed = removeDiagramElementCode(item.code, {
        sourceId: item.sourceId,
        text: item.removedText
      });
      expect(removed, item.removedText).toBeDefined();
      expect(removed, item.removedText).not.toContain(item.removedText);
      expect(removed, item.removedText).toContain(item.retainedText);
      await expect(parse(removed as string), item.removedText).resolves.toBeDefined();
    }
  });
});
