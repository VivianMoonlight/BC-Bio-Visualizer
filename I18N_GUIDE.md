# BC-Bio-Visualizer 国际化(i18n)实现指南

## 概述

该项目现已支持国际化（Internationalization, i18n），允许用户在多种语言之间切换。当前支持：
- **简体中文** (zh_CN)
- **英文** (en_US)

## 文件结构

### i18n系统文件

1. **i18n.js** - 核心i18n模块
   - 提供翻译管理和查询功能
   - 支持语言切换和参数化翻译
   - 自动保存用户选择的语言到localStorage

2. **locales.js** - 翻译资源
   - 包含所有UI文本的翻译
   - 分为 `messages_zh_CN` 和 `messages_en_US` 两部分
   - 自动注册到i18n模块

3. **bc-graph-viewer.html** - 主应用文件
   - 已集成i18n脚本
   - HTML中添加了语言选择器
   - JavaScript添加了`updateAllUI()`函数用于动态更新UI文本

## 使用方法

### 基础翻译

```javascript
// 获取翻译文本
const text = i18n.t('button_save');  // => "保存" 或 "Save"
```

### 带参数的翻译

```javascript
// 使用占位符 {paramName}
const msg = i18n.t('error_import_failed', { error: 'Network timeout' });
// => "导入分组数据失败：Network timeout" 或 
// => "Failed to import group data: Network timeout"
```

### 设置语言

```javascript
i18n.setLanguage('en_US');  // 切换到英文
i18n.setLanguage('zh_CN');  // 切换到中文
```

### 获取当前语言

```javascript
const lang = i18n.getLanguage();  // => 'zh_CN' 或 'en_US'
```

### 获取可用语言列表

```javascript
const langs = i18n.getAvailableLanguages();  // => ['zh_CN', 'en_US']
```

## 翻译键参考

### 使用中的翻译键列表

#### 页面和标题
- `page_title` - 页面HTML标题
- `main_title` - 主标题
- `status_file_not_loaded` - 文件未加载状态
- `status_file_loaded` - 文件已加载状态

#### 按钮
- `button_export` - 导出按钮
- `button_import` - 导入按钮
- `button_save` - 保存按钮
- `button_cancel` - 取消按钮
- `button_edit` - 编辑按钮
- `button_delete` - 删除按钮
- `button_create` - 创建按钮
- `button_physics_start` - 开始物理
- `button_physics_stop` - 停止物理
- `button_new_group` - 新建分组
- `button_new_circle` - 新建圈子

#### 标签和提示
- `label_show_circles` - 显示圈子
- `label_show_selected_circles` - 显示选中圈子
- `label_show_circle_outline` - 显示圈子轮廓
- `label_filter_members` - 筛选成员
- `label_fixed_members` - 固定成员
- `label_title_filter` - 头衔筛选
- `label_same_person_group` - 同一人分组

#### 占位符
- `placeholder_search` - 搜索框占位符
- `placeholder_filter_group` - 分组筛选占位符
- `placeholder_filter_circle` - 圈子筛选占位符
- `placeholder_group_name` - 分组名称占位符
- `placeholder_circle_name` - 圈子名称占位符

#### 空状态
- `no_groups` - 没有分组
- `no_circles` - 没有圈子
- `no_members` - 没有成员
- `no_matches` - 没有匹配项
- `group_not_selected` - 未选择分组
- `circle_not_selected` - 未选择圈子

#### 错误和警告
- `error_import_failed` - 导入失败消息
- `warning_visnetwork_failed` - vis-network加载失败
- `unknown` - 未知
- `unknown_with_id` - 带ID的未知字符串

## 集成步骤

### 在HTML中集成i18n

```html
<!-- 加载i18n脚本 -->
<script src="i18n.js"></script>
<script src="locales.js"></script>

<!-- 初始化i18n -->
<script>
  i18n.init();
  
  // 在DOM全部加载后更新UI
  document.addEventListener('DOMContentLoaded', function() {
    updateAllUI();
  });
</script>
```

### 在JavaScript中使用翻译

```javascript
// 分配翻译给元素
document.getElementById('button-save').textContent = i18n.t('button_save');

// 使用在alert/console中
alert(i18n.t('error_import_failed', { error: 'File not found' }));

// 动态创建带翻译的HTML
const html = `<button>${i18n.t('button_delete')}</button>`;
```

## 添加新语言

### 步骤1：创建新语言翻译

在 `locales.js` 中添加新语言：

```javascript
const messages_fr_FR = {
  'page_title': 'Visionneuse de graphe de profil BC',
  'button_save': 'Enregistrer',
  // ... 其他翻译
};
```

### 步骤2：注册新语言

```javascript
i18n.registerLanguage('fr_FR', messages_fr_FR);
```

### 步骤3：添加到语言选择器

```html
<select id="languageSelect">
  <option value="zh_CN">中文</option>
  <option value="en_US">English</option>
  <option value="fr_FR">Français</option>
</select>
```

## 自动化语言检测

i18n.js会根据浏览器语言自动选择合适的语言：

```javascript
i18n.init();  // 自动选择语言

// 如果浏览器语言是中文，使用 zh_CN
// 如果浏览器语言是英文，使用 en_US
// 否则默认使用 zh_CN
```

用户选择的语言会保存到localStorage，下次访问时会自动应用。

## 最佳实践

### 1. 键命名规范

- 使用蛇形命名法：`button_save`, `label_title_filter`
- 根据类型前缀：`button_*`, `label_*`, `placeholder_*`, `error_*`, `warning_*`
- 保持键简洁明确

### 2. 参数化翻译

```javascript
// 好的做法
i18n.t('message_count', { count: 5 });

// 避免硬编码
// 不好：每个数字都需要一条翻译
```

### 3. 文本更新时机

- 在DOM加载时调用`updateAllUI()`
- 当用户改变语言时调用`updateAllUI()`
- 动态生成的内容使用`i18n.t()`

### 4. 错误处理

i18n.js会在缺少翻译时：
1. 打印警告信息到控制台
2. 尝试降级到英文翻译
3. 如果都没有，返回参键本身作为备选

## 故障排除

### 翻译不显示

检查以下几点：
1. ✓ i18n.js 和 locales.js 是否正确加载
2. ✓ 是否调用了 `i18n.init()`
3. ✓ 翻译键是否存在于 locales.js 中
4. ✓ 检查浏览器开发者工具中的警告信息

### 语言切换不工作

1. ✓ 确认语言选择器元素存在
2. ✓ 检查浏览器控制台是否有JavaScript错误
3. ✓ 确认 `updateAllUI()` 函数存在且可调用

## 未来改进

- [ ] 添加更多语言（日语、韩语等）
- [ ] 实现复数形式的翻译
- [ ] 添加RTL(Right-to-Left)语言支持
- [ ] 创建翻译管理UI
- [ ] 支持日期和数字的本地化格式

## 许可证

该i18n系统遵循项目的原始许可证。
