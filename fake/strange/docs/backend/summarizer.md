# 总结

## 定位
把历史对话压缩成一段总结，用于控制上下文长度。分自动（对话内触发）与手动（Hist 面板）。

## 文件
- `backend/app/prompt/summarizer.py` — 总结核心
- `backend/app/routers/context.py` — 手动总结端点 + 上下文查看
- `backend/app/services/summarize_service.py` — 自动总结触发 `maybe_summarize`

## 输入

```python
async def summarize_history(settings, existing_summary, new_messages, custom_system_prompt=None) -> str
```

- `settings`：设置
- `existing_summary`：已有总结（为空 = 首次）
- `new_messages`：`[{"role","content"}, ...]`
- `custom_system_prompt`：自定义总结指令（空则用 `DEFAULT_SUMMARIZE_PROMPT`）

## 输出
- 总结文本（string；失败/空为 `""`）。
- 有已有总结时会追加 `MERGE_INSTRUCTION`，要求合并而非丢弃旧事实。

## API 端点（`routers/context.py`）

| 方法 | 路径 | 输入 | 输出 |
|---|---|---|---|
| GET | `/sessions/{id}/context` | — | 结构化上下文（Hist 面板） |
| POST | `/sessions/{id}/summarize` | `{"messageIds":[],"prompt":""}` | `{"summary":""}`（**不持久化**） |
| POST | `/sessions/{id}/summary/apply` | `{"summary":"","messageIds":[]}` | 更新后 session（写入 summary + lastSummarizedIndex） |

- `messageIds` 空数组 = 总结全部；`prompt` 空 = 用默认提示词。
- `apply` 会 `store.update_summary`，并据此在下一次组装上下文时只保留未总结部分。

## 依赖 / 被谁调用
- 依赖 `llm.call_chat_non_streaming`（kind=`summary`）。
- 被 `services/summarize_service.py`（自动总结）、`routers/context.py`（手动）调用。

## 扩展点 / 注意
- 改总结质量：改 `DEFAULT_SUMMARIZE_PROMPT` / `MERGE_INSTRUCTION`。
- 总结内容会被当作 system 消息 `[Previous conversation summary]` 注入（见 prompt-context.md）。
