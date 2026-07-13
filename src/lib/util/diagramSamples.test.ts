import { describe, expect, it } from 'vitest';
import { createDiagramBranch } from './diagramBranch';
import { localizedDiagramSamples } from './diagramSamples';
import { getSampleDiagrams, parse } from './mermaid';
import { findVisualTextRange } from './visualTextEdit';

const branchTargets: Record<string, { label: string; sourceId?: string }> = {
  Architecture: { label: '订单服务' },
  Block: { label: '订单服务' },
  C4: { label: '业务 API', sourceId: 'api' },
  Class: { label: '订单', sourceId: 'Order' },
  'Entity Relationship': { label: 'ORDER', sourceId: 'ORDER' },
  Flowchart: { label: '确认支付', sourceId: 'Pay' },
  Gantt: { label: '核心开发' },
  Git: { label: 'develop' },
  Ishikawa: { label: '系统' },
  Kanban: { label: '梳理用户需求' },
  Mindmap: { label: '用户价值' },
  Packet: { label: '消息类型' },
  Pie: { label: '移动应用' },
  Quadrant: { label: '快速结算' },
  Radar: { label: '易用性' },
  Requirement: { label: '支持在线创建订单', sourceId: 'order_requirement' },
  Sankey: { label: '浏览商品' },
  Sequence: { label: '顾客', sourceId: 'User' },
  State: { label: '已支付', sourceId: 'Paid' },
  Timeline: { label: '2025' },
  TreeView: { label: '交易服务' },
  Treemap: { label: '订单服务' },
  'User Journey': { label: '完成支付' },
  Venn: { label: '产品价值', sourceId: 'product' },
  'Wardley Maps': { label: '在线下单' },
  XY: { label: '一月' },
  ZenUML: { label: 'Customer', sourceId: 'Customer' }
};

describe('localizedDiagramSamples', () => {
  it('covers every available diagram type and ZenUML', () => {
    const expected = [...Object.keys(getSampleDiagrams()), 'ZenUML'].sort();
    expect(Object.keys(localizedDiagramSamples).sort()).toEqual(expected);
  });

  it('provides one complete default example for every type', () => {
    for (const [name, examples] of Object.entries(localizedDiagramSamples)) {
      expect(examples, `${name} should have one curated initial example`).toHaveLength(1);
      expect(examples[0].isDefault, `${name} should be the default example`).toBe(true);
      expect(examples[0].title, `${name} should have a title`).toBeTruthy();
      expect(examples[0].code.trim(), `${name} should have source code`).toBeTruthy();
    }
  });

  it('keeps every localized initial example parseable', async () => {
    for (const [name, [example]] of Object.entries(localizedDiagramSamples)) {
      await expect(parse(example.code), name).resolves.toBeDefined();
    }
  }, 30_000);

  it('keeps the first expansion of every initial example parseable', async () => {
    expect(Object.keys(branchTargets).sort()).toEqual(Object.keys(localizedDiagramSamples).sort());
    for (const [name, [example]] of Object.entries(localizedDiagramSamples)) {
      const result = createDiagramBranch({ code: example.code, ...branchTargets[name] });
      expect(result?.code, `${name} should produce an expansion`).toBeTruthy();
      expect(result?.code, `${name} should change after expansion`).not.toBe(example.code);
      await expect(parse(result?.code ?? ''), `${name} expanded sample`).resolves.toBeDefined();
    }
  }, 60_000);

  it('maps a representative editable element in every initial example back to source', () => {
    for (const [name, [example]] of Object.entries(localizedDiagramSamples)) {
      const target = branchTargets[name];
      expect(
        findVisualTextRange(example.code, {
          sourceId: target.sourceId,
          text: target.label
        }),
        `${name} should expose its representative text for editing`
      ).toBeDefined();
    }
  });
});
