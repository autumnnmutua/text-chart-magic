# Cloudflare Pages 到 Netlify 迁移评估

## 当前结论

本项目当前是 SvelteKit 静态单页应用，使用 `@sveltejs/adapter-static` 生成 `docs/`。作品编辑、自动保存和手动版本均存放在浏览器 `localStorage`，仓库中没有服务端保存 API、数据库或账号鉴权。

本次已完成本地兼容准备、Netlify 生产构建、完整浏览器回归和正式发布。经用户确认后创建独立站点 `text-chart-magic`，稳定地址为 `https://text-chart-magic.netlify.app`，当前生产部署为 `6a58f6bd93dc7a0510aaa5e9`，平台状态为 `ready`。没有修改自定义域名、DNS、线上环境变量或生产数据；现有 Cloudflare Pages 配置和发布能力完整保留。

## 实际依赖清单

| 当前 Cloudflare 能力                     | 项目中的具体位置                                                                   | Netlify 对应能力                           | 可直接迁移 | 风险 | 本次处理                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------ | ---------- | ---- | ---------------------------------------------------- |
| Pages 静态托管                           | `svelte.config.js` 输出 `docs/`；现网通过外部 Wrangler 直传                        | Netlify Static Hosting                     | 是         | 低   | 已补全 `netlify.toml` 构建与发布目录                 |
| SPA 路由                                 | `/`、`/edit`、`/view`；静态回退文件为 `404.html`                                   | Redirect/Rewrites                          | 是         | 低   | 已加入最后一条 `/* -> /index.html 200` 回退          |
| 构建环境变量                             | `MERMAID_DOMAIN`、`MERMAID_BASE_PATH`、`MERMAID_DOCS_URL`、`MERMAID_ANALYTICS_URL` | Netlify Build environment variables        | 是         | 低   | 已声明无密钥默认值；正式值仍需平台侧配置             |
| CDN 静态缓存                             | Vite 哈希资源位于 `/_app/immutable/`                                               | Netlify CDN headers                        | 是         | 低   | 已为哈希资源设置长期不可变缓存，为 HTML 设置重新验证 |
| 自定义域名、DNS、SSL                     | 根目录 `CNAME` 和现有 Pages 项目外部配置                                           | Netlify Domains + DNS/外部 DNS             | 需人工切换 | 中   | 未修改，必须在正式迁移窗口另行处理                   |
| Workers / Pages Functions                | 未发现                                                                             | Functions / Edge Functions                 | 不适用     | 低   | 无需迁移，也未创建空函数                             |
| KV / D1 / R2 / Durable Objects           | 未发现                                                                             | 外部数据库/对象存储或第三方服务            | 不适用     | 低   | 无需迁移                                             |
| Queues / Cron Triggers                   | 未发现                                                                             | Background Functions / Scheduled Functions | 不适用     | 低   | 无需迁移                                             |
| Workers AI / Images / Turnstile / Access | 未发现                                                                             | 对应第三方或 Netlify 集成                  | 不适用     | 低   | 无需迁移                                             |
| Cloudflare 运行时 API                    | 未发现 `request.cf`、`env` binding、Cloudflare SDK                                 | Node Functions / Edge Web APIs             | 不适用     | 低   | 业务代码无需平台适配层                               |
| 浏览器保存                               | `codeStore`、`manualHistoryStore`、`autoHistoryStore`                              | 与托管平台无关                             | 是         | 中   | 已补充可检测失败的统一保存入口                       |

## 迁移可能带来的收益

1. `netlify.toml` 将构建命令、发布目录、运行时版本、路由和缓存规则集中在仓库中，预览构建更容易复现。
2. 连接 Git 后可使用每次变更的 Deploy Preview、部署日志和一键回滚，团队验收流程会比当前本机直传更清楚。
3. 目前没有后端函数和平台数据服务，迁移面小，失败时仍可继续使用 Cloudflare Pages 发布同一份 `docs/`。
4. 收益主要在发布协作，不会直接改善图表渲染或本地保存性能；若团队不需要 Git 预览部署，迁移收益有限。

## 风险与建议

