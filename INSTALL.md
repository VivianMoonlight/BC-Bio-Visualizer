# BC-Bio-Visualizer 安装指南

## 前置要求

1. **浏览器**：Chrome、Firefox 或 Edge
2. **扩展**：Tampermonkey

## 安装步骤

### 第一步：安装 Tampermonkey

根据您的浏览器选择对应的安装链接：

#### Chrome / Edge
1. 访问 [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
2. 点击"添加至 Chrome"或"添加至 Edge"
3. 等待安装完成

#### Firefox
1. 访问 [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/tampermonkey/)
2. 点击"添加到 Firefox"
3. 等待安装完成

### 第二步：安装 BC-Bio-Visualizer

#### 方式 A：直接安装脚本（推荐）

1. **下载脚本文件**
   - 访问 GitHub 仓库
   - 下载 `bc-bio-visualizer.user.js`
   - 或点击：[直接安装](https://github.com/your-repo/BC-Bio-Visualizer/raw/main/bc-bio-visualizer.user.js)

2. **安装到 Tampermonkey**
   - 浏览器会自动识别用户脚本
   - 点击 Tampermonkey 的安装确认对话框
   - 点击"安装"按钮

3. **确认安装**
   - Tampermonkey 图标会显示激活的脚本数量
   - 点击图标查看已安装的脚本列表

#### 方式 B：手动安装

1. **打开 Tampermonkey 管理面板**
   - 点击浏览器工具栏的 Tampermonkey 图标
   - 选择"管理面板"

2. **创建新脚本**
   - 点击"+"按钮或"添加新脚本"
   - 删除默认的模板代码

3. **复制脚本代码**
   - 打开 `bc-bio-visualizer.user.js` 文件
   - 全选并复制所有代码
   - 粘贴到 Tampermonkey 编辑器

4. **保存脚本**
   - 点击"文件" -> "保存"
   - 或使用快捷键 `Ctrl+S`

#### 方式 C：使用 Loader（自动更新）

1. **安装 Loader**
   - 下载 `loader.js`
   - 点击：[安装 Loader](https://github.com/your-repo/BC-Bio-Visualizer/raw/main/loader.js)

2. **Loader 的优势**
   - 自动检查更新（每24小时）
   - 自动下载最新版本
   - 支持离线缓存
   - 无需重新安装脚本

## 验证安装

### 1. 检查脚本状态

1. 访问目标网站：
   - https://www.bondageprojects.com/
   - https://bondageprojects.elementfx.com/

2. 检查 Tampermonkey 图标
   - 图标上应显示数字"1"（表示1个脚本已激活）
   - 点击图标查看脚本名称

### 2. 测试功能

1. **查看浮动按钮**
   - 页面右下角应出现蓝色浮动按钮
   - 按钮上有"BC"文字

2. **打开可视化界面**
   - 点击浮动按钮
   - 或使用快捷键 `Ctrl+Shift+V`
   - 应弹出全屏可视化界面

3. **提取数据**
   - 点击"提取数据"按钮
   - 等待数据提取完成
   - 查看关系图是否正确显示

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
3. 在 GitHub 上提交 Issue：[问题反馈](https://github.com/your-repo/BC-Bio-Visualizer/issues)

## 下一步

安装完成后，请查看：
- [使用指南](./QUICKREF.md) - 快速上手
- [发布说明](./RELEASE_NOTES.md) - 新版本特性
- [架构文档](./ARCHITECTURE.md) - 技术细节

---

**祝您使用愉快！**
