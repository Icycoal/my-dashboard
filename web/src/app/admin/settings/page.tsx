"use client";

import { useEffect, useState } from "react";
import { card, input, btnPrimary, btnGhost, pageTitle } from "@/lib/ui";

interface SettingRow {
  key: string;
  value: string;
  type: "number" | "boolean" | "json";
  category: string;
  label: string;
  description: string | null;
  updated_at: string;
}

const CATEGORIES = ["finances", "tax", "contributions", "algorithm", "apartments"] as const;

function SettingEditor({ row, onSave }: { row: SettingRow; onSave: (key: string, raw: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(row.value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    try {
      JSON.parse(raw);
    } catch {
      setError("Invalid JSON");
      return;
    }
    setSaving(true);
    setError(null);
    await onSave(row.key, raw);
    setSaving(false);
    setEditing(false);
  }

  if (!editing) {
    const display = row.type === "json"
      ? row.value.length > 80 ? row.value.slice(0, 80) + "…" : row.value
      : row.value;
    return (
      <div className="flex items-start justify-between gap-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-gray-200">{row.label}</div>
          {row.description && <div className="mt-0.5 text-xs text-gray-500">{row.description}</div>}
          <div className="mt-1 font-mono text-xs text-gray-400 break-all">{display}</div>
        </div>
        <button className={btnGhost + " shrink-0"} onClick={() => setEditing(true)}>Edit</button>
      </div>
    );
  }

  return (
    <div className="py-3">
      <div className="text-sm font-medium text-gray-200">{row.label}</div>
      {row.description && <div className="mt-0.5 text-xs text-gray-500">{row.description}</div>}
      <textarea
        className={input + " mt-2 w-full font-mono text-xs h-24 resize-y"}
        value={raw}
        onChange={e => setRaw(e.target.value)}
      />
      {error && <div className="mt-1 text-xs text-red-400">{error}</div>}
      <div className="mt-2 flex gap-2">
        <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        <button className={btnGhost} onClick={() => { setEditing(false); setRaw(row.value); setError(null); }}>Cancel</button>
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]>("finances");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/settings/rows")
      .then(r => r.json())
      .then((data: SettingRow[]) => { setRows(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave(key: string, raw: string) {
    const parsed = JSON.parse(raw);
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: parsed }),
    });
    setRows(prev => prev.map(r => r.key === key ? { ...r, value: raw } : r));
  }

  const visible = rows.filter(r => r.category === activeCategory);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className={pageTitle}>Admin Settings</h1>
      <p className="mt-1 text-sm text-gray-500">Edit configurable values stored in the database. Changes take effect immediately on next request.</p>

      <div className="mt-6 flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={activeCategory === cat ? btnPrimary : btnGhost}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      <div className={card + " mt-6 divide-y divide-white/[0.05] px-5"}>
        {loading && <div className="py-8 text-center text-sm text-gray-500">Loading…</div>}
        {!loading && visible.length === 0 && <div className="py-8 text-center text-sm text-gray-500">No settings found.</div>}
        {visible.map(row => (
          <SettingEditor key={row.key} row={row} onSave={handleSave} />
        ))}
      </div>
    </div>
  );
}
