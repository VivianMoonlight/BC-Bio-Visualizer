# BC-Bio-Visualizer

**WCE生物数据库可视化工具** - 现已推出 Tampermonkey 版本！

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](./CHANGELOG.md)
[![License](https://img.shields.io/badge/license-SEE_LICENSE-green.svg)](./LICENSE)

## 🎉 v2.0.0 重大更新

BC-Bio-Visualizer 现已迁移为 **Tampermonkey 用户脚本**，提供更便捷的使用体验！

### ✨ 新版本特性

- ✅ **自动集成**：直接在 BC 网站上使用，无需手动下载数据
- ✅ **数据持久化**：使用 Tampermonkey API 跨域存储
- ✅ **Shadow DOM**：完全样式隔离，避免冲突
- ✅ **分组管理**：创建、编辑、删除分组，节点着色
- ✅ **节点固定**：双击固定重要节点
- ✅ **智能缓存**：5分钟缓存提升性能
- ✅ **快捷键**：`Ctrl+Shift+V` 快速打开，`Space` 切换物理

## 📦 安装方式

### 快速安装（推荐）

1. **安装 Tampermonkey**
   - [Chrome/Edge](https://chrome.google.com/webstore/detail/tampermonkey/)
   - [Firefox](https://addons.mozilla.org/firefox/addon/tampermonkey/)

2. **安装脚本**
   - 点击：[安装 BC-Bio-Visualizer](https://github.com/your-repo/BC-Bio-Visualizer/raw/main/bc-bio-visualizer.user.js)
   - 或下载 `bc-bio-visualizer.user.js` 手动安装

3. **开始使用**
   - 访问 BC 网站
   - 按 `Ctrl+Shift+V` 或点击右下角浮动按钮
   - 点击"提取数据"

详细安装步骤请查看 [安装指南](./INSTALL.md)

## 📖 文档

- **[INSTALL.md](./INSTALL.md)** - 详细安装指南
- **[QUICKREF.md](./QUICKREF.md)** - 快速参考（推荐从这里开始）
- **[RELEASE_NOTES.md](./RELEASE_NOTES.md)** - v2.0.0 发布说明
- **[CHANGELOG.md](./CHANGELOG.md)** - 完整更新日志
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - 架构与技术细节

## 📁 文件说明

### Tampermonkey 版本（推荐）
- **bc-bio-visualizer.user.js** - 主用户脚本（~2200行）
- **loader.js** - 自动更新加载器（可选）

### 旧版本（仍可用）
- **console-profiles.js** - 控制台数据提取脚本
- **bc-graph-viewer.html** - 单页可视化应用

## 🚀 快速开始

### Tampermonkey 版本（推荐）

1. [安装脚本](#安装方式)
2. 访问 BC 网站：
   - https://www.bondageprojects.com/
   - https://bondageprojects.elementfx.com/
3. 按 `Ctrl+Shift+V` 打开可视化界面
4. 点击"提取数据"开始使用

### HTML 版本（旧版）

1. **提取数据**
   - 在包含 bce-past-profiles 数据库的页面
   - 打开开发者工具 (F12)
   - 在 Console 中运行 `console-profiles.js`
   - 下载生成的 `testprofiles.extracted.json`

2. **可视化**
   - 打开 `bc-graph-viewer.html`
   - 选择 JSON 文件加载
   - 开始探索关系网络

## 🎯 主要功能

### 数据可视化
- 📊 关系图渲染（主仆、恋爱关系）
- 🔍 多维度搜索和筛选
- 📌 节点固定和追踪
- 🎨 分组管理和着色

### 用户体验
- ⚡ 智能缓存和性能优化
- 🎨 拖拽分隔器调整布局
- 💬 Toast 通知反馈
- ⌨️ 快捷键支持

### 数据管理
- 💾 自动数据持久化
- 📥 导入/导出 JSON
- 🔄 数据格式兼容

## 🔄 从旧版本迁移

如果您之前使用 HTML 版本：

1. 在旧版中点击"导出分组"保存数据
2. 安装 Tampermonkey 版本
3. 点击"导入分组"恢复数据

数据格式完全兼容，可直接导入导出。

## 🛠️ 技术栈

- **框架**: 原生 JavaScript（无依赖）
- **图形库**: vis-network 9.1.9
- **压缩**: LZ-String 1.4.4
- **存储**: Tampermonkey GM API
- **样式隔离**: Shadow DOM

## 📊 项目状态

- **版本**: 2.0.0
- **状态**: ✅ 完全可用
- **核心功能**: 100% 完成
- **代码行数**: ~2200 行
- **测试**: 已在 700+ 数据集上测试

## 🐛 已知限制

- 圈子管理功能暂未实现（可选高级功能）
- 凸包轮廓渲染暂未实现（可选高级功能）

## 🔮 未来计划

- [ ] 圈子管理 UI
- [ ] 凸包轮廓可视化
- [ ] 多语言支持
- [ ] 更多主题选项

## 📝 更新日志

查看 [CHANGELOG.md](./CHANGELOG.md) 了解完整更新历史。

## 🙏 致谢

感谢所有测试和反馈的用户！

## 📄 许可证

详见 [LICENSE](./LICENSE) 文件。

## 🔗 相关链接

- [问题反馈](https://github.com/your-repo/BC-Bio-Visualizer/issues)
- [GitHub 仓库](https://github.com/your-repo/BC-Bio-Visualizer)

---

**快速提示**：双击节点固定可见性 • 按空格切换物理 • Ctrl+Shift+V 显示/隐藏
