// 显示侧正则脚本引擎（placement 1 / 非 promptOnly），对齐 RP-Hub processRegex 语义。
// 发送侧(placement 2 / promptOnly)由后端处理。

export interface RegexScript {
  name: string;
  regex: string;
  flags: string;
  replacement: string;
  placement: number[];
  markdownOnly: boolean;
  promptOnly: boolean;
  runOnEdit: boolean;
  minDepth: number | null;
  maxDepth: number | null;
  scope: "global" | "character";
  enabled: boolean;
}

export function normalizeRegexScript(
  script: Record<string, any> | null | undefined,
  fallbackScope: "global" | "character" = "character",
  systemNames: string[] = []
): RegexScript {
  const s: Record<string, any> = { ...(script || {}) };
  if (s.disabled !== undefined) s.enabled = !s.disabled;
  else if (s.enabled === undefined) s.enabled = true;
  if (!s.name && s.scriptName) s.name = s.scriptName;
  if (!s.regex && s.findRegex) s.regex = s.findRegex;
  if (!s.replacement && s.replaceString) s.replacement = s.replaceString;
  if (!s.flags && s.regexFlags) s.flags = s.regexFlags;
  if (!s.flags) s.flags = "g";
  if (!Array.isArray(s.placement)) s.placement = [1, 2];
  if (s.markdownOnly === undefined) s.markdownOnly = false;
  if (s.promptOnly === undefined) s.promptOnly = false;
  if (s.markdownOnly && s.promptOnly) s.promptOnly = false;
  if (s.runOnEdit === undefined) s.runOnEdit = false;
  if (s.minDepth === undefined) s.minDepth = null;
  if (s.maxDepth === undefined) s.maxDepth = null;
  const name = s.name || s.scriptName;
  const scope: "global" | "character" =
    s.scope === "global" || fallbackScope === "global" || systemNames.includes(name)
      ? "global"
      : "character";
  delete s.disabled;
  return {
    name: s.name || "",
    regex: s.regex || "",
    flags: s.flags || "g",
    replacement: s.replacement ?? "",
    placement: s.placement,
    markdownOnly: s.markdownOnly,
    promptOnly: s.promptOnly,
    runOnEdit: s.runOnEdit,
    minDepth: s.minDepth,
    maxDepth: s.maxDepth,
    scope,
    enabled: s.enabled !== false,
  };
}

const PROTECTION_RE =
  /(<!DOCTYPE html>[\s\S]*?<\/html>|<html\b[^>]*>[\s\S]*?<\/html>|<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<(?:cot|think)>[\s\S]*?(?:<\/(?:cot|think)>|<(?:cot|think)>|$)|```[\s\S]*?```|`[^`]+`|<\/?[a-zA-Z][\w:-]*[^>]*>)/gi;

function parsePatternFlags(regex: string, flags: string): { pattern: string; flags: string } {
  let pattern = regex;
  let f = flags;
  if (pattern.startsWith("/") && pattern.lastIndexOf("/") > 0) {
    const lastSlash = pattern.lastIndexOf("/");
    const potentialFlags = pattern.substring(lastSlash + 1);
    if (/^[gimsuy]*$/.test(potentialFlags)) {
      f = potentialFlags;
      pattern = pattern.substring(1, lastSlash);
    }
  }
  if (pattern.includes("(?s)")) {
    pattern = pattern.replace(/\(\?s\)/g, "");
    if (!f.includes("s")) f += "s";
  }
  if (pattern.includes("(?i)")) {
    pattern = pattern.replace(/\(\?i\)/g, "");
    if (!f.includes("i")) f += "i";
  }
  if (pattern.includes("(?m)")) {
    pattern = pattern.replace(/\(\?m\)/g, "");
    if (!f.includes("m")) f += "m";
  }
  return { pattern, flags: f };
}

function applyOneScript(text: string, script: RegexScript): string {
  let pattern = script.regex || "";
  if (!pattern) return text;
  const { pattern: p, flags } = parsePatternFlags(pattern, script.flags || "g");
  const replacement = script.replacement ?? "";
  let re: RegExp;
  try {
    re = new RegExp(p, flags);
  } catch {
    return text;
  }

  if (!/[<>]/.test(p) && !p.includes("```") && script.name !== "Auto Replace {{user}}") {
    const parts = text.split(PROTECTION_RE);
    return parts
      .map((part, i) => {
        if (!part) return part;
        // split with a capturing group interleaves matches at odd indices
        if (i % 2 === 1) return part;
        return part.replace(re, replacement);
      })
      .join("");
  }
  return text.replace(re, replacement);
}

export interface ProcessRegexOptions {
  isDisplay?: boolean;
  isPrompt?: boolean;
  role?: string | null;
  depth?: number;
}

export function processRegex(
  text: string,
  scripts: RegexScript[],
  options: ProcessRegexOptions = {}
): string {
  if (!text) return "";
  const { isDisplay = false, isPrompt = false, role = null, depth = 0 } = options;
  if (role === "system") return text;

  let result = text;
  const ordered = [...scripts].sort((a, b) => {
    const aImg = a.name === "NAI画图正则" ? 1 : -1;
    const bImg = b.name === "NAI画图正则" ? 1 : -1;
    return aImg === bImg ? 0 : aImg;
  });

  for (const script of ordered) {
    if (script.enabled === false) continue;
    const placement = script.placement || [1, 2];
    if (role === "user" && !placement.includes(1)) continue;
    if (role === "assistant" && !placement.includes(2)) continue;

    const userOnly = script.markdownOnly || (!script.markdownOnly && !script.promptOnly);
    if (isDisplay && script.promptOnly) continue;
    if (isPrompt && userOnly) continue;

    if (script.minDepth !== null && depth < script.minDepth) continue;
    if (script.maxDepth !== null && depth > script.maxDepth) continue;

    try {
      result = applyOneScript(result, script);
    } catch {
      /* ignore */
    }
  }
  return result;
}
