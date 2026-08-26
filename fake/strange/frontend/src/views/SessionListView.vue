<template>
  <div class="container">
    <!-- Header -->
    <header class="header">
      <h1 class="header-title">MobileTavern</h1>
      <div class="header-right">
        <button class="header-btn" @click="showImport = true">Import</button>
        <button class="header-btn" @click="showPic = true">Pic</button>
        <button class="header-btn" @click="showSettings = true">Settings</button>
      </div>
    </header>

    <!-- Session list -->
    <div class="list">
      <div v-if="sortedSessions.length === 0" class="empty">
        <div class="empty-title">No Characters Yet</div>
        <div class="empty-subtitle">
          Tap "Import" to add a character card from your device.
        </div>
        <button class="empty-btn" @click="showImport = true">
          Import Character Card
        </button>
      </div>

      <div v-else class="list-content">
        <div v-for="session in sortedSessions" :key="session.id" class="card">
          <div class="card-main" @click="enterChat(session.id)">
            <div class="card-top">
              <span class="card-name">{{ displayName(session) }}</span>
              <div class="card-actions" @click.stop>
                <button class="mini-btn info" @click="openInfo(session)">Info</button>
                <button class="mini-btn edit" @click="openEdit(session)">Edit</button>
                <button class="mini-btn book" @click="openLoreBook(session)">Book</button>
                <button class="mini-btn status" @click="openStatusEditor(session)">Status</button>
                <button class="mini-btn del" @click="handleDelete(session)">Del</button>
              </div>
            </div>
            <div class="card-preview">{{ lastPreview(session) }}</div>
            <div class="card-meta">
              <span class="meta-text">{{ msgCount(session) }}</span>
              <span v-for="(tag, i) in tagsOf(session).slice(0, 3)" :key="i" class="tag">
                {{ tag }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit title modal -->
    <div v-if="editSession" class="overlay-dim">
      <div class="edit-box">
        <div class="edit-label">Edit Title</div>
        <input
          v-model="editTitle"
          class="edit-input"
          autofocus
          @keyup.enter="saveEdit"
        />
        <div class="edit-btns">
          <button class="edit-cancel" @click="editSession = null">Cancel</button>
          <button class="edit-save" @click="saveEdit">Save</button>
        </div>
      </div>
    </div>

    <!-- Import modal -->
    <ImportModal
      :visible="showImport"
      @close="showImport = false"
      @imported="onImported"
    />

    <!-- Settings modal -->
    <SettingsModal :visible="showSettings" @close="showSettings = false" />

    <!-- Pic generate modal -->
    <PicGenerateModal :visible="showPic" @close="showPic = false" />

    <!-- Lore book editor -->
    <LoreBookEditor
      v-if="loreBookSession"
      :visible="true"
      :session-id="loreBookSession.id"
      @close="loreBookSession = null"
    />

    <!-- Card info viewer -->
    <CardInfoModal
      v-if="infoSession"
      :session="infoSession"
      @close="infoSession = null"
    />

    <!-- Status bar editor -->
    <StatusEditor
      v-if="statusEditorSession"
      :session="statusEditorSession"
      @close="statusEditorSession = null"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useSessionsStore } from "../stores/sessions";
import { replacePlaceholders } from "../utils/markdown";
import type { Session } from "../types";
import SettingsModal from "../components/SettingsModal.vue";
import ImportModal from "../components/ImportModal.vue";
import LoreBookEditor from "../components/LoreBookEditor.vue";
import CardInfoModal from "../components/CardInfoModal.vue";
import StatusEditor from "../components/StatusEditor.vue";
import PicGenerateModal from "../components/PicGenerateModal.vue";

const router = useRouter();
const sessionsStore = useSessionsStore();

const showSettings = ref(false);
const showImport = ref(false);
const showPic = ref(false);

const editSession = ref<Session | null>(null);
const editTitle = ref("");
const loreBookSession = ref<Session | null>(null);
const infoSession = ref<Session | null>(null);
const statusEditorSession = ref<Session | null>(null);

const sortedSessions = computed(() => sessionsStore.sortedSessions());

onMounted(() => {
  if (!sessionsStore.loaded) sessionsStore.load();
});

function displayName(session: Session): string {
  return session.title || session.characterCard.data.name || "Unknown Character";
}

