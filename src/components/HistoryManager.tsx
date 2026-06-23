import React, { useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from "react-native";
import {
  getSession,
  removeFromContext,
  updateSummary,
  type ChatMessage,
} from "../store/sessions";
import { getSettings } from "../store/settings";
import { buildConversationContext, type Message } from "../prompt/template";
import { buildPlannerMessages } from "../agent/planner";
import { buildWriterMessages } from "../agent/writer";
import { buildStatusManagerMessages } from "../agent/statusManager";
import { getLoreEntryTitles } from "../agent/loreRouter";
import { summarizeHistory, DEFAULT_SUMMARIZE_PROMPT } from "../prompt/summarizer";

interface Props {
  visible: boolean;
  sessionId: string;
  onClose: () => void;
}

export default function HistoryManager({ visible, sessionId, onClose }: Props) {
  const [mode, setMode] = useState<"view" | "summarize">("view");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [summaryResult, setSummaryResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<{ title: string; text: string } | null>(null);
  const [summarizedMsgIds, setSummarizedMsgIds] = useState<string[]>([]);
  const [summarizePrompt, setSummarizePrompt] = useState("");

  const session = getSession(sessionId);
  if (!session) return null;

  const settings = getSettings();

  // 构建三 Agent 的完整 context
  const { plannerSys, writerSys, statusSys, chatMessages } = useMemo(() => {
    const chatHistory = session.messages
      .filter((m) => m.messageType !== "status")
      .map((m) => ({ role: m.role, content: m.content, id: m.id } as any));

    if (settings.agentMode) {
      const card = session.characterCard;
      const userName = session.userName || "User";

      // Planner
      const plannerCtx = buildPlannerMessages(
        card, chatHistory, userName,
        session.summary || "", session.status || "", settings
      );
      const pSys = plannerCtx.filter((m: any) => m.role === "system");

      // Writer — 用真实对话历史做关键词匹配
      const writerRecentText = chatHistory.map((m: any) => m.content).join("\n");
      const writerLastUser = chatHistory.filter((m: any) => m.role === "user").pop()?.content;
      const writerCtx = buildWriterMessages(card, userName, "(Writing Guide — see actual message for content)", settings, writerRecentText, writerLastUser);
      const wSys = writerCtx.filter((m: any) => m.role === "system");

      // Status Manager
      const statusCtx = buildStatusManagerMessages(
        card, session.status || "", "(Latest text — see actual message for content)", settings
      );
      const sSys = statusCtx.filter((m: any) => m.role === "system");

      // Chat messages from planner (includes history)
      const chatMsgs = plannerCtx.filter(
        (m: any) => m.role === "user" || m.role === "assistant"
      );

      return {
        plannerSys: pSys,
        writerSys: wSys,
        statusSys: sSys,
        chatMessages: chatMsgs,
      };
    }

    // 普通模式
    const ctx = buildConversationContext(
      session.characterCard,
      chatHistory,
      session.userName || "User",
      session.summary || undefined,
      session.lastSummarizedIndex,
      settings,
      session.deletedMessageIds
    );
    return {
      plannerSys: [] as Message[],
      writerSys: [] as Message[],
      statusSys: ctx.filter((m: any) => m.role === "system"),
      chatMessages: ctx.filter((m: any) => m.role === "user" || m.role === "assistant"),
    };
  }, [session, settings]);

  // 提取实际注入的 entry 标题（直接调用 loreRouter，和运行时逻辑完全一致）
  const injectedEntries = useMemo(() => {
    if (!settings.agentMode) return null;
    const card = session.characterCard;
    const recentText = session.messages
      .filter((m) => m.messageType !== "status")
      .map((m) => m.content).join("\n");
    const statusRecentText = session.messages
      .findLast((m) => m.role === "assistant" && m.messageType !== "status")?.content?.slice(-2000) || "";

    return {
      planner: getLoreEntryTitles(card, "planner", recentText),
      writer: getLoreEntryTitles(card, "writer", recentText),
      status: getLoreEntryTitles(card, "status", statusRecentText),
    };
  }, [session, settings]);

  const [showPlanner, setShowPlanner] = useState(true);
  const [showWriter, setShowWriter] = useState(true);
  const [showStatus, setShowStatus] = useState(true);
  const [showNormal, setShowNormal] = useState(true);

  const toggleSelect = (idx: number) => {
    const key = String(idx);
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === chatMessages.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(chatMessages.map((_, i) => String(i))));
    }
  };

  const handleDelete = (idx: number) => {
    const msg = chatMessages[idx] as any;
    if (msg?.id) {
      removeFromContext(sessionId, msg.id);
    }
  };

  const handleSummarize = async () => {
    const indices =
      mode === "summarize" && selected.size > 0
        ? [...selected].map(Number).sort((a, b) => a - b)
        : chatMessages.map((_, i) => i);

    const msgs = indices.map((i) => ({
      role: (chatMessages[i] as any).role as "user" | "assistant",
      content: (chatMessages[i] as any).content as string,
    }));

    const selectedIds = indices.map((i) => (chatMessages[i] as any).id as string);

    if (msgs.length === 0) return;

    setLoading(true);
    try {
      const effectivePrompt = summarizePrompt.trim() || undefined;
      const result = await summarizeHistory(settings, "", msgs, effectivePrompt);
      setSummaryResult(result || "(empty)");
      setSummarizedMsgIds(selectedIds);
    } catch (e: any) {
      setSummaryResult(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const applySummary = () => {
    if (summaryResult && !summaryResult.startsWith("Error:")) {
      const lastIdx = summarizedMsgIds.length > 0
        ? Math.max(
            ...summarizedMsgIds.map((id) =>
              session.messages.findIndex((m) => m.id === id)
            ).filter((i) => i >= 0),
            -1
          )
        : session.messages.length - 1;

      updateSummary(
        sessionId,
        summaryResult,
        lastIdx >= 0 ? lastIdx : session.messages.length - 1
      );
      setSummaryResult("");
      setSummarizedMsgIds([]);
      setMode("view");
      setSelected(new Set());
    }
  };

  const renderAgentSection = (
    label: string,
    color: string,
    sysMsgs: Message[],
    entryTitles: string[],
    show: boolean,
    setShow: (v: boolean) => void
  ) => (
    <View key={label}>
      <TouchableOpacity
        style={styles.systemToggle}
        onPress={() => setShow(!show)}
      >
        <Text style={[styles.systemToggleText, { color }]}>
          {show ? "▼" : "▶"} {label} ({sysMsgs.length})
          {entryTitles.length > 0 ? ` · ${entryTitles.length} entries` : ""}
        </Text>
      </TouchableOpacity>
      {show && (
        <>
          {entryTitles.length > 0 && (
            <View style={styles.entryList}>
              {entryTitles.map((t, i) => (
                <Text key={i} style={styles.entryItem}>
                  + {t}
                </Text>
              ))}
            </View>
          )}
          {sysMsgs.map((msg: any, idx: number) => (
            <TouchableOpacity
              key={idx}
              style={styles.systemBlock}
              onPress={() =>
                setDetail({ title: `${label} · System ${idx + 1}`, text: msg.content })
              }
            >
              <Text style={[styles.agentRole, { color }]}>system {idx + 1}</Text>
              <Text style={styles.systemContent} numberOfLines={8}>
                {msg.content}
              </Text>
            </TouchableOpacity>
          ))}
        </>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Context ({chatMessages.length} msgs)</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView style={styles.body}>
          {/* Mode buttons */}
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === "view" && styles.modeActive]}
              onPress={() => { setMode("view"); setSelected(new Set()); }}
            >
              <Text style={[styles.modeText, mode === "view" && styles.modeTextActive]}>
                View
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === "summarize" && styles.modeActive]}
              onPress={() => setMode("summarize")}
            >
              <Text style={[styles.modeText, mode === "summarize" && styles.modeTextActive]}>
                Summarize
              </Text>
            </TouchableOpacity>
          </View>

          {/* System prompts */}
          {plannerSys.length > 0 ? (
            <>
              <Text style={styles.sectionHint}>Agent V2 — three-agent context</Text>
              {renderAgentSection(
                "Planner Agent",
                "#3b82f6",
                plannerSys,
                injectedEntries?.planner || [],
                showPlanner,
                setShowPlanner
              )}
              {renderAgentSection(
                "Writer Agent",
                "#10b981",
                writerSys,
                injectedEntries?.writer || [],
                showWriter,
                setShowWriter
              )}
              {renderAgentSection(
                "Status Manager",
                "#f59e0b",
                statusSys,
                injectedEntries?.status || [],
                showStatus,
                setShowStatus
              )}
            </>
          ) : (
            <TouchableOpacity
              style={styles.systemToggle}
              onPress={() => setShowNormal(!showNormal)}
            >
              <Text style={styles.systemToggleText}>
                {showNormal ? "▼" : "▶"} System Prompt ({statusSys.length})
              </Text>
              {showNormal &&
                statusSys.map((msg: any, idx: number) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.systemBlock}
                    onPress={() =>
                      setDetail({ title: `System ${idx + 1}`, text: msg.content })
                    }
                  >
                    <Text style={styles.systemRole}>system {idx + 1}</Text>
                    <Text style={styles.systemContent} numberOfLines={10}>
                      {msg.content}
                    </Text>
                  </TouchableOpacity>
                ))}
            </TouchableOpacity>
          )}

          {/* Chat messages */}
          {chatMessages.map((msg: any, idx: number) => {
            const isUser = msg.role === "user";
            const selKey = String(idx);
            const isSelected = selected.has(selKey);
            const isDeleted = session.deletedMessageIds.includes(msg.id);

            return (
              <View
                key={idx}
                style={[
                  styles.msgRow,
                  isDeleted && styles.msgDeleted,
                  isSelected && styles.msgSelected,
                ]}
              >
                {(mode === "summarize") && (
                  <TouchableOpacity
                    style={styles.checkArea}
                    onPress={() => toggleSelect(idx)}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        isSelected && styles.checkboxChecked,
                      ]}
                    >
                      {isSelected && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.msgContent}
                  onPress={() =>
                    setDetail({ title: isUser ? "You" : "AI", text: msg.content })
                  }
                >
                  <View style={styles.msgHeader}>
                    <Text style={[styles.msgRole, isUser && styles.msgRoleUser]}>
                      {isUser ? "You" : "AI"}
                    </Text>
                    {isDeleted ? (
                      <Text style={styles.deletedBadge}>removed</Text>
                    ) : null}
                  </View>
                  <Text style={styles.msgPreview} numberOfLines={3}>
                    {msg.content}
                  </Text>
                </TouchableOpacity>
                {!isDeleted && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(idx)}
                  >
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          {/* Summarize controls */}
          {mode === "summarize" && (
            <View style={styles.summarySection}>
              <Text style={styles.sectionLabel}>Prompt</Text>
              <TextInput
                style={styles.promptInput}
                value={summarizePrompt}
                onChangeText={setSummarizePrompt}
                placeholder={DEFAULT_SUMMARIZE_PROMPT}
                placeholderTextColor="#555"
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity onPress={selectAll}>
                <Text style={styles.selectAllText}>
                  {selected.size === chatMessages.length
                    ? "Deselect All"
                    : `Select All (${selected.size}/${chatMessages.length})`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.summarizeBtn}
                onPress={handleSummarize}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.summarizeText}>
                    Summarize {selected.size > 0 ? `Selected (${selected.size})` : "All"}
                  </Text>
                )}
              </TouchableOpacity>

              {summaryResult ? (
                <View style={styles.resultBox}>
                  <Text style={styles.resultLabel}>Result:</Text>
                  <Text style={styles.resultText}>{summaryResult}</Text>
                  {!summaryResult.startsWith("Error:") &&
                    summaryResult !== "(empty)" && (
                      <View style={styles.resultBtns}>
                        <TouchableOpacity
                          style={styles.applyBtn}
                          onPress={applySummary}
                        >
                          <Text style={styles.applyBtnText}>Apply</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.discardBtn}
                          onPress={() => setSummaryResult("")}
                        >
                          <Text style={styles.discardBtnText}>Discard</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>

        {/* Detail overlay */}
        {detail && (
          <View style={styles.detailOverlay}>
            <View style={styles.detailBox}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailTitle}>{detail.title}</Text>
                <TouchableOpacity onPress={() => setDetail(null)}>
                  <Text style={styles.detailClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.detailBody}>
                <Text style={styles.detailText}>{detail.text}</Text>
              </ScrollView>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 14, paddingTop: 54, paddingBottom: 12,
    backgroundColor: "#16213e", borderBottomWidth: 1, borderBottomColor: "#2a2a4a",
  },
  backBtn: { color: "#a0a0b8", fontSize: 16 },
  title: { color: "#e0e0e0", fontSize: 16, fontWeight: "600" },
  body: { flex: 1, padding: 14 },

  // Mode
  modeRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  modeBtn: {
    flex: 1, backgroundColor: "#16213e", borderRadius: 8,
    padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#2a2a4a",
  },
  modeActive: { borderColor: "#e94560", backgroundColor: "rgba(233,69,96,0.1)" },
  modeText: { color: "#888", fontSize: 14 },
  modeTextActive: { color: "#e94560", fontWeight: "600" },

  // System
  sectionHint: { color: "#10b981", fontSize: 11, marginBottom: 8 },
  systemToggle: { marginBottom: 10 },
  systemToggleText: { color: "#a0a0b8", fontSize: 13 },
  systemBlock: {
    backgroundColor: "#16213e", borderRadius: 8, padding: 10, marginBottom: 8,
    borderWidth: 1, borderColor: "#2a2a4a",
  },
  systemRole: { color: "#e94560", fontSize: 11, marginBottom: 4 },
  agentRole: { fontSize: 11, marginBottom: 4, fontWeight: "600" },
  systemContent: { color: "#888", fontSize: 12, lineHeight: 17 },
  entryList: {
    backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 6,
    padding: 8, marginBottom: 8, marginLeft: 12,
  },
  entryItem: { color: "#f0c040", fontSize: 11, lineHeight: 16 },

  // Messages
  msgRow: {
    flexDirection: "row", alignItems: "flex-start",
    paddingVertical: 8, paddingHorizontal: 10,
    borderBottomWidth: 1, borderBottomColor: "#1a1a2e",
    borderRadius: 6, marginBottom: 2,
  },
  msgDeleted: { opacity: 0.4, backgroundColor: "rgba(233,69,96,0.05)" },
  msgSelected: { backgroundColor: "rgba(233,69,96,0.08)" },
  checkArea: { paddingRight: 10, paddingTop: 2 },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 1, borderColor: "#555",
    justifyContent: "center", alignItems: "center",
  },
  checkboxChecked: { backgroundColor: "#e94560", borderColor: "#e94560" },
  checkmark: { color: "#fff", fontSize: 12, fontWeight: "700" },
  msgContent: { flex: 1 },
  msgHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  msgRole: { color: "#3b82f6", fontSize: 11, fontWeight: "600" },
  msgRoleUser: { color: "#e94560" },
  deletedBadge: { color: "#e94560", fontSize: 10, backgroundColor: "rgba(233,69,96,0.15)", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  msgPreview: { color: "#c0c0c0", fontSize: 13, lineHeight: 18 },
  deleteBtn: { paddingLeft: 8, paddingTop: 2 },
  deleteBtnText: { color: "#e94560", fontSize: 16, fontWeight: "700" },

  // Summary
  summarySection: { marginTop: 16 },
  sectionLabel: { color: "#a0a0b8", fontSize: 13, marginBottom: 6 },
  promptInput: {
    backgroundColor: "#1a1a2e", color: "#e0e0e0", borderRadius: 8,
    padding: 12, fontSize: 13, borderWidth: 1, borderColor: "#2a2a4a",
    minHeight: 70, textAlignVertical: "top", marginBottom: 12,
  },
  selectAllText: { color: "#3b82f6", fontSize: 13, marginBottom: 10 },
  summarizeBtn: {
    backgroundColor: "#e94560", borderRadius: 10,
    padding: 14, alignItems: "center",
  },
  summarizeText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  resultBox: {
    marginTop: 14, backgroundColor: "#16213e", borderRadius: 12,
    padding: 16, borderWidth: 1, borderColor: "#2a2a4a",
  },
  resultLabel: { color: "#888", fontSize: 12, marginBottom: 8 },
  resultText: { color: "#e0e0e0", fontSize: 14, lineHeight: 20 },
  applyBtn: {
    flex: 1, backgroundColor: "#3b82f6", borderRadius: 8,
    padding: 12, alignItems: "center",
  },
  applyBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  resultBtns: { flexDirection: "row", gap: 10, marginTop: 12 },
  discardBtn: {
    flex: 1, borderRadius: 8, padding: 12, alignItems: "center",
    borderWidth: 1, borderColor: "#555",
  },
  discardBtnText: { color: "#a0a0b8", fontSize: 14 },

  // Detail
  detailOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center",
  },
  detailBox: {
    backgroundColor: "#16213e", borderRadius: 16, width: "92%", maxHeight: "80%",
    borderWidth: 1, borderColor: "#2a2a4a",
  },
  detailHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, borderBottomWidth: 1, borderBottomColor: "#2a2a4a",
  },
  detailTitle: { color: "#e0e0e0", fontSize: 16, fontWeight: "600" },
  detailClose: { color: "#e94560", fontSize: 20, fontWeight: "700" },
  detailBody: { padding: 16 },
  detailText: { color: "#e0e0e0", fontSize: 14, lineHeight: 22 },
});
