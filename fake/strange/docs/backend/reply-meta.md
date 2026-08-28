# 回复元数据

## 定位
每次 AI 回复附带一张元数据表（当前只有一个字段：是否值得生图），用于**触发后续动作**。表不计入历史。

## 文件
`backend/app/reply_meta.py`

## 输入

```python
async def fill_reply_meta(settings, reply_text, user_last_text, history_hint=None) -> ReplyMeta
```

- `reply_text`：AI 本次回复
- `user_last_text`：用户最新发言
- `history_hint`：预留（当前未用）

## 输出
- `ReplyMeta`（Pydantic）：`{ "generateImage": bool, "imageReason": str }`。
- 由 function calling `set_reply_meta` 填写；解析失败/异常 → 默认 `ReplyMeta()`（generateImage=False）。
- 结果写回 assistant 消息的 `replyMeta` 字段（由 chat.py 负责），前端 `MessageBubble` 调试显示。

## 依赖 / 被谁调用
- 依赖 `llm.call_chat_non_streaming`（kind=`reply_meta`）。
- 被 `routers/chat.py` 在正文生成后调用。

## 扩展点 / 注意
- 新增「回复后动作」（如自动生成语气、触发工具调用）：在 `ReplyMeta` 加字段 + `SET_REPLY_META_TOOL` 的 properties/required 同步 + `chat.py` 里加对应分支。
- 这是「用一张表解耦回复后动作」的机制：加动作不改对话主流程。
