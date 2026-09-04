<template>
  <div class="container">
    <header class="header">
      <button class="back-btn" @click="router.push('/')">← Back</button>
      <span class="title">角色卡工坊 (Card Generator)</span>
    </header>

    <div class="body">
      <label class="label">描述你想创建的角色</label>
      <textarea
        v-model="prompt"
        class="prompt-input"
        rows="5"
        placeholder="例如：一个在雨夜街头偶遇的温柔吸血鬼少女……"
      ></textarea>

      <button class="gen-btn" :disabled="generating" @click="generate">
        {{ generating ? "生成中…" : "开始生成" }}
      </button>
      <div v-if="error" class="error">{{ error }}</div>

      <template v-if="card">
        <div class="result">
          <div class="result-title">{{ card.data?.name || "未命名" }}</div>
          <div class="field"><span class="k">描述</span><div class="v">{{ card.data?.description }}</div></div>
          <div class="field"><span class="k">开场白</span><div class="v">{{ card.data?.first_mes }}</div></div>
          <div class="meta">
            <span>世界书 {{ card.data?.character_book?.entries?.length ?? 0 }} 条</span>
            <span>正则 {{ card.data?.extensions?.regex_scripts?.length ?? 0 }} 条</span>
            <span>标签 {{ card.data?.tags?.length ?? 0 }} 个</span>
          </div>
          <button class="import-btn" :disabled="importing" @click="importCard">
            {{ importing ? "导入中…" : "导入并开始对话" }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { generateCard, createCard } from "../api";
import { useSessionsStore } from "../stores/sessions";

const router = useRouter();
const sessionsStore = useSessionsStore();

const prompt = ref("");
const generating = ref(false);
const importing = ref(false);
const error = ref("");
const card = ref<Record<string, any> | null>(null);

async function generate(): Promise<void> {
  const text = prompt.value.trim();
  if (generating.value || !text) return;
  generating.value = true;
  error.value = "";
  card.value = null;
  try {
    card.value = await generateCard(text);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    generating.value = false;
  }
}

async function importCard(): Promise<void> {
  if (!card.value || importing.value) return;
  importing.value = true;
  try {
    const session = await createCard(card.value);
    sessionsStore.refreshSession(session.id);
    router.push(`/chat/${session.id}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    importing.value = false;
  }
}
</script>

<style scoped>
.container { height: 100%; display: flex; flex-direction: column; background: var(--bg); }
.header { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--panel); border-bottom: 1px solid var(--border); }
.back-btn { background: none; border: none; color: var(--text-dim); font-size: 16px; padding: 4px 8px; }
.title { color: var(--text); font-size: 18px; font-weight: 600; }
.body { flex: 1; overflow-y: auto; padding: 16px; }
.label { color: var(--text-dim); font-size: 14px; display: block; margin-bottom: 8px; }
.prompt-input { width: 100%; background: var(--panel); color: var(--text); border: 1px solid var(--border); border-radius: 10px; padding: 14px; font-size: 15px; resize: vertical; min-height: 100px; }
.gen-btn { width: 100%; background: var(--accent); border: none; border-radius: 10px; padding: 14px; margin-top: 14px; color: #fff; font-size: 16px; font-weight: 600; }
.gen-btn:disabled, .import-btn:disabled { opacity: 0.6; }
.error { color: var(--accent); margin-top: 12px; font-size: 13px; white-space: pre-wrap; }
.result { margin-top: 20px; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
.result-title { color: var(--accent); font-size: 20px; font-weight: 700; margin-bottom: 12px; }
.field { margin-bottom: 12px; }
.field .k { color: var(--text-mid); font-size: 12px; margin-bottom: 4px; }
.field .v { color: var(--text); font-size: 14px; line-height: 20px; white-space: pre-wrap; word-break: break-word; }
.meta { display: flex; gap: 12px; color: var(--text-dim); font-size: 12px; margin-bottom: 14px; }
.import-btn { width: 100%; background: #3b82f6; border: none; border-radius: 10px; padding: 14px; color: #fff; font-size: 15px; font-weight: 600; }
</style>
