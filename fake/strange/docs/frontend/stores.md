# 状态管理（Pinia）

## 定位
前端全局状态，页面/组件通过它读写 settings 与 sessions，并做流式期间的乐观更新。

## 文件
- `frontend/src/stores/settings.ts`
- `frontend/src/stores/sessions.ts`
- `frontend/src/stores/appdata.ts`

## settings store（`useSettingsStore`）
- 状态：`settings`、`loaded`、`loading`。
- 方法：`load()`（GET 失败保留默认值）、`save(partial)`（PUT 后替换本地）。

## sessions store（`useSessionsStore`）
- 状态：`sessions`、`loaded`、`loading`。

| 方法 | 作用 |
|---|---|
| `load()` / `getById(id)` / `sortedSessions()` | 载入 / 查找 / 按最后活跃排序 |
| `refreshSession(id)` | 从后端重拉单会话并替换本地 |
| `pushMessage(id, msg)` | 追加消息（乐观） |
| `updateMessage(id, msgId, updater)` | 更新单条消息 |
| `appendContent(id, msgId, delta)` | 流式追加正文 |
| `insertAfter(id, afterId, msg)` | 插入到指定消息后（图片消息） |
| `importCard(file)` / `removeSession(id)` | CRUD |
| `patchTitle` / `patchCharacterBook` / `patchAgentBook` / `patchStatusSchema` | PATCH 后替换本地 |
| `removeFromContext(id, msgId)` | 从上下文移除 |

## appdata store（`useAppDataStore`）
- 状态：`presets` / `regexScripts` / `worldInfo`（全局，`backend/data/app_data.json`）、`loaded`、`loading`。
- 方法：`load()`（并发拉取三类）、`savePresets(list)`、`saveRegexScripts(list)`、`saveWorldInfo(list)`。

## 依赖 / 被谁调用
- 依赖 `api.ts`；被所有页面/组件调用。

## 扩展点 / 注意
- 流式期间用 `pushMessage/appendContent` 做乐观更新，`done` 后 `refreshSession` 拉权威态，避免本地与后端漂移。
- 新增可持久化字段：改 `types.ts` 接口 + 对应 PATCH 方法。
