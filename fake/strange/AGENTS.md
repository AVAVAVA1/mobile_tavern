# AGENTS.md — MobileTavern PC（本目录）

本目录是 MobileTavern 的 PC 版：**Vue 3 前端（`frontend/`）+ FastAPI 后端（`backend/`）**。
用 AI 管理 / 修改本项目时，遵守以下约定（比上层 AGENTS.md 更具体，优先遵守本文件）。

## 文档优先
- 功能技术文档在 `docs/`，索引见 `docs/README.md`。
- 对接或修改任何功能前，先读对应文档的「输入 / 输出 / 依赖」三节；目标是**不读源码也能上手**。
- 前后端契约（端点、JSON 形状、主题色）以 `SPEC.md` 为唯一权威。

## 维护约定（必须遵守）
1. 改动 `backend/app/` 或 `frontend/src/` 的行为后，**必须同步更新** `docs/` 里对应功能文档的「输入 / 输出 / 依赖」小节。
2. 新增功能 = 新增一篇同结构文档 + 在 `docs/README.md` 索引表加一行。
3. 端点 / 数据模型变更必须同步改 `SPEC.md`。
4. 后续工作中持续完善这套文档，保持「文档 = 事实」。

## 关键边界（解耦约定）
- 前端只通过 `frontend/src/api.ts` 访问后端（组件内禁止直接 fetch）。
- 后端所有 LLM 调用只通过 `backend/app/llm.py`（换提供商/加日志只改这一处）。
- 会话 / 设置的唯一状态源是 `backend/app/store.py`（路由层不直接读写文件）。
- 日志统一走 `backend/app/logging.py`：原始提示词、原始回复、生图提示词 → 控制台 + `backend/logs/app.log`。

## 运行
- 后端：`cd backend && ..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8100`
- 前端：`cd frontend && npm run dev`（`/api` 自动代理到 8100）

## 注意
- 修改 `src/` 相关（前端）与 `backend/app/`（后端）后，同步更新 `docs/`；README 里的目录结构也保持与实际一致。
