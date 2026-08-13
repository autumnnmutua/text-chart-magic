# 贡献指南

感谢参与 Text Chart Magic。

## 开始之前

1. 在 issue 中说明问题、复现方式或功能价值。
2. 保持修改集中，避免在修复功能时顺带重写无关模块。
3. 保留旧文档数据、Mermaid 源码和浏览器持久化格式的兼容性。

## 本地环境

```sh
corepack enable
pnpm install
pnpm dev
```

项目要求 Node.js 24+，包管理器版本以 `packageManager` 字段为准。

## 提交前检查

```sh
pnpm lint
pnpm check
pnpm exec vitest run
pnpm exec playwright test --workers=1
pnpm build
```

涉及图表交互时，请同时验证桌面端、手机竖屏和手机横屏。涉及公共节点、箭头、历史或持久化逻辑时，应至少覆盖一个普通节点图和一个固定语义图。

## 代码约定

- 优先使用已有公共状态、坐标、历史和持久化能力。
- 用户操作必须同时更新画面与底层数据。
- 高频拖动只在结束时写入一条历史，实时画面使用局部更新。
- 不提交 `.env.local`、依赖目录、构建产物、测试报告或平台本地状态。
- 新增可见文字使用简体中文，并为图标按钮提供可理解的名称。

## 安全问题

安全漏洞请按照 [SECURITY.md](SECURITY.md) 私下报告，不要在公开 issue 中附带访问令牌、用户数据或未修复漏洞的利用细节。
