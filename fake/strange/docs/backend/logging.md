# 统一日志

## 定位
把「发给 LLM 的原始提示词、LLM 的原始回复、生图提示词」写到**后端控制台 + 文件**，调试时不必读源码。

## 文件
`backend/app/logging.py`

## 输入

```python
log_llm_request(kind, model, base_url, messages, extra=None)   # 一次 LLM 请求
log_llm_response(kind, text, extra=None)                        # 一次 LLM 回复
log_image_prompt(source_text, tags, positive, negative, workflow, url="")  # 一次生图提示词
get_logger() -> logging.Logger
```

- `kind`：调用类型标签（`chat`/`status`/`summary`/`reply_meta`/`image_prompt`/`card_analysis`）。
- `messages`：要发给 LLM 的完整消息数组（会被 JSON 序列化打印）。
- `text`：流式=累计正文；非流式=完整响应 JSON 字符串。

## 输出 / 副作用
- 控制台：uvicorn 标准输出（后端终端），`INFO` 级别。
- 文件：`backend/logs/app.log`，`RotatingFileHandler`（单份 2MB，最多保留 3 份）。
- **安全**：日志只含 message 内容与 `model`/`url`，**永不打印 API Key**（Key 在 header 中）。

## 依赖 / 被谁调用
- 被 `llm.py`（请求+回复）、`imagegen.py`（生图提示词）调用。
- 业务代码不自行 `print`，统一走这里。

## 扩展点 / 注意
- 想按类型分文件、改级别、加时间戳字段：只改这里。
- `logger.propagate = False` 避免和 uvicorn 的 root logger 重复打印。
- 日志文件体积可控；如需关闭，把 logger 级别调到 `WARNING` 或删除 handler 即可。
