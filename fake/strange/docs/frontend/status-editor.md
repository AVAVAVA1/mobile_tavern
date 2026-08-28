# 状态栏编辑器

## 定位
自定义会话的状态栏字段 schema（key / label / type / description）。

## 文件
`frontend/src/components/StatusEditor.vue`

## 输入
- `props.session`；初始字段优先级：`session.statusSchema`（用户）> `card_analysis.status_schema`（卡提取）> 默认 5 字段。

## 输出 / 行为
- 增删字段、改 key/label/type(string|list|enum|number)/description。
- `resetToBase()` 回退到卡提取/默认。
- `save()` → `sessionsStore.patchStatusSchema(id, { specified: true, fields })`（PATCH 后端）。

## 依赖 / 被谁调用
- 依赖 `useSessionsStore`；被 `SessionListView` 挂载。

## 扩展点 / 注意
- 保存后优先级最高，覆盖卡提取/默认（后端 `effective_status_schema` 读取）。
- 字段清理：保存时丢弃 key/label 为空的项。
