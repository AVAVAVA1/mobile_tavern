/**
 * Per-agent Lorebook 路由
 * 为规划/写作/状态管理三个 Agent 分别注入 Lorebook 内容
 * 每个 entry 有独立的 constant/enabled 控制
 */

import type { CharacterCard } from "../parser/characterCard";
import { buildSearchText } from "../prompt/worldBook";

export type AgentRole = "planner" | "writer" | "status";

export interface AgentBookEntry {
  keys: string[];
  content: string;
  comment?: string;
  constant?: boolean;
  enabled?: boolean;
  position: "before_char" | "after_char";
  insertion_order: number;
  case_sensitive: boolean;
  selective: boolean;
  secondary_keys: string[];
}

export interface AgentBook {
  name?: string;
  scan_depth: number;
  entries: AgentBookEntry[];
}

function getAgentBook(card: CharacterCard): AgentBook | null {
  const raw = card.data.agent_book ?? card.data.character_book;
  if (!raw) return null;
  try {
    return {
      name: raw.name ?? "",
      scan_depth: raw.scan_depth ?? 50,
      entries: (raw.entries ?? []).map((e: any) => ({
        keys: e.keys ?? [],
        content: e.content ?? "",
        comment: e.comment,
        position: e.position ?? "before_char",
        insertion_order: e.insertion_order ?? 100,
        case_sensitive: e.case_sensitive ?? false,
        selective: e.selective ?? false,
        secondary_keys: e.secondary_keys ?? [],
        constant: e.constant ?? false,
        enabled: e.enabled ?? true,
        planning_constant: e.planning_constant,
        planning_enabled: e.planning_enabled,
        writing_constant: e.writing_constant,
        writing_enabled: e.writing_enabled,
        status_constant: e.status_constant,
        status_enabled: e.status_enabled,
      })),
    };
  } catch {
    return null;
  }
}

/**
 * 读取 per-agent 字段，不存在则 fallback 到旧字段
 * 使用显式属性名避免 [] 在 Hermes 下的潜在问题
 */
function getPerAgentField(entry: any, role: AgentRole, field: "constant" | "enabled"): boolean | undefined {
  let perAgentVal: any;
  if (role === "planner") {
    perAgentVal = field === "constant" ? entry.planning_constant : entry.planning_enabled;
  } else if (role === "writer") {
    perAgentVal = field === "constant" ? entry.writing_constant : entry.writing_enabled;
  } else {
    perAgentVal = field === "constant" ? entry.status_constant : entry.status_enabled;
  }
  if (perAgentVal !== undefined) return perAgentVal;
  return entry[field];
}

function isConstantFor(entry: any, role: AgentRole): boolean {
  const v = getPerAgentField(entry, role, "constant");
  return v !== undefined ? !!v : false;
}

function isEnabledFor(entry: any, role: AgentRole): boolean {
  const v = getPerAgentField(entry, role, "enabled");
  return v !== undefined ? v !== false : true;
}

function injectEntries(entries: any[], position: "before_char" | "after_char"): string {
  const filtered = entries
    .filter((e) => e.position === position)
    .sort((a, b) => a.insertion_order - b.insertion_order);
  if (filtered.length === 0) return "";
  return filtered.map((e) => e.content?.trim()).filter(Boolean).join("\n\n");
}

export interface LoreInjection {
  before: string;
  after: string;
  entryCount: number;
}

function getActiveEntriesForAgent(
  card: CharacterCard,
  role: AgentRole,
  recentText: string
): any[] {
  const book = getAgentBook(card);
  if (!book) return [];

  const active: any[] = [];

  for (const entry of book.entries) {
    if (!isEnabledFor(entry, role)) continue;

    if (isConstantFor(entry, role)) {
      active.push(entry);
      continue;
    }

    const allKeys = [...entry.keys, ...entry.secondary_keys];
    if (allKeys.length === 0) continue;

    const matched = allKeys.some((k: string) => {
      if (!k) return false;
      return entry.case_sensitive
        ? recentText.includes(k)
        : recentText.toLowerCase().includes(k.toLowerCase());
    });

    if (matched) active.push(entry);
  }

  return active;
}

export function getLoreForAgent(
  card: CharacterCard,
  role: AgentRole,
  recentText: string
): LoreInjection {
  const entries = getActiveEntriesForAgent(card, role, recentText);
  return {
    before: injectEntries(entries.filter((e) => e.position !== "after_char"), "before_char"),
    after: injectEntries(entries.filter((e) => e.position === "after_char"), "after_char"),
    entryCount: entries.length,
  };
}

export function getLoreEntryTitles(
  card: CharacterCard,
  role: AgentRole,
  recentText: string
): string[] {
  return getActiveEntriesForAgent(card, role, recentText)
    .map((e: any) => e.comment || (e.keys?.length > 0 ? e.keys.join(", ") : "(no title)"));
}

export function getLoreStats(
  card: CharacterCard,
  role: AgentRole
): { total: number; constant: number; enabled: number; nonConstEnabled: number } {
  const book = getAgentBook(card);
  if (!book) return { total: 0, constant: 0, enabled: 0, nonConstEnabled: 0 };
  const entries = book.entries;
  return {
    total: entries.length,
    constant: entries.filter((e) => isConstantFor(e, role)).length,
    enabled: entries.filter((e) => isEnabledFor(e, role)).length,
    nonConstEnabled: entries.filter((e) => isEnabledFor(e, role) && !isConstantFor(e, role)).length,
  };
}
