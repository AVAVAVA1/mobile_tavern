import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

// html:true 让 HTML 直接渲染（表格/图片/样式等都能正常显示），DOMPurify 负责防 XSS。
const md = new MarkdownIt({ html: true, typographer: true, linkify: true });

/**
 * Replace placeholders, supporting both formats:
 * - {{user}} / {{char}} (SillyTavern standard)
 * - <user> / <char> (some 类脑 community cards)
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

/**
 * 对话高亮：把三种引号包裹的文本包成 **...**（暖黄色）。
 * 先保护代码围栏 / 行内代码 / HTML 标签，避免误改其中的引号。
 */
function highlightQuotes(text: string): string {
  const protectedParts: string[] = [];

  const protect = (re: RegExp) =>
    (result: string) =>
      result.replace(re, (m) => {
        protectedParts.push(m);
        return `\u0000${protectedParts.length - 1}\u0000`;
      });

  let result = text;
  result = protect(/```[\s\S]*?```/g)(result);
  result = protect(/`[^`\n]+`/g)(result);
  result = protect(/<[^>]+>/g)(result);

  result = result
    .replace(/"([^"]{1,400}?)"/g, '**"$1"**')
    .replace(/\u201c([^\u201d]{1,400}?)\u201d/g, "**\u201c$1\u201d**")
    .replace(/\u300c([^\u300d]{1,400}?)\u300d/g, "**\u300c$1\u300d**");

  return result.replace(/\u0000(\d+)\u0000/g, (_m, i) => protectedParts[Number(i)]);
}

/** Render markdown（含 HTML）到安全 HTML。 */
export function renderMarkdown(content: string): string {
  const html = md.render(highlightQuotes(content));
  return DOMPurify.sanitize(html);
}
