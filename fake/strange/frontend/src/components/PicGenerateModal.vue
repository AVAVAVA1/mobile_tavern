<template>
  <div v-if="visible" class="overlay-dim" @click.self="emit('close')">
    <div class="pic-box">
      <div class="header">
        <div class="title">图片生成 (Pic Generate)</div>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>

      <div class="body">
        <!-- 来源 -->
        <label class="label">来源</label>
        <select v-model="form.source" class="input">
          <option v-for="s in PIC_SOURCES" :key="s.id" :value="s.id">
            {{ s.label }}
          </option>
        </select>
        <div class="hint">不同来源的配置项不同，后续可扩展更多来源。</div>

        <!-- 当前来源的字段（由注册表驱动） -->
        <template v-for="f in currentSource.fields" :key="f.key">
          <label class="label">{{ f.label }}</label>

          <div v-if="f.type === 'url'" class="row">
            <input
              v-model="form.sources[form.source][f.key]"
              class="input grow"
              placeholder="http://127.0.0.1:8188"
            />
            <button class="btn-test" :disabled="testing" @click="testConnection">
              {{ testing ? "测试中…" : "连接" }}
            </button>
          </div>
          <div
            v-if="f.type === 'url' && testResult"
            class="hint"
            :class="testResult.ok ? 'ok' : 'err'"
          >
            {{ testResult.message }}
          </div>

          <div v-else-if="f.type === 'workflow'" class="row">
            <select v-model="form.sources[form.source][f.key]" class="input grow">
              <option value="">（选择 workflow）</option>
              <option v-for="w in workflows" :key="w" :value="w">{{ w }}</option>
            </select>
            <button class="btn" @click="refreshWorkflows">刷新</button>
            <button
              class="btn-edit"
              :disabled="!form.sources[form.source][f.key]"
              @click="openEditor"
            >
              编辑
            </button>
          </div>

          <textarea
            v-else-if="f.type === 'textarea'"
            v-model="form.sources[form.source][f.key]"
            class="input area"
            rows="3"
          ></textarea>
        </template>

        <div v-if="generateResult" class="hint" :class="generateResult.ok ? 'ok' : 'err'">
          {{ generateResult.message }}
        </div>
        <img
          v-if="generateResult?.ok && generateResult.url"
          :src="generateResult.url"
          class="gen-img"
          alt="生成结果"
        />
      </div>

      <div class="footer">
        <span v-if="saved" class="saved">已保存</span>
        <button class="btn-generate" :disabled="generating" @click="testGenerate">
          {{ generating ? "生成中…" : "测试生图" }}
        </button>
        <div class="spacer"></div>
        <button class="btn-cancel" @click="emit('close')">关闭</button>
        <button class="btn-save" @click="save">保存</button>
      </div>
    </div>
  </div>

  <!-- Workflow 编辑器 -->
  <div v-if="editorVisible" class="overlay-dim" @click.self="editorVisible = false">
    <div class="editor-box">
      <div class="header">
        <div class="title">编辑 Workflow：{{ editingName }}</div>
        <button class="close-btn" @click="editorVisible = false">✕</button>
      </div>
      <textarea v-model="editorContent" class="editor-area" spellcheck="false"></textarea>
      <div v-if="editorWarning" class="editor-warning">{{ editorWarning }}</div>
      <div v-if="editorError" class="editor-error">{{ editorError }}</div>
      <div class="footer">
        <div class="spacer"></div>
        <button class="btn-cancel" @click="editorVisible = false">取消</button>
        <button class="btn-save" @click="saveEditor">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useSettingsStore } from "../stores/settings";
import * as api from "../api";
import type { PicGenerateSettings } from "../types";

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const settingsStore = useSettingsStore();

type FieldType = "url" | "workflow" | "textarea";

interface PicField {
  key: string;
  label: string;
  type: FieldType;
}
interface PicSourceDef {
  id: string;
  label: string;
  defaults: Record<string, string>;
  fields: PicField[];
}

/** 来源注册表：新增来源只需在这里加一项（后端按需补连接测试逻辑）。 */
const PIC_SOURCES: PicSourceDef[] = [
  {
    id: "comfyui",
    label: "ComfyUI",
    defaults: {
      url: "http://127.0.0.1:8188",
      workflow: "",
      promptPrefix: "",
      negativePrefix: "",
    },
    fields: [
      { key: "url", label: "ComfyUI URL", type: "url" },
      { key: "workflow", label: "ComfyUI Workflow", type: "workflow" },
      { key: "promptPrefix", label: "常见提示词前缀", type: "textarea" },
      { key: "negativePrefix", label: "常见负面提示词前缀", type: "textarea" },
    ],
  },
];

const form = ref<PicGenerateSettings>({ source: "comfyui", sources: {} });
const workflows = ref<string[]>([]);
const testing = ref(false);
const testResult = ref<{ ok: boolean; message: string } | null>(null);
const saved = ref(false);

const editorVisible = ref(false);
const editingName = ref("");
const editorContent = ref("");
const editorError = ref("");

const generateResult = ref<{ ok: boolean; message: string; url?: string } | null>(null);
const generating = ref(false);

