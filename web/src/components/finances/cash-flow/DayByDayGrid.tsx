import { useState, useMemo } from 'react';
import { useFinance } from '@/lib/FinanceProvider';
import { formatCurrency, MONTH_NAMES, getDaysInMonth } from '@/lib/finances/formatters';
import { calculateForwardBalances } from '@/lib/finances/calculations';
import AddTransactionForm from './AddTransactionForm';

export default function DayByDayGrid() {
  const { state } = useFinance();
  const year = state.activeYear;

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  const currentYear = today.getFullYear();

  const [addTx, setAddTx] = useState<{ month: number; day: number } | null>(null);

  const startMonth = year === currentYear ? currentMonth : 1;
  const months = Array.from({ length: 12 - startMonth + 1 }, (_, i) => startMonth + i);

  const { dailyBalances: balanceMap } = useMemo(
    () => calculateForwardBalances(state, year, 12),
    [state, year]
  );

  const maxDays = Math.max(...months.map(m => getDaysInMonth(year, m)));

  function getBalanceColor(balance: number): string {
    if (balance >= 3000) return 'text-emerald-400';
    if (balance >= 1000) return 'text-gray-100';
    if (balance >= 0) return 'text-gray-400';
    return 'bg-red-500/10 text-red-400 font-semibold';
  }

  function isPast(month: number, day: number): boolean {
    if (year < currentYear) return true;
    if (year > currentYear) return false;
    if (month < currentMonth) return true;
    if (month === currentMonth && day < currentDay) return true;
    return false;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gray-900/40">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="sticky left-0 z-10 w-12 bg-gray-900/80 px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500 backdrop-blur">
                Day
              </th>
              {months.map(m => (
                <th
                  key={m}
                  className={`min-w-[90px] px-2 py-2.5 text-center text-[11px] font-medium uppercase tracking-[0.08em] ${
                    m === currentMonth && year === currentYear
                      ? 'bg-white/[0.04] text-gray-200'
                      : 'text-gray-500'
                  }`}
                >
                  {MONTH_NAMES[m - 1]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxDays }, (_, dayIdx) => {
              const day = dayIdx + 1;
              const isToday = day === currentDay && year === currentYear;

              return (
                <tr key={day} className={`border-b border-white/[0.03] ${isToday ? 'bg-white/[0.02]' : ''}`}>
                  <td className={`sticky left-0 z-10 px-3 py-1.5 text-center font-medium tabular-nums backdrop-blur ${isToday ? 'bg-white text-gray-950' : 'bg-gray-900/90 text-gray-600'}`}>
                    {day}
                  </td>
                  {months.map(month => {
                    const daysInThisMonth = getDaysInMonth(year, month);
                    if (day > daysInThisMonth) {
                      return <td key={month} className="bg-gray-950/40 px-2 py-1.5" />;
                    }

                    const past = isPast(month, day);
                    if (past) {
                      return <td key={month} className="bg-gray-950/40 px-2 py-1.5 text-center text-gray-800">—</td>;
                    }

                    const key = `${year}-${String(month).padStart(2, '0')}`;
                    const entries = balanceMap.get(key);
                    const entry = entries?.[dayIdx];
                    if (!entry) return <td key={month} className="px-2 py-1.5" />;

                    const hasEvents = entry.events.length > 0;

                    return (
                      <td
                        key={month}
                        onClick={() => setAddTx({ month, day })}
                        className={`cursor-pointer px-2 py-1.5 text-center tabular-nums transition-colors hover:bg-white/[0.04] ${
                          getBalanceColor(entry.balance)
                        }`}
                        title={
                          entry.events.length > 0
                            ? entry.events.map(e => `${e.label}: ${formatCurrency(e.amount)}`).join('\n')
                            : undefined
                        }
                      >
                        <div className="font-medium">{formatCurrency(entry.balance)}</div>
                        {hasEvents && (
                          <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                            {entry.events.map((e, idx) => (
                              <span
                                key={idx}
                                className={`inline-block rounded px-1 text-[10px] ${
                                  e.amount > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                                }`}
                              >
                                {e.label.substring(0, 8)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {addTx && (
        <AddTransactionForm
          open
          onClose={() => setAddTx(null)}
          defaultMonth={addTx.month}
          defaultDay={addTx.day}
        />
      )}
    </div>
  );
}
