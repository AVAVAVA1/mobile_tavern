# 会话列表页面

## 定位
首页：展示所有会话卡片，提供导入入口，以及每个会话的 Info/Edit/Book/Status/Exp/Del 操作。（全局入口已移到侧边栏，见 app-shell.md）

## 文件
`frontend/src/views/SessionListView.vue`
路由 `/`。

## 输入
- `useSessionsStore` 的 `sortedSessions()`。

## 输出 / 行为
- 卡片：名称（title 或卡名）、预览（最后一条消息前 60 字）、消息数、前 3 个标签。
- 顶部：`Import` 按钮（上传 PNG 角色卡）。
- 卡片操作：
  - `Info` → `CardInfoModal`
  - `Edit` → 内联改标题（`patchTitle`）
  - `Book` → `LoreBookEditor`（角色级世界书）
  - `Status` → `StatusEditor`
  - `Exp` → 导出 PNG（`GET /api/sessions/{id}/export`）
  - `Del` → 确认后删除
- 点击卡片主体 → `router.push('/chat/'+id)`。
- 导入成功 → 直接进入聊天。

## 依赖 / 被谁调用
- 依赖 `useSessionsStore` 与 ImportModal/LoreBookEditor/CardInfoModal/StatusEditor。
- 全局弹窗（Settings/Presets/Regex/WorldInfo/Pic）已提升到 `App.vue`。

## 扩展点 / 注意
- 新增卡片操作：加一个 `mini-btn` + 对应弹窗。
