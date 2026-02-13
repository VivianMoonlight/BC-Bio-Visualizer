# BC-Bio-Visualizer 架构与功能详解

## 项目概览

**BC-Bio-Visualizer** 是一个为 Kelar 编写的，用于下载和可视化 WCE (Bondage Club Extended) 生物数据库的工具集。该项目包含两个核心组件：
1. **console-profiles.js** - 浏览器控制台脚本，用于从 IndexedDB 提取和导出角色资料数据
2. **bc-graph-viewer.html** - 单页应用（SPA），提供交互式关系图可视化界面

---

## 一、系统架构

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    浏览器环境 (Browser)                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────┐          ┌──────────────────────┐       │
│  │  IndexedDB     │          │  bc-graph-viewer.html │       │
│  │  bce-past-     │◄─────────┤  (可视化应用)         │       │
│  │  profiles      │          │                       │       │
│  └────────────────┘          └──────────────────────┘       │
│         ▲                              │                     │
│         │                              │                     │
│         │                              ▼                     │
│  ┌────────────────┐          ┌──────────────────────┐       │
│  │ console-       │          │  vis-network.js      │       │
│  │ profiles.js    │          │  (图形渲染引擎)       │       │
│  │ (数据提取脚本) │          │                       │       │
│  └────────────────┘          └──────────────────────┘       │
│         │                              │                     │
│         │                              │                     │
│         ▼                              ▼                     │
│  ┌────────────────────────────────────────────────┐         │
│  │           JSON 文件输出/导入                    │         │
│  │  • testprofiles.extracted.json                 │         │
│  │  • marks-export.json (分组数据)                │         │
│  └────────────────────────────────────────────────┘         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 数据流向

```
数据提取阶段：
IndexedDB → console-profiles.js → JSON 文件

数据可视化阶段：
JSON 文件 → bc-graph-viewer.html → vis-network 图形 → 用户交互

标注数据持久化：
用户标注 → localStorage → marks-export.json (导出)
marks-export.json → localStorage → bc-graph-viewer.html (导入)
```

---

## 二、组件详解

### 2.1 console-profiles.js - 数据提取脚本

#### 2.1.1 核心功能

这是一个在浏览器控制台中运行的异步脚本，负责从 IndexedDB 中提取角色资料数据并导出为 JSON。

#### 2.1.2 主要功能模块

##### A. 依赖加载
```javascript
// 动态加载 LZString 压缩库
await new Promise((resolve, reject) => {
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/lz-string@1.4.4/libs/lz-string.min.js';
  s.onload = resolve;
  s.onerror = reject;
  document.head.appendChild(s);
});
```

##### B. 解码功能 (`decodeDescription`)
- **目的**：解码压缩的角色描述文本
- **支持格式**：
  - LZString.decompressFromUTF16
  - LZString.decompressFromBase64
  - LZString.decompressFromEncodedURIComponent
- **智能选择**：使用 `scoreText()` 函数评分，选择最可读的解码结果
- **评分逻辑**：文本长度 - (控制字符数 × 5)

##### C. 字符编码转换 (`byteStringToUtf8`)
```javascript
function byteStringToUtf8(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return utf8Decoder.decode(bytes);
}
```
- 处理字节字符串到 UTF-8 的转换
- 解决编码问题

##### D. IndexedDB 读取 (`readAllFromStore`)
```javascript
function readAllFromStore(dbName, storeName)
```
- 数据库名：`'bce-past-profiles'`
- 存储对象：`'profiles'`
- 返回：所有角色资料的数组

##### E. 数据简化与导出
```javascript
const simplified = raw.map(row => {
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
```

#### 2.1.3 输出数据结构

