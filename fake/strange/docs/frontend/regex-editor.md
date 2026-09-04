# 正则编辑器

## 定位
全局正则脚本的增删改（发送侧在后端生效，显示侧在 MessageBubble 生效）。

## 文件
`frontend/src/components/RegexEditor.vue`
依赖 `stores/appdata`、`ToggleSwitch`、`utils/regex` 的 `normalizeRegexScript`。

## 输入
- `props.visible`；打开时若 `appdata` 未加载则 `store.load()`。
- 脚本列表来自 `useAppDataStore().regexScripts`。

## 输出 / 行为
- 列表：名称 + 正则 + 启用开关 + 删除。
- 表单字段：名称 / 正则（支持 `/pattern/flags`）/ flags / 替换（`$1`/`$&`）/ placement（作用于用户消息=1、AI消息=2）/ 仅发送侧(promptOnly) / 仅显示侧(markdownOnly) / minDepth / maxDepth。
- 保存 → `store.saveRegexScripts(list)` → `PUT /api/regex`。

## 依赖 / 被谁调用
- 被 `SessionListView` 头部「Regex」按钮打开。

## 扩展点 / 注意
- 脚本语义见 `docs/backend/regex-scripts.md`。
- 角色级脚本随卡导入（`extensions.regex_scripts`），暂未提供独立 UI。
