# XIAOYUAN Personal Index

一个使用 Vite、原生 JavaScript 和 Three.js 制作的 3D 个人站原型。页面包含人物交互、滚动章节和底部导航；个人履历、项目成果和联系方式目前仍是待确认的占位内容。

线上地址：<https://Ywb822ovo.github.io/xiaoyuan-avatar-lab/>

## 本地运行

需要 Node.js 24。

```sh
npm ci
npm run dev
```

打开终端显示的本地地址。`npm run build` 会生成用于部署的 `dist` 目录。

## 部署

推送到 `main` 分支后，GitHub Actions 会自动构建并发布到 GitHub Pages。首次部署需在仓库的 **Settings → Pages → Build and deployment** 中选择 **GitHub Actions**。
