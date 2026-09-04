# 消息气泡

## 定位
单条消息的渲染。按 `messageType` / `role` 分流，处理 markdown / 富 HTML / 思维链卡片 / 临时指令 / 图片 / 状态栏 / 生图按钮。

## 文件
`frontend/src/components/MessageBubble.vue`
依赖 `utils/markdown.ts`、`utils/cot.ts`、`utils/regex.ts`。

## 输入（props）
```ts
{ message: ChatMessage, charName: string, userName: string, generating?: boolean, regexScripts?: RegexScript[] }
```

## 渲染分流
1. `messageType === "status"` → 居中可折叠「📊 Status Update」气泡。
2. `messageType === "image"` → 图片气泡（`message.imageUrl`）。
3. 其它非 system → 普通气泡：user 右对齐红底、assistant 左对齐蓝底。

## 行为 / 输出（对齐 RP-Hub）
- **思维链**：`parseCot` 拆 `<think>/<cot>`（含未闭合）与尾部 `[系统指令:]`，兜底 `【思考】`/`{思考}`；渲染为可折叠「💡 Thinking」卡片（正文用 markdown 渲染）。
- **正文**：`processRegex`（显示侧 placement 1 / 非 promptOnly）只作用于正文 main。
- **临时指令**：`parseCot().sys` 渲染为「📌 临时指令」卡片。
- **markdown / HTML**：`renderMarkdown`（markdown-it `html:true`+`breaks:true` + DOMPurify 放宽白名单），完整 HTML 文档/HTML 代码块渲染为沙箱 iframe。
- **元数据**：assistant 且 `replyMeta` 存在时，调试显示「📋 生图=是/否（原因）」。
- **生图按钮**：assistant 且有内容时，右下角「🖼 生图」→ emit `generate-image(message.id)`。

## 事件
`emit("generate-image", id)`。

## 扩展点 / 注意
- 新增渲染类型：加 `messageType` 分支。
- markdown/HTML 渲染在 `utils/markdown.ts`；显示正则引擎在 `utils/regex.ts`；思维链解析在 `utils/cot.ts`。
