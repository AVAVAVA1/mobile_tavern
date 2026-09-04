# 角色卡生成

## 定位
用 LLM 根据用户描述生成 SillyTavern 兼容角色卡（V2），并可创建会话。核心版（不含头像/diff）。

## 文件
- `backend/app/cardgen.py` — 生成逻辑（系统提示词 + function calling + 组装）
- `backend/app/routers/cards.py` — 端点

## API 端点

| 方法 | 路径 | 输入 | 输出 |
|---|---|---|---|
| POST | `/api/cards/generate` | `{"prompt":"描述"}` | 角色卡 dict（不持久化） |
| POST | `/api/cards/create` | `{"card": {...}}` | 新建的 `Session` |

## 生成流程
1. `cardgen.generate_card(settings, prompt)`：function calling `generate_character_card`（kind=`card_generation`，自动记录日志）。
2. 工具字段：`name/description/personality/scenario/first_mes/mes_example/system_prompt/post_history_instructions/tags/world_info[]/regex_scripts[]`。
3. `build_card_from_result` 组装成 `{spec:"chara_card_v2", data:{..., character_book:{entries:world_info}, extensions:{regex_scripts}}}`。
4. `POST /api/cards/create` → `store.create_session(card, userName)`。

## 依赖 / 被谁调用
- 依赖 `llm.call_chat_non_streaming`、`store`。
- 被前端 `CardGenerator` 页调用。

## 扩展点 / 注意
- 系统提示词 `CARD_GEN_SYSTEM` 是中性创作提示词（不复制 RP-Hub 的 NSFW 破限内容）。
- 加头像生图 / diff 修改：在此模块扩展。
- 解析兜底：tool_calls 失败时尝试从 `content` 解析 JSON，再失败抛错。
