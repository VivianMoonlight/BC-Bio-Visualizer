// ==UserScript==
// @name         BC-Bio-Visualizer
// @namespace    https://github.com/VivianMoonlight/BC-Bio-Visualizer
// @version      2.0.0
// @description  WCE生物数据库可视化工具 (Tampermonkey集成版)
// @author       BC-Bio-Visualizer Team
// @match        https://www.bondageprojects.com/*
// @match        https://www.bondageprojects.elementfx.com/*
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
  // COMPATIBILITY CHECK
  // ============================================================================

  // Check if we're running in a proper userscript environment
  const hasGMSupport = typeof GM_getValue !== 'undefined' && 
                       typeof GM_setValue !== 'undefined';
  
  if (!hasGMSupport) {
    console.warn('[BC-Bio-Visualizer] Greasemonkey/Tampermonkey API not detected, using fallback storage');
  }

  // ============================================================================
  // CONSTANTS & CONFIGURATION
  // ============================================================================

  const CONFIG = {
    DB_NAME: 'bce-past-profiles',
    STORE_NAME: 'profiles',
    STORAGE_KEY: 'bc-graph-viewer-marks',
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
    COMMAND_TAG: 'biovis'
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
        // Check if GM_getValue is available
        if (typeof GM_getValue === 'undefined') {
          console.warn('[BC-Bio-Visualizer] GM_getValue not available, using localStorage fallback');
          const value = localStorage.getItem(key);
          return value !== null ? JSON.parse(value) : defaultValue;
        }
        const value = await GM_getValue(key);
        return value !== undefined ? value : defaultValue;
      } catch (error) {
        console.error('Storage get error:', error);
        return defaultValue;
      }
    },

    async set(key, value) {
      try {
        // Check if GM_setValue is available
        if (typeof GM_setValue === 'undefined') {
          console.warn('[BC-Bio-Visualizer] GM_setValue not available, using localStorage fallback');
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        }
        await GM_setValue(key, value);
        return true;
      } catch (error) {
        console.error('Storage set error:', error);
        return false;
      }
    },

    async remove(key) {
      try {
        // Check if GM_deleteValue is available
        if (typeof GM_deleteValue === 'undefined') {
          console.warn('[BC-Bio-Visualizer] GM_deleteValue not available, using localStorage fallback');
          localStorage.removeItem(key);
          return true;
        }
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
   * Merge imported profiles into IndexedDB (put semantics: insert or update)
   * For existing profiles, keep the one with the newer `seen` timestamp.
   * @param {string} dbName
   * @param {string} storeName
   * @param {Array} records - Profile records to merge
   * @param {Function} progressCallback - Optional progress callback
   * @returns {Promise<{added: number, updated: number, skipped: number}>}
   */
  function mergeProfilesIntoStore(dbName, storeName, records, progressCallback = null) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        // First, read all existing records to compare timestamps
        const readTx = db.transaction([storeName], 'readonly');
        const readStore = readTx.objectStore(storeName);
        const existingMap = new Map();

        readStore.openCursor().onsuccess = e => {
          const cursor = e.target.result;
          if (cursor) {
            const row = cursor.value;
            if (row.memberNumber !== undefined && row.memberNumber !== null) {
              existingMap.set(String(row.memberNumber), row);
            }
            cursor.continue();
          } else {
            // Read complete, now write merged data
            const writeTx = db.transaction([storeName], 'readwrite');
            const writeStore = writeTx.objectStore(storeName);
            let added = 0, updated = 0, skipped = 0;

            records.forEach((record, index) => {
              if (progressCallback && index % 100 === 0) {
                progressCallback(`合并中... ${index}/${records.length}`);
              }
              const key = String(record.memberNumber);
              const existing = existingMap.get(key);

              if (!existing) {
                // New record
                writeStore.put(record);
                added++;
              } else {
                // Compare seen timestamps, keep newer
                const existingSeen = existing.seen || 0;
                const importedSeen = record.seen || 0;
                if (importedSeen > existingSeen) {
                  writeStore.put(record);
                  updated++;
                } else {
                  skipped++;
                }
              }
            });

            writeTx.oncomplete = () => {
              db.close();
              resolve({ added, updated, skipped });
            };
            writeTx.onerror = () => {
              db.close();
              reject(writeTx.error);
            };
          }
        };
        readTx.onerror = () => {
          db.close();
          reject(readTx.error);
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
  // UI MODULE - GAME COMMAND INJECTION
  // ============================================================================

  /**
   * Wait for the BC game to be fully loaded (CommandCombine available)
   */
  function waitForGameReady(maxAttempts = 100, interval = 500) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const check = setInterval(() => {
        attempts++;
        if (typeof CommandCombine === 'function') {
          clearInterval(check);
          console.log('[BC-Bio-Visualizer] Game API ready after', attempts, 'attempts');
          resolve();
        } else if (attempts >= maxAttempts) {
          clearInterval(check);
          reject(new Error('Timeout waiting for game API (CommandCombine)'));
        }
      }, interval);
    });
  }

  /**
   * Register chat command to toggle the visualizer
   */
  function registerGameCommand() {
    CommandCombine([
      {
        Tag: 'biovis',
        Description: '[BC-Bio-Visualizer] Toggle the bio relationship visualizer',
        Action: () => {
          toggleVisualizer();
        }
      }
    ]);
    console.log('[BC-Bio-Visualizer] Chat command registered: /biovis');
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
   * Initialize visualizer UI (Phase 5 - with mark data loading)
   */
  async function initializeVisualizerUI() {
    if (networkInitialized) return;

    // Load mark data
    markData = await loadMarkData();
    console.log('[BC-Bio-Visualizer] Mark data loaded:', Object.keys(markData.groups).length, 'groups,', Object.keys(markData.circles).length, 'circles');

    // Inject styles
    injectStyles();

    // Create UI structure
    createUIStructure();

    // Setup event listeners (will be expanded in later phases)
    setupEventListeners();

    // Render pinned list
    renderPinnedList();

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
   * Get all CSS styles (Complete migration from bc-graph-viewer.html)
   */
  function getStyles() {
    return `
      :host {
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
        width: 100vw;
        height: 100vh;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        background: radial-gradient(1200px 800px at 10% -10%, #1b2333, #0f1115);
        color: var(--text);
        display: grid;
        grid-template-rows: auto auto 1fr;
        overflow: hidden;
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
        margin: 0;
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

      #detail-panel {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      #detail {
        display: flex;
        flex-direction: column;
        min-height: 0;
        height: 100%;
      }

      #detail .field:last-of-type {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        min-height: 0;
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

      .field {
        margin-bottom: 10px;
      }

      .field label {
        display: block;
        font-size: 12px;
        color: var(--muted);
        margin-bottom: 4px;
      }

      .field-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
      }

      .collapse-toggle {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        background: transparent;
        border: none;
        color: var(--muted);
        font-size: 12px;
        padding: 0;
        cursor: pointer;
        text-align: left;
      }

      .collapse-toggle .chevron {
        display: inline-block;
        width: 12px;
        text-align: center;
        color: var(--accent);
        font-weight: 700;
      }

      .field-body {
        display: block;
      }

      .field.is-collapsed .field-body {
        display: none;
      }

      textarea {
        width: 100%;
        background: var(--panel-2);
        color: var(--text);
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 12px;
        resize: vertical;
        min-height: 72px;
      }

      .checkbox-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--muted);
        margin-bottom: 6px;
      }

      .group-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }

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

      input[type="text"], input[type="number"], select {
        width: 100%;
      }

      .pill {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 999px;
        background: #23304a;
        color: #a9c7ff;
        font-size: 11px;
        margin-left: 6px;
      }

      .muted { color: var(--muted); }

      .stat {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        padding: 4px 0;
        border-bottom: 1px dashed var(--line);
      }

      .detail-title {
        font-size: 14px;
        font-weight: 600;
        margin: 0 0 6px 0;
      }

      .detail-sub {
        font-size: 12px;
        color: var(--muted);
        margin-bottom: 8px;
      }

      pre {
        white-space: pre-wrap;
        word-break: break-word;
        background: transparent;
        border: none;
        padding: 4px 2px 8px;
        border-radius: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif;
        font-size: 15px;
        line-height: 1.65;
        max-height: none;
        min-height: 0;
        overflow: auto;
        color: #d6dbe6;
      }

      .detail-description {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .detail-description pre {
        flex: 1 1 auto;
      }

      /* Group selector styles (Phase 6) */
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

      .select-item.is-creating {
        background: rgba(106, 201, 255, 0.08);
        border: 1px dashed var(--accent);
        margin-top: 8px;
      }

      .select-item.is-implied .item-label {
        color: var(--muted);
      }

      .select-item.is-drop-target {
        outline: 1px dashed var(--accent);
        background: rgba(106, 201, 255, 0.08);
      }

      .select-item input[type="radio"] {
        flex-shrink: 0;
        margin: 0;
        cursor: pointer;
        accent-color: var(--accent);
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

      .select-item .item-label {
        flex: 1;
        font-size: 13px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--text);
        cursor: pointer;
        user-select: none;
      }

      .select-item .item-input {
        flex: 1;
        font-size: 13px;
        padding: 4px 8px;
        border-radius: 4px;
        background: var(--panel);
        border: 1px solid var(--accent);
        color: var(--text);
        outline: none;
      }

      .select-item .item-input:focus {
        outline: none;
        border-color: var(--accent-2);
      }

      .select-item .item-actions {
        display: flex;
        gap: 4px;
        flex-shrink: 0;
        opacity: 0;
        transition: opacity 0.2s;
      }

      .select-item:hover .item-actions {
        opacity: 1;
      }

      .select-item.is-editing .item-actions,
      .select-item.is-creating .item-actions {
        opacity: 1;
      }

      .icon-btn {
        width: 24px;
        height: 24px;
        min-width: 24px;
        padding: 0;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        background: transparent;
        border: 1px solid transparent;
        color: var(--muted);
        transition: all 0.15s ease;
      }

      .icon-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: var(--text);
        border-color: var(--line);
      }

      .icon-btn.save {
        color: #6ac9ff;
      }

      .icon-btn.save:hover {
        background: rgba(106, 201, 255, 0.15);
        border-color: #6ac9ff;
      }

      .icon-btn.delete {
        color: #ff6b6b;
      }

      .icon-btn.delete:hover {
        background: rgba(255, 107, 107, 0.15);
        border-color: #ff6b6b;
      }

      .create-new-btn {
        width: 100%;
        text-align: left;
        color: var(--muted);
        padding: 8px;
        border-radius: 6px;
        font-size: 12px;
        margin-top: 4px;
        display: flex;
        align-items: center;
        gap: 6px;
        background: var(--panel);
        border: 1px dashed var(--line);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .create-new-btn:hover {
        background: rgba(255, 255, 255, 0.05);
        color: var(--text);
        border-color: var(--accent);
      }

      .create-new-btn::before {
        content: "+";
        font-size: 16px;
        font-weight: bold;
      }

      /* Filtered list item hover (Phase 6) */
      .filtered-item:hover {
        color: var(--accent);
        text-decoration: underline;
      }

      /* Toast notification (Phase 6) */
      .toast-container {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
      }

      .toast {
        background: var(--panel-2);
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 12px 16px;
        font-size: 13px;
        color: var(--text);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        min-width: 200px;
        max-width: 400px;
        animation: toastSlideIn 0.2s ease;
        pointer-events: auto;
      }

      .toast.success {
        border-color: #4ade80;
        background: rgba(74, 222, 128, 0.1);
      }

      .toast.error {
        border-color: #f87171;
        background: rgba(248, 113, 113, 0.1);
      }

      .toast.info {
        border-color: var(--accent);
        background: rgba(106, 201, 255, 0.1);
      }

      @keyframes toastSlideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @media (max-width: 1200px) {
        main {
          grid-template-columns: 1fr;
          grid-template-rows: auto 1fr 280px;
        }
        .splitter {
          display: none;
        }
        #detail-panel {
          grid-column: 1 / -1;
        }
      }

      /* ===== Mobile Adaptation (< 768px) ===== */

      .mobile-tab-bar {
        display: none;
      }

      .toolbar-toggle {
        display: none;
      }

      .toolbar-menu {
        display: contents;
      }

      @media (max-width: 768px) {
        :host {
          --left-w: 100% !important;
          --right-w: 100% !important;
        }

        header {
          flex-wrap: wrap;
          padding: 8px 12px;
          gap: 8px;
        }

        header h1 {
          font-size: 14px;
        }

        .pill {
          font-size: 10px;
          padding: 2px 5px;
        }

        .toolbar {
          position: relative;
          margin-left: auto;
          gap: 6px;
        }

        .toolbar-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: var(--panel-2);
          color: var(--text);
          border: 1px solid var(--line);
          border-radius: 8px;
          cursor: pointer;
          font-size: 18px;
          flex-shrink: 0;
        }

        .toolbar-toggle:hover,
        .toolbar-toggle:active {
          background: var(--panel);
          border-color: var(--accent);
        }

        .toolbar-menu {
          display: none;
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 6px;
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 8px;
          z-index: 100;
          min-width: 180px;
          flex-direction: column;
          gap: 6px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }

        .toolbar-menu.is-open {
          display: flex;
        }

        .toolbar-menu .button {
          width: 100%;
          text-align: center;
          padding: 10px 12px;
          font-size: 13px;
          min-height: 40px;
        }

        .toolbar .button-close {
          order: -1;
          width: 36px;
          height: 36px;
          padding: 0;
          font-size: 16px;
          flex-shrink: 0;
        }

        /* Mobile tab bar */
        .mobile-tab-bar {
          display: flex;
          border-bottom: 1px solid var(--line);
          background: var(--panel);
          padding: 0;
        }

        .mobile-tab {
          flex: 1;
          text-align: center;
          padding: 10px 0;
          font-size: 13px;
          font-weight: 500;
          color: var(--muted);
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .mobile-tab.is-active {
          color: var(--accent);
          border-bottom-color: var(--accent);
          background: rgba(106, 201, 255, 0.05);
        }

        .mobile-tab:active {
          background: rgba(106, 201, 255, 0.1);
        }

        /* Mobile main layout - tabbed */
        main {
          display: grid;
          grid-template-columns: 1fr !important;
          grid-template-rows: 1fr !important;
          gap: 0 !important;
          padding: 0 !important;
        }

        main > .splitter {
          display: none !important;
        }

        main > .panel,
        main > #graph {
          display: none;
          border-radius: 0;
          border: none;
          margin: 0;
          height: 100%;
          overflow: auto;
        }

        main > .panel.mobile-visible,
        main > #graph.mobile-visible {
          display: flex;
          flex-direction: column;
        }

        #left-panel.mobile-visible {
          padding: 12px;
        }

        #graph.mobile-visible {
          display: block;
          min-height: 0;
        }

        #detail-panel.mobile-visible {
          padding: 12px;
        }

        /* Touch-friendly controls */
        .button, select, input[type="text"], input[type="number"] {
          min-height: 40px;
          font-size: 14px;
          padding: 8px 12px;
        }

        .checkbox-row {
          min-height: 36px;
          font-size: 13px;
          gap: 10px;
        }

        .checkbox-row input[type="checkbox"] {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }

        .stat {
          font-size: 13px;
          padding: 6px 0;
        }

        .field label {
          font-size: 13px;
          margin-bottom: 6px;
        }

        /* Touch-friendly list items */
        .select-item {
          padding: 10px 8px;
          gap: 10px;
        }

        .select-item .item-label {
          font-size: 14px;
        }

        .select-item .item-actions {
          opacity: 1;
        }

        .icon-btn {
          width: 32px;
          height: 32px;
          min-width: 32px;
          font-size: 16px;
        }

        .create-new-btn {
          min-height: 40px;
          font-size: 13px;
          padding: 10px;
        }

        /* Filtered list items - larger tap targets */
        .filtered-item {
          min-height: 32px !important;
          font-size: 13px !important;
          padding: 4px 0 !important;
          display: flex !important;
          align-items: center !important;
        }

        /* Circle/Group select items */
        .circle-select-item,
        .group-select-item,
        .circle-filter-item {
          font-size: 13px;
          padding: 6px;
          min-height: 36px;
          gap: 10px;
        }

        .circle-filter-item input[type="checkbox"] {
          width: 18px;
          height: 18px;
        }

        .collapse-toggle {
          font-size: 13px;
          min-height: 36px;
        }

        /* Graph container on mobile */
        #graph {
          border-radius: 0 !important;
          border: none !important;
          min-height: 300px;
        }

        /* Detail panel on mobile */
        .detail-title {
          font-size: 16px;
        }

        .detail-sub {
          font-size: 13px;
        }

        pre {
          font-size: 14px;
          line-height: 1.6;
        }

        /* Toast on mobile - bottom center */
        .toast-container {
          bottom: 16px;
          right: 12px;
          left: 12px;
        }

        .toast {
          font-size: 13px;
          padding: 10px 14px;
          max-width: none;
          width: 100%;
        }

        /* Usage tips adaptation */
        .mobile-tips {
          display: block;
        }
        .desktop-tips {
          display: none;
        }

        /* Group members list */
        .group-members {
          font-size: 13px;
          max-height: 200px;
        }

        /* Search inputs */
        .circle-select-search,
        .group-select-search {
          min-height: 40px;
          font-size: 14px;
        }

        /* Neighbor depth select */
        #neighborDepth {
          min-height: 40px;
          font-size: 14px;
        }
      }

      /* Desktop-only tips */
      @media (min-width: 769px) {
        .mobile-tips {
          display: none;
        }
        .desktop-tips {
          display: block;
        }
      }
    `;
  }

  /**
   * Create UI structure (Complete migration from bc-graph-viewer.html)
   */
  function createUIStructure() {
    const container = document.createElement('div');
    container.className = 'visualizer-container';
    container.innerHTML = `
      <header>
        <h1>BC 资料图查看器</h1>
        <span class="pill" id="file-status">未加载数据</span>
        <div class="toolbar">
          <button class="toolbar-toggle" id="toolbarToggle" title="菜单">☰</button>
          <div class="toolbar-menu" id="toolbarMenu">
            <button class="button button-accent" id="extractBtn">提取数据</button>
            <button class="button" id="exportMarksBtn">导出分组</button>
            <button class="button" id="importMarksBtn">导入分组</button>
            <button class="button" id="exportProfilesBtn" title="导出IndexedDB中的全部profiles原始数据">导出档案</button>
            <button class="button" id="importProfilesBtn" title="导入profiles数据并与现有数据合并（保留更新的记录）">导入档案</button>
            <button class="button button-accent" id="physicsToggleBtn" title="切换物理（空格）">开始物理</button>
            <button class="button" id="fitBtn">适配</button>
          </div>
          <button class="button button-close" id="closeBtn">关闭</button>
        </div>
      </header>
      <nav class="mobile-tab-bar" id="mobileTabBar">
        <button class="mobile-tab is-active" data-tab="left-panel">控制</button>
        <button class="mobile-tab" data-tab="graph">图谱</button>
        <button class="mobile-tab" data-tab="detail-panel">详情</button>
      </nav>
      <main>
        <section class="panel" id="left-panel">
          <div class="field">
            <label for="search">搜索</label>
            <input type="text" id="search" placeholder="姓名 / 昵称 / ID" />
          </div>

          <div class="field">
            <div class="checkbox-row">
              <input type="checkbox" id="displayNickname" />
              <label for="displayNickname">显示昵称</label>
            </div>
          </div>

          <div class="field">
            <label for="titleFilter">头衔筛选</label>
            <select id="titleFilter">
              <option value="">全部</option>
            </select>
          </div>

          <div class="field">
            <label>显示圈子</label>
            <div class="checkbox-row">
              <input type="checkbox" id="circleFilterEnabled" />
              <label for="circleFilterEnabled">显示选中圈子</label>
            </div>
            <div class="checkbox-row">
              <input type="checkbox" id="showCircleOverlay" checked />
              <label for="showCircleOverlay">显示圈子轮廓</label>
            </div>
            <div id="circleFilterList" class="muted" style="font-size:12px;">
              没有圈子
            </div>
          </div>

          <div class="field">
            <div class="checkbox-row">
              <input type="checkbox" id="showOwnership" checked />
              <label for="showOwnership">显示主仆</label>
            </div>
            <div class="checkbox-row">
              <input type="checkbox" id="showLovership" checked />
              <label for="showLovership">显示恋爱</label>
            </div>
            <div class="checkbox-row">
              <input type="checkbox" id="hideIsolated" />
              <label for="hideIsolated">隐藏孤立</label>
            </div>
          </div>

          <div class="field">
            <label for="neighborDepth">邻接深度</label>
            <select id="neighborDepth">
              <option value="1" selected>1跳</option>
              <option value="2">2跳</option>
              <option value="3">3跳</option>
            </select>
          </div>

          <div class="field">
            <label>统计</label>
            <div class="stat"><span>成员总数</span><span id="statMembers">0</span></div>
            <div class="stat"><span>主仆关系数</span><span id="statOwnership">0</span></div>
            <div class="stat"><span>恋爱关系数</span><span id="statLovership">0</span></div>
          </div>

          <div class="field">
            <label>筛选成员</label>
            <div id="filteredList" class="muted" style="font-size:12px;"></div>
          </div>

          <div class="field">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
              <label style="margin:0;">固定成员</label>
              <div style="display:flex; gap:4px;">
                <button class="button" id="pinRoomBtn" style="font-size:11px; padding:2px 6px;" title="将当前房间所有成员添加到固定列表">固定房间</button>
                <button class="button" id="clearPinnedBtn" style="font-size:11px; padding:2px 6px;" title="清除所有固定成员">清除固定</button>
              </div>
            </div>
            <div id="fixedList" class="muted" style="font-size:12px;">无固定节点</div>
          </div>

          <div class="muted desktop-tips" style="font-size:12px; margin-top: 12px;">
            <strong>使用提示：</strong><br/>
            • 双击节点固定可见性<br/>
            • 空格键切换物理引擎<br/>
            • Ctrl+Shift+V 显示/隐藏<br/>
            • 点击筛选成员跳转到节点
          </div>
          <div class="muted mobile-tips" style="font-size:12px; margin-top: 12px;">
            <strong>使用提示：</strong><br/>
            • 双击节点固定可见性<br/>
            • 双指缩放/拖动查看图谱<br/>
            • 点击筛选成员跳转到节点<br/>
            • 使用顶部标签切换面板
          </div>
        </section>

        <div class="splitter" id="splitter-left" title="拖动调整大小"></div>

        <section id="graph"></section>

        <div class="splitter" id="splitter-right" title="拖动调整大小"></div>

        <section class="panel" id="detail-panel">
          <div id="detail-empty" class="muted">选择节点查看详情。</div>
          <div id="detail" style="display:none;">
            <h2 class="detail-title" id="detailName"></h2>
            <div class="detail-sub" id="detailMeta"></div>
            <div class="field">
              <label>主仆</label>
              <div id="detailOwnership" class="muted"></div>
            </div>
            <div class="field">
              <label>恋爱</label>
              <div id="detailLovership" class="muted"></div>
            </div>
            <div class="field" id="groupSection">
              <div class="field-header">
                <button class="collapse-toggle" id="groupToggleBtn" type="button">
                  <span class="chevron" aria-hidden="true">v</span>
                  <span>同一人分组</span>
                </button>
                <button class="button" id="groupClearBtn" type="button">清除</button>
              </div>
              <div class="field-body" id="groupSectionBody">
                <div class="group-select-wrap">
                  <input type="text" id="groupSearch" class="group-select-search" placeholder="筛选分组" />
                  <div id="groupSelectList" class="group-select-list muted" style="font-size:12px;">
                    没有分组
                  </div>
                </div>
                <div class="group-members" id="groupMemberList"></div>
              </div>
            </div>

            <div class="field" id="circleSection">
              <div class="field-header">
                <button class="collapse-toggle" id="circleToggleBtn" type="button">
                  <span class="chevron" aria-hidden="true">v</span>
                  <span>社交圈</span>
                </button>
              </div>
              <div class="field-body" id="circleSectionBody">
                <div class="circle-select-wrap">
                  <input type="text" id="circleSearch" class="circle-select-search" placeholder="筛选圈子" />
                  <div id="circleSelectList" class="circle-select-list muted" style="font-size:12px;">
                    没有圈子
                  </div>
                </div>
                <div class="group-members" id="circleMemberList"></div>
              </div>
            </div>

            <div class="field detail-description">
              <label>描述</label>
              <pre id="detailDesc"></pre>
            </div>

          </div>
        </section>
      </main>
    `;
    
    shadowRoot.appendChild(container);
  }

  /**
   * Setup event listeners (Phase 4 - with graph rendering)
   */
  function setupEventListeners() {
    const extractBtn = shadowRoot.getElementById('extractBtn');
    const physicsToggleBtn = shadowRoot.getElementById('physicsToggleBtn');
    const closeBtn = shadowRoot.getElementById('closeBtn');
    const fitBtn = shadowRoot.getElementById('fitBtn');
    const fileStatus = shadowRoot.getElementById('file-status');
    const exportMarksBtn = shadowRoot.getElementById('exportMarksBtn');
    const importMarksBtn = shadowRoot.getElementById('importMarksBtn');
    const exportProfilesBtn = shadowRoot.getElementById('exportProfilesBtn');
    const importProfilesBtn = shadowRoot.getElementById('importProfilesBtn');
    const searchInput = shadowRoot.getElementById('search');
    const displayNickname = shadowRoot.getElementById('displayNickname');
    const titleFilter = shadowRoot.getElementById('titleFilter');
    const showOwnership = shadowRoot.getElementById('showOwnership');
    const showLovership = shadowRoot.getElementById('showLovership');
    const hideIsolated = shadowRoot.getElementById('hideIsolated');

    // ---- Mobile toolbar toggle ----
    const toolbarToggle = shadowRoot.getElementById('toolbarToggle');
    const toolbarMenu = shadowRoot.getElementById('toolbarMenu');
    if (toolbarToggle && toolbarMenu) {
      toolbarToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toolbarMenu.classList.toggle('is-open');
      });
      // Close menu when clicking outside
      shadowRoot.addEventListener('click', (e) => {
        if (!toolbarToggle.contains(e.target) && !toolbarMenu.contains(e.target)) {
          toolbarMenu.classList.remove('is-open');
        }
      });
      // Close menu after clicking a button inside
      toolbarMenu.querySelectorAll('.button').forEach(btn => {
        btn.addEventListener('click', () => {
          toolbarMenu.classList.remove('is-open');
        });
      });
    }

    // ---- Mobile tab navigation ----
    const mobileTabBar = shadowRoot.getElementById('mobileTabBar');
    if (mobileTabBar) {
      const tabs = mobileTabBar.querySelectorAll('.mobile-tab');

      tabs.forEach(tab => {
        tab.addEventListener('click', () => switchToMobileTab(tab.dataset.tab));
      });

      // Initialize: show left-panel on mobile by default
      function initMobileTabs() {
        if (window.matchMedia('(max-width: 768px)').matches) {
          switchToMobileTab('left-panel');
        } else {
          // On desktop, remove mobile-visible classes so normal grid works
          ['left-panel', 'graph', 'detail-panel'].forEach(id => {
            const p = shadowRoot.getElementById(id);
            if (p) p.classList.remove('mobile-visible');
          });
        }
      }

      // React to orientation/resize changes
      const mobileMediaQuery = window.matchMedia('(max-width: 768px)');
      const handleMobileChange = (e) => {
        if (e.matches) {
          const activeTab = mobileTabBar.querySelector('.mobile-tab.is-active');
          switchToMobileTab(activeTab ? activeTab.dataset.tab : 'left-panel');
        } else {
          ['left-panel', 'graph', 'detail-panel'].forEach(id => {
            const p = shadowRoot.getElementById(id);
            if (p) p.classList.remove('mobile-visible');
          });
        }
      };
      if (mobileMediaQuery.addEventListener) {
        mobileMediaQuery.addEventListener('change', handleMobileChange);
      } else {
        mobileMediaQuery.addListener(handleMobileChange);
      }

      initMobileTabs();
    }

    // Extract data button
    extractBtn.addEventListener('click', async () => {
      try {
        // Check if vis-network is available
        if (!isVisNetworkReady()) {
          showToast('vis-network 库未加载，无法显示图形。请刷新页面重试。', 'error', 5000);
          return;
        }
        
        showLoadingOverlay('提取数据中...');
        const data = await getData(true, (msg) => {
          updateLoadingMessage(msg);
        });
        
        // Build graph data
        buildData(data);
        
        // Initial render
        usePhysics = true;
        applyFilters();
        
        hideLoadingOverlay();
        fileStatus.textContent = `已加载 ${data.length} 条记录`;
        fileStatus.className = 'pill';
        console.log('[BC-Bio-Visualizer] Graph rendered successfully');

        // Auto-switch to graph tab on mobile after extraction
        if (window.matchMedia('(max-width: 768px)').matches) {
          switchToMobileTab('graph');
        }
      } catch (error) {
        hideLoadingOverlay();
        fileStatus.textContent = '数据提取失败';
        console.error('[BC-Bio-Visualizer] Extraction error:', error);
        showToast('数据提取失败: ' + error.message, 'error', 5000);
      }
    });

    // Physics toggle
    physicsToggleBtn.addEventListener('click', () => {
      usePhysics = !usePhysics;
      updatePhysicsButton();
      if (network) {
        if (usePhysics) {
          network.setOptions({ physics: { enabled: true, solver: "barnesHut", stabilization: { iterations: 200, updateInterval: 20 }, barnesHut: { gravitationalConstant: -12000, springLength: 100, springConstant: 0.012, damping: 0.4 }, minVelocity: 1, maxVelocity: 30 } });
          network.once("stabilizationIterationsDone", () => {
            network.setOptions({ physics: { enabled: false } });
            usePhysics = false;
            updatePhysicsButton();
          });
        } else {
          network.setOptions({ physics: { enabled: false } });
        }
      }
    });

    // Fit button
    fitBtn.addEventListener('click', () => {
      if (network) {
        network.fit({ animation: true, animationDuration: 500 });
      }
    });

    // Export marks
    exportMarksBtn.addEventListener('click', async () => {
      try {
        // Calculate statistics
        const groupCount = Object.keys(markData.groups).length;
        const circleCount = Object.keys(markData.circles).length;
        const markedNodeCount = Object.keys(markData.nodeToGroup).length;
        const circleNodeCount = Object.keys(markData.nodeToCircles).length;
        const pinnedNodeCount = pinnedNodes.size;

        const payload = {
          version: MARK_DATA_VERSION,
          exportDate: new Date().toISOString(),
          statistics: {
            groups: groupCount,
            circles: circleCount,
            markedNodes: markedNodeCount,
            circleNodes: circleNodeCount,
            pinnedNodes: pinnedNodeCount
          },
          nodeToGroup: markData.nodeToGroup,
          groups: markData.groups,
          nodeToCircles: markData.nodeToCircles,
          circles: markData.circles,
          pinnedNodes: Array.from(pinnedNodes)
        };
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        a.download = `bc-marks-${groupCount}groups-${circleCount}circles-${timestamp}.json`;
        a.click();
        URL.revokeObjectURL(url);
        console.log('[BC-Bio-Visualizer] Marks exported:', payload.statistics);
        showToast(`导出成功！${groupCount}个分组、${circleCount}个社交圈`, 'success');
      } catch (error) {
        console.error('[BC-Bio-Visualizer] Export error:', error);
        showToast('导出失败: ' + error.message, 'error');
      }
    });

    // Import marks
    importMarksBtn.addEventListener('click', () => {
      // Create hidden file input
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json';
      fileInput.style.display = 'none';
      
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          const normalized = normalizeMarkData(parsed);
          
          // Count items being imported
          const importGroupCount = Object.keys(normalized.groups).length;
          const importCircleCount = Object.keys(normalized.circles).length;
          const importMarkedNodes = Object.keys(normalized.nodeToGroup).length;
          const importCircleNodes = Object.keys(normalized.nodeToCircles).length;
          const importPinnedNodes = normalized.pinnedNodes.length;
          
          console.log('[BC-Bio-Visualizer] Importing:', {
            groups: importGroupCount,
            circles: importCircleCount,
            markedNodes: importMarkedNodes,
            circleNodes: importCircleNodes,
            pinnedNodes: importPinnedNodes,
            version: normalized.version,
            exportDate: parsed.exportDate || 'unknown'
          });
          
          // Merge with existing data
          markData.nodeToGroup = { ...markData.nodeToGroup, ...normalized.nodeToGroup };
          markData.groups = { ...markData.groups, ...normalized.groups };
          markData.nodeToCircles = { ...markData.nodeToCircles, ...normalized.nodeToCircles };
          markData.circles = { ...markData.circles, ...normalized.circles };
          
          // Merge pinned nodes (consistent with other data merging)
          if (Array.isArray(normalized.pinnedNodes)) {
            normalized.pinnedNodes.forEach(id => pinnedNodes.add(String(id)));
          }
          
          await saveMarkData();
          renderPinnedList();
          renderCircleFilters(null);
          useIncrementalUpdate = true;
          invalidateGraph();
          useIncrementalUpdate = false;
          
          console.log('[BC-Bio-Visualizer] Import completed successfully');
          showToast(`导入成功！${importGroupCount}个分组、${importCircleCount}个社交圈已合并`, 'success', 4000);
        } catch (error) {
          console.error('[BC-Bio-Visualizer] Import error:', error);
          showToast('导入失败: ' + error.message, 'error');
        }
        
        fileInput.remove();
      });
      
      document.body.appendChild(fileInput);
      fileInput.click();
    });

    // Export profiles data
    exportProfilesBtn.addEventListener('click', async () => {
      try {
        showToast('正在读取档案数据...', 'info', 2000);
        const raw = await readAllFromStore(CONFIG.DB_NAME, CONFIG.STORE_NAME);
        if (raw.length === 0) {
          showToast('没有档案数据可导出', 'error');
          return;
        }
        const payload = {
          type: 'bc-bio-profiles',
          version: 1,
          exportDate: new Date().toISOString(),
          count: raw.length,
          profiles: raw
        };
        const json = JSON.stringify(payload);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        a.download = `bc-profiles-${raw.length}records-${timestamp}.json`;
        a.click();
        URL.revokeObjectURL(url);
        console.log(`[BC-Bio-Visualizer] Profiles exported: ${raw.length} records`);
        showToast(`导出成功！共 ${raw.length} 条档案记录`, 'success');
      } catch (error) {
        console.error('[BC-Bio-Visualizer] Profiles export error:', error);
        showToast('档案导出失败: ' + error.message, 'error');
      }
    });

    // Import profiles data
    importProfilesBtn.addEventListener('click', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json';
      fileInput.style.display = 'none';

      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        try {
          showToast('正在读取文件...', 'info', 2000);
          const text = await file.text();
          const parsed = JSON.parse(text);

          // Validate data format
          let profiles;
          if (parsed.type === 'bc-bio-profiles' && Array.isArray(parsed.profiles)) {
            profiles = parsed.profiles;
          } else if (Array.isArray(parsed)) {
            // Support raw array format
            profiles = parsed;
          } else {
            showToast('无效的档案数据格式', 'error');
            fileInput.remove();
            return;
          }

          // Validate records have memberNumber
          const validProfiles = profiles.filter(p => p.memberNumber !== undefined && p.memberNumber !== null);
          if (validProfiles.length === 0) {
            showToast('文件中没有有效的档案记录', 'error');
            fileInput.remove();
            return;
          }

          console.log(`[BC-Bio-Visualizer] Importing ${validProfiles.length} profiles (from ${profiles.length} total)...`);
          showToast(`正在合并 ${validProfiles.length} 条档案记录...`, 'info', 3000);

          const result = await mergeProfilesIntoStore(
            CONFIG.DB_NAME,
            CONFIG.STORE_NAME,
            validProfiles,
            (msg) => console.log('[BC-Bio-Visualizer]', msg)
          );

          // Invalidate cache so next extract picks up new data
          cachedData = null;
          cacheTimestamp = null;

          console.log('[BC-Bio-Visualizer] Profiles import completed:', result);
          showToast(
            `导入完成！新增 ${result.added}，更新 ${result.updated}，跳过 ${result.skipped} 条记录`,
            'success',
            5000
          );
        } catch (error) {
          console.error('[BC-Bio-Visualizer] Profiles import error:', error);
          showToast('档案导入失败: ' + error.message, 'error');
        }

        fileInput.remove();
      });

      document.body.appendChild(fileInput);
      fileInput.click();
    });

    // Pin room members button
    const pinRoomBtn = shadowRoot.getElementById('pinRoomBtn');
    if (pinRoomBtn) {
      pinRoomBtn.addEventListener('click', () => {
        if (typeof ChatRoomCharacter === 'undefined' || !Array.isArray(ChatRoomCharacter)) {
          showToast('未检测到聊天室成员数据 (ChatRoomCharacter)，请确保您在聊天室中', 'error', 4000);
          return;
        }
        const memberNumbers = ChatRoomCharacter
          .map(i => i.MemberNumber)
          .filter(n => n !== undefined && n !== null);
        if (memberNumbers.length === 0) {
          showToast('当前房间没有成员', 'error', 3000);
          return;
        }
        let addedCount = 0;
        memberNumbers.forEach(num => {
          const id = String(num);
          if (!pinnedNodes.has(id)) {
            pinnedNodes.add(id);
            addedCount++;
          }
        });
        saveMarkData();
        renderPinnedList();
        useIncrementalUpdate = true;
        invalidateGraph();
        useIncrementalUpdate = false;
        showToast(`已固定 ${addedCount} 个房间成员 (共 ${memberNumbers.length} 人在房间)`, 'success', 3000);
        console.log('[BC-Bio-Visualizer] Pinned room members:', memberNumbers);
      });
    }

    // Clear all pinned nodes button
    const clearPinnedBtn = shadowRoot.getElementById('clearPinnedBtn');
    if (clearPinnedBtn) {
      clearPinnedBtn.addEventListener('click', () => {
        if (pinnedNodes.size === 0) {
          showToast('没有固定成员需要清除', 'info', 2000);
          return;
        }
        const count = pinnedNodes.size;
        pinnedNodes.clear();
        saveMarkData();
        renderPinnedList();
        useIncrementalUpdate = true;
        invalidateGraph();
        useIncrementalUpdate = false;
        showToast(`已清除 ${count} 个固定成员`, 'success', 3000);
        console.log('[BC-Bio-Visualizer] Cleared all pinned nodes');
      });
    }

    // Close button
    closeBtn.addEventListener('click', hideVisualizer);

    // Search input with debounce
    if (searchInput) {
      searchInput.addEventListener('input', debounce(() => {
        console.log('[BC-Bio-Visualizer] Search:', searchInput.value);
        applyFilters();
      }, 300));
    }

    // Display nickname toggle
    if (displayNickname) {
      displayNickname.addEventListener('change', () => {
        // Rebuild labels
        allNodes = allNodes.map(n => {
          const m = membersById.get(n.id);
          if (!m) return n;
          const name = (displayNickname.checked && m.nickname) ? m.nickname : (m.name || '未知');
          return { ...n, label: `${name} (#${n.id})` };
        });
        currentGraphSignature = ''; // Force re-render
        useIncrementalUpdate = true;
        applyFilters();
        useIncrementalUpdate = false;
      });
    }

    // Title filter
    if (titleFilter) {
      titleFilter.addEventListener('change', () => {
        applyFilters();
      });
    }

    // Relationship filters
    [showOwnership, showLovership, hideIsolated].forEach(el => {
      if (el) {
        el.addEventListener('change', () => {
          applyFilters();
        });
      }
    });

    // Neighbor depth filter
    const neighborDepthEl = shadowRoot.getElementById('neighborDepth');
    if (neighborDepthEl) {
      neighborDepthEl.addEventListener('change', () => {
        applyFilters();
      });
    }

    // Circle filter listeners
    const circleFilterEnabled = shadowRoot.getElementById('circleFilterEnabled');
    const circleFilterList = shadowRoot.getElementById('circleFilterList');

    if (circleFilterEnabled) {
      circleFilterEnabled.addEventListener('change', () => {
        applyFilters();
      });
    }

    if (circleFilterList) {
      circleFilterList.addEventListener('change', (event) => {
        const target = event.target;
        if (!target || !target.dataset) return;
        const id = target.dataset.id;
        if (!id) return;
        if (target.checked) {
          circleFilterSelected.add(id);
        } else {
          circleFilterSelected.delete(id);
        }
        applyFilters();
      });
    }

    // Circle overlay toggle
    const showCircleOverlay = shadowRoot.getElementById('showCircleOverlay');
    if (showCircleOverlay) {
      showCircleOverlay.addEventListener('change', () => {
        if (network) network.redraw();
      });
    }

    // Group management event listeners (Phase 6)
    const groupSelectList = shadowRoot.getElementById('groupSelectList');
    const groupSearch = shadowRoot.getElementById('groupSearch');

    if (groupSelectList) {
      // Radio button change - assign group
      groupSelectList.addEventListener("change", (event) => {
        const target = event.target;
        if (!target || target.type !== "radio") return;
        if (!selectedNodeId) return;
        
        const item = target.closest('.select-item');
        const groupId = item ? item.dataset.id : null;
        
        if (groupId) {
          markData.nodeToGroup[String(selectedNodeId)] = groupId;
        } else {
          delete markData.nodeToGroup[String(selectedNodeId)];
        }
        saveMarkData();
        updateMarkUI(selectedNodeId);
        useIncrementalUpdate = true;
        invalidateGraph();
        useIncrementalUpdate = false;
      });

      // Button clicks - CRUD operations
      groupSelectList.addEventListener("click", (event) => {
        const target = event.target;
        if (!target) return;
        
        const action = target.dataset.action;
        const item = target.closest('.select-item');
        
        if (action === 'start-create') {
          creatingGroup = true;
          renderGroupSelect(selectedNodeId);
          return;
        }
        
        if (action === 'create') {
          const input = item.querySelector('.item-input');
          const name = input.value.trim();
          if (!name) return;
          
          const id = `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
          markData.groups[id] = { name, notes: "" };
          markData.nodeToGroup[String(selectedNodeId)] = id;
          saveMarkData();
          creatingGroup = false;
          updateMarkUI(selectedNodeId);
          useIncrementalUpdate = true;
          invalidateGraph();
          useIncrementalUpdate = false;
          return;
        }
        
        if (action === 'cancel-create') {
          creatingGroup = false;
          renderGroupSelect(selectedNodeId);
          return;
        }
        
        if (!item || !item.dataset.id) return;
        const groupId = item.dataset.id;
        
        if (action === 'edit') {
          editingGroupId = groupId;
          renderGroupSelect(selectedNodeId);
          return;
        }
        
        if (action === 'save') {
          const input = item.querySelector('.item-input');
          const newName = input.value.trim();
          if (!newName) return;
          
          markData.groups[groupId].name = newName;
          saveMarkData();
          editingGroupId = null;
          updateMarkUI(selectedNodeId);
          useIncrementalUpdate = true;
          invalidateGraph();
          useIncrementalUpdate = false;
          return;
        }
        
        if (action === 'cancel') {
          editingGroupId = null;
          renderGroupSelect(selectedNodeId);
          return;
        }
        
        if (action === 'delete') {
          const groupName = markData.groups[groupId].name;
          if (!confirm(`删除分组 "${groupName}"？\n这将取消所有节点的该分组分配。`)) return;
          
          // Remove all node assignments
          Object.keys(markData.nodeToGroup).forEach(id => {
            if (markData.nodeToGroup[id] === groupId) {
              delete markData.nodeToGroup[id];
            }
          });
          delete markData.groups[groupId];
          saveMarkData();
          updateMarkUI(selectedNodeId);
          useIncrementalUpdate = true;
          invalidateGraph();
          useIncrementalUpdate = false;
          showToast(`分组 "${groupName}" 已删除`, 'success');
          return;
        }

        // Focus group on click
        if (item && !action) {
          if (target.tagName !== "INPUT" && target.tagName !== "BUTTON") {
            focusedGroupId = groupId;
            renderGroupSelect(selectedNodeId);
          }
        }
      });

      // Keyboard shortcuts in group list
      groupSelectList.addEventListener("keydown", (event) => {
        if (event.key === 'Enter') {
          const target = event.target;
          if (target.classList.contains('item-input')) {
            const item = target.closest('.select-item');
            const saveBtn = item.querySelector('[data-action="save"], [data-action="create"]');
            if (saveBtn) saveBtn.click();
          }
        }
        if (event.key === 'Escape') {
          const target = event.target;
          if (target.classList.contains('item-input')) {
            const item = target.closest('.select-item');
            const cancelBtn = item.querySelector('[data-action="cancel"], [data-action="cancel-create"]');
            if (cancelBtn) cancelBtn.click();
          }
        }
      });
    }

    // Group search input
    if (groupSearch) {
      groupSearch.addEventListener("input", () => {
        renderGroupSelect(selectedNodeId);
      });
    }

    // Circle management event listeners
    const circleSelectList = shadowRoot.getElementById('circleSelectList');
    const circleSearch = shadowRoot.getElementById('circleSearch');

    if (circleSelectList) {
      // Checkbox change - assign/unassign circle
      circleSelectList.addEventListener("change", (event) => {
        const target = event.target;
        if (!target || target.type !== "checkbox") return;
        if (!selectedNodeId) return;
        
        const item = target.closest('.select-item');
        const circleId = item ? item.dataset.id : null;
        if (!circleId) return;
        
        const existing = new Set(markData.nodeToCircles[String(selectedNodeId)] || []);
        
        if (target.checked) {
          existing.add(circleId);
        } else {
          existing.delete(circleId);
        }
        
        if (existing.size) {
          markData.nodeToCircles[String(selectedNodeId)] = Array.from(existing);
        } else {
          delete markData.nodeToCircles[String(selectedNodeId)];
        }
        
        saveMarkData();
        renderCircleFilters();
        updateMarkUI(selectedNodeId);
        useIncrementalUpdate = true;
        invalidateGraph();
        useIncrementalUpdate = false;
      });

      // Button clicks - CRUD operations
      circleSelectList.addEventListener("click", (event) => {
        const target = event.target;
        if (!target) return;
        
        const action = target.dataset.action;
        const item = target.closest('.select-item');
        
        if (action === 'start-create') {
          creatingCircle = true;
          renderCircleSelect(selectedNodeId);
          return;
        }
        
        if (action === 'create') {
          const input = item.querySelector('.item-input');
          const name = input.value.trim();
          if (!name) return;
          
          const id = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
          markData.circles[id] = { name, notes: "", children: [] };
          const existing = new Set(markData.nodeToCircles[String(selectedNodeId)] || []);
          existing.add(id);
          markData.nodeToCircles[String(selectedNodeId)] = Array.from(existing);
          saveMarkData();
          creatingCircle = false;
          renderCircleFilters();
          updateMarkUI(selectedNodeId);
          useIncrementalUpdate = true;
          invalidateGraph();
          useIncrementalUpdate = false;
          return;
        }
        
        if (action === 'cancel-create') {
          creatingCircle = false;
          renderCircleSelect(selectedNodeId);
          return;
        }
        
        if (!item || !item.dataset.id) return;
        const circleId = item.dataset.id;
        
        if (action === 'edit') {
          editingCircleId = circleId;
          renderCircleSelect(selectedNodeId);
          return;
        }
        
        if (action === 'save') {
          const input = item.querySelector('.item-input');
          const newName = input.value.trim();
          if (!newName) return;
          
          markData.circles[circleId].name = newName;
          saveMarkData();
          editingCircleId = null;
          renderCircleFilters();
          updateMarkUI(selectedNodeId);
          useIncrementalUpdate = true;
          invalidateGraph();
          useIncrementalUpdate = false;
          return;
        }
        
        if (action === 'cancel') {
          editingCircleId = null;
          renderCircleSelect(selectedNodeId);
          return;
        }
        
        if (action === 'delete') {
          if (!confirm(`删除圈子 "${markData.circles[circleId].name}"？`)) return;
          
          Object.values(markData.circles).forEach(circle => {
            if (!circle || !Array.isArray(circle.children)) return;
            circle.children = circle.children.filter(childId => String(childId) !== String(circleId));
          });
          
          Object.keys(markData.nodeToCircles).forEach(id => {
            const list = markData.nodeToCircles[id];
            if (!Array.isArray(list)) return;
            const next = list.filter(c => c !== circleId);
            if (next.length) {
              markData.nodeToCircles[id] = next;
            } else {
              delete markData.nodeToCircles[id];
            }
          });
          delete markData.circles[circleId];
          saveMarkData();
          renderCircleFilters();
          updateMarkUI(selectedNodeId);
          useIncrementalUpdate = true;
          invalidateGraph();
          useIncrementalUpdate = false;
          return;
        }

        if (item && !action) {
          if (target.tagName !== "INPUT" && target.tagName !== "BUTTON") {
            focusedCircleId = circleId;
            renderCircleSelect(selectedNodeId);
          }
        }
      });

      // Drag-and-drop for circle hierarchy
      function clearCircleDropTargets() {
        circleSelectList.querySelectorAll('.is-drop-target').forEach(el => el.classList.remove('is-drop-target'));
      }

      circleSelectList.addEventListener("dragstart", (event) => {
        const item = event.target.closest('.select-item');
        if (!item || !item.dataset.id) return;
        if (editingCircleId || creatingCircle) return;
        dragCircleId = item.dataset.id;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', dragCircleId);
      });

      circleSelectList.addEventListener("dragover", (event) => {
        if (!dragCircleId) return;
        const targetItem = event.target.closest('.select-item');
        const rootDrop = event.target.closest('.tree-root-drop');
        if (!targetItem && !rootDrop) return;
        event.preventDefault();
        clearCircleDropTargets();
        if (targetItem) targetItem.classList.add('is-drop-target');
        if (rootDrop) rootDrop.classList.add('is-drop-target');
      });

      circleSelectList.addEventListener("dragleave", (event) => {
        const targetItem = event.target.closest('.select-item');
        const rootDrop = event.target.closest('.tree-root-drop');
        if (targetItem && !targetItem.contains(event.relatedTarget)) {
          targetItem.classList.remove('is-drop-target');
        }
        if (rootDrop && !rootDrop.contains(event.relatedTarget)) {
          rootDrop.classList.remove('is-drop-target');
        }
      });

      circleSelectList.addEventListener("drop", (event) => {
        if (!dragCircleId) return;
        event.preventDefault();
        const targetItem = event.target.closest('.select-item');
        const rootDrop = event.target.closest('.tree-root-drop');
        const targetId = targetItem ? targetItem.dataset.id : null;

        const { parentById, childrenById } = buildCircleForest(markData.circles);
        const descendants = getCircleDescendants(dragCircleId, childrenById);

        if (rootDrop) {
          setCircleParent(dragCircleId, null, parentById);
        } else if (targetId && targetId !== dragCircleId && !descendants.has(targetId)) {
          setCircleParent(dragCircleId, targetId, parentById);
        }

        dragCircleId = null;
        clearCircleDropTargets();
        saveMarkData();
        renderCircleSelect(selectedNodeId);
        renderCircleFilters();
        useIncrementalUpdate = true;
        invalidateGraph();
        useIncrementalUpdate = false;
      });

      circleSelectList.addEventListener("dragend", () => {
        dragCircleId = null;
        clearCircleDropTargets();
      });

      // Keyboard shortcuts in circle list
      circleSelectList.addEventListener("keydown", (event) => {
        if (event.key === 'Enter') {
          const target = event.target;
          if (target.classList.contains('item-input')) {
            const item = target.closest('.select-item');
            const saveBtn = item.querySelector('[data-action="save"], [data-action="create"]');
            if (saveBtn) saveBtn.click();
          }
        }
        if (event.key === 'Escape') {
          const target = event.target;
          if (target.classList.contains('item-input')) {
            const item = target.closest('.select-item');
            const cancelBtn = item.querySelector('[data-action="cancel"], [data-action="cancel-create"]');
            if (cancelBtn) cancelBtn.click();
          }
        }
      });
    }

    // Circle search input
    if (circleSearch) {
      circleSearch.addEventListener("input", () => {
        renderCircleSelect(selectedNodeId);
      });
    }

    // Setup collapse/expand functionality
    function setupCollapse(sectionEl, toggleBtn, bodyEl) {
      if (!sectionEl || !toggleBtn || !bodyEl) return;
      toggleBtn.addEventListener("click", () => {
        const isCollapsed = sectionEl.classList.toggle("is-collapsed");
        const chevron = toggleBtn.querySelector(".chevron");
        if (chevron) chevron.textContent = isCollapsed ? ">" : "v";
      });
    }

    const groupSection = shadowRoot.getElementById('groupSection');
    const groupToggleBtn = shadowRoot.getElementById('groupToggleBtn');
    const groupSectionBody = shadowRoot.getElementById('groupSectionBody');
    const circleSection = shadowRoot.getElementById('circleSection');
    const circleToggleBtn = shadowRoot.getElementById('circleToggleBtn');
    const circleSectionBody = shadowRoot.getElementById('circleSectionBody');

    setupCollapse(groupSection, groupToggleBtn, groupSectionBody);
    setupCollapse(circleSection, circleToggleBtn, circleSectionBody);

    // Group clear button
    const groupClearBtn = shadowRoot.getElementById('groupClearBtn');
    if (groupClearBtn) {
      groupClearBtn.addEventListener("click", () => {
        if (!selectedNodeId) return;
        delete markData.nodeToGroup[String(selectedNodeId)];
        saveMarkData();
        updateMarkUI(selectedNodeId);
        useIncrementalUpdate = true;
        invalidateGraph();
        useIncrementalUpdate = false;
      });
    }

    // Splitter drag functionality (Phase 6)
    const splitterLeft = shadowRoot.getElementById('splitter-left');
    const splitterRight = shadowRoot.getElementById('splitter-right');
    let isDraggingSplitter = false;
    let draggingSide = null;

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function beginSplitterDrag(side) {
      // Skip on mobile
      if (window.matchMedia("(max-width: 1200px)").matches) return;
      isDraggingSplitter = true;
      draggingSide = side;
      document.body.style.cursor = "col-resize";
    }

    function endSplitterDrag() {
      if (!isDraggingSplitter) return;
      isDraggingSplitter = false;
      draggingSide = null;
      document.body.style.cursor = "";
    }

    function handleSplitterMove(event) {
      if (!isDraggingSplitter) return;
      const main = shadowRoot.querySelector("main");
      if (!main) return;
      
      const rect = main.getBoundingClientRect();
      const minLeft = 200;
      const minRight = 260;
      const maxLeft = rect.width - minRight - 80;
      const maxRight = rect.width - minLeft - 80;

      if (draggingSide === "left") {
        const nextLeft = clamp(event.clientX - rect.left, minLeft, maxLeft);
        shadowRoot.host.style.setProperty("--left-w", `${nextLeft}px`);
      }

      if (draggingSide === "right") {
        const nextRight = clamp(rect.right - event.clientX, minRight, maxRight);
        shadowRoot.host.style.setProperty("--right-w", `${nextRight}px`);
      }
    }

    if (splitterLeft) {
      splitterLeft.addEventListener("mousedown", () => beginSplitterDrag("left"));
    }
    if (splitterRight) {
      splitterRight.addEventListener("mousedown", () => beginSplitterDrag("right"));
    }
    
    document.addEventListener("mousemove", handleSplitterMove);
    document.addEventListener("mouseup", endSplitterDrag);
  }

  // ============================================================================
  // STATE MANAGEMENT (Phase 5)
  // ============================================================================

  /**
   * Switch to a specific mobile tab (used by various handlers)
   */
  function switchToMobileTab(tabId) {
    if (!shadowRoot) return;
    const mobileTabBar = shadowRoot.getElementById('mobileTabBar');
    if (!mobileTabBar) return;
    const tabs = mobileTabBar.querySelectorAll('.mobile-tab');
    const panelIds = ['left-panel', 'graph', 'detail-panel'];
    tabs.forEach(t => t.classList.toggle('is-active', t.dataset.tab === tabId));
    panelIds.forEach(id => {
      const panel = shadowRoot.getElementById(id);
      if (panel) panel.classList.toggle('mobile-visible', id === tabId);
    });
    if (tabId === 'graph' && network) {
      setTimeout(() => network.redraw(), 50);
    }
  }

  let rawMembers = [];
  let membersById = new Map();
  let allNodes = [];
  let allEdges = [];
  let selectedNodeId = null;
  let currentGraphSignature = "";
  let manualPhysicsEnabled = false;
  let usePhysics = false;
  let lastVisibleNodeCount = 0;
  let pinnedNodes = new Set();
  let groupMembersByNode = new Map();
  let circleMembersByNode = new Map();
  let circleFilterSelected = new Set();
  let isRerendering = false; // guard against setData-triggered deselect
  let useIncrementalUpdate = false; // flag to use incremental DataSet updates (no physics/fit/setData)
  let currentNodeDataSet = null;
  let currentEdgeDataSet = null;
  let lastRenderedSelectedNodeId = null;

  // Mark data structure
  const MARK_DATA_VERSION = 2;
  let markData = {
    version: MARK_DATA_VERSION,
    nodeToGroup: {},
    groups: {},
    nodeToCircles: {},
    circles: {},
    pinnedNodes: []
  };

  // Group management UI state
  let editingGroupId = null;
  let creatingGroup = false;
  let focusedGroupId = null;

  // Circle management UI state
  let editingCircleId = null;
  let creatingCircle = false;
  let focusedCircleId = null;
  let dragCircleId = null;
  let circleOverlayEntries = [];

  // ============================================================================
  // MARK DATA MANAGEMENT (Phase 5)
  // ============================================================================

  /**
   * Safe text conversion
   */
  function safeText(value) {
    if (value === null || value === undefined) return "";
    return String(value);
  }

  /**
   * Show toast notification (Phase 6)
   */
  function showToast(message, type = 'info', duration = 3000) {
    let toastContainer = shadowRoot.querySelector('.toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      shadowRoot.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  /**
   * Normalize mark data structure
   */
  function normalizeMarkData(parsed) {
    const base = {
      version: MARK_DATA_VERSION,
      nodeToGroup: {},
      groups: {},
      nodeToCircles: {},
      circles: {},
      pinnedNodes: []
    };
    
    if (!parsed || typeof parsed !== "object") return base;
    
    const nodeToGroup = parsed.nodeToGroup && typeof parsed.nodeToGroup === "object" ? parsed.nodeToGroup : {};
    const groups = parsed.groups && typeof parsed.groups === "object" ? parsed.groups : {};
    const nodeToCircles = parsed.nodeToCircles && typeof parsed.nodeToCircles === "object" ? parsed.nodeToCircles : {};
    const rawCircles = parsed.circles && typeof parsed.circles === "object" ? parsed.circles : {};
    
    const circles = {};
    Object.entries(rawCircles).forEach(([id, circle]) => {
      const safeCircle = circle && typeof circle === "object" ? circle : {};
      const children = Array.isArray(safeCircle.children)
        ? safeCircle.children.map(child => String(child)).filter(child => child && child !== String(id))
        : [];
      circles[id] = { ...safeCircle, children };
    });
    
    const pinnedNodesArray = Array.isArray(parsed.pinnedNodes) ? parsed.pinnedNodes : [];
    
    return { ...base, nodeToGroup, groups, nodeToCircles, circles, pinnedNodes: pinnedNodesArray };
  }

  /**
   * Load mark data from storage
   */
  async function loadMarkData() {
    try {
      pinnedNodes.clear();
      const raw = await Storage.get(CONFIG.STORAGE_KEY, '{}');
      if (!raw || raw === '{}') return normalizeMarkData(null);
      
      const parsed = JSON.parse(raw);
      const normalized = normalizeMarkData(parsed);
      
      // Restore pinned nodes Set
      if (Array.isArray(normalized.pinnedNodes)) {
        normalized.pinnedNodes.forEach(id => pinnedNodes.add(String(id)));
      }
      
      return normalized;
    } catch (err) {
      console.error('[BC-Bio-Visualizer] Load mark data error:', err);
      return normalizeMarkData(null);
    }
  }

  /**
   * Save mark data to storage
   */
  async function saveMarkData() {
    try {
      markData.pinnedNodes = Array.from(pinnedNodes);
      const json = JSON.stringify(markData);
      await Storage.set(CONFIG.STORAGE_KEY, json);
      console.log('[BC-Bio-Visualizer] Mark data saved');
    } catch (err) {
      console.error('[BC-Bio-Visualizer] Save mark data error:', err);
    }
  }

  /**
   * Group color generator
   */
  function groupColor(groupId) {
    const hue = Math.abs(hashOffset(groupId, 97)) * 17 % 360;
    return {
      border: `hsl(${hue}, 70%, 55%)`,
      background: `hsl(${hue}, 45%, 20%)`
    };
  }

  /**
   * Apply group styles to nodes
   */
  function applyGroupStyle(nodes) {
    return nodes.map(n => {
      const groupId = markData.nodeToGroup[n.id];
      if (!groupId) return n;
      const color = groupColor(groupId);
      return { ...n, color, size: 10, borderWidth: 2 };
    });
  }

  /**
   * Apply pinned nodes styling
   */
  function applyPinnedNodes(nodes) {
    return nodes.map(n => {
      if (!pinnedNodes.has(n.id)) return n;
      const baseColor = n.color || { border: "#2b3240", background: "#1f2430" };
      return {
        ...n,
        borderWidth: (n.borderWidth || 1) + 2,
        color: { ...baseColor, border: "#6ac9ff" },
        shadow: { enabled: true, color: "rgba(106, 201, 255, 0.45)", size: 14, x: 0, y: 0 }
      };
    });
  }

  function buildGroupIndex(nodes) {
    const groupToNodes = new Map();
    const nodeToGroup = new Map();
    nodes.forEach(n => {
      const groupId = markData.nodeToGroup[n.id];
      if (!groupId) return;
      if (!groupToNodes.has(groupId)) groupToNodes.set(groupId, []);
      groupToNodes.get(groupId).push(n.id);
      nodeToGroup.set(n.id, groupId);
    });
    return { groupToNodes, nodeToGroup };
  }

  function buildCircleIndex(nodes) {
    const circleToNodes = new Map();
    nodes.forEach(n => {
      const circleIds = markData.nodeToCircles[n.id];
      if (!Array.isArray(circleIds)) return;
      circleIds.forEach(id => {
        if (!circleToNodes.has(id)) circleToNodes.set(id, []);
        circleToNodes.get(id).push(n.id);
      });
    });
    return { circleToNodes };
  }

  function buildCircleForest(circlesMap) {
    const childrenById = new Map();
    const parentById = new Map();
    Object.entries(circlesMap).forEach(([id, circle]) => {
      const children = Array.isArray(circle.children) ? circle.children.map(String) : [];
      childrenById.set(String(id), children);
    });
    childrenById.forEach((children, parentId) => {
      children.forEach(childId => {
        if (!circlesMap[childId]) return;
        if (!parentById.has(childId)) parentById.set(childId, parentId);
      });
    });
    const roots = Object.keys(circlesMap).filter(id => !parentById.has(id));
    const ordered = [];
    const sortByName = (ids) => ids.slice().sort((a, b) =>
      safeText(circlesMap[a] && circlesMap[a].name || a).localeCompare(
        safeText(circlesMap[b] && circlesMap[b].name || b)
      ));
    const visit = (id, depth) => {
      if (!circlesMap[id]) return;
      ordered.push({ id, depth });
      const children = sortByName(childrenById.get(id) || []);
      children.forEach(childId => visit(childId, depth + 1));
    };
    sortByName(roots).forEach(rootId => visit(rootId, 0));
    return { ordered, parentById, childrenById };
  }

  function getCircleAncestors(circleId, parentById) {
    const ancestors = [];
    let current = parentById.get(circleId);
    while (current) {
      ancestors.push(current);
      current = parentById.get(current);
    }
    return ancestors;
  }

  function getCircleDescendants(circleId, childrenById) {
    const result = new Set();
    const queue = [circleId];
    while (queue.length) {
      const current = queue.shift();
      const children = childrenById.get(current) || [];
      children.forEach(childId => {
        if (result.has(childId)) return;
        result.add(childId);
        queue.push(childId);
      });
    }
    return result;
  }

  function getExpandedCircleFilterSet(selectedIds) {
    if (!selectedIds || selectedIds.size === 0) return new Set();
    const { childrenById } = buildCircleForest(markData.circles);
    const expanded = new Set();
    selectedIds.forEach(id => {
      expanded.add(String(id));
      const descendants = getCircleDescendants(String(id), childrenById);
      descendants.forEach(child => expanded.add(String(child)));
    });
    return expanded;
  }

  function getMemberLabel(memberId) {
    const m = membersById.get(String(memberId));
    if (!m) return `未知 (#${memberId})`;
    const displayNickname = shadowRoot.getElementById('displayNickname');
    const nickname = m.nickname || m.lastNick;
    const name = m.name || '未知';
    if (displayNickname && displayNickname.checked && nickname) {
      return `${nickname} (#${memberId})`;
    }
    return `${name} (#${memberId})`;
  }

  /**
   * Circle overlay style generator
   */
  function circleOverlayStyle(circleId, depth) {
    const hue = Math.abs(hashOffset(circleId, 41)) * 11 % 360;
    const lightness = Math.max(34, 60 - depth * 4);
    return {
      fill: `hsla(${hue}, 70%, ${lightness}%, 0.14)`,
      stroke: `hsla(${hue}, 70%, ${lightness + 6}%, 0.22)`,
      glow: `hsla(${hue}, 70%, ${Math.min(80, lightness + 18)}%, 0.25)`
    };
  }

  /**
   * Compute convex hull using Graham scan
   */
  function convexHull(points) {
    if (points.length <= 1) return points.slice();
    const sorted = points.slice().sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    sorted.forEach(p => {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    });
    const upper = [];
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      const p = sorted[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop();
      }
      upper.push(p);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }

  /**
   * Expand polygon outward from center
   */
  function expandPolygon(points, padding) {
    const center = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    center.x /= points.length;
    center.y /= points.length;
    return points.map(p => {
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const scale = (len + padding) / len;
      return { x: center.x + dx * scale, y: center.y + dy * scale };
    });
  }

  /**
   * Build rounded path with quadratic curves
   */
  function buildRoundedPath(ctx, points, radius) {
    if (points.length < 3) return;
    const maxRadius = Math.max(0, radius);
    const count = points.length;

    const getVec = (from, to) => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      return { x: dx / len, y: dy / len, len };
    };

    const first = points[0];
    const prev = points[count - 1];
    const v0 = getVec(first, prev);
    const v1 = getVec(first, points[1]);
    const r0 = Math.min(maxRadius, v0.len * 0.45, v1.len * 0.45);
    const start = { x: first.x - v0.x * r0, y: first.y - v0.y * r0 };

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);

    for (let i = 0; i < count; i += 1) {
      const p = points[i];
      const pPrev = points[(i - 1 + count) % count];
      const pNext = points[(i + 1) % count];
      const vPrev = getVec(p, pPrev);
      const vNext = getVec(p, pNext);
      const r = Math.min(maxRadius, vPrev.len * 0.45, vNext.len * 0.45);
      const pIn = { x: p.x - vPrev.x * r, y: p.y - vPrev.y * r };
      const pOut = { x: p.x + vNext.x * r, y: p.y + vNext.y * r };
      ctx.lineTo(pIn.x, pIn.y);
      ctx.quadraticCurveTo(p.x, p.y, pOut.x, pOut.y);
    }
    ctx.closePath();
  }

  /**
   * Draw padded hull with constant-width glow
   */
  function drawPaddedHull(ctx, points, padding, style, width, blur) {
    if (points.length < 2) return;
    const hull = convexHull(points);
    if (hull.length < 2) return;

    const hullLen = hull.length;
    
    // Step 1: Calculate perpendicular normals for each edge
    const edgeNormals = [];
    for (let i = 0; i < hullLen; i++) {
      const p1 = hull[i];
      const p2 = hull[(i + 1) % hullLen];
      
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      
      // Outward normal perpendicular to edge
      const nx = dy / len;
      const ny = -dx / len;
      
      edgeNormals.push({ nx, ny, len });
    }
    
    // Step 2: Calculate outer points using averaged normals for smooth corners
    const outerPoints = [];
    for (let i = 0; i < hullLen; i++) {
      const prevNormal = edgeNormals[(i - 1 + hullLen) % hullLen];
      const currNormal = edgeNormals[i];
      
      // Average the normals to handle corners smoothly
      const avgNx = prevNormal.nx + currNormal.nx;
      const avgNy = prevNormal.ny + currNormal.ny;
      const avgLen = Math.sqrt(avgNx * avgNx + avgNy * avgNy) || 1;
      
      outerPoints.push({
        x: hull[i].x + (avgNx / avgLen) * padding,
        y: hull[i].y + (avgNy / avgLen) * padding
      });
    }
    
    // Step 3: Draw edge strips (rectangles with constant width)
    ctx.fillStyle = style.fill;
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = blur;
    
    for (let i = 0; i < hullLen; i++) {
      const p1 = hull[i];
      const p2 = hull[(i + 1) % hullLen];
      const normal = edgeNormals[i];
      
      // Expand both endpoints along the edge-specific normal
      const o1 = {
        x: p1.x + normal.nx * padding,
        y: p1.y + normal.ny * padding
      };
      const o2 = {
        x: p2.x + normal.nx * padding,
        y: p2.y + normal.ny * padding
      };
      
      // Draw rectangle: o1, o2, p2, p1 (outer to inner order)
      ctx.beginPath();
      ctx.moveTo(o1.x, o1.y);
      ctx.lineTo(o2.x, o2.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.closePath();
      ctx.fill();
    }
    
    // Step 4: Draw corner arcs to smoothly connect edge strips
    ctx.shadowBlur = 0;
    for (let i = 0; i < hullLen; i++) {
      const vertex = hull[i];
      const prevNormal = edgeNormals[(i - 1 + hullLen) % hullLen];
      const currNormal = edgeNormals[i];
      
      // Points at the end of previous edge and start of current edge
      const p1_end = {
        x: vertex.x + prevNormal.nx * padding,
        y: vertex.y + prevNormal.ny * padding
      };
      const p2_start = {
        x: vertex.x + currNormal.nx * padding,
        y: vertex.y + currNormal.ny * padding
      };
      
      // Calculate angles for arc
      let angle1 = Math.atan2(p1_end.y - vertex.y, p1_end.x - vertex.x);
      let angle2 = Math.atan2(p2_start.y - vertex.y, p2_start.x - vertex.x);
      
      // Normalize: ensure angle2 > angle1
      while (angle2 <= angle1) angle2 += Math.PI * 2;
      
      // Draw arc to bridge the corner gap
      ctx.beginPath();
      ctx.arc(vertex.x, vertex.y, padding, angle1, angle2, false);
      ctx.lineTo(vertex.x, vertex.y);
      ctx.closePath();
      ctx.fill();
    }
    
    // Step 5: Draw interior fill
    ctx.beginPath();
    hull.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Draw capsule shape (for 2-node circles)
   */
  function drawCapsule(ctx, p0, p1, radius, style, width, blur) {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    
    // Perpendicular normal (90° rotation, reversed for outward direction)
    const nx = uy;
    const ny = -ux;

    // Rectangle corners (perpendicular expansion with constant width)
    const left0 = { x: p0.x + nx * radius, y: p0.y + ny * radius };
    const left1 = { x: p1.x + nx * radius, y: p1.y + ny * radius };
    const right1 = { x: p1.x - nx * radius, y: p1.y - ny * radius };
    const right0 = { x: p0.x - nx * radius, y: p0.y - ny * radius };

    // Draw rectangular strip with constant width
    ctx.fillStyle = style.fill;
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = blur;
    
    ctx.beginPath();
    ctx.moveTo(left0.x, left0.y);
    ctx.lineTo(left1.x, left1.y);
    ctx.lineTo(right1.x, right1.y);
    ctx.lineTo(right0.x, right0.y);
    ctx.closePath();
    ctx.fill();
    
    // Draw semicircle caps at each endpoint
    ctx.shadowBlur = 0;
    
    // Angle from center to normal direction
    const angle_n = Math.atan2(ny, nx);
    
    // Cap at p1 (connects left1 to right1)
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, radius, angle_n, angle_n + Math.PI, false);
    ctx.lineTo(p1.x, p1.y);
    ctx.closePath();
    ctx.fill();
    
    // Cap at p0 (connects right0 to left0)
    ctx.beginPath();
    ctx.arc(p0.x, p0.y, radius, angle_n + Math.PI, angle_n + Math.PI * 2, false);
    ctx.lineTo(p0.x, p0.y);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Build circle overlay entries from visible nodes
   */
  function buildCircleOverlayEntries(visibleNodeIds, circleToNodes, allowedCircleIds = null) {
    const entries = [];
    const { ordered, childrenById } = buildCircleForest(markData.circles);

    ordered.forEach(({ id, depth }) => {
      if (allowedCircleIds && !allowedCircleIds.has(String(id))) return;
      const descendants = getCircleDescendants(id, childrenById);
      const circleSet = new Set([id, ...descendants]);
      const memberSet = new Set();

      circleSet.forEach(circleId => {
        const members = circleToNodes.get(circleId) || [];
        members.forEach(nodeId => {
          if (visibleNodeIds.has(nodeId)) memberSet.add(nodeId);
        });
      });

      if (memberSet.size < 2) return;
      const members = Array.from(memberSet);
      const style = circleOverlayStyle(id, depth);
      entries.push({ id, members, depth, style });
    });

    entries.sort((a, b) => a.depth - b.depth);
    return entries;
  }

  /**
   * Draw circle overlay on canvas
   */
  function drawCircleOverlay(ctx) {
    const showCircleOverlay = shadowRoot.getElementById('showCircleOverlay');
    if (!showCircleOverlay || !showCircleOverlay.checked || !circleOverlayEntries.length) return;
    const scale = network ? network.getScale() : 1;
    const lineBase = Math.max(1.1, 2.4 / scale);
    const blurBase = Math.max(6, 14 / scale);

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    circleOverlayEntries.forEach(entry => {
      const positions = network.getPositions(entry.members);
      const pts = Object.values(positions);
      const padding = 28 + entry.depth * 10;
      const blur = blurBase + entry.depth * 1.6;
      if (pts.length === 2) {
        drawCapsule(ctx, pts[0], pts[1], padding, entry.style, lineBase + entry.depth * 0.35, blur);
        return;
      }
      if (pts.length < 3) return;
      drawPaddedHull(ctx, pts, padding, entry.style, lineBase + entry.depth * 0.35, blur);
    });
    ctx.restore();
  }

  function setCircleParent(childId, parentId, parentById) {
    const prevParent = parentById.get(childId);
    if (prevParent && markData.circles[prevParent]) {
      markData.circles[prevParent].children = (markData.circles[prevParent].children || [])
        .filter(id => String(id) !== String(childId));
    }

    if (parentId && markData.circles[parentId]) {
      if (!Array.isArray(markData.circles[parentId].children)) {
        markData.circles[parentId].children = [];
      }
      const children = markData.circles[parentId].children.map(String);
      if (!children.includes(String(childId))) {
        markData.circles[parentId].children.push(String(childId));
      }
    }
  }

  function getGroupMembers(nodeId) {
    const id = String(nodeId);
    const members = groupMembersByNode.get(id);
    if (members && members.length) return members;
    return [id];
  }

  function expandByDepth(seedNodes, edges, depth) {
    const expanded = new Set(seedNodes);
    if (!seedNodes.size || depth <= 0) return expanded;
    const neighborMap = new Map();
    edges.forEach(e => {
      if (!neighborMap.has(e.from)) neighborMap.set(e.from, []);
      if (!neighborMap.has(e.to)) neighborMap.set(e.to, []);
      neighborMap.get(e.from).push(e.to);
      neighborMap.get(e.to).push(e.from);
    });
    let frontier = new Set(seedNodes);
    for (let step = 0; step < depth; step += 1) {
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

  function applyGroupHighlight(nodes, selectedId) {
    if (!selectedId) return nodes;
    const groupIds = new Set(getGroupMembers(selectedId));
    if (groupIds.size <= 1) return nodes;
    return nodes.map(n => {
      if (!groupIds.has(n.id) || String(n.id) === String(selectedId)) return n;
      const baseSize = Number.isFinite(n.size) ? n.size : 8;
      const baseBorder = Number.isFinite(n.borderWidth) ? n.borderWidth : 1;
      return {
        ...n,
        size: baseSize + 1,
        borderWidth: baseBorder + 1,
        shadow: { enabled: true, color: "rgba(43, 106, 122, 0.65)", size: 18, x: 0, y: 0 },
        color: { border: "#2b6a7a", background: "#15242b" }
      };
    });
  }

  function applyCircleFilterHighlight(nodes) {
    const circleFilterEnabled = shadowRoot.getElementById('circleFilterEnabled');
    if (!circleFilterEnabled || !circleFilterEnabled.checked || circleFilterSelected.size === 0) return nodes;
    const expandedFilters = getExpandedCircleFilterSet(circleFilterSelected);
    return nodes.map(n => {
      const circles = circleMembersByNode.get(n.id) || [];
      const isInSelected = circles.some(id => expandedFilters.has(id));
      if (!isInSelected) return n;
      return {
        ...n,
        shadow: { enabled: true, color: "rgba(89, 165, 255, 0.55)", size: 16, x: 0, y: 0 }
      };
    });
  }

  function renderCircleFilters(circleToNodes) {
    const circleFilterList = shadowRoot.getElementById('circleFilterList');
    if (!circleFilterList) return;
    const { ordered, childrenById } = buildCircleForest(markData.circles);
    const entries = ordered.map(({ id, depth }) => {
      const circle = markData.circles[id] || { name: id };
      return { id, name: circle.name || id, depth };
    });
    if (!entries.length) {
      circleFilterList.textContent = "没有圈子";
      circleFilterSelected = new Set();
      return;
    }
    const directCounts = new Map();
    if (circleToNodes) {
      circleToNodes.forEach((nodes, id) => directCounts.set(String(id), nodes.length));
    } else {
      Object.entries(markData.nodeToCircles).forEach(([, list]) => {
        if (!Array.isArray(list)) return;
        list.forEach(id => directCounts.set(String(id), (directCounts.get(String(id)) || 0) + 1));
      });
    }
    const totalCounts = new Map();
    entries.forEach(entry => {
      const descendants = getCircleDescendants(entry.id, childrenById);
      let total = directCounts.get(String(entry.id)) || 0;
      descendants.forEach(childId => {
        total += directCounts.get(String(childId)) || 0;
      });
      totalCounts.set(entry.id, total);
    });
    circleFilterSelected = new Set([...circleFilterSelected].filter(id => entries.some(e => e.id === id)));
    circleFilterList.innerHTML = entries.map(c => {
      const total = totalCounts.get(c.id) || 0;
      const direct = directCounts.get(String(c.id)) || 0;
      const checked = circleFilterSelected.has(c.id) ? "checked" : "";
      const branch = c.depth > 0 ? `${"| ".repeat(Math.min(6, c.depth) - 1)}|- ` : "";
      return `<label class="circle-filter-item"><input type="checkbox" data-id="${c.id}" ${checked} /><span class="tree-branch">${branch}</span><span class="filter-dot"></span>${safeText(c.name)} <span class="muted" title="总计/直接">(${total}/${direct})</span></label>`;
    }).join("");
  }

  /**
   * Invalidate graph signature to force re-render
   */
  function invalidateGraph() {
    currentGraphSignature = "";
    applyFilters();
  }

  /**
   * Build data from extracted profiles
   */
  function buildData(members) {
    rawMembers = members;
    membersById = new Map();

    members.forEach(m => {
      membersById.set(String(m.memberNumber), m);
    });

    const nodes = [];
    const edges = [];

    members.forEach(m => {
      const id = String(m.memberNumber);
      const displayName = shadowRoot.getElementById('displayNickname');
      const name = (displayName && displayName.checked && m.nickname) ? m.nickname : (m.name || '未知');
      const label = `${name} (#${id})`;
      
      nodes.push({
        id,
        label,
        group: m.title || "无",
        title: `${m.title || ''}\n${m.nickname || ''}`.trim(),
        value: 1
      });

      // Ownership edges
      if (m.ownership && m.ownership.MemberNumber !== undefined) {
        const ownerId = String(m.ownership.MemberNumber);
        edges.push({
          id: `o-${ownerId}-${id}`,
          from: ownerId,
          to: id,
          arrows: "to",
          dashes: false,
          color: { color: "#6ac9ff" },
          width: 1,
          dataType: "ownership"
        });
      }

      // Lovership edges
      if (Array.isArray(m.lovership)) {
        m.lovership.forEach(l => {
          if (!l || l.MemberNumber === undefined) return;
          const loverId = String(l.MemberNumber);
          edges.push({
            id: `l-${id}-${loverId}`,
            from: id,
            to: loverId,
            arrows: "",
            dashes: true,
            color: { color: "#ffb86b" },
            width: 1,
            dataType: "lovership"
          });
        });
      }
    });

    // Add placeholder nodes for referenced members not in the list
    const nodeIds = new Set(nodes.map(n => n.id));
    edges.forEach(e => {
      if (!nodeIds.has(e.from)) {
        nodes.push({ id: e.from, label: `未知 (#${e.from})`, group: "未知" });
        nodeIds.add(e.from);
      }
      if (!nodeIds.has(e.to)) {
        nodes.push({ id: e.to, label: `未知 (#${e.to})`, group: "未知" });
        nodeIds.add(e.to);
      }
    });

    allNodes = nodes;
    allEdges = edges;

    // Update stats
    const statMembers = shadowRoot.getElementById('statMembers');
    const statOwnership = shadowRoot.getElementById('statOwnership');
    const statLovership = shadowRoot.getElementById('statLovership');
    
    if (statMembers) statMembers.textContent = nodes.length;
    if (statOwnership) statOwnership.textContent = edges.filter(e => e.dataType === "ownership").length;
    if (statLovership) statLovership.textContent = edges.filter(e => e.dataType === "lovership").length;

    // Update title filter
    const titleFilter = shadowRoot.getElementById('titleFilter');
    if (titleFilter) {
      const titles = Array.from(new Set(members.map(m => m.title || "无"))).sort();
      titleFilter.innerHTML = "<option value=\"\">全部</option>" + 
        titles.map(t => `<option value="${t}">${t}</option>`).join("");
    }

    console.log('[BC-Bio-Visualizer] Data built:', nodes.length, 'nodes,', edges.length, 'edges');
  }

  /**
   * Check if vis-network library is loaded
   * Supports multiple loading patterns: global vis, window.vis, or unsafeWindow.vis
   */
  function isVisNetworkReady() {
    // Check multiple possible locations where vis might be loaded
    const visLocations = [
      typeof vis !== 'undefined' ? vis : null,
      typeof window.vis !== 'undefined' ? window.vis : null,
      typeof unsafeWindow !== 'undefined' && typeof unsafeWindow.vis !== 'undefined' ? unsafeWindow.vis : null
    ];
    
    for (const visObj of visLocations) {
      if (visObj && visObj.Network) {
        // Cache the reference for future use
        if (typeof vis === 'undefined') {
          window.vis = visObj;
        }
        return true;
      }
    }
    
    return false;
  }

  /**
   * Compute graph based on filters — aligned with HTML version logic
   */
  function computeGraph(positionMap) {
    if (!isVisNetworkReady()) {
      console.error('[BC-Bio-Visualizer] vis-network not loaded yet');
      return null;
    }

    const searchInput = shadowRoot.getElementById('search');
    const titleFilter = shadowRoot.getElementById('titleFilter');
    const showOwnership = shadowRoot.getElementById('showOwnership');
    const showLovership = shadowRoot.getElementById('showLovership');
    const hideIsolated = shadowRoot.getElementById('hideIsolated');
    const displayNickname = shadowRoot.getElementById('displayNickname');
    const neighborDepthEl = shadowRoot.getElementById('neighborDepth');
    const circleFilterEnabled = shadowRoot.getElementById('circleFilterEnabled');

    const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const title = titleFilter ? titleFilter.value : '';
    const showO = showOwnership ? showOwnership.checked : true;
    const showL = showLovership ? showLovership.checked : true;
    const hideIso = hideIsolated ? hideIsolated.checked : false;
    const depth = Math.max(1, Number((neighborDepthEl && neighborDepthEl.value) || 1));

    const { groupToNodes, nodeToGroup } = buildGroupIndex(allNodes);
    const { circleToNodes } = buildCircleIndex(allNodes);

    groupMembersByNode = new Map();
    groupToNodes.forEach((nodes, groupId) => {
      nodes.forEach(id => groupMembersByNode.set(id, [...nodes]));
    });
    circleMembersByNode = new Map();
    circleToNodes.forEach((nodes, circleId) => {
      nodes.forEach(id => {
        if (!circleMembersByNode.has(id)) circleMembersByNode.set(id, []);
        circleMembersByNode.get(id).push(circleId);
      });
    });

    const allowedNodes = new Set();

    // Circle filter: force circle members visible
    const forcedCircleNodes = new Set();
    if (circleFilterEnabled && circleFilterEnabled.checked && circleFilterSelected.size) {
      const circleIds = getExpandedCircleFilterSet(circleFilterSelected);
      circleIds.forEach(circleId => {
        const members = circleToNodes.get(String(circleId)) || [];
        members.forEach(id => forcedCircleNodes.add(id));
      });
    }

    // Filter nodes by search and title
    allNodes.forEach(n => {
      const m = membersById.get(n.id);
      const name = m && m.name ? String(m.name).toLowerCase() : '';
      const nickname = m && m.nickname ? String(m.nickname).toLowerCase() : '';
      const idStr = n.id;
      const titleMatch = !title || (m && (m.title || "无") === title);
      const searchMatch = !q || name.includes(q) || nickname.includes(q) || idStr.includes(q);

      if (titleMatch && searchMatch) {
        allowedNodes.add(n.id);
      }
    });

    // Expand allowed nodes to include their group members
    const expandedAllowed = new Set();
    allowedNodes.forEach(id => {
      const groupId = nodeToGroup.get(id);
      if (groupId && groupToNodes.has(groupId)) {
        groupToNodes.get(groupId).forEach(memberId => expandedAllowed.add(memberId));
      } else {
        expandedAllowed.add(id);
      }
    });
    forcedCircleNodes.forEach(id => expandedAllowed.add(id));

    // Filter edges by type, exclude intra-group edges
    const edgesAllowedByType = allEdges.filter(e => {
      if (e.dataType === "ownership" && !showO) return false;
      if (e.dataType === "lovership" && !showL) return false;
      const fromGroup = nodeToGroup.get(e.from);
      if (fromGroup && fromGroup === nodeToGroup.get(e.to)) return false;
      return true;
    });

    // Build seed set: allowed + selected node's group + pinned
    const focusSeed = selectedNodeId ? new Set(getGroupMembers(selectedNodeId)) : new Set();
    const pinnedSeed = new Set(pinnedNodes);
    
    const seedNodes = new Set([...expandedAllowed, ...focusSeed, ...pinnedSeed]);

    // Expand seeds by neighbor depth
    const expandedNodes = expandByDepth(seedNodes, edgesAllowedByType, depth);

    // Further expand to include full groups
    const groupExpanded = new Set(expandedNodes);
    expandedNodes.forEach(id => {
      const groupId = nodeToGroup.get(id);
      if (groupId && groupToNodes.has(groupId)) {
        groupToNodes.get(groupId).forEach(memberId => groupExpanded.add(memberId));
      }
    });

    let edges = edgesAllowedByType.filter(e => groupExpanded.has(e.from) && groupExpanded.has(e.to));
    let nodes = allNodes.filter(n => groupExpanded.has(n.id));

    // Create virtual group edges
    const groupEdges = [];
    groupToNodes.forEach((members, groupId) => {
      const visibleMembers = members.filter(id => nodes.some(n => n.id === id));
      if (visibleMembers.length < 2) return;
      const anchor = visibleMembers[0];
      for (let i = 1; i < visibleMembers.length; i += 1) {
        const target = visibleMembers[i];
        groupEdges.push({
          id: `g-${groupId}-${anchor}-${target}`,
          from: anchor,
          to: target,
          dataType: "group",
          color: { color: "rgba(106, 201, 255, 0.45)" },
          width: 1.2,
          dashes: false,
          length: 14,
          physics: true
        });
      }
    });

    // Hide isolated nodes
    if (hideIso) {
      const connected = new Set();
      [...edges, ...groupEdges].forEach(e => { connected.add(e.from); connected.add(e.to); });
      pinnedNodes.forEach(id => connected.add(String(id)));
      if (selectedNodeId) connected.add(String(selectedNodeId));
      forcedCircleNodes.forEach(id => connected.add(String(id)));
      nodes = nodes.filter(n => connected.has(n.id));
    }

    // Preserve positions from previous layout
    if (positionMap) {
      const neighborMap = new Map();
      edges.forEach(e => {
        if (!neighborMap.has(e.from)) neighborMap.set(e.from, []);
        if (!neighborMap.has(e.to)) neighborMap.set(e.to, []);
        neighborMap.get(e.from).push(e.to);
        neighborMap.get(e.to).push(e.from);
      });

      nodes = nodes.map(n => {
        const pos = positionMap[n.id];
        if (pos) {
          return { ...n, x: pos.x, y: pos.y, fixed: false };
        }

        const neighbors = neighborMap.get(n.id) || [];
        const neighborPositions = neighbors.map(id => positionMap[id]).filter(Boolean);
        if (neighborPositions.length) {
          const avg = neighborPositions.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
          const x = avg.x / neighborPositions.length;
          const y = avg.y / neighborPositions.length;
          return { ...n, x: x + hashOffset(n.id) * 6, y: y + hashOffset(n.id, 7) * 6, fixed: false };
        }

        return { ...n, x: hashOffset(n.id, 13) * 50, y: hashOffset(n.id, 29) * 50, fixed: false };
      });
    }

    // Apply styles
    nodes = applyGroupStyle(nodes);
    nodes = applyGroupHighlight(nodes, selectedNodeId);
    nodes = applyCircleFilterHighlight(nodes);
    nodes = applyPinnedNodes(nodes);

    const displayNodes = nodes;

    // Create circle hub nodes and edges
    const nodesById = new Map(displayNodes.map(n => [n.id, n]));
    const circleHubNodes = [];
    const circleEdges = [];
    circleToNodes.forEach((members, circleId) => {
      const visibleMembers = members.filter(id => nodesById.has(id));
      if (visibleMembers.length < 2) return;
      const hubId = `c-hub-${circleId}`;
      const hubNode = {
        id: hubId,
        label: "",
        value: 0.1,
        size: 1,
        shape: "dot",
        color: { background: "rgba(0,0,0,0)", border: "rgba(0,0,0,0)" },
        font: { size: 1, color: "rgba(0,0,0,0)" },
        opacity: 0,
        physics: true,
        isCircleHub: true
      };

      const hubPositions = visibleMembers
        .map(id => nodesById.get(id))
        .filter(n => n && typeof n.x === "number" && typeof n.y === "number");
      if (hubPositions.length) {
        const avg = hubPositions.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
        hubNode.x = avg.x / hubPositions.length;
        hubNode.y = avg.y / hubPositions.length;
        hubNode.fixed = false;
      }

      circleHubNodes.push(hubNode);
      visibleMembers.forEach(target => {
        circleEdges.push({
          id: `c-${circleId}-${hubId}-${target}`,
          from: hubId,
          to: target,
          dataType: "circle",
          color: { color: "rgba(0,0,0,0)" },
          width: 0.1,
          dashes: true,
          length: 140,
          physics: true
        });
      });
    });

    const graphNodes = [...displayNodes, ...circleHubNodes];

    const signature = JSON.stringify({
      nodes: displayNodes.map(n => `${n.id}:${markData.nodeToGroup[n.id] || ""}:${(markData.nodeToCircles[n.id] || []).join(",")}:${pinnedNodes.has(n.id) ? "p" : ""}`),
      edges: [...edges.map(e => e.id), ...groupEdges.map(e => e.id), ...circleEdges.map(e => e.id)],
      display: displayNickname && displayNickname.checked ? "nick" : "name"
    });

    return {
      nodes: graphNodes,
      displayNodes,
      edges: [...edges, ...groupEdges, ...circleEdges],
      signature,
      circleToNodes
    };
  }

  /**
   * Get vis-network options
   */
  function getNetworkOptions() {
    return {
      physics: {
        enabled: true,
        solver: "barnesHut",
        stabilization: { iterations: 200, updateInterval: 20 },
        barnesHut: { 
          gravitationalConstant: -12000, 
          springLength: 100, 
          springConstant: 0.012, 
          damping: 0.4 
        },
        minVelocity: 1,
        maxVelocity: 30
      },
      nodes: {
        shape: "dot",
        size: 8,
        font: { color: "#e7eaf0", size: 24 },
        borderWidth: 1,
        color: { border: "#2b3240", background: "#1f2430" }
      },
      edges: {
        smooth: false,
        font: { size: 10, color: "#9aa3b2" }
      },
      interaction: {
        hover: false,
        navigationButtons: false
      }
    };
  }

  /**
   * Apply filters and render graph (Phase 5 - with double-click pin)
   */
  function applyFilters() {
    const positionMap = !usePhysics && network ? network.getPositions() : null;
    const graph = computeGraph(positionMap);
    if (!graph) return;

    const { nodes, displayNodes, edges, signature, circleToNodes } = graph;

    // Selection-only change: update node visuals without full re-render
    if (signature === currentGraphSignature && network && currentNodeDataSet) {
      if (lastRenderedSelectedNodeId !== selectedNodeId) {
        lastRenderedSelectedNodeId = selectedNodeId;
        currentNodeDataSet.update(nodes);
        if (selectedNodeId) {
          network.selectNodes([selectedNodeId]);
        }
      }
      return;
    }

    // Incremental structural change: use incremental DataSet updates
    // to avoid physics re-stabilization, viewport jumps, and flicker
    if (useIncrementalUpdate && network && currentNodeDataSet && currentEdgeDataSet) {
      lastRenderedSelectedNodeId = selectedNodeId;

      // Incrementally update nodes
      const oldNodeIds = new Set(currentNodeDataSet.getIds());
      const newNodeIds = new Set(nodes.map(n => n.id));
      const toRemoveNodes = [...oldNodeIds].filter(id => !newNodeIds.has(id));
      if (toRemoveNodes.length) currentNodeDataSet.remove(toRemoveNodes);
      // Strip x/y/fixed from existing nodes to preserve their live positions;
      // only new nodes get initial positions from computeGraph.
      const patchedNodes = nodes.map(n => {
        if (oldNodeIds.has(n.id)) {
          const { x, y, fixed, ...rest } = n;
          return rest;
        }
        return n;
      });
      currentNodeDataSet.update(patchedNodes);

      // Incrementally update edges
      const oldEdgeIds = new Set(currentEdgeDataSet.getIds());
      const newEdgeIds = new Set(edges.map(e => e.id));
      const toRemoveEdges = [...oldEdgeIds].filter(id => !newEdgeIds.has(id));
      if (toRemoveEdges.length) currentEdgeDataSet.remove(toRemoveEdges);
      currentEdgeDataSet.update(edges);

      if (selectedNodeId) {
        network.selectNodes([selectedNodeId]);
      }

      currentGraphSignature = signature;
      renderFilteredList(displayNodes);
      renderCircleFilters(circleToNodes);
      updateStatistics();
      return;
    }

    // Render filtered list and circle filters using displayNodes (excludes hub nodes)
    renderFilteredList(displayNodes);
    renderCircleFilters(circleToNodes);

    // Build circle overlay entries
    const visibleNodeIds = new Set(displayNodes.map(n => n.id));
    const circleFilterEnabled = shadowRoot.getElementById('circleFilterEnabled');
    const allowedCircleIds = circleFilterEnabled && circleFilterEnabled.checked && circleFilterSelected.size > 0
      ? getExpandedCircleFilterSet(circleFilterSelected)
      : null;
    circleOverlayEntries = buildCircleOverlayEntries(visibleNodeIds, circleToNodes, allowedCircleIds);

    // Save viewport position before re-render
    const savedViewPosition = network ? network.getViewPosition() : null;
    const savedScale = network ? network.getScale() : null;

    currentNodeDataSet = new vis.DataSet(nodes);
    currentEdgeDataSet = new vis.DataSet(edges);
    const data = {
      nodes: currentNodeDataSet,
      edges: currentEdgeDataSet
    };
    lastRenderedSelectedNodeId = selectedNodeId;

    const graphContainer = shadowRoot.getElementById('graph');
    if (!graphContainer) return;

    if (network) {
      const physics = usePhysics
        ? { enabled: true, solver: "barnesHut", stabilization: { iterations: 200, updateInterval: 20 }, barnesHut: { gravitationalConstant: -12000, springLength: 100, springConstant: 0.012, damping: 0.4 }, minVelocity: 1, maxVelocity: 30 }
        : { enabled: false };
      network.setOptions({ physics });
      isRerendering = true;
      network.setData(data);
      // Re-select the node after setData (which clears selection)
      if (selectedNodeId) {
        network.selectNodes([selectedNodeId]);
      }
      isRerendering = false;
    } else {
      const options = getNetworkOptions();
      network = new vis.Network(graphContainer, data, options);
      
      // Node selection event — re-render to show n-hop neighbors of selected node
      network.on("selectNode", params => {
        if (isRerendering) return;
        const nodeId = params.nodes[0];
        selectedNodeId = nodeId;
        showDetail(nodeId);
        useIncrementalUpdate = true;
        applyFilters();
        useIncrementalUpdate = false;
      });

      // Node deselection event — only deselect when switching to another node
      // (clicking blank space should NOT deselect or re-render)
      network.on("deselectNode", (params) => {
        if (isRerendering) return;
        // If no new node is selected (blank click), restore previous selection
        if (selectedNodeId && (!params.nodes || params.nodes.length === 0)) {
          network.selectNodes([selectedNodeId]);
        }
      });

      // Double-click to pin/unpin nodes
      network.on("doubleClick", params => {
        if (params.nodes.length > 0) {
          const nodeId = String(params.nodes[0]);
          if (pinnedNodes.has(nodeId)) {
            pinnedNodes.delete(nodeId);
            console.log('[BC-Bio-Visualizer] Node unpinned:', nodeId);
          } else {
            pinnedNodes.add(nodeId);
            console.log('[BC-Bio-Visualizer] Node pinned:', nodeId);
          }
          saveMarkData();
          renderPinnedList();
          useIncrementalUpdate = true;
          invalidateGraph();
          useIncrementalUpdate = false;
        }
      });

      // Draw circle overlay before network rendering
      network.on("beforeDrawing", ctx => {
        drawCircleOverlay(ctx);
      });

      console.log('[BC-Bio-Visualizer] Network initialized with pin support and circle overlay');
    }

    // Restore viewport position if we had one, otherwise fit on first render
    if (savedViewPosition && savedScale) {
      requestAnimationFrame(() => {
        if (network) {
          network.moveTo({
            position: savedViewPosition,
            scale: savedScale,
            animation: false
          });
        }
      });
    } else if (nodes.length && lastVisibleNodeCount === 0) {
      requestAnimationFrame(() => {
        if (network) network.fit({ animation: false });
      });
    }
    lastVisibleNodeCount = nodes.length;

    currentGraphSignature = signature;

    // Disable physics after stabilization if enabled
    if (usePhysics && network) {
      network.once("stabilizationIterationsDone", () => {
        network.setOptions({ physics: { enabled: false } });
        usePhysics = false;
        updatePhysicsButton();
      });
    }

    // Update statistics
    updateStatistics();
  }

  /**
   * Render filtered member list (Phase 6)
   */
  function renderFilteredList(nodes) {
    const filteredList = shadowRoot.getElementById('filteredList');
    if (!filteredList) return;

    if (!nodes || nodes.length === 0) {
      filteredList.innerHTML = '<div class="muted" style="font-size:12px;">没有匹配项</div>';
      return;
    }

    const sorted = [...nodes].sort((a, b) => {
      const aLabel = a.label || "";
      const bLabel = b.label || "";
      return aLabel.localeCompare(bLabel);
    });

    // Limit display to first 50 for performance
    const displayed = sorted.slice(0, 50);
    const remaining = sorted.length - 50;

    filteredList.innerHTML = displayed.map(n => {
      const label = safeText(n.label || n.id);
      return `<div style="font-size:11px;padding:2px 0;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" data-id="${n.id}" class="filtered-item">${label}</div>`;
    }).join('') + (remaining > 0 ? `<div class="muted" style="font-size:11px;padding:4px 0;">还有 ${remaining} 个成员...</div>` : '');

    // Add click handlers to jump to node
    filteredList.querySelectorAll('.filtered-item').forEach(item => {
      item.addEventListener('click', () => {
        const nodeId = item.dataset.id;
        if (network && nodeId) {
          network.selectNodes([nodeId]);
          network.focus(nodeId, { scale: 1.5, animation: true });
          selectedNodeId = nodeId;
          showDetail(nodeId);
        }
      });
    });
  }

  /**
   * Update statistics display (Phase 6)
   */
  function updateStatistics() {
    const statMembers = shadowRoot.getElementById('statMembers');
    const statOwnership = shadowRoot.getElementById('statOwnership');
    const statLovership = shadowRoot.getElementById('statLovership');

    if (statMembers) statMembers.textContent = rawMembers.length;
    if (statOwnership) statOwnership.textContent = allEdges.filter(e => e.dataType === 'ownership').length;
    if (statLovership) statLovership.textContent = allEdges.filter(e => e.dataType === 'lovership').length;
  }

  /**
   * Render pinned nodes list
   */
  function renderPinnedList() {
    const fixedList = shadowRoot.getElementById('fixedList');
    if (!fixedList) return;

    if (pinnedNodes.size === 0) {
      fixedList.innerHTML = '<div class="muted" style="font-size:12px;">无固定节点</div>';
      return;
    }

    const pinnedArray = Array.from(pinnedNodes).map(id => {
      const m = membersById.get(String(id));
      if (!m) return `未知 (#${id})`;
      const displayNickname = shadowRoot.getElementById('displayNickname');
      const name = (displayNickname && displayNickname.checked && m.nickname) ? m.nickname : (m.name || '未知');
      return `${name} (#${id})`;
    }).sort();

    fixedList.innerHTML = pinnedArray.map(label => `<div style="font-size:12px;">${label}</div>`).join('');
  }

  /**
   * Render circle members list
   */
  function renderCircleMembers(circleId) {
    const circleMemberList = shadowRoot.getElementById('circleMemberList');
    if (!circleMemberList) return;

    if (!circleId) {
      circleMemberList.textContent = "请选择一个圈子";
      return;
    }

    const { childrenById } = buildCircleForest(markData.circles);
    const descendants = getCircleDescendants(circleId, childrenById);
    const circleSet = new Set([circleId, ...descendants]);

    const members = Object.entries(markData.nodeToCircles)
      .filter(([, ids]) => Array.isArray(ids) && ids.some(id => circleSet.has(String(id))))
      .map(([id]) => getMemberLabel(id))
      .sort((a, b) => a.localeCompare(b));

    if (!members.length) {
      circleMemberList.textContent = "没有成员";
      return;
    }

    circleMemberList.innerHTML = members.map(m => `<div style="font-size:12px;">${m}</div>`).join("");
  }

  /**
   * Render circle select UI
   */
  function renderCircleSelect(nodeId) {
    const circleSelectList = shadowRoot.getElementById('circleSelectList');
    const circleSearch = shadowRoot.getElementById('circleSearch');
    const circleMemberList = shadowRoot.getElementById('circleMemberList');
    if (!circleSelectList || !circleSearch) return;

    const { ordered, parentById, childrenById } = buildCircleForest(markData.circles);
    const query = circleSearch.value.trim().toLowerCase();
    const explicitIds = new Set(markData.nodeToCircles[String(nodeId)] || []);
    const impliedIds = new Set();

    explicitIds.forEach(id => {
      getCircleAncestors(String(id), parentById).forEach(ancestorId => impliedIds.add(ancestorId));
    });

    if (!focusedCircleId || !markData.circles[focusedCircleId]) {
      focusedCircleId = [...explicitIds][0] || null;
    }

    let visibleOrdered = ordered;
    if (query) {
      const visibleIds = new Set();
      ordered.forEach(({ id }) => {
        const name = safeText(markData.circles[id] && markData.circles[id].name || id).toLowerCase();
        if (name.includes(query)) {
          visibleIds.add(id);
          getCircleAncestors(id, parentById).forEach(ancestorId => visibleIds.add(ancestorId));
        }
      });
      visibleOrdered = ordered.filter(item => visibleIds.has(item.id));
    }

    let html = '';
    if (!visibleOrdered.length && !Object.keys(markData.circles).length) {
      html = '<div class="muted" style="padding:8px;font-size:12px;">没有圈子</div>';
    } else if (!visibleOrdered.length) {
      html = '<div class="muted" style="padding:8px;font-size:12px;">没有匹配项</div>';
    } else {
      const rootDrop = '<div class="tree-root-drop" data-drop="root">拖到此处设为根</div>';
      html = rootDrop + visibleOrdered.map(({ id, depth }) => {
        const circle = markData.circles[id] || { name: id };
        const isExplicit = explicitIds.has(id);
        const isImplied = !isExplicit && impliedIds.has(id);
        const checked = isExplicit || isImplied ? 'checked' : '';
        const disabled = isImplied || editingCircleId === id ? 'disabled' : '';
        const isEditing = editingCircleId === id ? 'is-editing' : '';
        const impliedClass = isImplied ? 'is-implied' : '';
        const focusedClass = focusedCircleId === id ? 'is-focused' : '';
        const indent = Math.min(6, depth) * 12;
        const branch = depth > 0 ? `${"| ".repeat(Math.min(6, depth) - 1)}|- ` : "";

        if (editingCircleId === id) {
          return `
            <div class="select-item ${isEditing}" data-id="${id}">
              <input type="checkbox" ${checked} ${disabled} />
              <input type="text" class="item-input" value="${safeText(circle.name)}" data-original="${safeText(circle.name)}" style="padding-left:${indent}px;" />
              <div class="item-actions">
                <button class="icon-btn save" title="保存" data-action="save">✓</button>
                <button class="icon-btn" title="取消" data-action="cancel">✕</button>
              </div>
            </div>
          `;
        }

        return `
          <div class="select-item ${impliedClass} ${focusedClass}" data-id="${id}" draggable="true">
            <input type="checkbox" ${checked} ${disabled} />
            <span class="item-label">
              <span class="drag-handle" title="拖动移动">||</span>
              <span class="tree-branch">${branch}</span>
              <span class="tree-node-dot"></span>
              ${safeText(circle.name || id)}${isImplied ? ' <span class="muted" style="margin-left:6px;font-size:11px;">（继承）</span>' : ''}
            </span>
            <div class="item-actions">
              <button class="icon-btn" title="编辑" data-action="edit">✏️</button>
              <button class="icon-btn delete" title="删除" data-action="delete">🗑️</button>
            </div>
          </div>
        `;
      }).join('');
    }

    if (focusedCircleId && markData.circles[focusedCircleId]) {
      renderCircleMembers(focusedCircleId);
    } else if (circleMemberList) {
      circleMemberList.textContent = '未选择圈子';
    }

    if (creatingCircle) {
      html += `
        <div class="select-item is-creating" data-creating="true">
          <span style="width:20px;text-align:center;">+</span>
          <input type="text" class="item-input" placeholder="圈子名称" autofocus />
          <div class="item-actions">
            <button class="icon-btn save" title="创建" data-action="create">✓</button>
            <button class="icon-btn" title="取消" data-action="cancel-create">✕</button>
          </div>
        </div>
      `;
    } else if (nodeId) {
      html += '<button class="button create-new-btn" data-action="start-create">新建圈子</button>';
    }

    circleSelectList.innerHTML = html;

    if (editingCircleId || creatingCircle) {
      const input = circleSelectList.querySelector('.item-input');
      if (input) {
        input.focus();
        input.select();
      }
    }
  }

  /**
   * Render group select UI (Phase 6)
   */
  function renderGroupSelect(nodeId) {
    const groupSelectList = shadowRoot.getElementById('groupSelectList');
    const groupSearch = shadowRoot.getElementById('groupSearch');
    if (!groupSelectList || !groupSearch) return;

    const groupEntries = Object.entries(markData.groups)
      .map(([id, g]) => ({ id, name: g.name || id }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    const query = groupSearch.value.trim().toLowerCase();
    const currentGroupId = markData.nodeToGroup[String(nodeId)] || "";
    const filteredEntries = groupEntries.filter(g => !query || g.name.toLowerCase().includes(query));
    
    if (!focusedGroupId || !markData.groups[focusedGroupId]) {
      focusedGroupId = currentGroupId || null;
    }
    
    let html = '';
    
    if (!filteredEntries.length && !groupEntries.length) {
      html = '<div class="muted" style="padding:8px;font-size:12px;">没有分组</div>';
    } else if (!filteredEntries.length) {
      html = '<div class="muted" style="padding:8px;font-size:12px;">没有匹配项</div>';
    } else {
      html = filteredEntries.map(g => {
        const checked = g.id === currentGroupId ? 'checked' : '';
        const disabled = editingGroupId === g.id ? 'disabled' : '';
        const isEditing = editingGroupId === g.id ? 'is-editing' : '';
        
        if (editingGroupId === g.id) {
          return `
            <div class="select-item ${isEditing}" data-id="${g.id}">
              <input type="radio" name="groupRadio" ${checked} ${disabled} />
              <input type="text" class="item-input" value="${safeText(g.name)}" data-original="${safeText(g.name)}" />
              <div class="item-actions">
                <button class="icon-btn save" title="保存" data-action="save">✓</button>
                <button class="icon-btn" title="取消" data-action="cancel">✕</button>
              </div>
            </div>
          `;
        }
        
        const isFocused = focusedGroupId === g.id ? 'is-focused' : '';
        return `
          <div class="select-item ${isFocused}" data-id="${g.id}">
            <input type="radio" name="groupRadio" ${checked} />
            <span class="item-label">${safeText(g.name)}</span>
            <div class="item-actions">
              <button class="icon-btn" title="编辑" data-action="edit">✏️</button>
              <button class="icon-btn delete" title="删除" data-action="delete">🗑️</button>
            </div>
          </div>
        `;
      }).join('');
    }
    
    // Add create button
    if (creatingGroup) {
      html += `
        <div class="select-item is-creating" data-creating="true">
          <span style="width:20px;text-align:center;">+</span>
          <input type="text" class="item-input" placeholder="分组名称" autofocus />
          <div class="item-actions">
            <button class="icon-btn save" title="创建" data-action="create">✓</button>
            <button class="icon-btn" title="取消" data-action="cancel-create">✕</button>
          </div>
        </div>
      `;
    } else if (nodeId) {
      html += '<button class="button create-new-btn" data-action="start-create" style="width:100%;margin-top:8px;">新建分组</button>';
    }
    
    groupSelectList.innerHTML = html;
    
    // Auto-focus input if editing or creating
    if (editingGroupId || creatingGroup) {
      setTimeout(() => {
        const input = groupSelectList.querySelector('.item-input');
        if (input) {
          input.focus();
          input.select();
        }
      }, 10);
    }
  }

  /**
   * Update mark UI when node is selected (Phase 6)
   */
  function updateMarkUI(nodeId) {
    editingGroupId = null;
    editingCircleId = null;
    creatingGroup = false;
    creatingCircle = false;

    if (!nodeId) {
      const groupMemberList = shadowRoot.getElementById('groupMemberList');
      const circleMemberList = shadowRoot.getElementById('circleMemberList');
      if (groupMemberList) groupMemberList.textContent = '未选择节点';
      if (circleMemberList) circleMemberList.textContent = '未选择节点';
      renderGroupSelect("");
      renderCircleSelect("");
      return;
    }

    renderGroupSelect(nodeId);
    renderCircleSelect(nodeId);
    
    const groupClearBtn = shadowRoot.getElementById('groupClearBtn');
    if (groupClearBtn) {
      const groupId = markData.nodeToGroup[String(nodeId)] || "";
      groupClearBtn.disabled = !groupId;
    }
  }

  /**
   * Show node detail
   */
  function showDetail(id) {
    const m = membersById.get(String(id));
    const detailEmpty = shadowRoot.getElementById('detail-empty');
    const detail = shadowRoot.getElementById('detail');
    const detailName = shadowRoot.getElementById('detailName');
    const detailMeta = shadowRoot.getElementById('detailMeta');
    const detailOwnership = shadowRoot.getElementById('detailOwnership');
    const detailLovership = shadowRoot.getElementById('detailLovership');
    const detailDesc = shadowRoot.getElementById('detailDesc');

    if (!m) {
      if (detailName) detailName.textContent = `未知 (#${id})`;
      if (detailMeta) detailMeta.textContent = "无数据";
      if (detailOwnership) detailOwnership.textContent = "-";
      if (detailLovership) detailLovership.textContent = "-";
      if (detailDesc) detailDesc.textContent = "无描述";
    } else {
      const displayNickname = shadowRoot.getElementById('displayNickname');
      const name = (displayNickname && displayNickname.checked && m.nickname) ? m.nickname : (m.name || '未知');
      
      if (detailName) detailName.textContent = `${name} (#${m.memberNumber})`;
      if (detailMeta) detailMeta.textContent = [m.title, m.nickname, m.assetFamily].filter(Boolean).join(" | ");
      
      if (detailOwnership) {
        if (m.ownership && m.ownership.MemberNumber !== undefined) {
          detailOwnership.textContent = `${m.ownership.Name || "未知"} (#${m.ownership.MemberNumber})`;
        } else {
          detailOwnership.textContent = "-";
        }
      }
      
      if (detailLovership) {
        if (Array.isArray(m.lovership) && m.lovership.length) {
          detailLovership.textContent = m.lovership
            .map(l => `${l.Name || "未知"}${l.MemberNumber !== undefined ? ` (#${l.MemberNumber})` : ""}`)
            .join(", ");
        } else {
          detailLovership.textContent = "-";
        }
      }
      
      if (detailDesc) detailDesc.textContent = m.descriptionDecoded || "无描述";
    }

    if (detailEmpty) detailEmpty.style.display = "none";
    if (detail) detail.style.display = "flex";

    // Auto-switch to detail tab on mobile
    if (window.matchMedia('(max-width: 768px)').matches) {
      switchToMobileTab('detail-panel');
    }

    // Update group UI
    updateMarkUI(id);
  }

  /**
   * Hide detail panel
   */
  function hideDetail() {
    const detailEmpty = shadowRoot.getElementById('detail-empty');
    const detail = shadowRoot.getElementById('detail');
    
    if (detail) detail.style.display = "none";
    if (detailEmpty) detailEmpty.style.display = "block";
  }

  /**
   * Update physics button text
   */
  function updatePhysicsButton() {
    const physicsToggleBtn = shadowRoot.getElementById('physicsToggleBtn');
    if (physicsToggleBtn) {
      physicsToggleBtn.textContent = usePhysics ? '停止物理' : '开始物理';
    }
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

      // Space to toggle physics (when visualizer is open)
      if (e.code === 'Space' && isVisualizerVisible && !e.target.matches('input, textarea')) {
        e.preventDefault();
        const physicsToggleBtn = shadowRoot.getElementById('physicsToggleBtn');
        if (physicsToggleBtn) physicsToggleBtn.click();
      }
    });
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Manually load vis-network if @require fails
   */
  function manuallyLoadVisNetwork() {
    return new Promise((resolve, reject) => {
      console.log('[BC-Bio-Visualizer] Attempting manual vis-network load...');
      
      // Try multiple CDN sources
      const cdnUrls = [
        'https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js',
        'https://cdn.jsdelivr.net/npm/vis-network@9.1.9/standalone/umd/vis-network.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/vis-network/9.1.9/standalone/umd/vis-network.min.js'
      ];
      
      let currentIndex = 0;
      
      function tryNextCdn() {
        if (currentIndex >= cdnUrls.length) {
          reject(new Error('All CDN sources failed'));
          return;
        }
        
        const url = cdnUrls[currentIndex];
        console.log(`[BC-Bio-Visualizer] Trying CDN ${currentIndex + 1}/${cdnUrls.length}: ${url}`);
        
        const script = document.createElement('script');
        script.src = url;
        script.onload = () => {
          console.log('[BC-Bio-Visualizer] Manual load successful from:', url);
          // Wait a bit for the script to initialize
          setTimeout(() => {
            if (isVisNetworkReady()) {
              resolve();
            } else {
              currentIndex++;
              tryNextCdn();
            }
          }, 100);
        };
        script.onerror = () => {
          console.warn('[BC-Bio-Visualizer] Failed to load from:', url);
          currentIndex++;
          tryNextCdn();
        };
        
        document.head.appendChild(script);
      }
      
      tryNextCdn();
    });
  }

  /**
   * Wait for vis-network library to be loaded
   */
  function waitForVisNetwork(maxAttempts = 50, interval = 200) {
    return new Promise(async (resolve, reject) => {
      let attempts = 0;
      
      console.log('[BC-Bio-Visualizer] Waiting for vis-network library...');
      
      const checkInterval = setInterval(() => {
        attempts++;
        
        // Debug info every 10 attempts
        if (attempts % 10 === 0) {
          console.log(`[BC-Bio-Visualizer] Still waiting for vis-network... (attempt ${attempts}/${maxAttempts})`);
          console.log('[BC-Bio-Visualizer] Debug: typeof vis =', typeof vis);
          console.log('[BC-Bio-Visualizer] Debug: typeof window.vis =', typeof window.vis);
          if (typeof unsafeWindow !== 'undefined') {
            console.log('[BC-Bio-Visualizer] Debug: typeof unsafeWindow.vis =', typeof unsafeWindow.vis);
          }
        }
        
        if (isVisNetworkReady()) {
          clearInterval(checkInterval);
          console.log('[BC-Bio-Visualizer] vis-network loaded successfully after', attempts, 'attempts');
          resolve();
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          console.error('[BC-Bio-Visualizer] Timeout waiting for vis-network');
          console.error('[BC-Bio-Visualizer] Final state: typeof vis =', typeof vis);
          console.error('[BC-Bio-Visualizer] Final state: typeof window.vis =', typeof window.vis);
          
          // Try manual loading as fallback
          console.log('[BC-Bio-Visualizer] Attempting manual load as fallback...');
          manuallyLoadVisNetwork()
            .then(resolve)
            .catch(err => {
              reject(new Error('vis-network failed to load: ' + err.message));
            });
        }
      }, interval);
    });
  }

  /**
   * Main initialization function
   */
  async function main() {
    console.log('[BC-Bio-Visualizer] v2.0.0 启动中...');

    // Ensure viewport meta for mobile
    if (!document.querySelector('meta[name="viewport"]')) {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
      document.head.appendChild(meta);
    }

    // Check required features
    if (!window.indexedDB) {
      console.error('[BC-Bio-Visualizer] IndexedDB not supported');
      return;
    }

    if (!document.body.attachShadow) {
      console.warn('[BC-Bio-Visualizer] Shadow DOM not supported, using fallback');
      // TODO: Implement fallback in later phase
    }

    // Wait for vis-network to be loaded (with fallback)
    try {
      await waitForVisNetwork();
    } catch (error) {
      console.error('[BC-Bio-Visualizer] Failed to load vis-network:', error);
      console.warn('[BC-Bio-Visualizer] Continuing with limited functionality...');
      // Don't return - allow the UI to load, but graph won't work
    }

    // Create Shadow DOM container
    createShadowContainer();

    // Setup keyboard shortcuts
    setupKeyboardShortcuts();

    // Wait for game API and register chat command
    try {
      await waitForGameReady();
      registerGameCommand();
    } catch (error) {
      console.error('[BC-Bio-Visualizer] Failed to register game command:', error);
      console.warn('[BC-Bio-Visualizer] /biovis command unavailable, use Ctrl+Shift+V instead');
    }

    console.log('[BC-Bio-Visualizer] 初始化完成！输入 /biovis 或按 Ctrl+Shift+V 打开');
  }

  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }

})();
