# 会话列表页面

## 定位
首页：展示所有会话卡片，提供导入 / 设置 / 生图面板入口，以及每个会话的 Info/Edit/Book/Status/Del 操作。

## 文件
`frontend/src/views/SessionListView.vue`
路由 `/`。

## 输入
- `useSessionsStore` 的 `sortedSessions()`。

## 输出 / 行为
- 卡片：名称（title 或卡名）、预览（最后一条消息前 60 字）、消息数、前 3 个标签。
- 顶部按钮：`Import` / `Pic` / `Settings`。
- 卡片操作：
  - `Info` → `CardInfoModal`
  - `Edit` → 内联改标题（`patchTitle`）
  - `Book` → `LoreBookEditor`
  - `Status` → `StatusEditor`
  - `Del` → 确认后删除
- 点击卡片主体 → `router.push('/chat/'+id)`。
- 导入成功 → 直接进入聊天。

## 依赖 / 被谁调用
- 依赖 stores 与各弹窗组件（Settings/Import/Pic/LoreBook/CardInfo/StatusEditor）。

## 扩展点 / 注意
- 新增卡片操作：加一个 `mini-btn` + 对应弹窗。
