# 导入

## 定位
上传 PNG 角色卡，导入为新的会话。

## 文件
`frontend/src/components/ImportModal.vue`

## 输入
- `props.visible`；用户选择 `.png` 文件（`<input type="file" accept="image/png">`）。

## 输出 / 行为
- `sessionsStore.importCard(file)` → `POST /api/sessions/import`（multipart `file`）。
- 成功：emit `imported(session.id)` + `close`；列表页跳转到聊天。
- 失败：显示错误（解析失败 / 非角色卡）。

## 依赖 / 被谁调用
- 依赖 `useSessionsStore`；被 `SessionListView` 挂载。

## 扩展点 / 注意
- 后端导入时若配置了 apiKey，会顺带做一次卡意图分析（见 card-analysis.md），失败不阻断导入。
