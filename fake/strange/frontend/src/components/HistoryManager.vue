<template>
  <div v-if="visible" class="sheet">
    <!-- Header -->
    <header class="header">
      <button class="back-btn" @click="emit('close')">← Back</button>
      <span class="title">Context ({{ chatMessages.length }} msgs)</span>
      <span class="spacer"></span>
    </header>

    <div class="body">
      <!-- Mode buttons -->
      <div class="mode-row">
        <button
          class="mode-btn"
          :class="{ active: mode === 'view' }"
          @click="switchMode('view')"
        >
          View
        </button>
        <button
          class="mode-btn"
          :class="{ active: mode === 'summarize' }"
          @click="mode = 'summarize'"
        >
          Summarize
        </button>
      </div>

      <div v-if="!context" class="loading-text">Loading context…</div>

      <template v-else>
        <!-- System prompts -->
        <div class="system-group">
          <button class="system-toggle" @click="showNormal = !showNormal">
            <span class="system-toggle-text">
              {{ showNormal ? "▼" : "▶" }} System Prompt ({{ systemMessages.length }})
            </span>
          </button>
          <template v-if="showNormal">
            <button
              v-for="(msg, idx) in systemMessages"
              :key="'n' + idx"
              class="system-block"
              @click="setDetail(`System ${idx + 1}`, msg.content)"
            >
              <div class="system-role">system {{ idx + 1 }}</div>
              <div class="system-content clamp-10">{{ msg.content }}</div>
            </button>
          </template>
        </div>

        <!-- Chat messages -->
        <div
          v-for="(msg, idx) in chatMessages"
          :key="'m' + idx"
          class="msg-row"
          :class="{ selected: isSelected(idx) }"
        >
          <div v-if="mode === 'summarize'" class="check-area" @click="toggleSelect(idx)">
            <div class="checkbox" :class="{ checked: isSelected(idx) }">
              <span v-if="isSelected(idx)" class="checkmark">✓</span>
            </div>
          </div>
          <div class="msg-content" @click="setDetail(msg.role === 'user' ? 'You' : 'AI', msg.content)">
            <div class="msg-role" :class="{ user: msg.role === 'user' }">
              {{ msg.role === "user" ? "You" : "AI" }}
            </div>
            <div class="msg-preview clamp-3">{{ msg.content }}</div>
          </div>
          <button v-if="msg.id" class="delete-btn" @click="handleDelete(idx)">✕</button>
        </div>

        <!-- Summarize controls -->
        <div v-if="mode === 'summarize'" class="summary-section">
          <label class="section-label">Prompt</label>
          <textarea
            v-model="summarizePrompt"
            class="prompt-input"
            placeholder="Summarize the conversation so far, preserving key plot points, character details, and recent events."
          ></textarea>

          <button class="select-all" @click="selectAll">
            {{
              selected.size === chatMessages.length
                ? "Deselect All"
                : `Select All (${selected.size}/${chatMessages.length})`
            }}
          </button>

          <button class="summarize-btn" :disabled="loading" @click="handleSummarize">
            <span v-if="loading" class="spinner"></span>
            <span v-else>
              Summarize {{ selected.size > 0 ? `Selected (${selected.size})` : "All" }}
            </span>
          </button>

          <div v-if="summaryResult" class="result-box">
            <div class="result-label">Result:</div>
            <div class="result-text">{{ summaryResult }}</div>
            <div
              v-if="
                !summaryResult.startsWith('Error:') &&
                summaryResult !== '(empty)'
              "
              class="result-btns"
            >
              <button class="apply-btn" @click="applySummary">Apply</button>
              <button class="discard-btn" @click="summaryResult = ''">Discard</button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Detail overlay -->
    <div v-if="detail" class="detail-overlay">
      <div class="detail-box">
        <div class="detail-header">
          <span class="detail-title">{{ detail.title }}</span>
          <button class="detail-close" @click="detail = null">✕</button>
        </div>
        <div class="detail-body">
          <div class="detail-text">{{ detail.text }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import * as api from "../api";
import { useSessionsStore } from "../stores/sessions";
import type { ContextView } from "../types";

const props = defineProps<{ visible: boolean; sessionId: string }>();
const emit = defineEmits<{ (e: "close"): void }>();

const sessionsStore = useSessionsStore();

const context = ref<ContextView | null>(null);
const mode = ref<"view" | "summarize">("view");
const selected = ref<Set<string>>(new Set());
const summaryResult = ref("");
const loading = ref(false);
const detail = ref<{ title: string; text: string } | null>(null);
const summarizedMsgIds = ref<string[]>([]);
const summarizePrompt = ref("");

const showNormal = ref(true);

const chatMessages = computed(() => context.value?.chatMessages ?? []);
const systemMessages = computed(() => context.value?.systemMessages ?? []);

async function loadContext(): Promise<void> {
  try {
    context.value = await api.getContext(props.sessionId);
  } catch (e) {
    console.warn("[history] getContext failed:", e);
    context.value = null;
  }
}

watch(
  () => props.visible,
  async (v) => {
    if (v) {
      mode.value = "view";
      selected.value = new Set();
      summaryResult.value = "";
      summarizedMsgIds.value = [];
      summarizePrompt.value = "";
      detail.value = null;
      await loadContext();
    }
  }
);

function switchMode(m: "view" | "summarize"): void {
  mode.value = m;
  selected.value = new Set();
}

function isSelected(idx: number): boolean {
  return selected.value.has(String(idx));
}

function toggleSelect(idx: number): void {
  const key = String(idx);
  const next = new Set(selected.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  selected.value = next;
}

function selectAll(): void {
  if (selected.value.size === chatMessages.value.length) {
    selected.value = new Set();
  } else {
    selected.value = new Set(chatMessages.value.map((_, i) => String(i)));
  }
}

function setDetail(title: string, text: string): void {
  detail.value = { title, text };
}

async function handleDelete(idx: number): Promise<void> {
  const msg = chatMessages.value[idx];
  if (msg?.id) {
    await sessionsStore.removeFromContext(props.sessionId, msg.id);
    await loadContext();
  }
}

async function handleSummarize(): Promise<void> {
  const msgs = chatMessages.value;
  if (msgs.length === 0) return;

  const indices =
    mode.value === "summarize" && selected.value.size > 0
      ? [...selected.value].map(Number).sort((a, b) => a - b)
      : msgs.map((_, i) => i);

  const ids = indices
    .map((i) => msgs[i]?.id)
    .filter((id): id is string => !!id);

  if (indices.length === 0) return;

  loading.value = true;
  try {
    const result = await api.summarize(props.sessionId, {
      messageIds: ids,
      prompt: summarizePrompt.value.trim(),
    });
    summaryResult.value = result.summary || "(empty)";
    summarizedMsgIds.value = ids;
  } catch (e) {
    summaryResult.value = `Error: ${(e as Error)?.message ?? e}`;
  } finally {
    loading.value = false;
  }
}

async function applySummary(): Promise<void> {
  if (
    !summaryResult.value ||
    summaryResult.value.startsWith("Error:") ||
    summaryResult.value === "(empty)"
  ) {
    return;
  }
  try {
    await api.applySummary(props.sessionId, {
      summary: summaryResult.value,
      messageIds: summarizedMsgIds.value,
    });
    await sessionsStore.refreshSession(props.sessionId);
    summaryResult.value = "";
    summarizedMsgIds.value = [];
    mode.value = "view";
    selected.value = new Set();
    await loadContext();
  } catch (e) {
    summaryResult.value = `Error: ${(e as Error)?.message ?? e}`;
  }
}
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  background: #16213e;
  border-bottom: 1px solid #2a2a4a;
}
.back-btn {
  background: none;
  border: none;
  color: #a0a0b8;
  font-size: 16px;
  padding: 4px 8px;
}
.title {
  color: #e0e0e0;
  font-size: 16px;
  font-weight: 600;
}
.spacer {
  width: 50px;
}
.body {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
}
.loading-text {
  color: #a0a0b8;
  text-align: center;
  margin-top: 40px;
}

/* Mode */
.mode-row {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}
.mode-btn {
  flex: 1;
  background: #16213e;
  border-radius: 8px;
  padding: 10px;
  color: #888;
  font-size: 14px;
  border: 1px solid #2a2a4a;
}
.mode-btn.active {
  border-color: #e94560;
  background: rgba(233, 69, 96, 0.1);
  color: #e94560;
  font-weight: 600;
}

/* System */
.section-hint {
  color: #10b981;
  font-size: 11px;
  margin-bottom: 8px;
}
.system-group {
  margin-bottom: 10px;
}
.system-toggle {
  background: none;
  border: none;
  color: #a0a0b8;
  font-size: 13px;
  padding: 0;
  margin-bottom: 6px;
  text-align: left;
}
.system-toggle-text {
  color: inherit;
  font-size: 13px;
}
.system-block {
  display: block;
  width: 100%;
  text-align: left;
  background: #16213e;
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 8px;
  border: 1px solid #2a2a4a;
  cursor: pointer;
}
.system-role {
  color: #e94560;
  font-size: 11px;
  margin-bottom: 4px;
}
.agent-role {
  font-size: 11px;
  margin-bottom: 4px;
  font-weight: 600;
}
.system-content {
  color: #888;
  font-size: 12px;
  line-height: 17px;
}
.clamp-8 {
  display: -webkit-box;
  -webkit-line-clamp: 8;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.clamp-10 {
  display: -webkit-box;
  -webkit-line-clamp: 10;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.entry-list {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 8px;
  margin: 0 0 8px 12px;
}
.entry-item {
  color: #f0c040;
  font-size: 11px;
  line-height: 16px;
}

/* Messages */
.msg-row {
  display: flex;
  align-items: flex-start;
  padding: 8px 10px;
  border-bottom: 1px solid #1a1a2e;
  border-radius: 6px;
  margin-bottom: 2px;
}
.msg-row.selected {
  background: rgba(233, 69, 96, 0.08);
}
.check-area {
  padding: 2px 10px 0 0;
  cursor: pointer;
}
.checkbox {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid #555;
  display: flex;
  align-items: center;
  justify-content: center;
}
.checkbox.checked {
  background: #e94560;
  border-color: #e94560;
}
.checkmark {
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}
.msg-content {
  flex: 1;
  cursor: pointer;
}
.msg-role {
  color: #3b82f6;
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 2px;
}
.msg-role.user {
  color: #e94560;
}
.msg-preview {
  color: #c0c0c0;
  font-size: 13px;
  line-height: 18px;
}
.clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.delete-btn {
  background: none;
  border: none;
  color: #e94560;
  font-size: 16px;
  font-weight: 700;
  padding: 2px 0 0 8px;
}

/* Summary */
.summary-section {
  margin-top: 16px;
}
.section-label {
  color: #a0a0b8;
  font-size: 13px;
  margin-bottom: 6px;
  display: block;
}
.prompt-input {
  width: 100%;
  background: #1a1a2e;
  color: #e0e0e0;
  border-radius: 8px;
  padding: 12px;
  font-size: 13px;
  border: 1px solid #2a2a4a;
  min-height: 70px;
  resize: vertical;
  margin-bottom: 12px;
}
.prompt-input::placeholder {
  color: #555;
}
.select-all {
  background: none;
  border: none;
  color: #3b82f6;
  font-size: 13px;
  padding: 0;
  margin-bottom: 10px;
}
.summarize-btn {
  width: 100%;
  background: #e94560;
  border: none;
  border-radius: 10px;
  padding: 14px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.summarize-btn:disabled {
  opacity: 0.7;
}
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.result-box {
  margin-top: 14px;
  background: #16213e;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #2a2a4a;
}
.result-label {
  color: #888;
  font-size: 12px;
  margin-bottom: 8px;
}
.result-text {
  color: #e0e0e0;
  font-size: 14px;
  line-height: 20px;
  white-space: pre-wrap;
}
.result-btns {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}
.apply-btn {
  flex: 1;
  background: #3b82f6;
  border: none;
  border-radius: 8px;
  padding: 12px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}
.discard-btn {
  flex: 1;
  border-radius: 8px;
  padding: 12px;
  background: none;
  border: 1px solid #555;
  color: #a0a0b8;
  font-size: 14px;
}

/* Detail overlay */
.detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
}
.detail-box {
  background: #16213e;
  border-radius: 16px;
  width: min(92%, 640px);
  max-height: 80%;
  display: flex;
  flex-direction: column;
  border: 1px solid #2a2a4a;
}
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #2a2a4a;
}
.detail-title {
  color: #e0e0e0;
  font-size: 16px;
  font-weight: 600;
}
.detail-close {
  background: none;
  border: none;
  color: #e94560;
  font-size: 20px;
  font-weight: 700;
  padding: 0;
}
.detail-body {
  padding: 16px;
  overflow-y: auto;
}
.detail-text {
  color: #e0e0e0;
  font-size: 14px;
  line-height: 22px;
  white-space: pre-wrap;
}
</style>
