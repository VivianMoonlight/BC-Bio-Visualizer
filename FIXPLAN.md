# BC-Bio-Visualizer UI 修复方案

**日期**: 2026-02-13  
**问题**: Shadow DOM 中 UI 布局完全崩溃，三栏布局失效

---

## 问题分析

### 截图显示的问题
1. ❌ **布局完全崩溃** — 左侧面板、图形区域和右侧详情面板没有按三栏布局显示，所有内容垂直堆叠
2. ❌ **图形区域显示为灰色横条** — `#graph` 区域没有正确渲染，只显示为一个扁平的深色条
3. ❌ **右侧详情面板不可见** — 完全消失或被压缩
4. ❌ **CSS变量不生效** — 导致依赖变量的所有样式失效

---

## 根本原因

### ⚠️ 核心问题：CSS变量作用域错误

**当前代码** (`bc-bio-visualizer.user.js` 第486-497行)：
```css
:root {
  --bg: #0f1115;
  --panel: #171a21;
  --panel-2: #1f2430;
  --text: #e7eaf0;
  --muted: #9aa3b2;
  --accent: #6ac9ff;
  --accent-2: #ffb86b;
  --line: #2b3240;
  --left-w: 260px;
  --right-w: 320px;
}
```

**问题**：在 **Shadow DOM** 中，`:root` 选择器匹配的是外部文档的 `<html>` 元素，**不会匹配 Shadow DOM 内部的任何元素**。因此：

- ✗ 所有 CSS 变量未定义（`--left-w`, `--right-w`, `--bg`, `--text` 等）
- ✗ `grid-template-columns: var(--left-w) 8px 1fr 8px var(--right-w)` 变成无效值
- ✗ **三栏布局彻底崩溃**
- ✗ 颜色、间距等所有依赖变量的样式全部失效

**HTML参考文件** (`bc-graph-viewer.html`) 中也用 `:root`，但它不在 Shadow DOM 中，所以能正常工作。

---

## 其他问题

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 2 | `.visualizer-container` 缺少 `overflow: hidden` | 第501-509行 | 可能导致内容溢出 |
| 3 | 多个CSS类完全缺失 | `getStyles()` 函数 | 部分UI组件样式缺失 |
| 4 | `.select-item` 布局不一致 | 第801-850行 | HTML用 `grid`，userscript用 `flex` |
| 5 | `.item-actions` 缺少 hover 显隐动画 | 第857-892行 | 交互反馈不佳 |
| 6 | `.create-new-btn` 样式不完整 | 第894-908行 | 缺少 `::before` 伪元素和部分样式 |

### 缺失的CSS类（从 HTML 对比）
- `.group-row` — 分组行样式
- `.group-members` — 分组成员列表
- `.circle-filter-list` / `.circle-filter-item` — 圈子筛选列表
- `.circle-select-wrap` / `.circle-select-list` / `.circle-select-item` — 圈子选择器
- `.group-select-wrap` / `.group-select-list` / `.group-select-item` — 分组选择器
- `.tree-indent` / `.tree-node-dot` / `.tree-branch` — 树形结构
- `.drag-handle` — 拖拽手柄
- `.tree-root-drop` — 树根拖放区

---

## 修复方案

### ✅ Fix 1: CSS变量作用域修复（核心修复）
**修改**: 将 `:root` 改为 `:host`

```css
/* 修改前 */
:root {
  --bg: #0f1115;
  --left-w: 260px;
  --right-w: 320px;
}

/* 修改后 */
:host {
  --bg: #0f1115;
  --left-w: 260px;
  --right-w: 320px;
}
```

**说明**: `:host` 选择器在 Shadow DOM 中匹配宿主元素（即 Shadow Root 的容器），CSS 变量会正确继承到内部所有元素。

---

### ✅ Fix 2: 容器样式完善
**修改**: 给 `.visualizer-container` 添加 `overflow: hidden`

```css
.visualizer-container {
  width: 100vw;
  height: 100vh;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  background: radial-gradient(1200px 800px at 10% -10%, #1b2333, #0f1115);
  color: var(--text);
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden; /* 新增 */
}
```

---

### ✅ Fix 3: 补全缺失的CSS样式
从 `bc-graph-viewer.html` 迁移所有缺失的样式类：

