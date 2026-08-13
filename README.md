# Text Chart Magic

Text Chart Magic 是一个中文、开源、桌面端与移动端均可用的可视化图表编辑器。它在 Mermaid 源码能力之上增加了画布直接编辑、分支扩展、自由图形与箭头、历史记录、示例中心和触控工作区。

- 在线使用：[text-chart-magic.pages.dev](https://text-chart-magic.pages.dev/)
- 当前版本：`v1.0.1`
- 开源许可：[MIT](LICENSE)

## 核心能力

- 覆盖流程图、类图、实体关系图、架构图、C4、甘特图、Git、需求图、看板、鱼骨图、象限图、XY 图等 27 类图表。
- 原始示例与新增元素共用编辑链路，可编辑文字、添加分支、删除、拖动、调色和恢复。
- 自由图形与图标支持选择、移动、缩放、复制、分支以及八点箭头吸附。
- 自主箭头支持自由端、单端或双端连接、方向、关系文字、样式和端点重连。
- 支持多选、框选、批量对齐、智能吸附、图层大纲、全局搜索替换和命令面板。
- 代码工作台可查看并手动编辑 Mermaid/JSON 配置；无效草稿不会破坏最后一次有效画面。
- 保存、自动历史、撤销、重做、重置和刷新恢复使用同一份完整文档状态。
- 手机端提供安全区工具栏、底部面板、触控拖动、多选、箭头连接和保存能力。

## XY 图

XY 图保留经过验证的系列编辑方式：

- 纵坐标数据系列可以新增、改名、切换柱状/折线、排序和删除。
- 系列数字使用逗号分隔编辑，并与现有横坐标分类一一对应。
- 纵坐标支持轴名称、最小值和最大值。
- 横坐标分类继续由代码工作台管理，避免不稳定的数据迁移影响旧作品。

## 本地开发

要求 Node.js 24 或更高版本，并使用仓库声明的 pnpm 版本。

```sh
corepack enable
pnpm install
pnpm dev -- --open
```

默认开发地址为 <http://localhost:3000>。

## 质量检查

```sh
pnpm lint
pnpm check
pnpm exec vitest run
pnpm exec playwright test --workers=1
pnpm build
```

生产静态文件生成到 `docs/`。完整浏览器测试需要安装 Playwright Chromium。

## 部署

项目使用 `@sveltejs/adapter-static`，可部署到 Cloudflare Pages、Netlify、GitHub Pages 或任意静态文件服务器。

Cloudflare Pages：

```sh
pnpm build
npx wrangler pages deploy docs --project-name text-chart-magic
```

Netlify 配置已包含在 [netlify.toml](netlify.toml)；现有 Cloudflare 发布能力不依赖 Netlify。

## Docker

```sh
docker compose up --build
```

或构建生产镜像：

```sh
docker build -t text-chart-magic .
docker run --detach --name text-chart-magic --publish 8080:8080 text-chart-magic
```

随后访问 <http://localhost:8080>。

## 数据与隐私

默认保存架构为浏览器本地持久化，不需要 API Key、数据库或外部账号。图表源码、视觉元素、箭头、样式、位置、示例说明和历史记录会作为同一文档状态保存。旧分享链接和缺少新字段的旧状态在读取时补齐安全默认值。

## 参与贡献

提交问题或代码前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)、[SECURITY.md](SECURITY.md) 和 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。版本变化见 [CHANGELOG.md](CHANGELOG.md)。

## 上游与许可

本项目基于 [Mermaid Live Editor](https://github.com/mermaid-js/mermaid-live-editor) 继续开发，并使用 [Mermaid](https://github.com/mermaid-js/mermaid) 渲染语法图表。原始版权声明与 MIT 许可保留在 [LICENSE](LICENSE)，详细归属见 [NOTICE.md](NOTICE.md)。
