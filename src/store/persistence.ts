import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  SETTINGS: "@tavern/settings",
  SESSIONS: "@tavern/sessions",
};

export async function loadJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // silently fail
  }
}

export async function loadSettings<T>(defaultValue: T): Promise<T> {
  const data = await loadJSON<T>(KEYS.SETTINGS);
  return data ?? defaultValue;
}

export async function saveSettings(value: unknown): Promise<void> {
  await saveJSON(KEYS.SETTINGS, value);
}

export async function loadSessions<T>(defaultValue: T): Promise<T> {
  const data = await loadJSON<T>(KEYS.SESSIONS);
  return data ?? defaultValue;
}

export async function saveSessions(value: unknown): Promise<void> {
  await saveJSON(KEYS.SESSIONS, value);
}
