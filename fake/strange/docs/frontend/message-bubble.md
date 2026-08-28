# 消息气泡

## 定位
单条消息的渲染。按 `messageType` / `role` 分流，处理 markdown、思维链折叠、图片、状态栏、生图按钮。

## 文件
`frontend/src/components/MessageBubble.vue`
依赖 `frontend/src/utils/markdown.ts`。

## 输入（props）
```ts
{ message: ChatMessage, charName: string, userName: string, generating?: boolean }
```

## 渲染分流
1. `messageType === "status"` → 居中可折叠「📊 Status Update」气泡。
2. `messageType === "image"` → 图片气泡（`message.imageUrl`）。
3. 其它非 system → 普通气泡：user 右对齐红底、assistant 左对齐蓝底。

## 行为 / 输出
- **思维链**：从内容里提取 `<thinking>...</thinking>` / `【思考】...【/思考】` / `{思考}...{/思考}`，折叠为「Chain of Thought」。
- **markdown**：`renderMarkdown`（markdown-it + DOMPurify 防 XSS），含引号高亮、占位符替换。
- **元数据**：assistant 且 `replyMeta` 存在时，调试显示「📋 生图=是/否（原因）」。
- **生图按钮**：assistant 且有内容时，右下角「🖼 生图」→ emit `generate-image(message.id)`。

## 事件
`emit("generate-image", id)`。

## 扩展点 / 注意
- 新增渲染类型：加 `messageType` 分支。
- markdown 预处理（HTML→MD、引号高亮）在 `utils/markdown.ts`，改渲染样式改这里。
