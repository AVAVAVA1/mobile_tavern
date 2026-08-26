import { defineStore } from "pinia";
import { ref } from "vue";
import * as api from "../api";
import type { ChatMessage, Session, StatusSchema } from "../types";

export const useSessionsStore = defineStore("sessions", () => {
  const sessions = ref<Session[]>([]);
  const loaded = ref(false);
  const loading = ref(false);

  async function load(): Promise<void> {
    if (loading.value) return;
    loading.value = true;
    try {
      sessions.value = await api.getSessions();
      loaded.value = true;
    } catch (e) {
      console.warn("[sessions] load failed:", e);
    } finally {
      loading.value = false;
    }
  }

  function getById(id: string): Session | undefined {
    return sessions.value.find((s) => s.id === id);
  }

  /** Re-sync a single session from the backend (used after chat/summarize). */
  async function refreshSession(id: string): Promise<Session | undefined> {
    let s: Session;
    try {
      s = await api.getSession(id);
    } catch (e) {
      console.warn("[sessions] refresh failed:", e);
      return getById(id);
    }
    const idx = sessions.value.findIndex((x) => x.id === id);
    if (idx >= 0) {
      sessions.value = sessions.value.map((x) => (x.id === id ? s : x));
    } else {
      sessions.value = [...sessions.value, s];
    }
    return s;
  }

  function sortedSessions(): Session[] {
    return [...sessions.value].sort((a, b) => {
      const aLast =
        a.messages.length > 0
          ? a.messages[a.messages.length - 1].timestamp
          : a.createdAt;
      const bLast =
        b.messages.length > 0
          ? b.messages[b.messages.length - 1].timestamp
          : b.createdAt;
      return bLast - aLast;
    });
  }

  // ---- Optimistic message mutations (during streaming) ----

  function pushMessage(sessionId: string, msg: ChatMessage): void {
    const s = getById(sessionId);
    if (!s) return;
    s.messages = [...s.messages, msg];
  }

  function updateMessage(
    sessionId: string,
    messageId: string,
    updater: (m: ChatMessage) => ChatMessage
  ): void {
    const s = getById(sessionId);
    if (!s) return;
    const idx = s.messages.findIndex((m) => m.id === messageId);
    if (idx < 0) return;
    const updated = [...s.messages];
    updated[idx] = updater(updated[idx]);
    s.messages = updated;
  }

  function appendContent(
    sessionId: string,
    messageId: string,
    delta: string
  ): void {
    updateMessage(sessionId, messageId, (m) => ({
      ...m,
      content: m.content + delta,
    }));
  }

  function insertAfter(sessionId: string, afterId: string, msg: ChatMessage): void {
    const s = getById(sessionId);
    if (!s) return;
    const idx = s.messages.findIndex((m) => m.id === afterId);
    if (idx < 0) {
      s.messages = [...s.messages, msg];
    } else {
      s.messages = [
        ...s.messages.slice(0, idx + 1),
        msg,
        ...s.messages.slice(idx + 1),
      ];
    }
  }

  // ---- Session CRUD (delegates to backend, keeps local state fresh) ----

  async function importCard(file: File): Promise<Session> {
    const s = await api.importCard(file);
    sessions.value = [...sessions.value, s];
    return s;
  }

  async function removeSession(id: string): Promise<void> {
    await api.deleteSession(id);
    sessions.value = sessions.value.filter((s) => s.id !== id);
  }

  async function patchTitle(id: string, title: string): Promise<void> {
    const s = await api.patchSession(id, { title });
    const idx = sessions.value.findIndex((x) => x.id === id);
    if (idx >= 0) sessions.value = sessions.value.map((x) => (x.id === id ? s : x));
  }

  async function patchCharacterBook(
    id: string,
    characterBook: Record<string, any>
  ): Promise<void> {
    const s = await api.patchSession(id, { characterBook });
    const idx = sessions.value.findIndex((x) => x.id === id);
    if (idx >= 0) sessions.value = sessions.value.map((x) => (x.id === id ? s : x));
  }

  async function patchAgentBook(
    id: string,
    agentBook: Record<string, any>
  ): Promise<void> {
    const s = await api.patchSession(id, { agentBook });
    const idx = sessions.value.findIndex((x) => x.id === id);
    if (idx >= 0) sessions.value = sessions.value.map((x) => (x.id === id ? s : x));
  }

  async function patchStatusSchema(
    id: string,
    statusSchema: StatusSchema
  ): Promise<void> {
    const s = await api.patchSession(id, { statusSchema });
    const idx = sessions.value.findIndex((x) => x.id === id);
    if (idx >= 0) sessions.value = sessions.value.map((x) => (x.id === id ? s : x));
  }

  async function removeFromContext(id: string, messageId: string): Promise<void> {
    const s = await api.removeFromContext(id, messageId);
    const idx = sessions.value.findIndex((x) => x.id === id);
    if (idx >= 0) sessions.value = sessions.value.map((x) => (x.id === id ? s : x));
  }

  return {
    sessions,
    loaded,
    loading,
    load,
    getById,
    refreshSession,
    sortedSessions,
    pushMessage,
    updateMessage,
    appendContent,
    insertAfter,
    importCard,
    removeSession,
    patchTitle,
    patchCharacterBook,
    patchAgentBook,
    patchStatusSchema,
    removeFromContext,
  };
});
