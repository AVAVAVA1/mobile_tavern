import { defineStore } from "pinia";
import { ref } from "vue";
import * as api from "../api";
import type { Preset, RegexScript, WorldInfoEntry } from "../types";

export const useAppDataStore = defineStore("appdata", () => {
  const presets = ref<Preset[]>([]);
  const regexScripts = ref<RegexScript[]>([]);
  const worldInfo = ref<WorldInfoEntry[]>([]);
  const loaded = ref(false);
  const loading = ref(false);

  async function load(): Promise<void> {
    if (loading.value) return;
    loading.value = true;
    try {
      const [p, r, w] = await Promise.all([
        api.getPresets(),
        api.getRegexScripts(),
        api.getWorldInfo(),
      ]);
      presets.value = p;
      regexScripts.value = r;
      worldInfo.value = w;
      loaded.value = true;
    } catch (e) {
      console.warn("[appdata] load failed:", e);
    } finally {
      loading.value = false;
    }
  }

  async function savePresets(items: Preset[]): Promise<void> {
    presets.value = await api.putPresets(items);
  }

  async function saveRegexScripts(items: RegexScript[]): Promise<void> {
    regexScripts.value = await api.putRegexScripts(items);
  }

  async function saveWorldInfo(items: WorldInfoEntry[]): Promise<void> {
    worldInfo.value = await api.putWorldInfo(items);
  }

  return {
    presets,
    regexScripts,
    worldInfo,
    loaded,
    loading,
    load,
    savePresets,
    saveRegexScripts,
    saveWorldInfo,
  };
});
