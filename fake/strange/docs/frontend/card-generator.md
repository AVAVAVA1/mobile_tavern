# 角色卡工坊页

## 定位
输入描述 → LLM 生成角色卡 → 预览 → 导入为会话。

## 文件
`frontend/src/views/CardGenerator.vue`
路由 `/generate`（`router.ts`）。

## 输入
- 用户描述文本（textarea）。

## 输出 / 行为
- `generate()` → `api.generateCard(prompt)`（`POST /api/cards/generate`）。
- 结果预览：名称 / 描述 / 开场白 / 世界书条数 / 正则条数 / 标签数。
- `importCard()` → `api.createCard(card)`（`POST /api/cards/create`）→ 跳转 `/chat/{id}`。

## 依赖 / 被谁调用
- 依赖 `api.ts`、`useSessionsStore`；由 `SessionListView` 头部「Gen」按钮进入。

## 扩展点 / 注意
- 核心版不含头像生图 / diff 修改（见 `docs/backend/card-generation.md`）。
