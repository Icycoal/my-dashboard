import { useMemo, useState } from 'react';
import { useFinance } from '@/lib/FinanceProvider';
import { formatCurrency, MONTH_FULL_NAMES } from '@/lib/finances/formatters';
import { getDailyBudgetSummary } from '@/lib/finances/calculations';
import SummaryCard from '@/components/finances/common/SummaryCard';

const inputClass =
  'w-32 rounded-lg border border-white/[0.08] bg-gray-950/60 px-3 py-1.5 text-sm tabular-nums text-gray-100 placeholder:text-gray-600 transition-colors focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/5';

const navBtn =
  'rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-gray-100';

export default function DailyBudgetTracker() {
  const { state, dispatch } = useFinance();

  const now = useMemo(() => new Date(), []);
  const [sel, setSel] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const summary = useMemo(() => getDailyBudgetSummary(state, sel, now), [state, sel, now]);

  const [editing, setEditing] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  function step(delta: number) {
    setSel(({ year, month }) => {
      const idx = year * 12 + (month - 1) + delta;
      return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
    });
  }
  const isCurrent = summary.status === 'current';

  function startEdit() {
    setBudgetInput(summary.override?.toString() ?? '');
    setEditing(true);
  }
  function saveBudget() {
    const parsed = parseFloat(budgetInput);
    dispatch({ type: 'SET_SPEND_BUDGET', amount: !isNaN(parsed) && parsed > 0 ? parsed : undefined });
    setEditing(false);
  }
  function clearOverride() {
    dispatch({ type: 'SET_SPEND_BUDGET', amount: undefined });
    setEditing(false);
  }

  const { totalBudget, spent, remaining, perDay, perWeek, daysLeft, weeksLeft, perCard } = summary;
  const spentPct = totalBudget > 0 ? Math.min(100, (spent / totalBudget) * 100) : 0;
  const overBudget = remaining < 0;
  const monthLabel = `${MONTH_FULL_NAMES[summary.month - 1]} ${summary.year}`;

  const leftSubtitle =
    summary.status === 'past'
      ? overBudget ? 'over budget' : 'under budget'
      : overBudget ? 'over budget' : `of ${formatCurrency(totalBudget)}`;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-50">Daily Budget</h1>
          <p className="mt-1 text-sm text-gray-500">
            {summary.status === 'past'
              ? `What you spent across your cards in ${monthLabel}.`
              : summary.status === 'future'
              ? `Your full budget for ${monthLabel}.`
              : `What you have left to spend across your cards for the rest of ${monthLabel}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <span className="text-sm text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                value={budgetInput}
                onChange={e => setBudgetInput(e.target.value)}
                placeholder={summary.cardBudgetTotal.toString()}
                className={inputClass}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') saveBudget();
                  if (e.key === 'Escape') setEditing(false);
                }}
              />
              <button
                onClick={saveBudget}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-100"
              >
                Save
              </button>
              {summary.override !== null && (
                <button
                  onClick={clearOverride}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-gray-200"
                >
                  Reset
                </button>
              )}
            </>
          ) : (
            <button
              onClick={startEdit}
              className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-gray-100"
            >
              {summary.override !== null ? 'Edit budget' : 'Set budget'}
            </button>
          )}
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-3">
        <button onClick={() => step(-1)} className={navBtn} aria-label="Previous month">‹</button>
        <span className="min-w-[150px] text-center text-sm font-medium text-gray-200">{monthLabel}</span>
        <button onClick={() => step(1)} className={navBtn} aria-label="Next month">›</button>
        {!isCurrent && (
          <button
            onClick={() => setSel({ year: now.getFullYear(), month: now.getMonth() + 1 })}
            className="text-xs font-medium text-blue-400 transition-colors hover:text-blue-300"
          >
            This month
          </button>
        )}
      </div>

      {totalBudget <= 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-gray-900/40 px-5 py-16 text-center text-sm text-gray-500">
          No budget set. Give your cards a monthly budget, or click “Set budget” to enter an overall amount.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryCard
              title="Monthly Budget"
              value={formatCurrency(totalBudget)}
              subtitle={
                summary.override !== null
                  ? 'manual override'
                  : `sum of ${perCard.filter(c => c.budget > 0).length} card budget${
                      perCard.filter(c => c.budget > 0).length === 1 ? '' : 's'
                    }`
              }
              color="blue"
            />
            <SummaryCard
              title="Spent"
              value={formatCurrency(spent)}
              subtitle={isCurrent ? 'so far this month' : 'card spend this month'}
              color="red"
            />
            <SummaryCard
              title={summary.status === 'past' ? 'Result' : 'Left to Spend'}
              value={formatCurrency(remaining)}
              subtitle={leftSubtitle}
              color={overBudget ? 'red' : 'green'}
            />
          </div>

          <section className="rounded-2xl border border-white/[0.06] bg-gray-900/40 p-5">
            <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
              <span>{formatCurrency(spent)} spent</span>
              <span>{spentPct.toFixed(0)}% of budget</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full ${overBudget ? 'bg-red-400/80' : 'bg-emerald-400/80'}`}
                style={{ width: `${spentPct}%` }}
              />
            </div>
          </section>

          {summary.status === 'past' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.06] bg-gray-900/60 px-5 py-5">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">Avg / Day</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-gray-50">
                  {formatCurrency(summary.avgPerDaySpent)}
                </p>
                <p className="mt-1 text-xs text-gray-500">average spend across {summary.daysInMonth} days</p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-gray-900/60 px-5 py-5">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">
                  {overBudget ? 'Over Budget' : 'Stayed Under'}
                </p>
                <p className={`mt-2 text-3xl font-semibold tabular-nums ${overBudget ? 'text-red-400' : 'text-emerald-400'}`}>
                  {formatCurrency(Math.abs(remaining))}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {overBudget ? 'spent more than budget' : 'left on the table'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.06] bg-gray-900/60 px-5 py-5">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">Per Day</p>
                <p className={`mt-2 text-3xl font-semibold tabular-nums ${overBudget ? 'text-red-400' : 'text-gray-50'}`}>
                  {formatCurrency(Math.max(0, perDay))}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {overBudget
                    ? 'nothing left to spend'
                    : `across ${daysLeft} day${daysLeft === 1 ? '' : 's'} ${isCurrent ? 'left in' : 'in'} the month`}
                </p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-gray-900/60 px-5 py-5">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">Per Week</p>
                <p className={`mt-2 text-3xl font-semibold tabular-nums ${overBudget ? 'text-red-400' : 'text-gray-50'}`}>
                  {formatCurrency(Math.max(0, perWeek))}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {overBudget
                    ? 'nothing left to spend'
                    : `across ${weeksLeft} week${weeksLeft === 1 ? '' : 's'} ${isCurrent ? 'left in' : 'in'} the month`}
                </p>
              </div>
            </div>
          )}

          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.08em] text-gray-500">By Card</h2>
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gray-900/40">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-[0.08em] text-gray-500">
                    <th className="px-5 py-3 text-left font-medium">Card</th>
                    <th className="px-5 py-3 text-right font-medium">Budget</th>
                    <th className="px-5 py-3 text-right font-medium">Spent</th>
                    <th className="px-5 py-3 text-right font-medium">Left</th>
                  </tr>
                </thead>
                <tbody>
                  {perCard.map(c => {
                    const cardOver = c.remaining < 0;
                    return (
                      <tr key={c.id} className="border-b border-white/[0.04] last:border-0">
                        <td className="px-5 py-3 font-medium text-gray-100">{c.name}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-gray-400">
                          {c.budget > 0 ? formatCurrency(c.budget) : '—'}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-gray-300">{formatCurrency(c.spent)}</td>
                        <td
                          className={`px-5 py-3 text-right font-medium tabular-nums ${
                            c.budget <= 0 ? 'text-gray-600' : cardOver ? 'text-red-400' : 'text-emerald-400'
                          }`}
                        >
                          {c.budget > 0 ? formatCurrency(c.remaining) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {summary.override !== null && (
              <p className="mt-2 text-xs text-gray-600">
                Per-card budgets shown for reference. Totals above use your manual budget of{' '}
                {formatCurrency(summary.override)}.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
