# 提示词 / 上下文组装

## 定位
把「角色卡 + 历史 + 世界书 + 总结 + 状态栏 + Author's Note」组装成最终发给 LLM 的 `messages` 数组。这是提示词工程的**核心组装点**。

## 文件
- `backend/app/prompt/template.py` — 主编排 `build_conversation_context`
- `backend/app/prompt/story_string.py` — Story String 模板渲染
- `backend/app/prompt/mes_example.py` — mes_example → few-shot 消息对
- `backend/app/prompt/placeholders.py` — `{{user}}/{{char}}`、`<user>/<char>` 替换
- `backend/app/prompt/authors_note.py` — Author's Note 注入
- `backend/app/prompt/world_book.py` — 世界书（增强位置）
- `backend/app/prompt/presets.py` — 预设（system/user/assistant）
- `backend/app/prompt/regex_scripts.py` — 正则脚本（发送侧在 chat_service 应用）

## 输入

```python
build_conversation_context(card, history, user_name,
    summary=None, last_summarized_index=None, settings=None,
    deleted_message_ids=None, status=None,
    presets=None, global_world_info=None) -> List[dict]
```

- `card`：角色卡 dict
- `history`：`[{"role","content","id"}, ...]`（真实历史）
- `user_name`：用户名
- `summary` / `last_summarized_index`：总结文本与已总结到的下标
- `settings`：设置（storyStringTemplate / customSystemPrompt / authorNoteText / authorNoteDepth / worldInfoScanDepth / worldInfoMaxDepth）
- `deleted_message_ids`：从上下文移除的消息 id 集合
- `status`：当前状态栏文本（statusBarEnabled 时才注入）
- `presets`：全局预设列表（system→system prompt，user/assistant→消息）
- `global_world_info`：全局世界书条目

## 输出
- 有序 `messages` 数组，顺序固定：
  1. `system`：系统预设 → system_top → global_note 世界书 → 自定义系统提示词 → Story String 渲染结果
  2. 消息预设（user/assistant role）
  3. few-shot：mes_example 解析出的 `user`/`assistant` 对
  4. `assistant`：first_mes（开场白，占位符已替换）
  5. `system`：`[Previous conversation summary]`（若有总结）
  6. `system`：`[Current Status]`（若有状态栏）
  7. 未总结的真实历史（跳过 first_mes 重复、跳过 deletedMessageIds）+ Author's Note
  8. 消息级世界书注入：`at_depth`（按 depth 插 user 消息）/ `user_top` / `assistant_top`

> 正则脚本（placement 2/promptOnly）在 `services/chat_service.py` 里对最终 messages 应用，不在 template 里。

## 子模块契约
- `render_story_string(template, params) -> str`：用 `{{char}}/{{user}}/{{description}}/{{personality}}/{{scenario}}/{{system}}/{{mes_example_raw}}/{{post_history}}/{{wi_before}}/{{wi_after}}` 宏渲染；空模板用 `DEFAULT_TEMPLATE`。
- `parse_mes_example(raw, char_name, user_name) -> List[dict]`：按 `<START>` 分块，识别 `{{user}}:`/`{{char}}:`/`<user>:`/`<char>:` 行首，输出 role/content 对。
- `replace_placeholders(text, char_name, user_name) -> str`：四种占位符替换。
- `inject_author_note(history, note, depth) -> List[dict]`：在倒数第 depth 处插入 `[Author's Note]` system 消息。

## 依赖 / 被谁调用
- 依赖 `world_book`、`story_string`、`mes_example`、`placeholders`、`authors_note`。
- 被 `routers/chat.py`（对话）、`routers/context.py`（Hist 面板查看实际上下文）调用。

## 扩展点 / 注意
- 改提示词顺序/格式：只改 `template.py`。
- Story String 宏新增：改 `story_string._MACROS`。
- 这是「原始提示词」的最终形态，已由日志自动记录，便于核对。
