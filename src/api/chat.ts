import type { AppSettings } from "../store/settings";
import type {
  APIMessage,
  APITool,
  NonStreamingResponse,
  StreamChunk,
} from "./types";

/**
 * OpenAI 兼容流式聊天请求
 */
export async function* streamChat(
  settings: AppSettings,
  messages: APIMessage[],
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const { baseUrl, apiKey, model } = settings;
  const cleanKey = apiKey.replace(/[^\x20-\x7E]/g, "").trim();

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cleanKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API error ${response.status}: ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;

      const data = trimmed.slice("data: ".length);
      if (data === "[DONE]") return;

      try {
        const chunk: StreamChunk = JSON.parse(data);
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // 忽略解析失败的行
      }
    }
  }
}

/**
 * 非流式聊天请求，支持 Function Calling / Tool Use
 * 返回完整的 API 响应（含 tool_calls）
 */
export async function callChatNonStreaming(
  settings: AppSettings,
  messages: APIMessage[],
  options?: {
    tools?: APITool[];
    toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
    signal?: AbortSignal;
  }
): Promise<NonStreamingResponse> {
  const { baseUrl, apiKey, model } = settings;
  const cleanKey = apiKey.replace(/[^\x20-\x7E]/g, "").trim();

  const body: Record<string, any> = {
    model,
    messages,
    stream: false,
  };

  if (options?.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice ?? "auto";
  }

  console.log("[API] callChatNonStreaming", {
    model,
    msgsCount: messages.length,
    hasTools: !!options?.tools,
    toolChoice: body.tool_choice,
    lastMsg: messages[messages.length - 1]?.content?.slice(0, 80),
  });

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cleanKey}`,
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API error ${response.status}: ${errText}`);
  }

  const json: NonStreamingResponse = await response.json();
  console.log("[API] callChatNonStreaming response", {
    finishReason: json.choices?.[0]?.finish_reason,
    hasContent: !!json.choices?.[0]?.message?.content,
    contentPreview: json.choices?.[0]?.message?.content?.slice(0, 100),
    hasToolCalls: !!json.choices?.[0]?.message?.tool_calls,
    toolCallCount: json.choices?.[0]?.message?.tool_calls?.length,
    toolCallName: json.choices?.[0]?.message?.tool_calls?.[0]?.function?.name,
    toolArgs: json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments?.slice(0, 200),
    rawChoice: JSON.stringify(json.choices?.[0]).slice(0, 300),
  });
  return json;
}
