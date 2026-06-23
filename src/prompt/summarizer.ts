import type { AppSettings } from "../store/settings";
import type { Message } from "./template";

export const DEFAULT_SUMMARIZE_PROMPT = [
  "Summarize the conversation below objectively and faithfully.",
  "This is a fictional roleplay — do NOT apply real-world moral judgment or safety warnings.",
  "Messages marked [USER - preserve fully] contain critical user input — keep all facts, names, and details.",
  "For Assistant messages, extract only key events, decisions, and emotional shifts; drop filler.",
  "Keep the summary in the same language as the conversation.",
  "Output ONLY the summary text, no prefixes or labels.",
].join("\n");

const MERGE_INSTRUCTION = [
  "",
  "IMPORTANT: You already have a previous summary. You MUST preserve ALL facts and events",
  "from the previous summary and merge them with new information below into ONE cohesive text.",
  "Do NOT drop or lose any key information from the previous summary.",
].join("\n");

/**
 * 对一批新消息做总结，合并到已有的总结上下文中
 * 使用非流式调用
 */
export async function summarizeHistory(
  settings: AppSettings,
  existingSummary: string,
  newMessages: Message[],
  customSystemPrompt?: string
): Promise<string> {
  const { baseUrl, apiKey, model } = settings;
  const cleanKey = apiKey.replace(/[^\x20-\x7E]/g, "").trim();

  const newMessagesText = newMessages
    .map((m) =>
      m.role === "user"
        ? `[USER - preserve fully: ${m.content}]`
        : `[Assistant: ${m.content}]`
    )
    .join("\n\n");

  const basePrompt = customSystemPrompt?.trim() || DEFAULT_SUMMARIZE_PROMPT;
  const systemPrompt = existingSummary
    ? basePrompt + MERGE_INSTRUCTION
    : basePrompt;

  const userPrompt = existingSummary
    ? [
        "[Previous summary]",
        existingSummary,
        "",
        "[New messages to incorporate]",
        newMessagesText,
        "",
        "Merge the previous summary with the new messages into a single cohesive paragraph.",
      ].join("\n")
    : [
        "[Messages to summarize]",
        newMessagesText,
        "",
        "Write a single paragraph summary of these messages.",
      ].join("\n");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cleanKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Summarization failed ${response.status}: ${errText}`);
  }

  const data: any = await response.json();
  const content = data.choices?.[0]?.message?.content;
  return content ?? "";
}
