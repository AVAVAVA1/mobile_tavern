# 状态栏（Status Manager）

## 定位
每轮回复后按 schema 维护一次结构化角色状态，只提交变化字段、未变化字段自动继承。输出可读 markdown 用于 UI。

## 文件
- `backend/app/agent/status_manager.py`（纯函数，不调 LLM）
- `backend/app/services/status_service.py`（`update_status`：编排一次状态更新，调 LLM + 写 store）
- schema 的提取在 `backend/app/analysis.py`

## 输入

```python
build_status_update_tool(schema) -> dict                      # 由 schema 生成 function calling 工具
build_status_messages(card, prev_data, latest_text, schema, user_name) -> List[dict]  # 组装状态更新提示词
parse_status_update(resp, prev_data) -> dict                  # 从 tool_call 合并变更
format_status(data, schema) -> str                            # 渲染成 markdown
```

- `schema`：状态栏字段 schema（`fields:[{key,label,type,description}]`）。
- `prev_data`：上一次状态 JSON（首次为空）。
- `latest_text`：本次 AI 回复正文（取尾部 2000 字）。

## 输出
- `build_status_update_tool`：`update_status` 工具的 JSON Schema（字段全部可选 = 只提交变化项）。
- `build_status_messages`：状态管理代理的 `messages`（system + 上次状态 JSON + 最新文本 + 世界书）。
- `parse_status_update`：合并后的状态 JSON（工具未提交的字段继承 prev_data）。
- `format_status`：markdown（`- **label**：value` 每行一条；无内容返回 `(暂无状态)`）。

## 数据流
```
chat.py._update_status:
  schema = effective_status_schema(session)       # 用户覆盖 > 卡提取 > 默认
  status_msgs = build_status_messages(...)
  call_chat_non_streaming(kind="status", tools=[update_status])
  new_data = parse_status_update(resp, prev_data)
  final = format_status(new_data, schema)
  store.set_message(...) / store.update_status(...)
```

## 依赖 / 被谁调用
- `status_service` 依赖 `agent.status_manager`、`analysis`、`llm`、`store`。
- 被 `services/chat_service.py` 调用（正文生成后）；schema 由 `analysis.effective_status_schema` 提供。

## 扩展点 / 注意
- schema 来源优先级：`session.statusSchema`（用户编辑）> `card.card_analysis.status_schema`（导入提取）> 默认。
- 新增字段类型：改 `build_status_update_tool` 里的类型映射（list→array、number→number、其余→string）。
