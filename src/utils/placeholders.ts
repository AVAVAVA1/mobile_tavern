/**
 * 替换占位符，同时支持两种格式：
 * - {{user}} / {{char}} (SillyTavern 标准)
 * - <user> / <char> (部分类脑社区卡片使用)
 */
export function replacePlaceholders(
  text: string,
  charName: string,
  userName: string
): string {
  return text
    .replace(/\{\{char\}\}/gi, charName)
    .replace(/\{\{user\}\}/gi, userName)
    .replace(/<char>/gi, charName)
    .replace(/<user>/gi, userName);
}
