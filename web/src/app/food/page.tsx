"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { createFoodLog, listFoodLogs, searchFood } from "@/lib/api";
import type { FoodLog, USDAFoodSummary } from "@/lib/types";
import { btnAccent, btnGhost, btnPrimary, cardPad, input, pageSubtitle, pageTitle, sectionLabel } from "@/lib/ui";

type DraftItem = USDAFoodSummary & { servings: number };

type QuickPick = { label: string; items: Omit<DraftItem, "fdcId">[] };

const QUICK_PICKS: QuickPick[] = [
  {
    // Official Chipotle per-2oz serving values; real bowls run ~950-1100 cal due to larger scoops
    label: "Chipotle Bowl",
    items: [
      { name: "Chipotle White Rice", calories: 210, proteinG: 4, carbsG: 40, fatG: 3.5, servings: 1.5 },
      { name: "Chipotle Black Beans", calories: 130, proteinG: 9, carbsG: 22, fatG: 1.5, servings: 1.5 },
      { name: "Chipotle Chicken", calories: 180, proteinG: 32, carbsG: 0.5, fatG: 7, servings: 1.4 },
      { name: "Chipotle Tomatillo Red Salsa", calories: 30, proteinG: 0, carbsG: 5, fatG: 0, servings: 2.5 },
      { name: "Chipotle Fresh Tomato Salsa", calories: 15, proteinG: 0.5, carbsG: 3, fatG: 0, servings: 1 },
      { name: "Chipotle Corn Salsa", calories: 40, proteinG: 1, carbsG: 9, fatG: 0.5, servings: 1 },
      { name: "Chipotle Cheese", calories: 110, proteinG: 7, carbsG: 0.5, fatG: 9, servings: 1.2 },
      { name: "Chipotle Lettuce", calories: 5, proteinG: 0, carbsG: 1, fatG: 0, servings: 1 },
    ],
  },
];

function Inner() {
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<USDAFoodSummary[]>([]);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [mealType, setMealType] = useState("lunch");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const refresh = () => listFoodLogs().then(setLogs).catch((e) => setErr(e.message));
  useEffect(() => { refresh(); }, []);

  const doSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      setResults(await searchFood(query));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSearching(false);
    }
  };

  const addItem = (f: USDAFoodSummary) => {
    setItems([...items, { ...f, servings: 1 }]);
  };

  const updateServings = (i: number, servings: number) => {
    const next = [...items];
    next[i] = { ...next[i], servings };
    setItems(next);
  };

  const removeItem = (i: number) => setItems(items.filter((_, j) => j !== i));

  const addQuickPick = (qp: QuickPick) => {
    setItems((prev) => [
      ...prev,
      ...qp.items.map((it) => ({ ...it, fdcId: undefined as unknown as number })),
    ]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    try {
      await createFoodLog({
        mealType,
        loggedAt: new Date().toISOString(),
        notes: notes || undefined,
        items: items.map((it) => ({
          name: it.name,
          usdaFdcId: it.fdcId,
          servingSize: it.servingSize ? it.servingSize * it.servings : undefined,
          servingUnit: it.servingUnit,
          calories: it.calories ? it.calories * it.servings : undefined,
          proteinG: it.proteinG ? it.proteinG * it.servings : undefined,
          carbsG: it.carbsG ? it.carbsG * it.servings : undefined,
          fatG: it.fatG ? it.fatG * it.servings : undefined,
          fiberG: it.fiberG ? it.fiberG * it.servings : undefined,
        })),
      });
      setItems([]); setNotes(""); setQuery(""); setResults([]);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  };

  const totalCalories = items.reduce(
    (sum, it) => sum + (it.calories ?? 0) * it.servings, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className={pageTitle}>Food</h1>
        <p className={pageSubtitle}>Search USDA foods or use a quick pick, then log the meal.</p>
      </div>

      <div className={cardPad}>
        <div className={`${sectionLabel} mb-3`}>Quick Picks</div>
        <div className="flex flex-wrap gap-2">
          {QUICK_PICKS.map((qp) => (
            <button
              key={qp.label}
              type="button"
              onClick={() => addQuickPick(qp)}
              className={`${btnGhost} px-3 py-1.5`}
            >
              {qp.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`${cardPad} space-y-3`}>
        <form onSubmit={doSearch} className="flex gap-2">
          <input
            placeholder="Search USDA foods (e.g., chicken breast)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${input} flex-1`}
          />
          <button className={btnPrimary} disabled={searching}>
            {searching ? "…" : "Search"}
          </button>
        </form>

        {results.length > 0 && (
          <div className="max-h-64 divide-y divide-white/[0.05] overflow-auto rounded-xl border border-white/[0.06]">
            {results.map((r) => (
              <div key={r.fdcId} className="flex justify-between p-3 text-sm transition-colors hover:bg-white/[0.02]">
                <div>
                  <div className="text-gray-100">{r.name}</div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {r.brand && `${r.brand} · `}
                    {r.calories ? `${Math.round(r.calories)} cal` : ""}
                    {r.servingSize ? ` per ${r.servingSize}${r.servingUnit ?? "g"}` : ""}
                  </div>
                </div>
                <button onClick={() => addItem(r)} className={btnAccent}>
                  Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <form onSubmit={submit} className={`${cardPad} space-y-3`}>
          <div className="flex gap-2">
            <select
              value={mealType}
              onChange={(e) => setMealType(e.target.value)}
              className={input}
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
            <input
              placeholder="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${input} flex-1`}
            />
          </div>
          <div className="divide-y divide-white/[0.05] rounded-xl border border-white/[0.06]">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2 p-3 text-sm">
                <div className="flex-1">
                  <div className="text-gray-100">{it.name}</div>
                  <div className="mt-0.5 text-xs tabular-nums text-gray-500">
                    {Math.round((it.calories ?? 0) * it.servings)} cal
                  </div>
                </div>
                <input
                  type="number" step="0.25" min="0"
                  value={it.servings}
                  onChange={(e) => updateServings(i, +e.target.value)}
                  className={`${input} w-20 px-2 py-1 tabular-nums`}
                />
                <span className="text-xs text-gray-500">servings</span>
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/5 hover:text-red-400"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm tabular-nums text-gray-400">
              Total: {Math.round(totalCalories)} cal
            </div>
            <button className={btnPrimary}>Log meal</button>
          </div>
        </form>
      )}

      {err && <div className="text-sm text-red-400">{err}</div>}

      <section>
        <h2 className={`${sectionLabel} mb-3`}>Recent meals</h2>
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className={`${cardPad} transition-colors hover:border-white/10`}>
              <div className="flex justify-between">
                <div className="font-medium capitalize text-gray-100">{log.mealType ?? "Meal"}</div>
                <div className="text-sm tabular-nums text-gray-400">
                  {Math.round(log.totalCalories)} cal
                </div>
              </div>
              <div className="mt-0.5 text-xs text-gray-500">
                {new Date(log.loggedAt).toLocaleString()} · {log.source}
              </div>
              <ul className="mt-3 space-y-1 text-sm text-gray-300">
                {log.items.map((it) => (
                  <li key={it.id}>
                    {it.name}{it.calories ? ` — ${Math.round(it.calories)} cal` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-sm text-gray-500">No meals logged yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGuard>
      <Inner />
    </AuthGuard>
  );
}
