# 设置页面

## 定位
全局设置面板：API Key / 模型 / Base URL / 上下文（系统提示词、总结、Author's Note、Story String）/ 状态栏开关。

## 文件
`frontend/src/components/SettingsModal.vue`
依赖 `ToggleSwitch.vue`、`useSettingsStore`。

## 输入
- `props.visible`；打开时从 `settingsStore.settings` 初始化表单。

## 字段 ↔ AppSettings
`User Name`→userName、`Status Bar`→statusBarEnabled、`API Key`→apiKey、`Model`→model、`Base URL`→baseUrl、`Custom System Prompt`→customSystemPrompt、`Summarize Threshold`→summarizeThreshold、`Auto Summarize`→autoSummarize、`Author's Note`→authorNoteText、`Author's Note Depth`→authorNoteDepth、`Story String Template`→storyStringTemplate。

- Presets：OpenAI / DeepSeek / Grok / Ollama 快速填 baseUrl+model。

## 输出
- `save()` → `settingsStore.save(partial)`（PUT，后端合并持久化）。
- API Key 会先做可见 ASCII 清洗。

## 依赖 / 被谁调用
- 依赖 `stores/settings`；被 `SessionListView` 挂载。

## 扩展点 / 注意
- 新增设置项：types.ts 加字段 → 后端 AppSettings → 这里加表单控件 + `initFromStore`/`handleSave`。
