<template>
  <div class="container">
    <!-- Header -->
    <header class="header">
      <button class="back-btn" @click="router.push('/')">← Back</button>
      <div class="header-title">{{ displayTitle }}</div>
      <button class="hist-btn" @click="historyVisible = true">Hist</button>
    </header>

    <!-- Session not found -->
    <div v-if="!session" class="error-text">Session not found</div>

    <template v-else>
      <!-- Messages -->
      <div ref="scrollContainer" class="list" @scroll="onScroll">
        <div class="list-content">
          <div v-if="messages.length === 0" class="empty-text">
            Start chatting with {{ displayTitle }}!
          </div>
          <MessageBubble
            v-for="msg in messages"
            :key="msg.id"
            :message="msg"
            :char-name="charName"
            :user-name="userName"
            :generating="generatingImage"
            :regex-scripts="displayRegexScripts"
            @generate-image="generateImage"
          />
        </div>
      </div>

      <!-- Scroll to bottom -->
      <button v-if="showScrollBtn" class="scroll-btn" @click="scrollToBottom">
        ↓
      </button>

      <!-- Typing / 生图中 -->
      <div v-if="loading || generatingImage" class="loading-bar">
        <span class="spinner"></span>
        <span class="loading-text">
          {{ generatingImage ? "2b2娘正在创作图片ing" : displayTitle + " is typing..." }}
        </span>
      </div>

      <!-- Input -->
      <div class="input-bar">
        <textarea
          v-model="input"
          class="input"
          rows="1"
          placeholder="Type a message..."
          :disabled="loading || generatingImage"
          maxlength="4000"
          @keydown.enter.exact.prevent="send"
        ></textarea>
        <button v-if="loading" class="stop-btn" @click="stop">Stop</button>
        <button v-else class="send-btn" :disabled="generatingImage" @click="send">Send</button>
      </div>
    </template>

    <!-- History manager -->
    <HistoryManager
      :visible="historyVisible"
      :session-id="props.id"
      @close="historyVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useSessionsStore } from "../stores/sessions";
import { useSettingsStore } from "../stores/settings";
import { useAppDataStore } from "../stores/appdata";
import { streamChat, generateImageForMessage } from "../api";
import type { ChatMessage, RegexScript } from "../types";
import { normalizeRegexScript } from "../utils/regex";
import MessageBubble from "../components/MessageBubble.vue";
import HistoryManager from "../components/HistoryManager.vue";

const props = defineProps<{ id: string }>();

const router = useRouter();
const sessionsStore = useSessionsStore();
const settingsStore = useSettingsStore();
const appDataStore = useAppDataStore();

const input = ref("");
const loading = ref(false);
const showScrollBtn = ref(false);
const historyVisible = ref(false);
const scrollContainer = ref<HTMLElement | null>(null);
const isNearBottom = ref(true);
const abortController = ref<AbortController | null>(null);
const generatingImage = ref(false);

const session = computed(() => sessionsStore.getById(props.id));
const messages = computed(() => session.value?.messages ?? []);

const displayTitle = computed(
  () => session.value?.title || session.value?.characterCard.data.name || "Character"
);
const charName = computed(
  () => session.value?.characterCard.data.name || "Character"
);
const userName = computed(() => session.value?.userName || "User");

