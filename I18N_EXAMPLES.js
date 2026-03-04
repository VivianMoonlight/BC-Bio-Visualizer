/**
 * BC-Bio-Visualizer i18n 代码示例
 * 
 * 此文件展示如何在不同场景中使用i18n系统
 */

// ============================================================================
// 示例1：基础翻译
// ============================================================================

// 获取简单的翻译文本
function example_basic_translation() {
  const saveButtonText = i18n.t('button_save');
  console.log(saveButtonText);  
  // 中文: "保存"
  // 英文: "Save"
}

// ============================================================================
// 示例2：在HTML元素中设置翻译
// ============================================================================

function example_set_element_text() {
  // 方法1：直接设置textContent
  const btn = document.getElementById('exportMarksBtn');
  btn.textContent = i18n.t('button_export');
  
  // 方法2：设置placeholder
  const input = document.getElementById('search');
  input.placeholder = i18n.t('placeholder_search');
  
  // 方法3：设置title属性
  const btn2 = document.getElementById('physicsToggleBtn');
  btn2.title = i18n.t('tooltip_toggle_physics');
}

// ============================================================================
// 示例3：参数化翻译
// ============================================================================

function example_parametrized_translation() {
  // 带参数的翻译
  const errorMsg = i18n.t('error_import_failed', {
    error: 'Network timeout'
  });
  console.log(errorMsg);
  // 中文: "导入分组数据失败：Network timeout"
  // 英文: "Failed to import group data: Network timeout"
}

// ============================================================================
// 示例4：条件翻译
// ============================================================================

function example_conditional_translation(memberCount) {
  if (memberCount === 0) {
    return i18n.t('no_members');
  } else if (memberCount === 1) {
    return i18n.t('status_file_loaded', { count: memberCount });
  } else {
    return i18n.t('status_file_loaded', { count: memberCount });
  }
}

// ============================================================================
// 示例5：列表中的翻译
// ============================================================================

function example_translate_list_items() {
  const items = [
    { id: 'save', label: i18n.t('button_save') },
    { id: 'cancel', label: i18n.t('button_cancel') },
    { id: 'edit', label: i18n.t('button_edit') },
    { id: 'delete', label: i18n.t('button_delete') },
  ];
  
  return items;
  // 中文返回:
  // [
  //   { id: 'save', label: '保存' },
  //   { id: 'cancel', label: '取消' },
  //   { id: 'edit', label: '编辑' },
  //   { id: 'delete', label: '删除' },
  // ]
}

// ============================================================================
// 示例6：动态创建HTML with 翻译
// ============================================================================

function example_create_html_with_translation() {
  // 创建一个按钮列表
  const buttons = [
    { id: 'btn-save', key: 'button_save' },
    { id: 'btn-cancel', key: 'button_cancel' },
    { id: 'btn-delete', key: 'button_delete' },
  ];
  
  let html = '';
  buttons.forEach(btn => {
    const label = i18n.t(btn.key);
    html += `<button id="${btn.id}" class="button">${label}</button>`;
  });
  
  document.getElementById('actions').innerHTML = html;
}

// ============================================================================
// 示例7：语言切换
// ============================================================================

function example_language_switching() {
  // 获取当前语言
  const currentLang = i18n.getLanguage();
  console.log('Current language:', currentLang);  // 'zh_CN' 或 'en_US'
  
  // 获取所有可用语言
  const availableLangs = i18n.getAvailableLanguages();
  console.log('Available languages:', availableLangs);  // ['zh_CN', 'en_US']
  
  // 切换语言
  i18n.setLanguage('en_US');
  
  // 重新加载所有UI文本
  updateAllUI();
}

// ============================================================================
// 示例8：创建多语言下拉菜单
// ============================================================================

function example_language_selector_handler() {
  const selector = document.getElementById('languageSelect');
  
  selector.addEventListener('change', function(e) {
    const selectedLang = e.target.value;
    
    // 设置新语言
    i18n.setLanguage(selectedLang);
    
    // 更新所有UI文本
    updateAllUI();
    
    // 可选：显示通知
    console.log(`Language changed to: ${selectedLang}`);
  });
}

