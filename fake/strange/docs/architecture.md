# 总体架构与模块边界

## 一、分层

```
frontend/ (Vue 3 + Vite + TS + Pinia)
  views / components          —— 页面与交互，只通过 stores + api.ts 说话
  stores/                     —— Pinia 状态（settings/sessions），乐观更新
  api.ts                      —— 唯一的前后端通道（REST + SSE）
        │  HTTP/SSE  (同源 /api，Vite 代理到 127.0.0.1:8100)
backend/ (FastAPI)
  app/routers/                —— HTTP 层：解析请求、校验、序列化 SSE（薄壳），业务编排在 services/
  app/services/               —— 用例编排层：对话流程 / 状态栏 / 总结 / 自动生图（无 HTTP，产出事件 dict）
  app/llm.py                  —— LLM 访问的唯一出口
  app/imagegen.py             —— 生图业务的唯一出口（转换+提交+下载）
  app/analysis.py reply_meta.py —— 用 LLM 做的小型「提取器/填表」服务
  app/agent/ prompt/ parser/  —— 纯函数模块：无 HTTP、无副作用（解析/组装/渲染）
  app/store.py                —— 唯一状态源：内存 + JSON 持久化
  app/logging.py              —— 横切关注点：统一日志
  data/                       —— settings.json + sessions.json（运行时生成）
```

## 二、核心边界原则

1. **单一通道**：前端只允许 import `api.ts`（不允许在组件里直接 fetch）。
2. **单一 LLM 出口**：后端所有 LLM 调用都必须经过 `llm.py` 的 `stream_chat` / `call_chat_non_streaming`。这样日志、超时、错误处理、未来换提供商都只改一处。
3. **纯函数内核**：`prompt/`、`parser/`、`agent/status_manager.py` 不碰 HTTP、不碰文件、不碰全局状态；输入 dict → 输出 dict/list/str，便于单测。
4. **单一声明源**：`store.py` 是唯一读写 settings/sessions 的地方；路由层不直接操作文件。
5. **横切日志**：`logging.py` 被 `llm.py` / `imagegen.py` 调用，其它业务代码不各自 print。

## 三、一次对话的数据流（正常模式）

```
ChatView.send()
  → api.streamChat(id, text)
  → POST /api/sessions/{id}/chat (SSE)
  → routers/chat.py:
       store.add_message(user/assistant)
       prompt.template.build_conversation_context()   # 组装原始提示词
       llm.stream_chat(context)                        # 发送 + 记录日志
       reply_meta.fill_reply_meta()                    # 填元数据表
       imagegen.generate_image()                       # （可选）自动生图
       summarizer.summarize_history()                  # （可选）自动总结
  → SSE: delta / status_delta / reply_meta / image_generating / image / summary / done
  → 前端按事件更新 Pinia，最后 refreshSession 拉最终态
```

## 四、一次生图的数据流

```
① 自动（对话内）: chat.py → imagegen.generate_image(reply_text)
② 手动（气泡按钮）: POST /sessions/{id}/messages/{mid}/image → imagegen.generate_image(msg.content)
③ 测试（面板）: POST /pic/comfyui/generate → imagegen.submit_and_fetch（不做 LLM 转写）

imagegen.generate_image:
  source_text → llm(convert_to_tags) → tags → +promptPrefix → positive
  → workflow JSON 替换 %PositivePrompt% / %NegativePrompt%
  → ComfyUI /prompt 提交 → 轮询 /history → 下载 /view → 存 output/
  → 返回 {ok, url, filename, message}
```

## 五、会话（Session）数据模型要点

- 每个导入的角色卡 = 一个 session（`id` 唯一），持久化在 `backend/data/sessions.json`。
- `messages` 里 `messageType` 区分：`message`（普通）、`status`（状态栏输出）、`image`（生成的图片）。
- `deletedMessageIds` 记录「从 LLM 上下文移除但仍显示」的消息，只影响组装、不影响存储。
- `summary` + `lastSummarizedIndex` 记录已总结的历史区间。

详见 [`SPEC.md`](../SPEC.md) 的「数据模型」与「REST 端点」。