```json
{
  "memberNumber": 123456,
  "name": "角色名称",
  "lastNick": "最后昵称",
  "seen": "2024-01-01T00:00:00.000Z",
  "title": "头衔",
  "nickname": "昵称",
  "assetFamily": "资产家族",
  "ownership": {
    "Name": "主人名称",
    "MemberNumber": 789012
  },
  "lovership": [
    {
      "Name": "恋人名称", 
      "MemberNumber": 345678
    }
  ],
  "descriptionDecoded": "解码后的描述文本",
  "descriptionRaw": "原始压缩描述"
}
```

---

### 2.2 bc-graph-viewer.html - 可视化单页应用

#### 2.2.1 技术栈

- **前端框架**：纯 JavaScript（无框架）
- **图形库**：vis-network v9.x
- **UI 库**：无（自定义 CSS）
- **数据存储**：
  - LocalStorage（用户标注数据）
  - 内存（图形数据）

#### 2.2.2 界面布局

```
┌─────────────────────────────────────────────────────────┐
│ Header: 标题 + 文件状态 + 工具栏                        │
│ [导入JSON] [导出分组] [导入分组] [物理切换] [适配]     │
├──────────┬────────────────────────────┬─────────────────┤
│          │                            │                 │
│  左侧面板│      中央图形区域          │    右侧面板     │
│  (筛选)  │                            │    (详情)       │
│          │    vis-network canvas       │                 │
│  • 搜索  │                            │  • 节点信息     │
│  • 头衔  │    [节点和边的可视化]      │  • 分组设置     │
│  • 圈子  │                            │  • 圈子设置     │
│  • 关系  │                            │                 │
│  • 列表  │                            │                 │
│          │                            │                 │
└──────────┴────────────────────────────┴─────────────────┘
```

#### 2.2.3 核心数据结构

##### A. 主数据对象 (`data`)
```javascript
{
  nodes: [
    {
      memberNumber: 123456,
      name: "角色名",
      nickname: "昵称",
      title: "头衔",
      ownership: {...},
      lovership: [...],
      description: "..."
    }
  ]
}
```

##### B. 标注数据 (`markData`)
存储在 localStorage 中，键名：`"bc-graph-viewer-marks"`

```javascript
{
  groups: {
    "group-id-1": {
      name: "分组名称",
      color: "#hexcolor"
    }
  },
  circles: {
    "circle-id-1": {
      name: "圈子名称",
      children: ["circle-id-2", "circle-id-3"]  // 子圈子
    }
  },
  nodeToGroup: {
    "123456": "group-id-1"  // 节点ID -> 分组ID
  },
  nodeToCircles: {
    "123456": ["circle-id-1", "circle-id-2"]  // 节点ID -> 圈子ID列表
  }
}
```

#### 2.2.4 主要功能模块

##### A. 文件加载与解析
```javascript
fileInput.addEventListener("change", (e) => {
  // 支持多文件上传
  // 合并多个 JSON 文件
  // 去重处理
  // 构建索引
});
```

##### B. 图形计算与渲染 (`computeGraph`)

**核心逻辑**：
1. **搜索过滤**：根据搜索关键词筛选节点
2. **头衔过滤**：按头衔类型筛选
3. **关系边构建**：
   - Ownership（主仆）：红色虚线，带箭头
   - Lovership（恋爱）：粉色实线，双向
4. **分组处理**：
   - 同组节点添加虚拟连接边（灰色虚线）
   - 同组节点高亮显示
5. **圈子处理**：
   - 树形层级结构
   - 凸包（Convex Hull）轮廓绘制
   - Hub 节点实现聚类效果
6. **孤立节点隐藏**：移除无连接节点
7. **样式应用**：
   - 节点大小、颜色、边框
   - 边的样式、箭头
   - 阴影和光晕效果

##### C. 物理引擎 (`getAdaptivePhysics`)

**自适应参数**：
```javascript
{
  solver: "barnesHut",
  gravitationalConstant: -12000,  // 引力常数
  springLength: 动态计算,         // 弹簧长度
  springConstant: 0.012,          // 弹簧常数
  damping: 0.4,                   // 阻尼系数
  stabilization: {
    iterations: 200
  }
}
```

