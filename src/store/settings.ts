import { loadSettings, saveSettings } from "./persistence";

export interface AppSettings {
  apiKey: string;
  model: string;
  baseUrl: string;
  summarizeThreshold: number;
  userName: string;
  /** Author's Note 文本，空 = 禁用 */
  authorNoteText: string;
  /** Author's Note 注入深度（倒数第 N 条），默认 4 */
  authorNoteDepth: number;
  /** Story String 模板，空 = 使用默认硬编码模板 */
  storyStringTemplate: string;
  /** 是否启用自动总结（关闭后仅手动触发） */
  autoSummarize: boolean;
  /** 用户自定义 system prompt（添加到角色 prompt 之前） */
  customSystemPrompt: string;
  /** Agent Beta：采用渐进式上下文策略，LoreBook → Skills */
  agentMode: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  model: "gpt-3.5-turbo",
  baseUrl: "https://api.openai.com/v1",
  summarizeThreshold: 30,
  userName: "User",
  authorNoteText: "",
  authorNoteDepth: 4,
  storyStringTemplate: "",
  autoSummarize: true,
  customSystemPrompt: "",
  agentMode: false,
};

let settings: AppSettings = { ...DEFAULT_SETTINGS };
let initialized = false;
type Listener = () => void;
let listeners: Listener[] = [];

function notify() {
  listeners.forEach((fn) => fn());
}

export async function initSettings(): Promise<void> {
  if (initialized) return;
  settings = await loadSettings(DEFAULT_SETTINGS);
  initialized = true;
  notify();
}

export function getSettings(): AppSettings {
  return { ...settings };
}

export async function updateSettings(
  partial: Partial<AppSettings>
): Promise<void> {
  settings = { ...settings, ...partial };
  await saveSettings(settings);
  notify();
}

export function subscribe(fn: Listener): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}
