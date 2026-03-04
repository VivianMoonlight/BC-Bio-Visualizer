# bc-bio-visualizer.user.js i18n集成指南

## 概述

该脚本用于在网页中注入BC-Bio-Visualizer工具。本指南解释了如何在此Tampermonkey脚本中集成i18n系统。

## 集成步骤

### 步骤1：加载i18n脚本

在 `@require` 部分添加i18n脚本的URL：

```javascript
// ==UserScript==
// ... 其他配置
// @require      https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js
// @require      https://cdn.jsdelivr.net/npm/lz-string@1.4.4/libs/lz-string.min.js
// @require      [path-to]/i18n.js
// @require      [path-to]/locales.js
// ==/UserScript==
```

或者直接在脚本中注入：

```javascript
function injectI18nScripts() {
  return new Promise((resolve) => {
    // 加载i18n.js
    const i18nScript = document.createElement('script');
    i18nScript.textContent = `
      // i18n.js 的内容
    `;
    document.head.appendChild(i18nScript);
    
    // 加载locales.js
    const localesScript = document.createElement('script');
    localesScript.textContent = `
      // locales.js 的内容
    `;
    document.head.appendChild(localesScript);
    
    resolve();
  });
}
```

### 步骤2：初始化i18n

在主脚本的早期添加初始化代码：

```javascript
(function() {
  'use strict';

  // 初始化i18n
  async function initI18n() {
    if (typeof i18n === 'undefined') {
      console.warn('[BC-Bio-Visualizer] i18n not loaded');
      return false;
    }
    i18n.init();
    return true;
  }

  // 在脚本加载时初始化
  initI18n().then(success => {
    if (success) {
      console.log('[BC-Bio-Visualizer] i18n initialized');
    }
  });

  // ... 其他初始化代码
})();
```

### 步骤3：创建UI时使用翻译

当动态创建UI元素时（如在Shadow DOM中），使用i18n：

```javascript
function createToolbar() {
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  
  // 使用翻译创建按钮
  const exportBtn = document.createElement('button');
  exportBtn.textContent = typeof i18n !== 'undefined' 
    ? i18n.t('button_export') 
    : '导出分组';
  
  const importBtn = document.createElement('button');
  importBtn.textContent = typeof i18n !== 'undefined' 
    ? i18n.t('button_import') 
    : '导入分组';
  
  toolbar.appendChild(exportBtn);
  toolbar.appendChild(importBtn);
  
  return toolbar;
}
```

### 步骤4：处理alert和console消息

将所有用户消息翻译化：

```javascript
// 之前
alert('导入分组数据失败：' + error.message);

// 之后
if (typeof i18n !== 'undefined') {
  alert(i18n.t('error_import_failed', { error: error.message }));
} else {
  alert('导入分组数据失败：' + error.message);
}
```

或者创建一个辅助函数：

```javascript
function t(key, params = {}) {
  if (typeof i18n !== 'undefined') {
    return i18n.t(key, params);
  }
  // 返回英文作为后备
  return key;
}

// 使用
alert(t('error_import_failed', { error: error.message }));
```

### 步骤5：添加语言切换UI

在工具栏中添加语言选择器：

```javascript
function createLanguageSelector() {
  if (typeof i18n === 'undefined') return null;
  
  const select = document.createElement('select');
  select.id = 'i18n-language-select';
  
  const availableLangs = i18n.getAvailableLanguages();
  availableLangs.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang;
    option.textContent = lang === 'zh_CN' ? '中文' : 'English';
    select.appendChild(option);
  });
  
  select.value = i18n.getLanguage();
  select.addEventListener('change', (e) => {
    i18n.setLanguage(e.target.value);
    location.reload(); // 或调用更新UI函数
  });
  
  return select;
}
```

## 注意事项

### 1. 检查i18n可用性

由于Tampermonkey脚本可能在i18n加载完成前运行，始终检查i18n的可用性：

```javascript
if (typeof i18n !== 'undefined') {
  // 使用i18n
} else {
  // 使用默认文本
}
```

### 2. 处理Shadow DOM

如果脚本使用Shadow DOM，确保i18n在正确的上下文中加载：

```javascript
function createShadowUI() {
  const container = document.createElement('div');
  const shadowRoot = container.attachShadow({ mode: 'open' });
  
  const content = document.createElement('div');
  content.innerHTML = `
    <button>${typeof i18n !== 'undefined' ? i18n.t('button_save') : '保存'}</button>
  `;
  
  shadowRoot.appendChild(content);
  return container;
}
```

### 3. 异步加载

如果脚本异步加载HTML，在DOM完全加载后更新文本：

```javascript
async function loadVisualizerHTML() {
  const response = await fetch('bc-graph-viewer.html');
  const html = await response.text();
  
  const container = document.createElement('div');
  container.innerHTML = html;
  
  document.body.appendChild(container);
  
  // 等待i18n加载
  if (typeof i18n !== 'undefined') {
    i18n.init();
    updateAllUI(); // 如果此函数存在
  }
}
```

### 4. fallback文本

始终提供默认文本以防i18n不可用：

```javascript
const labels = {
  save: typeof i18n !== 'undefined' ? i18n.t('button_save') : '保存',
  cancel: typeof i18n !== 'undefined' ? i18n.t('button_cancel') : '取消',
};
```

## 最佳实践

### 1. 创建翻译助手

```javascript
const t = (key, params = {}) => {
  try {
    return typeof i18n !== 'undefined' 
      ? i18n.t(key, params)
      : key;
  } catch (e) {
    console.warn(`Translation error for key: ${key}`);
    return key;
  }
};

// 使用
const saveLabel = t('button_save');
```

### 2. 集中管理UI文本

```javascript
const UI_STRINGS = {
  buttons: {
    save: 'button_save',
    cancel: 'button_cancel',
  },
  messages: {
    importFailed: 'error_import_failed',
    loading: 'status_loading',
  }
};

// 使用
alert(t(UI_STRINGS.messages.importFailed, { error: 'Network error' }));
```

### 3. 使用data属性存储键

```html
<button data-i18n="button_save">Save</button>
```

```javascript
document.querySelectorAll('[data-i18n]').forEach(el => {
  const key = el.getAttribute('data-i18n');
  if (typeof i18n !== 'undefined') {
    el.textContent = i18n.t(key);
  }
});
```

## 常见问题

### Q: 脚本运行时i18n还未加载怎么办？
A: 使用条件检查或延迟初始化：
```javascript
function waitForI18n() {
  return new Promise(resolve => {
    const check = setInterval(() => {
      if (typeof i18n !== 'undefined') {
        clearInterval(check);
        resolve();
      }
    }, 100);
  });
}
```

### Q: 如何在Shadow DOM中使用i18n？
A: i18n在主文档中加载，可直接在Shadow DOM中引用：
```javascript
const label = window.i18n?.t('button_save') || '保存';
```

### Q: 多个脚本同时运行时会冲突吗？
A: 不会。i18n是全局对象，所有脚本都可以访问。

## 测试

### 在浏览器控制台测试

```javascript
// 检查i18n是否已加载
console.log(typeof i18n); // 'object'

// 测试翻译
console.log(i18n.t('button_save')); // '保存'

// 切换语言
i18n.setLanguage('en_US');
console.log(i18n.t('button_save')); // 'Save'
```

## 许可证

遵循BC-Bio-Visualizer项目的许可证。
