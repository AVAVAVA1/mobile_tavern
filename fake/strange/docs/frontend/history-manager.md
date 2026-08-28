# 历史 / 上下文管理

## 定位
查看「实际发给 LLM 的上下文」（system 提示词 + chat 消息）、从上下文删除消息、手动总结。

## 文件
`frontend/src/components/HistoryManager.vue`

## 输入
- `props.visible` + `props.sessionId`；打开时 `api.getContext(id)` 拉 `ContextView`。

## 输出 / 行为
- View 模式：展示 `systemMessages`（可折叠）+ `chatMessages`（user/AI），点消息看全文。
- Summarize 模式：勾选消息（或全选）→ `api.summarize` → 展示结果 → `api.applySummary` 应用。
- 删除：`api.removeFromContext(id, msgId)`（后端加入 `deletedMessageIds`，仍显示但不再进上下文）。

## 依赖 / 被谁调用
- 依赖 `api.ts`、`useSessionsStore`；被 `ChatView` 挂载。

## 扩展点 / 注意
- `ContextView` 里 agent 模式的 `plannerSystem/writerSystem/statusSystem` 字段后端已预留（当前 normal 模式为空数组），前端未展示。
- 删除只影响上下文组装，不影响本地消息展示。
