# GitHub Pages 部署设计

## 目标

将当前 Vite + Three.js 个人站发布到公开仓库 `Ywb822ovo/xiaoyuan-avatar-lab`，通过 `https://Ywb822ovo.github.io/xiaoyuan-avatar-lab/` 访问。推送默认分支后由 GitHub Actions 自动构建和部署。

## 发布范围

- 发布现有网站源码、已跟踪的展示模型和部署工作流。
- 当前工作区中未跟踪的 Blender 工程、模型中间产物及制作脚本不属于本次发布内容。
- 页面中的个人介绍、项目和联系方式仍保持现有占位状态；部署不等于这些内容已完成或经过用户确认。

## 实现

1. 为 Vite 设置 `/xiaoyuan-avatar-lab/` 基础路径，使构建出的脚本和样式在 GitHub Pages 项目子路径下可加载。
2. 让 Three.js 模型地址使用 Vite 的 `BASE_URL`，兼容本地预览与线上子路径。
3. 添加仅在默认分支推送或手动触发时运行的 GitHub Actions 工作流：安装锁定依赖、构建、上传 `dist`、部署 Pages。
4. 新建公开 GitHub 仓库，推送本次网站源码改动，启用 GitHub Actions 作为 Pages 发布来源。

## 验证

- 本地构建通过，生成的入口和模型资源路径均包含正确子路径。
- GitHub Actions 构建和部署任务成功。
- 线上页面可访问，脚本、样式与 3D 模型正常加载；若浏览器不支持 WebGL，正文仍可浏览。

## 边界

GitHub Pages 是公开静态托管。仓库和页面均对外可见；后续推送默认分支会自动更新线上站点。