- **单节点搜索**：更紧凑的布局参数
- **多节点**：更宽松的排列

##### D. 圈子凸包算法 (`convexHull`)

**Andrew's Monotone Chain 算法**：
1. 按 x, y 坐标排序点集
2. 构建下凸壳（Lower Hull）
3. 构建上凸壳（Upper Hull）
4. 合并得到完整凸包

**多边形扩展** (`expandPolygon`)：
- 从中心点向外扩展指定距离
- 用于绘制圈子轮廓的 padding

**圆角路径** (`buildRoundedPath`)：
- 使用贝塞尔曲线平滑多边形顶点
- 生成美观的圆角轮廓

##### E. 交互功能

**1. 节点选择**
```javascript
network.on("selectNode", (params) => {
  selectedNodeId = params.nodes[0];
  showDetail(selectedNodeId);
  // 更新右侧详情面板
});
```

**2. 双击固定**
```javascript
network.on("doubleClick", (params) => {
  if (params.nodes.length) {
    // 切换固定状态
    pinnedNodes.has(id) ? pinnedNodes.delete(id) : pinnedNodes.add(id);
  }
});
```

**3. 空格键切换物理**
```javascript
document.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    // 切换物理模拟开关
    physicsToggleBtn.click();
  }
});
```

**4. 拖拽分隔器**
```javascript
// 左右面板宽度调整
splitterLeft.addEventListener("mousedown", ...);
splitterRight.addEventListener("mousedown", ...);
```

##### F. 分组与圈子管理

**分组功能**：
- 创建、编辑、删除分组
- 为节点分配分组
- 同组节点自动连接
- 分组高亮显示
- 颜色标记

**圈子功能**：
- 支持树形层级结构（父子关系）
- 拖拽调整层级
- 继承机制（子节点自动继承父圈子）
- 凸包轮廓绘制
- 多层嵌套显示

##### G. 搜索与过滤

**搜索支持**：
- 姓名匹配
- 昵称匹配
- MemberNumber 匹配
- 模糊搜索（不区分大小写）

**过滤选项**：
- 头衔筛选（下拉选择）
- 显示/隐藏主仆关系
- 显示/隐藏恋爱关系
- 隐藏孤立节点
- 圈子选择性显示

##### H. 数据导入导出

**导出分组数据**：
```javascript
exportMarksBtn.addEventListener("click", () => {
  const data = {
    groups: markData.groups,
    circles: markData.circles,
    nodeToGroup: markData.nodeToGroup,
    nodeToCircles: markData.nodeToCircles
  };
  // 下载 marks-export.json
});
```

**导入分组数据**：
```javascript
importMarksBtn.addEventListener("click", () => {
  // 读取 JSON 文件
  // 合并到现有标注数据
  // 更新 localStorage
  // 刷新界面
});
```

#### 2.2.5 渲染优化

**1. 签名机制**：
```javascript
const signature = JSON.stringify({
  nodes: displayNodes.map(...),
  edges: [...],
  selected: selectedNodeId,
  display: displayNickname.checked ? "nick" : "name"
});

if (signature === currentGraphSignature) return;  // 避免重复渲染
```

**2. 防抖渲染**：
```javascript
let renderTimeoutId = null;
function scheduleRender(reset = true) {
  if (renderTimeoutId) clearTimeout(renderTimeoutId);
  renderTimeoutId = setTimeout(() => applyFilters(reset), 50);
}
```

**3. 位置保持**：
```javascript
const positionMap = !usePhysics && network ? network.getPositions() : null;
// 在不使用物理引擎时保持节点位置
```

**4. Canvas 叠加层**：
```javascript
network.on("afterDrawing", (ctx) => {
  drawCircleOverlay(ctx);  // 在 vis-network 渲染后绘制圈子轮廓
});
```

#### 2.2.6 样式系统

