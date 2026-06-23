import type { CharacterCard } from "../parser/characterCard";

// ---- 类型定义 ----

export interface BookEntry {
  keys: string[];
  content: string;
  comment?: string;
  constant: boolean;
  enabled: boolean;
  position: "before_char" | "after_char";
  insertion_order: number;
  case_sensitive: boolean;
  selective: boolean;
  secondary_keys: string[];
}

export interface CharacterBook {
  name?: string;
  description?: string;
  scan_depth: number;
  token_budget?: number;
  recursive_scanning: boolean;
  case_sensitive: boolean;
  entries: BookEntry[];
}

/**
 * 从角色卡中提取世界书/人物书
 * 优先级：data.character_book > data.extensions.character_book
 */
export function extractCharacterBook(
  card: CharacterCard
): CharacterBook | null {
  // 类脑社区主流：character_book 直接在 data 顶层
  const raw =
    (card.data as any).character_book ??
    card.data.extensions?.["character_book"];

  if (!raw) return null;

  try {
    return normalizeBook(raw);
  } catch {
    return null;
  }
}

function normalizeBook(raw: any): CharacterBook {
  return {
    name: raw.name ?? "",
    description: raw.description ?? "",
    scan_depth: raw.scan_depth ?? 50,
    token_budget: raw.token_budget ?? 500,
    recursive_scanning: raw.recursive_scanning ?? false,
    case_sensitive: raw.case_sensitive ?? false,
    entries: Array.isArray(raw.entries)
      ? raw.entries.map(normalizeEntry)
      : [],
  };
}

function normalizeEntry(raw: any): BookEntry {
  return {
    keys: Array.isArray(raw.keys) ? raw.keys : [],
    content: raw.content ?? "",
    comment: raw.comment,
    constant: raw.constant ?? false,
    enabled: raw.enabled ?? true,
    position: raw.position === "after_char" ? "after_char" : "before_char",
    insertion_order: raw.insertion_order ?? 100,
    case_sensitive: raw.case_sensitive ?? false,
    selective: raw.selective ?? false,
    secondary_keys: Array.isArray(raw.secondary_keys) ? raw.secondary_keys : [],
  };
}

/**
 * 获取当前活跃的世界书条目
 * @param book 角色书
 * @param recentText 最近的消息文本（用于关键词匹配）
 * @returns 激活的条目列表
 */
export function getActiveEntries(
  book: CharacterBook,
  recentText: string
): BookEntry[] {
  const textToSearch = book.case_sensitive ? recentText : recentText.toLowerCase();
  const active: BookEntry[] = [];

  for (const entry of book.entries) {
    if (!entry.enabled) continue;

    // 始终激活的条目
    if (entry.constant) {
      active.push(entry);
      continue;
    }

    // 没有关键词的条目跳过
    if (entry.keys.length === 0 && entry.secondary_keys.length === 0) continue;

    // 检查关键词匹配
    const allKeys = [...entry.keys, ...entry.secondary_keys];
    const matched = allKeys.some((key) => {
      const searchKey = book.case_sensitive ? key : key.toLowerCase();
      return searchKey && textToSearch.includes(searchKey);
    });

    if (matched) {
      active.push(entry);
    }
  }

  return active;
}

/**
 * 将活跃条目拼接为注入文本，按位置和 insertion_order 排序
 */
export function injectEntries(
  entries: BookEntry[],
  position: "before_char" | "after_char"
): string {
  const filtered = entries
    .filter((e) => e.position === position)
    .sort((a, b) => a.insertion_order - b.insertion_order);

  if (filtered.length === 0) return "";

  return filtered
    .map((e) => e.content.trim())
    .filter(Boolean)
    .join("\n\n");
}

/**
 * 构建世界书搜索文本：最近 N 条消息的内容拼在一起
 */
export function buildSearchText(
  messages: { role: string; content: string }[],
  scanDepth: number
): string {
  return messages
    .slice(-scanDepth)
    .map((m) => m.content)
    .join("\n");
}
