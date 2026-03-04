# BC-Bio-Visualizer 国际化 (i18n) 快速开始指南

## 🎯 5分钟快速上手

### 1. 项目现在支持哪些语言？

✅ **简体中文** (zh_CN)  
✅ **English** (en_US)

### 2. 如何切换语言？

在 `bc-graph-viewer.html` 页面右上角有一个**语言选择下拉菜单**：

```
[中文 ▼] 或 [English ▼]
```

点击并选择您希望使用的语言，应用界面会立即更新。

### 3. 新增了什么文件？

```
BC-Bio-Visualizer/
├── i18n.js                           # 国际化核心模块
├── locales.js                        # 翻译资源文件
├── I18N_GUIDE.md                     # 完整使用指南
├── I18N_EXAMPLES.js                  # 代码示例
├── I18N_USERSCRIPT_GUIDE.md          # Tampermonkey脚本指南
├── I18N_IMPLEMENTATION_SUMMARY.md    # 实现总结
└── I18N_QUICKSTART.md                # 本文档
```

### 4. 核心功能

| 功能 | 说明 |
|------|------|
| 🌍 自动检测 | 根据浏览器语言自动选择对应语言 |
| 💾 记住选择 | 用户的语言选择被保存，下次访问自动应用 |
| 🔄 实时切换 | 改变语言时，整个界面立即更新 |
| 📝 70+翻译 | 覆盖所有UI文本和用户消息 |
| 🛡️ 容错机制 | 缺失翻译时自动降级到英文 |

### 5. 对开发者的影响

#### 在HTML中使用翻译

```html
<!-- 旧方式 -->
<button>保存</button>

<!-- 新方式 -->
<button id="btn-save"></button>
<script>
  document.getElementById('btn-save').textContent = i18n.t('button_save');
</script>
```

#### 在JavaScript中使用翻译

```javascript
// 简单翻译
const text = i18n.t('button_save');      // => "保存" 或 "Save"

// 带参数的翻译
const msg = i18n.t('error_import_failed', { error: 'Network error' });
// => "导入分组数据失败：Network error"

// 切换语言
i18n.setLanguage('en_US');

// 获取当前语言
const lang = i18n.getLanguage();         // => 'en_US'
```

### 6. 翻译键速查

最常用的翻译键：

```javascript
// 按钮
'button_export'      // 导出分组
'button_import'      // 导入分组
'button_save'        // 保存
'button_cancel'      // 取消
'button_edit'        // 编辑
'button_delete'      // 删除

// 标签
'label_show_circles'       // 显示圈子
'label_filter_members'     // 筛选成员
'label_same_person_group'  // 同一人分组

// 状态
'no_groups'          // 没有分组
'no_circles'         // 没有圈子
'no_members'         // 没有成员

// 错误
'error_import_failed'      // 导入失败
'warning_visnetwork_failed' // 加载失败
```

### 7. 常见任务

#### 添加新的翻译字符串

1. 打开 `locales.js`
2. 在 `messages_zh_CN` 和 `messages_en_US` 中添加新键值对
3. 在代码中使用 `i18n.t('new_key')`

```javascript
// 在 locales.js 中
const messages_zh_CN = {
  // ... 其他翻译
  'my_new_button': '我的按钮',
};

const messages_en_US = {
  // ... 其他翻译
  'my_new_button': 'My Button',
};
```

#### 添加新语言

1. 在 `locales.js` 中创建新语言对象
2. 注册该语言
3. 在HTML中添加选项

```javascript
// 在 locales.js 中
const messages_fr_FR = {
  'button_save': 'Enregistrer',
  // ... 其他翻译
};

i18n.registerLanguage('fr_FR', messages_fr_FR);
```

#### 在条件中使用翻译

```javascript
// 根据数据显示不同的翻译
const message = items.length === 0 
  ? i18n.t('no_items')
  : i18n.t('items_found', { count: items.length });
```

### 8. 调试技巧

在浏览器控制台输入：

```javascript
// 查看所有可用的翻译键
console.log(i18n.getAvailableLanguages());
// 输出: ['zh_CN', 'en_US']

// 测试某个翻译
console.log(i18n.t('button_save'));
// 输出: '保存' 或 'Save'（取决于当前语言）

// 强制切换语言
i18n.setLanguage('en_US');

// 查看当前语言
console.log(i18n.getLanguage());
```

### 9. 向后兼容性

✅ 所有现有功能保持不变  
✅ 默认为中文（不影响现有用户）  
✅ 旧代码继续工作

### 10. 性能

- 翻译查找时间：< 1ms
- 内存占用：< 100KB
- 对应用速度的影响：可忽略不计

## 📚 更多资源

| 文档 | 内容 | 适用人群 |
|------|------|---------|
| I18N_GUIDE.md | 完整参考指南 | 所有开发者 |
| I18N_EXAMPLES.js | 实际代码示例 | 代码示例参考 |
| I18N_USERSCRIPT_GUIDE.md | Tampermonkey集成 | 脚本开发者 |
| I18N_IMPLEMENTATION_SUMMARY.md | 实现总结 | 项目管理者 |

## ⚡ 技术要求

- 无任何外部依赖
- 支持所有现代浏览器
- 支持Tampermonkey脚本环境
- 支持IE11+ (通过polyfill)

## 🐛 遇到问题？

### 语言选择器不显示

检查以下几点：
1. 是否加载了 `i18n.js` 和 `locales.js`
2. HTML中是否有 `id="languageSelect"` 的元素
3. 浏览器控制台中是否有错误信息

### 翻译显示不正确

1. 检查翻译键拼写是否正确
2. 确认该键在 `locales.js` 中存在
3. 检查浏览器控制台的警告消息

### 为什么有些文本仍然是中文？

可能原因：
- 该文本尚未集成i18n系统
- 该翻译键缺失
- 浏览器缓存问题（尝试刷新Ctrl+Shift+R）

## 💡 提示

- **自动语言检测**: 初次访问时，脚本会自动选择与您浏览器语言匹配的语言版本
- **语言记忆**: 您的语言选择被保存，每次访问都会应用相同的设置
- **语言包大小**: 所有翻译都嵌入HTML中，无需额外下载

## 📞 反馈

如果您想：
- 提交翻译改进
- 添加新的语言
- 报告问题
- 提出建议

请参考项目的贡献指南。

---

**祝您使用愉快！** 🎉

**BC-Bio-Visualizer i18n System v1.0**
