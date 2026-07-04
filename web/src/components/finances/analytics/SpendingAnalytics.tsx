import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  LineChart, Line,
} from 'recharts';
import { useFinance } from '@/lib/FinanceProvider';
import { formatCurrency, MONTH_NAMES } from '@/lib/finances/formatters';
import { getMonthlySpendingByCategory, getMonthlySpendingTotal } from '@/lib/finances/spending';
import SummaryCard from '@/components/finances/common/SummaryCard';

const PALETTE = [
  '#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa',
  '#f87171', '#22d3ee', '#fb923c', '#4ade80', '#c084fc',
  '#e879f9', '#2dd4bf',
];

export default function SpendingAnalytics() {
  const { state } = useFinance();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const year = state.activeYear;
  const [range, setRange] = useState<3 | 6 | 12>(6);

  const months = useMemo(() => {
    const arr: { year: number; month: number; label: string }[] = [];
    let y = year;
    let m = currentMonth;
    for (let i = 0; i < range; i++) {
      arr.unshift({ year: y, month: m, label: `${MONTH_NAMES[m - 1]} ${String(y).slice(2)}` });
      m--;
      if (m < 1) { m = 12; y--; }
    }
    return arr;
  }, [year, currentMonth, range]);

  const perMonth = useMemo(
    () => months.map(m => ({ ...m, byCategory: getMonthlySpendingByCategory(state, m.year, m.month) })),
    [state, months],
  );

  const allCategories = useMemo(() => {
    const totals = new Map<string, number>();
    for (const pm of perMonth) {
      for (const [cat, amt] of pm.byCategory) {
        totals.set(cat, (totals.get(cat) ?? 0) + amt);
      }
    }
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [perMonth]);

  const categoryColor = useMemo(() => {
    const map = new Map<string, string>();
    allCategories.forEach((c, i) => map.set(c, PALETTE[i % PALETTE.length]));
    return map;
  }, [allCategories]);

  const chartData = useMemo(
    () => perMonth.map(pm => {
      const row: Record<string, number | string> = { label: pm.label };
      for (const cat of allCategories) row[cat] = pm.byCategory.get(cat) ?? 0;
      return row;
    }),
    [perMonth, allCategories],
  );

  const trendData = useMemo(
    () => perMonth.map(pm => ({ label: pm.label, total: getMonthlySpendingTotal(state, pm.year, pm.month) })),
    [perMonth, state],
  );

  const thisMonthTotal = trendData[trendData.length - 1]?.total ?? 0;
  const prevMonthTotal = trendData[trendData.length - 2]?.total ?? 0;
  const avgTotal = trendData.length
    ? trendData.reduce((s, d) => s + d.total, 0) / trendData.length
    : 0;
  const momChange = prevMonthTotal > 0
    ? ((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100
    : 0;

  const thisMonthByCategory = useMemo(() => {
    const entries = Array.from(perMonth[perMonth.length - 1]?.byCategory.entries() ?? []);
    return entries.sort((a, b) => b[1] - a[1]);
  }, [perMonth]);

  const hasData = chartData.some(d => allCategories.some(c => (d[c] as number) > 0));

  const rangeClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
      active ? 'bg-white/[0.08] text-gray-100' : 'text-gray-500 hover:text-gray-300'
    }`;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-50">Spending Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Where your money goes, broken down by category.</p>
        </div>
        <div className="flex gap-1">
          <button className={rangeClass(range === 3)} onClick={() => setRange(3)}>3M</button>
          <button className={rangeClass(range === 6)} onClick={() => setRange(6)}>6M</button>
          <button className={rangeClass(range === 12)} onClick={() => setRange(12)}>12M</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          title="This Month"
          value={formatCurrency(thisMonthTotal)}
          subtitle={`${MONTH_NAMES[currentMonth - 1]} ${year}`}
          color="red"
        />
        <SummaryCard
          title={`${range}-Month Avg`}
          value={formatCurrency(avgTotal)}
          subtitle="average monthly spend"
          color="blue"
        />
        <SummaryCard
          title="vs. Last Month"
          value={prevMonthTotal > 0 ? `${momChange >= 0 ? '+' : ''}${momChange.toFixed(1)}%` : '—'}
          subtitle={prevMonthTotal > 0 ? formatCurrency(thisMonthTotal - prevMonthTotal) : 'no prior data'}
          color={momChange > 0 ? 'red' : 'green'}
        />
      </div>

      {!hasData ? (
        <div className="rounded-2xl border border-white/[0.06] bg-gray-900/40 px-5 py-16 text-center text-sm text-gray-500">
          No spending in the selected range. Add transactions or sync an account to see analytics.
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-white/[0.06] bg-gray-900/40 p-5">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.08em] text-gray-500">
              By Category · Monthly
            </h2>
            <div style={{ width: '100%', height: 340 }}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="label" stroke="#69718a" tick={{ fill: '#97a0b5', fontSize: 12 }} />
                  <YAxis
                    stroke="#69718a"
                    tick={{ fill: '#97a0b5', fontSize: 12 }}
                    tickFormatter={(v) => `$${Math.round(v).toLocaleString()}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(17,20,29,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#dde1ea' }}
                    formatter={(v: number) => formatCurrency(v)}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#97a0b5' }} />
                  {allCategories.map(cat => (
                    <Bar key={cat} dataKey={cat} stackId="spend" fill={categoryColor.get(cat)} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.06] bg-gray-900/40 p-5">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.08em] text-gray-500">
              Total Spend Trend
            </h2>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="label" stroke="#69718a" tick={{ fill: '#97a0b5', fontSize: 12 }} />
                  <YAxis
                    stroke="#69718a"
                    tick={{ fill: '#97a0b5', fontSize: 12 }}
                    tickFormatter={(v) => `$${Math.round(v).toLocaleString()}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(17,20,29,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#dde1ea' }}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                  <Line type="monotone" dataKey="total" stroke="#60a5fa" strokeWidth={2} dot={{ fill: '#60a5fa', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.08em] text-gray-500">
              This Month · By Category
            </h2>
            {thisMonthByCategory.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-gray-900/40 px-5 py-8 text-center text-sm text-gray-600">
                No spending recorded yet for {MONTH_NAMES[currentMonth - 1]}.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gray-900/40">
                <div className="divide-y divide-white/[0.04]">
                  {thisMonthByCategory.map(([cat, amt]) => {
                    const pct = thisMonthTotal > 0 ? (amt / thisMonthTotal) * 100 : 0;
                    return (
                      <div key={cat} className="px-5 py-3">
                        <div className="mb-1.5 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: categoryColor.get(cat) }} />
                            <span className="text-sm font-medium text-gray-100">{cat}</span>
                            <span className="text-xs text-gray-500">{pct.toFixed(0)}%</span>
                          </div>
                          <span className="text-sm font-semibold tabular-nums text-gray-100">
                            {formatCurrency(amt)}
                          </span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-white/[0.04]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: categoryColor.get(cat) }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
