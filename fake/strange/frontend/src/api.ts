import type {
  AppSettings,
  Session,
  ContextView,
  StatusSchema,
  ChatMessage,
  ReplyMeta,
} from "./types";

const BASE = "/api";

/** Extract a readable error message from a failed response body. */
async function extractError(res: Response): Promise<string> {
  let raw = "";
  try {
    raw = await res.text();
  } catch {
    /* ignore */
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.detail === "string") return parsed.detail;
  } catch {
    /* ignore */
  }
  return raw || `HTTP ${res.status}`;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(await extractError(res));
  }
  if (res.status === 204) {
    return undefined as unknown as T;
  }
  return (await res.json()) as T;
}

// ---- Settings ----

export async function getSettings(): Promise<AppSettings> {
  return handleResponse<AppSettings>(await fetch(`${BASE}/settings`));
}

export async function putSettings(
  partial: Partial<AppSettings>
): Promise<AppSettings> {
  return handleResponse<AppSettings>(
    await fetch(`${BASE}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    })
  );
}

// ---- Sessions ----

export async function getSessions(): Promise<Session[]> {
  return handleResponse<Session[]>(await fetch(`${BASE}/sessions`));
}

export async function getSession(id: string): Promise<Session> {
  return handleResponse<Session>(await fetch(`${BASE}/sessions/${id}`));
}

export async function importCard(file: File): Promise<Session> {
  const form = new FormData();
  form.append("file", file);
  return handleResponse<Session>(
    await fetch(`${BASE}/sessions/import`, { method: "POST", body: form })
  );
}

export async function deleteSession(id: string): Promise<void> {
  await handleResponse<void>(
    await fetch(`${BASE}/sessions/${id}`, { method: "DELETE" })
  );
}

export async function patchSession(
  id: string,
  body: {
    title?: string;
    characterBook?: Record<string, any>;
    agentBook?: Record<string, any>;
    statusSchema?: StatusSchema | null;
  }
): Promise<Session> {
  return handleResponse<Session>(
    await fetch(`${BASE}/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

export async function removeFromContext(
  id: string,
  messageId: string
): Promise<Session> {
  return handleResponse<Session>(
    await fetch(`${BASE}/sessions/${id}/context/${messageId}`, {
      method: "DELETE",
    })
  );
}

export async function getContext(id: string): Promise<ContextView> {
  return handleResponse<ContextView>(await fetch(`${BASE}/sessions/${id}/context`));
}

export async function summarize(
  id: string,
  body: { messageIds: string[]; prompt: string }
): Promise<{ summary: string }> {
  return handleResponse<{ summary: string }>(
    await fetch(`${BASE}/sessions/${id}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

export async function applySummary(
  id: string,
  body: { summary: string; messageIds: string[] }
): Promise<Session> {
  return handleResponse<Session>(
    await fetch(`${BASE}/sessions/${id}/summary/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

// ---- Pic Generate ----

export async function testComfyUI(
  url: string
): Promise<{ ok: boolean; message: string }> {
  return handleResponse(
    await fetch(`${BASE}/pic/comfyui/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    })
  );
}

export async function generateComfyUI(): Promise<{
  ok: boolean;
  message: string;
  promptId?: string;
  filename?: string;
  url?: string;
}> {
  return handleResponse(
    await fetch(`${BASE}/pic/comfyui/generate`, { method: "POST" })
  );
}

export async function generateImageForMessage(
  sessionId: string,
  messageId: string
): Promise<ChatMessage> {
  return handleResponse(
    await fetch(`${BASE}/sessions/${sessionId}/messages/${messageId}/image`, {
      method: "POST",
    })
  );
}

export async function listWorkflows(): Promise<string[]> {
  return handleResponse(await fetch(`${BASE}/pic/workflows`));
}

export async function getWorkflow(
  name: string
): Promise<{ name: string; content: string }> {
  return handleResponse(
    await fetch(`${BASE}/pic/workflows/${encodeURIComponent(name)}`)
  );
}

export async function saveWorkflow(
  name: string,
  content: string
): Promise<{ ok: boolean }> {
  return handleResponse(
    await fetch(`${BASE}/pic/workflows/${encodeURIComponent(name)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    })
  );
}

// ---- SSE streaming chat ----

export interface StreamChatCallbacks {
  onDelta?: (content: string) => void;
  onStatusDelta?: (content: string) => void;
  onReplyMeta?: (meta: ReplyMeta) => void;
  onImageGenerating?: () => void;
  onImage?: (message: ChatMessage) => void;
  onSummary?: (summary: string, lastSummarizedIndex: number) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

interface StreamEvent {
  type?: string;
  content?: string;
  message?: string;
  summary?: string;
  lastSummarizedIndex?: number;
  meta?: ReplyMeta;
  image?: ChatMessage;
}

/**
 * Stream a chat turn over SSE (POST + ReadableStream) through the same-origin
 * `/api` proxy. Returns an abortable handle; the caller may instead pass its
 * own `signal` to drive the same abort.
 */
export async function streamChat(
  id: string,
  text: string,
  callbacks: StreamChatCallbacks
): Promise<{ abort: () => void }> {
  const controller = new AbortController();
  const abort = () => controller.abort();

  const onAbort = () => controller.abort();
  if (callbacks.signal) {
    if (callbacks.signal.aborted) controller.abort();
    else callbacks.signal.addEventListener("abort", onAbort);
  }

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload) return;
    let event: StreamEvent;
    try {
      event = JSON.parse(payload) as StreamEvent;
    } catch {
      return;
    }
    switch (event.type) {
      case "delta":
        callbacks.onDelta?.(event.content ?? "");
        break;
      case "status_delta":
        callbacks.onStatusDelta?.(event.content ?? "");
        break;
      case "reply_meta":
        if (event.meta) callbacks.onReplyMeta?.(event.meta);
        break;
      case "image_generating":
        callbacks.onImageGenerating?.();
        break;
      case "image":
        if (event.image) callbacks.onImage?.(event.image);
        break;
      case "summary":
        callbacks.onSummary?.(event.summary ?? "", event.lastSummarizedIndex ?? 0);
        break;
      case "error":
        callbacks.onError?.(new Error(event.message ?? "Stream error"));
        break;
      case "done":
        callbacks.onDone?.();
        break;
      default:
        break;
    }
  };

  try {
    const res = await fetch(`${BASE}/sessions/${id}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const message = await extractError(res);
      callbacks.onError?.(new Error(message || `HTTP ${res.status}`));
      return { abort };
    }

    if (!res.body) {
      callbacks.onError?.(new Error("Empty response body"));
      return { abort };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) handleLine(line);
    }
    if (buffer.trim()) handleLine(buffer);
  } catch (e) {
    const err = e as Error | undefined;
    if (err && (err.name === "AbortError")) throw err;
    callbacks.onError?.(err instanceof Error ? err : new Error(String(e)));
  } finally {
    if (callbacks.signal) callbacks.signal.removeEventListener("abort", onAbort);
  }

  return { abort };
}
