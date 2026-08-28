# 角色卡解析

## 定位
从 PNG 角色卡中解析出结构化角色数据，兼容类脑 / SillyTavern / TavernAI 的 V1/V2/V3 格式。

## 文件
- `backend/app/parser/png.py` — PNG chunk 结构解析
- `backend/app/parser/character_card.py` — 卡 JSON 解析与规范化

## 输入

```python
parse_character_card(png_bytes: bytes) -> Optional[dict]
```

- `png_bytes`：PNG 文件的完整字节流（来自上传的 multipart `file`）。

## 输出
- 成功：规范化后的角色卡 dict，形状固定为：

```json
{
  "spec": "chara_card_v1|v2|v3",
  "spec_version": "1.0|2.0|...",
  "data": { "name", "description", "personality", "scenario",
            "first_mes", "mes_example", "creator_notes", "system_prompt",
            "post_history_instructions", "alternate_greetings", "character_version",
            "tags", "creator", "extensions", "character_book", "create_date",
            "avatar", "world_description" },
  "parse_meta": { "spec", "chunk", "format" }
}
```

- 失败（非 PNG / 无角色卡数据 / JSON 损坏）：返回 `None`。

## 解析顺序（内部）
1. 优先找 `ccv3` chunk（V3）；否则找 `chara`/`character` chunk（V1/V2）。
2. chunk 文本先试直接 JSON，再试 base64 解码。
3. `normalize_card`：V1 字段平铺在顶层 → 包进 `data`；V2/V3 字段在 `data` 内直接规范化。

## 依赖 / 被谁调用
- 依赖 `parser/png.py`。
- 被 `routers/sessions.py` 的 `POST /sessions/import` 调用。

## 扩展点 / 注意
- 支持新字段：在 `_data_fields()` 里加一个 `g("字段名")`。
- `parse_meta` 用于前端 `CardInfoModal` 展示解析来源，不要删。
- 解析失败由路由层转成 400 错误提示。
