import type { CharacterCard, CharacterData } from "../parser/characterCard";
import type { Message } from "../prompt/template";
import { loadSessions, saveSessions } from "./persistence";
import { replacePlaceholders } from "../utils/placeholders";

/** V2 Agent 工作流记录（三 Agent 架构） */
export interface AgentWorkflowV2 {
  /** Planning Agent 输出的 Writing Guide */
  writingGuide: string;
  /** Status Manager 输出的状态栏 */
  statusBar: string;
  /** 各阶段注入的 Lorebook 条目数 */
  loreCounts: {
    planner: number;
    writer: number;
    status: number;
  };
}

export interface ChatMessage extends Message {
  id: string;
  timestamp: number;
  /** 消息类型：message=普通对话, status=状态栏输出 */
  messageType?: "message" | "status";
  /** V2 Agent 工作流数据 */
  workflowV2?: AgentWorkflowV2;
}

export interface Session {
  id: string;
  characterCard: CharacterCard;
  messages: ChatMessage[];
  createdAt: number;
  userName: string;
  /** 自定义标题（如果设置则显示此名而非角色卡 name） */
  title: string;
  /** 对旧消息的累积总结 */
  summary: string;
  /** messages 中已总结到的索引（-1 表示未总结过任何消息） */
  lastSummarizedIndex: number;
  /** 从 LLM 上下文中移除的消息 ID（UI 中仍保留） */
  deletedMessageIds: string[];
  /** 最新状态栏（Status Manager Agent 输出） */
  status: string;
  /** 上一轮状态栏（供 Status Manager 参考） */
  previousStatus: string;
}

type Listener = () => void;
let sessions: Session[] = [];
let initialized = false;
let listeners: Listener[] = [];

function notify() {
  listeners.forEach((fn) => fn());
}

export async function initSessions(): Promise<void> {
  if (initialized) return;
  sessions = (await loadSessions<Session[]>([])) ?? [];
  initialized = true;
  notify();
}

export function getSessions(): Session[] {
  return sessions;
}

export function getSession(id: string): Session | undefined {
  return sessions.find((s) => s.id === id);
}

function persist() {
  saveSessions(sessions);
}

export async function createSession(
  card: CharacterCard,
  userName: string = "User"
): Promise<Session> {
  // 导入时预复制 character_book → agent_book，并初始化 per-agent 字段默认值
  if (card.data.character_book && !card.data.agent_book) {
    card.data.agent_book = JSON.parse(JSON.stringify(card.data.character_book));
    const entries = (card.data.agent_book as any).entries;
    if (entries && Array.isArray(entries)) {
      for (const e of entries) {
        if (e.planning_constant === undefined) e.planning_constant = e.constant ?? false;
        if (e.planning_enabled === undefined) e.planning_enabled = e.enabled ?? true;
        if (e.writing_constant === undefined) e.writing_constant = e.constant ?? false;
        if (e.writing_enabled === undefined) e.writing_enabled = e.enabled ?? true;
        if (e.status_constant === undefined) e.status_constant = e.constant ?? false;
        if (e.status_enabled === undefined) e.status_enabled = e.enabled ?? true;
      }
    }
  }
  // 将 first_mes 作为首条 assistant 消息初始化，替换 {{user}}/{{char}}
  const initialMessages: ChatMessage[] = [];
  if (card.data.first_mes) {
    const charName = card.data.name || "Character";
    initialMessages.push({
      id: Date.now().toString(36),
      role: "assistant",
      content: replacePlaceholders(card.data.first_mes, charName, userName),
      timestamp: Date.now(),
    });
  }

  const session: Session = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    characterCard: card,
    messages: initialMessages,
    createdAt: Date.now(),
    userName,
    title: "",
    summary: "",
    lastSummarizedIndex: initialMessages.length > 0 ? 0 : -1,
    deletedMessageIds: [],
    status: "",
    previousStatus: "",
  };
  sessions = [...sessions, session];
  persist();
  notify();
  return session;
}

export function updateSessionMessages(
  sessionId: string,
  messages: ChatMessage[]
): void {
  sessions = sessions.map((s) =>
    s.id === sessionId ? { ...s, messages } : s
  );
  persist();
  notify();
}

export function addMessage(sessionId: string, msg: ChatMessage): void {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;
  session.messages = [...session.messages, msg];
  persist();
  notify();
}

export function updateLastMessage(
  sessionId: string,
  updater: (last: ChatMessage) => ChatMessage
): void {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session || session.messages.length === 0) return;
  const updated = [...session.messages];
  updated[updated.length - 1] = updater(updated[updated.length - 1]);
  session.messages = updated;
  persist();
  notify();
}

export function updateMessageById(
  sessionId: string,
  messageId: string,
  updater: (msg: ChatMessage) => ChatMessage
): void {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;
  const idx = session.messages.findIndex((m) => m.id === messageId);
  if (idx < 0) return;
  session.messages = [
    ...session.messages.slice(0, idx),
    updater(session.messages[idx]),
    ...session.messages.slice(idx + 1),
  ];
  persist();
  notify();
}

export function updateSummary(
  sessionId: string,
  summary: string,
  lastSummarizedIndex: number
): void {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;
  session.summary = summary;
  session.lastSummarizedIndex = lastSummarizedIndex;
  persist();
  notify();
}

export function updateSessionTitle(sessionId: string, title: string): void {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;
  session.title = title;
  persist();
  notify();
}

export function updateCharacterBook(
  sessionId: string,
  characterBook: Record<string, any>
): void {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;
  session.characterCard.data.character_book = characterBook;
  persist();
  notify();
}

export function updateAgentBook(
  sessionId: string,
  agentBook: Record<string, any>
): void {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;
  session.characterCard.data.agent_book = agentBook;
  persist();
  notify();
}

export function updateStatus(
  sessionId: string,
  newStatus: string
): void {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;
  session.previousStatus = session.status;
  session.status = newStatus;
  persist();
  notify();
}

export function removeFromContext(sessionId: string, messageId: string): void {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;
  if (!session.deletedMessageIds.includes(messageId)) {
    session.deletedMessageIds = [...session.deletedMessageIds, messageId];
    persist();
    notify();
  }
}

export function deleteSession(id: string): void {
  sessions = sessions.filter((s) => s.id !== id);
  persist();
  notify();
}

export function subscribe(fn: Listener): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}
