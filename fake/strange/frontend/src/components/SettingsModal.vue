<template>
  <div v-if="visible" class="sheet">
    <div class="scroll">
      <h1 class="title">API Settings</h1>

      <label class="label">User Name</label>
      <input v-model="userName" class="input" placeholder="User" />
      <div class="hint" v-pre>Your display name used in {{user}} placeholders.</div>

      <div class="switch-row">
        <span class="label">状态栏 (Status Bar)</span>
        <ToggleSwitch v-model="statusBarEnabled" color="#10b981" />
      </div>
      <div class="hint">
        每轮回复后按状态栏 schema 更新角色状态（可在会话卡片 Status 里自定义字段）。
      </div>

      <div class="section-label">Presets</div>
      <div class="preset-row">
        <button
          v-for="p in PRESETS"
          :key="p.label"
          class="preset-btn"
          @click="applyPreset(p)"
        >
          {{ p.label }}
        </button>
      </div>

      <label class="label">API Key</label>
      <input v-model="apiKey" type="password" class="input" placeholder="sk-..." />

      <label class="label">Model</label>
      <input v-model="model" class="input" placeholder="gpt-3.5-turbo" />

      <label class="label">Base URL</label>
      <input v-model="baseUrl" class="input" placeholder="https://api.openai.com/v1" />
      <div class="hint">Any OpenAI-compatible API endpoint works.</div>

      <div class="section-label">Context</div>

      <label class="label">Custom System Prompt</label>
      <textarea
        v-model="customSystemPrompt"
        class="input multiline"
        placeholder="Global instructions prepended to every request..."
      ></textarea>
      <div class="hint">Prepended before the character card's system prompt.</div>

      <label class="label">Summarize Threshold</label>
      <input v-model="summarizeThreshold" class="input" placeholder="30" />
      <div class="hint">
        Auto-summarize older messages every N messages. Set to 0 to disable.
      </div>

      <div class="switch-row">
        <div>
          <div class="label">Auto Summarize</div>
          <div class="switch-hint">Automatically trigger summarization</div>
        </div>
        <ToggleSwitch v-model="autoSummarize" color="#e94560" />
      </div>

      <label class="label">Author's Note</label>
      <textarea
        v-model="authorNoteText"
        class="input multiline"
        placeholder="e.g. The story is getting intense..."
      ></textarea>
      <div class="hint">A floating prompt injected into the chat at a set depth.</div>

      <label class="label">Author's Note Depth</label>
      <input v-model="authorNoteDepth" class="input" placeholder="4" />
      <div class="hint">Insert N messages from the end (0=latest, 4=fourth from end).</div>

      <label class="label">Story String Template</label>
      <textarea
        v-model="storyStringTemplate"
        class="input multiline"
        placeholder="Customize prompt layout with macros..."
      ></textarea>
      <div class="hint" v-pre>
        Available macros: {{char}} {{user}} {{description}}
        {{personality}} {{scenario}} {{system}}
        {{wi_before}} {{wi_after}} {{post_history}}
        {{mes_example_raw}}. Leave empty for default.
      </div>

      <button class="save-btn" @click="handleSave">{{ saved ? "Saved!" : "Save" }}</button>
      <button class="cancel-btn" @click="emit('close')">Close</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useSettingsStore } from "../stores/settings";
import type { AppSettings } from "../types";
import ToggleSwitch from "./ToggleSwitch.vue";

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const settingsStore = useSettingsStore();

