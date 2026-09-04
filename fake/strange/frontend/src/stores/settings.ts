import { defineStore } from "pinia";
import { ref } from "vue";
import * as api from "../api";
import type { AppSettings } from "../types";

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  model: "gpt-3.5-turbo",
  baseUrl: "https://api.openai.com/v1",
  summarizeThreshold: 30,
  userName: "User",
  authorNoteText: "",
  authorNoteDepth: 4,
  storyStringTemplate: "",
  autoSummarize: true,
  customSystemPrompt: "",
  statusBarEnabled: false,
  enableThinking: true,
  reasoningEffort: "high",
};

export const useSettingsStore = defineStore("settings", () => {
  const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS });
  const loaded = ref(false);
  const loading = ref(false);

  async function load(): Promise<void> {
    if (loading.value) return;
    loading.value = true;
    try {
      settings.value = await api.getSettings();
      loaded.value = true;
    } catch (e) {
      // Keep defaults on failure; the app still renders.
      console.warn("[settings] load failed:", e);
    } finally {
      loading.value = false;
    }
  }

  async function save(partial: Partial<AppSettings>): Promise<AppSettings> {
    const merged = await api.putSettings(partial);
    settings.value = merged;
    loaded.value = true;
    return merged;
  }

  return { settings, loaded, loading, load, save };
});
