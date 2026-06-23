import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
} from "react-native";
import { getSession, updateCharacterBook } from "../store/sessions";

interface Props {
  visible: boolean;
  sessionId: string;
  onClose: () => void;
}

interface EntryForm {
  title: string;
  keys: string;
  content: string;
  constant: boolean;
  enabled: boolean;
  position: "before_char" | "after_char";
}

type EntryData = any;

const defaultEntry = (): EntryForm => ({
  title: "",
  keys: "",
  content: "",
  constant: false,
  enabled: true,
  position: "before_char",
});

function entryToForm(e: EntryData): EntryForm {
  return {
    title: e.comment ?? "",
    keys: (e.keys ?? []).join(", "),
    content: e.content ?? "",
    constant: e.constant ?? false,
    enabled: e.enabled ?? true,
    position: e.position === "after_char" ? "after_char" : "before_char",
  };
}

function formToEntry(f: EntryForm): EntryData {
  return {
    keys: f.keys.split(",").map((k) => k.trim()).filter(Boolean),
    content: f.content,
    comment: f.title,
    constant: f.constant,
    enabled: f.enabled,
    position: f.position,
    insertion_order: 100,
    case_sensitive: false,
    selective: false,
    secondary_keys: [],
  };
}

export default function LoreBookEditor({ visible, sessionId, onClose }: Props) {
  const session = getSession(sessionId);
  const [entries, setEntries] = useState<EntryData[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [form, setForm] = useState<EntryForm>(defaultEntry());

  // 加载/刷新 entries
  useEffect(() => {
    if (!visible) return;
    const s = getSession(sessionId);
    const book = s?.characterCard.data.character_book;
    setEntries(book?.entries ?? []);
  }, [visible, sessionId]);

  const persist = (updated: EntryData[]) => {
    const s = getSession(sessionId);
    if (!s) return;
    const book = s.characterCard.data.character_book;
    updateCharacterBook(sessionId, {
      ...(book ?? {}),
      entries: updated,
      name: book?.name ?? "",
      scan_depth: book?.scan_depth ?? 50,
      case_sensitive: book?.case_sensitive ?? false,
      recursive_scanning: book?.recursive_scanning ?? false,
    });
    setEntries(updated);
  };

  const openNew = () => {
    setForm(defaultEntry());
    setEditIdx(-1);
  };

  const openEdit = (idx: number) => {
    setForm(entryToForm(entries[idx]));
    setEditIdx(idx);
  };

  const saveEntry = () => {
    const entryData = formToEntry(form);
    let updated: EntryData[];
    if (editIdx === -1) {
      updated = [...entries, entryData];
    } else if (editIdx !== null) {
      updated = [...entries];
      updated[editIdx] = { ...entries[editIdx], ...entryData };
    } else return;
    persist(updated);
    setEditIdx(null);
  };

  const deleteEntry = (idx: number) => {
    persist(entries.filter((_: any, i: number) => i !== idx));
  };

  const toggleEntry = (idx: number) => {
    const updated = [...entries];
    updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled };
    persist(updated);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>LoreBook</Text>
          <TouchableOpacity onPress={openNew}>
            <Text style={styles.addBtn}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {editIdx === null ? (
          <ScrollView style={styles.list}>
            {entries.length === 0 ? (
              <Text style={styles.empty}>No entries yet. Tap "+ Add" to create one.</Text>
            ) : (
              entries.map((entry: EntryData, idx: number) => {
                const title = entry.comment || "(no title)";
                const keys = entry.keys?.length > 0 ? entry.keys.join(", ") : "";
                return (
                  <View key={idx} style={styles.entryCard}>
                    <TouchableOpacity
                      style={styles.entryContent}
                      onPress={() => openEdit(idx)}
                    >
                      <Text style={styles.entryTitle} numberOfLines={1}>
                        {title}
                      </Text>
                      {keys ? (
                        <Text style={styles.entryKeys} numberOfLines={1}>
                          Keys: {keys}
                        </Text>
                      ) : null}
                      <Text style={styles.entryPreview} numberOfLines={2}>
                        {entry.content || "(empty)"}
                      </Text>
                      <View style={styles.entryMeta}>
                        <Text style={styles.metaText}>
                          {entry.position === "after_char" ? "after" : "before"}
                          {" · "}
                          {entry.constant ? "constant" : "keyword"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.entryActions}>
                      <Switch
                        value={entry.enabled !== false}
                        onValueChange={() => toggleEntry(idx)}
                        trackColor={{ false: "#444", true: "#e94560" }}
                      />
                      <TouchableOpacity onPress={() => deleteEntry(idx)}>
                        <Text style={styles.deleteIcon}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        ) : (
          <ScrollView style={styles.form}>
            <Text style={styles.formTitle}>
              {editIdx === -1 ? "New Entry" : "Edit Entry"}
            </Text>

            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={(t) => setForm({ ...form, title: t })}
              placeholder="Entry display name"
              placeholderTextColor="#666"
            />

            <Text style={styles.label}>Keys (comma-separated)</Text>
            <TextInput
              style={styles.input}
              value={form.keys}
              onChangeText={(t) => setForm({ ...form, keys: t })}
              placeholder="keyword1, keyword2"
              placeholderTextColor="#666"
            />

            <Text style={styles.label}>Content</Text>
            <TextInput
              style={[styles.input, styles.contentInput]}
              value={form.content}
              onChangeText={(t) => setForm({ ...form, content: t })}
              placeholder="Entry content..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={6}
            />

            <View style={styles.switchRow}>
              <Text style={styles.label}>Constant</Text>
              <Switch
                value={form.constant}
                onValueChange={(v) => setForm({ ...form, constant: v })}
                trackColor={{ false: "#444", true: "#e94560" }}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.label}>Enabled</Text>
              <Switch
                value={form.enabled}
                onValueChange={(v) => setForm({ ...form, enabled: v })}
                trackColor={{ false: "#444", true: "#e94560" }}
              />
            </View>

            <Text style={styles.label}>Position</Text>
            <View style={styles.segRow}>
              <TouchableOpacity
                style={[styles.segBtn, form.position === "before_char" && styles.segActive]}
                onPress={() => setForm({ ...form, position: "before_char" })}
              >
                <Text style={[styles.segText, form.position === "before_char" && styles.segTextActive]}>
                  Before Char
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segBtn, form.position === "after_char" && styles.segActive]}
                onPress={() => setForm({ ...form, position: "after_char" })}
              >
                <Text style={[styles.segText, form.position === "after_char" && styles.segTextActive]}>
                  After Char
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditIdx(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveEntry}>
                <Text style={styles.saveText}>Save Entry</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
  title: { color: "#e0e0e0", fontSize: 18, fontWeight: "600" },
  addBtn: { color: "#e94560", fontSize: 15, fontWeight: "600" },
  list: { flex: 1, padding: 14 },
  empty: { color: "#555", textAlign: "center", marginTop: 80, fontSize: 14 },

  entryCard: {
    backgroundColor: "#16213e", borderRadius: 12,
    borderWidth: 1, borderColor: "#2a2a4a", marginBottom: 10,
    flexDirection: "row", alignItems: "center",
  },
  entryContent: { flex: 1, padding: 14 },
  entryTitle: { color: "#e0e0e0", fontSize: 15, fontWeight: "600", marginBottom: 2 },
  entryKeys: { color: "#e94560", fontSize: 11, marginBottom: 4 },
  entryPreview: { color: "#a0a0b8", fontSize: 13, lineHeight: 18 },
  entryMeta: { flexDirection: "row", marginTop: 6 },
  metaText: { color: "#555", fontSize: 11 },
  entryActions: { paddingRight: 10, alignItems: "center", gap: 8 },
  deleteIcon: { color: "#e94560", fontSize: 16, fontWeight: "700" },

  form: { flex: 1, padding: 16 },
  formTitle: { color: "#e0e0e0", fontSize: 20, fontWeight: "700", marginBottom: 20 },
  label: { color: "#a0a0b8", fontSize: 14, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: "#16213e", color: "#e0e0e0", borderRadius: 10,
    padding: 14, fontSize: 15, borderWidth: 1, borderColor: "#2a2a4a",
  },
  contentInput: { minHeight: 120, textAlignVertical: "top" },
  switchRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginTop: 8,
  },
  segRow: { flexDirection: "row", gap: 10 },
  segBtn: {
    flex: 1, backgroundColor: "#16213e", borderRadius: 8,
    padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#2a2a4a",
  },
  segActive: { borderColor: "#e94560", backgroundColor: "rgba(233,69,96,0.1)" },
  segText: { color: "#888", fontSize: 14 },
  segTextActive: { color: "#e94560", fontWeight: "600" },
  formBtns: { flexDirection: "row", gap: 12, marginTop: 24, marginBottom: 40 },
  cancelBtn: {
    flex: 1, borderRadius: 10, padding: 14,
    alignItems: "center", borderWidth: 1, borderColor: "#2a2a4a",
  },
  cancelText: { color: "#a0a0b8", fontSize: 15 },
  saveBtn: {
    flex: 1, backgroundColor: "#e94560", borderRadius: 10,
    padding: 14, alignItems: "center",
  },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
