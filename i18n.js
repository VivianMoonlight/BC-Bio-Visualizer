/**
 * BC-Bio-Visualizer i18n Module
 * 国际化（Internationalization）模块
 * 
 * 支持多语言，包括中文(zh_CN)和英文(en_US)
 * 
 * 使用方式:
 *   // 单语言翻译
 *   i18n.t('button_save') // => "保存" or "Save"
 * 
 *   // 带参数的翻译
 *   i18n.t('message_members_count', { count: 5 }) // => "成员数: 5 members"
 * 
 *   // 设置语言
 *   i18n.setLanguage('en_US')
 * 
 *   // 获取当前语言
 *   i18n.getLanguage()
 */

const i18n = (() => {
  let currentLanguage = 'zh_CN';
  let translations = {};
  let fallbackLanguage = 'en_US';

  /**
   * 注册翻译资源
   * @param {string} lang - 语言代码，如 'zh_CN', 'en_US'
   * @param {object} messages - 翻译对象 { key: 'translation', ... }
   */
  function registerLanguage(lang, messages) {
    translations[lang] = messages;
  }

  /**
   * 设置当前语言
   * @param {string} lang - 语言代码
   */
  function setLanguage(lang) {
    if (translations[lang]) {
      currentLanguage = lang;
      // 保存用户选择的语言到localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('bc-biovis-lang', lang);
      }
    } else {
      console.warn(`[i18n] Language "${lang}" not registered. Available: ${Object.keys(translations).join(', ')}`);
    }
  }

  /**
   * 获取当前语言
   * @returns {string} 当前语言代码
   */
  function getLanguage() {
    return currentLanguage;
  }

  /**
   * 获取翻译字符串
   * @param {string} key - 翻译键
   * @param {object} params - 参数对象，用于替换 {key} 占位符
   * @param {string} lang - 可选的特定语言
   * @returns {string} 翻译后的字符串
   */
  function translate(key, params = {}, lang = currentLanguage) {
    let message = translations[lang]?.[key];
    
    // 如果当前语言没有，尝试降级到英文
    if (!message && lang !== fallbackLanguage) {
      message = translations[fallbackLanguage]?.[key];
    }

    // 如果都没有，返回键本身
    if (!message) {
      console.warn(`[i18n] Missing translation for key: "${key}" in language "${lang}"`);
      return key;
    }

    // 替换参数
    if (Object.keys(params).length > 0) {
      return message.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey] !== undefined ? params[paramKey] : match;
      });
    }

    return message;
  }

  /**
   * 获取所有可用的语言
   * @returns {array} 语言代码数组
   */
  function getAvailableLanguages() {
    return Object.keys(translations);
  }

  /**
   * 初始化i18n - 尝试读取用户保存的语言设置或使用浏览器语言
   */
  function init() {
    // 尝试从localStorage读取用户保存的语言
    if (typeof localStorage !== 'undefined') {
      const savedLang = localStorage.getItem('bc-biovis-lang');
      if (savedLang && translations[savedLang]) {
        currentLanguage = savedLang;
        return;
      }
    }

    // 根据浏览器语言设置自动选择
    const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
    if (browserLang.startsWith('zh')) {
      currentLanguage = 'zh_CN';
    } else if (browserLang.startsWith('en')) {
      currentLanguage = 'en_US';
    }
    // 否则保持默认的zh_CN
  }

  // 返回公共API
  return {
    t: translate,
    setLanguage,
    getLanguage,
    registerLanguage,
    getAvailableLanguages,
    init
  };
})();

// 导出到全局作用域或作为模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = i18n;
}
