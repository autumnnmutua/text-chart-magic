import type { SampleExample } from './mermaid';

const initialSample = (title: string, code: string): SampleExample => ({
  code,
  isDefault: true,
  title
});

export const localizedDiagramSamples: Record<string, SampleExample[]> = {
  Architecture: [
    initialSample(
      '在线零售平台架构',
      `architecture-beta
  group edge(cloud)[接入层]
  group core(cloud)[业务服务]
  group data(cloud)[数据层]

  service client(internet)[用户端] in edge
  service gateway(server)[API 网关] in edge
  service order(server)[订单服务] in core
  service payment(server)[支付服务] in core
  service database(database)[业务数据库] in data
  service events(disk)[事件存储] in data

  client:R -- L:gateway
  gateway:B -- T:order
  gateway:R -- L:payment
  order:B -- T:database
  payment:B -- T:events
  %% architecture-group {"auto":true,"height":180,"id":"architecture-group-business","label":"业务服务","memberIds":["order","payment"],"moveMembers":true,"width":320,"x":40,"y":40}
`
    )
  ],
  Block: [
    initialSample(
      '订单处理模块',
      `block-beta
  columns 3
  client["客户端"]
  gateway["API 网关"]
  auth["认证服务"]
  order["订单服务"]
  payment["支付服务"]
  inventory["库存服务"]
  database[("业务数据库")]
  events["事件总线"]
  notice["通知服务"]

  client --> gateway
  gateway --> auth
  gateway --> order
  order --> payment
  order --> inventory
  order --> database
  payment --> events
  inventory --> events
  events --> notice
`
    )
  ],
  C4: [
    initialSample(
      '在线零售平台容器图',
      `C4Container
  title 在线零售平台容器图
  Person(customer, "顾客", "浏览商品并提交订单")
  System_Boundary(platform, "在线零售平台") {
    Container(web, "用户端", "Web / App", "提供浏览和下单体验")
    Container(api, "业务 API", "Node.js", "处理订单和库存规则")
    ContainerDb(db, "业务数据库", "PostgreSQL", "保存商品、订单和库存")
  }
  System_Ext(payment, "支付平台", "完成支付与退款")

  Rel(customer, web, "浏览与下单")
  Rel(web, api, "调用", "HTTPS/JSON")
  Rel(api, db, "读写")
  Rel(api, payment, "发起支付", "HTTPS")
  UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="2")
`
    )
  ],
  Class: [
    initialSample(
      '订单领域类图',
      `classDiagram
  class Customer["客户"] {
    +String id
    +String name
    +placeOrder()
  }
  class Order["订单"] {
    +String orderNo
    +OrderStatus status
    +calculateTotal()
    +cancel()
  }
  class OrderItem["订单项"] {
    +int quantity
    +decimal unitPrice
    +subtotal()
  }
  class Product["商品"] {
    +String sku
    +String title
    +changeStock()
  }

  Customer "1" --> "0..*" Order : 创建
  Order "1" *-- "1..*" OrderItem : 包含
  OrderItem "*" --> "1" Product : 引用
`
    )
  ],
  'Entity Relationship': [
    initialSample(
      '订单数据模型',
      `erDiagram
  CUSTOMER ||--o{ ORDER : 创建
  ORDER ||--|{ ORDER_ITEM : 包含
  PRODUCT ||--o{ ORDER_ITEM : 对应

  CUSTOMER {
    string id PK "客户编号"
    string name "客户姓名"
    string email UK "联系邮箱"
  }
  ORDER {
    string id PK "订单编号"
    string customerId FK "所属客户"
    date createdAt "创建日期"
    string status "订单状态"
  }
  ORDER_ITEM {
    string orderId FK "所属订单"
    string productId FK "对应商品"
    int quantity "购买数量"
    decimal price "成交单价"
  }
  PRODUCT {
    string id PK "商品编号"
    string title "商品名称"
    decimal price "销售价格"
  }
`
    )
  ],
  Flowchart: [
    initialSample(
      '订单履约流程',
      `flowchart TD
  Start([收到订单]) --> Check{库存是否充足}
  Check -->|是| Pay[确认支付]
  Check -->|否| Restock[补货并通知顾客]
  Restock --> Check
  Pay --> Pack[仓库拣货打包]
  Pack --> Ship[交付物流]
  Ship --> End([订单完成])
`
    )
  ],
  Gantt: [
    initialSample(
      '产品发布计划',
      `gantt
  title 产品发布计划
  dateFormat YYYY-MM-DD
  axisFormat %m-%d

  section 需求与设计
  用户调研 :done, research, 2026-07-01, 3d
  需求确认 :milestone, confirm, after research, 0d
  交互设计 :active, design, after confirm, 4d

  section 开发与联调
  核心开发 :develop, after design, 6d
  接口联调 :integration, after develop, 3d

  section 测试与发布
  验收测试 :crit, test, after integration, 3d
  正式发布 :milestone, release, after test, 0d
`
    )
  ],
  Git: [
    initialSample(
      '功能发布分支',
      `gitGraph
  commit id: "项目初始化"
  branch develop
  checkout develop
  commit id: "搭建业务框架"
  branch feature-order
  checkout feature-order
  commit id: "实现订单创建"
  commit id: "补充订单测试"
  checkout develop
  merge feature-order id: "合并订单功能"
  checkout main
  merge develop id: "发布新版本" tag: "v1.0"
`
    )
  ],
  Ishikawa: [
    initialSample(
      '订单延迟原因分析',
      `ishikawa-beta
  订单交付延迟
  流程
    审批步骤过多
    异常处理不清晰
  人员
    高峰期排班不足
    跨团队沟通延迟
  系统
    库存同步滞后
    接口响应缓慢
      外部支付超时
      重试策略不足
  环境
    节假日订单激增
    物流天气影响
`
    )
  ],
  Kanban: [
    initialSample(
      '迭代任务看板',
      `kanban
  backlog[待规划]
    research[梳理用户需求]@{ assigned: "产品", priority: "High" }
    metrics[确认成功指标]@{ assigned: "数据", priority: "High" }
  doing[进行中]
    checkout[优化结算流程]@{ assigned: "开发", priority: "Very High" }
    prototype[验证交互原型]@{ assigned: "设计", priority: "High" }
  testing[待验证]
    regression[执行回归测试]@{ assigned: "测试", priority: "High" }
  done[已完成]
    kickoff[完成项目启动]@{ assigned: "团队", priority: "Low" }
`
    )
  ],
  Mindmap: [
    initialSample(
      '产品规划思维导图',
      `mindmap
  root((产品规划))
    用户价值
      更快完成下单
      清楚查看物流
      便捷处理售后
    核心能力
      商品与搜索
        分类导航
        个性化推荐
      交易与支付
        购物车
        优惠计算
        安全支付
      履约与服务
        库存同步
        物流跟踪
        退款售后
    衡量指标
      下单转化率
      履约时长
      用户满意度
`
    )
  ],
  Packet: [
    initialSample(
      '应用消息数据包',
      `---
title: "应用消息数据包"
---
packet
0-7: "版本"
8-15: "消息类型"
16-31: "消息长度"
32-63: "请求编号"
64-71: "状态标记"
72-79: "保留位"
80-95: "校验值"
96-127: "业务数据"
`
    )
  ],
  Pie: [
    initialSample(
      '订单来源占比',
      `pie showData title 订单来源占比
  "移动应用" : 45
  "微信小程序" : 30
  "桌面网站" : 15
  "线下门店" : 10
`
    )
  ],
  Quadrant: [
    initialSample(
      '功能优先级矩阵',
      `quadrantChart
  title 功能优先级矩阵
  x-axis 实施成本低 --> 实施成本高
  y-axis 用户价值低 --> 用户价值高
  quadrant-1 重点规划
  quadrant-2 优先实施
  quadrant-3 暂缓处理
  quadrant-4 谨慎投入
  快速结算: [0.25, 0.82]
  智能推荐: [0.68, 0.76]
  主题皮肤: [0.22, 0.30]
  全渠道库存: [0.78, 0.55]
`
    )
  ],
  Radar: [
    initialSample(
      '产品体验评估',
      `---
title: "产品体验评估"
---
radar-beta
  axis ease["易用性"], speed["响应速度"], stability["稳定性"]
  axis features["功能完整度"], service["服务体验"], value["业务价值"]
  curve current["当前版本"]{82, 76, 88, 70, 74, 80}
  curve target["目标版本"]{92, 90, 94, 88, 86, 92}
  max 100
  min 0
`
    )
  ],
  Requirement: [
    initialSample(
      '在线订单需求',
      `requirementDiagram
  requirement order_requirement {
    id: R001
    text: "支持在线创建订单"
    risk: medium
    verifymethod: test
  }
  functionalRequirement payment_requirement {
    id: R002
    text: "支持安全支付和退款"
    risk: high
    verifymethod: inspection
  }
  performanceRequirement response_requirement {
    id: R003
    text: "核心页面两秒内响应"
    risk: low
    verifymethod: demonstration
  }
  element order_service {
    type: "订单服务"
    docref: "产品需求文档"
  }

  order_requirement - contains -> payment_requirement
  order_requirement - contains -> response_requirement
  payment_requirement - satisfies -> order_service
`
    )
  ],
  Sankey: [
    initialSample(
      '订单转化路径',
      `sankey-beta

"访问首页","浏览商品",1000
"浏览商品","加入购物车",620
"浏览商品","离开页面",380
"加入购物车","提交订单",410
"加入购物车","暂未购买",210
"提交订单","支付成功",350
"提交订单","支付失败",60
"支付成功","完成履约",330
"支付成功","退款售后",20
`
    )
  ],
  Sequence: [
    initialSample(
      '订单创建时序',
      `sequenceDiagram
  autonumber
  actor User as 顾客
  participant Web as 用户端
  participant Order as 订单服务
  participant Stock as 库存服务
  participant Pay as 支付平台

  User->>Web: 提交订单
  Web->>Order: 创建订单
  Order->>Stock: 锁定库存
  Stock-->>Order: 返回锁定结果
  Order->>Pay: 发起支付
  Pay-->>Order: 返回支付结果
  Order-->>Web: 返回订单状态
  Web-->>User: 展示订单详情
`
    )
  ],
  State: [
    initialSample(
      '订单状态流转',
      `stateDiagram-v2
  Pending: 待支付
  Paid: 已支付
  Shipping: 配送中
  Completed: 已完成
  Cancelled: 已取消

  [*] --> Pending
  Pending --> Paid: 支付成功
  Pending --> Cancelled: 超时或主动取消
  Paid --> Shipping: 仓库发货
  Shipping --> Completed: 确认收货
  Cancelled --> [*]
  Completed --> [*]
`
    )
  ],
  Timeline: [
    initialSample(
      '产品演进时间线',
      `timeline
  title 产品演进时间线
  2024 : 完成最小可用版本
       : 上线商品与订单能力
  2025 : 推出移动应用
       : 接入会员与优惠体系
  2026 : 建设智能推荐
       : 打通全渠道库存
  2027 : 拓展国际市场
       : 支持多语言与多币种
`
    )
  ],
  TreeView: [
    initialSample(
      '在线零售平台结构树',
      `treeView-beta
  "在线零售平台"
    "用户体验"
      "首页与搜索"
      "商品详情"
      "购物车"
    "交易服务"
      "订单"
        "创建订单"
        "取消订单"
      "支付"
        "支付确认"
        "退款处理"
      "履约"
        "库存"
        "物流"
    "数据平台"
      "指标仓库"
      "实时分析"
      "经营报表"
`
    )
  ],
  Treemap: [
    initialSample(
      '产品资源分布',
      `treemap-beta
  "用户体验"
    "搜索与发现": 18
    "商品详情": 14
    "购物车": 10
  "交易能力"
    "订单服务": 20
    "支付服务": 16
    "优惠系统": 8
  "履约能力"
    "库存服务": 9
    "物流跟踪": 5
`
    )
  ],
  'User Journey': [
    initialSample(
      '在线购物旅程',
      `journey
  title 在线购物旅程
  section 发现商品
    搜索目标商品: 4: 顾客
    比较价格评价: 3: 顾客
  section 完成购买
    加入购物车: 5: 顾客
    填写收货信息: 3: 顾客
    完成支付: 4: 顾客
  section 等待履约
    查看物流进度: 3: 顾客
    确认收货: 5: 顾客
  section 售后服务
    提交评价: 4: 顾客
`
    )
  ],
  Venn: [
    initialSample(
      '产品能力交集',
      `venn-beta
  title "产品能力交集"
  set product["产品价值"]
  set technology["技术可行性"]
  set business["商业目标"]
  union product,technology["可实现体验"]
  union technology,business["可规模化能力"]
  union product,business["市场机会"]
  union product,technology,business["优先方案"]
`
    )
  ],
  'Wardley Maps': [
    initialSample(
      '在线下单价值链',
      `wardley-beta
title 在线下单价值链
size [1100, 760]

anchor 顾客 [0.95, 0.65]
component 在线下单 [0.82, 0.65] label [-48, -8]
component 商品体验 [0.70, 0.48]
component 订单编排 [0.61, 0.62]
component 库存数据 [0.45, 0.46]
component 支付网关 [0.39, 0.76]
component 云计算 [0.18, 0.88]

顾客 -> 在线下单
在线下单 -> 商品体验
在线下单 -> 订单编排
订单编排 -> 库存数据
订单编排 -> 支付网关
库存数据 -> 云计算
支付网关 -> 云计算

evolve 库存数据 0.68
evolve 支付网关 0.86
note "订单编排是当前差异化能力" [0.58, 0.58]
`
    )
  ],
  XY: [
    initialSample(
      '月度订单趋势',
      `xychart-beta
  title "月度订单趋势"
  x-axis ["一月", "二月", "三月", "四月", "五月", "六月"]
  y-axis "订单数量" 0 --> 1200
  bar [520, 610, 720, 860, 980, 1100]
  line [500, 640, 700, 900, 960, 1150]
`
    )
  ],
  ZenUML: [
    initialSample(
      '订单服务调用',
      `zenuml
  title 订单服务调用
  @Actor Customer #FFEDD5
  @Boundary WebApp #FDBA74
  @EC2 <<Service>> OrderService #FED7AA
  @Lambda InventoryService #FFEDD5
  @AzureFunction PaymentService #FFF7ED

  @Starter(Customer)
  // 提交订单
  WebApp.submitOrder(payload) {
    OrderService.create(payload) {
      InventoryService.reserve(payload.items)
      PaymentService.charge(payload.payment)
    }
  }
`
    )
  ]
};