**CSS 变量**：
```css
:root {
  --bg: #0f1115;           /* 背景色 */
  --panel: #171a21;        /* 面板背景 */
  --panel-2: #1f2430;      /* 次级面板 */
  --text: #e7eaf0;         /* 文本颜色 */
  --muted: #9aa3b2;        /* 次要文本 */
  --accent: #6ac9ff;       /* 强调色 */
  --accent-2: #ffb86b;     /* 次强调色 */
  --line: #2b3240;         /* 边框线 */
  --left-w: 260px;         /* 左侧面板宽度 */
  --right-w: 320px;        /* 右侧面板宽度 */
}
```

**主题特点**：
- 深色主题（暗蓝灰色调）
- 渐变背景
- 磨砂玻璃效果（backdrop-filter）
- 柔和阴影与光晕

---

## 三、工作流程

### 3.1 数据提取流程

```
1. 打开包含 bce-past-profiles 数据库的网页
   ↓
2. 打开浏览器开发者工具 (F12)
   ↓
3. 在 Console 中粘贴并运行 console-profiles.js
   ↓
4. 脚本自动：
   - 加载 LZString 库
   - 读取 IndexedDB
   - 解码描述文本
   - 简化数据结构
   - 导出 testprofiles.extracted.json
   ↓
5. 保存下载的 JSON 文件
```

### 3.2 可视化流程

```
1. 打开 bc-graph-viewer.html（本地或服务器）
   ↓
2. 点击 [选择文件] 按钮
   ↓
3. 选择 testprofiles.extracted.json（可多选）
   ↓
4. 应用自动：
   - 解析 JSON
   - 合并数据（多文件）
   - 去重
   - 构建节点和边
   - 初始化图形
   ↓
5. 用户交互：
   - 搜索节点
   - 查看详情
   - 创建分组
   - 定义圈子
   - 调整布局
   ↓
6. 导出标注：
   - 点击 [导出分组]
   - 保存 marks-export.json
```

### 3.3 标注数据复用流程

```
1. 已有标注数据（marks-export.json）
   ↓
2. 打开 bc-graph-viewer.html
   ↓
3. 加载数据文件（testprofiles.extracted.json）
   ↓
4. 点击 [导入分组]
   ↓
5. 选择 marks-export.json
   ↓
6. 标注数据自动应用到图形
```

---

## 四、关键算法

### 4.1 文本解码评分算法

```javascript
function scoreText(s) {
  if (!s || typeof s !== 'string') return -1;
  let control = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 9 || (c > 10 && c < 32) || c === 127) control++;
  }
  return s.length - control * 5;  // 控制字符重惩罚
}
```

**目的**：选择最可读的解码结果  
**策略**：长度优先，严重惩罚控制字符

### 4.2 凸包算法（Andrew's Monotone Chain）

```javascript
function convexHull(points) {
  if (points.length <= 1) return points.slice();
  const sorted = points.slice().sort((a, b) => 
    a.x === b.x ? a.y - b.y : a.x - b.x
  );
  
  const cross = (o, a, b) => 
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  
  // 构建下凸壳
  const lower = [];
  sorted.forEach(p => {
    while (lower.length >= 2 && 
           cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  });
  
  // 构建上凸壳
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && 
           cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}
```

**时间复杂度**：O(n log n)  
**用途**：计算圈子成员的包围轮廓

### 4.3 圆角路径生成

```javascript
function buildRoundedPath(ctx, points, radius) {
  if (points.length < 3) return;
  const maxRadius = Math.max(0, radius);
  const count = points.length;
  
  // 计算向量
  const getVec = (from, to) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: dx / len, y: dy / len, len };
  };
  
  // 为每个顶点计算圆角控制点
  for (let i = 0; i < count; i++) {
    const prev = points[(i - 1 + count) % count];
    const curr = points[i];
    const next = points[(i + 1) % count];
    
    const v1 = getVec(curr, prev);
    const v2 = getVec(curr, next);
    
    // 使用二次贝塞尔曲线绘制圆角
    ctx.lineTo(
      curr.x + v1.x * maxRadius,
      curr.y + v1.y * maxRadius
    );
    ctx.quadraticCurveTo(
      curr.x,
      curr.y,
      curr.x + v2.x * maxRadius,
      curr.y + v2.y * maxRadius
    );
  }
}
```

