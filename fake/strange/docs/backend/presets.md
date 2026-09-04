# 预设（带 role）

## 定位
system / user / assistant 三类预设；system 预设注入 system prompt，user/assistant 预设作为消息插入上下文。

## 文件
`backend/app/prompt/presets.py`

## 数据模型

```json
{ "name": "预设名", "content": "预设正文", "enabled": true, "role": "system|user|assistant" }
```

## 函数

| 函数 | 输入 | 输出 |
|---|---|---|
| `normalize_preset(preset)` | 任意来源预设 | 规范化 dict |
| `split_presets(presets)` | 预设列表 | `(system 预设, 消息预设[user/assistant])`（仅启用且内容非空） |
| `build_system_preset_text(system_presets)` | system 预设列表 | 拼接文本 |

## 注入规则
- system 预设 → 拼进 system prompt 最前面（`[系统预设]...` 之后是 system_top/global_note 世界书、customSystemPrompt、story string）。
- user/assistant 预设 → 作为消息插入到 system 之后、few-shot/开场白之前（顺序与列表一致）。

## 存储
- 全局预设：`store.get_global_presets()`（`backend/data/app_data.json` 的 `presets`）。
- 端点：`GET/PUT /api/presets`（PUT body 为预设数组）。

## 扩展点 / 注意
- 内置预设库 `DEFAULT_PRESETS`（首次启动 seed 进 `app_data.json`）：防抢话 / 防神化 / 防重复（默认启用）、第二人称（默认关）/ 第三人称（默认启用）。参考 RP-Hub 内置预设的类别，用自己的中性写法（不含 NSFW/破限内容）。
- 用户清空预设后，重启不会自动补回（`_seeded` 标记）。
- 新增 role：改 `VALID_PRESET_ROLES` + 注入逻辑。
