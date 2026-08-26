<template>
  <div v-if="visible" class="sheet">
    <header class="header">
      <button class="back-btn" @click="emit('close')">← Back</button>
      <span class="title">LoreBook</span>
      <button class="add-btn" @click="openNew">+ Add</button>
    </header>

    <!-- Entry list -->
    <div v-if="editIdx === null" class="list">
      <div v-if="entries.length === 0" class="empty">
        No entries yet. Tap "+ Add" to create one.
      </div>
      <div v-else>
        <div v-for="(entry, idx) in entries" :key="idx" class="entry-card">
          <div class="entry-content" @click="openEdit(idx)">
            <div class="entry-title">{{ entry.comment || "(no title)" }}</div>
            <div v-if="entryKeys(entry)" class="entry-keys">Keys: {{ entryKeys(entry) }}</div>
            <div class="entry-preview">{{ entry.content || "(empty)" }}</div>
            <div class="entry-meta">
              <span class="meta-text">
                {{ entry.position === "after_char" ? "after" : "before" }}
                · {{ entry.constant ? "constant" : "keyword" }}
              </span>
            </div>
          </div>
          <div class="entry-actions">
            <ToggleSwitch
              :model-value="entry.enabled !== false"
              color="#e94560"
              @update:model-value="toggleEntry(idx)"
            />
            <button class="delete-icon" @click="deleteEntry(idx)">✕</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Entry form -->
    <div v-else class="form">
      <div class="form-title">{{ editIdx === -1 ? "New Entry" : "Edit Entry" }}</div>

      <label class="label">Title</label>
      <input v-model="form.title" class="input" placeholder="Entry display name" />

      <label class="label">Keys (comma-separated)</label>
      <input v-model="form.keys" class="input" placeholder="keyword1, keyword2" />

      <label class="label">Content</label>
      <textarea v-model="form.content" class="input content-input" placeholder="Entry content..."></textarea>

      <div class="switch-row">
        <span class="label">Constant</span>
        <ToggleSwitch v-model="form.constant" color="#e94560" />
      </div>

      <div class="switch-row">
        <span class="label">Enabled</span>
        <ToggleSwitch v-model="form.enabled" color="#e94560" />
      </div>

      <label class="label">Position</label>
      <div class="seg-row">
        <button
          class="seg-btn"
          :class="{ active: form.position === 'before_char' }"
          @click="form.position = 'before_char'"
        >
          Before Char
        </button>
        <button
          class="seg-btn"
          :class="{ active: form.position === 'after_char' }"
          @click="form.position = 'after_char'"
        >
          After Char
        </button>
      </div>

      <div class="form-btns">
        <button class="cancel-btn" @click="editIdx = null">Cancel</button>
        <button class="save-btn" @click="saveEntry">Save Entry</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useSessionsStore } from "../stores/sessions";
import type { LoreBookEntry } from "../types";
import ToggleSwitch from "./ToggleSwitch.vue";

const props = defineProps<{ visible: boolean; sessionId: string }>();
const emit = defineEmits<{ (e: "close"): void }>();

const sessionsStore = useSessionsStore();

interface EntryForm {
  title: string;
  keys: string;
  content: string;
  constant: boolean;
  enabled: boolean;
  position: "before_char" | "after_char";
}

const defaultEntry = (): EntryForm => ({
  title: "",
  keys: "",
  content: "",
  constant: false,
  enabled: true,
  position: "before_char",
});

const editIdx = ref<number | null>(null);
const form = ref<EntryForm>(defaultEntry());

const entries = computed<LoreBookEntry[]>(() => {
  const s = sessionsStore.getById(props.sessionId);
  return (s?.characterCard.data.character_book?.entries ?? []) as LoreBookEntry[];
});

function entryToForm(e: LoreBookEntry): EntryForm {
  return {
    title: e.comment ?? "",
    keys: (e.keys ?? []).join(", "),
    content: e.content ?? "",
    constant: e.constant ?? false,
    enabled: e.enabled ?? true,
    position: e.position === "after_char" ? "after_char" : "before_char",
  };
}

function formToEntry(f: EntryForm): LoreBookEntry {
  return {
    keys: f.keys.split(",").map((k) => k.trim()).filter(Boolean),
    content: f.content,
    comment: f.title,
    constant: f.constant,
    enabled: f.enabled,
    position: f.position,
    insertion_order: 100,
    case_sensitive: false,
    selective: false,
    secondary_keys: [],
  };
}