**效果**：平滑的圆角多边形轮廓

### 4.4 哈希偏移函数

```javascript
function hashOffset(id, salt = 0) {
  const str = String(id) + String(salt);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;  // 转换为32位整数
  }
  return (hash & 0x7fffffff) / 0x7fffffff - 0.5;  // [-0.5, 0.5]
}
```

**用途**：
- 为节点生成确定性随机颜色
- 初始化节点位置
- 避免碰撞

### 4.5 广度优先搜索（扩展节点）

```javascript
function expandByDepth(seedNodes, edges, depth) {
  const expanded = new Set(seedNodes);
  if (!seedNodes.size || depth <= 0) return expanded;
  
  // 构建邻接表
  const neighborMap = new Map();
  edges.forEach(e => {
    if (!neighborMap.has(e.from)) neighborMap.set(e.from, []);
    if (!neighborMap.has(e.to)) neighborMap.set(e.to, []);
    neighborMap.get(e.from).push(e.to);
    neighborMap.get(e.to).push(e.from);
  });
  
  // BFS 扩展
  let frontier = new Set(seedNodes);
  for (let step = 0; step < depth; step++) {
    const next = new Set();
    frontier.forEach(nodeId => {
      const neighbors = neighborMap.get(nodeId) || [];
      neighbors.forEach(n => {
        if (!expanded.has(n)) {
          expanded.add(n);
          next.add(n);
        }
      });
    });
    if (!next.size) break;
    frontier = next;
  }
  
  return expanded;
}
```

**用途**：搜索深度控制，显示指定层级的关系网络

---

## 五、性能优化策略

### 5.1 渲染优化

1. **签名比对**：避免无变化的重复渲染
2. **防抖延迟**：50ms 延迟合并多次更新
3. **位置缓存**：关闭物理引擎时保持节点位置
4. **Canvas 分层**：vis-network 主层 + 自定义叠加层

### 5.2 数据优化

1. **索引构建**：
   - `nodeById`: Map (O(1) 查找)
   - `groupMembersByNode`: Map
   - `circleMembersByNode`: Map
   - `neighborMap`: 邻接表

2. **惰性计算**：
   - 仅在需要时计算凸包
   - 按需渲染分组成员列表

3. **去重合并**：
   - 多文件加载自动去重（按 memberNumber）
   - 保留最新数据（按 `seen` 时间戳）

### 5.3 内存管理

1. **数据分离**：
   - 原始数据（data）
   - 标注数据（markData，localStorage）
   - 显示数据（临时生成）

2. **及时清理**：
   - 销毁旧的 vis-network 实例
   - 清除事件监听器

---

## 六、扩展性设计

### 6.1 模块化函数

所有核心功能都封装为独立函数：
- `computeGraph()` - 图形计算
- `applyFilters()` - 应用筛选
- `renderGroupSelect()` - 渲染分组选择器
- `buildCircleForest()` - 构建圈子树
- ...

### 6.2 可配置参数

```javascript
// 物理引擎参数
const baseLength = isSingleSearch ? 80 : 100;
const springLength = Math.round(baseLength * Math.min(2.2, scale / 3 + 1));

// 圈子轮廓参数
const padding = 28 + entry.depth * 10;
const blur = blurBase + entry.depth * 1.6;

// 颜色生成
const hue = Math.abs(hashOffset(circleId, 41)) * 11 % 360;
const lightness = Math.max(34, 60 - depth * 4);
```

### 6.3 数据格式兼容

- 支持多文件合并
- 向后兼容旧版标注数据
- 容错处理（解析失败不中断）

