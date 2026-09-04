# 世界书编辑器

## 定位
增删改世界书条目（增强：7 种位置 + 正则/概率/深度）。

## 文件
`frontend/src/components/LoreBookEditor.vue`

## 输入
- `props.visible` + `props.sessionId`；条目来自 `session.characterCard.data.character_book.entries`。

## 输出 / 行为
- 表单字段 → 条目：`keys`（逗号分隔）、`content`、`comment`（标题）、`constant`、`enabled`、`position`（7 种：system_top/global_note/before_char/after_char/at_depth/user_top/assistant_top）、`useRegex`、`useProbability`、`probability`、`depth`、`scanDepth`。
- 保存 → `sessionsStore.patchCharacterBook(id, { ...book, entries })`（PATCH 后端）。
- 支持 toggle 启用/禁用、删除条目。

## 依赖 / 被谁调用
- 依赖 `useSessionsStore`、`ToggleSwitch`；被 `SessionListView` 挂载。

## 扩展点 / 注意
- 前端只编辑 `character_book`；`agent_book`（per-agent）目前无独立编辑器。
- 条目写入会保留 book 的 `name/scan_depth/case_sensitive/recursive_scanning` 原值。
