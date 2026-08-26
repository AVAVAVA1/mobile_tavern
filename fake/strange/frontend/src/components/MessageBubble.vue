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
    <!-- Chain of Thought -->
    <div v-if="!isUser && parsed.thinking" class="think-toggle">
      <button class="think-toggle-text" @click="thinkingExpanded = !thinkingExpanded">
        {{ thinkingExpanded ? "▼" : "▶" }} Chain of Thought
      </button>
      <div v-if="thinkingExpanded" class="think-content">{{ parsed.thinking }}</div>
    </div>

    <!-- Body -->
    <div
      v-if="parsed.body"
      class="md-body"
      :class="isUser ? 'md-user' : 'md-assistant'"
      v-html="renderMarkdown(parsed.body)"
    ></div>
    <div v-else-if="parsed.thinking" class="waiting">Generating...</div>
    <div
      v-else
      class="md-body"
      :class="isUser ? 'md-user' : 'md-assistant'"
      v-html="renderMarkdown(parsed.displayContent)"
    ></div>

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
import type { ChatMessage } from "../types";
import { renderMarkdown, replacePlaceholders } from "../utils/markdown";

const props = defineProps<{
  message: ChatMessage;
  charName: string;
  userName: string;
  generating?: boolean;
}>();
const emit = defineEmits<{ (e: "generate-image", id: string): void }>();

const isUser = computed(() => props.message.role === "user");
const isStatus = computed(() => props.message.messageType === "status");
const isImage = computed(() => props.message.messageType === "image");

const thinkingExpanded = ref(false);

const THINK_PATTERNS: { open: RegExp; close: RegExp }[] = [
  { open: /<thinking>/i, close: /<\/thinking>/i },
  { open: /【思考】/, close: /【\/思考】/ },
  { open: /\{思考\}/, close: /\{\/思考\}/ },
];

const parsed = computed(() => {
  const displayContent = replacePlaceholders(
    props.message.content,
    props.charName,
    props.userName
  );

  let thinking = "";
  let body = displayContent;

  for (const pat of THINK_PATTERNS) {
    const openMatch = displayContent.match(pat.open);
    if (!openMatch) continue;
    const openEnd = (openMatch.index ?? 0) + openMatch[0].length;
    const closeMatch = displayContent.match(pat.close);
    if (closeMatch) {
      thinking = displayContent.slice(openEnd, closeMatch.index ?? 0).trim();
      body = displayContent.slice((closeMatch.index ?? 0) + closeMatch[0].length).trim();
    } else {
      thinking = displayContent.slice(openEnd).trim();
      body = "";
    }
    break;
  }

  thinking = thinking.replace(/^\n+|\n+$/g, "");
  body = body.replace(/^\n+|\n+$/g, "");

  return { thinking, body, displayContent };
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
  background: #e94560;
  align-self: flex-end;
}
.assistant-bubble {
  background: #0f3460;
  align-self: flex-start;
}

/* Status message */
.status-bubble {
  max-width: 92%;
  border-radius: 10px;
  padding: 10px;
  margin: 6px 14px;
  background: #1a2332;
  align-self: center;
  border: 1px solid #2a3a4a;
}
.status-header {
  background: none;
  border: none;
  color: #10b981;
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
  border: 1px solid #2a2a4a;
}

/* Thinking toggle */
.think-toggle {
  margin-bottom: 8px;
}
.think-toggle-text {
  background: none;
  border: none;
  color: #a0a0b8;
  font-size: 12px;
  font-weight: 600;
  padding: 0;
  text-align: left;
}
.think-content {
  color: #888;
  font-size: 11px;
  line-height: 16px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  margin-top: 4px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  white-space: pre-wrap;
}
.waiting {
  color: #666;
  font-size: 13px;
  font-style: italic;
}

/* 元数据表（调试） */
.meta-debug {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed rgba(255, 255, 255, 0.15);
  color: #f0c040;
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
