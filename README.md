为kelar编写的，下载WCE bio数据库的控制台代码和用于可视化的单页应用。

双击节点固定可见性。按空格切换物理。拖动节点重排。

## 📁 文件说明

- **console-profiles.js** - 控制台数据提取脚本
- **bc-graph-viewer.html** - 单页可视化应用

## 📖 文档

- **[QUICKREF.md](./QUICKREF.md)** - 快速参考指南（推荐从这里开始）
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - 详细架构与功能说明

## 🚀 快速开始

### 1. 提取数据
在包含 bce-past-profiles 数据库的页面：
1. 打开开发者工具 (F12)
2. 在 Console 中运行 `console-profiles.js`
3. 下载生成的 `testprofiles.extracted.json`

### 2. 可视化
1. 打开 `bc-graph-viewer.html`
2. 选择 JSON 文件加载
3. 开始探索关系网络！

详细使用方法请参阅 [快速参考指南](./QUICKREF.md)
