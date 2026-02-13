# BC-Bio-Visualizer 安装指南

## 前置要求

- **浏览器**：Chrome、Firefox 或 Edge（现代版本）
- **BC 网站**：需要 WCE 的 bce-past-profiles 数据库

> 根据使用场景选择安装方式：**书签** 或 **Tampermonkey**。

---

## 方式一：书签（Bookmarklet）

无需安装任何扩展，适合临时使用或不方便装插件的环境。

### 安装步骤

1. **创建书签**
   - 在书签栏上右键 → "添加书签"（或 `Ctrl+D`）
   - 名称填写 `BC-Bio-Vis`（随意）
   - 网址（URL）粘贴以下代码：

```
javascript:void(function(){var s=document.createElement('script');s.type='module';s.crossOrigin='anonymous';s.src='https://vivianmoonlight.github.io/BC-Bio-Visualizer/bc-bio-visualizer.user.js?'+Date.now();s.onload=function(){s.remove()};document.head.appendChild(s)})()
```

2. **使用**
   - 打开 BC 网站并登录
   - 点击书签栏上的 `BC-Bio-Vis` 书签
   - 等待工具加载完成后即可使用

### 书签方式的特点

| 优点 | 限制 |
|------|------|
| 无需安装扩展 | 每次需手动点击书签加载 |
| 适合公共/临时电脑 | 不支持 GM API 持久化存储 |
| 始终加载最新版本 | 分组数据需手动导出/导入 |

---

## 方式二：Tampermonkey 用户脚本（推荐）

优势：自动加载、数据持久化（分组、固定节点自动保存）、聊天命令 `/biovis`。

### 第一步：安装 Tampermonkey 扩展

| 浏览器 | 安装链接 |
|--------|---------|
| Chrome / Edge | [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) |
| Firefox | [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/tampermonkey/) |

### 第二步：安装脚本

选择以下任一方式：

#### A. 一键安装（推荐）

点击链接，Tampermonkey 会弹出安装页面 → 点击"安装"：

> [**安装 BC-Bio-Visualizer**](https://github.com/VivianMoonlight/BC-Bio-Visualizer/raw/main/bc-bio-visualizer.user.js)

#### B. 使用 Loader（自动更新）

Loader 是轻量加载器，每次打开页面自动从 GitHub Pages 加载最新版本：

> [**安装 Loader**](https://github.com/VivianMoonlight/BC-Bio-Visualizer/raw/main/loader.user.js)

Loader 优势：
- 始终加载最新版本
- 无需手动更新脚本
- 体积极小（< 1KB）

#### C. 手动安装

1. 点击 Tampermonkey 图标 → 管理面板 → "+"（添加新脚本）
2. 删除默认模板代码
3. 打开 [`bc-bio-visualizer.user.js`](https://github.com/VivianMoonlight/BC-Bio-Visualizer/blob/main/bc-bio-visualizer.user.js)，复制全部代码粘贴进去
4. `Ctrl+S` 保存

### 第三步：验证安装

1. 访问 BC 网站：
   - https://www.bondageprojects.com/
   - https://bondageprojects.elementfx.com/

2. 检查 Tampermonkey 图标上是否显示数字 `1`（脚本已激活）

3. 测试功能：
   - 按 `Ctrl+Shift+V` 打开可视化界面
   - 或在聊天框输入 `/biovis`
   - 点击"提取数据"按钮

## 常见问题

### Q: 脚本没有运行？

**A: 检查以下几点：**
1. Tampermonkey 扩展是否已启用
2. 脚本在 Tampermonkey 中是否已启用
3. 网站 URL 是否匹配（必须是 bondageprojects 域名）
4. 刷新页面重试

### Q: 浮动按钮没有出现？

**A: 可能的原因：**
1. 脚本加载失败 - 检查浏览器控制台错误
2. 样式冲突 - 脚本使用 Shadow DOM 应该不会冲突
3. 页面未完全加载 - 等待页面完全加载后再试

### Q: 数据提取失败？

**A: 检查：**
1. 是否已登录 BC 网站
2. IndexedDB 是否有数据
3. 浏览器是否禁用了 IndexedDB
4. 查看控制台错误信息

### Q: 如何更新脚本？

**A: 更新方法：**

**方式一（使用 Loader）：**
- Loader 会自动检查更新
- 每24小时自动下载最新版本
- 无需手动操作

**方式二（手动更新）：**
1. 下载最新的 `bc-bio-visualizer.user.js`
2. Tampermonkey 会提示有新版本
3. 点击"更新"按钮
4. 刷新页面生效

### Q: 如何卸载脚本？

**A: 卸载步骤：**
1. 点击 Tampermonkey 图标
2. 选择"管理面板"
3. 找到 BC-Bio-Visualizer
4. 点击垃圾桶图标删除
5. 确认删除

## 数据迁移

### 从 HTML 版本迁移

如果您之前使用 `bc-graph-viewer.html`：

1. **导出旧数据**
   - 打开旧版 HTML 文件
   - 点击"导出分组"
   - 保存 JSON 文件

2. **导入到新版本**
   - 安装 Tampermonkey 版本
   - 打开可视化界面
   - 点击"导入分组"
   - 选择之前保存的 JSON 文件

3. **验证数据**
   - 检查分组是否正确导入
   - 检查固定节点是否保留
   - 检查节点着色是否正确

## 权限说明

脚本需要以下权限：

- `GM_setValue` / `GM_getValue`: 保存和读取设置数据
- `GM_deleteValue`: 删除过期数据
- `GM_listValues`: 列出所有保存的数据
- `GM_xmlhttpRequest`: （仅 Loader）下载最新版本

**注**：这些都是 Tampermonkey 的标准 API，脚本不会访问其他网站或上传数据。

## 隐私和安全

1. **数据存储**：所有数据仅存储在本地浏览器中
2. **不上传数据**：脚本不会向任何服务器发送数据
3. **开源代码**：所有代码公开可审查
4. **无跟踪**：不包含任何跟踪或分析代码

## 技术支持

如遇问题，请：

1. 查看[常见问题](#常见问题)
2. 查看浏览器控制台错误信息
3. 在 GitHub 上提交 Issue：[问题反馈](https://github.com/VivianMoonlight/BC-Bio-Visualizer/issues)

## 下一步

安装完成后，请查看：
- [使用指南](./QUICKREF.md) - 快速上手
- [发布说明](./RELEASE_NOTES.md) - 新版本特性
- [架构文档](./ARCHITECTURE.md) - 技术细节

---

**祝您使用愉快！**
