<template>
  <!-- Status message (centered, collapsible) -->
  <div v-if="isStatus" class="status-bubble">
    <button class="status-header" @click="thinkingExpanded = !thinkingExpanded">
      {{ thinkingExpanded ? "▼" : "▶" }} 📊 Status Update
    </button>
    <div
      v-if="thinkingExpanded"
      class="md-body md-assistant"
      v-html="renderMarkdown(message.content)"
    ></div>
  </div>

  <!-- Image message -->
  <div v-else-if="isImage" class="image-bubble">
    <img :src="message.imageUrl" alt="生成图片" class="gen-img" />
  </div>

  <!-- Normal message (system & non-status is not rendered) -->
  <div
    v-else-if="message.role !== 'system'"
    class="bubble"
    :class="isUser ? 'user-bubble' : 'assistant-bubble'"
  >
    <!-- Thinking card (思维链) -->
    <div v-if="!isUser && parsed.thinking" class="thinking-card">
      <button class="thinking-header" @click="thinkingExpanded = !thinkingExpanded">
        <span class="thinking-bulb">💡</span>
        <span class="thinking-title">Thinking</span>
        <span class="thinking-chevron">{{ thinkingExpanded ? "▼" : "▶" }}</span>
      </button>
      <div
        v-if="thinkingExpanded"
        class="thinking-body md-body md-assistant"
        v-html="renderMarkdown(parsed.thinking)"
      ></div>
    </div>

    <!-- Main body -->
    <div
      v-if="parsed.main"
      class="md-body"
      :class="isUser ? 'md-user' : 'md-assistant'"
      v-html="renderMarkdown(parsed.main)"
    ></div>
    <div v-else-if="parsed.thinking" class="waiting">Generating...</div>

    <!-- 临时指令 (sys) -->
    <div v-if="!isUser && parsed.sys" class="sys-card">
      <div class="sys-title">📌 临时指令</div>
      <div class="md-body md-assistant" v-html="renderMarkdown(parsed.sys)"></div>
    </div>

    <!-- 元数据表（调试用，后续会隐藏） -->
    <div v-if="!isUser && message.replyMeta" class="meta-debug">
      📋 生图={{ message.replyMeta.generateImage ? "是" : "否" }}
      <span v-if="message.replyMeta.imageReason">（{{ message.replyMeta.imageReason }}）</span>
    </div>

    <!-- 生图按钮（右下角） -->
    <div v-if="!isUser && message.content" class="bubble-actions">
      <button class="gen-btn" :disabled="generating" @click.stop="emit('generate-image', message.id)">
        {{ generating ? "生成中…" : "🖼 生图" }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { ChatMessage, RegexScript } from "../types";
import { renderMarkdown, replacePlaceholders } from "../utils/markdown";
import { parseCot } from "../utils/cot";
import { processRegex } from "../utils/regex";

const props = defineProps<{
  message: ChatMessage;
  charName: string;
  userName: string;
  generating?: boolean;
  /** 显示侧正则脚本（全局 + 角色级，已规范化） */
  regexScripts?: RegexScript[];
}>();
const emit = defineEmits<{ (e: "generate-image", id: string): void }>();

const isUser = computed(() => props.message.role === "user");
const isStatus = computed(() => props.message.messageType === "status");
const isImage = computed(() => props.message.messageType === "image");

const thinkingExpanded = ref(false);

// 兼容中文/花括号思维链（parseCot 未命中 <think>/<cot> 时的兜底）
const THINK_PATTERNS: { open: RegExp; close: RegExp }[] = [
  { open: /【思考】/, close: /【\/思考】/ },
  { open: /\{思考\}/, close: /\{\/思考\}/ },
];

const parsed = computed(() => {
  const placeholderContent = replacePlaceholders(
    props.message.content,
    props.charName,
    props.userName
  );

  // 先拆思维链/正文/系统指令（对齐 RP-Hub：显示正则只作用正文 main，不作用 thinking/sys）
  const cot = parseCot(placeholderContent);
  let thinking = cot.cot;
  let main = processRegex(cot.main, props.regexScripts ?? [], {
    isDisplay: true,
    role: props.message.role,
    depth: 0,
  });
  const sys = cot.sys;

  // 兜底：中文/花括号思维链
  if (!thinking) {
    for (const pat of THINK_PATTERNS) {
      const openMatch = main.match(pat.open);
      if (!openMatch) continue;
      const openEnd = (openMatch.index ?? 0) + openMatch[0].length;
      const closeMatch = main.match(pat.close);
      if (closeMatch) {
        thinking = main.slice(openEnd, closeMatch.index ?? 0).trim();
        main = main.slice((closeMatch.index ?? 0) + closeMatch[0].length).trim();
      } else {
        thinking = main.slice(openEnd).trim();
        main = "";
      }
      break;
    }
  }

  thinking = thinking.replace(/^\n+|\n+$/g, "");
  main = main.replace(/^\n+|\n+$/g, "");

  return { thinking, main, sys };
});
</script>

<style scoped>
.bubble {
  max-width: 85%;
  border-radius: 14px;
  padding: 12px;
  margin: 4px 14px;
}
.user-bubble {
  background: var(--accent);
  align-self: flex-end;
}
.assistant-bubble {
  background: var(--assistant-bg);
  align-self: flex-start;
}

/* Status message */
.status-bubble {
  max-width: 92%;
  border-radius: 10px;
  padding: 10px;
  margin: 6px 14px;
  background: var(--status-bg);
  align-self: center;
  border: 1px solid var(--status-border);
}
.status-header {
  background: none;
  border: none;
  color: var(--success);
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
  padding: 0;
  text-align: left;
  width: 100%;
}

/* Image message */
.image-bubble {
  align-self: flex-start;
  margin: 4px 14px;
  max-width: 85%;
}
.gen-img {
  display: block;
  max-width: 100%;
  max-height: 420px;
  border-radius: 12px;
  border: 1px solid var(--border);
}

/* Thinking card（对齐 RP-Hub 的可折叠 Thinking 卡片） */
.thinking-card {
  margin-bottom: 8px;
  border: 1px solid rgba(var(--overlay-rgb), 0.1);
  border-radius: 10px;
  background: var(--thinking-bg);
  overflow: hidden;
}
.thinking-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 600;
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
}
.thinking-header:hover {
  color: var(--text);
}
.thinking-bulb {
  font-size: 13px;
}
.thinking-title {
  flex: 1;
}
.thinking-chevron {
  font-size: 10px;
  opacity: 0.7;
}
.thinking-body {
  padding: 8px 12px 10px;
  border-top: 1px solid rgba(var(--overlay-rgb), 0.06);
  color: var(--text-dim);
  font-size: 13px;
  line-height: 18px;
  max-height: 320px;
  overflow-y: auto;
}
.waiting {
  color: var(--text-faint);
  font-size: 13px;
  font-style: italic;
}

/* 临时指令 (sys) 卡片 */
.sys-card {
  margin-top: 8px;
  padding: 8px 12px;
  border: 1px solid rgba(240, 192, 64, 0.25);
  border-radius: 10px;
  background: rgba(240, 192, 64, 0.06);
}
.sys-title {
  color: var(--quote);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 4px;
}
.sys-card .md-body {
  color: var(--text);
  font-size: 13px;
}

/* 元数据表（调试） */
.meta-debug {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed rgba(var(--overlay-rgb), 0.15);
  color: var(--quote);
  font-size: 11px;
  line-height: 16px;
}

/* 生图按钮 */
.bubble-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
.gen-btn {
  background: rgba(139, 92, 246, 0.18);
  border: 1px solid rgba(139, 92, 246, 0.5);
  border-radius: 8px;
  color: #c4b5fd;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  transition: background-color 0.15s ease;
}
.gen-btn:hover {
  background: rgba(139, 92, 246, 0.32);
}
.gen-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
