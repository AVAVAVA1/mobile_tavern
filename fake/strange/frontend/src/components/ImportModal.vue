<template>
  <div v-if="visible" class="sheet">
    <div class="container">
      <h1 class="title">Import Character Card</h1>
      <p class="subtitle">
        Select a PNG character card from your device.<br />
        Supports 类脑 / SillyTavern / TavernAI formats (V1/V2/V3).
      </p>

      <div v-if="error" class="error-box">
        <span class="error-text">{{ error }}</span>
      </div>

      <button class="import-btn" :disabled="importing" @click="pickFile">
        {{ importing ? "Importing..." : "Choose PNG from Gallery" }}
      </button>

      <button class="cancel-btn" @click="emit('close')">Cancel</button>

      <input
        ref="fileInput"
        type="file"
        accept="image/png"
        class="hidden-input"
        @change="onFileChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useSessionsStore } from "../stores/sessions";

defineProps<{ visible: boolean }>();
const emit = defineEmits<{
  (e: "close"): void;
  (e: "imported", id: string): void;
}>();

const sessionsStore = useSessionsStore();

const importing = ref(false);
const error = ref("");
const fileInput = ref<HTMLInputElement | null>(null);

function pickFile(): void {
  error.value = "";
  fileInput.value?.click();
}

async function onFileChange(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  error.value = "";
  importing.value = true;
  try {
    const session = await sessionsStore.importCard(file);
    importing.value = false;
    emit("imported", session.id);
    emit("close");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error.value =
      message && !message.includes("HTTP")
        ? `Import failed: ${message}`
        : "Could not parse character data from this PNG. Make sure it's a valid character card from 类脑 or SillyTavern.";
    importing.value = false;
  } finally {
    // allow re-selecting the same file
    input.value = "";
  }
}
</script>

<style scoped>
.container {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 24px;
  max-width: 480px;
  margin: 0 auto;
  width: 100%;
}
.title {
  color: var(--text);
  font-size: 26px;
  font-weight: 700;
  text-align: center;
  margin: 0 0 12px;
}
.subtitle {
  color: var(--text-dim);
  font-size: 14px;
  text-align: center;
  line-height: 20px;
  margin: 0 0 32px;
}
.error-box {
  background: rgba(233, 69, 96, 0.15);
  border: 1px solid var(--accent);
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 20px;
}
.error-text {
  color: var(--accent);
  font-size: 13px;
  line-height: 18px;
}
.import-btn {
  background: var(--accent);
  border: none;
  border-radius: 12px;
  padding: 18px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}
.import-btn:disabled {
  opacity: 0.7;
  cursor: default;
}
.cancel-btn {
  background: none;
  border: none;
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
  color: var(--text-dim);
  font-size: 15px;
}
.hidden-input {
  display: none;
}
</style>