```css
/* 分组行样式 */
.group-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

/* 分组成员列表 */
.group-members {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 12px;
  color: var(--muted);
  max-height: 140px;
  overflow: auto;
  background: var(--panel-2);
}

/* 圈子筛选列表 */
.circle-filter-list {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 6px 8px;
  background: var(--panel-2);
  max-height: 180px;
  overflow: auto;
}

.circle-filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 6px;
}

.circle-filter-item:last-child {
  margin-bottom: 0;
}

.circle-filter-item .filter-indent {
  display: inline-block;
}

.circle-filter-item .filter-dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #2d3a52;
  margin-right: 6px;
}

.tree-branch {
  display: inline-block;
  font-family: "Consolas", "Courier New", monospace;
  color: #5f7aa3;
  margin-right: 4px;
  white-space: pre;
}

/* 圈子选择器包装 */
.circle-select-wrap {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 8px;
  background: rgba(31, 36, 48, 0.6);
}

.circle-select-search {
  width: 100%;
  margin-bottom: 8px;
}

.circle-select-list {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 6px 8px;
  background: var(--panel-2);
  max-height: 200px;
  overflow: auto;
}

.circle-select-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
  padding: 4px 6px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
}

.circle-select-item:last-child {
  margin-bottom: 0;
}

.circle-select-item.is-focused {
  background: rgba(106, 201, 255, 0.12);
  color: #cfe7ff;
  box-shadow: inset 0 0 0 1px rgba(106, 201, 255, 0.4);
}

/* 分组选择器包装 */
.group-select-wrap {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 8px;
  background: rgba(31, 36, 48, 0.6);
}

.group-select-search {
  width: 100%;
  margin-bottom: 8px;
}

.group-select-list {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 6px 8px;
  background: var(--panel-2);
  max-height: 200px;
  overflow: auto;
}

.group-select-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
  padding: 4px 6px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
}

.group-select-item:last-child {
  margin-bottom: 0;
}

.group-select-item.is-focused {
  background: rgba(255, 184, 107, 0.12);
  color: #ffe7cf;
  box-shadow: inset 0 0 0 1px rgba(255, 184, 107, 0.4);
}

/* 树形结构 */
.tree-indent {
  display: inline-block;
}

.tree-node-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2d3a52;
  margin: 0 6px 1px 0;
}

.drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-right: 6px;
  color: var(--muted);
  cursor: grab;
  user-select: none;
}

.drag-handle:active {
  cursor: grabbing;
}

.tree-root-drop {
  border: 1px dashed var(--line);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 11px;
  color: var(--muted);
  text-align: center;
  margin: 4px 0 8px;
  transition: all 0.15s;
}

.tree-root-drop.is-drop-target {
  border-color: var(--accent);
  color: var(--text);
  background: rgba(106, 201, 255, 0.08);
}
```

---

### ✅ Fix 4: 修正 `.select-item` 布局
**修改**: 从 `display: flex` 改为 `display: grid`（与 HTML 保持一致）

```css
/* 修改前 */
.select-item {
  display: flex;
  align-items: center;
  gap: 8px;
  ...
}

/* 修改后 */
.select-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background 0.15s;
}

.select-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.select-item.is-editing {
  background: rgba(106, 201, 255, 0.08);
}

.select-item.is-focused {
  background: rgba(255, 255, 255, 0.04);
  box-shadow: inset 0 0 0 1px rgba(106, 201, 255, 0.25);
}

.select-item.is-implied .item-label {
  color: var(--muted);
}

.select-item.is-drop-target {
  outline: 1px dashed var(--accent);
  background: rgba(106, 201, 255, 0.08);
}

.select-item.is-creating {
  background: rgba(106, 201, 255, 0.08);
  border: 1px dashed var(--accent);
  margin-top: 8px;
}

.select-item input[type="checkbox"],
.select-item input[type="radio"] {
  margin: 0;
  cursor: pointer;
}

.select-item input[type="checkbox"]:disabled,
.select-item input[type="radio"]:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
```

---

### ✅ Fix 5: 补充 `.item-actions` hover 动画
**修改**: 添加 opacity 动画效果

```css
.item-actions {
  display: flex;
  gap: 4px;
  opacity: 0;  /* 新增：默认隐藏 */
  transition: opacity 0.2s;  /* 新增：过渡动画 */
}

/* 新增：hover 时显示 */
.select-item:hover .item-actions {
  opacity: 1;
}

/* 新增：编辑/创建状态时显示 */
.select-item.is-editing .item-actions,
.select-item.is-creating .item-actions {
  opacity: 1;
}
```

---

### ✅ Fix 6: 补充 `.create-new-btn` 完整样式
**修改**: 添加完整样式和伪元素

```css
.create-new-btn {
  width: 100%;  /* 新增 */
  text-align: left;  /* 新增 */
  color: var(--muted);  /* 修改 */
  padding: 8px;
  border-radius: 6px;
  font-size: 12px;
  margin-top: 4px;  /* 新增 */
  display: flex;
  align-items: center;
  gap: 6px;  /* 新增 */
  transition: all 0.15s;
  background: var(--panel);  /* 保留 */
  border: 1px dashed var(--line);  /* 保留 */
  cursor: pointer;  /* 保留 */
}

.create-new-btn:hover {
  background: rgba(255, 255, 255, 0.05);  /* 修改 */
  color: var(--text);  /* 新增 */
  border-color: var(--accent);
}

/* 新增：+ 号伪元素 */
.create-new-btn::before {
  content: "+";
  font-size: 16px;
  font-weight: bold;
}
```

---

### ✅ Fix 7: 修正 `.icon-btn` 样式
**修改**: 统一尺寸和样式

