# 对话引擎（SSE）

## 定位
编排一次对话的完整流程：流式生成正文 → 可选状态栏更新 → 填回复元数据 → 可选自动生图 → 可选自动总结。

## 文件（已按层拆分）
- `backend/app/routers/chat.py` — **薄壳**：只做校验 + SSE 序列化
- `backend/app/services/chat_service.py` — **编排主流程** `run_chat_turn`
- `backend/app/services/status_service.py` — 状态栏更新子服务 `update_status`
- `backend/app/services/summarize_service.py` — 自动总结子服务 `maybe_summarize`
- `backend/app/services/image_service.py` — 自动生图子服务 `maybe_generate_image`

## API 端点

| 方法 | 路径 | 输入 | 输出 |
|---|---|---|---|
| POST | `/api/sessions/{id}/chat` | `{"text": "用户输入"}` | `text/event-stream` |

- 前置校验（在 router）：session 存在、`apiKey` 非空、`text` 非空（否则 400/404）。

## 编排主流程（`run_chat_turn`）

```python
async def run_chat_turn(session_id, text, check_disconnect=None) -> AsyncIterator[dict]
```

逐条产出事件 dict（router 用 `_sse()` 序列化成 `data: <json>`）：

1. 写入 user + 空 assistant 消息。
2. 组装 `history`（排除本次 assistant 与 `status`/`image` 类型）。
3. `build_conversation_context(...)` 组装原始提示词 → `stream_chat(...)` 流式生成（自动记录日志），yield `delta`。
4. `statusBarEnabled` 时：`status_service.update_status(...)`，yield `status_delta`。
5. `fill_reply_meta(...)` 填元数据表（写回 assistant 消息 `replyMeta`），yield `reply_meta`。
6. `meta.generateImage` 时：yield `image_generating`，再 `image_service.maybe_generate_image(...)`，成功则 yield `image`。
7. `store.persist()`；`summarize_service.maybe_summarize(...)` 满足阈值则 yield `summary`；最后 yield `done`。
8. `asyncio.CancelledError` → `persist()` 后抛出（前端 Stop）；其它异常 → `persist()` + yield `error` + `done`。

## SSE 事件（`data: <json>\n\n`）

| type | 字段 | 含义 |
|---|---|---|
| `delta` | `content` | 助手正文增量 |
| `status_delta` | `content` | 状态栏更新结果 |
| `reply_meta` | `meta` | 回复元数据表 |
| `image_generating` | — | 开始自动生图 |
| `image` | `image` | 生成的图片消息 |
| `summary` | `summary`, `lastSummarizedIndex` | 自动总结结果 |
| `error` | `message` | 出错（非中断） |
| `done` | — | 结束 |

## 依赖 / 被谁调用
- `chat_service` 依赖：`store`、`llm`、`prompt.template`、`reply_meta`，以及三个子服务。
- 被 `routers/chat.py` 调用；前端 `api.streamChat` 触发，`done`/`error` 后 `GET /sessions/{id}` 同步最终态。

## 扩展点 / 注意
- 新增「回复后动作」：在 `run_chat_turn` 步骤 4~6 之间插入，按同样模式 yield 事件；复杂逻辑拆成独立子服务。
- 子服务契约：输入明确的参数 → 返回事件 dict（或 None），只通过 `store` 写状态，不自己序列化 SSE。