// 显示侧正则脚本（全局 + 角色级）
const displayRegexScripts = computed<RegexScript[]>(() => {
  const global = appDataStore.regexScripts.map((s) => normalizeRegexScript(s, "global"));
  const data = session.value?.characterCard.data as any;
  const raw =
    data?.extensions?.regex_scripts ?? data?.regex_scripts ?? data?.regexScripts;
  const character = Array.isArray(raw)
    ? (raw as any[]).map((s) => normalizeRegexScript(s, "character"))
    : [];
  return [...global, ...character.filter((s) => s.scope !== "global")];
});

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function scrollToBottom(): void {
  nextTick(() => {
    const el = scrollContainer.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

function onScroll(): void {
  const el = scrollContainer.value;
  if (!el) return;
  const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
  isNearBottom.value = distFromBottom < 150;
  showScrollBtn.value = distFromBottom > 500;
}

// Auto-follow while near bottom.
watch(
  messages,
  () => {
    if (isNearBottom.value) scrollToBottom();
  },
  { deep: true }
);

onMounted(async () => {
  if (!appDataStore.loaded) appDataStore.load();
  await sessionsStore.refreshSession(props.id);
  scrollToBottom();
});

async function send(): Promise<void> {
  const text = input.value.trim();
  if (loading.value || generatingImage.value || !text) return;

  const settings = settingsStore.settings;
  if (!settings.apiKey) {
    window.alert("API Key Required\n\nGo to Settings to configure your API key.");
    return;
  }
  const currentSession = sessionsStore.getById(props.id);
  if (!currentSession) return;

  input.value = "";

  const userMsg: ChatMessage = {
    id: generateId(),
    role: "user",
    content: text,
    timestamp: Date.now(),
  };
  const assistantMsg: ChatMessage = {
    id: generateId(),
    role: "assistant",
    content: "",
    timestamp: Date.now(),
  };

  sessionsStore.pushMessage(props.id, userMsg);
  sessionsStore.pushMessage(props.id, assistantMsg);

  loading.value = true;
  const controller = new AbortController();
  abortController.value = controller;

  let statusMsgId: string | null = null;

  const ensureStatusMessage = (): string => {
    if (statusMsgId) return statusMsgId;
    const s = sessionsStore.getById(props.id);
    const last = s?.messages[s.messages.length - 1];
    if (last && last.messageType === "status" && last.id !== assistantMsg.id) {
      statusMsgId = last.id;
      return last.id;
    }
    const statusMsg: ChatMessage = {
      id: generateId(),
      role: "system",
      content: "",
      timestamp: Date.now(),
      messageType: "status",
    };
    sessionsStore.pushMessage(props.id, statusMsg);
    statusMsgId = statusMsg.id;
    return statusMsg.id;
  };

  try {
    await streamChat(props.id, text, {
      signal: controller.signal,
      onDelta: (content) => {
        sessionsStore.appendContent(props.id, assistantMsg.id, content);
      },
      onStatusDelta: (content) => {
        sessionsStore.appendContent(props.id, ensureStatusMessage(), content);
      },
      onReplyMeta: (meta) => {
        sessionsStore.updateMessage(props.id, assistantMsg.id, (m) => ({
          ...m,
          replyMeta: meta,
        }));
      },
      onImageGenerating: () => {
        generatingImage.value = true;
      },
      onImage: (imageMsg) => {
        sessionsStore.insertAfter(props.id, assistantMsg.id, imageMsg);
        generatingImage.value = false;
      },
      onError: (err) => {
        sessionsStore.updateMessage(props.id, assistantMsg.id, (m) => ({
          ...m,
          content: m.content || `Error: ${err.message}`,
        }));
      },
      onDone: () => {
        /* final state is re-synced below */
      },
      onSummary: () => {
        /* re-synced below */
      },
    });
  } catch (e) {
    // AbortError = user stopped; keep whatever was already streamed.
    if ((e as Error)?.name !== "AbortError") {
      sessionsStore.updateMessage(props.id, assistantMsg.id, (m) => ({
        ...m,
        content: m.content || `Error: ${(e as Error)?.message ?? e}`,
      }));
    }
  } finally {
    loading.value = false;
    generatingImage.value = false;
    abortController.value = null;
    await sessionsStore.refreshSession(props.id);
  }
}

function stop(): void {
  abortController.value?.abort();
}

async function generateImage(messageId: string): Promise<void> {
  if (generatingImage.value) return;
  generatingImage.value = true;
  try {
    const imageMsg = await generateImageForMessage(props.id, messageId);
    sessionsStore.insertAfter(props.id, messageId, imageMsg);
  } catch (e) {
    window.alert(`生图失败：${(e as Error)?.message ?? e}`);
  } finally {
    generatingImage.value = false;
  }
}

// Navigate between chats without remounting (route param change reuses component).
watch(
  () => props.id,
  async (id) => {
    await sessionsStore.refreshSession(id);
    isNearBottom.value = true;
    scrollToBottom();
  }
);
</script>

<style scoped>
.container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}
.back-btn {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 16px;
  padding: 4px 8px;
}
.header-title {
  color: var(--text);
  font-size: 18px;
  font-weight: 600;
  flex: 1;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 8px;
}
.hist-btn {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 14px;
  font-weight: 600;
  padding: 8px;
}

/* List */
.list {
  flex: 1;
  overflow-y: auto;
}
.list-content {
  padding: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.empty-text,
.error-text {
  color: var(--text-faint);
  text-align: center;
  margin-top: 100px;
  font-size: 15px;
}
.error-text {
  color: var(--accent);
  font-size: 16px;
}

/* Scroll to bottom */
.scroll-btn {
  position: absolute;
  right: 16px;
  bottom: 90px;
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background: rgba(128, 128, 128, 0.6);
  border: none;
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  z-index: 5;
}

/* Loading */
.loading-bar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  gap: 8px;
}
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(233, 69, 96, 0.3);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.loading-text {
  color: var(--text-dim);
  font-size: 13px;
}

/* Input */
.input-bar {
  display: flex;
  align-items: flex-end;
  padding: 12px;
  background: var(--panel);
  border-top: 1px solid var(--border);
  gap: 10px;
}
.input {
  flex: 1;
  background: var(--input-bg);
  color: var(--text);
  border-radius: 20px;
  padding: 10px 16px;
  font-size: 15px;
  line-height: 21px;
  border: 1px solid var(--border);
  resize: none;
  max-height: 120px;
}
.input::placeholder {
  color: var(--text-faint);
}
.send-btn {
  background: var(--accent);
  border: none;
  border-radius: 20px;
  padding: 10px 20px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  transition: background-color 0.15s ease, transform 0.1s ease;
}
.send-btn:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
}
.stop-btn {
  background: #555;
  border: none;
  border-radius: 20px;
  padding: 10px 20px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  transition: background-color 0.15s ease;
}
.stop-btn:hover {
  background: #666;
}
</style>