---

## 七、使用场景

### 7.1 社交网络分析
- 查看角色之间的主仆关系
- 分析恋爱关系网络
- 识别社交圈子

### 7.2 数据整理
- 按头衔分类角色
- 创建自定义分组
- 标记重要节点

### 7.3 可视化探索
- 发现关系模式
- 追踪关系链
- 社区检测（圈子功能）

---

## 八、技术亮点

### 8.1 前端技术

1. **纯 JavaScript 实现**：无框架依赖，轻量高效
2. **Canvas 自定义绘制**：凸包轮廓、圆角路径
3. **拖拽交互**：分隔器调整、圈子层级拖拽
4. **LocalStorage 持久化**：标注数据本地保存

### 8.2 算法应用

1. **凸包算法**：计算圈子包围边界
2. **BFS**：关系网络扩展
3. **哈希函数**：确定性随机化
4. **树遍历**：圈子层级处理

### 8.3 用户体验

1. **实时搜索**：输入即搜索
2. **快捷键**：空格键切换物理
3. **视觉反馈**：高亮、阴影、动画
4. **响应式布局**：适配不同屏幕尺寸

---

## 九、未来改进方向

### 9.1 功能增强
- [ ] 导出为图片/PDF
- [ ] 时间轴模式（查看历史变化）
- [ ] 高级搜索（正则表达式、组合条件）
- [ ] 统计分析面板（度分布、聚类系数）

### 9.2 性能优化
- [ ] Web Worker 处理大数据集
- [ ] 虚拟滚动（大列表）
- [ ] 图形分块渲染（超大图）

### 9.3 交互改进
- [ ] 撤销/重做功能
- [ ] 批量编辑
- [ ] 快捷键自定义
- [ ] 教程与提示

---

## 十、故障排查

### 10.1 常见问题

**Q: 控制台脚本运行失败**
- 检查是否有 IndexedDB 数据库
- 确认数据库名和存储对象名正确
- 查看控制台错误信息

**Q: JSON 文件无法加载**
- 检查文件格式是否正确
- 确认编码为 UTF-8
- 尝试单个文件加载

**Q: 图形显示异常**
- 刷新页面重新加载
- 清除浏览器缓存
- 检查 vis-network 库是否加载成功

**Q: 分组数据丢失**
- 检查 localStorage 是否被清除
- 导出备份定期保存
- 导入前确认文件完整

### 10.2 调试技巧

```javascript
// 查看原始数据
console.log(data);

// 查看标注数据
console.log(markData);

// 查看当前图形状态
console.log(network.getPositions());

// 查看 localStorage
console.log(localStorage.getItem("bc-graph-viewer-marks"));
```

---

## 十一、安全与隐私

### 11.1 数据安全
- **本地运行**：所有数据在浏览器本地处理
- **无服务器交互**：不上传任何数据
- **用户控制**：数据导入导出完全由用户控制

### 11.2 隐私保护
- 不收集用户信息
- 不追踪用户行为
- 开源透明（代码可审查）

---

## 附录

### A. 文件清单

```
BC-Bio-Visualizer/
├── README.md                          # 项目说明（简短）
├── ARCHITECTURE.md                    # 本文档（详尽架构说明）
├── console-profiles.js                # 数据提取脚本
├── bc-graph-viewer.html               # 可视化应用
└── LICENSE                            # 许可证
```

### B. 依赖库

| 库名 | 版本 | 用途 | 来源 |
|-----|------|------|------|
| lz-string | 1.4.4 | 解压缩描述文本 | CDN (jsdelivr) |
| vis-network | 9.x | 图形渲染引擎 | CDN (unpkg) |

### C. 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+

**必需特性**：
- ES6+ (async/await, Map, Set)
- Canvas API
- IndexedDB
- LocalStorage

---

**文档版本**：1.0  
**最后更新**：2026-02-13  
**维护者**：BC-Bio-Visualizer Team
