// ---- App settings ----

export interface AppSettings {
  apiKey: string;
  model: string;
  baseUrl: string;
  summarizeThreshold: number;
  userName: string;
  /** Author's Note text, empty = disabled */
  authorNoteText: string;
  /** Author's Note injection depth (N-th from the end), default 4 */
  authorNoteDepth: number;
  /** Story String template, empty = default hard-coded template */
  storyStringTemplate: string;
  /** Whether auto-summarize is enabled */
  autoSummarize: boolean;
  /** Custom system prompt prepended before the character prompt */
  customSystemPrompt: string;
  /** 状态栏开关 */
  statusBarEnabled: boolean;
  /** 是否请求 LLM 开启思考模式（thinking），不支持该参数的模型可关掉 */
  enableThinking: boolean;
  /** 思考强度：low / medium / high */
  reasoningEffort: string;
  /** 生图配置 */
  picGenerate?: PicGenerateSettings;
}

// ---- 生图 ----

export interface PicGenerateSettings {
  source: string;
  sources: Record<string, Record<string, any>>;
}

// ---- Chat message ----

export interface ChatMessage {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
  /** message=normal chat, status=status bar output, image=生成的图片 */
  messageType?: "message" | "status" | "image";
  /** 回复元数据表（调试用，不计入历史） */
  replyMeta?: ReplyMeta | null;
  /** 图片消息的 url */
  imageUrl?: string;
}

/** AI 回复附带的元数据表（可扩展） */
export interface ReplyMeta {
  generateImage: boolean;
  imageReason: string;
}

// ---- Character card ----

export interface CharacterData {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes?: string | null;
  system_prompt?: string | null;
  post_history_instructions?: string | null;
  alternate_greetings?: string[] | null;
  character_version?: string | null;
  tags?: string[] | null;
  creator?: string | null;
  extensions?: Record<string, unknown> | null;
  /** World/lore book (top-level `data` field, 类脑 community standard) */
  character_book?: Record<string, any> | null;
  /** Agent-mode independent book (copied from character_book) */
  agent_book?: Record<string, any> | null;
  /** 卡分析结果（导入时 LLM 提取的状态栏 schema 等） */
  card_analysis?: Record<string, any> | null;
  create_date?: string | null;
  avatar?: string | null;
  world_description?: string | null;
}

export interface ParseMeta {
  spec: string;
  chunk: string;
  format: string;
}

export interface CharacterCard {
  spec: string;
  spec_version: string;
  data: CharacterData;
  parse_meta?: ParseMeta;
}

// ---- Status bar schema ----

export interface StatusSchemaField {
  key: string;
  label: string;
  type: "string" | "list" | "enum" | "number";
  description?: string;
}

export interface StatusSchema {
  specified?: boolean;
  fields: StatusSchemaField[];
}

// ---- Session ----

export interface Session {
  id: string;
  characterCard: CharacterCard;
  messages: ChatMessage[];
  createdAt: number;
  userName: string;
  /** Custom title (if set, shown instead of character name) */
  title: string;
  /** Cumulative summary of older messages */
  summary: string;
  /** Index in `messages` up to which summarization has occurred (-1 = none) */
  lastSummarizedIndex: number;
  /** Message ids removed from the LLM context (still kept in the UI) */
  deletedMessageIds: string[];
  /** Latest status bar (Status Manager Agent output) */
  status: string;
  /** Previous status bar */
  previousStatus: string;
  /** 结构化状态数据（JSON，供字段级继承） */
  statusData?: Record<string, any> | null;
  /** 用户自定义的状态栏 schema（覆盖卡提取/默认） */
  statusSchema?: StatusSchema | null;
}

// ---- Context view (HistoryManager) ----

export interface ContextMessage {
  role: "system" | "user" | "assistant";
  content: string;
  id?: string;
}

export interface ContextView {
  mode: "normal" | "agent";
  chatMessages: ContextMessage[];
  systemMessages: ContextMessage[];
  plannerSystem: ContextMessage[];
  writerSystem: ContextMessage[];
  statusSystem: ContextMessage[];
  injectedEntries: {
    planner: string[];
    writer: string[];
    status: string[];
  };
}

// ---- Lorebook entry (loose, mirrors original `any`) ----

export interface LoreBookEntry {
  keys?: string[];
  content?: string;
  comment?: string;
  constant?: boolean;
  enabled?: boolean;
  position?: WorldInfoPosition;
  insertion_order?: number;
  order?: number;
  depth?: number;
  scanDepth?: number | null;
  probability?: number;
  useProbability?: boolean;
  useRegex?: boolean;
  scope?: "character" | "global";
  case_sensitive?: boolean;
  selective?: boolean;
  secondary_keys?: string[];
  // per-agent fields (agent_book)
  planning_constant?: boolean;
  planning_enabled?: boolean;
  writing_constant?: boolean;
  writing_enabled?: boolean;
  status_constant?: boolean;
  status_enabled?: boolean;
  [key: string]: any;
}

// ---- 世界书增强（RP-Hub）----

export type WorldInfoPosition =
  | "system_top"
  | "global_note"
  | "before_char"
  | "after_char"
  | "at_depth"
  | "user_top"
  | "assistant_top";

export interface WorldInfoEntry {
  comment: string;
  content: string;
  enabled: boolean;
  scope: "character" | "global";
  keys: string[];
  useRegex: boolean;
  constant: boolean;
  position: WorldInfoPosition;
  order: number;
  depth: number;
  scanDepth: number | null;
  probability: number;
  useProbability: boolean;
}

// ---- 预设（带 role）----

export interface Preset {
  name: string;
  content: string;
  enabled: boolean;
  role: "system" | "user" | "assistant";
}

// ---- 正则脚本 ----

export interface RegexScript {
  name: string;
  regex: string;
  flags: string;
  replacement: string;
  placement: number[];
  markdownOnly: boolean;
  promptOnly: boolean;
  runOnEdit: boolean;
  minDepth: number | null;
  maxDepth: number | null;
  scope: "global" | "character";
  enabled: boolean;
}
