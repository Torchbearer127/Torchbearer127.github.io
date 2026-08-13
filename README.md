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

## GitHub Pages 部署

项目按 GitHub Pages user site 配置：

- 仓库名应为 `Torchbearer127.github.io`；
- 发布地址为 `https://torchbearer127.github.io`；
- 默认分支为 `main`；
- GitHub Pages 的 Source 需在仓库 `Settings > Pages` 中设为 `GitHub Actions`。

推送到 `main` 后，[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) 会使用 Astro 官方 GitHub Action 构建并部署 `dist/`。
