# 正则脚本

## 定位
正则查找/替换引擎（移植自 RP-Hub processRegex）。**发送侧(placement 2/promptOnly)在后端执行**（提示词组装后、发给 LLM 前），**显示侧(placement 1)在前端执行**。

## 文件
`backend/app/prompt/regex_scripts.py`

## 数据模型（脚本条目）

```json
{
  "name": "脚本名",
  "regex": "正则表达式（可 /pattern/flags 或含 (?i)(?s)(?m)）",
  "flags": "gimsuy（JS 风格，默认 g）",
  "replacement": "替换串（支持 $1 / $& / $$）",
  "placement": [1, 2],
  "markdownOnly": false,
  "promptOnly": false,
  "runOnEdit": false,
  "minDepth": null,
  "maxDepth": null,
  "scope": "character|global",
  "enabled": true
}
```

## 语义（对齐 RP-Hub）
- `placement`：`1` 作用于 user 角色消息，`2` 作用于 assistant 角色消息（按 role 过滤）。
- `markdownOnly` / `promptOnly`：
  - `promptOnly=true` → 仅发送侧(`is_prompt`)生效
  - `markdownOnly=true` 或两者都未勾 → 仅显示侧(`is_display`)生效
- `minDepth`/`maxDepth`：只对 depth 落在区间内的消息生效（depth=距末尾距离，0=最后一条）。
- `role=system` 的消息**不参与**替换。
- 保护：普通正则不进入 HTML 文档 / script / style / 代码块 / 行内代码 / 标签 / `<cot|think>` 块（正文本就含 `<` `>` 或 ```` ``` ```` 时跳过保护）。

## 函数

| 函数 | 输入 | 输出 |
|---|---|---|
| `normalize_regex_script(script, fallback_scope, system_names)` | 任意来源脚本 | 规范化 dict |
| `process_regex(text, scripts, is_display, is_prompt, role, depth)` | 文本 + 脚本 | 替换后文本 |
| `apply_regex_to_messages(messages, scripts, is_display, is_prompt)` | 消息数组 | 逐条替换后的消息数组 |
| `extract_character_regex_scripts(card)` | 角色卡 | 规范化脚本列表（extensions.regex_scripts 优先） |

## 依赖 / 被谁调用
- 被 `services/chat_service.py` 调用（发送侧，`apply_regex_to_messages(..., is_prompt=True)`）。
- 前端在渲染时做显示侧（对应 `utils/markdown` 或新模块）。

## 存储
- 全局脚本：`store.get_global_regex_scripts()`（`backend/data/app_data.json` 的 `regexScripts`）。
- 角色级脚本：在卡的 `extensions.regex_scripts`（或 `data.regex_scripts`/`regexScripts`）。

## 扩展点 / 注意
- 新增替换语义：改 `_apply_one_script`。
- JS 标志 `y`(sticky) 不支持，忽略；`u` 默认 unicode。
