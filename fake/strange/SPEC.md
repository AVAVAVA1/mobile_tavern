# 2b2（原 MobileTavern）PC 移植 — 前后端契约（SPEC）

本项目把原 Expo/React Native 角色扮演 app 移植为 PC 前后端分离架构。

- 后端：Python 3.12 + FastAPI，位于 `backend/`，复用 `fake/strange/.venv`
- 前端：Vue 3 + Vite + TypeScript，位于 `frontend/`
- 所有数据以 **camelCase** JSON 在前后端之间传输（与原来 TS 代码一致）
- 功能视角的技术文档见 `docs/README.md`（本文档是端点的唯一契约权威）

## 运行约定

- 后端默认 `http://127.0.0.1:8100`
- 前端开发服务器由 Vite 启动，`/api` 前缀代理到后端 `http://127.0.0.1:8100`
- 前端统一用相对路径 `/api/...` 请求；SSE 也用 fetch（POST + ReadableStream）走同源 `/api`

---

## 数据模型（JSON 形状，camelCase）

### AppSettings

```json
{
  "apiKey": "",
  "model": "gpt-3.5-turbo",
  "baseUrl": "https://api.openai.com/v1",
  "summarizeThreshold": 30,
  "userName": "User",
  "authorNoteText": "",
  "authorNoteDepth": 4,
  "storyStringTemplate": "",
  "autoSummarize": true,
  "customSystemPrompt": "",
  "agentMode": false
}
```

### ChatMessage

```json
{
  "id": "string",
  "role": "system|user|assistant",
  "content": "string",
  "timestamp": 1234567890,
  "messageType": "message|status",
  "workflowV2": {
    "writingGuide": "string",
    "statusBar": "string",
    "loreCounts": { "planner": 0, "writer": 0, "status": 0 }
  }
}
```
`messageType` 与 `workflowV2` 可选。

### Session

```json
{
  "id": "string",
  "characterCard": {
    "spec": "chara_card_v2",
    "spec_version": "2.0",
    "data": {
      "name": "", "description": "", "personality": "", "scenario": "",
      "first_mes": "", "mes_example": "",
      "creator_notes": null, "system_prompt": null, "post_history_instructions": null,
      "alternate_greetings": null, "character_version": null, "tags": null,
      "creator": null, "extensions": null,
      "character_book": null, "agent_book": null,
      "create_date": null, "avatar": null, "world_description": null
    }
  },
  "messages": ["ChatMessage..."],
  "createdAt": 1234567890,
  "userName": "User",
  "title": "",
  "summary": "",
  "lastSummarizedIndex": -1,
  "deletedMessageIds": [],
  "status": "",
  "previousStatus": ""
}
```

---

## REST 端点

### 通用
- `GET /api/health` → `{"status":"ok"}`

### 设置
- `GET /api/settings` → `AppSettings`
- `PUT /api/settings`  body=部分 `AppSettings` → 完整 `AppSettings`（合并持久化）

### 全局预设 / 正则脚本 / 世界书（RP-Hub 增强，持久化在 `backend/data/app_data.json`）
- `GET /api/presets` → 预设数组；`PUT /api/presets` body=预设数组 → 完整数组
- `GET /api/regex` → 正则脚本数组；`PUT /api/regex` body=脚本数组 → 完整数组
- `GET /api/worldinfo` → 世界书条目数组；`PUT /api/worldinfo` body=条目数组 → 完整数组

数据形状：
- 预设：`{"name","content","enabled","role":"system|user|assistant"}`
- 正则脚本：`{"name","regex","flags","replacement","placement":[1,2],"markdownOnly","promptOnly","runOnEdit","minDepth","maxDepth","scope","enabled"}`
- 世界书条目：`{"comment","content","enabled","scope","keys","useRegex","constant","position","order","depth","scanDepth","probability","useProbability"}`

### 会话
- `GET /api/sessions` → `Session[]`（按最后活跃时间降序）
- `GET /api/sessions/{id}` → `Session`
- `POST /api/sessions/import` multipart 字段名 `file`（PNG 角色卡）→ 创建的 `Session`（200）。解析失败 → 400 `{"detail":"..."}`
- `DELETE /api/sessions/{id}` → 204
- `PATCH /api/sessions/{id}` body 可选 `{title?, characterBook?, agentBook?}` → 更新后的 `Session`
- `DELETE /api/sessions/{id}/context/{message_id}` → 把该消息加入 `deletedMessageIds`（从 LLM 上下文移除）→ 更新后的 `Session`
- `GET /api/sessions/{id}/export` → 导出角色卡 PNG（V2 `chara` chunk，含世界书/正则脚本；Content-Disposition attachment）

### 角色卡生成
- `POST /api/cards/generate` body `{"prompt":"描述"}` → 角色卡 dict（LLM 生成，不持久化）
- `POST /api/cards/create` body `{"card": {...}}` → 新建的 `Session`

