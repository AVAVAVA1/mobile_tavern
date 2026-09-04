<template>
  <div v-if="visible" class="overlay-dim" @click.self="emit('close')">
    <div class="box">
      <div class="header">
        <div class="title">预设 (Presets)</div>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>

      <div class="list">
        <div v-if="presets.length === 0" class="empty">暂无预设，点「+ 新增」创建。</div>
        <div v-for="(p, i) in presets" :key="i" class="row">
          <div class="row-main" @click="openEdit(i)">
            <div class="row-name">
              {{ p.name }}
              <span class="badge" :class="roleClass(p.role)">{{ roleLabel(p.role) }}</span>
            </div>
            <div class="row-content">{{ p.content }}</div>
          </div>
          <div class="row-actions">
            <ToggleSwitch :model-value="p.enabled !== false" color="var(--accent)" @update:model-value="toggle(i)" />
            <button class="del" @click="remove(i)">✕</button>
          </div>
        </div>
      </div>

      <div class="footer">
        <button class="add" @click="openNew">+ 新增</button>
        <div class="spacer"></div>
        <button class="cancel" @click="emit('close')">关闭</button>
      </div>
    </div>

    <div v-if="editing !== null" class="overlay-dim" @click.self="editing = null">
      <div class="form-box">
        <div class="header">
          <div class="title">{{ editing === -1 ? "新增预设" : "编辑预设" }}</div>
          <button class="close-btn" @click="editing = null">✕</button>
        </div>
        <div class="form">
          <label class="label">名称</label>
          <input v-model="form.name" class="input" placeholder="预设名" />
          <label class="label">角色 role</label>
          <select v-model="form.role" class="input">
            <option value="system">system（系统提示词）</option>
            <option value="user">user（用户消息）</option>
            <option value="assistant">assistant（AI消息）</option>
          </select>
          <label class="label">内容</label>
          <textarea v-model="form.content" class="input area" rows="6" placeholder="预设正文..."></textarea>
        </div>
        <div class="footer">
          <div class="spacer"></div>
          <button class="cancel" @click="editing = null">取消</button>
          <button class="save" @click="applyEdit">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useAppDataStore } from "../stores/appdata";
import type { Preset } from "../types";
import ToggleSwitch from "./ToggleSwitch.vue";

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const store = useAppDataStore();
const presets = computed(() => store.presets);

const editing = ref<number | null>(null);
const form = ref({ name: "", content: "", role: "system" as Preset["role"] });

watch(
  () => props.visible,
  (v) => {
    if (v && !store.loaded) store.load();
  }
);

function roleLabel(role: Preset["role"]): string {
  return { system: "系统", user: "User", assistant: "AI" }[role] ?? role;
}
function roleClass(role: Preset["role"]): string {
  return { system: "sys", user: "user", assistant: "ai" }[role] ?? "";
}

function openNew(): void {
  form.value = { name: "", content: "", role: "system" };
  editing.value = -1;
}
function openEdit(i: number): void {
  const p = presets.value[i];
  form.value = { name: p.name, content: p.content, role: p.role };
  editing.value = i;
}
function applyEdit(): void {
  const updated = [...presets.value];
  const item: Preset = {
    name: form.value.name.trim() || "New Preset",
    content: form.value.content,
    role: form.value.role,
    enabled: true,
  };
  if (editing.value === -1) updated.push(item);
  else if (editing.value !== null) updated[editing.value] = { ...updated[editing.value], ...item };
  editing.value = null;
  store.savePresets(updated);
}
function remove(i: number): void {
  store.savePresets(presets.value.filter((_, idx) => idx !== i));
}
function toggle(i: number): void {
  const updated = [...presets.value];
  updated[i] = { ...updated[i], enabled: !updated[i].enabled };
  store.savePresets(updated);
}
</script>

<style scoped>
.overlay-dim { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 50; }
.box, .form-box { background: var(--panel); border-radius: 16px; width: min(94%, 640px); max-height: 86vh; display: flex; flex-direction: column; border: 1px solid var(--border); }
.header { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid var(--border); }
.title { color: var(--text); font-size: 17px; font-weight: 600; }
.close-btn { background: none; border: none; color: var(--accent); font-size: 20px; font-weight: 700; padding: 0 4px; }
.list { flex: 1; overflow-y: auto; padding: 14px 18px; }
.empty { color: var(--text-faint); text-align: center; padding: 30px 0; }
.row { display: flex; align-items: center; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); padding: 10px; margin-bottom: 10px; }
.row-main { flex: 1; cursor: pointer; }
.row-name { color: var(--text); font-weight: 600; display: flex; align-items: center; gap: 8px; }
.row-content { color: var(--text-mid); font-size: 12px; white-space: pre-wrap; max-height: 48px; overflow: hidden; }
.badge { font-size: 10px; padding: 1px 6px; border-radius: 4px; border: 1px solid var(--border); color: var(--text-dim); }
.badge.sys { color: var(--accent); border-color: rgba(233,69,96,0.4); }
.badge.user { color: var(--success); border-color: rgba(16,185,129,0.4); }
.badge.ai { color: #8b5cf6; border-color: rgba(139,92,246,0.4); }
.row-actions { display: flex; align-items: center; gap: 10px; padding-left: 10px; }
.del { background: none; border: none; color: var(--accent); font-size: 16px; font-weight: 700; }
.footer { display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-top: 1px solid var(--border); }
.spacer { flex: 1; }
.add { background: rgba(16,185,129,0.12); border: 1px dashed rgba(16,185,129,0.5); border-radius: 8px; color: var(--success); padding: 9px 14px; font-weight: 600; }
.cancel { background: none; border: none; color: var(--text-dim); padding: 9px 16px; }
.save { background: var(--accent); border: none; border-radius: 8px; padding: 9px 20px; color: #fff; font-weight: 600; }
.form { flex: 1; overflow-y: auto; padding: 14px 18px; }
.label { display: block; color: var(--text-dim); font-size: 13px; margin: 12px 0 6px; }
.input { width: 100%; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; font-size: 14px; }
.area { resize: vertical; min-height: 120px; }
</style>
