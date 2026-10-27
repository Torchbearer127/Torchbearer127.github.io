# CCSC Blog Adaptation Implementation Plan

**Goal:** 三篇研究札记使用博客现有长文样式并完成本地响应式/数学/构建验收。
**Architecture:** 复用现有essay长文组件，series作为可选共享元数据；现有短札记不变。由编辑稿生成内容副本并迁移实际引用图片；KaTeX离线渲染。草稿预览与生产过滤分开。
**Tech Stack:** Astro 7、TypeScript、remark/rehype、KaTeX、node:test、Playwright。
**Spec:** docs/superpowers/specs/2026-10-26-ccsc-blog-adaptation.md

## Constraints / review focus

正文保真，原Word不改，沿用既有设计token，不发布。检查窄屏长公式/代码不撑宽页面、语言fallback后目录有效、三篇series顺序不由日期决定、仅复制被引用资源、正常build不输出草稿。

- [x] 1. series元数据与纯函数：先测试顺序/重复order/翻译重复元数据；再接schema及entity装配。
- [x] 2. 本地依赖与内容迁移：安装数学插件；生成三篇draft内容、实际62张图与URL映射，保留全文/公式/代码比对记录。
- [x] 3. 共享长文呈现：系列札记复用EssayLayout与目录/reader；增加系列导航、图注和研究札记局部样式；接数学渲染及本地字体。
- [x] 4. 验证：npm test与正常build；显式草稿preview build；浏览器检查三篇/旧文、明暗主题、移动目录、参考锚点和所有图/数学块。修复实际发现的问题并更新审计与发布适配说明。

Ruling: 用户的现有四项要求已给出设计方向和执行授权，本计划用于持续执行记录，不另起样式审批。当前仓库为既有隔离副本分支codex/interaction-visibility-pass，不修改/Users/torchbearer/code/blog。

Verification: 45/45 npm tests, production draft exclusion, 14-page draft build, 24 browser scenarios and original browser regressions passed. Final review findings fixed; evidence in editorial/ccsc-2026/audit/blog-adaptation-2026-10-26/. No commit/push/deploy requested.
