import { useMemo, useState } from 'react';
import { useFinance } from '@/lib/FinanceProvider';
import { formatCurrency, generateId } from '@/lib/finances/formatters';
import SummaryCard from '@/components/finances/common/SummaryCard';
import Modal from '@/components/finances/common/Modal';
import NetWorthProjection from './NetWorthProjection';
import type { Debt } from '@/lib/finances-types';

const inputClass =
  'mt-1.5 w-full rounded-lg border border-white/[0.08] bg-gray-950/60 px-3.5 py-2 text-sm text-gray-100 placeholder:text-gray-600 transition-colors focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/5';
const labelClass = 'block text-xs font-medium uppercase tracking-[0.06em] text-gray-500';

function currentAndFutureCardBalance(
  monthlyBills: { cardId: string; year: number; month: number; billedAmount: number }[],
  cardId: string,
): number {
  const now = new Date();
  const nowYM = now.getFullYear() * 12 + now.getMonth(); // 0-indexed month
  return monthlyBills
    .filter((b) => b.cardId === cardId && b.billedAmount > 0 && (b.year * 12 + (b.month - 1)) >= nowYM)
    .reduce((sum, b) => sum + b.billedAmount, 0);
}

export default function NetWorthDashboard() {
  const { state, dispatch } = useFinance();
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [rate, setRate] = useState('');
  const [millionMilestone, setMillionMilestone] = useState<{ year: number; age: number } | null>(null);

  const cash = state.currentBalance;

  const investmentsByType = useMemo(() => {
    const latestByType = new Map<string, typeof state.rothSnapshots[number]>();
    for (const snap of state.rothSnapshots) {
      const key = snap.accountType ?? 'Roth IRA';
      const prev = latestByType.get(key);
      if (!prev || snap.importedAt > prev.importedAt) latestByType.set(key, snap);
    }
    return Array.from(latestByType.entries())
      .map(([type, snap]) => [type, snap.totalValue] as const)
      .sort((a, b) => b[1] - a[1]);
  }, [state.rothSnapshots]);

  const investmentsTotal = investmentsByType.reduce((s, [, v]) => s + v, 0);
  const latestSnapshotCount = investmentsByType.length;

  const cardBalances = useMemo(
    () => state.creditCards.map((c) => ({
      id: c.id,
      name: c.name,
      balance: currentAndFutureCardBalance(state.monthlyBills, c.id),
    })).filter((c) => c.balance > 0),
    [state.creditCards, state.monthlyBills],
  );
  const ccTotal = cardBalances.reduce((s, c) => s + c.balance, 0);

  const debts = state.debts ?? [];
  const debtsTotal = debts.reduce((s, d) => s + d.balance, 0);

  const totalAssets = cash + investmentsTotal;
  const totalLiabilities = ccTotal + debtsTotal;
  const netWorth = totalAssets - totalLiabilities;

  function openAdd() {
    setEditing(null);
    setName('');
    setBalance('');
    setRate('');
    setShowDebtForm(true);
  }

  function openEdit(d: Debt) {
    setEditing(d);
    setName(d.name);
    setBalance(d.balance.toString());
    setRate(d.interestRate?.toString() ?? '');
    setShowDebtForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedBalance = parseFloat(balance);
    const parsedRate = rate ? parseFloat(rate) : undefined;
    if (!name || isNaN(parsedBalance)) return;
    const debt: Debt = {
      id: editing?.id ?? generateId(),
      name,
      balance: parsedBalance,
      interestRate: parsedRate,
    };
    dispatch({ type: editing ? 'EDIT_DEBT' : 'ADD_DEBT', debt });
    setShowDebtForm(false);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-50">Net Worth</h1>
          <p className="mt-1 text-sm text-gray-500">Cash + investments − debts, in one view.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-gray-900/60 px-6 py-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">Net Worth</p>
        <p className={`mt-2 text-4xl font-semibold tracking-tight tabular-nums ${netWorth >= 0 ? 'text-gray-50' : 'text-red-400'}`}>
          {formatCurrency(netWorth)}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <span className="text-gray-500">
            Assets <span className="ml-1.5 tabular-nums text-emerald-400">{formatCurrency(totalAssets)}</span>
          </span>
          <span className="text-gray-500">
            Liabilities <span className="ml-1.5 tabular-nums text-red-400">{formatCurrency(totalLiabilities)}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          title="Hits $1M"
          value={millionMilestone ? `${millionMilestone.year}` : '—'}
          subtitle={millionMilestone ? `age ${millionMilestone.age}` : 'loading…'}
          color={millionMilestone ? 'green' : 'blue'}
        />
        <SummaryCard title="Cash" value={formatCurrency(cash)} subtitle="bank balance" color={cash >= 0 ? 'green' : 'red'} />
        <SummaryCard title="Investments" value={formatCurrency(investmentsTotal)} subtitle={`${latestSnapshotCount} account${latestSnapshotCount === 1 ? '' : 's'}`} color="purple" />
        <SummaryCard title="Credit Cards" value={formatCurrency(ccTotal)} subtitle={`${cardBalances.length} card${cardBalances.length === 1 ? '' : 's'} owed`} color={ccTotal > 0 ? 'red' : 'green'} />
        <SummaryCard title="Other Debts" value={formatCurrency(debtsTotal)} subtitle={`${debts.length} loan${debts.length === 1 ? '' : 's'}`} color={debtsTotal > 0 ? 'red' : 'green'} />
      </div>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-[0.08em] text-gray-500">Assets</h2>
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gray-900/40">
            <div className="divide-y divide-white/[0.04]">
              <div className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="text-sm text-gray-100">Cash</span>
                </div>
                <span className="text-sm font-semibold tabular-nums text-emerald-400">{formatCurrency(cash)}</span>
              </div>
              {investmentsByType.map(([type, value]) => (
                <div key={type} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                    <span className="text-sm text-gray-100">{type}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-gray-100">{formatCurrency(value)}</span>
                </div>
              ))}
              {investmentsByType.length === 0 && (
                <div className="px-5 py-3 text-xs text-gray-600">
                  No investment snapshots. Add one on the Investments page.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-[0.08em] text-gray-500">Liabilities</h2>
            <button
              onClick={openAdd}
              className="rounded-lg border border-white/[0.08] bg-gray-900 px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:bg-gray-800"
            >
              + Add Debt
            </button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gray-900/40">
            <div className="divide-y divide-white/[0.04]">
              {cardBalances.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    <span className="text-sm text-gray-100">{c.name}</span>
                    <span className="rounded-full border border-white/[0.08] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">Card</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-red-400">
                    −{formatCurrency(c.balance)}
                  </span>
                </div>
              ))}
              {debts.map((d) => (
                <div key={d.id} className="group flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    <span className="text-sm text-gray-100">{d.name}</span>
                    {d.interestRate != null && (
                      <span className="text-xs text-gray-500">{d.interestRate}% APR</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums text-red-400">
                      −{formatCurrency(d.balance)}
                    </span>
                    <button
                      onClick={() => openEdit(d)}
                      className="text-xs text-gray-600 opacity-0 transition-opacity hover:text-gray-300 group-hover:opacity-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => dispatch({ type: 'DELETE_DEBT', id: d.id })}
                      className="text-sm text-gray-700 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                      aria-label="Delete"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
              {cardBalances.length === 0 && debts.length === 0 && (
                <div className="px-5 py-3 text-xs text-gray-600">No liabilities tracked.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <NetWorthProjection
        startingInvestments={investmentsTotal}
        startingCash={cash}
        startingCardDebts={ccTotal}
        onMilestone={setMillionMilestone}
      />

      <Modal open={showDebtForm} onClose={() => setShowDebtForm(false)} title={editing ? 'Edit Debt' : 'Add Debt'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Student loan, Auto loan"
              className={inputClass}
              required
              autoFocus
            />
          </div>
          <div>
            <label className={labelClass}>Balance Owed</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Interest Rate (optional)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="%"
              className={inputClass}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowDebtForm(false)}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-100"
            >
              {editing ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
