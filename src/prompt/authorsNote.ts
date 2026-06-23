import type { Message } from "./template";

/**
 * 将 Author's Note 以 system 消息形式注入到对话历史中
 *
 * @param history 当前对话历史
 * @param note Author's Note 文本
 * @param depth 注入深度：0 = 末尾，N = 倒数第 N 条消息之前
 */
export function injectAuthorNote(
  history: Message[],
  note: string,
  depth: number
): Message[] {
  if (!note.trim()) return history;

  const result = [...history];
  const insertIdx = Math.max(0, result.length - depth);
  result.splice(insertIdx, 0, {
    role: "system" as const,
    content: `[Author's Note]\n${note}`,
  });
  return result;
}
