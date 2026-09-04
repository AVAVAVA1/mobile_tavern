// 主题管理：深色/浅色切换，持久化到 localStorage，通过 html[data-theme] 驱动 CSS 变量。
import { ref } from "vue";

export type Theme = "dark" | "light";

const STORAGE_KEY = "2b2-theme";

const theme = ref<Theme>(
  (localStorage.getItem(STORAGE_KEY) as Theme | null) || "dark"
);

function applyTheme(): void {
  document.documentElement.setAttribute("data-theme", theme.value);
}

export function useTheme() {
  function init(): void {
    applyTheme();
  }
  function toggle(): void {
    theme.value = theme.value === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, theme.value);
    applyTheme();
  }
  return { theme, init, toggle };
}
