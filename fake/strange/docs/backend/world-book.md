# 世界书 / 人物书

## 定位
世界书（character_book）条目的提取、激活、注入。用于把「关键词命中 / 常驻」的设定注入到上下文。

## 文件
`backend/app/prompt/world_book.py`

## 输入

```python
extract_character_book(card) -> Optional[dict]     # 从卡里取并规范化
get_active_entries(book, recent_text) -> List[dict] # 计算激活条目
inject_entries(entries, position, char_name, user_name) -> str  # 渲染成文本
build_search_text(messages, scan_depth) -> str      # 生成搜索文本
```

- `card`：角色卡 dict；世界书在 `data.character_book` 或 `data.extensions.character_book`。
- `book`：规范化后的世界书（`{name, description, scan_depth, token_budget, recursive_scanning, case_sensitive, entries[]}`）。
- 条目字段：`keys / secondary_keys / content / comment / constant / enabled / position(before_char|after_char) / insertion_order / case_sensitive / selective`。

## 输出
- `extract_character_book`：规范化 dict 或 None（无世界书/损坏）。
- `get_active_entries`：激活条目列表（`enabled` + (`constant` 或关键词命中)）。
- `inject_entries`：按 `insertion_order` 排序后拼接的文本（`before_char`/`after_char` 分开），占位符已替换。

## 激活规则
- `constant=true`：常驻激活。
- 否则：`keys + secondary_keys` 任一命中 `recent_text`（`case_sensitive` 决定大小写）。
- `recent_text` 来自 `build_search_text(messages, scan_depth)`：最近 `scan_depth` 条消息内容拼接。

## 依赖 / 被谁调用
- 依赖 `placeholders.replace_placeholders`。
- 被 `prompt/template.py`（主上下文）、`agent/status_manager.py`（状态栏上下文）调用。

## 扩展点 / 注意
- 条目字段在 `normalize_entry` 里声明默认值；新增字段在此补。
- `agent_book`（per-agent 世界书）目前只是被保存/展示，激活逻辑与 character_book 一致，由调用方决定是否区分。
