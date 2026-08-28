# LLM 客户端

## 定位
后端访问「OpenAI 兼容 API」的**唯一出口**。流式与一次性调用都收敛到这里。

## 文件
`backend/app/llm.py`

## 输入

所有函数都吃同一份 `settings`（来自 `store.get_settings()`），关键字段：
- `apiKey`：Bearer token
- `model`：模型名
- `baseUrl`：OpenAI 兼容服务根地址（会自动拼 `/chat/completions`）

以及 `messages`：`[{"role": "system|user|assistant", "content": "..."}, ...]`（内部只取 role/content，其它字段丢弃）。

### 函数签名

```python
async def stream_chat(settings, messages, check_disconnect=None, kind="chat") -> AsyncIterator[str]
async def call_chat_non_streaming(settings, messages, tools=None, tool_choice=None, kind="llm") -> dict
```

- `check_disconnect`：可选 async 可调用，返回真值则中断流式读取（用于前端 Stop）。
- `tools` / `tool_choice`：function calling 用；`tools` 非空时自动带 `tool_choice`（默认 `"auto"`）。
- `kind`：日志标签（`chat` / `status` / `summary` / `reply_meta` / `image_prompt` / `card_analysis`）。

## 输出
- `stream_chat`：逐段 `yield` 正文增量字符串；发送前记录原始请求，结束后记录累计回复。
- `call_chat_non_streaming`：返回上游**完整 JSON 响应**（`resp.json()`），调用方自己取 `choices[0].message`。
- 异常：上游非 200 时抛 `RuntimeError("API error <code>: <body前2000字>")`。

## 依赖
- `logging.log_llm_request` / `log_llm_response`（每次调用自动记录原始提示词/回复）。

## 被谁调用
- `routers/chat.py`（正文流式、状态栏一次性）
- `prompt/summarizer.py`、`reply_meta.py`、`analysis.py`、`imagegen.py`

## 扩展点 / 注意
- 换提供商 / 加重试 / 加超时策略：只改这里。
- API Key 只在 header 里，**不进入日志**。
- `stream_chat` 已含 `request.is_disconnected` 这样的 disconnect 检查注入点（由路由层传进来）。
