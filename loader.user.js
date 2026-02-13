// ==UserScript==
// @name         BC-Bio-Visualizer
// @namespace    https://github.com/VivianMoonlight/BC-Bio-Visualizer
// @version      2.0.0
// @description  WCE生物数据库可视化工具 - Loader
// @author       BC-Bio-Visualizer Team
// @match        https://www.bondageprojects.com/*
// @match        https://www.bondageprojects.elementfx.com/*
// @match        https://www.bondage-europe.com/*
// @match        https://www.bondage-asia.com/*
// @match        http://localhost:*/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  setTimeout(function() {
    const script = document.createElement('script');
    script.type = 'module';
    script.crossOrigin = 'anonymous';
    script.src = 'https://vivianmoonlight.github.io/BC-Bio-Visualizer/bc-bio-visualizer.user.js?' + Date.now();
    script.onload = () => script.remove();
    document.head.appendChild(script);
  }, 1000);
})();
