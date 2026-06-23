import React, { useState } from "react";
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
import { getSession, updateAgentBook } from "../store/sessions";

interface Props {
  visible: boolean;
  sessionId: string;
  onClose: () => void;
}

interface EntryForm {
  title: string;
  keys: string;
  content: string;
  position: "before_char" | "after_char";
  // Legacy
  constant: boolean;
  enabled: boolean;
  // Per-agent
  planning_constant: boolean;
  planning_enabled: boolean;
  writing_constant: boolean;
  writing_enabled: boolean;
  status_constant: boolean;
  status_enabled: boolean;
}

const defaultEntry = (): EntryForm => ({
  title: "",
  keys: "",
  content: "",
  position: "before_char",
  constant: false,
  enabled: true,
  planning_constant: false,
  planning_enabled: true,
  writing_constant: false,
  writing_enabled: true,
  status_constant: false,
  status_enabled: true,
});

function entryToForm(e: any): EntryForm {
  return {
    title: e.comment ?? (e.keys?.length > 0 ? e.keys.join(", ") : ""),
    keys: (e.keys ?? []).join(", "),
    content: e.content ?? "",
    position: e.position === "after_char" ? "after_char" : "before_char",
    constant: e.constant ?? false,
    enabled: e.enabled ?? true,
    planning_constant: e.planning_constant ?? (e.constant ?? false),
    planning_enabled: e.planning_enabled ?? (e.enabled ?? true),
    writing_constant: e.writing_constant ?? (e.constant ?? false),
    writing_enabled: e.writing_enabled ?? (e.enabled ?? true),
    status_constant: e.status_constant ?? (e.constant ?? false),
    status_enabled: e.status_enabled ?? (e.enabled ?? true),
  };
}

function formToEntry(f: EntryForm): any {
  return {
    keys: f.keys.split(",").map((k) => k.trim()).filter(Boolean),
    content: f.content,
    comment: f.title,
    constant: f.constant,
    enabled: f.enabled,
    planning_constant: f.planning_constant,
    planning_enabled: f.planning_enabled,
    writing_constant: f.writing_constant,
    writing_enabled: f.writing_enabled,
    status_constant: f.status_constant,
    status_enabled: f.status_enabled,
    position: f.position,
    insertion_order: 100,
    case_sensitive: false,
    selective: false,
    secondary_keys: [],
  };
}

