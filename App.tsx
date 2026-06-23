import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { initSettings } from "./src/store/settings";
import { initSessions } from "./src/store/sessions";
import SessionList from "./src/components/SessionList";
import ChatScreen from "./src/components/ChatScreen";
import SettingsModal from "./src/components/SettingsModal";
import ImportModal from "./src/components/ImportModal";

type Page = { type: "list" } | { type: "chat"; sessionId: string };

export default function App() {
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState<Page>({ type: "list" });
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [importVisible, setImportVisible] = useState(false);

  useEffect(() => {
    Promise.all([initSettings(), initSessions()]).then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#e94560" size="large" />
        <Text style={styles.loadingText}>Loading...</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />

      {page.type === "list" ? (
        <SessionList
          onEnterChat={(sessionId) => setPage({ type: "chat", sessionId })}
          onImport={() => setImportVisible(true)}
          onSettings={() => setSettingsVisible(true)}
        />
      ) : (
        <ChatScreen
          sessionId={page.sessionId}
          onBack={() => setPage({ type: "list" })}
        />
      )}

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
      <ImportModal
        visible={importVisible}
        onClose={() => setImportVisible(false)}
        onImported={(sessionId) => setPage({ type: "chat", sessionId })}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: { color: "#a0a0b8", fontSize: 15 },
});
