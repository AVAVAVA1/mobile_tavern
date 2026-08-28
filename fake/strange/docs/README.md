# MobileTavern PC — 功能技术文档索引

> 目标：**不读源代码，只看文档就能知道每个功能的输入是什么、输出是什么、它和谁对接。**
> 这份文档是给「用 AI 管理本项目」的人（以及后续开发者）看的。AI 或人做对接/改功能时，先查这里。

## 如何阅读

1. 先读 [`architecture.md`](./architecture.md)：整体架构、模块边界、数据流。
2. 需要对接某个功能时，找到下面对应的文档，看它的 **输入 / 输出 / 依赖** 三节即可。
3. 前后端契约（REST/SSE 端点、JSON 形状、主题色）以 [`SPEC.md`](../SPEC.md) 为准；本目录的文档是对它的「功能视角」补充。

## 每个功能文档的固定结构

| 小节 | 含义 |
|---|---|
| 定位 | 一句话说明这个模块是干什么的 |
| 文件 | 实现它的源代码文件（便于需要时精读，但正常对接不用读） |
| 输入 | 它接收什么（参数、数据形状、谁调用） |
| 输出 | 它产出什么（返回值、副作用、持久化、SSE 事件） |
| 依赖 | 它调用哪些其它模块 |
| 被谁调用 | 谁在用它 |
| 扩展点 / 注意 | 加新能力时在哪改、有什么坑 |

## 后端功能（`backend/app/`）

| 功能 | 文档 | 一句话 |
|---|---|---|
| LLM 客户端 | [llm-client.md](./backend/llm-client.md) | 所有对 OpenAI 兼容 API 的流式/非流式调用 |
| 统一日志 | [logging.md](./backend/logging.md) | 把原始提示词/回复/生图提示词写到控制台+文件 |
| 会话存储 | [session-store.md](./backend/session-store.md) | 内存态 + JSON 持久化（settings/sessions） |
| 设置 | [settings.md](./backend/settings.md) | 设置读写、config.json 启动覆盖 |
| 角色卡解析 | [character-card-parsing.md](./backend/character-card-parsing.md) | PNG chunk + V1/V2/V3 角色卡解析 |
| 卡意图分析 | [card-analysis.md](./backend/card-analysis.md) | 导入时 LLM 提取状态栏 schema 等元数据 |
| 提示词组装 | [prompt-context.md](./backend/prompt-context.md) | 把卡/历史/世界书/AN 组装成最终 LLM 上下文 |
| 世界书 | [world-book.md](./backend/world-book.md) | 世界书/人物书的提取、激活、注入 |
| 对话引擎 | [chat-engine.md](./backend/chat-engine.md) | 单次对话的 SSE 流式生成编排（router 薄壳 + services/ 编排层） |
| 状态栏 | [status-bar.md](./backend/status-bar.md) | 结构化角色状态维护（Status Manager） |
| 总结 | [summarizer.md](./backend/summarizer.md) | 历史自动/手动总结 |
| 回复元数据 | [reply-meta.md](./backend/reply-meta.md) | 每次回复填一张元数据表（触发生图等） |
| 生图 | [image-generation.md](./backend/image-generation.md) | 文本→提示词→ComfyUI→出图保存 |

## 前端功能（`frontend/src/`）

| 功能 | 文档 | 一句话 |
|---|---|---|
| API 客户端 | [api-client.md](./frontend/api-client.md) | REST + SSE 封装，`/api` 同源代理 |
| 状态管理 | [stores.md](./frontend/stores.md) | Pinia：settings / sessions |
| 对话页面 | [chat-page.md](./frontend/chat-page.md) | 聊天界面 + 流式渲染 + 生图按钮 |
| 会话列表 | [session-list-page.md](./frontend/session-list-page.md) | 首页会话卡片列表 |
| 设置页面 | [settings-modal.md](./frontend/settings-modal.md) | API/上下文/生图配置面板 |
| 生图面板 | [pic-generate-modal.md](./frontend/pic-generate-modal.md) | 生图来源配置 + workflow 编辑 + 测试 |
| 历史/上下文 | [history-manager.md](./frontend/history-manager.md) | 查看实际上下文、删除消息、总结 |
| 世界书编辑器 | [lore-book-editor.md](./frontend/lore-book-editor.md) | 增删改世界书条目 |
| 状态栏编辑器 | [status-editor.md](./frontend/status-editor.md) | 自定义状态栏字段 schema |
| 卡片信息 | [card-info-modal.md](./frontend/card-info-modal.md) | 展示角色卡解析结果 |
| 导入 | [import-modal.md](./frontend/import-modal.md) | 上传 PNG 角色卡 |
| 消息气泡 | [message-bubble.md](./frontend/message-bubble.md) | 单条消息渲染（markdown/思维链/图片/状态） |

## 维护约定（重要）

- 每次改动 `src/`（前端）或 `backend/app/`（后端）的行为，**必须同步更新** 对应功能文档里的「输入 / 输出 / 依赖」小节。
- 新增一个功能 = 新增一篇同结构文档 + 在本索引表加一行。
- 端点/数据模型变更必须同步改 `SPEC.md`（契约是唯一权威）。
- 本约定同时写进了仓库根目录的 `AGENTS.md`，AI 管理项目时应自动遵守。
