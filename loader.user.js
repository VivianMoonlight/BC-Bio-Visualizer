// ==UserScript==
// @name         BC-Bio-Visualizer
// @namespace    https://github.com/your-repo/BC-Bio-Visualizer
// @version      2.0.0
// @description  WCE生物数据库可视化工具 (Tampermonkey集成版) - Loader
// @author       BC-Bio-Visualizer Team
// @match        https://www.bondageprojects.com/*
// @match        https://bondageprojects.elementfx.com/*
// @icon         data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='%236ac9ff'/%3E%3C/svg%3E
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @require      https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js
// @require      https://cdn.jsdelivr.net/npm/lz-string@1.4.4/libs/lz-string.min.js
// @run-at       document-idle
// @noframes
// @updateURL    https://raw.githubusercontent.com/your-repo/BC-Bio-Visualizer/main/loader.js
// @downloadURL  https://raw.githubusercontent.com/your-repo/BC-Bio-Visualizer/main/loader.js
// ==/UserScript==

/**
 * BC-Bio-Visualizer Loader
 * 
 * This is a lightweight loader script that dynamically loads the main userscript.
 * Benefits:
 * - Smaller initial script size
 * - Easier to update main script without reinstalling
 * - Can cache the main script for performance
 * - Supports remote updates
 */

(function() {
  'use strict';

  // Configuration
  const SCRIPT_URL = 'https://raw.githubusercontent.com/your-repo/BC-Bio-Visualizer/main/bc-bio-visualizer.user.js';
  const CACHE_KEY = 'bc-bio-visualizer-script-cache';
  const CACHE_VERSION_KEY = 'bc-bio-visualizer-script-version';
  const CURRENT_VERSION = '2.0.0';
  const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Check if script needs update
   */
  async function needsUpdate() {
    try {
      const cachedVersion = await GM_getValue(CACHE_VERSION_KEY, null);
      const lastUpdate = await GM_getValue('bc-bio-visualizer-last-update', 0);
      const now = Date.now();
      
      // Update if version changed or cache expired
      return cachedVersion !== CURRENT_VERSION || (now - lastUpdate) > CACHE_DURATION;
    } catch (error) {
      console.error('[BC-Bio-Visualizer Loader] Error checking update:', error);
      return true;
    }
  }

  /**
   * Load script from remote URL
   */
  function loadRemoteScript() {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: SCRIPT_URL,
        onload: function(response) {
          if (response.status === 200) {
            resolve(response.responseText);
          } else {
            reject(new Error(`Failed to load script: ${response.status}`));
          }
        },
        onerror: function(error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Execute the main script
   */
  async function executeScript(scriptCode) {
    try {
      // Create a function from the script code and execute it
      const scriptFunc = new Function(scriptCode);
      scriptFunc();
      console.log('[BC-Bio-Visualizer Loader] Main script loaded successfully');
    } catch (error) {
      console.error('[BC-Bio-Visualizer Loader] Error executing script:', error);
      throw error;
    }
  }

  /**
   * Main loader logic
   */
  async function init() {
    try {
      console.log('[BC-Bio-Visualizer Loader] Initializing...');
      
      let scriptCode = null;
      const shouldUpdate = await needsUpdate();
      
      if (shouldUpdate) {
        console.log('[BC-Bio-Visualizer Loader] Fetching latest version...');
        try {
          scriptCode = await loadRemoteScript();
          
          // Cache the script
          await GM_setValue(CACHE_KEY, scriptCode);
          await GM_setValue(CACHE_VERSION_KEY, CURRENT_VERSION);
          await GM_setValue('bc-bio-visualizer-last-update', Date.now());
          
          console.log('[BC-Bio-Visualizer Loader] Script cached successfully');
        } catch (error) {
          console.warn('[BC-Bio-Visualizer Loader] Failed to fetch remote script, trying cache:', error);
          scriptCode = await GM_getValue(CACHE_KEY, null);
        }
      } else {
        console.log('[BC-Bio-Visualizer Loader] Using cached version');
        scriptCode = await GM_getValue(CACHE_KEY, null);
      }
      
      // Fallback: use embedded script if available
      if (!scriptCode) {
        console.warn('[BC-Bio-Visualizer Loader] No cached script found. Please check network connection.');
        console.warn('[BC-Bio-Visualizer Loader] Visit the repository to download the full script.');
        return;
      }
      
      // Execute the main script
      await executeScript(scriptCode);
      
    } catch (error) {
      console.error('[BC-Bio-Visualizer Loader] Initialization failed:', error);
    }
  }

  // Start the loader
  init();
})();