// ============================================================================
// 示例9：错误消息处理
// ============================================================================

function example_error_handling(error) {
  const errorType = error.type;
  
  switch(errorType) {
    case 'IMPORT_FAILED':
      const msg = i18n.t('error_import_failed', { error: error.details });
      alert(msg);
      break;
    
    case 'NETWORK_FAILED':
      const networkMsg = i18n.t('warning_visnetwork_failed');
      alert(networkMsg);
      break;
    
    case 'UNKNOWN':
    default:
      alert(i18n.t('unknown'));
      break;
  }
}

// ============================================================================
// 示例10：完整的更新UI函数（参考实现）
// ============================================================================

function example_update_all_ui() {
  // 页面标题
  document.title = i18n.t('page_title');
  
  // 所有按钮
  const buttons = {
    'exportMarksBtn': 'button_export',
    'importMarksBtn': 'button_import',
    'fitBtn': 'button_fit',
  };
  
  Object.entries(buttons).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = i18n.t(key);
    }
  });
  
  // 所有标签
  const labels = {
    'label_search': 'label_search',
    'label_display_nickname': 'label_display_nickname',
    'label_title_filter': 'label_title_filter',
    // ... 更多标签
  };
  
  Object.entries(labels).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = i18n.t(key);
    }
  });
}

// ============================================================================
// 示例11：条件渲染基于语言
// ============================================================================

function example_conditional_render_by_language() {
  const currentLang = i18n.getLanguage();
  
  if (currentLang === 'zh_CN') {
    // 针对中文的特殊处理
    console.log('Using Chinese-specific rendering');
  } else if (currentLang === 'en_US') {
    // 针对英文的特殊处理
    console.log('Using English-specific rendering');
  }
}

// ============================================================================
// 示例12：初始化和设置
// ============================================================================

function example_initialization() {
  // 1. 初始化i18n（自动检测浏览器语言）
  i18n.init();
  
  // 2. 在DOM加载完成后更新UI
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateAllUI);
  } else {
    updateAllUI();
  }
  
  // 3. 设置语言选择器
  const languageSelect = document.getElementById('languageSelect');
  if (languageSelect) {
    languageSelect.value = i18n.getLanguage();
    languageSelect.addEventListener('change', function(e) {
      i18n.setLanguage(e.target.value);
      updateAllUI();
    });
  }
}

// ============================================================================
// 实际应用示例：集成到现有代码
// ============================================================================

/**
 * 在 bc-graph-viewer.html 中的实际使用示例
 */

// 在加载文件时更新状态文本
function handleFileLoaded(memberCount) {
  const fileStatus = document.getElementById('file-status');
  if (memberCount > 0) {
    fileStatus.textContent = i18n.t('status_file_loaded', { count: memberCount });
  } else {
    fileStatus.textContent = i18n.t('status_file_not_loaded');
  }
}

// 在更新图表时处理空状态
function handleEmptyState(type) {
  if (type === 'groups') {
    return i18n.t('no_groups');
  } else if (type === 'circles') {
    return i18n.t('no_circles');
  } else if (type === 'members') {
    return i18n.t('no_members');
  }
}

// 处理搜索结果
function handleSearchResults(results) {
  if (results.length === 0) {
    return i18n.t('no_matches');
  }
  return results;
}

// 处理physics按钮状态
function updatePhysicsButtonText() {
  const btn = document.getElementById('physicsToggleBtn');
  const isEnabled = window.manualPhysicsEnabled; // 假设这是全局变量
  
  btn.textContent = isEnabled 
    ? i18n.t('button_physics_stop') 
    : i18n.t('button_physics_start');
}

// ============================================================================
// 注意事项
// ============================================================================

/**
 * 1. 确保在使用i18n之前已调用 i18n.init()
 * 2. 所有翻译键必须在 locales.js 中定义
 * 3. 参数使用 {paramName} 格式，会被替换为实际值
 * 4. 使用 i18n.t(key, params) 而不是字符串拼接
 * 5. 在语言改变时重新调用 updateAllUI() 更新UI
 * 6. 缺失的翻译会记录警告，并返回键本身
 */
