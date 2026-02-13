# BC-Bio-Visualizer Tampermonkey 脚本迁移方案

## 一、项目概述

### 1.1 当前架构分析

**现有组件**：
- **console-profiles.js** (161行) - 浏览器控制台脚本，从IndexedDB提取WCE角色数据
- **bc-graph-viewer.html** (3039行) - 独立HTML单页应用，提供交互式关系图可视化
- **依赖库**：
  - LZString 1.4.4 (数据解压)
  - vis-network 9.x (图形渲染)
- **数据存储**：LocalStorage (标注数据)、JSON文件 (导入导出)

**核心功能**：
1. 从 `bce-past-profiles` IndexedDB 提取角色资料
2. 解码压缩的描述文本 (LZString)
3. 可视化角色关系网络 (ownership/lovership)
4. 支持分组、圈子标注和管理
5. 凸包算法绘制圈子轮廓
6. 交互式搜索、筛选、布局调整

### 1.2 迁移目标

将独立的双组件系统转换为**单一Tampermonkey用户脚本**，实现：
- ✅ 在目标网站上一键启动可视化界面
- ✅ 集成数据提取和可视化功能
- ✅ 无需手动下载JSON文件
- ✅ 保持完整功能和用户体验
- ✅ 样式隔离，不干扰目标页面

---

## 二、技术方案

### 2.1 核心架构设计

```
┌─────────────────────────────────────────────────────────┐
│              Tampermonkey 脚本运行环境                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────┐         ┌────────────────────┐     │
│  │  浮动触发按钮    │         │   Shadow DOM 容器   │     │
│  │  (始终可见)      │────────>│   (样式隔离)        │     │
│  └─────────────────┘         └────────────────────┘     │
│                                        │                 │
│                                        ▼                 │
│  ┌──────────────────────────────────────────────┐       │
│  │           可视化界面 (原 HTML)                │       │
│  │  • 左侧筛选面板                               │       │
│  │  • 中央图形区域 (vis-network)                 │       │
│  │  • 右侧详情面板                               │       │
│  └──────────────────────────────────────────────┘       │
│                      │                                   │
│                      ▼                                   │
│  ┌──────────────────────────────────────────────┐       │
│  │        数据提取模块 (原 console-profiles.js)  │       │
│  │  • IndexedDB 读取                             │       │
│  │  • LZString 解码                              │       │
│  │  • 数据简化处理                               │       │
│  └──────────────────────────────────────────────┘       │
│                      │                                   │
│                      ▼                                   │
│  ┌──────────────────────────────────────────────┐       │
│  │        数据持久化 (GM API)                    │       │
│  │  • GM_setValue (替代 localStorage)            │       │
│  │  • GM_getValue                                │       │
│  └──────────────────────────────────────────────┘       │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Shadow DOM 隔离方案

**为什么需要 Shadow DOM**：
- 防止目标网站CSS污染脚本界面
- 防止脚本CSS影响目标网站
- 提供完全独立的DOM树

**实现方式**：
```javascript
// 创建根容器
const rootContainer = document.createElement('div');
rootContainer.id = 'bc-bio-visualizer-root';
rootContainer.style.cssText = 'position: fixed; z-index: 999999;';
document.body.appendChild(rootContainer);

// 附加 Shadow DOM
const shadowRoot = rootContainer.attachShadow({ mode: 'open' });

// 注入完整样式
const styleEl = document.createElement('style');
styleEl.textContent = `
  /* 原 bc-graph-viewer.html 的所有 CSS */
  :root { --bg: #0f1115; ... }
  * { box-sizing: border-box; }
  ...
`;
shadowRoot.appendChild(styleEl);

