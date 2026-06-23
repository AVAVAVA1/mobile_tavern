export interface APIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamingChoice {
  delta: {
    role?: string;
    content?: string;
    tool_calls?: ToolCallDelta[];
  };
  index: number;
  finish_reason: string | null;
}

export interface ToolCallDelta {
  index: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface APITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface NonStreamingChoice {
  message: {
    role: string;
    content: string | null;
    tool_calls?: ToolCall[];
  };
  index: number;
  finish_reason: string;
}

export interface NonStreamingResponse {
  choices: NonStreamingChoice[];
}

export interface StreamChunk {
  choices: StreamingChoice[];
}
