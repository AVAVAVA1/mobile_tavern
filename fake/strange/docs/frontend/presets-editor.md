# 预设编辑器

## 定位
全局预设（system/user/assistant）的增删改与启用。

## 文件
`frontend/src/components/PresetsEditor.vue`
依赖 `stores/appdata`、`ToggleSwitch`。

## 输入
- `props.visible`；列表来自 `useAppDataStore().presets`。

## 输出 / 行为
- 列表：名称 + role 徽章 + 内容预览 + 启用开关 + 删除。
- 表单：名称 / role（system/user/assistant）/ 内容。
- 保存 → `store.savePresets(list)` → `PUT /api/presets`。

## 依赖 / 被谁调用
- 被 `SessionListView` 头部「Presets」按钮打开。

## 扩展点 / 注意
- 注入规则见 `docs/backend/presets.md`（system→系统提示词，user/assistant→消息）。
- 内置预设库默认空，用户自行增删。
