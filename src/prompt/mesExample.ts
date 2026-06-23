import type { Message } from "./template";
import { replacePlaceholders } from "../utils/placeholders";

/**
 * 解析 SillyTavern 格式的 mes_example 为 few-shot 消息对
 *
 * 格式：<START> 分隔对话轮次，{{user}}: / {{char}}: 标记发言者
 * 例：
 *   {{user}}: 你好
 *   {{char}}: 你好呀
 *   <START>
 *   {{user}}: 今天天气不错
 *   {{char}}: 是啊，出去走走吧
 */
export function parseMesExample(
  raw: string,
  charName: string,
  userName: string
): Message[] {
  if (!raw.trim()) return [];

  // 按 <START> 分割示例对话块
  const blocks = raw.split(/<START>/gi);
  const messages: Message[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const pairs = parseBlock(trimmed, charName, userName);
    messages.push(...pairs);
  }

  return messages;
}

/**
 * 解析单个对话块为 user/assistant 消息对
 */
function parseBlock(
  block: string,
  charName: string,
  userName: string
): Message[] {
  const messages: Message[] = [];

  // 按行分割
  const lines = block.split("\n");

  let currentSpeaker: "user" | "char" | null = null;
  let currentContent: string[] = [];

  const flushContent = () => {
    if (currentSpeaker && currentContent.length > 0) {
      const text = currentContent.join("\n").trim();
      if (text) {
        messages.push({
          role: currentSpeaker === "user" ? "user" : "assistant",
          content: text,
        });
      }
    }
    currentContent = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      // 空行可能表示段落分隔，继续追加到当前发言
      if (currentSpeaker) {
        currentContent.push("");
      }
      continue;
    }

    // 检测 {{user}}: / {{char}}: 或 <user>: / <char>: 前缀
    const userMatch = line.match(/^(\{\{user\}\}|<user>)\s*:\s*/i);
    const charMatch = line.match(/^(\{\{char\}\}|<char>)\s*:\s*/i);

    if (userMatch || charMatch) {
      // 先保存上一段发言
      flushContent();

      if (userMatch) {
        currentSpeaker = "user";
        currentContent.push(line.slice(userMatch[0].length));
      } else if (charMatch) {
        currentSpeaker = "char";
        currentContent.push(line.slice(charMatch[0].length));
      }
    } else if (currentSpeaker) {
      // 多行内容继续追加
      currentContent.push(rawLine);
    }
    // 忽略既无前缀也无当前发言者的行
  }

  flushContent();

  // 替换占位符
  return messages.map((m) => ({
    role: m.role,
    content: replacePlaceholders(m.content, charName, userName),
  }));
}
