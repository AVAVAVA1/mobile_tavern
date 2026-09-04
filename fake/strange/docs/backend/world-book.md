# 世界书 / 人物书（增强）

## 定位
世界书（character_book）条目的提取、激活、注入，对齐 RP-Hub 增强模型（7 种位置、正则/概率/scanDepth、全局 + 角色 scope）。

## 文件
`backend/app/prompt/world_book.py`

## 数据模型（规范化条目）

```json
{
  "comment": "条目名",
  "content": "内容",
  "enabled": true,
  "scope": "character|global",
  "keys": ["关键词", "/正则/"],
  "useRegex": false,
  "constant": false,
  "position": "at_depth",
  "order": 0,
  "depth": 4,
  "scanDepth": null,
  "probability": 100,
  "useProbability": true
}
```

- `position` 7 种：`system_top / global_note / before_char / after_char / at_depth / user_top / assistant_top`。
  - 兼容 ST 旧值：`before_character→before_char`、`after_character→after_char`、`character_top→before_char`、`character_bottom→after_char`、`an_top/author_note/an_bottom→global_note`、数字 `0/1/2/3/4`。

## 函数

| 函数 | 输入 | 输出 |
|---|---|---|
| `extract_character_book(card)` | 角色卡 | 规范化 book 或 None |
| `normalize_book(raw)` | 原始 book | 规范化 book |
| `normalize_world_info_entry(raw)` | 原始条目 | 规范化条目（含 extensions 覆盖） |
| `get_active_entries_from_list(entries, messages, settings)` | 条目 + 历史 + 设置 | 激活条目（按 constant/order 排序） |
| `get_active_entries(book, messages, settings)` | book 形式 | 委托列表版 |
| `group_entries_by_position(entries)` | 激活条目 | 按位置分组（组内 order 升序） |
| `inject_entries(entries, position, char_name, user_name)` | 条目 + 位置 | 拼接文本 |
| `build_search_text(messages, scan_depth)` | 历史 | 最近 N 条拼接 |

## 激活规则
- `enabled=false` 跳过；`constant=true` 恒触发（优先级最高，排最前）。
- 非 constant：`scanDepth`（条目级，缺省用 `settings.worldInfoScanDepth`，受 `settings.worldInfoMaxDepth` 上限）>0 且有 keys；扫描最近 N 条消息，任一 key 命中（`useRegex` 用正则，否则忽略大小写子串）；再过 `probability`（`useProbability` 且 <100 时随机，constant 不参与）。
- 排序：constant 优先，然后 `order` 降序。

## 位置注入（在 template.py）
- `system_top` / `global_note` → system prompt（story string 之前）。
- `before_char` / `after_char` → story string 的 `{{wi_before}}` / `{{wi_after}}`。
- `at_depth` → 作为 user 消息按 `depth` 从末尾倒数插入（只数 user/assistant）。
- `user_top` → 前插到最后一条 user 消息。
- `assistant_top` → 末尾追加 system 消息 `[Instructions for next message]`。

## 依赖 / 被谁调用
- 依赖 `placeholders.replace_placeholders`。
- 被 `prompt/template.py`（主上下文）、`agent/status_manager.py`（状态栏上下文）调用。

## 存储
- 角色级：卡内 `character_book.entries`（或 `extensions.character_book`）。
- 全局：`store.get_global_world_info()`（`backend/data/app_data.json` 的 `worldInfo`），端点 `GET/PUT /api/worldinfo`。
- 首次启动 seed 两条默认全局条目（`store.DEFAULT_WORLD_INFO`）：「战斗描写风格」（keys 子串匹配示范）+「强烈情绪强化」（useRegex 正则示范）；清空后重启不自动补回。
