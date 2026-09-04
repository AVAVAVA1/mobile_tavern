<template>
  <div v-if="session" class="overlay-dim" @click.self="emit('close')">
    <div class="info-box">
      <div class="info-header">
        <div class="info-title">角色卡信息</div>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>

      <div class="info-body">
        <!-- 解析分类 -->
        <div class="section">
          <div class="section-title">解析分类</div>
          <div class="kv">
            <span class="k">格式</span>
            <span class="v accent">{{ format }}</span>
          </div>
          <div class="kv">
            <span class="k">spec</span>
            <span class="v">{{ card.spec }}</span>
          </div>
          <div class="kv">
            <span class="k">spec_version</span>
            <span class="v">{{ card.spec_version }}</span>
          </div>
          <div v-if="meta?.chunk" class="kv">
            <span class="k">命中 chunk</span>
            <span class="v">{{ meta.chunk }}</span>
          </div>
        </div>

        <!-- 基础信息 -->
        <div class="section">
          <div class="section-title">基础信息</div>
          <template v-for="f in basicFields" :key="f.key">
            <div v-if="has(f.value)" class="field">
              <div class="k">{{ f.label }}</div>
              <div class="v">{{ text(f.value) }}</div>
            </div>
          </template>
        </div>

        <!-- 世界书 -->
        <div v-if="book" class="section">
          <div class="section-title">
            世界书 · {{ book.entries?.length ?? 0 }} 条目
            <span v-if="book.name" class="sub">（{{ book.name }}）</span>
          </div>
          <div v-if="book.description" class="field">
            <div class="k">说明</div>
            <div class="v">{{ book.description }}</div>
          </div>
          <div class="kv">
            <span class="k">scan_depth</span>
            <span class="v">{{ book.scan_depth }}</span>
          </div>
          <div v-for="(e, i) in book.entries ?? []" :key="i" class="entry">
            <div class="entry-head">
              <span class="entry-keys">{{ (e.keys ?? []).join(", ") || "(无关键词)" }}</span>
              <span class="badges">
                <span v-if="e.constant" class="badge c">constant</span>
                <span v-if="e.enabled === false" class="badge d">禁用</span>
                <span class="badge">{{ e.position === "after_char" ? "after" : "before" }}</span>
              </span>
            </div>
            <div class="entry-content">{{ e.content }}</div>
          </div>
        </div>

        <!-- Agent 世界书 -->
        <div v-if="agentBook" class="section">
          <div class="section-title">Agent 世界书 · {{ agentBook.entries?.length ?? 0 }} 条目</div>
          <div v-for="(e, i) in agentBook.entries ?? []" :key="i" class="entry">
            <div class="entry-head">
              <span class="entry-keys">{{ (e.keys ?? []).join(", ") || "(无关键词)" }}</span>
            </div>
            <div class="entry-content">{{ e.content }}</div>
          </div>
        </div>

        <!-- 原始 JSON -->
        <details class="section">
          <summary class="section-title summary">原始 JSON</summary>
          <pre class="raw">{{ rawJson }}</pre>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Session } from "../types";

const props = defineProps<{ session: Session }>();
const emit = defineEmits<{ (e: "close"): void }>();

const card = computed(() => props.session.characterCard);
const data = computed(() => card.value.data);
const meta = computed(() => card.value.parse_meta);

const format = computed(() => {
  if (meta.value?.format) return meta.value.format;
  const s = card.value.spec;
  if (s === "chara_card_v1") return "V1 (TavernAI)";
  if (s === "chara_card_v2") return "V2 (chara_card_v2)";
  if (s === "chara_card_v3") return "V3 (ccv3)";
  return s;
});

function has(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function text(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

const basicFields = computed(() => {
  const d = data.value;
  return [
    { key: "name", label: "姓名", value: d.name },
    { key: "description", label: "描述", value: d.description },
    { key: "personality", label: "性格", value: d.personality },
    { key: "scenario", label: "场景", value: d.scenario },
    { key: "first_mes", label: "开场白", value: d.first_mes },
    { key: "mes_example", label: "对话示例", value: d.mes_example },
    { key: "system_prompt", label: "System Prompt", value: d.system_prompt },
    { key: "post_history_instructions", label: "后置指令", value: d.post_history_instructions },
    { key: "creator_notes", label: "作者备注", value: d.creator_notes },
    { key: "creator", label: "作者", value: d.creator },
    { key: "tags", label: "标签", value: d.tags },
    { key: "character_version", label: "版本", value: d.character_version },
    { key: "create_date", label: "创建日期", value: d.create_date },
    { key: "world_description", label: "世界观设定", value: d.world_description },
    { key: "alternate_greetings", label: "备选开场白", value: d.alternate_greetings },
  ];
});

const book = computed(() => (data.value as any).character_book ?? null);
const agentBook = computed(() => (data.value as any).agent_book ?? null);

const rawJson = computed(() => JSON.stringify(props.session.characterCard, null, 2));
</script>

<style scoped>
.info-box {
  background: var(--panel);
  border-radius: 16px;
  width: min(92%, 720px);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
}
.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}
.info-title {
  color: var(--text);
  font-size: 17px;
  font-weight: 600;
}
.close-btn {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 20px;
  font-weight: 700;
  padding: 0 4px;
}
.info-body {
  overflow-y: auto;
  padding: 14px 18px 18px;
}
.section {
  margin-bottom: 18px;
}
.section-title {
  color: var(--success);
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 8px;
}
.section-title .sub {
  color: var(--text-faint);
  font-weight: 400;
}
.section-title.summary {
  cursor: pointer;
}
.kv {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 13px;
}
.kv .k {
  color: var(--text-mid);
  flex-shrink: 0;
  min-width: 96px;
}
.kv .v {
  color: var(--text-dim);
  word-break: break-all;
}
.kv .v.accent {
  color: var(--quote);
}
.field {
  margin-bottom: 10px;
}
.field .k {
  color: var(--text-mid);
  font-size: 12px;
  margin-bottom: 3px;
}
.field .v {
  color: var(--text);
  font-size: 13px;
  line-height: 19px;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--bg);
  border-radius: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
}
.entry {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 8px;
  background: var(--bg);
}
.entry-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.entry-keys {
  color: var(--quote);
  font-size: 12px;
  font-weight: 600;
  word-break: break-all;
}
.badges {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.badge {
  color: var(--text-dim);
  font-size: 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 5px;
}
.badge.c {
  color: var(--success);
  border-color: rgba(16, 185, 129, 0.4);
}
.badge.d {
  color: var(--accent);
  border-color: rgba(233, 69, 96, 0.4);
}
.entry-content {
  color: var(--text-dim);
  font-size: 12px;
  line-height: 17px;
  white-space: pre-wrap;
  word-break: break-word;
}
.raw {
  color: var(--text-dim);
  font-size: 11px;
  line-height: 15px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  overflow-x: auto;
  white-space: pre;
}
</style>
