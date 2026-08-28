# 卡意图分析

## 定位
导入角色卡时用 LLM 从卡里提取结构化元数据（当前：状态栏 schema），结果缓存进 `card.data.card_analysis`。失败不阻断导入。

## 文件
`backend/app/analysis.py`

## 输入

```python
async def analyze_card(card: dict, settings: dict) -> dict
```

- `card`：规范化后的角色卡 dict（见 character-card-parsing.md）。
- `settings`：完整设置 dict（需要 apiKey/model/baseUrl）。

## 输出
- `{"status_schema": {...}, ...}`（提取器名 → 结果）。
- 结果写入 `card["data"]["card_analysis"]`（由调用方 sessions.py 负责）。

### 状态栏 schema 形状
```json
{ "specified": true, "fields": [
  { "key": "mood", "label": "情绪状态", "type": "string", "description": "" },
  ...
]}
```
- `type` 枚举：`string | list | enum | number`。
- `specified=false` 或提取失败 → 返回 `default_status_schema()`（通用字段：当前地点/情绪/在场角色/当前行为/关键事实）。

## 关键函数
- `card_text(card)` — 汇总可分析文本（description/system_prompt/post_history_instructions/creator_notes + 常驻世界书条目）。
- `extract_status_schema(card, settings)` — function calling `set_status_schema` 提取字段。
- `effective_status_schema(session)` — 状态栏 schema 优先级：会话内 `statusSchema` > 卡 `card_analysis` > 默认。

## 依赖 / 被谁调用
- 依赖 `llm.call_chat_non_streaming`（kind=`card_analysis`）。
- 被 `routers/sessions.py`（导入时）调用；`effective_status_schema` 被 `chat.py`/`status-bar` 调用。

## 扩展点 / 注意
- 新增提取器：写 `extract_xxx(card, settings)`，并在 `analyze_card` 里加 `results["xxx"] = await extract_xxx(...)`。
- 每个提取器单独 try/except，互不影响。
