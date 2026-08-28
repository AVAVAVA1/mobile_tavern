# 对话页面

## 定位
聊天主界面：显示消息流、发送/停止、流式渲染、生图按钮、打开 Hist 面板。

## 文件
- `frontend/src/views/ChatView.vue`
- `frontend/src/components/MessageBubble.vue`（单条消息渲染）

## 路由
`/chat/:id`（props 传 `id`）。

## 输入
- 路由参数 `id`（session id）。
- 从 `useSessionsStore` 读 session；`onMounted` 先 `refreshSession(id)`。
- 用户输入框文本（≤4000 字）。

## 行为 / 输出
- `send()`：无 apiKey 弹窗；本地先 `pushMessage`（user + 空 assistant），再 `streamChat`：
  - `onDelta` → `appendContent`（流式正文）
  - `onStatusDelta` → 追加/复用 `messageType="status"` 气泡
  - `onReplyMeta` → 写 `replyMeta`
  - `onImageGenerating`/`onImage` → 生图状态 + 插入图片消息
  - `done`/`error` → 最终 `refreshSession` 同步
- `stop()`：abort。
- `generateImage(messageId)`：调用 `generateImageForMessage` 手动生图。
- 顶部 `Hist` 按钮打开 `HistoryManager`。
- 滚动：接近底部自动跟随；远离底部显示「↓」按钮。

## 依赖 / 被谁调用
- 依赖 `api.ts`、`stores`、`MessageBubble`、`HistoryManager`。
- 被 `router.ts` 挂载。

## 扩展点 / 注意
- 组件因路由参数变化复用（不重挂载），`watch(() => props.id)` 里刷新。
- 消息渲染规则（markdown/思维链/图片/状态）见 message-bubble.md。
