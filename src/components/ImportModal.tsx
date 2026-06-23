import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { parseCharacterCard } from "../parser/characterCard";
import { createSession } from "../store/sessions";
import { getSettings } from "../store/settings";

interface Props {
  visible: boolean;
  onClose: () => void;
  onImported: (sessionId: string) => void;
}

/**
 * 角色卡导入弹窗
 * 目前仅支持"从相册选 PNG"，后续可扩展"粘贴 JSON"
 */
export default function ImportModal({ visible, onClose, onImported }: Props) {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  const pickImage = async () => {
    setError("");

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo library permission required to import character cards.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      base64: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    setImporting(true);
    try {
      const uri = result.assets[0].uri;
      console.log("Importing card from:", uri);

      // Android 上 expo-image-picker 返回 content:// URI，
      // fetch 无法读取，需要用 expo-file-system (legacy API)
      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // base64 字符串 → Uint8Array → ArrayBuffer
      const encoded = Uint8Array.from(atob(base64Data), (c) =>
        c.charCodeAt(0)
      );
      const arrayBuffer = encoded.buffer.slice(
        encoded.byteOffset,
        encoded.byteOffset + encoded.byteLength
      );

      const card = parseCharacterCard(arrayBuffer);
      if (!card) {
        setError(
          "Could not parse character data from this PNG. Make sure it's a valid character card from 类脑 or SillyTavern."
        );
        setImporting(false);
        return;
      }

      const session = await createSession(card, getSettings().userName);
      setImporting(false);
      onImported(session.id);
      onClose();
    } catch (e: any) {
      setError(`Import failed: ${e.message}`);
      setImporting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <Text style={styles.title}>Import Character Card</Text>
        <Text style={styles.subtitle}>
          Select a PNG character card from your device.{"\n"}
          Supports 类脑 / SillyTavern / TavernAI formats (V1/V2/V3).
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.importBtn}
          onPress={pickImage}
          disabled={importing}
        >
          <Text style={styles.importBtnText}>
            {importing ? "Importing..." : "Choose PNG from Gallery"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    padding: 24,
    justifyContent: "center",
  },
  title: {
    color: "#e0e0e0",
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    color: "#a0a0b8",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 32,
  },
  errorBox: {
    backgroundColor: "rgba(233,69,96,0.15)",
    borderWidth: 1,
    borderColor: "#e94560",
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  errorText: { color: "#e94560", fontSize: 13, lineHeight: 18 },
  importBtn: {
    backgroundColor: "#e94560",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
  },
  importBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  cancelBtn: {
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    alignItems: "center",
  },
  cancelBtnText: { color: "#a0a0b8", fontSize: 15 },
});
