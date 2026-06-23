import type { CharacterCard } from "../parser/characterCard";
import type { AppSettings } from "../store/settings";
import type { APITool } from "../api/types";
import { parseMesExample } from "../prompt/mesExample";
import { replacePlaceholders } from "../utils/placeholders";
import { injectEntries } from "../prompt/worldBook";
import { injectAuthorNote } from "../prompt/authorsNote";
import type { Message } from "../prompt/template";

// Agent 模式优先读 agent_book
function getAgentBook(card: CharacterCard) {
  const raw = card.data.agent_book ?? card.data.character_book;
  if (!raw) return null;
  try {
    return {
      name: raw.name ?? "",
      scan_depth: raw.scan_depth ?? 50,
      case_sensitive: raw.case_sensitive ?? false,
      entries: (raw.entries ?? []).map((e: any) => ({
        keys: e.keys ?? [],
        content: e.content ?? "",
        comment: e.comment,
        constant: e.constant ?? false,
        enabled: e.enabled ?? true,
        position: e.position ?? "before_char",
        insertion_order: e.insertion_order ?? 100,
        case_sensitive: e.case_sensitive ?? false,
        selective: e.selective ?? false,
        secondary_keys: e.secondary_keys ?? [],
      })),
      recursive_scanning: raw.recursive_scanning ?? false,
    };
  } catch {
    return null;
  }
}

export interface AgentSkillSelection {
  indices: number[];  // 1-based skill indices
  reason: string;
}

// ============ Pass 1: Skill 选择（Function Calling 架构） ============

const PASS1_INSTRUCTION = [
  "You are a context router. Your ONLY task is to select which background lore is relevant.",
  "",
  "1. Read the recent conversation below to understand the current topic.",
  "2. Review the [Available Skills] — each has a description of what info it contains.",
  "3. Call select_skills with the indices of skills whose description matches the current topic.",
  "4. If none match, pass an empty array.",
  "",
  "Do NOT roleplay. Do NOT generate a reply. Only select skills.",
].join("\n");

/**
 * Pass 1: 构建 Skill 选择阶段的 messages（极简：只含 skill 表 + 最近对话）
 */
export function buildSkillSelectionMessages(
  card: CharacterCard,
  history: Message[],
  userName: string,
  settings?: AppSettings
): Message[] {
  const d = card.data;
  const charName = d.name || "Character";
  const context: Message[] = [];
  const book = getAgentBook(card);

  const parts: string[] = [];

  // 1. Custom system prompt（来自 Settings）
  if (settings?.customSystemPrompt?.trim()) {
    parts.push(settings.customSystemPrompt.trim());
  }

  // 2. 角色名（仅标识）
  parts.push(`[Character: ${charName}]`);

  // 3. 极简指令
  parts.push(PASS1_INSTRUCTION);

  // 4. Skills 表（仅 description，不含 content）
  const skills = book
    ? book.entries.filter((e: any) => e.enabled !== false && e.constant !== true)
    : [];

  if (skills.length > 0) {
    const skillList = skills
      .map((e: any, i: number) => {
        const desc =
          e.comment?.trim() ||
          (e.keys?.length > 0 ? e.keys.join(", ") : "(no description)");
        return `${i + 1}. ${desc}`;
      })
      .join("\n");

    parts.push(["[Available Skills]", skillList].join("\n"));
  }

  context.push({
    role: "system",
    content: parts.join("\n\n").trim() || "Assistant.",
  });

  // 5. first_mes 提供初始上下文
  if (d.first_mes) {
    context.push({
      role: "assistant",
      content: replacePlaceholders(d.first_mes, charName, userName),
    });
  }

  // 6. 最近对话（让 LLM 知道当前话题）
  const scanDepth = book?.scan_depth ?? 10;
  const recentHistory = history.slice(-scanDepth);
  for (const msg of recentHistory) {
    context.push(msg);
  }

  return context;
}

/**
 * Pass 1: 构建 Skill 选择用的 Tool 定义
 */
export function buildSkillSelectionTools(card: CharacterCard): APITool[] | null {
  const book = getAgentBook(card);
  const skills = book
    ? book.entries.filter((e: any) => e.enabled !== false && e.constant !== true)
    : [];

  if (skills.length === 0) return null;

  return [
    {
      type: "function",
      function: {
        name: "select_skills",
        description:
          "Analyze the conversation context and select which skills/lore entries contain relevant information. " +
          "Call this for EVERY user message to determine which background knowledge should be loaded. " +
          "Only select skills whose content is actually relevant to the current conversation topic.",
        parameters: {
          type: "object",
          properties: {
            indices: {
              type: "array",
              items: { type: "integer" },
              description:
                "1-based indices of selected skills (matching the [Available Skills] numbers). Empty array [] if none are relevant.",
            },
            reason: {
              type: "string",
              description:
                "One sentence explaining why these skills were selected (or why none were).",
            },
          },
          required: ["indices", "reason"],
        },
      },
    },
  ];
}

/**
 * 解析 LLM 返回的 tool_call 中的 skill 选择
 */
