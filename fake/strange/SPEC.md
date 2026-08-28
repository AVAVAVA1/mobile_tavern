# MobileTavern PC 移植 — 前后端契约（SPEC）

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

### 会话
- `GET /api/sessions` → `Session[]`（按最后活跃时间降序）
- `GET /api/sessions/{id}` → `Session`
- `POST /api/sessions/import` multipart 字段名 `file`（PNG 角色卡）→ 创建的 `Session`（200）。解析失败 → 400 `{"detail":"..."}`
- `DELETE /api/sessions/{id}` → 204
- `PATCH /api/sessions/{id}` body 可选 `{title?, characterBook?, agentBook?}` → 更新后的 `Session`
- `DELETE /api/sessions/{id}/context/{message_id}` → 把该消息加入 `deletedMessageIds`（从 LLM 上下文移除）→ 更新后的 `Session`

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

## 主题色（前端保持原深色主题）

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

- 用 `markdown-it`（`html:false`）渲染 markdown；渲染前用 JS 预处理函数把 HTML 标签转 markdown（`<br>`→换行、`<hr>`→`---`、`<b>/<strong>`→`**`、`<i>/<em>`→`*`、`<s>/<del>/<strike>`→`~~`、`<table>/<tr>/<td>/<th>`→markdown 表格、`<code>`→反引号、`<pre>`→围栏、`<blockquote>`→`>`、`<li>`→`-`、其余标签去标签保留文本），并把三种引号 `"..."` `“...”` `「...」` 包裹文本包成 `**...**`（assistant 消息中 strong 显示为 `#f0c040`）。
- 对话气泡：user 右对齐红底白字；assistant 左对齐 `#0f3460` 底。
- 思维链解析：从消息内容中提取 `<thinking>...</thinking>` / `【思考】...【/思考】` / `{思考}...{/思考}`，折叠显示“Chain of Thought”。
- Agent 模式：assistant 气泡顶部显示可折叠“⚙ Agent Workflow · Lore: P{x}/W{y}/S{z}”，内含 Writing Guide 前 800 字、Status Bar 前 400 字。
- `messageType=="status"` 的消息渲染为居中的“📊 Status Update”可折叠气泡。
- 对话滚动到底部、接近底部时自动跟随、生成中显示“typing…”与 Stop 按钮。
- PC 上不需要滑动手势：会话卡片上用可见的小按钮实现 Edit(标题)/Book(世界书)/Del(删除)。
