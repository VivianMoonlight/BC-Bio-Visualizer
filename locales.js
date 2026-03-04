/**
 * BC-Bio-Visualizer Localization Strings
 * 国际化翻译资源
 * 
 * 包含两个语言的所有UI文本翻译：
 * - zh_CN: 简体中文
 * - en_US: English
 */

// 中文（简体）翻译
const messages_zh_CN = {
  // 页面标题和主标题
  'page_title': 'BC 资料图查看器',
  'main_title': 'BC 资料图查看器',
  
  // 文件状态
  'status_file_not_loaded': '未加载文件',
  'status_file_loaded': '已加载 {count} 个成员',
  'status_loading': '加载中...',
  
  // 按钮文本
  'button_export': '导出分组',
  'button_import': '导入分组',
  'button_physics_start': '开始物理',
  'button_physics_stop': '停止物理',
  'button_save': '保存',
  'button_cancel': '取消',
  'button_edit': '编辑',
  'button_delete': '删除',
  'button_create': '创建',
  'button_cancel_create': '取消',
  'button_new_group': '新建分组',
  'button_new_circle': '新建圈子',
  
  // 复选框和标签
  'label_show_circles': '显示圈子',
  'label_show_selected_circles': '显示选中圈子',
  'label_show_circle_outline': '显示圈子轮廓',
  'label_filter_members': '筛选成员',
  'label_fixed_members': '固定成员',
  'label_title_filter': '头衔筛选',
  'label_same_person_group': '同一人分组',
  
  // 占位符和提示
  'placeholder_search': '姓名 / 昵称 / ID',
  'placeholder_filter_group': '筛选分组',
  'placeholder_filter_circle': '筛选圈子',
  'placeholder_group_name': '分组名称',
  'placeholder_circle_name': '圈子名称',
  'placeholder_no_circles': '没有圈子',
  
  // 提示和帮助文本
  'hint_usage': '提示：双击节点固定可见性。按空格切换物理。拖动圈子重排树。',
  'tooltip_toggle_physics': '切换物理（空格）',
  'tooltip_drag_resize': '拖动调整大小',
  'tooltip_save': '保存',
  'tooltip_cancel': '取消',
  'tooltip_edit': '编辑',
  'tooltip_delete': '删除',
  'tooltip_create': '创建',
  'tooltip_drag_handle': '拖动移动',
  
  // 空状态消息
  'no_groups': '没有分组',
  'no_circles': '没有圈子',
  'no_members': '没有成员',
  'no_matches': '没有匹配项',
  'group_not_selected': '未选择分组',
  'circle_not_selected': '未选择圈子',
  'please_select_circle': '请选择一个圈子',
  'no_fixed_members': '没有固定成员',
  
  // 统计信息
  'stat_members_total': '成员总数',
  'stat_ownership_count': '主仆关系数',
  'stat_lovership_count': '爱情关系数',
  
  // 错误和警告
  'error_import_failed': '导入分组数据失败：{error}',
  'warning_visnetwork_failed': 'vis-network 加载失败。请检查网络连接或改用本地库。',
  'unknown': '未知',
  'unknown_with_id': '未知 (#{id})',
  
  // 数据类型和关系
  'relationship_ownership': '主仆关系',
  'relationship_lovership': '爱情关系',
  'group_unknown': '未知',
  
  // 菜单和设置
  'settings_language': '语言',
  'language_chinese': '中文',
  'language_english': 'English',
};

// 英文翻译
const messages_en_US = {
  // Page titles and main title
  'page_title': 'BC Profile Graph Viewer',
  'main_title': 'BC Profile Graph Viewer',
  
  // File status
  'status_file_not_loaded': 'File not loaded',
  'status_file_loaded': 'Loaded {count} members',
  'status_loading': 'Loading...',
  
  // Button text
  'button_export': 'Export Groups',
  'button_import': 'Import Groups',
  'button_physics_start': 'Start Physics',
  'button_physics_stop': 'Stop Physics',
  'button_save': 'Save',
  'button_cancel': 'Cancel',
  'button_edit': 'Edit',
  'button_delete': 'Delete',
  'button_create': 'Create',
  'button_cancel_create': 'Cancel',
  'button_new_group': 'New Group',
  'button_new_circle': 'New Circle',
  
  // Checkboxes and labels
  'label_show_circles': 'Show Circles',
  'label_show_selected_circles': 'Show Selected Circles',
  'label_show_circle_outline': 'Show Circle Outline',
  'label_filter_members': 'Filter Members',
  'label_fixed_members': 'Fixed Members',
  'label_title_filter': 'Title Filter',
  'label_same_person_group': 'Same Person Group',
  
  // Placeholders and hints
  'placeholder_search': 'Name / Nickname / ID',
  'placeholder_filter_group': 'Filter Group',
  'placeholder_filter_circle': 'Filter Circle',
  'placeholder_group_name': 'Group Name',
  'placeholder_circle_name': 'Circle Name',
  'placeholder_no_circles': 'No Circles',
  
  // Tips and help text
  'hint_usage': 'Tip: Double-click nodes to pin visibility. Press Space to toggle physics. Drag circles to rearrange.',
  'tooltip_toggle_physics': 'Toggle Physics (Space)',
  'tooltip_drag_resize': 'Drag to Resize',
  'tooltip_save': 'Save',
  'tooltip_cancel': 'Cancel',
  'tooltip_edit': 'Edit',
  'tooltip_delete': 'Delete',
  'tooltip_create': 'Create',
  'tooltip_drag_handle': 'Drag to Move',
  
  // Empty state messages
  'no_groups': 'No Groups',
  'no_circles': 'No Circles',
  'no_members': 'No Members',
  'no_matches': 'No Matches',
  'group_not_selected': 'Group not selected',
  'circle_not_selected': 'Circle not selected',
  'please_select_circle': 'Please select a circle',
  'no_fixed_members': 'No Fixed Members',
  
  // Statistics
  'stat_members_total': 'Total Members',
  'stat_ownership_count': 'Ownership Relationships',
  'stat_lovership_count': 'Love Relationships',
  
  // Errors and warnings
  'error_import_failed': 'Failed to import group data: {error}',
  'warning_visnetwork_failed': 'Failed to load vis-network. Please check your network connection or use a local library.',
  'unknown': 'Unknown',
  'unknown_with_id': 'Unknown (#{id})',
  
  // Data types and relationships
  'relationship_ownership': 'Ownership',
  'relationship_lovership': 'Love',
  'group_unknown': 'Unknown',
  
  // Menu and settings
  'settings_language': 'Language',
  'language_chinese': '中文',
  'language_english': 'English',
};

// 注册翻译
if (typeof i18n !== 'undefined') {
  i18n.registerLanguage('zh_CN', messages_zh_CN);
  i18n.registerLanguage('en_US', messages_en_US);
}
