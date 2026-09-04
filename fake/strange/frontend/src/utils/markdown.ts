import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

// html:true 让 HTML 直接渲染；breaks:true 让换行转为 <br>（对齐 RP-Hub 的 marked 配置）。
const md = new MarkdownIt({ html: true, typographer: true, linkify: true, breaks: true });

// 富 HTML 渲染白名单（对齐 RP-Hub：允许内联 style/svg/按钮/交互 + iframe 承载完整 HTML 文档）。
const PURIFY_CONFIG: Record<string, any> = {
  ADD_TAGS: [
    "details", "summary", "iframe", "svg", "path", "g", "circle", "rect", "defs",
    "linearGradient", "stop", "style", "button", "input", "textarea", "select", "option", "label",
  ],
  ADD_ATTR: [
    "style", "open", "srcdoc", "sandbox", "scrolling", "frameborder", "class", "id",
    "viewBox", "fill", "stroke", "stroke-width", "d", "stroke-linecap", "stroke-linejoin",
    "x1", "y1", "x2", "y2", "offset", "stop-color", "stop-opacity", "width", "height",
    "onclick", "type", "value", "checked", "placeholder", "data-slash",
  ],
};

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

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 当前主题（iframe srcdoc 是独立文档，不能继承父级 CSS 变量，需在渲染时取一次）。 */
function currentTheme(): "light" | "dark" {
  if (typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light") {
    return "light";
  }
  return "dark";
}

/** 把一段原始 HTML 包成沙箱 iframe（内容自适应高度、跟随主题、向父窗口上报真实高度）。 */
function buildHtmlFrame(rawHtml: string): string {
  const light = currentTheme() === "light";
  const bodyColor = light ? "#1f2430" : "#e0e0e0";
  const frameBg = light ? "#ffffff" : "#1a1a2e";
  const frameBorder = light ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.14)";
  const resizeScript =
    "<script>(function(){function r(){var h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight,document.body.offsetHeight,document.documentElement.offsetHeight);parent.postMessage({type:'html-frame-resize',height:h},'*');}window.addEventListener('load',r);setTimeout(r,60);setTimeout(r,350);if(window.ResizeObserver){try{new ResizeObserver(r).observe(document.body);}catch(e){}}})();</script>";
  const doc =
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<style>*{box-sizing:border-box}html,body{margin:0;padding:0;width:100%;background:transparent}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:${bodyColor}}</style>` +
    `</head><body>${rawHtml}${resizeScript}</body></html>`;
  return (
    '<iframe class="html-frame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" ' +
    'scrolling="no" ' +
    `srcdoc="${escapeAttr(doc)}" ` +
    `style="width:100%;display:block;border:1px solid ${frameBorder};border-radius:8px;background:${frameBg};"></iframe>`
  );
}

/** 把渲染结果里的 HTML 代码块（```html/```xml 或形似 HTML）转成 iframe。 */
function convertHtmlCodeBlocks(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    let modified = false;
    doc.querySelectorAll("pre code").forEach((block) => {
      const raw = block.textContent || "";
      const isHtml =
        /language-(html|xml)/i.test(block.className || "") ||
        /^\s*<(!doctype|html|head|body|div|span|style|script|table|img)/i.test(raw);
      if (!isHtml) return;
      const pre = block.parentElement;
      if (!pre || !pre.parentNode) return;
      const wrapper = document.createElement("div");
      wrapper.innerHTML = buildHtmlFrame(raw);
      const frame = wrapper.firstElementChild;
      if (frame) {
        pre.parentNode.replaceChild(frame, pre);
        modified = true;
      }
    });
    return modified ? doc.body.innerHTML : html;
  } catch {
    return html;
  }
}

/** Render markdown（含富 HTML）到安全 HTML。 */
export function renderMarkdown(content: string): string {
  if (!content) return "";
  let processed = content;

  const trimmed = processed.trim();

  // 1. 完整 HTML 文档 → 提取 HTML 进 iframe，前后文仍走 markdown
  const docMatch = trimmed.match(/(<!doctype html>|<html\b[^>]*>)/i);
  if (docMatch && !trimmed.includes("```")) {
    const start = docMatch.index ?? 0;
    const closeIdx = trimmed.toLowerCase().lastIndexOf("</html>");
    let htmlContent: string;
    let preText: string;
    let postText: string;
    if (closeIdx !== -1 && closeIdx > start) {
      htmlContent = trimmed.substring(start, closeIdx + "</html>".length);
      preText = trimmed.substring(0, start);
      postText = trimmed.substring(closeIdx + "</html>".length);
    } else {
      htmlContent = trimmed.substring(start);
      preText = trimmed.substring(0, start);
      postText = "";
    }
    let out = "";
    if (preText.trim()) out += sanitizeHtml(md.render(highlightQuotes(preText)));
    out += buildHtmlFrame(htmlContent);
    if (postText.trim()) out += sanitizeHtml(md.render(highlightQuotes(postText)));
    return out;
  }

  // 2. 块级 HTML 开头 → 直接消毒返回（跳过 markdown，避免破坏布局）
  if (/^\s*<(div|table|section|article|aside|header|footer|style|script)/i.test(trimmed) && !trimmed.includes("```")) {
    return sanitizeHtml(processed);
  }

  // 3. 混合内容里剥离结构性标签（html/head/body），避免浏览器解析问题
  if (/<html|<!doctype/i.test(processed)) {
    processed = processed
      .replace(/<!DOCTYPE html>/gi, "")
      .replace(/<\/?html[^>]*>/gi, "")
      .replace(/<\/?head[^>]*>/gi, "")
      .replace(/<\/?body[^>]*>/gi, "");
  }

  let html = sanitizeHtml(md.render(highlightQuotes(processed)));

  // 4. HTML 代码块 → iframe
  html = convertHtmlCodeBlocks(html);
  return html;
}
