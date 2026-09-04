# 设置

## 定位
读写全局设置；支持 `config.json` 启动时预填。

## 文件
- `backend/app/routers/settings.py`（端点）
- `backend/app/store.py`（`get_settings` / `update_settings` / `_apply_config_file` / `_write_config_file`）
- `backend/app/models.py`（`AppSettings` 默认值）
- `config.json`（项目根目录，用户手写启动配置）

## API 端点

| 方法 | 路径 | 输入 | 输出 |
|---|---|---|---|
| GET | `/api/settings` | — | `AppSettings`（camelCase） |
| PUT | `/api/settings` | 部分 `AppSettings` | 合并后的完整 `AppSettings` |

## 设置字段（AppSettings）

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `apiKey` | str | "" | LLM API Key |
| `model` | str | "gpt-3.5-turbo" | 模型名 |
| `baseUrl` | str | https://api.openai.com/v1 | OpenAI 兼容根地址 |
| `summarizeThreshold` | int | 30 | 每 N 条触发自动总结（0=关） |
| `userName` | str | "User" | 用户名（`{{user}}` 替换） |
| `authorNoteText` | str | "" | Author's Note 正文 |
| `authorNoteDepth` | int | 4 | AN 注入深度 |
| `storyStringTemplate` | str | "" | Story String 模板（空=默认） |
| `autoSummarize` | bool | true | 是否自动总结 |
| `customSystemPrompt` | str | "" | 全局系统提示词（前置） |
| `statusBarEnabled` | bool | false | 状态栏开关 |
| `enableThinking` | bool | true | 向 LLM 请求开启思考模式（发送 `thinking: {"type":"enabled"}` + `reasoning_effort`） |
| `reasoningEffort` | str | "high" | 思考强度：low / medium / high |
| `picGenerate` | dict | comfyui 默认 | 生图配置（见 image-generation.md） |

## config.json 映射
- `config.json` 里用「展示名」键（`User Name` / `API Key` / `Model` / `Base URL` / `Summarize Threshold` / `Auto Summarize` / `Custom System Prompt` / `Author's Note` / `Author's Note Depth` / `Story String Template` / `Status Bar` / `Enable Thinking`）。
- `picGenerate` 直接以 camelCase 写进 config.json。
- 启动时 `_apply_config_file()` **最后**覆盖已持久化设置；`PUT /api/settings` 会同时写回 settings.json 和 config.json（`_write_config_file`）。

## 依赖 / 被谁调用
- 依赖 `store.py`。被前端 `SettingsModal`、`PicGenerateModal`、`ChatView`（读 apiKey）、路由层读取。

## 扩展点 / 注意
- 新增设置字段三步：models 加默认值 → store 的映射表登记（可选）→ 前端 `types.ts` + `SettingsModal` 加 UI。
- `update_settings` 只接受 `AppSettings` 里已声明的字段，未知字段被忽略。
