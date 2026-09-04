<template>
  <div class="app-shell">
    <AppSidebar
      :collapsed="collapsed"
      @toggle-collapse="collapsed = !collapsed"
      @open="openModal"
    />
    <main class="app-main">
      <router-view />
    </main>

    <SettingsModal :visible="showSettings" @close="showSettings = false" />
    <PresetsEditor :visible="showPresets" @close="showPresets = false" />
    <RegexEditor :visible="showRegex" @close="showRegex = false" />
    <WorldInfoEditor :visible="showWorld" @close="showWorld = false" />
    <PicGenerateModal :visible="showPic" @close="showPic = false" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useSettingsStore } from "./stores/settings";
import { useSessionsStore } from "./stores/sessions";
import { useAppDataStore } from "./stores/appdata";
import AppSidebar from "./components/AppSidebar.vue";
import SettingsModal from "./components/SettingsModal.vue";
import PresetsEditor from "./components/PresetsEditor.vue";
import RegexEditor from "./components/RegexEditor.vue";
import WorldInfoEditor from "./components/WorldInfoEditor.vue";
import PicGenerateModal from "./components/PicGenerateModal.vue";

const settingsStore = useSettingsStore();
const sessionsStore = useSessionsStore();
const appDataStore = useAppDataStore();

const collapsed = ref(false);
const showSettings = ref(false);
const showPresets = ref(false);
const showRegex = ref(false);
const showWorld = ref(false);
const showPic = ref(false);

function openModal(name: string): void {
  if (name === "settings") showSettings.value = true;
  else if (name === "presets") showPresets.value = true;
  else if (name === "regex") showRegex.value = true;
  else if (name === "worldinfo") showWorld.value = true;
  else if (name === "pic") showPic.value = true;
}

onMounted(() => {
  settingsStore.load();
  sessionsStore.load();
  appDataStore.load();
});
</script>

<style>
.app-shell {
  display: flex;
  height: 100%;
  background: var(--bg);
}
.app-main {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
