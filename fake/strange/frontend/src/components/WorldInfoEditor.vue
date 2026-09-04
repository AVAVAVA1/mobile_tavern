<template>
  <div v-if="visible" class="overlay-dim" @click.self="emit('close')">
    <div class="box">
      <div class="header">
        <div class="title">全局世界书 (Global World Info)</div>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>

      <div class="list">
        <div v-if="entries.length === 0" class="empty">暂无全局世界书条目。</div>
        <div v-for="(e, i) in entries" :key="i" class="row">
          <div class="row-main" @click="openEdit(i)">
            <div class="row-name">
              {{ e.comment || "(未命名)" }}
              <span class="badge">{{ e.position }}</span>
              <span v-if="e.constant" class="badge c">constant</span>
            </div>
            <div class="row-content">{{ e.content }}</div>
          </div>
          <div class="row-actions">
            <ToggleSwitch :model-value="e.enabled !== false" color="var(--accent)" @update:model-value="toggle(i)" />
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
          <div class="title">{{ editing === -1 ? "新增世界书" : "编辑世界书" }}</div>
          <button class="close-btn" @click="editing = null">✕</button>
        </div>
        <div class="form">
          <label class="label">名称 comment</label>
          <input v-model="form.comment" class="input" placeholder="条目名" />
          <label class="label">关键词 keys（逗号分隔）</label>
          <input v-model="form.keys" class="input" placeholder="关键词1, 关键词2" />
          <label class="label">内容</label>
          <textarea v-model="form.content" class="input area" rows="5"></textarea>
          <label class="label">位置</label>
          <select v-model="form.position" class="input">
            <option v-for="p in POSITIONS" :key="p.value" :value="p.value">{{ p.label }}</option>
          </select>
          <div class="switch-row"><span class="label">常驻 constant</span><ToggleSwitch v-model="form.constant" color="var(--accent)" /></div>
          <div class="switch-row"><span class="label">正则匹配 keys</span><ToggleSwitch v-model="form.useRegex" color="var(--accent)" /></div>
          <label class="label">概率 probability (0-100)</label>
          <input v-model="form.probability" class="input" placeholder="100" />
          <label class="label">深度 depth（at_depth 位置）</label>
          <input v-model="form.depth" class="input" placeholder="4" />
          <label class="label">扫描深度 scanDepth（0=不扫描，空=默认）</label>
          <input v-model="form.scanDepth" class="input" placeholder="空=默认" />
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
import type { WorldInfoEntry, WorldInfoPosition } from "../types";
import ToggleSwitch from "./ToggleSwitch.vue";

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const store = useAppDataStore();
const entries = computed(() => store.worldInfo);

const POSITIONS: { value: WorldInfoPosition; label: string }[] = [
  { value: "system_top", label: "系统提示词顶层" },
  { value: "global_note", label: "全局备注" },
  { value: "before_char", label: "角色设定前" },
  { value: "after_char", label: "角色设定后" },
  { value: "at_depth", label: "按深度插入" },
  { value: "user_top", label: "用户消息顶部" },
  { value: "assistant_top", label: "助手消息顶部" },
];

const editing = ref<number | null>(null);
const form = ref({
  comment: "",
  keys: "",
  content: "",
  position: "global_note" as WorldInfoPosition,
  constant: false,
  useRegex: false,
  probability: "100",
  depth: "4",
  scanDepth: "",
});

watch(
  () => props.visible,
  (v) => {
    if (v && !store.loaded) store.load();
  }
);

function blank() {
  return {
    comment: "",
    keys: "",
    content: "",
    position: "global_note" as WorldInfoPosition,
    constant: false,
    useRegex: false,
    probability: "100",
    depth: "4",
    scanDepth: "",
  };
}

function openNew(): void {
  form.value = blank();
  editing.value = -1;
}
function openEdit(i: number): void {
  const e = entries.value[i];
  form.value = {
    comment: e.comment,
    keys: (e.keys ?? []).join(", "),
    content: e.content,
    position: e.position,
    constant: e.constant,
    useRegex: e.useRegex,
    probability: String(e.probability ?? 100),
    depth: String(e.depth ?? 4),
    scanDepth: e.scanDepth == null ? "" : String(e.scanDepth),
  };
  editing.value = i;
}
function toEntry(): WorldInfoEntry {
  return {
    comment: form.value.comment.trim() || "未命名",
    content: form.value.content,
    enabled: true,
    scope: "global",
    keys: form.value.keys.split(/[,，]/).map((k) => k.trim()).filter(Boolean),
    useRegex: form.value.useRegex,
    constant: form.value.constant,
    position: form.value.position,
    order: 100,
    depth: Number(form.value.depth) || 4,
    scanDepth: form.value.scanDepth === "" ? null : Number(form.value.scanDepth),
    probability: Number(form.value.probability) || 100,
    useProbability: true,
  };
}
function applyEdit(): void {
  const updated = [...entries.value];
  if (editing.value === -1) updated.push(toEntry());
  else if (editing.value !== null) updated[editing.value] = toEntry();
  editing.value = null;
  store.saveWorldInfo(updated);
}
function remove(i: number): void {
  store.saveWorldInfo(entries.value.filter((_, idx) => idx !== i));
}
function toggle(i: number): void {
  const updated = [...entries.value];
  updated[i] = { ...updated[i], enabled: !updated[i].enabled };
  store.saveWorldInfo(updated);
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
.badge.c { color: var(--success); border-color: rgba(16,185,129,0.4); }
.row-actions { display: flex; align-items: center; gap: 10px; padding-left: 10px; }
.del { background: none; border: none; color: var(--accent); font-size: 16px; font-weight: 700; }
.footer { display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-top: 1px solid var(--border); }
.spacer { flex: 1; }
.add { background: rgba(16,185,129,0.12); border: 1px dashed rgba(16,185,129,0.5); border-radius: 8px; color: var(--success); padding: 9px 14px; font-weight: 600; }
.cancel { background: none; border: none; color: var(--text-dim); padding: 9px 16px; }
.save { background: var(--accent); border: none; border-radius: 8px; padding: 9px 20px; color: #fff; font-weight: 600; }
.form { flex: 1; overflow-y: auto; padding: 14px 18px; }
.label { display: block; color: var(--text-dim); font-size: 13px; margin: 10px 0 6px; }
.switch-row .label { margin: 0; }
.input { width: 100%; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; font-size: 14px; }
.area { resize: vertical; min-height: 90px; }
.switch-row { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
</style>