function entryKeys(e: LoreBookEntry): string {
  return e.keys && e.keys.length > 0 ? e.keys.join(", ") : "";
}

async function persist(updated: LoreBookEntry[]): Promise<void> {
  const s = sessionsStore.getById(props.sessionId);
  if (!s) return;
  const book = s.characterCard.data.character_book;
  await sessionsStore.patchCharacterBook(props.sessionId, {
    ...(book ?? {}),
    entries: updated,
    name: book?.name ?? "",
    scan_depth: book?.scan_depth ?? 50,
    case_sensitive: book?.case_sensitive ?? false,
    recursive_scanning: book?.recursive_scanning ?? false,
  });
}

function openNew(): void {
  form.value = defaultEntry();
  editIdx.value = -1;
}

function openEdit(idx: number): void {
  form.value = entryToForm(entries.value[idx]);
  editIdx.value = idx;
}

async function saveEntry(): Promise<void> {
  const entryData = formToEntry(form.value);
  let updated: LoreBookEntry[];
  if (editIdx.value === -1) {
    updated = [...entries.value, entryData];
  } else if (editIdx.value !== null) {
    updated = [...entries.value];
    updated[editIdx.value] = { ...entries.value[editIdx.value], ...entryData };
  } else {
    return;
  }
  await persist(updated);
  editIdx.value = null;
}

async function deleteEntry(idx: number): Promise<void> {
  await persist(entries.value.filter((_, i) => i !== idx));
}

async function toggleEntry(idx: number): Promise<void> {
  const updated = [...entries.value];
  updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled };
  await persist(updated);
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
  font-size: 18px;
  font-weight: 600;
}
.add-btn {
  background: none;
  border: none;
  color: #e94560;
  font-size: 15px;
  font-weight: 600;
  padding: 4px 8px;
}
.list {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
}
.empty {
  color: #555;
  text-align: center;
  margin-top: 80px;
  font-size: 14px;
}
.entry-card {
  background: #16213e;
  border-radius: 12px;
  border: 1px solid #2a2a4a;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
}
.entry-content {
  flex: 1;
  padding: 14px;
  cursor: pointer;
}
.entry-title {
  color: #e0e0e0;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.entry-keys {
  color: #e94560;
  font-size: 11px;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.entry-preview {
  color: #a0a0b8;
  font-size: 13px;
  line-height: 18px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.entry-meta {
  margin-top: 6px;
}
.meta-text {
  color: #555;
  font-size: 11px;
}
.entry-actions {
  padding: 0 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.delete-icon {
  background: none;
  border: none;
  color: #e94560;
  font-size: 16px;
  font-weight: 700;
  padding: 0;
}
.form {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.form-title {
  color: #e0e0e0;
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 20px;
}
.label {
  color: #a0a0b8;
  font-size: 14px;
  margin: 12px 0 6px;
  display: block;
}
.input {
  width: 100%;
  background: #16213e;
  color: #e0e0e0;
  border-radius: 10px;
  padding: 14px;
  font-size: 15px;
  border: 1px solid #2a2a4a;
}
.input::placeholder {
  color: #666;
}
.content-input {
  min-height: 120px;
  resize: vertical;
}
.switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}
.switch-row .label {
  margin: 0;
}
.seg-row {
  display: flex;
  gap: 10px;
}
.seg-btn {
  flex: 1;
  background: #16213e;
  border-radius: 8px;
  padding: 12px;
  color: #888;
  font-size: 14px;
  border: 1px solid #2a2a4a;
}
.seg-btn.active {
  border-color: #e94560;
  background: rgba(233, 69, 96, 0.1);
  color: #e94560;
  font-weight: 600;
}
.form-btns {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  margin-bottom: 40px;
}
.cancel-btn {
  flex: 1;
  border-radius: 10px;
  padding: 14px;
  background: none;
  border: 1px solid #2a2a4a;
  color: #a0a0b8;
  font-size: 15px;
}
.save-btn {
  flex: 1;
  background: #e94560;
  border: none;
  border-radius: 10px;
  padding: 14px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}
</style>
