import { useState, useMemo } from 'react';
import { useFinance } from '@/lib/FinanceProvider';
import { formatCurrency, MONTH_NAMES } from '@/lib/finances/formatters';
import {
  getMonthlyNetPay,
  calculateBiweeklyPaycheckNet,
  getBiweeklyDatesInMonth,
} from '@/lib/finances/tax';
import { getPlannedMonthlyContribution, getContributionLimit, getContributionsTotal } from '@/lib/finances/contributions';

const recurrenceLabels = {
  once: 'One-time',
  weekly: 'Weekly',
  monthly: 'Monthly',
  annually: 'Annually',
};

const recurrenceBadge = {
  once: 'border border-white/[0.06] bg-white/[0.02] text-gray-400',
  weekly: 'border border-white/[0.08] bg-white/[0.04] text-gray-300',
  monthly: 'bg-white text-gray-950',
  annually: 'border border-white/[0.08] bg-white/[0.04] text-gray-300',
};

type Tab = 'all' | 'manual' | 'imported';

interface VirtualRow {
  id: string;
  description: string;
  amount: number;
  day: number;
  badge: string;         // text shown in the type badge
  badgeClass: string;
  deletable: false;
}

export default function TransactionList() {
  const { state, dispatch } = useFinance();

  const now = new Date();
  const [tab, setTab] = useState<Tab>('all');
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const { payConfig, activeYear: year } = state;

  // ── Virtual paycheck rows ─────────────────────────────────────────────────
  const paycheckRows = useMemo((): VirtualRow[] => {
    if (tab === 'imported') return [];

    const biweeklyStart = payConfig.biweeklyStartDate;
    const biweeklyActive = biweeklyStart
      ? new Date(year, selectedMonth - 1, 1) >= new Date(new Date(biweeklyStart + 'T12:00:00').getFullYear(), new Date(biweeklyStart + 'T12:00:00').getMonth(), 1)
      : false;

    // Monthly paycheck stops at the same cutoff as the pay table.
    const lastMonthlyPayMonth = biweeklyStart
      ? Math.min(12, new Date(biweeklyStart + 'T12:00:00').getMonth() + 2)
      : 12;

    const rows: VirtualRow[] = [];

    // Monthly paycheck row (only up to lastMonthlyPayMonth)
    if (selectedMonth <= lastMonthlyPayMonth) {
      const net = getMonthlyNetPay(payConfig, year, selectedMonth, state.holidays ?? []);
      if (net > 0) {
        rows.push({
          id: `paycheck-monthly-${selectedMonth}`,
          description: 'Paycheck (monthly net)',
          amount: net,
          day: payConfig.payDay ?? 1,
          badge: 'Paycheck',
          badgeClass: 'border border-emerald-800/40 bg-emerald-900/20 text-emerald-400',
          deletable: false,
        });
      }
    }

    // Biweekly paycheck rows (auto-calculated 401k per check)
    if (biweeklyActive && biweeklyStart) {
      const limit = getContributionLimit(state, '401k', year);
      const contributed = getContributionsTotal(state, '401k', year);
      const remaining = Math.max(0, limit - contributed);
      const fromMonth = payConfig.contrib401kFromMonth ?? 1;
      let totalChecks = 0;
      for (let m = fromMonth; m <= 12; m++) {
        totalChecks += getBiweeklyDatesInMonth(biweeklyStart, year, m).length;
      }
      const auto401kPerCheck = totalChecks > 0 ? Math.round(remaining / totalChecks * 100) / 100 : 0;

      const net = calculateBiweeklyPaycheckNet(payConfig, { traditional401kPerCheck: auto401kPerCheck }, selectedMonth);
      const days = getBiweeklyDatesInMonth(biweeklyStart, year, selectedMonth);
      for (const day of days) {
        rows.push({
          id: `paycheck-biweekly-${day}`,
          description: 'Paycheck (biweekly net)',
          amount: net,
          day,
          badge: 'Paycheck',
          badgeClass: 'border border-emerald-800/40 bg-emerald-900/20 text-emerald-400',
          deletable: false,
        });
      }
    }

    // Manual paychecks from state.paychecks for this month
    for (const p of state.paychecks ?? []) {
      if (p.year === year && p.month === selectedMonth) {
        rows.push({
          id: `manual-paycheck-${p.id}`,
          description: 'Paycheck (manual)',
          amount: p.amount,
          day: p.day,
          badge: 'Paycheck',
          badgeClass: 'border border-emerald-800/40 bg-emerald-900/20 text-emerald-400',
          deletable: false,
        });
      }
    }

    return rows;
  }, [tab, state, payConfig, year, selectedMonth]);

  // ── Virtual credit card rows ───────────────────────────��─────────────────
  const creditCardRows = useMemo((): VirtualRow[] => {
    if (tab === 'imported') return [];

    return (state.creditCards ?? []).flatMap(card => {
      // The statement that closed last month is paid this month on the due date,
      // so look up the previous month's bill — matching the cash-flow calendar.
      const billMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const billYear = selectedMonth === 1 ? year - 1 : year;
      const bill = (state.monthlyBills ?? []).find(
        b => b.cardId === card.id && b.year === billYear && b.month === billMonth
      );
      const budgetAllowed = (() => {
        if (!card.monthlyBudget || card.monthlyBudget <= 0) return false;
        if (!card.openedDate) return true;
        const opened = new Date(card.openedDate + 'T12:00:00');
        const billDate = new Date(billYear, billMonth - 1, 1);
        return billDate >= new Date(opened.getFullYear(), opened.getMonth(), 1);
      })();
      const amount = bill && bill.billedAmount > 0
        ? bill.billedAmount
        : budgetAllowed
        ? card.monthlyBudget!
        : 0;
      if (amount === 0) return [];
      const isBill = !!(bill && bill.billedAmount > 0);
      return [{
        id: `cc-${card.id}-${year}-${selectedMonth}`,
        description: card.name,
        amount: -amount,
        day: card.dueDate,
        badge: isBill ? 'Statement' : 'Budget',
        badgeClass: isBill
          ? 'border border-violet-800/40 bg-violet-900/20 text-violet-400'
          : 'border border-amber-800/40 bg-amber-900/20 text-amber-400',
        deletable: false,
      }];
    });
  }, [tab, state.creditCards, state.monthlyBills, year, selectedMonth]);

  // ── Recurring payments ───────────────────────────────────────────────────
  const recurringAsTransactions = useMemo(() => {
    if (tab === 'imported') return [];
    return (state.recurringPayments ?? []).map(r => ({
      id: `recurring-${r.id}`,
      category: 'Recurring',
      amount: -Math.abs(r.amount),
      year,
      month: selectedMonth,
      day: r.dueDate,
      description: r.name,
      recurrence: 'monthly' as const,
      plaidTransactionId: undefined as string | undefined,
      plaidAccountId: undefined as string | undefined,
    }));
  }, [state.recurringPayments, year, selectedMonth, tab]);

  const categories = useMemo(() => {
    const cats = new Set(state.transactions.map(t => t.category));
    cats.add('Recurring');
    return ['', ...Array.from(cats).sort()];
  }, [state.transactions]);

  const filtered = useMemo(() => {
    const manualAndImported = state.transactions
      .filter(t => {
        if (t.category === 'Transfer') return false;
        if (tab === 'manual' && t.plaidTransactionId) return false;
        if (tab === 'imported' && !t.plaidTransactionId) return false;
        if (t.recurrence === 'once' && (t.year !== year || t.month !== selectedMonth)) return false;
        if (t.recurrence !== 'once') {
          const startedBefore = t.year < year ||
            (t.year === year && t.month <= selectedMonth);
          if (!startedBefore) return false;
        }
        if (selectedCategory && t.category !== selectedCategory) return false;
        if (search) {
          const q = search.toLowerCase();
          if (!t.description.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q)) return false;
        }
        return true;
      });

    const recurring = recurringAsTransactions.filter(t => {
      if (selectedCategory && t.category !== selectedCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.description.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    return [...manualAndImported, ...recurring]
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [state.transactions, recurringAsTransactions, year, tab, selectedMonth, selectedCategory, search]);

  // Filter virtual rows by search
  const filteredPaychecks = useMemo(() =>
    paycheckRows.filter(r => !search || r.description.toLowerCase().includes(search.toLowerCase())),
    [paycheckRows, search]);

  const filteredCreditCards = useMemo(() =>
    creditCardRows.filter(r => !search || r.description.toLowerCase().includes(search.toLowerCase())),
    [creditCardRows, search]);

  const hasContent = state.transactions.length > 0 ||
    (state.recurringPayments ?? []).length > 0 ||
    (state.creditCards ?? []).length > 0;
  if (!hasContent) return null;

  const manualCount = state.transactions.filter(t => !t.plaidTransactionId).length;
  const importedCount = state.transactions.filter(t => !!t.plaidTransactionId).length;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium uppercase tracking-[0.08em] text-gray-500">Transactions</h2>
        <span className="text-xs text-gray-600">{filtered.length} shown</span>
      </div>

      {/* Tabs */}
      <div className="mb-3 flex gap-1">
        {([['all', `All (${state.transactions.length})`], ['manual', `Manual (${manualCount})`], ['imported', `Imported (${importedCount})`]] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t ? 'bg-white/[0.08] text-gray-100' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap gap-2">
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(Number(e.target.value))}
          className="rounded-lg border border-white/[0.06] bg-gray-900 px-3 py-1.5 text-xs text-gray-300 focus:outline-none"
        >
          {MONTH_NAMES.map((name, i) => (
            <option key={i} value={i + 1}>{name}</option>
          ))}
        </select>

        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="rounded-lg border border-white/[0.06] bg-gray-900 px-3 py-1.5 text-xs text-gray-300 focus:outline-none"
        >
          {categories.map(c => (
            <option key={c} value={c}>{c || 'All categories'}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="rounded-lg border border-white/[0.06] bg-gray-900 px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none"
        />
      </div>

      {/* Virtual paycheck + credit card rows (calendar inputs) */}
      {tab !== 'imported' && (filteredPaychecks.length > 0 || filteredCreditCards.length > 0) && (
        <div className="mb-3 overflow-hidden rounded-2xl border border-white/[0.06] bg-gray-900/40">
          <div className="border-b border-white/[0.04] px-5 py-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-gray-600">Calendar inputs · {MONTH_NAMES[selectedMonth - 1]}</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {[...filteredPaychecks, ...filteredCreditCards]
              .sort((a, b) => a.day - b.day)
              .map(row => (
                <div key={row.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${row.amount < 0 ? 'bg-red-400' : 'bg-emerald-400'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-100">{row.description}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${row.badgeClass}`}>
                          {row.badge}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {MONTH_NAMES[selectedMonth - 1]} {row.day}
                      </span>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${row.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {row.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(row.amount))}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-gray-900/40 px-5 py-8 text-center text-sm text-gray-600">
          No transactions match these filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gray-900/40">
          <div className="divide-y divide-white/[0.04]">
            {filtered.map(tx => (
              <div key={tx.id} className="group flex items-center justify-between px-5 py-3 transition-colors hover:bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${tx.amount < 0 ? 'bg-red-400' : 'bg-emerald-400'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-100">
                        {tx.description || tx.category}
                      </span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${recurrenceBadge[tx.recurrence ?? 'once']}`}>
                        {recurrenceLabels[tx.recurrence ?? 'once']}
                      </span>
                      {tx.category === 'Brokerage' && (
                        <span className="rounded-full border border-teal-800/40 bg-teal-900/20 px-1.5 py-0.5 text-[10px] font-medium text-teal-400">
                          brokerage
                        </span>
                      )}
                      {tx.plaidTransactionId && (
                        <span className="rounded-full border border-blue-800/40 bg-blue-900/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                          bank
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {tx.recurrence === 'weekly' && `Every week from ${MONTH_NAMES[tx.month - 1]} ${tx.day}`}
                      {tx.recurrence === 'monthly' && `Every month on the ${tx.day}th`}
                      {tx.recurrence === 'annually' && `Every ${MONTH_NAMES[tx.month - 1]} ${tx.day}`}
                      {(tx.recurrence === 'once' || !tx.recurrence) && `${MONTH_NAMES[tx.month - 1]} ${tx.day}, ${tx.year}`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold tabular-nums ${tx.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {tx.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(tx.amount))}
                  </span>
                  <button
                    onClick={() => dispatch({ type: 'DELETE_TRANSACTION', id: tx.id })}
                    className="text-sm text-gray-700 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                    aria-label="Delete"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