### 对话（SSE）
- `POST /api/sessions/{id}/chat`  body `{"text":"用户输入"}` → `text/event-stream`
  事件行格式：`data: <json>\n\n`，`json` 含 `type` 字段：
  - `{"type":"delta","content":"..."}` 助手正文增量（追加到正在生成的助手气泡）
  - `{"type":"status_delta","content":"..."}` Agent 模式下状态栏增量（追加到临时“Status Update”气泡）
  - `{"type":"workflow","workflowV2":{...}}` Agent 模式：写作完成后发一次（writingGuide/statusBar/loreCounts）
  - `{"type":"summary","summary":"...","lastSummarizedIndex":N}` 若触发了自动总结（可选）
  - `{"type":"error","message":"..."}` 出错（非中断类）
  - `{"type":"done"}` 结束

  前端收到 `done` 或 `error` 后，重新 `GET /api/sessions/{id}` 同步最终会话状态。

  停止生成：前端 abort 该 fetch（关闭连接），后端检测到客户端断开即停止调用上游 LLM，并保留已生成内容。

### 历史管理 / 上下文
- `GET /api/sessions/{id}/context` → 结构化上下文（用于“Hist”面板展示）：

```json
{
  "mode": "normal|agent",
  "chatMessages": [{"role":"user|assistant","content":"","id":""}],
  "systemMessages": [{"role":"system","content":""}],
  "plannerSystem": [{"role":"system","content":""}],
  "writerSystem": [{"role":"system","content":""}],
  "statusSystem": [{"role":"system","content":""}],
  "injectedEntries": { "planner": ["title"], "writer": ["title"], "status": ["title"] }
}
```
  - normal 模式：`systemMessages` 有值；agent 模式：`plannerSystem/writerSystem/statusSystem` 有值、`injectedEntries` 有值。另一组为空数组。

- `POST /api/sessions/{id}/summarize` body `{"messageIds":["..."],"prompt":""}` → `{"summary":"..."}`（**不**持久化，前端展示后可 Apply）
  - `messageIds` 为空数组 = 总结全部
- `POST /api/sessions/{id}/summary/apply` body `{"summary":"...","messageIds":["..."]}` → 更新后的 `Session`（写入 summary 与 lastSummarizedIndex）

---

## 主题色（深色为默认，浅色主题通过侧边栏 🌙/☀️ 按钮切换，`html[data-theme="light"]` 覆盖 CSS 变量）

深色主题色板：

| 用途 | 色值 |
|---|---|
| 页面背景 | `#1a1a2e` |
| 头部/卡片背景 | `#16213e` |
| 主强调色（发送按钮/用户气泡/标题） | `#e94560` |
| 助手气泡背景 | `#0f3460` |
| 正文字色 | `#e0e0e0` |
| 次要文字 | `#a0a0b8` / `#888` / `#555` |
| 边框 | `#2a2a4a` |
| 引用高亮（assistant strong） | `#f0c040` |
| 状态/成功色 | `#10b981` |
| 链接色（assistant） | `#ffa0af` |

字体：正文 15px / line-height 21px。

## 前端技术要点（务必遵守）

- 用 `markdown-it`（`html:true` + `breaks:true`）渲染 markdown；DOMPurify 消毒并放宽白名单（style/svg/details/summary/iframe/srcdoc/sandbox/onclick 等），三种引号 `"..."` `“...”` `「...」` 包裹文本包成 `**...**`（assistant 消息中 strong 显示为 `#f0c040`）。
- HTML 渲染（对齐 RP-Hub）：完整 HTML 文档（`<!doctype html>`/`<html>`）或 HTML 代码块（```html/```xml 或形似 HTML）渲染为沙箱 `iframe`；iframe 通过 postMessage + ResizeObserver **自适应内容高度**（无内部滚动、无空白）；块级 HTML 直接消毒渲染；混合内容剥离 html/head/body 结构标签。
- 对话气泡：user 右对齐红底白字；assistant 左对齐 `#0f3460` 底。
- 思维链解析：`parseCot` 提取 `<think>/<cot>`（含未闭合）与尾部 `[系统指令:]`，兜底 `【思考】`/`{思考}`；渲染为可折叠“💡 Thinking”卡片 + “📌 临时指令”卡片；显示侧正则只作用于正文 main，不作用于思维链/系统指令。
- Agent 模式：assistant 气泡顶部显示可折叠“⚙ Agent Workflow · Lore: P{x}/W{y}/S{z}”，内含 Writing Guide 前 800 字、Status Bar 前 400 字。
- `messageType=="status"` 的消息渲染为居中的“📊 Status Update”可折叠气泡。
- 对话滚动到底部、接近底部时自动跟随、生成中显示“typing…”与 Stop 按钮。
- PC 上不需要滑动手势：会话卡片上用可见的小按钮实现 Edit(标题)/Book(世界书)/Del(删除)。
