# 会话存储 / 持久化

## 定位
**唯一状态源**：内存态 + 写穿到 JSON 文件。所有 settings / sessions 的读写都从这里走。

## 文件
- `backend/app/store.py`（实现）
- `backend/app/models.py`（Pydantic 模型：`AppSettings` / `ChatMessage` / `Session`）
- `backend/app/config.py`（数据目录/文件路径）

## 数据落点
- `backend/data/settings.json` — 设置
- `backend/data/sessions.json` — 会话列表（每个元素一个 session dict）
- 启动时 `init()` 载入；每次写操作写穿磁盘（部分函数只改内存，由调用方在检查点 `persist()`）。

## 输入 / 输出（主要函数）

| 函数 | 输入 | 输出/副作用 |
|---|---|---|
| `init()` | — | 载入 settings/sessions + 应用 config.json |
| `persist()` | — | 把当前内存态写回两个 JSON |
| `get_settings()` | — | `dict`（当前设置副本） |
| `update_settings(partial)` | 部分设置 dict | 完整设置 dict（合并 + 数值强转 + 写盘 + 写 config.json） |
| `list_sessions()` | — | 会话列表（按最后活跃降序） |
| `get_session(id)` | id | session dict 或 None |
| `create_session(card, userName)` | 角色卡 dict + 用户名 | 新 session dict（含 first_mes 首条 assistant 消息） |
| `update_session(id, **fields)` | id + 字段 | 更新后 session 或 None |
| `delete_session(id)` | id | bool |
| `add_message(id, msg)` | 消息 dict | 追加到 session.messages（内存，不落盘） |
| `insert_message_after(id, after_id, msg)` | 位置 | 插入到指定消息后 |
| `append_message_content(id, msg_id, text)` | 增量 | 流式追加正文（内存） |
| `set_message(id, msg_id, **fields)` | 字段 | 更新某条消息 |
| `get_message(id, msg_id)` | — | 消息 dict 或 None |
| `update_summary(id, summary, last_idx)` | 总结 | 写 summary + lastSummarizedIndex（落盘） |
| `update_status(id, new_status, status_data)` | 状态 | 写 previousStatus/status/statusData（落盘） |
| `remove_from_context(id, msg_id)` | msg_id | 加入 deletedMessageIds（落盘） |
| `gen_id()` / `now_ms()` | — | 生成唯一 id / 毫秒时间戳 |

## 依赖 / 被谁调用
- 依赖 `models.AppSettings`、`config`、`prompt.placeholders`（create_session 里替换 first_mes 占位符）。
- 被几乎所有路由调用。

## 扩展点 / 注意
- 线程安全用 `RLock`；新增写函数记得加锁。
- 新增 session 字段时，在 `create_session` 里给默认值，避免旧数据缺失字段。
- 新增设置字段时，在 `AppSettings`（models.py）加默认值，并在 `_CONFIG_KEY_MAP` / `_CONFIG_REVERSE_MAP`（store.py）登记展示名。
