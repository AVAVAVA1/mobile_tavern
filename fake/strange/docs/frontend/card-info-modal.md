# 卡片信息

## 定位
展示角色卡的解析结果：解析分类（格式/spec/chunk）、基础信息、世界书条目、原始 JSON。

## 文件
`frontend/src/components/CardInfoModal.vue`

## 输入
- `props.session`。

## 输出 / 行为
- 只读展示；`parse_meta.format` 显示 V1/V2/V3。
- 世界书 / agent_book 条目列表 + 徽章（constant/禁用/before|after）。
- 可折叠「原始 JSON」查看 `session.characterCard` 全文。

## 依赖 / 被谁调用
- 被 `SessionListView` 挂载。

## 扩展点 / 注意
- 纯展示，无副作用。
