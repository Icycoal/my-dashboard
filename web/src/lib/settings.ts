import { getDb } from "./db";

export interface SettingRow {
  key: string;
  value: string;
  type: "number" | "boolean" | "json";
  category: string;
  label: string;
  description: string | null;
  updated_at: string;
}

export function getSetting<T>(key: string): T {
  const row = getDb()
    .prepare("SELECT value FROM admin_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  if (!row) throw new Error(`Admin setting not found: ${key}`);
  return JSON.parse(row.value) as T;
}

export function getSettingOrDefault<T>(key: string, fallback: T): T {
  const row = getDb()
    .prepare("SELECT value FROM admin_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  if (!row) return fallback;
  return JSON.parse(row.value) as T;
}

export function getAllSettings(): SettingRow[] {
  return getDb()
    .prepare("SELECT * FROM admin_settings ORDER BY category, key")
    .all() as SettingRow[];
}

export function updateSetting(key: string, value: unknown): void {
  getDb()
    .prepare("UPDATE admin_settings SET value = ?, updated_at = datetime('now') WHERE key = ?")
    .run(JSON.stringify(value), key);
}
