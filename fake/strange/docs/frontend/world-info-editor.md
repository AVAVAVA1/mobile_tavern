# 全局世界书编辑器

## 定位
全局世界书条目的增删改（与角色级 `LoreBookEditor` 对应）。

## 文件
`frontend/src/components/WorldInfoEditor.vue`
依赖 `stores/appdata`、`ToggleSwitch`。

## 输入
- `props.visible`；列表来自 `useAppDataStore().worldInfo`。

## 输出 / 行为
- 表单：comment / keys / content / position（7 种）/ constant / useRegex / probability / depth / scanDepth。
- 保存 → `store.saveWorldInfo(list)` → `PUT /api/worldinfo`。

## 依赖 / 被谁调用
- 被 `SessionListView` 头部「World」按钮打开。

## 扩展点 / 注意
- 全局 + 角色级世界书由后端 `template.py` 合并激活（见 `docs/backend/world-book.md`）。
