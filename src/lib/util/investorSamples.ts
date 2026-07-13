import type { State } from '$lib/types';

export interface InvestorSample {
  diagramType: string;
  state: Pick<State, 'code'> &
    Partial<
      Pick<
        State,
        'mermaid' | 'visualConnections' | 'visualLayers' | 'visualPositions' | 'visualStyles'
      >
    >;
  title: string;
}

export const investorSamples: InvestorSample[] = [
  {
    diagramType: 'Flowchart',
    title: 'SaaS 产品系统架构',
    state: {
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
    diagramType: 'Block',
    title: '自由块图与箭头展示',
    state: {
      code: `block-beta
  columns 5
  research["用户研究"] space product["产品方案"] space launch["市场发布"]
  space:5
  data[("数据洞察")] space engine["增长引擎"] space revenue["商业收入"]
`,
      visualConnections: {
        'connection-showcase-1': {
          direction: 'forward',
          id: 'connection-showcase-1',
          label: '形成洞察',
          lineStyle: 'solid',
          source: { anchor: 'right', elementId: 'research', x: 120, y: 80 },
          strokeWidth: 2,
          target: { anchor: 'left', elementId: 'product', x: 300, y: 80 }
        },
        'connection-showcase-2': {
          direction: 'forward',
          id: 'connection-showcase-2',
          label: '验证发布',
          lineStyle: 'solid',
          source: { anchor: 'right', elementId: 'product', x: 400, y: 80 },
          strokeWidth: 2,
          target: { anchor: 'left', elementId: 'launch', x: 580, y: 80 }
        },
        'connection-showcase-3': {
          direction: 'both',
          id: 'connection-showcase-3',
          label: '实验反馈',
          lineStyle: 'dashed',
          source: { anchor: 'right', elementId: 'data', x: 120, y: 220 },
          strokeWidth: 3,
          target: { anchor: 'left', elementId: 'engine', x: 300, y: 220 }
        },
        'connection-showcase-4': {
          direction: 'forward',
          id: 'connection-showcase-4',
          label: '规模增长',
          lineStyle: 'solid',
          source: { anchor: 'right', elementId: 'engine', x: 400, y: 220 },
          strokeWidth: 2,
          target: { anchor: 'left', elementId: 'revenue', x: 580, y: 220 }
        },
        'connection-showcase-5': {
          direction: 'forward',
          id: 'connection-showcase-5',
          label: '效果回流',
          lineStyle: 'dashed',
          source: { anchor: 'bottom', elementId: 'launch', x: 620, y: 130 },
          strokeWidth: 2,
          target: { anchor: 'top', elementId: 'revenue', x: 620, y: 190 }
        },
        'connection-showcase-free': {
          direction: 'none',
          id: 'connection-showcase-free',
          label: '外部信号',
          lineStyle: 'dashed',
          source: { x: 100, y: 0 },
          strokeWidth: 2,
          target: { anchor: 'top', elementId: 'data', x: 60, y: 220 }
        }
      },
      visualStyles: {
        data: { fill: '#fff7ed', stroke: '#f97316', text: '#431407' },
        engine: { fill: '#ffedd5', stroke: '#ea580c', text: '#431407' },
        launch: { fill: '#ffffff', stroke: '#fb923c', text: '#431407' },
        product: { fill: '#ffedd5', stroke: '#f97316', text: '#431407' },
        research: { fill: '#ffffff', stroke: '#fb923c', text: '#431407' },
        revenue: { fill: '#fed7aa', stroke: '#ea580c', text: '#431407' }
      }
    }
  }
];