```css
.icon-btn {
  width: 24px;  /* 新增 */
  height: 24px;  /* 新增 */
  min-width: 24px;  /* 新增 */
  padding: 0;  /* 修改：从 2px 6px 改为 0 */
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  background: transparent;
  border: 1px solid transparent;  /* 新增 */
  color: var(--muted);  /* 修改 */
  transition: all 0.15s;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);  /* 修改 */
  color: var(--text);  /* 新增 */
  border-color: var(--line);  /* 修改 */
}

.icon-btn.save {
  color: #6ac9ff;  /* 修改：从 #4ade80 改为 #6ac9ff */
}

.icon-btn.save:hover {
  background: rgba(106, 201, 255, 0.15);  /* 修改 */
  border-color: #6ac9ff;  /* 新增 */
}

.icon-btn.delete {
  color: #ff6b6b;  /* 修改：从 #f87171 改为 #ff6b6b */
}

.icon-btn.delete:hover {
  background: rgba(255, 107, 107, 0.15);  /* 修改 */
  border-color: #ff6b6b;  /* 新增 */
}
```

---

### ✅ Fix 8: 修正 `.item-label` 和 `.item-input` 样式
**修改**: 完善样式定义

```css
.item-label {
  flex: 1;
  font-size: 12px;
  color: var(--text);
  cursor: pointer;
  user-select: none;  /* 新增 */
}

.item-input {
  flex: 1;
  font-size: 12px;
  padding: 4px 8px;  /* 修改：从 4px 6px 改为 4px 8px */
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--accent);
  border-radius: 4px;
  outline: none;  /* 新增 */
}

.item-input:focus {
  border-color: var(--accent-2);  /* 修改：从 var(--accent) 改为 var(--accent-2) */
}
```

---

## 实施步骤

1. ✅ 创建 `FIXPLAN.md` 文档
2. ⏳ 修改 `bc-bio-visualizer.user.js` 中的 `getStyles()` 函数
   - 第 486 行：`:root` → `:host`
   - 第 501-509 行：`.visualizer-container` 添加 `overflow: hidden`
   - 第 800-980 行：补全所有缺失的CSS样式
3. ⏳ 测试验证
   - 在 Tampermonkey 中重新加载脚本
   - 打开目标网站
   - 验证三栏布局正确显示
   - 验证所有UI组件样式正确

---

## 预期结果

修复后应看到：
- ✅ 三栏布局正确显示（左侧筛选面板 260px + 中央图形区域 + 右侧详情面板 320px）
- ✅ 所有颜色、间距正确应用
- ✅ 图形区域正确渲染
- ✅ 拖拽分隔器可正常调整宽度
- ✅ 所有UI组件样式完整

---

## 实施结果

### ✅ 已完成的修复

| 修复项 | 位置 | 状态 |
|--------|------|------|
| Fix 1: `:root` → `:host` | Line 486 | ✅ 完成 |
| Fix 2: `.visualizer-container` overflow | Line 509 | ✅ 完成 |
| Fix 3: 补全缺失CSS样式 | Lines 705-898 | ✅ 完成 |
| Fix 4: 修正 `.select-item` 布局 | Lines 995-1050 | ✅ 完成 |
| Fix 5: `.item-actions` hover动画 | Lines 1079-1094 | ✅ 完成 |
| Fix 6: `.create-new-btn` 完整样式 | Lines 1137-1164 | ✅ 完成 |
| Fix 7: 修正 `.icon-btn` 样式 | Lines 1096-1135 | ✅ 完成 |
| Fix 8: `.item-label/input` 样式 | Lines 1052-1077 | ✅ 完成 |

### 修复详情

**核心修复 (Fix 1)**:
- 将CSS变量定义从 `:root` 改为 `:host`
- 这使得所有CSS变量在Shadow DOM中正确生效
- 三栏布局 `grid-template-columns: var(--left-w) 8px 1fr 8px var(--right-w)` 现在可以正确工作

**补全样式 (Fix 3)**:
新增以下CSS类：
- `.group-row` / `.group-members` — 分组行和成员列表
- `.circle-filter-list` / `.circle-filter-item` — 圈子筛选列表
- `.circle-select-wrap/list/item` — 圈子选择器完整样式
- `.group-select-wrap/list/item` — 分组选择器完整样式
- `.tree-indent` / `.tree-node-dot` / `.tree-branch` — 树形结构
- `.drag-handle` — 拖拽手柄
- `.tree-root-drop` — 树根拖放区

**布局修正 (Fix 4)**:
- `.select-item` 从 `display: flex` 改为 `display: grid`
- 使用 `grid-template-columns: auto 1fr auto` 布局
- 补充所有状态类样式 (`.is-focused`, `.is-editing`, `.is-creating`, `.is-drop-target`)

**交互优化 (Fix 5)**:
- `.item-actions` 默认 `opacity: 0` 隐藏
- hover时 `opacity: 1` 显示
- 编辑/创建状态时也显示

**按钮样式 (Fix 6)**:
- `.create-new-btn` 补充完整属性
- 添加 `::before` 伪元素显示 "+" 号

**图标按钮 (Fix 7)**:
- 统一尺寸为 `24x24px`
- 改进 hover 状态
- 调整保存/删除按钮颜色

---

**状态**: ✅ 已完成  
**完成时间**: 2026-02-13 10:20  
**修改文件**: `bc-bio-visualizer.user.js`  
**测试**: 待用户在Tampermonkey中验证
