// ==UserScript==
// @name         BC-Bio-Visualizer
// @namespace    https://github.com/your-repo/BC-Bio-Visualizer
// @version      2.0.0
// @description  WCE生物数据库可视化工具 (Tampermonkey集成版)
// @author       BC-Bio-Visualizer Team
// @match        https://www.bondageprojects.com/*
// @match        https://bondageprojects.elementfx.com/*
// @icon         data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='%236ac9ff'/%3E%3C/svg%3E
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @require      https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js
// @require      https://cdn.jsdelivr.net/npm/lz-string@1.4.4/libs/lz-string.min.js
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function() {
  'use strict';

  // ============================================================================
  // CONSTANTS & CONFIGURATION
  // ============================================================================

  const CONFIG = {
    DB_NAME: 'bce-past-profiles',
    STORE_NAME: 'profiles',
    STORAGE_KEY: 'bc-graph-viewer-marks',
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
    BUTTON_POSITION: { bottom: '20px', right: '20px' }
  };

  // ============================================================================
  // STATE
  // ============================================================================

  let rootContainer = null;
  let shadowRoot = null;
  let isVisualizerVisible = false;
  let cachedData = null;
  let cacheTimestamp = null;
  let network = null;
  let networkInitialized = false;

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Debounce function
   */
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  /**
   * Throttle function
   */
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

  /**
   * Hash offset for deterministic randomization
   */
  function hashOffset(id, salt = 0) {
    const str = String(id) + String(salt);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return (hash & 0x7fffffff) / 0x7fffffff - 0.5;
  }

  // ============================================================================
  // STORAGE MODULE
  // ============================================================================

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

  // ============================================================================
  // DATA EXTRACTION MODULE
  // ============================================================================

  const utf8Decoder = new TextDecoder('utf-8', { fatal: false });

  function byteStringToUtf8(str) {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i) & 0xff;
    }
    return utf8Decoder.decode(bytes);
  }

  function scoreText(s) {
    if (!s || typeof s !== 'string') return -1;
    let control = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c < 9 || (c > 10 && c < 32) || c === 127) control++;
    }
    return s.length - control * 5;
  }

  function tryDecode(fn, input) {
    try {
      return fn(input);
    } catch {
      return null;
    }
  }

  function decodeDescription(input) {
    if (typeof input !== 'string' || input.length === 0) return '';

    const sliced = input.substring(1);
    const candidates = [];

    const d1 = tryDecode(LZString.decompressFromUTF16, sliced);
    if (d1) {
      candidates.push(d1);
      candidates.push(byteStringToUtf8(d1));
    }

    const d2 = tryDecode(LZString.decompressFromBase64, sliced);
    if (d2) {
      candidates.push(d2);
      candidates.push(byteStringToUtf8(d2));
    }

    const d3 = tryDecode(LZString.decompressFromEncodedURIComponent, sliced);
    if (d3) {
      candidates.push(d3);
      candidates.push(byteStringToUtf8(d3));
    }

    candidates.push(input);

    let best = '';
    let bestScore = -1;
    for (const c of candidates) {
      const sc = scoreText(c);
      if (sc > bestScore) {
        bestScore = sc;
        best = c;
      }
    }
    return best;
  }

  function pickBasicInfo(row, bundle) {
    return {
      memberNumber: row.memberNumber ?? bundle?.MemberNumber ?? null,
      name: row.name ?? bundle?.Name ?? null,
      lastNick: row.lastNick ?? null,
      seen: row.seen ?? null,
      title: bundle?.Title ?? null,
      nickname: bundle?.Nickname ?? null,
      assetFamily: bundle?.AssetFamily ?? null
    };
  }

  function readAllFromStore(dbName, storeName) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        const all = [];
        store.openCursor().onsuccess = e => {
          const cursor = e.target.result;
          if (cursor) {
            all.push(cursor.value);
            cursor.continue();
          } else {
            db.close();
            resolve(all);
          }
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
  }

  /**
   * Extract data from IndexedDB
   * @param {Function} progressCallback - Optional progress callback
   * @returns {Promise<Array>} Simplified profile data
   */
  async function extractDataFromIndexedDB(progressCallback = null) {
    try {
      if (progressCallback) progressCallback('正在读取 IndexedDB...');

      const raw = await readAllFromStore(CONFIG.DB_NAME, CONFIG.STORE_NAME);
      
      if (progressCallback) progressCallback(`已读取 ${raw.length} 条记录，正在解码...`);

      const simplified = raw.map((row, index) => {
        if (progressCallback && index % 100 === 0) {
          progressCallback(`解码中... ${index}/${raw.length}`);
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

      if (progressCallback) progressCallback('完成！');
      
      return simplified;
    } catch (error) {
      console.error('Data extraction error:', error);
      throw error;
    }
  }

  /**
   * Get data with caching
   */
  async function getData(forceRefresh = false, progressCallback = null) {
    const now = Date.now();
    if (!forceRefresh && cachedData && (now - cacheTimestamp < CONFIG.CACHE_DURATION)) {
      return cachedData;
    }

    cachedData = await extractDataFromIndexedDB(progressCallback);
    cacheTimestamp = now;
    return cachedData;
  }

  // ============================================================================
  // UI MODULE - FLOATING BUTTON
  // ============================================================================

  /**
   * Create floating trigger button
   */
  function createFloatingButton() {
    const btn = document.createElement('button');
    btn.id = 'bc-bio-visualizer-trigger';
    btn.innerHTML = '📊 Bio';
    btn.style.cssText = `
      position: fixed;
      bottom: ${CONFIG.BUTTON_POSITION.bottom};
      right: ${CONFIG.BUTTON_POSITION.right};
      z-index: 999998;
      padding: 12px 20px;
      background: linear-gradient(135deg, #ffb347, #ff3d77);
      border: none;
      border-radius: 12px;
      color: white;
      font-weight: bold;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: all 0.3s ease;
      font-family: "Segoe UI", sans-serif;
    `;
    
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-2px)';
      btn.style.boxShadow = '0 6px 16px rgba(255, 77, 119, 0.4)';
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    });
    
    btn.addEventListener('click', toggleVisualizer);
    
    document.body.appendChild(btn);
    return btn;
  }

  // ============================================================================
  // UI MODULE - SHADOW DOM CONTAINER
  // ============================================================================

  /**
   * Create Shadow DOM container
   */
  function createShadowContainer() {
    rootContainer = document.createElement('div');
    rootContainer.id = 'bc-bio-visualizer-root';
    rootContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 999999;
      display: none;
    `;
    document.body.appendChild(rootContainer);

    shadowRoot = rootContainer.attachShadow({ mode: 'open' });
    
    return { rootContainer, shadowRoot };
  }

  /**
   * Toggle visualizer visibility
   */
  function toggleVisualizer() {
    if (isVisualizerVisible) {
      hideVisualizer();
    } else {
      showVisualizer();
    }
  }

  /**
   * Show visualizer
   */
  async function showVisualizer() {
    rootContainer.style.display = 'block';
    isVisualizerVisible = true;
    
    if (!networkInitialized) {
      showLoadingOverlay('初始化中...');
      await initializeVisualizerUI();
      hideLoadingOverlay();
    }
  }

  /**
   * Hide visualizer
   */
  function hideVisualizer() {
    rootContainer.style.display = 'none';
    isVisualizerVisible = false;
  }

  // ============================================================================
  // UI MODULE - LOADING OVERLAY
  // ============================================================================

  let loadingOverlay = null;

  function showLoadingOverlay(message = '加载中...') {
    if (loadingOverlay) {
      const msgEl = loadingOverlay.querySelector('.loading-message');
      if (msgEl) msgEl.textContent = message;
      return;
    }

    loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-message">${message}</div>
    `;
    
    if (shadowRoot && shadowRoot.childNodes.length > 0) {
      shadowRoot.appendChild(loadingOverlay);
    }
  }

  function hideLoadingOverlay() {
    if (loadingOverlay) {
      loadingOverlay.remove();
      loadingOverlay = null;
    }
  }

  function updateLoadingMessage(message) {
    if (loadingOverlay) {
      const msgEl = loadingOverlay.querySelector('.loading-message');
      if (msgEl) msgEl.textContent = message;
    }
  }

  // ============================================================================
  // UI MODULE - VISUALIZER INTERFACE
  // ============================================================================

  /**
   * Initialize visualizer UI
   */
  async function initializeVisualizerUI() {
    if (networkInitialized) return;

    // Inject styles
    injectStyles();

    // Create UI structure
    createUIStructure();

    // Setup event listeners (will be expanded in later phases)
    setupEventListeners();

    networkInitialized = true;
  }

  /**
   * Inject all styles into Shadow DOM
   */
  function injectStyles() {
    const styleEl = document.createElement('style');
    styleEl.textContent = getStyles();
    shadowRoot.appendChild(styleEl);
  }

  /**
   * Get all CSS styles
   */
  function getStyles() {
    return `
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

      * { 
        box-sizing: border-box; 
        margin: 0;
        padding: 0;
      }

      .visualizer-container {
        width: 100vw;
        height: 100vh;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        background: radial-gradient(1200px 800px at 10% -10%, #1b2333, #0f1115);
        color: var(--text);
        display: grid;
        grid-template-rows: auto 1fr;
      }

      header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-bottom: 1px solid var(--line);
        background: rgba(15, 17, 21, 0.9);
        backdrop-filter: blur(6px);
      }

      header h1 {
        font-size: 16px;
        font-weight: 600;
        letter-spacing: 0.2px;
      }

      .toolbar {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: auto;
      }

      .button, select, input[type="text"], input[type="number"] {
        background: var(--panel-2);
        color: var(--text);
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 12px;
      }

      .button {
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .button:hover {
        background: var(--panel);
        border-color: var(--accent);
      }

      .button-accent {
        background: linear-gradient(135deg, #ffb347, #ff3d77);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #111319;
        font-weight: 700;
        letter-spacing: 0.2px;
        box-shadow: 0 6px 16px rgba(255, 77, 119, 0.25);
      }

      .button-accent:hover {
        filter: brightness(1.05);
      }

      .button-close {
        background: #ff4444;
        color: white;
        font-weight: bold;
      }

      .button-close:hover {
        background: #cc0000;
        border-color: #ff0000;
      }

      main {
        display: grid;
        grid-template-columns: var(--left-w) 8px 1fr 8px var(--right-w);
        gap: 12px;
        padding: 12px;
        height: 100%;
        min-height: 0;
      }

      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 12px;
        overflow: auto;
      }

      .splitter {
        cursor: col-resize;
        background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0));
        border-radius: 6px;
        border: 1px solid var(--line);
      }

      .splitter:hover {
        border-color: var(--accent);
      }

      #graph {
        height: 100%;
        min-height: 360px;
        width: 100%;
        background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0));
        border: 1px solid var(--line);
        border-radius: 12px;
      }

      .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(15, 17, 21, 0.95);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }

      .loading-spinner {
        width: 50px;
        height: 50px;
        border: 4px solid var(--line);
        border-top-color: var(--accent);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .loading-message {
        margin-top: 20px;
        font-size: 14px;
        color: var(--muted);
      }

      .field {
        margin-bottom: 10px;
      }

      .field label {
        display: block;
        font-size: 12px;
        color: var(--muted);
        margin-bottom: 4px;
      }

      input[type="text"] {
        width: 100%;
      }

      #status {
        font-size: 12px;
        color: var(--muted);
      }
    `;
  }

  /**
   * Create UI structure
   */
  function createUIStructure() {
    const container = document.createElement('div');
    container.className = 'visualizer-container';
    container.innerHTML = `
      <header>
        <h1>BC 资料图查看器 v2.0</h1>
        <div id="status">未加载数据</div>
        <div class="toolbar">
          <button id="extractBtn" class="button button-accent">提取数据</button>
          <button id="refreshBtn" class="button">刷新</button>
          <button id="closeBtn" class="button button-close">关闭</button>
        </div>
      </header>
      <main>
        <div class="panel left-panel">
          <div class="field">
            <label>搜索</label>
            <input type="text" id="searchInput" placeholder="输入姓名或编号..." />
          </div>
          <p style="color: var(--muted); font-size: 12px; margin-top: 20px;">
            更多功能正在迁移中...
          </p>
        </div>
        <div class="splitter splitter-left"></div>
        <div id="graph"></div>
        <div class="splitter splitter-right"></div>
        <div class="panel right-panel">
          <h3 style="font-size: 14px; margin-bottom: 12px;">详情面板</h3>
          <p style="color: var(--muted); font-size: 12px;">
            点击节点查看详情
          </p>
        </div>
      </main>
    `;
    
    shadowRoot.appendChild(container);
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    const extractBtn = shadowRoot.getElementById('extractBtn');
    const refreshBtn = shadowRoot.getElementById('refreshBtn');
    const closeBtn = shadowRoot.getElementById('closeBtn');
    const statusEl = shadowRoot.getElementById('status');

    extractBtn.addEventListener('click', async () => {
      try {
        showLoadingOverlay('提取数据中...');
        const data = await getData(true, (msg) => {
          updateLoadingMessage(msg);
        });
        hideLoadingOverlay();
        statusEl.textContent = `已加载 ${data.length} 条记录`;
        alert(`数据提取成功！共 ${data.length} 条记录`);
      } catch (error) {
        hideLoadingOverlay();
        statusEl.textContent = '数据提取失败';
        alert('数据提取失败: ' + error.message);
      }
    });

    refreshBtn.addEventListener('click', () => {
      alert('刷新功能将在后续阶段实现');
    });

    closeBtn.addEventListener('click', hideVisualizer);
  }

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+V or Cmd+Shift+V
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        toggleVisualizer();
      }

      // ESC to close
      if (e.key === 'Escape' && isVisualizerVisible) {
        hideVisualizer();
      }
    });
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Main initialization function
   */
  function main() {
    console.log('[BC-Bio-Visualizer] v2.0.0 启动中...');

    // Check required features
    if (!window.indexedDB) {
      console.error('[BC-Bio-Visualizer] IndexedDB not supported');
      return;
    }

    if (!document.body.attachShadow) {
      console.warn('[BC-Bio-Visualizer] Shadow DOM not supported, using fallback');
      // TODO: Implement fallback in later phase
    }

    // Create floating button
    createFloatingButton();

    // Create Shadow DOM container
    createShadowContainer();

    // Setup keyboard shortcuts
    setupKeyboardShortcuts();

    console.log('[BC-Bio-Visualizer] 初始化完成！点击浮动按钮或按 Ctrl+Shift+V 打开');
  }

  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }

})();
