import React from "react";
import { StyleSheet, View } from "react-native";
import Markdown, { MarkdownIt } from "react-native-markdown-display";

interface Props {
  content: string;
  isUser: boolean;
}

// 关闭 html 解析，避免 html_block unknown rule 警告。
// 预处理时将常见 HTML 标签转为纯文本或等价的 Markdown。
const md = MarkdownIt({ typographer: true, html: false });

/**
 * 预处理原始内容：将 HTML 标签转为 Markdown 能处理的形式
 * - <br> / <br/> → 换行
 * - <hr> / <hr/> → ---
 * - <b>/<strong> → **text**
 * - <i>/<em> → *text*
 * - <table>/<tr>/<td>/<th> → Markdown 表格
 * - 其余标签去掉标签保留内部文本
 */
function preprocessHTML(text: string): string {
  let result = text;

  // <br>, <br/>, <br />
  result = result.replace(/<br\s*\/?>/gi, "\n");

  // <hr>, <hr/>, <hr />
  result = result.replace(/<hr\s*\/?>/gi, "\n---\n");

  // <b>text</b>, <strong>text</strong>
  result = result.replace(/<\/?b>/gi, "**");
  result = result.replace(/<\/?strong>/gi, "**");

  // <i>text</i>, <em>text</em>
  result = result.replace(/<\/?i>/gi, "*");
  result = result.replace(/<\/?em>/gi, "*");

  // <u>text</u> → 保留文本，下划线无法在 markdown 中表达
  result = result.replace(/<\/?u>/gi, "");

  // <s>, <del>, <strike> → ~~text~~
  result = result.replace(/<\/?s>/gi, "~~");
  result = result.replace(/<\/?del>/gi, "~~");
  result = result.replace(/<\/?strike>/gi, "~~");

  // HTML 表格 → Markdown 表格
  result = convertHTMLTables(result);

  // <p> → 换行
  result = result.replace(/<p[^>]*>/gi, "\n");
  result = result.replace(/<\/p>/gi, "\n");

  // <code>text</code>
  result = result.replace(/<code>/gi, "`");
  result = result.replace(/<\/code>/gi, "`");

  // <pre>text</pre>
  result = result.replace(/<pre[^>]*>/gi, "\n```\n");
  result = result.replace(/<\/pre>/gi, "\n```\n");

  // <blockquote> → >
  result = result.replace(/<blockquote[^>]*>/gi, "\n> ");
  result = result.replace(/<\/blockquote>/gi, "\n");

  // <li> → -
  result = result.replace(/<li[^>]*>/gi, "\n- ");
  result = result.replace(/<\/li>/gi, "");

  // <ul>, <ol>, <div>, <span>, <a> 等 → 去掉标签保留文本
  result = result.replace(/<\/?(ul|ol|div|span|a|h[1-6]|font)[^>]*>/gi, "");

  // 对话高亮: 引号包裹的文本 → strong 样式（暖黄 #f0c040）
  // 三种引号分别处理，非贪婪匹配，保证每对引号独立高亮
  result = result.replace(/"([^"]{1,400}?)"/g, '**"$1"**');
  result = result.replace(/\u201c([^\u201d]{1,400}?)\u201d/g, '**\u201c$1\u201d**');
  result = result.replace(/\u300c([^\u300d]{1,400}?)\u300d/g, '**\u300c$1\u300d**');

  // 清理多余的连续换行
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

/**
 * 将简单 HTML 表格转为 Markdown 表格
 */
function convertHTMLTables(text: string): string {
  return text.replace(
    /<table[^>]*>([\s\S]*?)<\/table>/gi,
    (_match: string, inner: string) => {
      const rows: string[][] = [];
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch: RegExpExecArray | null;

      while ((rowMatch = rowRegex.exec(inner)) !== null) {
        const cells: string[] = [];
        const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
        let cellMatch: RegExpExecArray | null;

        while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
          // 去掉单元格内嵌套标签
          const cellText = cellMatch[1].replace(/<[^>]+>/g, "").trim();
          cells.push(cellText);
        }
        if (cells.length > 0) rows.push(cells);
      }

      if (rows.length === 0) return "";

      const colCount = Math.max(...rows.map((r) => r.length));

      // 填充不足的列
      for (const row of rows) {
        while (row.length < colCount) row.push("");
      }

      const headerSep =
        "| " +
        rows[0].map(() => "---").join(" | ") +
        " |";

      const body = rows
        .map((row) => "| " + row.join(" | ") + " |")
        .join("\n");

      return "\n" + [rows[0] ? body.split("\n")[0] : "", headerSep, ...(rows.length > 1 ? body.split("\n").slice(1) : [])].join("\n") + "\n";
    }
  );
}

