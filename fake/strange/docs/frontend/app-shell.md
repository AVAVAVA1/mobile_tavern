# 应用外壳 / 侧边栏

## 定位
参照 RP-Hub 的「可折叠左侧边栏 + 主内容区」布局：全局导航（对话/角色卡生成/预设/世界书/正则/生图/设置）常驻左侧，主内容区渲染当前页面。

## 文件
- `frontend/src/App.vue` — 外壳：侧边栏 + `<router-view>` + 全局弹窗宿主
- `frontend/src/components/AppSidebar.vue` — 侧边栏（可折叠）

## 布局
```
┌──────────┬──────────────────────────┐
│ AppSidebar │        app-main        │
│ (240px/64px)│     <router-view>      │
│          │    (SessionList/Chat/    │
│  导航     │     CardGenerator)      │
└──────────┴──────────────────────────┘
```

## AppSidebar
- Props：`collapsed`；Emits：`toggle-collapse`、`open(modal)`。
- 导航项：对话(`/`) · 角色卡生成(`/generate`) · ─ · 预设/世界书/正则脚本/生图（open 弹窗）· ─ · 设置。
- 折叠后只显示图标（64px）。
- logo 为「2b2」（项目改名后）；头部有主题切换按钮 🌙/☀️。

## 主题切换（深色/浅色）
- `utils/theme.ts` 的 `useTheme()`：`theme` ref（localStorage `2b2-theme` 持久化）+ `toggle()`，写入 `html[data-theme]`。
- `main.ts` 启动时 `useTheme().init()` 应用持久化主题（避免闪烁）。
- 配色全部走 `style.css` 的 CSS 变量，浅色主题由 `html[data-theme="light"]` 覆盖（`--bg/--panel/--text/--border/...`）。
- HTML 沙箱 iframe（`utils/markdown.ts`）是独立文档，渲染时读取当前主题决定深/浅底色。

## 全局弹窗宿主（App.vue）
`SettingsModal` / `PresetsEditor` / `RegexEditor` / `WorldInfoEditor` / `PicGenerateModal` 提升到 App 层，侧边栏可从任意路由打开。

## 依赖 / 被谁调用
- `AppSidebar` 用 `useRoute`/`useRouter` 做导航高亮与跳转。
- `App.vue` 挂载时加载 settings/sessions/appdata。

## 扩展点 / 注意
- 新增全局入口：在 `AppSidebar` 加导航项 + `App.vue` 加弹窗宿主。
- 会话级弹窗（LoreBook/CardInfo/StatusEditor/Import）仍在 `SessionListView`，不提升。
