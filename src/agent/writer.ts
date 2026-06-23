/**
 * Writing Agent（写作代理）
 * 流式调用，输入 Lorebook + Writing Guide，输出正文
 */

import type { CharacterCard } from "../parser/characterCard";
import type { AppSettings } from "../store/settings";
import type { Message } from "../prompt/template";
import { replacePlaceholders } from "../utils/placeholders";
import { parseMesExample } from "../prompt/mesExample";
import { getLoreForAgent } from "./loreRouter";

const WRITER_SYSTEM_PROMPT = `\
你是一个专业的故事写作代理（Writing Agent）。你的唯一任务是根据给定的世界观设定（Lorebook）和规划代理生成的写作指导（Writing Guide），创作一段连贯、生动、严格忠于设定的正文。

【输入】
你将接收两段信息：
- Lorebook：包含世界观、角色背景、历史事件等所有被确认为"真实"的设定。这是不可动摇的创作基石。
- Writing Guide：由规划代理输出的结构化指导，包含推荐方向、关键场景设计、衔接过渡、伏笔管理、情感主题等模块。它是一张精确的施工蓝图。

【你的输出】
- 直接输出故事正文。不添加任何解释、点评、过渡语或元描述。
- 正文的起点必须严格遵从写作指导中"衔接与过渡"部分指定的那一刻或状态。
- 重点将指导中的"关键场景设计"展开为丰满的叙事，同时保持整体节奏自然、不拖沓。

【核心创作准则】
1. 绝对忠于设定：Lorebook 拥有最高权威。任何行文中不得出现与其冲突的设定。
2. 翻译蓝图，而非改写蓝图：你必须忠实执行写作指导的核心意图——推荐方向不能变，关键场景的冲突、情感节拍、对话目的必须被实现。
3. 展示，而非告知：用角色的动作、感官细节、精心选择的环境描写和内心活动来推进故事。
4. 情感与主题的共振：紧扣写作指导中"情感与主题深化"的建议。
5. 伏笔与悬念处理：根据指导中的"悬念与伏笔管理"，自然地埋下新伏笔或回收旧伏笔。
6. 无缝衔接：在正文开头，用最精炼的笔法建立起与上一段故事结束状态的连接。

【风格与语气】
- 文风应与既有故事保持一致。如果指导或 Lorebook 没有特别要求，请使用流畅、富有沉浸感的中文文学语言。
- 对话使用双引号""，内心独白可选用单引号''或融入叙述，需清晰易辨。

【禁忌】
- 不输出正文之外的任何内容。
- 不自行添加写作指导中未包含的重大情节转向或新方向。
- 不进行冗长的前情回顾，除非是为了服务当前场景的极简提示。`;

/**
 * 构建 Writing Agent 的 messages
 * 不包含对话历史——完全依赖 Writing Guide
 */
export function buildWriterMessages(
  card: CharacterCard,
  userName: string,
  writingGuide: string,
  settings?: AppSettings,
  recentText?: string,
  lastUserMessage?: string
): Message[] {
  const d = card.data;
  const charName = d.name || "Character";
  const context: Message[] = [];
  const parts: string[] = [];

  // 注入 Lorebook（用 recentText 做关键词匹配）
  const lore = getLoreForAgent(card, "writer", recentText || "");

  // Custom system prompt
  if (settings?.customSystemPrompt?.trim()) {
    parts.push(settings.customSystemPrompt.trim());
  }

  parts.push(`[Character: ${charName}]`);

  if (lore.before) parts.push(lore.before);

  // Writing Agent 系统指令
  parts.push(WRITER_SYSTEM_PROMPT);

  if (lore.after) parts.push(lore.after);

  context.push({
    role: "system",
    content: parts.join("\n\n").trim(),
  });

  // Writing Guide
  context.push({
    role: "system",
    content: `[Writing Guide]\n${writingGuide}`,
  });

  // 用户最新发言（作为直接回应目标）
  if (lastUserMessage) {
    context.push({
      role: "system",
      content: `[User's latest message — you are responding to this]\n${lastUserMessage}`,
    });
  }

  // Few-shot examples
  if (d.mes_example) {
    context.push(...parseMesExample(d.mes_example, charName, userName));
  }

  return context;
}
