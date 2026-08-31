# 执炬人 / Torchbearer127

个人网站的最小工程骨架，使用 Astro、TypeScript 和 GitHub Pages。

## 本地开发

需要 Node.js 22.12.0 或更高版本。

```sh
npm install
npm run dev
```

开发服务器默认运行在 `http://localhost:4321`。

## 构建

```sh
npm run build
```

静态站点输出到 `dist/`。如需在本地预览构建结果：

```sh
npm run preview
```

## Writing 内容

Writing 使用一个统一的 Astro Content Collection，内容放在：

```text
src/content/writing/
├── research-notes/
└── essays/
```

Markdown frontmatter 的必填字段为 `title`、`description`、`date` 和 `type`。`type` 只能是
`research-note` 或 `essay`；`draft` 默认为 `false`，也可使用可选的 `tags`、`updated`、
`featured` 和 `noteKind`。

所有公开页面和生产构建都会排除 `draft: true` 的内容。当前没有加入公开示例文章；新内容可直接放入对应目录。
`research-notes/_content-system-fixture.md` 是明确标记为 draft 的内部管线夹具，用于避免空 collection
产生构建警告，不会生成公开列表项或详情路由。

## GitHub Pages 部署

项目按 GitHub Pages user site 配置：

- 仓库名应为 `Torchbearer127.github.io`；
- 发布地址为 `https://torchbearer127.github.io`；
- 默认分支为 `main`；
- GitHub Pages 的 Source 需在仓库 `Settings > Pages` 中设为 `GitHub Actions`。

推送到 `main` 后，[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) 会使用 Astro 官方 GitHub Action 构建并部署 `dist/`。
