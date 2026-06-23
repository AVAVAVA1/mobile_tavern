import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import MarkdownRenderer from "./MarkdownRenderer";
import { replacePlaceholders } from "../utils/placeholders";
import type { ChatMessage } from "../store/sessions";

interface Props {
  message: ChatMessage;
  charName: string;
  userName: string;
}

export default function MessageBubble({ message, charName, userName }: Props) {
  const isUser = message.role === "user";
  const isStatus = message.messageType === "status";
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [workflowExpanded, setWorkflowExpanded] = useState(false);

  if (message.role === "system" && !isStatus) return null;

  // ---- Status 消息特殊渲染 ----
  if (isStatus) {
    return (
      <View style={styles.statusBubble}>
        <TouchableOpacity
          onPress={() => setThinkingExpanded(!thinkingExpanded)}
        >
          <Text style={styles.statusHeader}>
            {thinkingExpanded ? "▼" : "▶"} 📊 Status Update
          </Text>
          {thinkingExpanded && (
            <MarkdownRenderer content={message.content} isUser={false} />
          )}
        </TouchableOpacity>
      </View>
    );
  }

  const displayContent = replacePlaceholders(message.content, charName, userName);

  // 解析思维链
  const thinkPatterns = [
    { open: /<thinking>/i, close: /<\/thinking>/i },
    { open: /【思考】/, close: /【\/思考】/ },
    { open: /\{思考\}/, close: /\{\/思考\}/ },
  ];

  let thinking = "";
  let body = displayContent;

  for (const pat of thinkPatterns) {
    const openMatch = displayContent.match(pat.open);
    if (!openMatch) continue;
    const openEnd = openMatch.index! + openMatch[0].length;
    const closeMatch = displayContent.match(pat.close);
    if (closeMatch) {
      thinking = displayContent.slice(openEnd, closeMatch.index!).trim();
      body = displayContent.slice(closeMatch.index! + closeMatch[0].length).trim();
    } else {
      thinking = displayContent.slice(openEnd).trim();
      body = "";
    }
    break;
  }

  thinking = thinking.replace(/^\n+|\n+$/g, "");
  body = body.replace(/^\n+|\n+$/g, "");

  const wf = message.workflowV2;

  return (
    <View
      style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.assistantBubble,
      ]}
    >
      {/* Agent V2 Workflow（三 Agent 架构） */}
      {!isUser && wf ? (
        <TouchableOpacity
          style={styles.thinkToggle}
          onPress={() => setWorkflowExpanded(!workflowExpanded)}
        >
          <Text style={styles.thinkToggleText}>
            {workflowExpanded ? "▼" : "▶"} ⚙ Agent Workflow
            {" · "}Lore: P{wf.loreCounts.planner}/W{wf.loreCounts.writer}/S{wf.loreCounts.status}
          </Text>

          {workflowExpanded && (
            <View style={styles.thinkContent}>
              {/* Planning Guide (可折叠) */}
              <Text style={styles.workflowSectionTitle}>
                📝 Planning Agent — Writing Guide
              </Text>
              <Text style={styles.workflowDetail} numberOfLines={15}>
                {wf.writingGuide.slice(0, 800)}
                {wf.writingGuide.length > 800 ? "\n... (truncated)" : ""}
              </Text>

              {/* Status Bar 预览 */}
              {wf.statusBar ? (
                <>
                  <Text style={styles.workflowSectionTitle}>
                    📊 Status Manager — Status Bar
                  </Text>
                  <Text style={styles.workflowDetail} numberOfLines={10}>
                    {wf.statusBar.slice(0, 400)}
                    {wf.statusBar.length > 400 ? "\n... (truncated, see full status below)" : ""}
                  </Text>
                </>
              ) : null}
            </View>
          )}
        </TouchableOpacity>
      ) : null}

      {/* 思维链 */}
      {!isUser && thinking ? (
        <TouchableOpacity
          style={styles.thinkToggle}
          onPress={() => setThinkingExpanded(!thinkingExpanded)}
        >
          <Text style={styles.thinkToggleText}>
            {thinkingExpanded ? "▼" : "▶"} Chain of Thought
          </Text>
          {thinkingExpanded && (
            <Text style={styles.thinkContent}>{thinking}</Text>
          )}
        </TouchableOpacity>
      ) : null}

      {/* 正式回复 */}
      {body ? (
        <MarkdownRenderer content={body} isUser={isUser} />
      ) : thinking ? (
        <Text style={styles.waiting}>Generating...</Text>
      ) : (
        <MarkdownRenderer content={displayContent} isUser={isUser} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: "85%",
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 14,
    marginVertical: 4,
  },
  userBubble: {
    backgroundColor: "#e94560",
    alignSelf: "flex-end",
  },
  assistantBubble: {
    backgroundColor: "#0f3460",
    alignSelf: "flex-start",
  },
  // Status message
  statusBubble: {
    maxWidth: "92%",
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 14,
    marginVertical: 6,
    backgroundColor: "#1a2332",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#2a3a4a",
  },
  statusHeader: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  // Thinking
  thinkToggle: {
    marginBottom: 8,
  },
  thinkToggleText: {
    color: "#a0a0b8",
    fontSize: 12,
    fontWeight: "600",
  },
  thinkContent: {
    color: "#888",
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "monospace",
    marginTop: 4,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 6,
  },
  waiting: {
    color: "#666",
    fontSize: 13,
    fontStyle: "italic",
  },
  // Agent workflow styles
  workflowSectionTitle: {
    color: "#10b981",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 2,
  },
  workflowDetail: {
    color: "#777",
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
});
