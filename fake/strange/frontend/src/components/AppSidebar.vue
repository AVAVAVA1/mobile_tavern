<template>
  <aside class="sidebar" :class="{ collapsed }">
    <!-- 头部：logo + 主题切换 + 折叠按钮 -->
    <div class="sidebar-header">
      <div v-if="!collapsed" class="logo">
        <span class="logo-mark">2b2</span>
      </div>
      <button
        class="icon-btn theme-btn"
        :title="theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'"
        @click="toggleTheme"
      >
        <span class="theme-icon">{{ theme === "dark" ? "🌙" : "☀️" }}</span>
      </button>
      <button class="icon-btn collapse-btn" :title="collapsed ? '展开侧边栏' : '收起侧边栏'" @click="emit('toggle-collapse')">
        <span v-if="collapsed">›</span>
        <span v-else>‹</span>
      </button>
    </div>

    <!-- 导航 -->
    <nav class="sidebar-nav">
      <button
        class="nav-btn"
        :class="{ active: route.path === '/' }"
        :title="collapsed ? '对话' : ''"
        @click="go('/')"
      >
        <span class="nav-icon">💬</span>
        <span v-if="!collapsed" class="nav-label">对话</span>
      </button>

      <button
        class="nav-btn"
        :class="{ active: route.path === '/generate' }"
        :title="collapsed ? '角色卡生成' : ''"
        @click="go('/generate')"
      >
        <span class="nav-icon">⚡</span>
        <span v-if="!collapsed" class="nav-label">角色卡生成</span>
      </button>

      <div class="nav-divider"></div>

      <button class="nav-btn" :title="collapsed ? '预设' : ''" @click="emit('open', 'presets')">
        <span class="nav-icon">🎛️</span>
        <span v-if="!collapsed" class="nav-label">预设</span>
      </button>

      <button class="nav-btn" :title="collapsed ? '世界书' : ''" @click="emit('open', 'worldinfo')">
        <span class="nav-icon">📖</span>
        <span v-if="!collapsed" class="nav-label">世界书</span>
      </button>

      <button class="nav-btn" :title="collapsed ? '正则脚本' : ''" @click="emit('open', 'regex')">
        <span class="nav-icon">🔤</span>
        <span v-if="!collapsed" class="nav-label">正则脚本</span>
      </button>

      <button class="nav-btn" :title="collapsed ? '生图' : ''" @click="emit('open', 'pic')">
        <span class="nav-icon">🖼️</span>
        <span v-if="!collapsed" class="nav-label">生图</span>
      </button>

      <div class="nav-divider"></div>

      <button class="nav-btn" :title="collapsed ? '设置' : ''" @click="emit('open', 'settings')">
        <span class="nav-icon">⚙️</span>
        <span v-if="!collapsed" class="nav-label">设置</span>
      </button>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { useTheme } from "../utils/theme";

defineProps<{ collapsed: boolean }>();
const emit = defineEmits<{
  (e: "toggle-collapse"): void;
  (e: "open", modal: string): void;
}>();

const route = useRoute();
const router = useRouter();
const { theme, toggle: toggleTheme } = useTheme();

function go(path: string): void {
  if (route.path !== path) router.push(path);
}
</script>

<style scoped>
.sidebar {
  width: 240px;
  flex-shrink: 0;
  background: var(--panel);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;
  overflow: hidden;
}
.sidebar.collapsed {
  width: 64px;
}
.sidebar-header {
  min-height: 56px;
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  gap: 8px;
}
.sidebar.collapsed .sidebar-header {
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  padding: 12px 0;
  gap: 8px;
}
.logo {
  flex: 1;
  display: flex;
  align-items: baseline;
  overflow: hidden;
  white-space: nowrap;
}
.logo-mark {
  color: var(--accent);
  font-weight: 800;
  font-size: 20px;
  letter-spacing: 0.04em;
  text-shadow: 0 0 18px rgba(233, 69, 96, 0.35);
}
.icon-btn {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-dim);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.15s ease, color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.icon-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  transform: translateY(-1px);
  box-shadow: 0 2px 10px rgba(233, 69, 96, 0.18);
}
.theme-icon {
  font-size: 15px;
  line-height: 1;
}
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sidebar.collapsed .sidebar-nav {
  padding: 10px 8px;
}
.nav-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: none;
  color: var(--text-dim);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease, color 0.15s ease;
}
.sidebar.collapsed .nav-btn {
  justify-content: center;
  padding: 10px 0;
}
.nav-btn:hover {
  background: rgba(var(--overlay-rgb), 0.04);
  color: var(--text);
}
.nav-btn.active {
  background: rgba(233, 69, 96, 0.12);
  color: var(--accent);
}
.nav-icon {
  font-size: 18px;
  width: 22px;
  text-align: center;
  flex-shrink: 0;
}
.nav-label {
  white-space: nowrap;
  overflow: hidden;
}
.nav-divider {
  height: 1px;
  background: var(--border);
  margin: 6px 4px;
}
</style>