const currentSource = computed(
  () => PIC_SOURCES.find((s) => s.id === form.value.source) ?? PIC_SOURCES[0]
);

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function initFromStore(): void {
  const stored = settingsStore.settings.picGenerate;
  const sources: Record<string, Record<string, any>> = {};
  for (const src of PIC_SOURCES) {
    sources[src.id] = { ...src.defaults, ...(stored?.sources?.[src.id] ?? {}) };
  }
  form.value = { source: stored?.source ?? "comfyui", sources };
  testResult.value = null;
  saved.value = false;
}

onMounted(() => {
  refreshWorkflows();
});

watch(
  () => props.visible,
  (v) => {
    if (v) {
      initFromStore();
      refreshWorkflows();
    }
  }
);

async function refreshWorkflows(): Promise<void> {
  try {
    workflows.value = await api.listWorkflows();
  } catch {
    workflows.value = [];
  }
}

async function testConnection(): Promise<void> {
  const url = form.value.sources[form.value.source]?.url ?? "";
  testing.value = true;
  testResult.value = null;
  try {
    testResult.value = await api.testComfyUI(url);
  } catch (e) {
    testResult.value = { ok: false, message: e instanceof Error ? e.message : String(e) };
  } finally {
    testing.value = false;
  }
}

async function save(): Promise<void> {
  await settingsStore.save({ picGenerate: clone(form.value) });
  saved.value = true;
  setTimeout(() => (saved.value = false), 1500);
}

async function openEditor(): Promise<void> {
  const name = form.value.sources[form.value.source]?.workflow ?? "";
  if (!name) return;
  editingName.value = name;
  editorError.value = "";
  editorContent.value = "";
  editorVisible.value = true;
  try {
    const r = await api.getWorkflow(name);
    editorContent.value = r.content;
  } catch (e) {
    editorError.value = e instanceof Error ? e.message : String(e);
  }
}

async function saveEditor(): Promise<void> {
  const name = editingName.value;
  try {
    await api.saveWorkflow(name, editorContent.value);
    editorVisible.value = false;
    editorError.value = "";
    await refreshWorkflows();
  } catch (e) {
    editorError.value = e instanceof Error ? e.message : String(e);
  }
}

const editorWarning = computed(() => {
  const missing: string[] = [];
  if (!editorContent.value.includes("%PositivePrompt%")) missing.push("%PositivePrompt%");
  if (!editorContent.value.includes("%NegativePrompt%")) missing.push("%NegativePrompt%");
  return missing.length
    ? `⚠ workflow 缺少占位符：${missing.join("、")}。生图时这两个占位符会被替换为对应提示词。`
    : "";
});

async function testGenerate(): Promise<void> {
  generating.value = true;
  generateResult.value = null;
  try {
    // 先生成当前设置再提交，保证用的是最新配置
    await settingsStore.save({ picGenerate: clone(form.value) });
    generateResult.value = await api.generateComfyUI();
  } catch (e) {
    generateResult.value = {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    };
  } finally {
    generating.value = false;
  }
}
</script>

<style scoped>
.pic-box {
  background: var(--panel);
  border-radius: 16px;
  width: min(94%, 560px);
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
.body {
  overflow-y: auto;
  padding: 16px 18px;
  flex: 1;
}
.label {
  display: block;
  color: var(--text-dim);
  font-size: 13px;
  margin: 12px 0 6px;
}
.hint {
  color: var(--text-faint);
  font-size: 12px;
  margin-top: 6px;
}
.hint.ok {
  color: var(--success);
}
.hint.err {
  color: var(--accent);
}
.input {
  width: 100%;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
}
textarea.input.area {
  resize: vertical;
  min-height: 64px;
}
.row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.grow {
  flex: 1;
}
.btn,
.btn-test,
.btn-edit {
  border: none;
  border-radius: 8px;
  padding: 9px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
  transition: opacity 0.15s ease;
}
.btn:hover,
.btn-test:hover,
.btn-edit:hover {
  opacity: 0.85;
}
.btn {
  background: #3b82f6;
}
.btn-test {
  background: var(--success);
}
.btn-test:disabled {
  opacity: 0.6;
  cursor: default;
}
.btn-edit {
  background: #8b5cf6;
}
.btn-edit:disabled {
  opacity: 0.5;
  cursor: default;
}
.btn-generate {
  background: #f59e0b;
  border: none;
  border-radius: 8px;
  padding: 9px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  transition: opacity 0.15s ease;
}
.btn-generate:hover {
  opacity: 0.85;
}
.btn-generate:disabled {
  opacity: 0.6;
  cursor: default;
}
.gen-img {
  display: block;
  max-width: 100%;
  max-height: 320px;
  margin-top: 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
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
.saved {
  color: var(--success);
  font-size: 13px;
}
.btn-cancel {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 14px;
  padding: 9px 16px;
}
.btn-save {
  background: var(--accent);
  border: none;
  border-radius: 8px;
  padding: 9px 20px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  transition: background-color 0.15s ease;
}
.btn-save:hover {
  background: var(--accent-hover);
}

/* editor */
.editor-box {
  background: var(--panel);
  border-radius: 16px;
  width: min(94%, 720px);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
}
.editor-area {
  flex: 1;
  min-height: 320px;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin: 16px 18px;
  padding: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  white-space: pre;
  overflow: auto;
}
.editor-error {
  color: var(--accent);
  font-size: 13px;
  padding: 0 18px 8px;
}
.editor-warning {
  color: var(--quote);
  font-size: 13px;
  padding: 0 18px 8px;
  line-height: 1.5;
}
</style>
