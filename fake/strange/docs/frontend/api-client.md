# API 客户端

## 定位
前端与后端的**唯一通道**。所有 REST + SSE 都封装在这里，组件/页面不允许直接 fetch。

## 文件
- `frontend/src/api.ts` — REST + SSE 封装
- `frontend/src/types.ts` — 前后端共享的 TS 类型（对应 SPEC 数据模型）

## 约定
- `BASE = "/api"`，走同源；Vite 开发代理把 `/api` 转发到 `127.0.0.1:8100`。
- 错误：非 2xx 时从响应体取 `detail` 作为 `Error.message`（`extractError`）。
- 204 视为 `undefined`。

## 输出（导出的函数）

| 函数 | 输入 | 返回 |
|---|---|---|
| `getSettings()` | — | `AppSettings` |
| `putSettings(partial)` | 部分设置 | `AppSettings` |
| `getSessions()` | — | `Session[]` |
| `getSession(id)` | id | `Session` |
| `importCard(file)` | File | `Session` |
| `deleteSession(id)` | id | void |
| `patchSession(id, body)` | `{title?,characterBook?,agentBook?,statusSchema?}` | `Session` |
| `removeFromContext(id, messageId)` | — | `Session` |
| `getContext(id)` | id | `ContextView` |
| `summarize(id, {messageIds,prompt})` | — | `{summary}` |
| `applySummary(id, {summary,messageIds})` | — | `Session` |
| `testComfyUI(url)` | url | `{ok,message}` |
| `generateComfyUI()` | — | `{ok,message,url?,filename?}` |
| `generateImageForMessage(sessionId, messageId)` | — | `ChatMessage` |
| `listWorkflows()` / `getWorkflow(name)` / `saveWorkflow(name, content)` | — | 见签名 |
| `streamChat(id, text, callbacks)` | 文本 + 回调 | `{abort}` |

## SSE（`streamChat`）
- 事件回调（`StreamChatCallbacks`）：`onDelta` / `onStatusDelta` / `onReplyMeta` / `onImageGenerating` / `onImage` / `onSummary` / `onDone` / `onError`。
- 支持 `signal`（外部 AbortController）或返回 `{abort()}` 停止生成。
- 解析 `data: <json>` 行，按 `type` 分发。

## 依赖 / 被谁调用
- 被 stores 与组件调用（`ChatView`/`SettingsModal`/`PicGenerateModal`/`HistoryManager` 等）。

## 扩展点 / 注意
- 新增端点：后端加路由 → 这里加函数 → `types.ts` 加类型 → 组件调用。
- SSE 事件新增 `type`：在 `StreamEvent` + `switch` 里加分支。
