/**
 * Planning Agent（规划代理）
 * 非流式调用，输入 Lorebook/Summary/Status/最近对话，输出 Writing Guide
 */

import type { CharacterCard } from "../parser/characterCard";
import type { AppSettings } from "../store/settings";
import type { Message } from "../prompt/template";
import { replacePlaceholders } from "../utils/placeholders";
import { getLoreForAgent } from "./loreRouter";

const PLANNER_SYSTEM_PROMPT = `\
你是一个故事规划代理（Planning Agent）。你的任务是根据世界观设定、故事状态和对话历史，为下一步创作构思剧情走向，输出一份简洁的写作指导交给写作代理执行。

【你接收的数据】
- Lorebook：世界观与角色设定，不可违背。
- Summary：故事迄今的剧情梗概。
- Status：当前角色状态（地点、行为、情绪等）。
- 对话历史：最近的对话记录。**用户的最后一条发言是最重要的输入，你必须以它为起点来规划。不要忽略或弱化用户说的话。**

【输出格式】
按以下结构输出，简洁有力：

## 走向
基于用户最新发言，提出接下来最自然的剧情走向。只需1个方向，说清楚要发生什么、为什么选它。

## 关键节拍
用2-4句话描述本段正文的情感起伏和节奏——从哪里开始、经过什么转折、在哪里收尾。

## 要点
列出写作代理必须体现的关键信息：
- 哪些角色在场、各自什么状态
- 必须回收或埋下的伏笔（如果有）
- 情感基调（紧张/温情/悲伤/轻松等）

## 衔接
一句话指明正文的第一段应该从哪个状态切入。

【行为准则】
- 不写正文，只给指导。
- 所有建议必须扎根于 Lorebook 和 Status，不编造设定。
- 用户的发言是驱动剧情的第一优先级，不要自顾自转向。
- 语气坚定、具体、富有洞察力，像一位深知结构魔力的故事医生。`;

/**
 * 构建 Planning Agent 的 messages
 */
export function buildPlannerMessages(
  card: CharacterCard,
  history: Message[],
  userName: string,
  summary: string,
  status: string,
  settings?: AppSettings
): Message[] {
  const d = card.data;
  const charName = d.name || "Character";
  const context: Message[] = [];
  const parts: string[] = [];

  // Custom system prompt
  if (settings?.customSystemPrompt?.trim()) {
    parts.push(settings.customSystemPrompt.trim());
  }

  // 角色名
  parts.push(`[Character: ${charName}]`);

  // 注入 Lorebook
  const recentText = history.map((m) => m.content).join("\n");
  const lore = getLoreForAgent(card, "planner", recentText);

  if (lore.before) parts.push(lore.before);

  // Planning Agent 系统指令
  parts.push(PLANNER_SYSTEM_PROMPT);

  if (lore.after) parts.push(lore.after);

  context.push({
    role: "system",
    content: parts.join("\n\n").trim(),
  });

  // Status
  if (status) {
    context.push({
      role: "system",
      content: `[Current Status]\n${status}`,
    });
  }

  // Summary
  if (summary) {
    context.push({
      role: "system",
      content: `[Story Summary]\n${summary}`,
    });
  }

  // 未总结的对话历史（全部传入）
  for (const msg of history) {
    context.push(msg);
  }

  return context;
}
