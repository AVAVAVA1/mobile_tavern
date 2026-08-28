# 生图面板

## 定位
生图来源配置、workflow 列表/编辑、连接测试、测试生图。

## 文件
`frontend/src/components/PicGenerateModal.vue`
依赖 `useSettingsStore` + `api.ts`。

## 输入
- `props.visible`；打开时从 `settingsStore.settings.picGenerate` 初始化。
- `PIC_SOURCES` 注册表（当前 comfyui）：`{ id, label, defaults, fields[] }`，字段类型 `url | workflow | textarea`。

## 输出 / 行为
- 表单 `picGenerate = { source, sources: { [source]: {...} } }`。
- `testConnection()` → `api.testComfyUI(url)`。
- `listWorkflows()` / `getWorkflow(name)` / `saveWorkflow(name, content)` → 管理 `workflows/*.json`。
- `testGenerate()` → 先保存当前配置再 `api.generateComfyUI()`（用 promptPrefix 直接出图，不走 LLM 转写）。
- `save()` → `settingsStore.save({ picGenerate })`。

## 依赖 / 被谁调用
- 依赖 `api.ts`、`stores/settings`；被 `SessionListView` 挂载。

## 扩展点 / 注意
- 新增来源：在 `PIC_SOURCES` 加一项（defaults + fields），后端加对应提交/测试逻辑。
- workflow 编辑器会提示缺失 `%PositivePrompt%` / `%NegativePrompt%` 占位符。
