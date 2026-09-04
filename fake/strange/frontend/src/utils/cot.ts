// 思维链(Chain of Thought)解析，支持 <think>/<cot>（含未闭合）与尾部 [系统指令:]。
// 对齐 RP-Hub 的 parseCot 行为。

export interface ParsedCot {
  cot: string;
  main: string;
  sys: string;
  isFinished: boolean;
}

const cotCache = new Map<string, ParsedCot>();

export function parseCot(text: string): ParsedCot {
  if (!text) return { cot: "", main: "", sys: "", isFinished: false };
  const cached = cotCache.get(text);
  if (cached) return cached;

  // 匹配 <think>/<thinking>/<cot>/<thought>，支持未闭合、闭合标签带空格、缺斜杠的闭合
  const cotPattern = /<(think|cot|thinking|thought)>([\s\S]*?)(?:<\/\s*\1\s*>|<\s*\1\s*>|$)/gi;
  let cotContent = "";
  let mainContent = text;
  let isFinished = false;

  mainContent = mainContent.replace(cotPattern, (match, tag: string, content: string) => {
    const parts = content.split(/(```[\s\S]*?```|`[^`]+`)/);
    const escaped = parts
      .map((part, i) => (i % 2 === 1 ? part : part.replace(/</g, "&lt;")))
      .join("");
    cotContent += escaped;
    if (match.includes("</") || (match.match(new RegExp("<" + tag + ">", "gi")) || []).length > 1) {
      isFinished = true;
    }
    return "";
  });

  let sys = "";
  const sysMatch = mainContent.match(/\n\n\[系统指令:\s*([\s\S]*?)\]\s*$/);
  if (sysMatch) {
    sys = sysMatch[1];
    mainContent = mainContent.slice(0, sysMatch.index).trim();
  }

  const result: ParsedCot = {
    cot: cotContent.trim(),
    main: mainContent.trim(),
    sys,
    isFinished,
  };
  cotCache.set(text, result);
  if (cotCache.size > 2000) {
    const firstKey = cotCache.keys().next().value;
    if (firstKey !== undefined) cotCache.delete(firstKey);
  }
  return result;
}