function lastPreview(session: Session): string {
  const card = session.characterCard.data;
  const charName = card.name || "Character";
  const uName = session.userName || "User";
  const rawLast =
    session.messages.length > 0
      ? session.messages[session.messages.length - 1].content
      : card.first_mes;
  return replacePlaceholders(
    (rawLast ?? "No messages yet").slice(0, 60),
    charName,
    uName
  );
}

function msgCount(session: Session): string {
  const n = session.messages.length;
  return `${n} message${n !== 1 ? "s" : ""}`;
}

function tagsOf(session: Session): string[] {
  return session.characterCard.data.tags ?? [];
}

function enterChat(id: string): void {
  router.push(`/chat/${id}`);
}

function openEdit(session: Session): void {
  editTitle.value = session.title || session.characterCard.data.name || "";
  editSession.value = session;
}

async function saveEdit(): Promise<void> {
  if (editSession.value) {
    await sessionsStore.patchTitle(editSession.value.id, editTitle.value.trim());
  }
  editSession.value = null;
}

async function handleDelete(session: Session): Promise<void> {
  if (window.confirm(`Remove "${displayName(session)}" and all its messages?`)) {
    await sessionsStore.removeSession(session.id);
  }
}

function openLoreBook(session: Session): void {
  loreBookSession.value = session;
}

function openInfo(session: Session): void {
  infoSession.value = session;
}

function openStatusEditor(session: Session): void {
  statusEditorSession.value = session;
}

function onImported(id: string): void {
  router.push(`/chat/${id}`);
}
</script>

<style scoped>
.container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1a1a2e;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #16213e;
  border-bottom: 1px solid #2a2a4a;
}
.header-title {
  color: #e94560;
  font-size: 22px;
  font-weight: 700;
  margin: 0;
}
.header-right {
  display: flex;
  gap: 18px;
}
.header-btn {
  background: none;
  border: none;
  color: #a0a0b8;
  font-size: 14px;
  padding: 4px;
}

/* List */
.list {
  flex: 1;
  overflow-y: auto;
}
.list-content {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Card */
.card {
  background: #16213e;
  border-radius: 14px;
  border: 1px solid #2a2a4a;
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}
.card:hover {
  border-color: #3a3a5a;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
  transform: translateY(-1px);
}
.card-main {
  padding: 16px;
  cursor: pointer;
}
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 6px;
}
.card-name {
  color: #e0e0e0;
  font-size: 17px;
  font-weight: 600;
}
.card-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.mini-btn {
  border: none;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  transition: opacity 0.15s ease, transform 0.1s ease;
}
.mini-btn:hover {
  opacity: 0.85;
  transform: translateY(-1px);
}
.mini-btn.info {
  background: #8b5cf6;
}
.mini-btn.edit {
  background: #3b82f6;
}
.mini-btn.book {
  background: #10b981;
}
.mini-btn.status {
  background: #f59e0b;
}
.mini-btn.del {
  background: #e94560;
}
.card-preview {
  color: #888;
  font-size: 13px;
  line-height: 18px;
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.meta-text {
  color: #555;
  font-size: 12px;
}
.tag {
  background: rgba(233, 69, 96, 0.15);
  border-radius: 4px;
  padding: 2px 6px;
  color: #e94560;
  font-size: 10px;
}

/* Empty state */
.empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 40px;
}
.empty-title {
  color: #888;
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
}
.empty-subtitle {
  color: #555;
  font-size: 14px;
  text-align: center;
  line-height: 20px;
  margin-bottom: 28px;
}
.empty-btn {
  background: #e94560;
  border: none;
  border-radius: 12px;
  padding: 14px 24px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}

/* Edit modal */
.edit-box {
  background: #16213e;
  border-radius: 16px;
  padding: 24px;
  width: min(85%, 380px);
  border: 1px solid #2a2a4a;
}
.edit-label {
  color: #e0e0e0;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
}
.edit-input {
  width: 100%;
  background: #1a1a2e;
  color: #e0e0e0;
  border-radius: 10px;
  padding: 14px;
  font-size: 16px;
  border: 1px solid #2a2a4a;
  margin-bottom: 20px;
}
.edit-btns {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.edit-cancel {
  background: none;
  border: none;
  color: #a0a0b8;
  font-size: 15px;
  padding: 10px 18px;
}
.edit-save {
  background: #e94560;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}
</style>
