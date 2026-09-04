<template>
  <div v-if="session" class="overlay-dim" @click.self="emit('close')">
    <div class="editor-box">
      <div class="header">
        <div class="title">状态栏编辑器</div>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>

      <div class="subtitle">
        来源：<span class="src">{{ sourceLabel }}</span> ·
        状态栏会按下面的字段跟踪并更新，只提交每轮变化的部分。
      </div>

      <div class="body">
        <div v-for="(f, i) in fields" :key="i" class="field-card">
          <div class="field-top">
            <input v-model="f.label" class="in label" placeholder="标签（显示名）" />
            <input v-model="f.key" class="in key" placeholder="key（英文标识）" />
            <select v-model="f.type" class="in type">
              <option value="string">string</option>
              <option value="list">list</option>
              <option value="enum">enum</option>
              <option value="number">number</option>
            </select>
            <button class="rm" title="删除字段" @click="removeField(i)">✕</button>
          </div>
          <input v-model="f.description" class="in desc" placeholder="说明（可选，帮助模型理解该字段）" />
        </div>

        <div v-if="fields.length === 0" class="empty">还没有字段，点击下方「添加字段」。</div>

        <button class="add" @click="addField">+ 添加字段</button>
      </div>

      <div class="footer">
        <button class="reset" @click="resetToBase">重置为卡提取/默认</button>
        <div class="spacer"></div>
        <button class="cancel" @click="emit('close')">取消</button>
        <button class="save" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { Session, StatusSchemaField } from "../types";
import { useSessionsStore } from "../stores/sessions";

const props = defineProps<{ session: Session }>();
const emit = defineEmits<{ (e: "close"): void }>();

const sessionsStore = useSessionsStore();

const DEFAULT_FIELDS: StatusSchemaField[] = [
  { key: "location", label: "当前地点", type: "string" },
  { key: "mood", label: "情绪状态", type: "string" },
  { key: "companions", label: "在场角色", type: "list" },
  { key: "current_action", label: "当前行为", type: "string" },
  { key: "key_facts", label: "关键事实", type: "list" },
];

function clone(fs: StatusSchemaField[]): StatusSchemaField[] {
  return fs.map((f) => ({ ...f }));
}

function baseFields(session: Session): { fields: StatusSchemaField[]; source: string } {
  const extracted = (session.characterCard.data as any).card_analysis?.status_schema?.fields;
  if (Array.isArray(extracted) && extracted.length) {
    return { fields: clone(extracted), source: "extracted" };
  }
  return { fields: clone(DEFAULT_FIELDS), source: "default" };
}

function initial(): { fields: StatusSchemaField[]; source: string } {
  const override = props.session.statusSchema?.fields;
  if (override && override.length) {
    return { fields: clone(override), source: "user" };
  }
  return baseFields(props.session);
}

const init = initial();
const fields = ref<StatusSchemaField[]>(init.fields);
const source = ref<string>(init.source);

const sourceLabel = computed(
  () =>
    ({ user: "用户自定义", extracted: "角色卡提取", default: "默认" } as Record<string, string>)[
      source.value
    ] ?? source.value
);

function addField(): void {
  fields.value.push({ key: "", label: "", type: "string", description: "" });
}

function removeField(i: number): void {
  fields.value.splice(i, 1);
}

function resetToBase(): void {
  const base = baseFields(props.session);
  fields.value = base.fields;
  source.value = base.source;
}

async function save(): Promise<void> {
  const clean: StatusSchemaField[] = fields.value
    .map((f) => ({
      key: (f.key || "").trim(),
      label: (f.label || "").trim(),
      type: f.type,
      description: (f.description || "").trim(),
    }))
    .filter((f) => f.key && f.label);

  await sessionsStore.patchStatusSchema(props.session.id, {
    specified: true,
    fields: clean,
  });
  emit("close");
}
</script>

<style scoped>
.editor-box {
  background: var(--panel);
  border-radius: 16px;
  width: min(94%, 640px);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}
.title {
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
.subtitle {
  color: var(--text-mid);
  font-size: 12px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--border);
}
.subtitle .src {
  color: var(--quote);
}
.body {
  overflow-y: auto;
  padding: 14px 18px;
  flex: 1;
}
.field-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
  padding: 10px;
  margin-bottom: 10px;
}
.field-top {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}
.in {
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 13px;
}
.in.label {
  flex: 1.2;
}
.in.key {
  flex: 1;
}
.in.type {
  flex: 0.6;
}
.in.desc {
  width: 100%;
}
.rm {
  background: rgba(233, 69, 96, 0.15);
  border: none;
  border-radius: 6px;
  color: var(--accent);
  font-size: 13px;
  font-weight: 700;
  padding: 6px 9px;
}
.empty {
  color: var(--text-faint);
  font-size: 13px;
  text-align: center;
  padding: 16px;
}
.add {
  width: 100%;
  background: rgba(16, 185, 129, 0.12);
  border: 1px dashed rgba(16, 185, 129, 0.5);
  border-radius: 8px;
  color: var(--success);
  font-size: 13px;
  font-weight: 600;
  padding: 10px;
}
.footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-top: 1px solid var(--border);
}
.spacer {
  flex: 1;
}
.reset {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 13px;
  padding: 8px 10px;
}
.cancel {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 14px;
  padding: 9px 16px;
}
.save {
  background: var(--accent);
  border: none;
  border-radius: 8px;
  padding: 9px 20px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}
</style>
