/**
 * Story String 模板系统
 *
 * 用简单宏替换（类似 Handlebars 的 {{key}} 语法）让用户自定义 system prompt 排布。
 * 模板为空时使用 DEFAULT_TEMPLATE，与现有硬编码行为完全一致。
 */

export const DEFAULT_TEMPLATE = [
  "{{wi_before}}",
  "[Character: {{char}}]",
  "{{system}}",
  "{{description}}",
  "[Personality]",
  "{{personality}}",
  "[Scenario]",
  "{{scenario}}",
  "[Example dialogue format - use this style]",
  "{{mes_example_raw}}",
  "{{wi_after}}",
  "{{post_history}}",
]
  .join("\n\n")
  .replace(/\n{3,}/g, "\n\n");

export interface StoryStringParams {
  char: string;
  user: string;
  description: string;
  personality: string;
  scenario: string;
  system: string;
  mes_example_raw: string;
  post_history: string;
  wi_before: string;
  wi_after: string;
}

/**
 * 渲染 Story String 模板
 */
export function renderStoryString(
  template: string,
  params: StoryStringParams
): string {
  const effective = template || DEFAULT_TEMPLATE;

  return effective
    .replace(/\{\{char\}\}/gi, params.char)
    .replace(/\{\{user\}\}/gi, params.user)
    .replace(/\{\{description\}\}/gi, params.description)
    .replace(/\{\{personality\}\}/gi, params.personality)
    .replace(/\{\{scenario\}\}/gi, params.scenario)
    .replace(/\{\{system\}\}/gi, params.system)
    .replace(/\{\{mes_example_raw\}\}/gi, params.mes_example_raw)
    .replace(/\{\{post_history\}\}/gi, params.post_history)
    .replace(/\{\{wi_before\}\}/gi, params.wi_before)
    .replace(/\{\{wi_after\}\}/gi, params.wi_after)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
