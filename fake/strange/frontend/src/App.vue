<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useSettingsStore } from "./stores/settings";
import { useSessionsStore } from "./stores/sessions";

const settingsStore = useSettingsStore();
const sessionsStore = useSessionsStore();

onMounted(() => {
  settingsStore.load();
  sessionsStore.load();
});
</script>