const PRESETS: { label: string; config: Partial<AppSettings> }[] = [
  { label: "OpenAI", config: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o" } },
  { label: "DeepSeek", config: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-flash" } },
  { label: "Grok", config: { baseUrl: "https://api.x.ai/v1", model: "grok-2" } },
  { label: "Ollama", config: { baseUrl: "http://localhost:11434/v1", model: "llama3" } },
];

const apiKey = ref("");
const model = ref("");
const baseUrl = ref("");
const summarizeThreshold = ref("30");
const userName = ref("User");
const authorNoteText = ref("");
const authorNoteDepth = ref("4");
const storyStringTemplate = ref("");
const autoSummarize = ref(true);
const customSystemPrompt = ref("");
const statusBarEnabled = ref(false);
const saved = ref(false);

function initFromStore(): void {
  const s = settingsStore.settings;
  apiKey.value = s.apiKey ?? "";
  model.value = s.model ?? "";
  baseUrl.value = s.baseUrl ?? "";
  summarizeThreshold.value = String(s.summarizeThreshold ?? 30);
  userName.value = s.userName ?? "User";
  authorNoteText.value = s.authorNoteText ?? "";
  authorNoteDepth.value = String(s.authorNoteDepth ?? 4);
  storyStringTemplate.value = s.storyStringTemplate ?? "";
  autoSummarize.value = s.autoSummarize ?? true;
  customSystemPrompt.value = s.customSystemPrompt ?? "";
  statusBarEnabled.value = s.statusBarEnabled ?? false;
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      initFromStore();
      saved.value = false;
    }
  }
);

function applyPreset(preset: { label: string; config: Partial<AppSettings> }): void {
  baseUrl.value = preset.config.baseUrl ?? baseUrl.value;
  model.value = preset.config.model ?? model.value;
}

async function handleSave(): Promise<void> {
  const thresholdNum = parseInt(summarizeThreshold.value, 10);
  const depthNum = parseInt(authorNoteDepth.value, 10);
  await settingsStore.save({
    apiKey: apiKey.value.replace(/[^\x20-\x7E]/g, "").trim(),
    model: model.value.trim(),
    baseUrl: baseUrl.value.trim(),
    summarizeThreshold: isNaN(thresholdNum) ? 30 : thresholdNum,
    userName: userName.value.trim() || "User",
    authorNoteText: authorNoteText.value.trim(),
    authorNoteDepth: isNaN(depthNum) ? 4 : depthNum,
    storyStringTemplate: storyStringTemplate.value.trim(),
    autoSummarize: autoSummarize.value,
    customSystemPrompt: customSystemPrompt.value.trim(),
    statusBarEnabled: statusBarEnabled.value,
  });
  saved.value = true;
  setTimeout(() => (saved.value = false), 1500);
}
</script>

<style scoped>
.scroll {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  padding-top: 40px;
}
.title {
  color: #e0e0e0;
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 28px;
  text-align: center;
}
.section-label {
  color: #a0a0b8;
  font-size: 13px;
  margin: 20px 0 8px;
}
.preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}
.preset-btn {
  background: #16213e;
  border: 1px solid #2a2a4a;
  border-radius: 8px;
  padding: 8px 14px;
  color: #a0a0b8;
  font-size: 13px;
}
.label {
  color: #a0a0b8;
  font-size: 14px;
  margin: 16px 0 6px;
  display: block;
}
.input {
  width: 100%;
  background: #16213e;
  color: #e0e0e0;
  border-radius: 10px;
  padding: 14px;
  font-size: 16px;
  border: 1px solid #2a2a4a;
}
.input::placeholder {
  color: #666;
}
.multiline {
  min-height: 70px;
  resize: vertical;
}
.switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}
.switch-row .label {
  margin: 0;
}
.switch-hint {
  color: #555;
  font-size: 11px;
  margin-top: 2px;
}
.hint {
  color: #666;
  font-size: 12px;
  margin-top: 6px;
}
.save-btn {
  width: 100%;
  background: #e94560;
  border: none;
  border-radius: 10px;
  padding: 16px;
  margin-top: 32px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}
.cancel-btn {
  width: 100%;
  background: none;
  border: none;
  border-radius: 10px;
  padding: 16px;
  margin-top: 12px;
  color: #a0a0b8;
  font-size: 16px;
}
</style>
