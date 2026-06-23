import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  getSession,
  addMessage,
  updateLastMessage,
  updateMessageById,
  updateSummary,
  updateStatus,
  subscribe,
  type ChatMessage,
} from "../store/sessions";
import { getSettings } from "../store/settings";
import { streamChat, callChatNonStreaming } from "../api/chat";
import { buildConversationContext } from "../prompt/template";
import { buildPlannerMessages } from "../agent/planner";
import { buildWriterMessages } from "../agent/writer";
import { buildStatusManagerMessages } from "../agent/statusManager";
import { getLoreStats } from "../agent/loreRouter";
import { summarizeHistory, DEFAULT_SUMMARIZE_PROMPT } from "../prompt/summarizer";
import MessageBubble from "./MessageBubble";
import HistoryManager from "./HistoryManager";

interface Props {
  sessionId: string;
  onBack: () => void;
}

export default function ChatScreen({ sessionId, onBack }: Props) {
  const session = getSession(sessionId);
  const [messages, setMessages] = useState<ChatMessage[]>(
    session?.messages ?? []
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const isNearBottomRef = useRef(true);
  const initialScrollDone = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return subscribe(() => {
      const s = getSession(sessionId);
      if (s) setMessages(s.messages);
    });
  }, [sessionId]);

  // 进入对话时滚动到底部
  useEffect(() => {
    if (!initialScrollDone.current && messages.length > 0) {
      initialScrollDone.current = true;
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
    }
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (loading) return;

    const settings = getSettings();
    const currentSession = getSession(sessionId);

    if (!settings.apiKey) {
      Alert.alert("API Key Required", "Go to Settings to configure your API key.");
      return;
    }

    if (!currentSession) return;

    setInput("");

    const userMsg: ChatMessage = {
      id: Date.now().toString(36),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    addMessage(sessionId, userMsg);

    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(36),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };
    addMessage(sessionId, assistantMsg);

    setLoading(true);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const card = currentSession.characterCard;
      const userName = currentSession.userName || "User";
      const threshold = settings.summarizeThreshold || 30;

      const fullMessages = getSession(sessionId)!.messages;

      // ================================================================
      // Agent 模式：三 Agent 循环（规划 → 写作 → 状态管理）
      // ================================================================
      if (settings.agentMode) {
        // 过滤掉 status 类型消息，只保留真实对话
        const chatHistory = fullMessages
          .filter((m) => m.id !== assistantMsg.id && m.messageType !== "status")
          .map((m) => ({ role: m.role, content: m.content, id: m.id } as any));

        // Planner 只需未总结的消息（summary 已覆盖旧消息）
        const lastIdx = currentSession.lastSummarizedIndex;
        const unsummarizedHistory = chatHistory.filter((m, i) => i > lastIdx);

        // ---- 1. Planning Agent (非流式) ----
        console.log("[Agent] Planner starting...");
        const plannerMessages = buildPlannerMessages(
          card, unsummarizedHistory, userName,
          currentSession.summary || "",
          currentSession.status || "",
          settings
        );

        let writingGuide = "";
        try {
          const guideResp = await callChatNonStreaming(settings, plannerMessages, {
            signal: abortController.signal,
          });
          writingGuide = guideResp.choices?.[0]?.message?.content || "";
          console.log("[Agent] Planner done, guide length:", writingGuide.length);
        } catch (e: any) {
          if (e?.name === "AbortError") throw e;
          console.warn("[Agent] Planner FAILED:", e.message);
          writingGuide = "(Planning failed — generating directly)";
        }

        // ---- 2. Writing Agent (流式) ----
        const writerRecentText = chatHistory.map((m) => m.content).join("\n");
        const lastUserMsg = chatHistory.filter((m) => m.role === "user").pop()?.content;
        const writerMessages = buildWriterMessages(card, userName, writingGuide, settings, writerRecentText, lastUserMsg);
        console.log("[Agent] Writer starting, msgs:", writerMessages.length);

        for await (const chunk of streamChat(settings, writerMessages, abortController.signal)) {
          updateLastMessage(sessionId, (last) => ({
            ...last,
            content: last.content + chunk,
          }));
        }
        console.log("[Agent] Writer done");

        // ---- 3. Status Manager (流式，写作完成后) ----
        const finalAssistantContent = getSession(sessionId)!.messages
          .find((m) => m.id === assistantMsg.id)?.content || "";

        console.log("[Agent] Status Manager starting...");
        const statusMessages = buildStatusManagerMessages(
          card,
          currentSession.status || "",
          // 只取最新正文的最后 2000 字符
          finalAssistantContent.slice(-2000),
          settings
        );

        const statusMsg: ChatMessage = {
          id: (Date.now() + 2).toString(36),
          role: "system",
          content: "",
          timestamp: Date.now(),
          messageType: "status",
        };
        addMessage(sessionId, statusMsg);

        for await (const chunk of streamChat(settings, statusMessages, abortController.signal)) {
          updateLastMessage(sessionId, (last) => ({
            ...last,
            content: last.content + chunk,
          }));
        }

        // 保存状态栏到 session
        const finalStatus = getSession(sessionId)!.messages
          .find((m) => m.id === statusMsg.id)?.content || "";
        updateStatus(sessionId, finalStatus);
        console.log("[Agent] Status Manager done, status length:", finalStatus.length);

        // 更新 assistant 消息的 workflow 数据
        const loreCounts = {
          planner: getLoreStats(card, "planner").enabled,
          writer: getLoreStats(card, "writer").enabled,
          status: getLoreStats(card, "status").enabled,
        };
        updateMessageById(sessionId, assistantMsg.id, (msg) => ({
          ...msg,
          workflowV2: {
            writingGuide,
            statusBar: finalStatus,
            loreCounts,
          },
        }));
      } else {
        // ================================================================
        // 正常模式
        // ================================================================
        const history = fullMessages
          .filter((m) => m.id !== assistantMsg.id)
          .map((m) => ({ role: m.role, content: m.content, id: m.id } as any));

        const context = buildConversationContext(
          card, history, userName,
          currentSession.summary || undefined,
          currentSession.lastSummarizedIndex,
          settings,
          currentSession.deletedMessageIds
        );

        for await (const chunk of streamChat(settings, context, abortController.signal)) {
          updateLastMessage(sessionId, (last) => ({
            ...last,
            content: last.content + chunk,
          }));
        }
      }

      // 回复完成后再检查是否需要总结（只统计 message 类型，排除 status）
      const hasFirstMes = !!card.data.first_mes;
      const updatedMessages = getSession(sessionId)!.messages;
      const realMessages = updatedMessages.filter((m) => m.messageType !== "status");
      const chatOnly = hasFirstMes ? realMessages.slice(1) : realMessages;
      const messageCount = chatOnly.length;

      if (
        threshold > 0 &&
        settings.autoSummarize !== false &&
        messageCount > 0 &&
        messageCount % threshold === 0
      ) {
        try {
          // 触发总结前确保状态栏已是最新
          const lastIdx = currentSession.lastSummarizedIndex;
          const newMsgs = updatedMessages
            .filter((m) => {
              const msgIdx = updatedMessages.indexOf(m);
              return msgIdx > lastIdx && m.messageType !== "status";
            })
            .map((m) => ({ role: m.role, content: m.content }));

          if (newMsgs.length > 0) {
            const newSummary = await summarizeHistory(
              settings,
              currentSession.summary,
              newMsgs,
              DEFAULT_SUMMARIZE_PROMPT
            );
            if (newSummary) {
              const currentLastIdx = updatedMessages.length - 1;
              updateSummary(sessionId, newSummary, currentLastIdx);
            }
          }
        } catch {
          // 总结失败不影响主流程
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        // 用户主动停止，保留已有内容
      } else {
        updateLastMessage(sessionId, (last) => ({
          ...last,
          content: last.content || `Error: ${err.message}`,
        }));
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [input, loading, sessionId]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  if (!session) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Session not found</Text>
      </View>
    );
  }

  const displayTitle = session.title || session.characterCard.data.name || "Character";
  const charName = session.characterCard.data.name || "Character";
  const userName = session.userName || "User";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {displayTitle}
        </Text>
        <TouchableOpacity
          style={styles.summaryBtn}
          onPress={() => setHistoryVisible(true)}
        >
          <Text style={styles.summaryBtnText}>Hist</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble message={item} charName={charName} userName={userName} />
        )}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        onScroll={({ nativeEvent }) => {
          const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
          const distFromBottom =
            contentSize.height - contentOffset.y - layoutMeasurement.height;
          const nearBottom = distFromBottom < 150;
          isNearBottomRef.current = nearBottom;
          setShowScrollBtn(distFromBottom > 500);
        }}
        onContentSizeChange={() => {
          if (isNearBottomRef.current) {
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
          }
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Start chatting with {displayTitle}!
          </Text>
        }
      />

      {/* 回到底部按钮 */}
      {showScrollBtn && (
        <TouchableOpacity
          style={styles.scrollToBottomBtn}
          onPress={() => {
            flatListRef.current?.scrollToEnd({ animated: true });
            setShowScrollBtn(false);
          }}
        >
          <Text style={styles.scrollToBottomText}>↓</Text>
        </TouchableOpacity>
      )}

      {/* Loading */}
      {loading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator color="#e94560" size="small" />
          <Text style={styles.loadingText}>{displayTitle} is typing...</Text>
        </View>
      )}

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor="#666"
            multiline
            maxLength={4000}
            editable={!loading}
          />
          {loading ? (
            <TouchableOpacity style={styles.stopBtn} onPress={stop}>
              <Text style={styles.stopBtnText}>Stop</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.sendBtn} onPress={send}>
              <Text style={styles.sendBtnText}>Send</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Manual Summary Modal */}
      <HistoryManager
        visible={historyVisible}
        sessionId={sessionId}
        onClose={() => setHistoryVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e" },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 54,
    paddingBottom: 12,
    backgroundColor: "#16213e",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a4a",
  },
  backBtn: {},
  backBtnText: { color: "#a0a0b8", fontSize: 16 },
  headerTitle: {
    color: "#e0e0e0",
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },

  // List
  list: { flex: 1 },
  listContent: { paddingVertical: 12, gap: 4 },
  emptyText: { color: "#555", textAlign: "center", marginTop: 100, fontSize: 15 },
  errorText: { color: "#e94560", textAlign: "center", marginTop: 100, fontSize: 16 },

  // Loading
  loadingBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  loadingText: { color: "#a0a0b8", fontSize: 13 },

  // Input
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    backgroundColor: "#16213e",
    borderTopWidth: 1,
    borderTopColor: "#2a2a4a",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    color: "#e0e0e0",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  sendBtn: {
    backgroundColor: "#e94560",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sendBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  stopBtn: {
    backgroundColor: "#555",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  stopBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  // Scroll to bottom
  scrollToBottomBtn: {
    position: "absolute",
    right: 16,
    bottom: 90,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(128,128,128,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollToBottomText: { color: "#fff", fontSize: 20, fontWeight: "700" },

  // Summary button
  summaryBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  summaryBtnText: { color: "#a0a0b8", fontSize: 14, fontWeight: "600" },
});