export function parseToolCallSelection(choice: {
  message: {
    content: string | null;
    tool_calls?: Array<{
      function: { name: string; arguments: string };
    }>;
  };
}): AgentSkillSelection {
  const toolCalls = choice.message.tool_calls;
  console.log("[Agent] parseToolCallSelection", {
    hasToolCalls: !!toolCalls,
    toolCount: toolCalls?.length,
    names: toolCalls?.map((tc) => tc.function.name),
    contentPreview: choice.message.content?.slice(0, 100),
  });

  if (toolCalls && toolCalls.length > 0) {
    const skillCall = toolCalls.find(
      (tc) => tc.function.name === "select_skills"
    );
    if (skillCall) {
      try {
        const args = JSON.parse(skillCall.function.arguments);
        const indices: number[] = Array.isArray(args.indices)
          ? args.indices.filter((n: any) => typeof n === "number" && n > 0)
          : [];
        const reason: string =
          typeof args.reason === "string" ? args.reason.trim() : "";
        console.log("[Agent] parsed from tool_call:", { indices, reason });
        return { indices, reason };
      } catch (e) {
        console.log("[Agent] tool_call JSON parse failed, trying text fallback");
        const text =
          (choice.message.content ?? "") +
          " " +
          skillCall.function.arguments;
        return parseTextFallback(text);
      }
    }
    console.log("[Agent] select_skills not found in tool_calls, trying text fallback");
  }

  if (choice.message.content) {
    return parseTextFallback(choice.message.content);
  }

  console.log("[Agent] no tool_calls and no content, returning empty");
  return { indices: [], reason: "" };
}

function parseTextFallback(text: string): AgentSkillSelection {
  const lines = text.trim().split("\n");
  const firstLine = lines[0]?.trim() ?? "";
  const nums = firstLine
    .split(/[,，\s]+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n) && n > 0);

  const reason = lines.slice(1).join(" ").trim();
  return { indices: nums, reason: reason || firstLine };
}

// ============ Pass 2: 完整回复 ============

const PASS2_INSTRUCTION = [
  "You are an immersive roleplay AI.",
  "Engage naturally with the user, staying in character using the background lore provided.",
  "Use the [Skill Context] below as reference for world and character details — but weave it in naturally, do NOT recite it verbatim.",
  "Follow the character's personality, speech style, and the scenario setting.",
].join("\n");

/**
 * Pass 2: 基于选中的 skills 构建完整 context
 */
export function buildAgentContext(
  card: CharacterCard,
  history: Message[],
  userName: string,
  selection: AgentSkillSelection,
  summary?: string,
  lastSummarizedIndex?: number,
  settings?: AppSettings,
  deletedMessageIds?: string[]
): Message[] {
  const d = card.data;
  const charName = d.name || "Character";
  const context: Message[] = [];
  const book = getAgentBook(card);
  const parts: string[] = [];

  // ---- 1. Constant entries ----
  let constantBefore = "",
    constantAfter = "";
  if (book) {
    const constant = (book.entries ?? []).filter(
      (e: any) => e.enabled !== false && e.constant === true
    );
    constantBefore = injectEntries(
      constant.filter((e: any) => e.position !== "after_char"),
      "before_char"
    );
    constantAfter = injectEntries(
      constant.filter((e: any) => e.position === "after_char"),
      "after_char"
    );
  }

  if (constantBefore) parts.push(constantBefore);

  // ---- 2. Custom system prompt（来自 Settings） ----
  if (settings?.customSystemPrompt?.trim()) {
    parts.push(settings.customSystemPrompt.trim());
  }

  // ---- 3. Pass 2 专用指令 ----
  parts.push(PASS2_INSTRUCTION);

  // ---- 4. 选中 skill 的完整 content ----
  if (book) {
    const skills = book.entries.filter(
      (e: any) => e.enabled !== false && e.constant !== true
    );
    let injected: string[] = [];

    if (selection.indices.length > 0) {
      injected = selection.indices
        .map((idx) => skills[idx - 1])
        .filter(Boolean)
        .map((e: any) => e.content?.trim())
        .filter(Boolean);
    } else {
      const recent = history.map((m: any) => m.content).join("\n");
      injected = skills
        .filter((e: any) =>
          e.keys?.some((k: string) => k && recent.includes(k))
        )
        .map((e: any) => e.content?.trim())
        .filter(Boolean);
    }

    if (injected.length > 0) {
      parts.push(`[Skill Context]\n${injected.join("\n\n")}`);
    }
  }

  // ---- 5. 角色信息 ----
  parts.push(`[Character: ${charName}]`);
  if (d.system_prompt) parts.push(d.system_prompt);
  if (d.description) parts.push(d.description);
  if (d.personality) parts.push(`[Personality]\n${d.personality}`);
  if (d.scenario) parts.push(`[Scenario]\n${d.scenario}`);
  if (constantAfter) parts.push(constantAfter);
  if (d.post_history_instructions) parts.push(d.post_history_instructions);

  context.push({
    role: "system",
    content: parts.join("\n\n").trim() || "Assistant.",
  });

  // ---- 6. Few-shot + first_mes + summary ----
  if (d.mes_example) {
    context.push(...parseMesExample(d.mes_example, charName, userName));
  }

  if (d.first_mes) {
    context.push({
      role: "assistant",
      content: replacePlaceholders(d.first_mes, charName, userName),
    });
  }

  if (summary) {
    context.push({
      role: "system",
      content: `[Previous conversation summary]\n${summary}`,
    });
  }

  // ---- 7. History ----
  const firstMesText = d.first_mes
    ? replacePlaceholders(d.first_mes, charName, userName)
    : "";
  const startIdx =
    lastSummarizedIndex != null && lastSummarizedIndex >= 0
      ? lastSummarizedIndex
      : 0;
  const deletedSet = new Set(deletedMessageIds ?? []);
  const unsummarizedHistory: Message[] = [];

  for (let i = startIdx; i < history.length; i++) {
    const msg = history[i];
    if (
      firstMesText &&
      msg.role === "assistant" &&
      msg.content === firstMesText
    )
      continue;
    if (deletedSet.has((msg as any).id)) continue;
    unsummarizedHistory.push(msg);
  }

  if (settings?.authorNoteText) {
    context.push(
      ...injectAuthorNote(
        unsummarizedHistory,
        settings.authorNoteText,
        settings.authorNoteDepth ?? 4
      )
    );
  } else {
    context.push(...unsummarizedHistory);
  }

  return context;
}
