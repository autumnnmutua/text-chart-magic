# 图表编辑器

中文、橙白配色的 Mermaid 可视化编辑器。打开后直接进入完整编辑界面，可在源码和图上编辑，并实时预览结果。

稳定地址：[text-chart-magic.pages.dev](https://text-chart-magic.pages.dev/)

## 主要功能

- 27 类中文初始示例，覆盖流程图、树图、C4、甘特图、类图、需求图等常用图表。
- 图上双击编辑文本，并可添加、删除和继续扩展分支。
- C4、架构图和块图支持模块拖动，相关连线实时跟随。
- 绘画软件式调色面板，支持 HSV、Alpha、HEX、RGB、HSL、预设和最近颜色。
- 常驻撤回、重做、重置和历史保存，修改会保存在当前浏览器中。
- 支持画布平移、缩放，以及 PNG、SVG 导出。
- 不需要 API Key、数据库、模型或外部账号。

## 本地开发

要求 Node.js 24.16 或更高版本，并使用项目声明的 pnpm 版本。

```sh
corepack enable
pnpm install
pnpm dev -- --open
```

默认开发地址为 <http://localhost:3000>。

## 检查与构建

```sh
pnpm check
pnpm test:unit -- --run --maxWorkers=1
pnpm test:e2e -- --workers=1
pnpm build
```

生产静态文件会生成到 `docs/`。

## Docker

```sh
docker compose up --build
```

或者构建并运行生产镜像：

```sh
docker build -t text-chart-editor .
docker run --detach --name text-chart-editor --publish 8080:8080 text-chart-editor
```

随后访问 <http://localhost:8080>。

## 数据与兼容

编辑状态、历史记录、调色和手动位置保存在浏览器本地存储中。旧版分享链接和缺少新增字段的旧状态会在读取时补齐安全默认值；更换初始示例不会覆盖已经保存的作品。

本项目基于 MIT 许可的 Mermaid Live Editor 继续开发。
