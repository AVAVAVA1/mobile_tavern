import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
} from "react-native";
import { getSessions, deleteSession, updateSessionTitle, subscribe, type Session } from "../store/sessions";
import SwipeableCard from "./SwipeableCard";
import { replacePlaceholders } from "../utils/placeholders";
import LoreBookEditor from "./LoreBookEditor";
import LoreSkillEditor from "./LoreSkillEditor";
import { getSettings, subscribe as subscribeSettings } from "../store/settings";
import type { AppSettings } from "../store/settings";

interface Props {
  onEnterChat: (sessionId: string) => void;
  onImport: () => void;
  onSettings: () => void;
}

export default function SessionList({
  onEnterChat,
  onImport,
  onSettings,
}: Props) {
  const [sessions, setSessions] = useState<Session[]>(getSessions());
  const [settings, setSettings] = useState<AppSettings>(getSettings());

  useEffect(() => {
    return subscribe(() => setSessions(getSessions()));
  }, []);

  useEffect(() => {
    return subscribeSettings(() => setSettings(getSettings()));
  }, []);

  // 排序：最后活跃的在前
  const sortedSessions = [...sessions].sort((a, b) => {
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

  const [editSession, setEditSession] = useState<Session | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [loreBookSession, setLoreBookSession] = useState<Session | null>(null);

  const openEdit = (session: Session) => {
    setEditTitle(session.title || session.characterCard.data.name || "");
    setEditSession(session);
  };

  const saveEdit = () => {
    if (editSession) {
      updateSessionTitle(editSession.id, editTitle.trim());
    }
    setEditSession(null);
  };

  const handleDelete = (session: Session) => {
    Alert.alert(
      "Delete Character",
      `Remove "${displayName(session)}" and all its messages?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteSession(session.id),
        },
      ]
    );
  };

  const displayName = (session: Session) => {
    return session.title || session.characterCard.data.name || "Unknown Character";
  };

  const openLoreBook = (session: Session) => {
    setLoreBookSession(session);
  };

  const renderSession = ({ item }: { item: Session }) => {
    const card = item.characterCard.data;
    const charName = card.name || "Character";
    const uName = item.userName || "User";

    const rawLast =
      item.messages.length > 0
        ? item.messages[item.messages.length - 1].content
        : card.first_mes;
    const lastMsg = replacePlaceholders(
      (rawLast ?? "No messages yet").slice(0, 60),
      charName,
      uName
    );

    const msgCount = item.messages.length;

    return (
      <SwipeableCard
        onPress={() => onEnterChat(item.id)}
        onDelete={() => handleDelete(item)}
        onEdit={() => openEdit(item)}
        onLoreBook={() => openLoreBook(item)}
        loreBookLabel="Book"
      >
        <View style={styles.cardContent}>
          <Text style={styles.cardName}>{displayName(item)}</Text>
          <Text style={styles.cardPreview} numberOfLines={2}>
            {lastMsg}
          </Text>
          <View style={styles.cardMeta}>
            <Text style={styles.cardMetaText}>
              {msgCount} message{msgCount !== 1 ? "s" : ""}
            </Text>
            {card.tags?.length ? (
              <View style={styles.tagsRow}>
                {card.tags.slice(0, 3).map((tag, i) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </SwipeableCard>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MobileTavern</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={onImport} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Import</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onSettings} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Edit title modal */}
      {editSession && (
        <View style={styles.editOverlay}>
          <View style={styles.editBox}>
            <Text style={styles.editLabel}>Edit Title</Text>
            <TextInput
              style={styles.editInput}
              value={editTitle}
              onChangeText={setEditTitle}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.editBtns}>
              <TouchableOpacity
                style={styles.editCancelBtn}
                onPress={() => setEditSession(null)}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editSaveBtn} onPress={saveEdit}>
                <Text style={styles.editSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* LoreBook Editor */}
      {loreBookSession && settings.agentMode ? (
        <LoreSkillEditor
          visible={true}
          sessionId={loreBookSession.id}
          onClose={() => setLoreBookSession(null)}
        />
      ) : loreBookSession ? (
        <LoreBookEditor
          visible={true}
          sessionId={loreBookSession.id}
          onClose={() => setLoreBookSession(null)}
        />
      ) : null}

      {/* Session list */}
      <FlatList
        data={sortedSessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSession}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Characters Yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap "Import" to add a character card{"\n"}from your device.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={onImport}>
              <Text style={styles.emptyBtnText}>Import Character Card</Text>
            </TouchableOpacity>
          </View>
        }
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
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
    backgroundColor: "#16213e",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a4a",
  },
  headerTitle: { color: "#e94560", fontSize: 22, fontWeight: "700" },
  headerRight: { flexDirection: "row", gap: 18 },
  headerBtn: {},
  headerBtnText: { color: "#a0a0b8", fontSize: 14 },

  // List
  listContent: { padding: 14, gap: 12, flexGrow: 1 },

  // Card
  cardContent: { padding: 16 },
  cardName: { color: "#e0e0e0", fontSize: 17, fontWeight: "600", marginBottom: 6 },
  cardPreview: { color: "#888", fontSize: 13, lineHeight: 18, marginBottom: 10 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardMetaText: { color: "#555", fontSize: 12 },
  tagsRow: { flexDirection: "row", gap: 4, flex: 1, flexWrap: "wrap" },
  tag: {
    backgroundColor: "rgba(233,69,96,0.15)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { color: "#e94560", fontSize: 10 },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: { color: "#888", fontSize: 20, fontWeight: "600", marginBottom: 8 },
  emptySubtitle: {
    color: "#555",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  emptyBtn: {
    backgroundColor: "#e94560",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  // Edit modal
  editOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  editBox: {
    backgroundColor: "#16213e",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  editLabel: {
    color: "#e0e0e0",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  editInput: {
    backgroundColor: "#1a1a2e",
    color: "#e0e0e0",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#2a2a4a",
    marginBottom: 20,
  },
  editBtns: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  editCancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  editCancelText: { color: "#a0a0b8", fontSize: 15 },
  editSaveBtn: {
    backgroundColor: "#e94560",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  editSaveText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