export default function MarkdownRenderer({ content, isUser }: Props) {
  const processed = preprocessHTML(content);

  return (
    <View style={isUser ? styles.userContainer : styles.assistantContainer}>
      <Markdown
        markdownit={md}
        style={
          isUser
            ? userMarkdownStyles
            : assistantMarkdownStyles
        }
      >
        {processed}
      </Markdown>
    </View>
  );
}

const styles = StyleSheet.create({
  userContainer: {},
  assistantContainer: {},
});

// 用户消息的 markdown 样式（白字）
const userMarkdownStyles = StyleSheet.create({
  body: { color: "#fff", fontSize: 15, lineHeight: 21 },
  code_inline: {
    backgroundColor: "rgba(255,255,255,0.15)",
    color: "#fff",
    fontSize: 13,
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  code_block: {
    backgroundColor: "rgba(0,0,0,0.3)",
    color: "#fff",
    fontSize: 13,
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
  },
  fence: {
    backgroundColor: "rgba(0,0,0,0.3)",
    color: "#fff",
    fontSize: 13,
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
  },
  link: { color: "#ffccd5" },
  strong: { fontWeight: "700" },
  em: { fontStyle: "italic" },
  s: { textDecorationLine: "line-through" },
  blockquote: {
    borderLeftColor: "rgba(255,255,255,0.3)",
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginVertical: 4,
  },
  table: { borderColor: "rgba(255,255,255,0.3)", borderWidth: 1, marginVertical: 8 },
  thead: {},
  tbody: {},
  th: {
    borderColor: "rgba(255,255,255,0.3)",
    borderWidth: 1,
    padding: 6,
    fontWeight: "700",
  },
  td: {
    borderColor: "rgba(255,255,255,0.3)",
    borderWidth: 1,
    padding: 6,
  },
  tr: {},
  heading1: { color: "#fff", fontSize: 20, fontWeight: "700", marginVertical: 6 },
  heading2: { color: "#fff", fontSize: 18, fontWeight: "700", marginVertical: 5 },
  heading3: { color: "#fff", fontSize: 16, fontWeight: "700", marginVertical: 4 },
  hr: { backgroundColor: "rgba(255,255,255,0.3)", height: 1, marginVertical: 8 },
});

// assistant 消息的 markdown 样式
const assistantMarkdownStyles = StyleSheet.create({
  body: { color: "#e0e0e0", fontSize: 15, lineHeight: 21 },
  code_inline: {
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#e0e0e0",
    fontSize: 13,
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  code_block: {
    backgroundColor: "rgba(0,0,0,0.25)",
    color: "#e0e0e0",
    fontSize: 13,
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
  },
  fence: {
    backgroundColor: "rgba(0,0,0,0.25)",
    color: "#e0e0e0",
    fontSize: 13,
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
  },
  link: { color: "#ffa0af" },
  strong: { color: "#f0c040" },
  em: { fontStyle: "italic" },
  s: { textDecorationLine: "line-through" },
  blockquote: {
    borderLeftColor: "rgba(255,255,255,0.25)",
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginVertical: 4,
  },
  table: { borderColor: "rgba(255,255,255,0.2)", borderWidth: 1, marginVertical: 8 },
  thead: {},
  tbody: {},
  th: {
    borderColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    padding: 6,
    fontWeight: "700",
  },
  td: {
    borderColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    padding: 6,
  },
  tr: {},
  heading1: { color: "#e0e0e0", fontSize: 20, fontWeight: "700", marginVertical: 6 },
  heading2: { color: "#e0e0e0", fontSize: 18, fontWeight: "700", marginVertical: 5 },
  heading3: { color: "#e0e0e0", fontSize: 16, fontWeight: "700", marginVertical: 4 },
  hr: { backgroundColor: "rgba(255,255,255,0.2)", height: 1, marginVertical: 8 },
});