// 注入界面结构
const appContainer = document.createElement('div');
appContainer.innerHTML = `/* 原 HTML 结构 */`;
shadowRoot.appendChild(appContainer);
```

### 2.3 依赖库加载策略

**方案A：@require 预加载 (推荐)**
```javascript
// ==UserScript==
// @require https://unpkg.com/vis-network@9/standalone/umd/vis-network.min.js
// @require https://cdn.jsdelivr.net/npm/lz-string@1.4.4/libs/lz-string.min.js
// ==/UserScript==
```
- ✅ 优点：Tampermonkey自动缓存，加载速度快
- ✅ 优点：脚本启动时即可用
- ⚠️ 注意：需要确保CDN稳定

**方案B：动态加载 (备用)**
```javascript
async function loadLibrary(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
```

### 2.4 数据存储迁移

| 原实现 | Tampermonkey实现 | 优势 |
|-------|-----------------|------|
| `localStorage.setItem()` | `GM_setValue()` | 跨域存储，不受同源策略限制 |
| `localStorage.getItem()` | `GM_getValue()` | 更大存储空间 |
| `localStorage.removeItem()` | `GM_deleteValue()` | 更可靠 |

**迁移示例**：
```javascript
// 原代码
const markData = JSON.parse(localStorage.getItem('bc-graph-viewer-marks') || '{}');
localStorage.setItem('bc-graph-viewer-marks', JSON.stringify(markData));

// 迁移后
const markData = JSON.parse(await GM_getValue('bc-graph-viewer-marks', '{}'));
await GM_setValue('bc-graph-viewer-marks', JSON.stringify(markData));
```

---

## 三、实施计划

### 阶段 1：基础架构搭建 (核心框架)

**任务清单**：
- [ ] 1.1 创建 `bc-bio-visualizer.user.js` 文件
- [ ] 1.2 编写 Tampermonkey 元数据头部
  - 定义 `@match` 匹配目标网站
  - 声明 `@grant` 权限 (GM_setValue, GM_getValue, etc.)
  - 添加 `@require` 依赖库
- [ ] 1.3 实现 Shadow DOM 容器创建函数
- [ ] 1.4 设计浮动触发按钮UI
- [ ] 1.5 实现界面显示/隐藏切换逻辑

**技术要点**：
```javascript
// ==UserScript==
// @name         BC-Bio-Visualizer
// @namespace    https://github.com/your-repo
// @version      2.0.0
// @description  WCE生物数据库可视化工具 (Tampermonkey集成版)
// @author       Your Name
// @match        https://www.bondageprojects.com/*
// @match        https://bondageprojects.elementfx.com/*
// @icon         data:image/svg+xml,...
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @require      https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js
// @require      https://cdn.jsdelivr.net/npm/lz-string@1.4.4/libs/lz-string.min.js
// @run-at       document-idle
// @noframes
// ==/UserScript==
```

**交付成果**：
- ✅ 可在目标网站上显示触发按钮
- ✅ 点击按钮弹出空白容器（验证Shadow DOM工作）

---

### 阶段 2：数据提取模块迁移

**任务清单**：
- [ ] 2.1 将 `console-profiles.js` 封装为模块函数
- [ ] 2.2 实现 `extractDataFromIndexedDB()` 函数
- [ ] 2.3 添加数据提取进度UI
- [ ] 2.4 实现错误处理和重试逻辑
- [ ] 2.5 缓存提取的数据（避免重复提取）

**核心函数设计**：
```javascript
/**
 * 从 IndexedDB 提取角色数据
 * @returns {Promise<Array>} 简化后的角色数据数组
 */
async function extractDataFromIndexedDB() {
  const dbName = 'bce-past-profiles';
  const storeName = 'profiles';
  
  // 显示进度提示
  showProgress('正在读取 IndexedDB...');
  
  // 读取原始数据
  const raw = await readAllFromStore(dbName, storeName);
  showProgress(`已读取 ${raw.length} 条记录，正在解码...`);
  
  // 解码和简化
  const simplified = raw.map((row, index) => {
    if (index % 100 === 0) {
      showProgress(`解码中... ${index}/${raw.length}`);
    }
    
    let bundle = null;
    try {
      bundle = JSON.parse(row.characterBundle || '{}');
    } catch {
      bundle = null;
    }
    
    return {
      ...pickBasicInfo(row, bundle),
      ownership: bundle?.Ownership ?? null,
      lovership: bundle?.Lovership ?? null,
      descriptionDecoded: decodeDescription(bundle?.Description ?? ''),
      descriptionRaw: bundle?.Description ?? ''
    };
  });
  
  showProgress('完成！');
  return simplified;
}
```

**数据缓存策略**：
```javascript
// 缓存提取的数据，避免每次都读IndexedDB
let cachedData = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟

async function getData(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedData && (now - cacheTimestamp < CACHE_DURATION)) {
    return cachedData;
  }
  
  cachedData = await extractDataFromIndexedDB();
  cacheTimestamp = now;
  return cachedData;
}
```

**交付成果**：
- ✅ 可从IndexedDB成功提取数据
- ✅ 显示提取进度和状态
- ✅ 数据格式与原 JSON 文件一致

---

### 阶段 3：可视化界面迁移

**任务清单**：
- [ ] 3.1 提取 bc-graph-viewer.html 的 HTML 结构
- [ ] 3.2 转换为 JavaScript 字符串模板或 createElement
- [ ] 3.3 提取所有 CSS 样式
- [ ] 3.4 注入到 Shadow DOM
- [ ] 3.5 验证界面显示正常

**HTML 转换方案**：

**方案A：模板字符串 (推荐，适合大块HTML)**
```javascript
function createVisualizerUI() {
  const template = `
    <div class="visualizer-container">
      <header>
        <h1>BC 资料图查看器</h1>
        <div class="toolbar">
          <button id="extractBtn" class="button button-accent">提取数据</button>
          <button id="refreshBtn" class="button">刷新图形</button>
          <!-- 更多按钮 -->
        </div>
      </header>
      <main>
        <div class="panel left-panel">
          <!-- 左侧面板内容 -->
        </div>
        <div class="splitter splitter-left"></div>
        <div class="graph-container">
          <div id="network"></div>
        </div>
        <div class="splitter splitter-right"></div>
        <div class="panel right-panel">
          <!-- 右侧面板内容 -->
        </div>
      </main>
    </div>
  `;
  
  shadowRoot.innerHTML = '';
  shadowRoot.appendChild(styleEl); // 样式
  const container = document.createElement('div');
  container.innerHTML = template;
  shadowRoot.appendChild(container);
}
```

**方案B：DOM API (适合动态内容)**
```javascript
function createVisualizerUI() {
  const container = document.createElement('div');
  container.className = 'visualizer-container';
  
  const header = document.createElement('header');
  const title = document.createElement('h1');
  title.textContent = 'BC 资料图查看器';
  header.appendChild(title);
  
  // ... 继续构建DOM树
  
  shadowRoot.appendChild(container);
}
```

**CSS 处理**：
```javascript
const CSS_STYLES = `
  /* 复制 bc-graph-viewer.html 的所有样式 */
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
  
  * { box-sizing: border-box; }
  
  .visualizer-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: var(--bg);
    z-index: 999999;
  }
  
  /* ... 所有其他样式 */
`;
```

**交付成果**：
- ✅ 界面在Shadow DOM中正确显示
- ✅ 样式完全隔离，无冲突
- ✅ 布局和原HTML一致

---

### 阶段 4：核心功能迁移

**任务清单**：
- [ ] 4.1 迁移 `computeGraph()` 图形计算函数
- [ ] 4.2 迁移 vis-network 初始化代码
- [ ] 4.3 迁移事件监听器 (点击、搜索、筛选)
- [ ] 4.4 迁移分组和圈子管理功能
- [ ] 4.5 迁移凸包算法和绘制逻辑
- [ ] 4.6 适配 LocalStorage → GM API

**关键函数迁移对照**：

| 原函数 | 位置 | 迁移优先级 | 依赖 |
|-------|------|----------|------|
| `computeGraph()` | bc-graph-viewer.html:~1500 | 高 | data, markData |
| `applyFilters()` | bc-graph-viewer.html:~1800 | 高 | computeGraph |
| `renderGroupSelect()` | bc-graph-viewer.html:~2200 | 中 | markData |
| `buildCircleForest()` | bc-graph-viewer.html:~2400 | 中 | markData.circles |
| `convexHull()` | bc-graph-viewer.html:~2600 | 中 | 数学算法 |
| `expandPolygon()` | bc-graph-viewer.html:~2700 | 低 | convexHull |
| `decodeDescription()` | console-profiles.js:39 | 高 | LZString |

**事件绑定示例**：
```javascript
function setupEventListeners() {
  // 提取数据按钮
  const extractBtn = shadowRoot.getElementById('extractBtn');
  extractBtn.addEventListener('click', async () => {
    const data = await extractDataFromIndexedDB();
    initializeVisualization(data);
  });
  
  // 搜索框
  const searchInput = shadowRoot.getElementById('searchInput');
  searchInput.addEventListener('input', debounce(() => {
    applyFilters();
  }, 300));
  
  // 物理引擎切换
  const physicsToggle = shadowRoot.getElementById('physicsToggle');
  physicsToggle.addEventListener('click', () => {
    usePhysics = !usePhysics;
    applyFilters();
  });
  
  // ... 更多事件监听器
}
```

**交付成果**：
- ✅ 数据提取后可正确渲染图形
- ✅ 搜索、筛选功能正常
- ✅ 分组、圈子功能完整
- ✅ 所有交互响应正常

---

### 阶段 5：数据持久化适配

**任务清单**：
- [ ] 5.1 替换所有 `localStorage` 调用为 GM API
- [ ] 5.2 实现数据导出功能 (下载JSON)
- [ ] 5.3 实现数据导入功能 (文件选择)
- [ ] 5.4 添加数据同步/备份提示
- [ ] 5.5 处理存储配额和错误

**存储封装**：
```javascript
// 统一存储接口
const Storage = {
  async get(key, defaultValue = null) {
    try {
      const value = await GM_getValue(key);
      return value !== undefined ? value : defaultValue;
    } catch (error) {
      console.error('Storage get error:', error);
      return defaultValue;
    }
  },
  
  async set(key, value) {
    try {
      await GM_setValue(key, value);
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  },
  
  async remove(key) {
    try {
      await GM_deleteValue(key);
      return true;
    } catch (error) {
      console.error('Storage remove error:', error);
      return false;
    }
  },
  
  async listKeys() {
    try {
      return await GM_listValues();
    } catch (error) {
      console.error('Storage listKeys error:', error);
      return [];
    }
  }
};

// 标注数据管理
const MarkDataManager = {
  STORAGE_KEY: 'bc-graph-viewer-marks',
  
  async load() {
    const json = await Storage.get(this.STORAGE_KEY, '{}');
    try {
      return JSON.parse(json);
    } catch {
      return { groups: {}, circles: {}, nodeToGroup: {}, nodeToCircles: {} };
    }
  },
  
  async save(markData) {
    const json = JSON.stringify(markData);
    return await Storage.set(this.STORAGE_KEY, json);
  },
  
  async export() {
    const markData = await this.load();
    const blob = new Blob([JSON.stringify(markData, null, 2)], 
                          { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marks-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
  
  async import(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          const current = await this.load();
          
          // 合并数据
          const merged = {
            groups: { ...current.groups, ...imported.groups },
            circles: { ...current.circles, ...imported.circles },
            nodeToGroup: { ...current.nodeToGroup, ...imported.nodeToGroup },
            nodeToCircles: { ...current.nodeToCircles, ...imported.nodeToCircles }
          };
          
          await this.save(merged);
          resolve(merged);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
};
```

**交付成果**：
- ✅ 标注数据可持久化保存
- ✅ 支持导出为JSON文件
- ✅ 支持导入JSON文件
- ✅ 数据在页面刷新后保留

---

### 阶段 6：用户体验优化

**任务清单**：
- [ ] 6.1 添加加载动画和进度提示
- [ ] 6.2 实现快捷键支持 (Ctrl+Shift+V 唤起)
- [ ] 6.3 优化首次加载性能
- [ ] 6.4 添加错误提示和帮助文档
- [ ] 6.5 实现界面尺寸记忆
- [ ] 6.6 添加主题切换 (可选)

**加载动画**：
```javascript
function showLoadingOverlay(message = '加载中...') {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-message">${message}</div>
  `;
  shadowRoot.appendChild(overlay);
  return overlay;
}

function hideLoadingOverlay(overlay) {
  overlay?.remove();
}
```

**快捷键**：
```javascript
document.addEventListener('keydown', (e) => {
  // Ctrl+Shift+V 或 Cmd+Shift+V
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
    e.preventDefault();
    toggleVisualizer();
  }
  
  // ESC 关闭界面
  if (e.key === 'Escape' && isVisualizerVisible) {
    hideVisualizer();
  }
});
```

**性能优化**：
```javascript
// 懒加载：首次打开时才初始化vis-network
let networkInitialized = false;

function initializeNetwork() {
  if (networkInitialized) return;
  
  const container = shadowRoot.getElementById('network');
  network = new vis.Network(container, {}, options);
  
  // 设置事件监听器
  network.on('selectNode', handleNodeSelect);
  network.on('doubleClick', handleDoubleClick);
  // ...
  
  networkInitialized = true;
}

// 打开界面时才初始化
function showVisualizer() {
  rootContainer.style.display = 'block';
  initializeNetwork();
  // ...
}
```

**交付成果**：
- ✅ 用户体验流畅
- ✅ 加载过程有视觉反馈
- ✅ 支持常用快捷键
- ✅ 性能优化，响应快速

---

### 阶段 7：测试与质量保障

**任务清单**：
- [ ] 7.1 功能完整性测试
  - [ ] 数据提取准确性
  - [ ] 图形渲染正确性
  - [ ] 搜索筛选功能
  - [ ] 分组圈子管理
  - [ ] 数据导入导出
- [ ] 7.2 兼容性测试
  - [ ] Chrome + Tampermonkey
  - [ ] Firefox + Greasemonkey/Tampermonkey
  - [ ] Edge + Tampermonkey
  - [ ] Safari (Userscripts 扩展)
- [ ] 7.3 性能测试
  - [ ] 大数据集 (1000+ 节点)
  - [ ] 内存占用监控
  - [ ] 渲染帧率测试
- [ ] 7.4 边界情况测试
  - [ ] IndexedDB 不存在
  - [ ] 数据格式异常
  - [ ] 网络库加载失败
- [ ] 7.5 用户接受测试 (Beta)

**测试检查清单**：

| 测试项 | 预期结果 | 状态 |
|-------|---------|------|
| 脚本安装 | 无错误提示 | ⬜ |
| 触发按钮显示 | 右下角显示浮动按钮 | ⬜ |
| 数据提取 | 成功读取IndexedDB | ⬜ |
| 图形渲染 | 节点和边正确显示 | ⬜ |
| 节点搜索 | 搜索结果正确高亮 | ⬜ |
| 分组创建 | 可创建并分配分组 | ⬜ |
| 圈子管理 | 凸包轮廓正确绘制 | ⬜ |
| 数据导出 | JSON文件下载成功 | ⬜ |
| 数据导入 | 标注数据正确恢复 | ⬜ |
| 快捷键 | Ctrl+Shift+V 唤起 | ⬜ |
| 样式隔离 | 无样式冲突 | ⬜ |
| 内存占用 | < 200MB (1000节点) | ⬜ |

**交付成果**：
- ✅ 所有功能测试通过
- ✅ 无严重bug
- ✅ 兼容主流浏览器
- ✅ 性能达标

---

### 阶段 8：文档编写与发布

**任务清单**：
- [ ] 8.1 编写用户安装指南
- [ ] 8.2 编写使用教程 (图文/视频)
- [ ] 8.3 更新 README.md
- [ ] 8.4 添加 CHANGELOG.md
- [ ] 8.5 创建 GitHub Release
- [ ] 8.6 发布到 Greasy Fork (可选)
- [ ] 8.7 发布到 OpenUserJS (可选)

**README.md 结构**：
```markdown
# BC-Bio-Visualizer (Tampermonkey Edition)

## 🎯 简介
WCE (Bondage Club Extended) 生物数据库可视化工具 - Tampermonkey集成版

## ✨ 特性
- 🚀 一键启动，无需下载文件
- 📊 交互式关系图可视化
- 🏷️ 分组和圈子管理
- 💾 数据持久化保存
- 🎨 精美的暗色主题

## 📦 安装

### 1. 安装 Tampermonkey
- Chrome: [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/)
- Firefox: [Tampermonkey](https://addons.mozilla.org/firefox/addon/tampermonkey/)

### 2. 安装脚本
点击安装链接：[BC-Bio-Visualizer.user.js](link)

### 3. 使用
1. 访问目标网站
2. 点击右下角 📊 按钮
3. 点击"提取数据"开始可视化

## 📖 使用教程
[详细教程](TUTORIAL.md)

## 🔧 开发
[贡献指南](CONTRIBUTING.md)

## 📝 许可证
MIT License
```

**CHANGELOG.md**：
```markdown
# Changelog

## [2.0.0] - 2026-02-13

### Added
- Tampermonkey 脚本版本
- 一键数据提取和可视化
- Shadow DOM 样式隔离
- GM API 数据持久化
- 浮动触发按钮
- 快捷键支持 (Ctrl+Shift+V)

### Changed
- 从双组件架构迁移到单一脚本
- LocalStorage 替换为 GM API

### Deprecated
- 独立 HTML 版本 (仍可用，见 v1.x 分支)

### Removed
- 手动下载 JSON 文件步骤

## [1.0.0] - 2024-XX-XX
- 初始版本 (HTML + Console脚本)
```

**Greasy Fork 发布信息**：
```
名称: BC-Bio-Visualizer
描述: WCE生物数据库可视化工具 - 交互式关系图、分组管理、数据标注
类别: Social Networking, Utilities
许可证: MIT
兼容性: Chrome, Firefox, Edge, Safari
语言: 中文, English
```

**交付成果**：
- ✅ 完整的用户文档
- ✅ 清晰的安装指南
- ✅ 发布到脚本社区
- ✅ 持续维护计划

---

## 四、技术细节与最佳实践

### 4.1 Shadow DOM 最佳实践

**样式作用域**：
```css
/* 在 Shadow DOM 内部，:host 选择器指向影子根 */
:host {
  all: initial; /* 重置所有样式 */
  display: block;
}

/* 避免使用全局选择器 */
:host * {
  font-family: "Segoe UI", sans-serif;
}
```

**事件传播**：
```javascript
// Shadow DOM 内的事件会重新定向
shadowRoot.addEventListener('click', (e) => {
  // e.target 是 Shadow DOM 内部元素
  console.log(e.target); // 内部元素
  console.log(e.composedPath()); // 完整路径
});
```

**访问外部元素**：
```javascript
// 从 Shadow DOM 访问外部
const mainDocument = shadowRoot.host.ownerDocument;

// 从外部访问 Shadow DOM
const shadowContent = rootContainer.shadowRoot.getElementById('network');
```

### 4.2 性能优化策略

**1. 虚拟滚动 (大列表)**：
```javascript
// 仅渲染可见区域的列表项
class VirtualList {
  constructor(container, items, itemHeight) {
    this.container = container;
    this.items = items;
    this.itemHeight = itemHeight;
    this.render();
  }
  
  render() {
    const scrollTop = this.container.scrollTop;
    const visibleStart = Math.floor(scrollTop / this.itemHeight);
    const visibleEnd = Math.ceil((scrollTop + this.container.clientHeight) / this.itemHeight);
    
    // 仅渲染可见项 + 缓冲区
    const fragment = document.createDocumentFragment();
    for (let i = visibleStart; i < visibleEnd; i++) {
      if (this.items[i]) {
        const item = this.createItemElement(this.items[i]);
        fragment.appendChild(item);
      }
    }
    this.container.innerHTML = '';
    this.container.appendChild(fragment);
  }
}
```

**2. 防抖和节流**：
```javascript
// 防抖：最后一次调用后延迟执行
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// 节流：固定间隔执行
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 应用到搜索
searchInput.addEventListener('input', debounce(() => {
  applyFilters();
}, 300));
```

**3. Web Worker (重计算)**：
```javascript
// worker.js
self.addEventListener('message', (e) => {
  const { nodes, edges } = e.data;
  
  // 执行复杂计算
  const result = computeGraphLayout(nodes, edges);
  
  self.postMessage(result);
});

// 主线程
const worker = new Worker('worker.js');
worker.postMessage({ nodes, edges });
worker.addEventListener('message', (e) => {
  updateGraph(e.data);
});
```

**4. RequestAnimationFrame (动画)**：
```javascript
function smoothUpdate() {
  let start = null;
  
  function animate(timestamp) {
    if (!start) start = timestamp;
    const progress = timestamp - start;
    
    // 更新动画
    updatePositions(progress);
    
    if (progress < 1000) {
      requestAnimationFrame(animate);
    }
  }
  
  requestAnimationFrame(animate);
}
```

### 4.3 错误处理模式

**全局错误捕获**：
```javascript
// 捕获所有未处理的错误
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
  showErrorToast('发生错误，请刷新页面重试');
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
  showErrorToast('异步操作失败');
});
```

**优雅降级**：
```javascript
async function initializeApp() {
  try {
    // 检查必需功能
    if (!window.indexedDB) {
      throw new Error('浏览器不支持 IndexedDB');
    }
    
    if (!document.body.attachShadow) {
      console.warn('不支持 Shadow DOM，使用降级方案');
      useFallbackUI();
      return;
    }
    
    // 正常初始化
    await loadDependencies();
    createUI();
    
  } catch (error) {
    console.error('Initialization error:', error);
    showFatalError(error.message);
  }
}
```

**用户友好的错误提示**：
```javascript
function showErrorToast(message, duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'error-toast';
  toast.textContent = message;
  shadowRoot.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
```

### 4.4 代码组织结构

```
bc-bio-visualizer.user.js
├── [Tampermonkey Metadata]
├── [Constants & Configuration]
├── [Utility Functions]
│   ├── debounce()
│   ├── throttle()
│   ├── hashOffset()
│   └── ...
├── [Data Extraction Module]
│   ├── extractDataFromIndexedDB()
│   ├── decodeDescription()
│   ├── readAllFromStore()
│   └── ...
├── [Storage Module]
│   ├── Storage.get()
│   ├── Storage.set()
│   ├── MarkDataManager.load()
│   └── MarkDataManager.save()
├── [UI Module]
│   ├── createFloatingButton()
│   ├── createVisualizerUI()
│   ├── showLoadingOverlay()
│   └── ...
├── [Graph Module]
│   ├── computeGraph()
│   ├── applyFilters()
│   ├── convexHull()
│   └── ...
├── [Event Handlers]
│   ├── setupEventListeners()
│   ├── handleNodeSelect()
│   └── ...
└── [Initialization]
    └── main()
```

---

## 五、风险管理与应对策略

### 5.1 技术风险

| 风险 | 影响 | 概率 | 应对策略 |
|-----|------|------|---------|
| CDN 库加载失败 | 高 | 中 | 提供备用CDN，本地fallback |
| Shadow DOM 不兼容 | 高 | 低 | 降级为高z-index容器 |
| IndexedDB 权限被拒 | 高 | 中 | 提示用户检查权限，提供手动导入 |
| vis-network 版本不兼容 | 中 | 低 | 锁定版本号，测试兼容性 |
| 大数据集性能问题 | 中 | 中 | 虚拟滚动、分页加载 |
| GM API 权限不足 | 高 | 低 | 检查 @grant 声明 |

### 5.2 业务风险

| 风险 | 影响 | 概率 | 应对策略 |
|-----|------|------|---------|
| 目标网站结构变化 | 高 | 中 | 松耦合设计，定期测试 |
| IndexedDB 数据格式变化 | 高 | 低 | 版本检测，兼容多格式 |
| 用户数据丢失 | 中 | 低 | 定期提示导出备份 |
| Tampermonkey 政策变化 | 低 | 低 | 关注官方公告 |

### 5.3 应急预案

**CDN 失败备用方案**：
```javascript
async function loadVisNetwork() {
  const cdns = [
    'https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js',
    'https://cdn.jsdelivr.net/npm/vis-network@9.1.9/standalone/umd/vis-network.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/vis-network/9.1.9/standalone/umd/vis-network.min.js'
  ];
  
  for (const cdn of cdns) {
    try {
      await loadScript(cdn);
      if (window.vis) return true;
    } catch (e) {
      console.warn(`Failed to load from ${cdn}`);
    }
  }
  
  throw new Error('无法加载 vis-network 库');
}
```

**降级UI方案**：
```javascript
function useFallbackUI() {
  // 不使用 Shadow DOM，直接挂载到 body
  const container = document.createElement('div');
  container.id = 'bc-bio-visualizer-fallback';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 999999;
    background: #0f1115;
  `;
  
  // 添加样式前缀避免冲突
  const style = document.createElement('style');
  style.textContent = CSS_STYLES.replace(/\./g, '.bcbv-');
  document.head.appendChild(style);
  
  document.body.appendChild(container);
}
```

---

## 六、质量保证清单

### 6.1 代码质量

- [ ] ✅ 所有函数都有 JSDoc 注释
- [ ] ✅ 变量命名清晰有意义
- [ ] ✅ 无全局变量污染 (使用 IIFE 或模块)
- [ ] ✅ 错误处理完整 (try-catch)
- [ ] ✅ 代码格式统一 (使用 Prettier)
- [ ] ✅ 无 console.log 残留 (生产版本)

### 6.2 性能指标

- [ ] ✅ 初始加载 < 2秒
- [ ] ✅ 数据提取 < 5秒 (1000条记录)
- [ ] ✅ 图形渲染 < 1秒 (100节点)
- [ ] ✅ 交互响应 < 100ms
- [ ] ✅ 内存占用 < 200MB
- [ ] ✅ CPU 占用 < 30% (稳定状态)

### 6.3 兼容性

- [ ] ✅ Chrome 90+ (Tampermonkey)
- [ ] ✅ Firefox 88+ (Tampermonkey/Greasemonkey)
- [ ] ✅ Edge 90+ (Tampermonkey)
- [ ] ✅ Safari 14+ (Userscripts)
- [ ] ✅ 移动浏览器 (响应式布局)

### 6.4 用户体验

- [ ] ✅ 界面美观，无样式冲突
- [ ] ✅ 操作流畅，无卡顿
- [ ] ✅ 加载过程有反馈
- [ ] ✅ 错误提示友好
- [ ] ✅ 支持快捷键
- [ ] ✅ 文档完善

---

## 七、总结

### 7.1 预期收益

1. **用户体验提升**
   - ⚡ 一键启动，无需手动下载文件
   - 🎯 集成化操作，流程简化
   - 💾 数据自动持久化

2. **技术优势**
   - 🛡️ Shadow DOM 完美隔离
   - 🚀 性能优化，响应迅速
   - 🔧 易于维护和更新

3. **生态整合**
   - 🌐 融入用户脚本生态
   - 📦 便于分发和安装
   - 🔄 支持自动更新

### 7.2 关键里程碑

| 阶段 | 完成标志 | 验收标准 |
|-----|---------|---------|
| 阶段1 | 触发按钮可见 | 点击弹出容器 |
| 阶段2 | 数据提取成功 | 输出正确JSON |
| 阶段3 | 界面显示正常 | 样式无冲突 |
| 阶段4 | 图形可交互 | 所有功能可用 |
| 阶段5 | 数据可持久化 | 刷新后保留 |
| 阶段6 | 体验优化完成 | 用户反馈良好 |
| 阶段7 | 测试通过 | 所有用例通过 |
| 阶段8 | 文档完整 | 用户可自助 |

### 7.3 后续规划

**短期 (1-2个月)**：
- 修复用户反馈的bug
- 优化性能和体验细节
- 完善文档和教程

**中期 (3-6个月)**：
- 添加高级功能 (统计分析、导出图片)
- 支持主题自定义
- 多语言支持

**长期 (6-12个月)**：
- 数据同步功能 (云端存储)
- 协作模式 (分享标注)
- 插件系统 (第三方扩展)

---

## 附录

### A. 参考文档

- [Tampermonkey 官方文档](https://www.tampermonkey.net/documentation.php)
- [Shadow DOM MDN](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM)
- [vis-network 文档](https://visjs.github.io/vis-network/docs/network/)
- [GM API 参考](https://wiki.greasespot.net/Greasemonkey_Manual:API)

### B. 相关资源

- [Greasy Fork](https://greasyfork.org/) - 用户脚本分享平台
- [OpenUserJS](https://openuserjs.org/) - 备用分享平台
- [Tampermonkey Beta](https://www.tampermonkey.net/beta.php) - 最新版本

### C. 联系方式

- GitHub Issues: [项目地址]/issues
- Email: your-email@example.com
- Discord: [社区链接]

---

**文档版本**: 1.0  
**创建日期**: 2026-02-13  
**最后更新**: 2026-02-13  
**维护者**: BC-Bio-Visualizer Team
