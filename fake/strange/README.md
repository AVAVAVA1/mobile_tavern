# MobileTavern PC 版（前后端分离）

把原 Expo/React Native 角色扮演 app 移植到 PC：**Vue 3 前端 + FastAPI 后端**。

- `backend/` — Python 3.12 + FastAPI，复用本目录下的 `.venv`
- `frontend/` — Vue 3 + Vite + TypeScript + Pinia + vue-router + markdown-it
- `SPEC.md` — 前后端 API 契约 / 数据模型 / 主题色
- `docs/` — 功能技术文档（输入/输出/依赖），见 `docs/README.md`；对接功能先看这里
- `Project.md`（仓库根目录）— 原项目的技术细节

---

## 一、后端

### 安装依赖（二选一）

```bash
# 方式 A：正常环境直接 pip
.venv/Scripts/python.exe -m pip install -r backend/requirements.txt

# 方式 B：若 pip 因环境限制装不上（沙箱/防火墙），用自建脚本直接下载 wheel 解包
.venv/Scripts/python.exe backend/install_deps.py
.venv/Scripts/python.exe backend/fix_deps.py
```

### 启动

```bash
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8100
```

服务地址 `http://127.0.0.1:8100`，数据持久化在 `backend/data/settings.json` 与 `backend/data/sessions.json`（首次启动自动创建）。

> **日志**：所有 LLM 调用（对话/状态栏/总结/元数据/卡分析/生图转写）的**原始提示词与原始回复**，以及生图提示词，会同时输出到**后端控制台**与 `backend/logs/app.log`（滚动，单份 2MB，最多 3 份）。日志不含 API Key。详见 `docs/backend/logging.md`。

### 启动配置 `config.json`

可在 `fake/strange/config.json` 里预填基础设置（可选，未写的字段用默认值），**每次启动后端时自动加载并覆盖**。键名与设置面板的标签一致：

```json
{
  "User Name": "ALA",
  "Status Bar": true,
  "API Key": "sk-...",
  "Model": "deepseek-v4-flash",
  "Base URL": "https://api.deepseek.com/v1"
}
```

支持的全部键：`User Name` / `Status Bar`（旧名 `Agent Beta` 仍兼容）/ `API Key` / `Model` / `Base URL` / `Summarize Threshold` / `Auto Summarize` / `Custom System Prompt` / `Author's Note` / `Author's Note Depth` / `Story String Template`。

### 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET/PUT | `/api/settings` | 读取/更新设置 |
| GET | `/api/sessions` | 会话列表（按最后活跃降序） |
| POST | `/api/sessions/import` | 上传 PNG 角色卡（multipart `file`） |
| GET/DELETE/PATCH | `/api/sessions/{id}` | 详情/删除/改标题+世界书 |
| DELETE | `/api/sessions/{id}/context/{msg_id}` | 从 LLM 上下文移除消息 |
| POST | `/api/sessions/{id}/chat` | 对话（SSE 流式） |
| GET | `/api/sessions/{id}/context` | 查看实际上下文（Hist 面板） |
| POST | `/api/sessions/{id}/summarize` | 手动总结 |
| POST | `/api/sessions/{id}/summary/apply` | 应用总结 |

### 自带测试脚本（无需真实 API key）

- `backend/smoke_test.py` — 导入/上下文/设置/CRUD
- `backend/mock_llm.py` — 假 OpenAI 兼容 LLM（端口 9000）
- `backend/chat_test.py` — 对话 SSE 端到端（先启动 mock_llm）

```bash
cd backend
..\.venv\Scripts\python.exe -m uvicorn mock_llm:app --port 9000   # 另一个终端
..\.venv\Scripts\python.exe chat_test.py
```

---

## 二、前端

```bash
cd frontend
npm install
npm run dev
```

Vite 开发服务器默认 `http://127.0.0.1:5173`，`/api` 自动代理到后端 `127.0.0.1:8100`。

> 注意：`npm run build` 依赖 esbuild（Vite 硬依赖），它需要以 piped stdio 派生子进程；在受限沙箱里会报 `spawn EPERM`。请在正常终端里执行。类型检查（`vue-tsc --noEmit`）已通过。

### 使用流程

1. 打开前端 → 右上角 **Settings** 填入 API Key / Model / Base URL（预设 OpenAI/DeepSeek/Grok/Ollama），可开启 **Agent Beta**。
2. **Import** 上传 PNG 角色卡（类脑 / SillyTavern V1/V2/V3）。
3. 进入对话，流式输出；右上角 **Hist** 查看实际上下文、删除消息、手动总结。

---

## 三、目录结构

```
backend/
├── app/
│   ├── main.py            # FastAPI 入口
│   ├── config.py          # 数据目录路径
│   ├── models.py          # Pydantic 模型（camelCase）
│   ├── store.py           # 内存态 + JSON 持久化
│   ├── llm.py             # OpenAI 兼容流式/非流式客户端（httpx）
│   ├── logging.py         # 统一日志（原始提示词/回复/生图提示词 → 控制台 + logs/）
│   ├── parser/            # PNG chunk + 角色卡 V1/V2/V3 解析
│   ├── prompt/            # 占位符/mes_example/世界书/story string/AN/template/总结
│   ├── agent/             # 状态管理(status_manager)等纯函数
│   ├── services/          # 用例编排层（对话/状态栏/总结/自动生图）
│   └── routers/           # HTTP 层（settings/sessions/chat/context/pic）
├── data/                  # settings.json + sessions.json（运行时生成）
├── logs/                  # app.log（运行时生成，LLM 请求/回复日志）
├── requirements.txt
├── run.py                 # python run.py
└── *.py                   # 测试脚本
frontend/
└── src/
    ├── api.ts             # REST + SSE 客户端
    ├── types.ts
    ├── stores/            # Pinia：settings/sessions
    ├── utils/markdown.ts  # HTML→MD 预处理 + markdown-it + 占位符
    ├── views/             # SessionListView / ChatView
    └── components/        # MessageBubble/Settings/Import/LoreBook/LoreSkill/History
```

## 四、状态栏（结构化、每卡自适应）

Agent 模式下每条消息会更新一次「状态栏」。现在状态栏**不再是硬编码模板**：

- **导入时**：后端用一次 LLM 调用分析作者是否要求维护状态栏，并提取字段（`analysis.py` 的 `set_status_schema`），结果缓存在 `card.data.card_analysis`。
- **未指定**：作者没写就用默认通用字段（当前地点/情绪状态/在场角色/当前行为/关键事实）。
- **输出**：状态管理器用 `update_status` 工具输出结构化 JSON，只提交变化字段，未变化字段自动继承上一轮。
- **用户覆盖**：`PATCH /api/sessions/{id}` 传 `statusSchema` 即可按会话自定义字段（优先级最高）。

> 前端「状态栏编辑器」面板尚未做；当前可通过 `PATCH` 接口自定义。

## 五、与手机版的一致性

后端 `prompt/`、`agent/`、`parser/` 逐行移植自原 `src/` 下的同名逻辑（世界书激活、Story String 宏、mes_example 解析、Author's Note 注入、总结管道、Agent 三代理与 per-agent Lorebook 路由等），行为与手机版一致。
