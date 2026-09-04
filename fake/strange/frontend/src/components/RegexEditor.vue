<template>
  <div v-if="visible" class="overlay-dim" @click.self="emit('close')">
    <div class="box">
      <div class="header">
        <div class="title">正则脚本 (Regex Scripts)</div>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>

      <div class="list">
        <div v-if="scripts.length === 0" class="empty">暂无正则脚本，点「+ 新增」创建。</div>
        <div v-for="(s, i) in scripts" :key="i" class="row">
          <div class="row-main" @click="openEdit(i)">
            <div class="row-name">{{ s.name || "(未命名)" }}</div>
            <div class="row-regex">{{ s.regex }}</div>
          </div>
          <div class="row-actions">
            <ToggleSwitch :model-value="s.enabled !== false" color="var(--accent)" @update:model-value="toggle(i)" />
            <button class="del" @click="remove(i)">✕</button>
          </div>
        </div>
      </div>

      <div class="footer">
        <button class="add" @click="openNew">+ 新增</button>
        <div class="spacer"></div>
        <button class="cancel" @click="emit('close')">关闭</button>
        <button class="save" @click="save">保存</button>
      </div>
    </div>

    <!-- 编辑表单 -->
    <div v-if="editing !== null" class="overlay-dim" @click.self="editing = null">
      <div class="form-box">
        <div class="header">
          <div class="title">{{ editing === -1 ? "新增正则" : "编辑正则" }}</div>
          <button class="close-btn" @click="editing = null">✕</button>
        </div>
        <div class="form">
          <label class="label">名称</label>
          <input v-model="form.name" class="input" placeholder="脚本名" />
          <label class="label">正则表达式</label>
          <input v-model="form.regex" class="input mono" placeholder="/pattern/flags 或直接正则" />
          <label class="label">标志 flags</label>
          <input v-model="form.flags" class="input mono" placeholder="g" />
          <label class="label">替换为 replacement（支持 $1 / $&）</label>
          <input v-model="form.replacement" class="input mono" placeholder="替换文本" />

          <div class="chips">
            <label class="chip"><input type="checkbox" v-model="form.pUser" /> 作用于用户消息</label>
            <label class="chip"><input type="checkbox" v-model="form.pAssistant" /> 作用于AI消息</label>
            <label class="chip"><input type="checkbox" v-model="form.promptOnly" /> 仅发送侧(AI可见)</label>
            <label class="chip"><input type="checkbox" v-model="form.markdownOnly" /> 仅显示侧(用户可见)</label>
          </div>

          <div class="row2">
            <div>
              <label class="label">最小深度 minDepth</label>
              <input v-model="form.minDepth" class="input" placeholder="空=不限" />
            </div>
            <div>
              <label class="label">最大深度 maxDepth</label>
              <input v-model="form.maxDepth" class="input" placeholder="空=不限" />
            </div>
          </div>
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
import type { RegexScript } from "../types";
import ToggleSwitch from "./ToggleSwitch.vue";

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const store = useAppDataStore();
const scripts = computed(() => store.regexScripts);

const editing = ref<number | null>(null);
const form = ref({
  name: "",
  regex: "",
  flags: "g",
  replacement: "",
  pUser: true,
  pAssistant: true,
  markdownOnly: false,
  promptOnly: false,
  minDepth: "",
  maxDepth: "",
  enabled: true,
});

watch(
  () => props.visible,
  (v) => {
    if (v && !store.loaded) store.load();
  }
);

function blank(): typeof form.value {
  return {
    name: "",
    regex: "",
    flags: "g",
    replacement: "",
    pUser: true,
    pAssistant: true,
    markdownOnly: false,
    promptOnly: false,
    minDepth: "",
    maxDepth: "",
    enabled: true,
  };
}

function openNew(): void {
  form.value = blank();
  editing.value = -1;
}

function openEdit(i: number): void {
  const s = scripts.value[i];
  form.value = {
    name: s.name,
    regex: s.regex,
    flags: s.flags,
    replacement: s.replacement,
    pUser: s.placement.includes(1),
    pAssistant: s.placement.includes(2),
    markdownOnly: s.markdownOnly,
    promptOnly: s.promptOnly,
    minDepth: s.minDepth == null ? "" : String(s.minDepth),
    maxDepth: s.maxDepth == null ? "" : String(s.maxDepth),
    enabled: s.enabled !== false,
  };
  editing.value = i;
}

function toScript(): RegexScript {
  const placement: number[] = [];
  if (form.value.pUser) placement.push(1);
  if (form.value.pAssistant) placement.push(2);
  return {
    name: form.value.name.trim() || "未命名",
    regex: form.value.regex,
    flags: form.value.flags || "g",
    replacement: form.value.replacement,
    placement,
    markdownOnly: form.value.markdownOnly,
    promptOnly: form.value.promptOnly,
    runOnEdit: false,
    minDepth: form.value.minDepth === "" ? null : Number(form.value.minDepth),
    maxDepth: form.value.maxDepth === "" ? null : Number(form.value.maxDepth),
    scope: "global",
    enabled: form.value.enabled,
  };
}

function applyEdit(): void {
  const updated = [...scripts.value];
  if (editing.value === -1) updated.push(toScript());
  else if (editing.value !== null) updated[editing.value] = toScript();
  editing.value = null;
  store.saveRegexScripts(updated);
}

function remove(i: number): void {
  store.saveRegexScripts(scripts.value.filter((_, idx) => idx !== i));
}

function toggle(i: number): void {
  const updated = [...scripts.value];
  updated[i] = { ...updated[i], enabled: !updated[i].enabled };
  store.saveRegexScripts(updated);
}

function save(): void {
  emit("close");
}
</script>

<style scoped>
.overlay-dim { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 50; }
.box, .form-box { background: var(--panel); border-radius: 16px; width: min(94%, 680px); max-height: 86vh; display: flex; flex-direction: column; border: 1px solid var(--border); }
.header { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid var(--border); }
.title { color: var(--text); font-size: 17px; font-weight: 600; }
.close-btn { background: none; border: none; color: var(--accent); font-size: 20px; font-weight: 700; padding: 0 4px; }
.list { flex: 1; overflow-y: auto; padding: 14px 18px; }
.empty { color: var(--text-faint); text-align: center; padding: 30px 0; }
.row { display: flex; align-items: center; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); padding: 10px; margin-bottom: 10px; }
.row-main { flex: 1; cursor: pointer; }
.row-name { color: var(--text); font-weight: 600; }
.row-regex { color: var(--text-mid); font-size: 12px; font-family: ui-monospace, monospace; word-break: break-all; }
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
.mono { font-family: ui-monospace, monospace; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.chip { color: var(--text-dim); font-size: 13px; display: flex; align-items: center; gap: 6px; }
.row2 { display: flex; gap: 10px; }
.row2 > div { flex: 1; }
</style>
