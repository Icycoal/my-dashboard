"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { createWeight, deleteWeight, listWeights, weightTrend } from "@/lib/api";
import type { TrendPoint, WeightEntry } from "@/lib/types";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { btnPrimary, cardPad, chart, input, listCard, pageSubtitle, pageTitle, sectionLabel } from "@/lib/ui";

function Inner() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [weight, setWeight] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [e, t] = await Promise.all([listWeights(), weightTrend(30)]);
      setEntries(e);
      setTrend(t);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const onAdd = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const n = parseFloat(weight);
    if (isNaN(n)) return;
    await createWeight(n);
    setWeight("");
    refresh();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className={pageTitle}>Weight</h1>
        <p className={pageSubtitle}>Log entries and watch the 30-day trend.</p>
      </div>

      <form onSubmit={onAdd} className={`${cardPad} flex gap-2`}>
        <input
          type="number"
          step="0.1"
          placeholder="Weight in lbs"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          required
          className={`${input} flex-1 tabular-nums`}
        />
        <button className={btnPrimary}>Log</button>
      </form>

      {err && <div className="text-sm text-red-400">{err}</div>}

      <div className={cardPad}>
        <h2 className={`${sectionLabel} mb-4`}>30-day trend</h2>
        {trend.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-500">No data yet.</div>
        ) : (
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke={chart.grid}
                  tick={{ fill: chart.tick, fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  stroke={chart.grid}
                  tick={{ fill: chart.tick, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <Tooltip
                  contentStyle={chart.tooltip}
                  labelStyle={chart.tooltipLabel}
                  itemStyle={chart.tooltipItem}
                />
                <Line
                  type="monotone"
                  dataKey="weightLbs"
                  stroke={chart.line}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: chart.line, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <section>
        <h2 className={`${sectionLabel} mb-3`}>Entries</h2>
        <div className={listCard}>
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between p-4 transition-colors hover:bg-white/[0.02]"
            >
              <div>
                <div className="font-medium tabular-nums text-gray-100">{e.weightLbs} lbs</div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {new Date(e.loggedAt).toLocaleString()} · {e.source}
                </div>
              </div>
              <button
                onClick={async () => {
                  await deleteWeight(e.id);
                  refresh();
                }}
                className="text-sm text-gray-500 transition-colors hover:text-red-400"
              >
                Delete
              </button>
            </div>
          ))}
          {entries.length === 0 && (
            <div className="p-4 text-sm text-gray-500">No entries yet.</div>
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
