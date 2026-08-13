import type { State } from '$lib/types';

export interface InvestorSample {
  diagramType: string;
  state: Pick<State, 'code'> &
    Partial<
      Pick<
        State,
        | 'mermaid'
        | 'sampleDescription'
        | 'visualConnections'
        | 'visualElements'
        | 'visualLayers'
        | 'visualPositions'
        | 'visualStyles'
      >
    >;
  title: string;
}

export const investorSamples: InvestorSample[] = [
  {
    diagramType: 'Flowchart',
    title: 'SaaS 产品系统架构',
    state: {
      sampleDescription:
        '这个示例展示 SaaS 产品从用户端、Web 应用到 API 网关、核心服务与数据基础设施的完整调用链。实线表示业务请求，虚线表示监控数据；可以继续修改模块名称、添加服务分支或补充依赖关系。',
      code: `flowchart TB
  subgraph experience["用户体验层"]
    direction LR
    customer(["用户端"])
    web["Web 应用"]
  end

  subgraph platform["平台服务层"]
    direction LR
    gateway["API 网关"]
    auth["鉴权服务"]
    core["核心业务服务"]
  end

  subgraph data["数据基础层"]
    direction LR
    database[("业务数据库")]
    cache[("高速缓存")]
    files[("文件存储")]
  end

  subgraph operations["运营保障层"]
    direction LR
    thirdparty["第三方服务"]
    monitor["监控与日志"]
  end

  customer -->|访问| web
  web -->|HTTPS| gateway
  gateway -->|校验身份| auth
  gateway -->|业务请求| core
  core --> database
  core --> cache
  core --> files
  core --> thirdparty
  gateway -.运行日志.-> monitor
  core -.业务指标.-> monitor

  classDef entry fill:#fff7ed,stroke:#fb923c,color:#431407,stroke-width:2px
  classDef service fill:#ffffff,stroke:#f97316,color:#431407,stroke-width:2px
  classDef storage fill:#ffedd5,stroke:#ea580c,color:#431407,stroke-width:2px
  classDef support fill:#f8fafc,stroke:#64748b,color:#0f172a,stroke-width:2px
  class customer,web entry
  class gateway,auth,core service
  class database,cache,files storage
  class thirdparty,monitor support
`
    }
  },
  {
    diagramType: 'Gantt',
    title: '创业产品路线图',
    state: {
      sampleDescription:
        '路线图按市场验证、MVP、内测、公测、商业化和规模化分组，任务条展示先后依赖与预计周期。可以编辑 section 和任务名称，并继续添加里程碑或新的阶段。',
      code: `gantt
  title 创业产品从验证到规模化路线图
  dateFormat YYYY-MM-DD
  axisFormat %m-%d

  section 市场验证
  访谈目标客户 :done, research, 2026-07-01, 10d
  确认核心场景 :milestone, validation, after research, 0d

  section MVP 开发
  产品与交互设计 :done, design, after validation, 8d
  核心功能开发 :active, mvp, after design, 18d
  数据埋点与监控 :metrics, after design, 12d

  section 内测与公测
  种子用户内测 :crit, beta, after mvp, 8d
  体验问题修复 :fix, after beta, 7d
  公开测试 :milestone, public, after fix, 0d

  section 商业化
  付费方案验证 :pricing, after public, 12d
  销售流程搭建 :sales, after public, 15d
  首批付费客户 :milestone, revenue, after pricing, 0d

  section 融资与规模化
  核心指标复盘 :review, after revenue, 6d
  融资材料准备 :funding, after review, 10d
  团队与渠道扩张 :scale, after funding, 18d
`
    }
  },
  {
    diagramType: 'User Journey',
    title: '用户增长旅程',
    state: {
      sampleDescription:
        '旅程覆盖用户发现产品、注册、获得价值、付费和主动推荐的关键阶段。每项任务后的 1–5 分代表体验情绪，可编辑步骤、参与角色并拖动情绪点调整分数。',
      code: `journey
  title 从发现产品到主动推荐的用户旅程
  section 发现产品
    看到行业内容: 3: 用户, 市场
    访问产品官网: 4: 用户, 市场
  section 注册体验
    创建免费账号: 4: 用户, 产品
    完成新手引导: 3: 用户, 产品
  section 获得价值
    创建第一张图表: 5: 用户, 产品
    与团队分享成果: 5: 用户, 协作
  section 付费决策
    对比专业版权益: 3: 用户, 销售
    升级团队方案: 4: 用户, 销售
  section 分享推荐
    邀请同事加入: 5: 用户, 协作
    推荐给同行朋友: 5: 用户, 市场
`
    }
  },
  {
    diagramType: 'C4',
    title: 'C4 系统关系图',
    state: {
      sampleDescription:
        '这个 C4 容器图说明内容创作者和团队管理员如何使用图表平台，并展示 Web 编辑器、业务 API、渲染服务、数据库和外部系统的隶属与调用关系。所有标题、说明和关系文字都可以继续编辑。',
      code: `C4Container
  title 智能图表平台 C4 容器图
  Person(creator, "内容创作者", "创建、编辑并发布可视化图表")
  Person(admin, "团队管理员", "管理成员、模板与权限")
  System_Boundary(platform, "智能图表平台") {
    Container(web, "Web 编辑器", "Svelte", "提供实时编辑、预览与导出")
    Container(api, "业务 API", "Node.js", "处理作品、模板和团队规则")
    Container(worker, "渲染服务", "Browser Worker", "生成 PNG、SVG 与 PDF")
    ContainerDb(db, "作品数据库", "PostgreSQL", "保存作品、版本与协作数据")
    Container(cache, "协作缓存", "Redis", "同步在线状态与编辑事件")
  }
  System_Ext(identity, "身份服务", "完成登录与企业单点登录")
  System_Ext(storage, "对象存储", "保存导出文件与图片素材")

  Rel(creator, web, "创作与分享")
  Rel(admin, web, "配置团队空间")
  Rel(web, identity, "登录鉴权", "OIDC")
  Rel(web, api, "读取与保存作品", "HTTPS/JSON")
  Rel(api, db, "读写作品与版本")
  Rel(api, cache, "同步协作状态")
  Rel(api, worker, "提交导出任务")
  Rel(worker, storage, "写入导出文件")
  UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="1")
`
    }
  },
  {
    diagramType: 'Quadrant',
    title: '市场机会矩阵',
    state: {
      sampleDescription:
        '矩阵用横轴表示进入门槛、纵轴表示市场潜力，对六类 AI 可视化机会进行定位。可以拖动任意机会点改变坐标，也可以在左侧数据中修改名称和象限标题。',
      code: `quadrantChart
  title AI 可视化产品市场机会矩阵
  x-axis 进入门槛低 --> 进入门槛高
  y-axis 市场潜力低 --> 市场潜力高
  quadrant-1 战略投入
  quadrant-2 快速突破
  quadrant-3 机会有限
  quadrant-4 长期观察
  自然语言生成图表: [0.36, 0.88]
  团队实时协作: [0.64, 0.84]
  企业数据连接器: [0.82, 0.76]
  行业模板市场: [0.42, 0.67]
  通用白板工具: [0.28, 0.38]
  私有化部署: [0.86, 0.54]
`
    }
  },
  {
    diagramType: 'Sankey',
    title: 'AI 产品转化桑基图',
    state: {
      sampleDescription:
        '桑基图把搜索、社交、直接访问和内容推荐流量连接到四类 AI 功能，再流向注册、留存、付费和流失结果。连线宽度由数值决定，可在代码数据中修改权重并观察转化结构变化。',
      code: `%%{init: {"sankey": {"height": 280, "width": 600}}}%%
sankey-beta
搜索引擎,AI 对话,32
搜索引擎,文档分析,18
社交媒体,图片生成,26
社交媒体,AI 对话,14
直接访问,文档分析,16
直接访问,数据分析,14
内容推荐,图片生成,12
内容推荐,数据分析,10
AI 对话,注册,25
AI 对话,继续使用,15
AI 对话,付费转化,4
AI 对话,用户流失,2
文档分析,注册,10
文档分析,继续使用,15
文档分析,付费转化,6
文档分析,用户流失,3
图片生成,注册,16
图片生成,继续使用,12
图片生成,付费转化,5
图片生成,用户流失,5
数据分析,注册,6
数据分析,继续使用,8
数据分析,付费转化,8
数据分析,用户流失,2
`
    }
  }
];
