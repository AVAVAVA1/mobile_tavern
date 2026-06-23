/**
 * Status Manager Agent（状态管理代理）
 * 流式调用，输入 Lorebook + Previous Status + Latest Text，输出当前状态栏
 */

import type { CharacterCard } from "../parser/characterCard";
import type { AppSettings } from "../store/settings";
import type { Message } from "../prompt/template";
import { getLoreForAgent } from "./loreRouter";

const STATUS_SYSTEM_PROMPT = `\
你是一个状态管理代理。根据 Latest_Text（最新正文）和 Previous_Status（上一轮状态栏），输出当前状态栏。

【输出格式 — 严格按此模板，无需任何解释】
🔹交互信息🔹

当前日期：第{{day_num}}天 - 周{{week_num}}

当前时间阶段：{{timePeriodText}}

当前剧情：{{plot}}

🔹[角色姓名1]🔹

👗 当前衣着：{{Dressing Status}}

😊 表情状态：{{Facial Expression}}

🍈 乳房状态：{{Breasts Status}}

💗 性器状态：{{Genitals Status}}

🤰🏻 子宫状态：{{Uterus and Pregnancy Status}}

🌼 肛门状态：{{Anus Status}}

🙋🏻‍♀️ 当前行为：{{Current Actions}}

🏠 当前地点：{{Current Location}}

🌴 内心想法：{{Inner Thoughts}}

🔹[角色姓名2]🔹
...（最多3个焦点角色）

【填充规则 — 短记，无须解释】
- 日期/时间：Latest_Text有时序线索则更新，否则继承。
- 剧情：一句话概括Latest_Text核心事件。
- 身体字段：仅当Latest_Text有明确描写才更新，否则原样继承Previous_Status。
- 行为/地点：取Latest_Text中该角色最新发生的动作与位置。
- 内心想法：每次都根据Latest_Text重新推断。结合遭遇、行为、对话来写。
- 角色姓名参考Lorebook，确保准确。

【严格禁止】
- 不输出模板之外的任何文字。不要问候、解释、总结、评价。
- 不输出大段叙事。你只输出状态栏。
- 不编造正文未提及的身体变化。`;

/**
 * 构建 Status Manager Agent 的 messages
 */
export function buildStatusManagerMessages(
  card: CharacterCard,
  previousStatus: string,
  latestText: string,
  settings?: AppSettings
): Message[] {
  const d = card.data;
  const charName = d.name || "Character";
  const context: Message[] = [];
  const parts: string[] = [];

  // 角色名
  parts.push(`[Character: ${charName}]`);

  // 注入 Lorebook
  const lore = getLoreForAgent(card, "status", latestText);

  if (lore.before) parts.push(lore.before);

  // Status Manager 系统指令
  parts.push(STATUS_SYSTEM_PROMPT);

  if (lore.after) parts.push(lore.after);

  context.push({
    role: "system",
    content: parts.join("\n\n").trim(),
  });

  // Previous Status
  context.push({
    role: "system",
    content: previousStatus
      ? `[Previous Status]\n${previousStatus}`
      : "[Previous Status]\n(No previous status — this is the beginning of the story.)",
  });

  // Latest Text
  context.push({
    role: "system",
    content: `[Latest Text]\n${latestText}`,
  });

  return context;
}