| 风险项                               | 当前影响                                | 风险等级 | 建议                                                                    |
| ------------------------------------ | --------------------------------------- | -------- | ----------------------------------------------------------------------- |
| SPA 子路由刷新 404                   | `/edit`、`/view` 可能无法直接刷新       | 低       | 保持 SPA fallback 为最后一条规则；未来 API/Functions 规则必须放在它前面 |
| 构建版本不一致                       | Node 或 pnpm 不一致可能导致依赖安装失败 | 低       | 保持 `.node-version`、`packageManager` 与 `netlify.toml` 一致           |
| 构建变量与运行时变量混淆             | 当前变量会被 Vite 编译进前端            | 中       | 仅放公开配置；任何密钥不得使用 `MERMAID_` 前缀或写入仓库                |
| 本地保存被误认为云端保存             | 换平台不会让作品跨设备同步              | 中       | 产品文案继续明确“本机版本”；如需云保存须单独设计认证与后端              |
| Cookie、Session、OAuth、CORS         | 当前未使用                              | 低       | 将来接入时重新登记 Netlify 回调域名并验证 SameSite/CORS                 |
| WebSocket、SSE、流式响应             | 当前未使用                              | 低       | 将来增加实时协作时先验证 Functions/Edge 限制，不应直接复用假设          |
| Functions 时长、内存、请求体和冷启动 | 当前无 Functions                        | 低       | 真正新增服务端接口前按当时套餐与地区重新核验，不在静态迁移中引入        |
| CDN 与浏览器旧缓存                   | HTML 可能指向旧资源                     | 中       | HTML 强制重新验证，哈希资源长期缓存；迁移时同时验证核心 JS 哈希         |
| 自定义域名、HTTPS、DNS               | 切换错误会影响全站访问                  | 高       | 单独安排迁移窗口，先验证 Netlify 临时域名，再降低 DNS TTL，保留回滚记录 |
| 成本与免费额度                       | 当前无法从代码判断实际流量              | 中       | 用真实带宽、构建分钟和团队席位估算；不要按宣传额度作生产承诺            |
| 地区延迟                             | CDN 命中与冷缓存可能不同                | 中       | 正式迁移前从主要用户地区对比冷/热加载，不只测试 HTTP 200                |
| 回滚                                 | 静态产物可同时发布                      | 低       | 不删除 Cloudflare 项目或配置；DNS 切换前保留 Pages 生产部署             |

## 验证与发布结果

- 本地验证：Node 24、pnpm 10.34.4、冻结锁文件安装、`pnpm build`、`docs/` 产物、Netlify 规则、单元测试和单工作进程浏览器回归均通过。
- 线上验证：稳定地址和不可变部署地址的 `/edit` HTML 完全一致；`/`、`/edit`、`/view`、尾斜杠和客户端回退均可访问，核心资源返回正确 MIME 与缓存头。
- 平台记录：站点 ID `e125e9d8-e73f-4114-8263-92c526f06cf7`，部署 ID `6a58f6bd93dc7a0510aaa5e9`，构建 ID `6a58f6bd93dc7a0510aaa5e7`。
- 线上交互：中文界面重复测试 3/3 通过；移动端保存、图表目录、触控拖拽、箭头跟随、多选、分支、代码编辑和精选示例均通过专项测试。
- 当前没有 Netlify Functions；项目真实保存架构是浏览器 `localStorage`，因此没有遗漏应部署的服务端函数。

## 后续迁移事项

1. 当前 Netlify 临时域名已经可用，但没有绑定自定义域名，也没有切换 DNS。
2. 浏览器本地作品按域名隔离，不会从 Cloudflare 地址自动迁移；跨域迁移应使用现有导出/导入能力。
3. 若未来连接 Git 自动发布，应将当前上传式生产部署切换为受保护的生产分支，并保留同样的 Node、pnpm、路由和缓存配置。
4. 自定义域名切换应单独审批，并先核验 SSL、DNS TTL、缓存和回滚路径。
5. Cloudflare 原站与配置继续保留；Netlify 上一可用部署 `6a58f11474f5037bf4ccb76e` 可作为平台内回滚点。
