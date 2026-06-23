import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from "react-native";
import { getSettings, updateSettings, type AppSettings } from "../store/settings";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const PRESETS: { label: string; config: Partial<AppSettings> }[] = [
  { label: "OpenAI", config: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o" } },
  { label: "DeepSeek", config: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-flash" } },
  { label: "Grok", config: { baseUrl: "https://api.x.ai/v1", model: "grok-2" } },
  { label: "Ollama", config: { baseUrl: "http://localhost:11434/v1", model: "llama3" } },
];

export default function SettingsModal({ visible, onClose }: Props) {
  const s = getSettings();
  const [apiKey, setApiKey] = useState(s.apiKey);
  const [model, setModel] = useState(s.model);
  const [baseUrl, setBaseUrl] = useState(s.baseUrl);
  const [summarizeThreshold, setSummarizeThreshold] = useState(
    String(s.summarizeThreshold ?? 30)
  );
  const [userName, setUserName] = useState(s.userName ?? "User");
  const [authorNoteText, setAuthorNoteText] = useState(s.authorNoteText ?? "");
  const [authorNoteDepth, setAuthorNoteDepth] = useState(
    String(s.authorNoteDepth ?? 4)
  );
  const [storyStringTemplate, setStoryStringTemplate] = useState(
    s.storyStringTemplate ?? ""
  );
  const [autoSummarize, setAutoSummarize] = useState(
    s.autoSummarize ?? true
  );
  const [customSystemPrompt, setCustomSystemPrompt] = useState(
    s.customSystemPrompt ?? ""
  );
  const [agentMode, setAgentMode] = useState(s.agentMode ?? false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const thresholdNum = parseInt(summarizeThreshold, 10);
    const depthNum = parseInt(authorNoteDepth, 10);
    await updateSettings({
      apiKey: apiKey.replace(/[^\x20-\x7E]/g, "").trim(),
      model: model.trim(),
      baseUrl: baseUrl.trim(),
      summarizeThreshold: isNaN(thresholdNum) ? 30 : thresholdNum,
      userName: userName.trim() || "User",
      authorNoteText: authorNoteText.trim(),
      authorNoteDepth: isNaN(depthNum) ? 4 : depthNum,
      storyStringTemplate: storyStringTemplate.trim(),
      autoSummarize,
      customSystemPrompt: customSystemPrompt.trim(),
      agentMode,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setBaseUrl(preset.config.baseUrl ?? baseUrl);
    setModel(preset.config.model ?? model);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>API Settings</Text>

          <Text style={styles.label}>User Name</Text>
          <TextInput
            style={styles.input}
            value={userName}
            onChangeText={setUserName}
            placeholder="User"
            placeholderTextColor="#666"
            autoCapitalize="words"
          />
          <Text style={styles.hint}>
            Your display name used in {"{{user}}"} placeholders.
          </Text>

          <View style={styles.switchRow}>
            <Text style={styles.label}>Agent Beta</Text>
            <Switch
              value={agentMode}
              onValueChange={setAgentMode}
              trackColor={{ false: "#444", true: "#10b981" }}
            />
          </View>
          <Text style={styles.hint}>
            LoreBook → Skills, pulled on demand. Shortens system prompt.
          </Text>

          {/* Presets */}
          <Text style={styles.sectionLabel}>Presets</Text>
          <View style={styles.presetRow}>
            {PRESETS.map((p) => (
              <TouchableOpacity
                key={p.label}
                style={styles.presetBtn}
                onPress={() => applyPreset(p)}
              >
                <Text style={styles.presetBtnText}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>API Key</Text>
          <TextInput
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="sk-..."
            placeholderTextColor="#666"
            secureTextEntry
            autoCapitalize="none"
          />

          <Text style={styles.label}>Model</Text>
          <TextInput
            style={styles.input}
            value={model}
            onChangeText={setModel}
            placeholder="gpt-3.5-turbo"
            placeholderTextColor="#666"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Base URL</Text>
          <TextInput
            style={styles.input}
            value={baseUrl}
            onChangeText={setBaseUrl}
            placeholder="https://api.openai.com/v1"
            placeholderTextColor="#666"
            autoCapitalize="none"
            keyboardType="url"
          />
          <Text style={styles.hint}>
            Any OpenAI-compatible API endpoint works.
          </Text>

          <Text style={styles.sectionLabel}>Context</Text>

          <Text style={styles.label}>Custom System Prompt</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={customSystemPrompt}
            onChangeText={setCustomSystemPrompt}
            placeholder="Global instructions prepended to every request..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={3}
          />
          <Text style={styles.hint}>
            Prepended before the character card's system prompt.
          </Text>

          <Text style={styles.label}>Summarize Threshold</Text>
          <TextInput
            style={styles.input}
            value={summarizeThreshold}
            onChangeText={setSummarizeThreshold}
            placeholder="30"
            placeholderTextColor="#666"
            keyboardType="numeric"
          />
          <Text style={styles.hint}>
            Auto-summarize older messages every N messages. Set to 0 to disable.
          </Text>

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.label}>Auto Summarize</Text>
              <Text style={styles.switchHint}>
                Automatically trigger summarization
              </Text>
            </View>
            <Switch
              value={autoSummarize}
              onValueChange={setAutoSummarize}
              trackColor={{ false: "#444", true: "#e94560" }}
            />
          </View>

          <Text style={styles.label}>Author's Note</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={authorNoteText}
            onChangeText={setAuthorNoteText}
            placeholder="e.g. The story is getting intense..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={3}
          />
          <Text style={styles.hint}>
            A floating prompt injected into the chat at a set depth.
          </Text>

          <Text style={styles.label}>Author's Note Depth</Text>
          <TextInput
            style={styles.input}
            value={authorNoteDepth}
            onChangeText={setAuthorNoteDepth}
            placeholder="4"
            placeholderTextColor="#666"
            keyboardType="numeric"
          />
          <Text style={styles.hint}>
            Insert N messages from the end (0=latest, 4=fourth from end).
          </Text>

          <Text style={styles.label}>Story String Template</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={storyStringTemplate}
            onChangeText={setStoryStringTemplate}
            placeholder="Customize prompt layout with macros..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={4}
          />
          <Text style={styles.hint}>
            Available macros: {"{{char}}"} {"{{user}}"} {"{{description}}"} {"{{personality}}"} {"{{scenario}}"} {"{{system}}"} {"{{wi_before}}"} {"{{wi_after}}"} {"{{post_history}}"} {"{{mes_example_raw}}"}. Leave empty for default.
          </Text>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>
              {saved ? "Saved!" : "Save"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Close</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e" },
  scroll: { padding: 24, paddingTop: 60 },
  title: {
    color: "#e0e0e0",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 28,
    textAlign: "center",
  },
  sectionLabel: { color: "#a0a0b8", fontSize: 13, marginBottom: 8 },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  presetBtn: {
    backgroundColor: "#16213e",
    borderWidth: 1,
    borderColor: "#2a2a4a",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  presetBtnText: { color: "#a0a0b8", fontSize: 13 },
  label: { color: "#a0a0b8", fontSize: 14, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: "#16213e",
    color: "#e0e0e0",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  multilineInput: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  switchHint: { color: "#555", fontSize: 11, marginTop: 2 },
  hint: { color: "#666", fontSize: 12, marginTop: 6 },
  saveBtn: {
    backgroundColor: "#e94560",
    borderRadius: 10,
    padding: 16,
    marginTop: 32,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  cancelBtn: {
    borderRadius: 10,
    padding: 16,
    marginTop: 12,
    alignItems: "center",
  },
  cancelBtnText: { color: "#a0a0b8", fontSize: 16 },
});
