import { useState } from 'react';
import { useFinance } from '@/lib/FinanceProvider';
import { formatCurrency, MONTH_NAMES, getCurrentMonthYear } from '@/lib/finances/formatters';
import { getCardMonthlyBill, getMonthlyTotal } from '@/lib/finances/calculations';
import Modal from '@/components/finances/common/Modal';

const inputClass = 'mt-1.5 w-full rounded-lg border border-white/[0.08] bg-gray-950/60 px-3.5 py-2 text-sm text-gray-100 placeholder:text-gray-600 transition-colors focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/5';
const labelClass = 'block text-xs font-medium uppercase tracking-[0.06em] text-gray-500';

export default function BillsTable() {
  const { state, dispatch } = useFinance();
  const year = state.activeYear;
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear();

  const [editCell, setEditCell] = useState<{ cardId: string; month: number } | null>(null);
  const [billedInput, setBilledInput] = useState('');
  const [spentInput, setSpentInput] = useState('');

  function openEdit(cardId: string, month: number) {
    const bill = getCardMonthlyBill(state, cardId, year, month);
    setBilledInput(bill?.billedAmount?.toString() ?? '');
    setSpentInput(bill?.spentAmount?.toString() ?? '');
    setEditCell({ cardId, month });
  }

  function saveEdit() {
    if (!editCell) return;
    dispatch({
      type: 'SET_BILL',
      bill: {
        cardId: editCell.cardId,
        year,
        month: editCell.month,
        billedAmount: parseFloat(billedInput) || 0,
        spentAmount: parseFloat(spentInput) || 0,
      },
    });
    setEditCell(null);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gray-900/40">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="sticky left-0 z-10 min-w-[160px] bg-gray-900/80 px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500 backdrop-blur">
                Card
              </th>
              {MONTH_NAMES.map((m, i) => (
                <th
                  key={m}
                  className={`min-w-[92px] px-3 py-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] ${
                    i + 1 === currentMonth && year === currentYear
                      ? 'bg-white/[0.04] text-gray-200'
                      : 'text-gray-500'
                  }`}
                >
                  {m}
                </th>
              ))}
              <th className="min-w-[100px] px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {state.creditCards.map(card => {
              const yearTotal = Array.from({ length: 12 }, (_, i) =>
                getCardMonthlyBill(state, card.id, year, i + 1)?.billedAmount ?? 0
              ).reduce((a, b) => a + b, 0);

              return (
                <tr key={card.id} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                  <td className="sticky left-0 z-10 bg-gray-900/90 px-4 py-3 backdrop-blur">
                    <div className="text-sm font-medium text-gray-100">{card.name}</div>
                    <div className="mt-0.5 text-xs text-gray-500">Due {card.dueDate}th</div>
                  </td>
                  {Array.from({ length: 12 }, (_, i) => {
                    const month = i + 1;
                    const bill = getCardMonthlyBill(state, card.id, year, month);
                    const isCurrentMonth = month === currentMonth && year === currentYear;
                    return (
                      <td
                        key={month}
                        onClick={() => openEdit(card.id, month)}
                        className={`cursor-pointer px-3 py-3 text-center transition-colors hover:bg-white/[0.04] ${
                          isCurrentMonth ? 'bg-white/[0.025]' : ''
                        }`}
                      >
                        {bill && bill.billedAmount > 0 ? (
                          <div>
                            <div className="text-sm font-medium tabular-nums text-gray-100">
                              {formatCurrency(bill.billedAmount)}
                            </div>
                            {bill.spentAmount > 0 && bill.spentAmount !== bill.billedAmount && (
                              <div className={`mt-0.5 text-[11px] tabular-nums ${
                                bill.spentAmount > bill.billedAmount ? 'text-red-400' : 'text-emerald-400'
                              }`}>
                                {formatCurrency(bill.spentAmount)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-700">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center text-sm font-medium tabular-nums text-gray-100">
                    {yearTotal > 0 ? formatCurrency(yearTotal) : '—'}
                  </td>
                </tr>
              );
            })}

            {state.recurringPayments.map(r => (
              <tr key={r.id} className="border-b border-white/[0.04] bg-white/[0.01]">
                <td className="sticky left-0 z-10 bg-gray-900/90 px-4 py-3 backdrop-blur">
                  <div className="text-sm font-medium text-gray-300">{r.name}</div>
                  <div className="mt-0.5 text-xs text-gray-500">Due {r.dueDate}th</div>
                </td>
                {Array.from({ length: 12 }, (_, i) => (
                  <td key={i} className="px-3 py-3 text-center text-sm tabular-nums text-gray-400">
                    {formatCurrency(r.amount)}
                  </td>
                ))}
                <td className="px-4 py-3 text-center text-sm font-medium tabular-nums text-gray-300">
                  {formatCurrency(r.amount * 12)}
                </td>
              </tr>
            ))}

            <tr className="border-t border-white/[0.08] bg-white/[0.025]">
              <td className="sticky left-0 z-10 bg-gray-900/95 px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400 backdrop-blur">
                Total
              </td>
              {Array.from({ length: 12 }, (_, i) => {
                const total = getMonthlyTotal(state, year, i + 1);
                return (
                  <td key={i} className="px-3 py-3 text-center text-sm font-medium tabular-nums text-gray-50">
                    {total > 0 ? formatCurrency(total) : '—'}
                  </td>
                );
              })}
              <td className="px-4 py-3 text-center text-sm font-semibold tabular-nums text-gray-50">
                {formatCurrency(
                  Array.from({ length: 12 }, (_, i) => getMonthlyTotal(state, year, i + 1))
                    .reduce((a, b) => a + b, 0)
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Modal
        open={editCell !== null}
        onClose={() => setEditCell(null)}
        title={`Edit ${state.creditCards.find(c => c.id === editCell?.cardId)?.name ?? ''} · ${
          editCell ? MONTH_NAMES[editCell.month - 1] : ''
        }`}
      >
        <form
          onSubmit={e => { e.preventDefault(); saveEdit(); }}
          className="space-y-4"
        >
          <div>
            <label className={labelClass}>Billed Amount</label>
            <input
              type="number"
              step="0.01"
              value={billedInput}
              onChange={e => setBilledInput(e.target.value)}
              className={inputClass}
              autoFocus
            />
          </div>
          <div>
            <label className={labelClass}>Spent (current cycle)</label>
            <input
              type="number"
              step="0.01"
              value={spentInput}
              onChange={e => setSpentInput(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditCell(null)} className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-gray-200">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-100">
              Save
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
