import { useMemo, useState } from 'react';
import { useFinance } from '@/lib/FinanceProvider';
import { formatCurrency, MONTH_NAMES, generateId, calcBudgetStatus } from '@/lib/finances/formatters';
import { getMonthlySpendingByCategory } from '@/lib/finances/spending';
import { getCardMonthlyBill } from '@/lib/finances/calculations';
import SummaryCard from '@/components/finances/common/SummaryCard';
import Modal from '@/components/finances/common/Modal';
import type { Budget } from '@/lib/finances-types';

const CC_BUDGET_CATEGORY = 'Credit Cards';

interface BudgetRow {
  id: string;
  category: string;
  limit: number;
  actual: number;
  remaining: number;
  pct: number;
  status: 'under' | 'near' | 'over';
}

const inputClass =
  'mt-1.5 w-full rounded-lg border border-white/[0.08] bg-gray-950/60 px-3.5 py-2 text-sm text-gray-100 placeholder:text-gray-600 transition-colors focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/5';
const labelClass = 'block text-xs font-medium uppercase tracking-[0.06em] text-gray-500';

export default function BudgetDashboard() {
  const { state, dispatch } = useFinance();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const year = state.activeYear;
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState('');
  const [showCCForm, setShowCCForm] = useState(false);
  const [ccLimitInput, setCCLimitInput] = useState('');

  const budgets = state.budgets ?? [];
  const ccBudget = budgets.find(b => b.category === CC_BUDGET_CATEGORY);
  const categoryBudgets = budgets.filter(b => b.category !== CC_BUDGET_CATEGORY);

  const spendingByCategory = useMemo(
    () => getMonthlySpendingByCategory(state, year, month),
    [state, year, month],
  );

  // Total actual CC spending this month across all cards
  const ccActual = useMemo(() => {
    return state.creditCards.reduce((sum, card) => {
      const bill = getCardMonthlyBill(state, card.id, year, month);
      const spent = bill?.spentAmount && bill.spentAmount > 0
        ? bill.spentAmount
        : bill?.billedAmount ?? 0;
      return sum + spent;
    }, 0);
  }, [state, year, month]);

  const existingCategories = useMemo(() => {
    const s = new Set<string>();
    for (const t of state.transactions) if (t.category !== 'Transfer') s.add(t.category);
    s.add('Recurring');
    return Array.from(s).sort();
  }, [state.transactions]);

  const rows = useMemo<BudgetRow[]>(() => {
    return categoryBudgets
      .map((b) => {
        const actual = spendingByCategory.get(b.category) ?? 0;
        const remaining = b.monthlyLimit - actual;
        const pct = b.monthlyLimit > 0 ? (actual / b.monthlyLimit) * 100 : 0;
        const status: BudgetRow['status'] = calcBudgetStatus(pct);
        return { id: b.id, category: b.category, limit: b.monthlyLimit, actual, remaining, pct, status };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [categoryBudgets, spendingByCategory]);

  const ccRow = useMemo<BudgetRow | null>(() => {
    if (!ccBudget) return null;
    const actual = ccActual;
    const remaining = ccBudget.monthlyLimit - actual;
    const pct = ccBudget.monthlyLimit > 0 ? (actual / ccBudget.monthlyLimit) * 100 : 0;
    const status: BudgetRow['status'] = calcBudgetStatus(pct);
    return { id: ccBudget.id, category: CC_BUDGET_CATEGORY, limit: ccBudget.monthlyLimit, actual, remaining, pct, status };
  }, [ccBudget, ccActual]);

  const unbudgeted = useMemo(() => {
    const budgetedCats = new Set(categoryBudgets.map((b) => b.category));
    const rows: { category: string; actual: number }[] = [];
    for (const [cat, actual] of spendingByCategory) {
      if (!budgetedCats.has(cat)) rows.push({ category: cat, actual });
    }
    return rows.sort((a, b) => b.actual - a.actual);
  }, [spendingByCategory, categoryBudgets]);

  const allRows = ccRow ? [ccRow, ...rows] : rows;
  const totalLimit = allRows.reduce((s, r) => s + r.limit, 0);
  const totalActual = allRows.reduce((s, r) => s + r.actual, 0);
  const totalRemaining = totalLimit - totalActual;
  const overCount = allRows.filter((r) => r.status === 'over').length;

  function openAdd() {
    setEditing(null);
    setCategory('');
    setLimit('');
    setShowForm(true);
  }

  function openEdit(b: Budget) {
    setEditing(b);
    setCategory(b.category);
    setLimit(b.monthlyLimit.toString());
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(limit);
    if (!category || isNaN(parsed) || parsed <= 0) return;
    dispatch({
      type: 'SET_BUDGET',
      budget: { id: editing?.id ?? generateId(), category, monthlyLimit: parsed },
    });
    setShowForm(false);
  }

  function openCCBudget() {
    setCCLimitInput(ccBudget?.monthlyLimit.toString() ?? '');
    setShowCCForm(true);
  }

  function saveCCBudget(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(ccLimitInput);
    if (isNaN(parsed) || parsed <= 0) {
      if (ccBudget) dispatch({ type: 'DELETE_BUDGET', id: ccBudget.id });
    } else {
      dispatch({
        type: 'SET_BUDGET',
        budget: { id: ccBudget?.id ?? generateId(), category: CC_BUDGET_CATEGORY, monthlyLimit: parsed },
      });
    }
    setShowCCForm(false);
  }

  const statusColor = {
    under: 'bg-emerald-500',
    near: 'bg-amber-500',
    over: 'bg-red-500',
  };
  const statusText = {
    under: 'text-emerald-400',
    near: 'text-amber-400',
    over: 'text-red-400',
  };

  function BudgetRowUI({ r, isCC = false }: { r: BudgetRow; isCC?: boolean }) {
    return (
      <div className="group px-5 py-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-100">{r.category}</span>
            {isCC && (
              <span className="rounded-full border border-white/[0.08] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">
                {state.creditCards.length} card{state.creditCards.length !== 1 ? 's' : ''}
              </span>
            )}
            <span className={`text-xs font-medium ${statusText[r.status]}`}>
              {r.status === 'over' ? 'Over' : r.status === 'near' ? 'Near limit' : 'On track'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm tabular-nums text-gray-400">
              <span className="text-gray-100">{formatCurrency(r.actual)}</span>
              <span className="text-gray-600"> / {formatCurrency(r.limit)}</span>
            </span>
            {isCC ? (
              <button
                onClick={openCCBudget}
                className="text-xs text-gray-600 opacity-0 transition-opacity hover:text-gray-300 group-hover:opacity-100"
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={() => openEdit({ id: r.id, category: r.category, monthlyLimit: r.limit })}
                  className="text-xs text-gray-600 opacity-0 transition-opacity hover:text-gray-300 group-hover:opacity-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => dispatch({ type: 'DELETE_BUDGET', id: r.id })}
                  className="text-sm text-gray-700 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  aria-label="Delete"
                >
                  ×
                </button>
              </>
            )}
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
          <div
            className={`h-full rounded-full ${statusColor[r.status]}`}
            style={{ width: `${Math.min(r.pct, 100)}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-gray-500">
          <span>{r.pct.toFixed(0)}% used</span>
          <span className={r.remaining < 0 ? 'text-red-400' : ''}>
            {r.remaining >= 0
              ? `${formatCurrency(r.remaining)} left`
              : `${formatCurrency(Math.abs(r.remaining))} over`}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-gray-100">Budgets</h2>
          <p className="mt-0.5 text-xs text-gray-500">Monthly targets per category · actual vs. budgeted.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border border-white/[0.06] bg-gray-900 px-3 py-1.5 text-sm text-gray-300 focus:outline-none"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>{m} {year}</option>
            ))}
          </select>
          <button
            onClick={openAdd}
            className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-100"
          >
            + Add Budget
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Total Budgeted" value={formatCurrency(totalLimit)} subtitle="across all budgets" color="blue" />
        <SummaryCard title="Total Spent" value={formatCurrency(totalActual)} subtitle={`${MONTH_NAMES[month - 1]} actual`} color={totalActual > totalLimit ? 'red' : 'purple'} />
        <SummaryCard
          title="Remaining"
          value={formatCurrency(totalRemaining)}
          subtitle={totalRemaining >= 0 ? 'left to spend' : 'over budget'}
          color={totalRemaining >= 0 ? 'green' : 'red'}
        />
        <SummaryCard
          title="Over Budget"
          value={`${overCount} / ${allRows.length}`}
          subtitle="over their limit"
          color={overCount > 0 ? 'red' : 'green'}
        />
      </div>

      {allRows.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-gray-900/40 px-5 py-16 text-center">
          <p className="text-sm text-gray-400">No budgets set yet.</p>
          <p className="mt-1 text-xs text-gray-600">Add a budget to track spending against a monthly target.</p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={openAdd}
              className="rounded-lg border border-white/[0.08] bg-gray-900 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800"
            >
              + Category Budget
            </button>
            <button
              onClick={openCCBudget}
              className="rounded-lg border border-white/[0.08] bg-gray-900 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800"
            >
              + Credit Card Budget
            </button>
          </div>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gray-900/40">
          <div className="divide-y divide-white/[0.04]">
            {ccRow && <BudgetRowUI r={ccRow} isCC />}
            {rows.map((r) => <BudgetRowUI key={r.id} r={r} />)}
            {!ccRow && state.creditCards.length > 0 && (
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <span className="text-sm text-gray-400">Credit Cards</span>
                  <span className="ml-2 text-xs text-gray-600">
                    {formatCurrency(ccActual)} spent across {state.creditCards.length} card{state.creditCards.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <button
                  onClick={openCCBudget}
                  className="rounded-md border border-white/[0.08] px-2 py-0.5 text-xs text-gray-400 transition-colors hover:bg-white/[0.04] hover:text-gray-100"
                >
                  Set budget
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {unbudgeted.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.08em] text-gray-500">Unbudgeted Spending</h2>
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gray-900/40">
            <div className="divide-y divide-white/[0.04]">
              {unbudgeted.map((u) => (
                <div key={u.category} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-gray-300">{u.category}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular-nums text-gray-100">{formatCurrency(u.actual)}</span>
                    <button
                      onClick={() => { setEditing(null); setCategory(u.category); setLimit(''); setShowForm(true); }}
                      className="rounded-md border border-white/[0.08] px-2 py-0.5 text-xs text-gray-400 transition-colors hover:bg-white/[0.04] hover:text-gray-100"
                    >
                      Set budget
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CC Budget modal */}
      <Modal open={showCCForm} onClose={() => setShowCCForm(false)} title="Credit Card Budget">
        <form onSubmit={saveCCBudget} className="space-y-4">
          <div>
            <label className={labelClass}>Monthly Limit (all cards combined)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={ccLimitInput}
              onChange={(e) => setCCLimitInput(e.target.value)}
              placeholder="e.g. 2000.00"
              className={inputClass}
              autoFocus
            />
            <p className="mt-1.5 text-xs text-gray-600">
              Tracks total spending across all {state.creditCards.length} credit card{state.creditCards.length !== 1 ? 's' : ''}. Leave blank to remove.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowCCForm(false)} className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-gray-200">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-100">
              Save
            </button>
          </div>
        </form>
      </Modal>

      {/* Category budget modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Budget' : 'Add Budget'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Category</label>
            <input
              type="text"
              list="budget-categories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Groceries, Dining, Rent"
              className={inputClass}
              required
              autoFocus
              disabled={!!editing}
            />
            <datalist id="budget-categories">
              {existingCategories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className={labelClass}>Monthly Limit</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="500.00"
              className={inputClass}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-gray-200">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-100">
              {editing ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
