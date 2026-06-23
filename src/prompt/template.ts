import type { CharacterCard } from "../parser/characterCard";
import type { AppSettings } from "../store/settings";
import { parseMesExample } from "./mesExample";
import { replacePlaceholders } from "../utils/placeholders";
import {
  extractCharacterBook,
  getActiveEntries,
  injectEntries,
  buildSearchText,
} from "./worldBook";
import { renderStoryString, type StoryStringParams } from "./storyString";
import { injectAuthorNote } from "./authorsNote";

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * 将角色卡组装为 LLM 消息数组，对齐 SillyTavern 酒馆
 *
 * @param settings 可选，用于 Author's Note 和 Story String 模板
 */
export function buildConversationContext(
  card: CharacterCard,
  history: Message[],
  userName: string,
  summary?: string,
  lastSummarizedIndex?: number,
  settings?: AppSettings,
  deletedMessageIds?: string[]
): Message[] {
  const d = card.data;
  const charName = d.name || "Character";
  const context: Message[] = [];

  // ---- 1. 世界书 before_char 条目 ----
  const book = extractCharacterBook(card);
  let beforeCharText = "";
  let afterCharText = "";

  if (book) {
    const searchText = buildSearchText(history, book.scan_depth);
    const active = getActiveEntries(book, searchText);
    beforeCharText = injectEntries(active, "before_char");
    afterCharText = injectEntries(active, "after_char");
  }

  // ---- 2. Story String 模板 / 硬编码 system prompt ----
  const storyParams: StoryStringParams = {
    char: charName,
    user: userName,
    description: d.description ?? "",
    personality: d.personality ?? "",
    scenario: d.scenario ?? "",
    system: d.system_prompt ?? "",
    mes_example_raw: d.mes_example ?? "",
    post_history: d.post_history_instructions ?? "",
    wi_before: beforeCharText,
    wi_after: afterCharText,
  };

  const template = settings?.storyStringTemplate || "";
  const customSys = settings?.customSystemPrompt?.trim();
  const rawContent = renderStoryString(template, storyParams) || "You are a helpful assistant.";
  const systemContent = customSys
    ? `${customSys}\n\n${rawContent}`
    : rawContent;

  context.push({ role: "system", content: systemContent });

  // ---- 3. Few-shot examples (从 mes_example 解析) ----
  if (d.mes_example) {
    const fewShot = parseMesExample(d.mes_example, charName, userName);
    context.push(...fewShot);
  }

  // ---- 4. first_mes 作为 assistant 首条消息（始终保留） ----
  if (d.first_mes) {
    const firstMesText = replacePlaceholders(d.first_mes, charName, userName);
    context.push({ role: "assistant", content: firstMesText });
  }

  // ---- 5. 历史总结注入 ----
  if (summary) {
    context.push({
      role: "system",
      content: `[Previous conversation summary]\n${summary}`,
    });
  }

  // ---- 6. 真实对话历史 ----
  const firstMesText = d.first_mes
    ? replacePlaceholders(d.first_mes, charName, userName)
    : "";

  const startIdx =
    lastSummarizedIndex != null && lastSummarizedIndex >= 0
      ? lastSummarizedIndex
      : 0;

  // 收集未总结 + 未删除的历史消息
  const unsummarizedHistory: Message[] = [];
  const deletedSet = new Set(deletedMessageIds ?? []);
  for (let i = startIdx; i < history.length; i++) {
    const msg = history[i];
    if (
      firstMesText &&
      msg.role === "assistant" &&
      msg.content === firstMesText
    ) {
      continue;
    }
    // 跳过被用户从上下文中删除的消息
    if (deletedSet.has((msg as any).id)) {
      continue;
    }
    unsummarizedHistory.push(msg);
  }

  // ---- 7. Author's Note 注入 ----
  if (settings?.authorNoteText) {
    const withAN = injectAuthorNote(
      unsummarizedHistory,
      settings.authorNoteText,
      settings.authorNoteDepth ?? 4
    );
    context.push(...withAN);
  } else {
    context.push(...unsummarizedHistory);
  }

  return context;
}
