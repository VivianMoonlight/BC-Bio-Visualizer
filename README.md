# BC-Bio-Visualizer

**WCE 生物数据库可视化工具** — 支持书签注入与 Tampermonkey 两种安装方式。

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](./CHANGELOG.md)
[![License](https://img.shields.io/badge/license-SEE_LICENSE-green.svg)](./LICENSE)

## 功能概览

- 关系图渲染（主仆、恋爱关系）
- 多维度搜索和筛选
- 分组管理和节点着色
- 双击固定 / 追踪节点
- 导入 / 导出 JSON 数据
- 拖拽分隔器调整布局
- 快捷键操作（`Ctrl+Shift+V` 打开，`Space` 切换物理模拟）
- Shadow DOM 样式隔离，不干扰原页面

---

## 安装方式

> 选择下面 **任一** 方式即可。书签方式最简单，Tampermonkey 方式功能更完整。

### 方式一：书签（Bookmarklet） — 最快上手

适合不想装扩展、或在公共电脑上临时使用的场景。

1. 新建一个浏览器书签，名称随意，例如 `BC-Bio-Vis`
2. 将书签的 **网址（URL）** 设为以下代码（完整复制）：

```
javascript:void(function(){var s=document.createElement('script');s.type='module';s.crossOrigin='anonymous';s.src='https://vivianmoonlight.github.io/BC-Bio-Visualizer/bc-bio-visualizer.user.js?'+Date.now();s.onload=function(){s.remove()};document.head.appendChild(s)})()
```

3. 打开 BC 网站（`bondageprojects.com` 或 `bondageprojects.elementfx.com`）并登录
4. 点击刚创建的书签即可加载可视化工具

> **注意**：书签方式每次点击都会重新加载脚本，不会自动持久化分组数据（需手动导出/导入 JSON）。

---

### 方式二：Tampermonkey / Greasemonkey 用户脚本 — 推荐

适合长期使用，支持自动加载、数据持久化和跨域存储。

#### 第一步：安装 Tampermonkey 扩展

| 浏览器 | 安装链接 |
|--------|---------|
| Chrome / Edge | [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) |
| Firefox | [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/tampermonkey/) |

#### 第二步：安装脚本（任选其一）

**A. 一键安装（不推荐！）**

点击下方链接，Tampermonkey 会弹出安装确认页面，点击"安装"即可：

> [**安装 BC-Bio-Visualizer**](https://github.com/VivianMoonlight/BC-Bio-Visualizer/raw/main/bc-bio-visualizer.user.js)

**B. 使用 Loader 加载器（自动更新，推荐）**

Loader 是一个轻量加载器脚本，每次打开页面时自动从 GitHub Pages 拉取最新版本：

> [**安装 Loader**](https://github.com/VivianMoonlight/BC-Bio-Visualizer/raw/main/loader.user.js)

**C. 手动安装**

1. 点击 Tampermonkey 图标 → 管理面板 → "+"（添加新脚本）
2. 删除默认模板，将 [`bc-bio-visualizer.user.js`](https://github.com/VivianMoonlight/BC-Bio-Visualizer/blob/main/bc-bio-visualizer.user.js) 的全部内容粘贴进去
3. `Ctrl+S` 保存

#### 第三步：验证

1. 访问 BC 网站（`https://www.bondageprojects.com/` 或 `https://bondageprojects.elementfx.com/`）
2. Tampermonkey 图标应显示数字 `1`（表示脚本已激活）
3. 按 `Ctrl+Shift+V` 或在聊天框输入 `/biovis` 打开可视化界面

---

## 使用指南

### 打开 / 关闭

| 操作 | 方式 |
|------|------|
| 打开可视化 | `Ctrl+Shift+V`、点击右下角浮动按钮、或聊天中输入 `/biovis` |
| 关闭可视化 | 再次按 `Ctrl+Shift+V`、点击关闭按钮、或按 `Esc` |

### 数据加载

- **Tampermonkey 版**：点击界面中的"提取数据"按钮，自动从 IndexedDB 读取 WCE 生物数据库
- **书签版**：同上，点击"提取数据"
- **手动导入**：点击"导入 JSON"，加载之前导出的 `.json` 文件

### 图操作

| 操作 | 说明 |
|------|------|
| 单击节点 | 选中，显示详情面板 |
| 双击节点 | 固定 / 取消固定节点 |
| 拖拽节点 | 移动位置 |
| 滚轮 | 缩放 |
| 拖拽空白 | 平移画布 |
| `Space` | 切换物理模拟开关 |

### 搜索与筛选

- 顶部搜索框支持按 **名称 / 编号** 搜索
- 左侧面板可按关系类型、分组等条件筛选

### 分组管理

1. 选中一个节点后，在详情面板中将其加入分组
2. 可创建、编辑、删除分组
3. 同组节点自动着色，方便识别

### 数据导出

- **导出分组**：将分组、固定节点等标注数据保存为 JSON
- **导入分组**：还原之前导出的标注数据

---

## 从旧版 HTML 版本迁移

如果之前使用 `bc-graph-viewer.html` + `console-profiles.js`：

1. 在旧版中点击"导出分组"保存 JSON
2. 安装 Tampermonkey 版本（见上方安装指南）
3. 打开可视化界面后点击"导入分组"加载旧数据

数据格式完全兼容。

---

## 文件说明

| 文件 | 用途 |
|------|------|
| `bc-bio-visualizer.user.js` | 主脚本（Tampermonkey / 书签共用） |
| `loader.user.js` | 轻量加载器，自动拉取最新版 |
| `console-profiles.js` | 旧版控制台数据提取脚本 |
| `bc-graph-viewer.html` | 旧版单页可视化应用 |

## 技术栈

- 原生 JavaScript（无框架依赖）
- [vis-network](https://visjs.github.io/vis-network/) 9.1.9
- [LZ-String](https://pieroxy.net/blog/pages/lz-string/index.html) 1.4.4
- Tampermonkey GM API（用户脚本模式下）
- Shadow DOM 样式隔离

## 文档

- [INSTALL.md](./INSTALL.md) — 详细安装指南与常见问题
- [QUICKREF.md](./QUICKREF.md) — 快速参考
- [CHANGELOG.md](./CHANGELOG.md) — 更新日志
- [ARCHITECTURE.md](./ARCHITECTURE.md) — 架构与技术细节

## 许可证

详见 [LICENSE](./LICENSE) 文件。

## 链接

- [GitHub 仓库](https://github.com/VivianMoonlight/BC-Bio-Visualizer)
- [问题反馈](https://github.com/VivianMoonlight/BC-Bio-Visualizer/issues)
- [GitHub Pages](https://vivianmoonlight.github.io/BC-Bio-Visualizer/)

---

**快速提示**：双击节点固定可见性 · 按空格切换物理 · `Ctrl+Shift+V` 显示/隐藏