export default function LoreSkillEditor({ visible, sessionId, onClose }: Props) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [form, setForm] = useState<EntryForm>(defaultEntry());
  const [, forceUpdate] = useState(0);

  const getEntries = (): any[] => {
    const s = getSession(sessionId);
    return s?.characterCard.data.agent_book?.entries ?? [];
  };
  const entries = getEntries();

  const persist = (updated: any[]) => {
    const s = getSession(sessionId);
    if (!s) return;
    const book = s.characterCard.data.agent_book;
    updateAgentBook(sessionId, {
      ...(book ?? {}),
      entries: updated,
      name: book?.name ?? "",
      scan_depth: book?.scan_depth ?? 50,
      case_sensitive: book?.case_sensitive ?? false,
      recursive_scanning: book?.recursive_scanning ?? false,
    });
    forceUpdate((n) => n + 1);
  };

  const openNew = () => { setForm(defaultEntry()); setEditIdx(-1); };
  const openEdit = (idx: number) => { setForm(entryToForm(entries[idx])); setEditIdx(idx); };

  const saveEntry = () => {
    const entryData = formToEntry(form);
    console.log("[LoreSkill] saveEntry form:", {
      title: form.title,
      planning_constant: form.planning_constant,
      planning_enabled: form.planning_enabled,
      writing_constant: form.writing_constant,
      writing_enabled: form.writing_enabled,
      status_constant: form.status_constant,
      status_enabled: form.status_enabled,
    });
    console.log("[LoreSkill] saveEntry entryData:", {
      planning_constant: entryData.planning_constant,
      planning_enabled: entryData.planning_enabled,
      writing_constant: entryData.writing_constant,
      writing_enabled: entryData.writing_enabled,
      status_constant: entryData.status_constant,
      status_enabled: entryData.status_enabled,
    });
    const s = getSession(sessionId);
    const book = s?.characterCard.data.agent_book;
    const current = book?.entries ?? [];
    let updated: any[];
    if (editIdx === -1) updated = [...current, entryData];
    else if (editIdx !== null) { updated = [...current]; updated[editIdx] = { ...current[editIdx], ...entryData }; }
    else return;
    console.log("[LoreSkill] saveEntry merged:", {
      idx: editIdx,
      planning_constant: updated[editIdx]?.planning_constant,
      planning_enabled: updated[editIdx]?.planning_enabled,
      writing_constant: updated[editIdx]?.writing_constant,
      writing_enabled: updated[editIdx]?.writing_enabled,
      status_constant: updated[editIdx]?.status_constant,
      status_enabled: updated[editIdx]?.status_enabled,
    });
    persist(updated);
    setEditIdx(null);
  };

  const deleteEntry = (idx: number) => {
    persist(entries.filter((_: any, i: number) => i !== idx));
  };

  const toggleEntry = (idx: number) => {
    const updated = [...entries];
    const newVal = !updated[idx].enabled;
    updated[idx] = {
      ...updated[idx],
      enabled: newVal,
      planning_enabled: newVal,
      writing_enabled: newVal,
      status_enabled: newVal,
    };
    persist(updated);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Lore Book</Text>
          <TouchableOpacity onPress={openNew}>
            <Text style={styles.addBtn}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {editIdx === null ? (
          <ScrollView style={styles.list}>
            {entries.length === 0 ? (
              <Text style={styles.empty}>No entries yet.</Text>
            ) : (
              entries.map((entry: any, idx: number) => {
                const title = entry.comment || entry.keys?.join(", ") || "(no title)";
                const agentBadges: string[] = [];
                const pC = entry.planning_constant ?? entry.constant ?? false;
                const pE = entry.planning_enabled ?? entry.enabled ?? true;
                const wC = entry.writing_constant ?? entry.constant ?? false;
                const wE = entry.writing_enabled ?? entry.enabled ?? true;
                const sC = entry.status_constant ?? entry.constant ?? false;
                const sE = entry.status_enabled ?? entry.enabled ?? true;
                if (pE) agentBadges.push(pC ? "Pc" : "P");
                if (wE) agentBadges.push(wC ? "Wc" : "W");
                if (sE) agentBadges.push(sC ? "Sc" : "S");

                return (
                  <View key={idx} style={styles.entryCard}>
                    <TouchableOpacity style={styles.entryContent} onPress={() => openEdit(idx)}>
                      <Text style={styles.entryTitle} numberOfLines={2}>{title}</Text>
                      <Text style={styles.entryPreview} numberOfLines={2}>
                        {entry.content || "(empty)"}
                      </Text>
                      <View style={styles.entryMeta}>
                        <Text style={styles.metaText}>
                          {agentBadges.join(" · ")}
                          {agentBadges.length === 0 ? "all disabled" : ""}
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
            <Text style={styles.formTitle}>{editIdx === -1 ? "New Entry" : "Edit Entry"}</Text>

            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={(t) => setForm((f) => ({ ...f, title: t }))}
              placeholder="Entry title"
              placeholderTextColor="#666"
            />

            <Text style={styles.label}>Keys (optional, comma-separated)</Text>
            <TextInput
              style={styles.input}
              value={form.keys}
              onChangeText={(t) => setForm((f) => ({ ...f, keys: t }))}
              placeholder="keyword1, keyword2"
              placeholderTextColor="#666"
            />

            {/* Per-Agent Injection Controls */}
            <Text style={styles.sectionLabel}>── Planner Agent ──</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Constant (always inject)</Text>
              <Switch value={form.planning_constant} onValueChange={(v) => setForm((f) => ({ ...f, planning_constant: v }))} trackColor={{ false: "#444", true: "#10b981" }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Enabled</Text>
              <Switch value={form.planning_enabled} onValueChange={(v) => setForm((f) => ({ ...f, planning_enabled: v }))} trackColor={{ false: "#444", true: "#e94560" }} />
            </View>

            <Text style={styles.sectionLabel}>── Writer Agent ──</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Constant (always inject)</Text>
              <Switch value={form.writing_constant} onValueChange={(v) => setForm((f) => ({ ...f, writing_constant: v }))} trackColor={{ false: "#444", true: "#10b981" }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Enabled</Text>
              <Switch value={form.writing_enabled} onValueChange={(v) => setForm((f) => ({ ...f, writing_enabled: v }))} trackColor={{ false: "#444", true: "#e94560" }} />
            </View>

            <Text style={styles.sectionLabel}>── Status Manager ──</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Constant (always inject)</Text>
              <Switch value={form.status_constant} onValueChange={(v) => setForm((f) => ({ ...f, status_constant: v }))} trackColor={{ false: "#444", true: "#10b981" }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Enabled</Text>
              <Switch value={form.status_enabled} onValueChange={(v) => setForm((f) => ({ ...f, status_enabled: v }))} trackColor={{ false: "#444", true: "#e94560" }} />
            </View>

            <Text style={styles.label}>Content</Text>
            <TextInput
              style={[styles.input, styles.contentInput]}
              value={form.content}
              onChangeText={(t) => setForm((f) => ({ ...f, content: t }))}
              placeholder="Entry content..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={6}
            />

            <View style={styles.formBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditIdx(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveEntry}>
                <Text style={styles.saveText}>Save</Text>
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
  title: { color: "#10b981", fontSize: 18, fontWeight: "600" },
  addBtn: { color: "#10b981", fontSize: 15, fontWeight: "600" },
  list: { flex: 1, padding: 14 },
  empty: { color: "#555", textAlign: "center", marginTop: 80, fontSize: 14 },

  entryCard: {
    backgroundColor: "#16213e", borderRadius: 12, borderWidth: 1,
    borderColor: "#2a2a4a", marginBottom: 10, flexDirection: "row", alignItems: "center",
  },
  entryContent: { flex: 1, padding: 14 },
  entryTitle: { color: "#e0e0e0", fontSize: 14, fontWeight: "600", marginBottom: 2 },
  entryPreview: { color: "#a0a0b8", fontSize: 13, lineHeight: 18 },
  entryMeta: { flexDirection: "row", marginTop: 6 },
  metaText: { color: "#555", fontSize: 11 },
  entryActions: {
    paddingRight: 10, alignItems: "center", gap: 6,
  },
  deleteIcon: { color: "#e94560", fontSize: 16, fontWeight: "700" },

  form: { flex: 1, padding: 16 },
  formTitle: { color: "#e0e0e0", fontSize: 20, fontWeight: "700", marginBottom: 20 },
  label: { color: "#a0a0b8", fontSize: 14, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: "#16213e", color: "#e0e0e0", borderRadius: 10,
    padding: 14, fontSize: 15, borderWidth: 1, borderColor: "#2a2a4a",
  },
  contentInput: { minHeight: 120, textAlignVertical: "top" },
  sectionLabel: { color: "#666", fontSize: 11, marginTop: 16, marginBottom: 4, fontWeight: "600" },
  switchLabel: { color: "#a0a0b8", fontSize: 13, flex: 1 },
  switchRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6,
  },
  formBtns: { flexDirection: "row", gap: 12, marginTop: 24, marginBottom: 40 },
  cancelBtn: {
    flex: 1, borderRadius: 10, padding: 14,
    alignItems: "center", borderWidth: 1, borderColor: "#2a2a4a",
  },
  cancelText: { color: "#a0a0b8", fontSize: 15 },
  saveBtn: {
    flex: 1, backgroundColor: "#10b981", borderRadius: 10, padding: 14, alignItems: "center",
  },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
