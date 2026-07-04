import { useMemo, useState } from 'react';
import { useFinance } from '@/lib/FinanceProvider';
import { formatCurrency, generateId } from '@/lib/finances/formatters';
import {
  getContributionLimit,
  getContributionsTotal,
  getDaysLeftInYear,
} from '@/lib/finances/contributions';
import Modal from '@/components/finances/common/Modal';
import type { AccountType, Contribution } from '@/lib/finances-types';

const TRACKED_TYPES: AccountType[] = ['Roth IRA', '401k', 'HSA'];

const inputClass =
  'mt-1.5 w-full rounded-lg border border-white/[0.08] bg-gray-950/60 px-3.5 py-2 text-sm text-gray-100 placeholder:text-gray-600 transition-colors focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/5';
const labelClass = 'block text-xs font-medium uppercase tracking-[0.06em] text-gray-500';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ContributionTracker() {
  const { state, dispatch } = useFinance();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contribution | null>(null);
  const [accountType, setAccountType] = useState<AccountType>('Roth IRA');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [editingLimit, setEditingLimit] = useState<AccountType | null>(null);
  const [limitInput, setLimitInput] = useState('');

  const yearContributions = useMemo(
    () => (state.contributions ?? [])
      .filter((c) => c.year === year)
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    [state.contributions, year],
  );

  const daysLeft = getDaysLeftInYear(year);

  function openAdd(preset?: AccountType) {
    setEditing(null);
    setAccountType(preset ?? 'Roth IRA');
    setAmount('');
    setDate(todayISO());
    setNote('');
    setShowForm(true);
  }

  function openEdit(c: Contribution) {
    setEditing(c);
    setAccountType(c.accountType);
    setAmount(c.amount.toString());
    setDate(c.date ?? todayISO());
    setNote(c.note ?? '');
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) return;
    const contribution: Contribution = {
      id: editing?.id ?? generateId(),
      accountType,
      year,
      amount: parsed,
      date: date || undefined,
      note: note || undefined,
    };
    dispatch({ type: editing ? 'EDIT_CONTRIBUTION' : 'ADD_CONTRIBUTION', contribution });
    setShowForm(false);
  }

  function saveLimit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingLimit) return;
    const parsed = parseFloat(limitInput);
    if (!isNaN(parsed) && parsed > 0) {
      dispatch({ type: 'SET_CONTRIBUTION_LIMIT', year, accountType: editingLimit, limit: parsed });
    }
    setEditingLimit(null);
  }

  function openLimitEdit(type: AccountType) {
    const current = getContributionLimit(state, type, year);
    setEditingLimit(type);
    setLimitInput(current.toString());
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">{year} Contributions</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {daysLeft > 0 ? `${daysLeft} days left to hit your annual limits` : 'Year complete'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-white/[0.06] bg-gray-900 px-3 py-1.5 text-sm text-gray-300 focus:outline-none"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={() => openAdd()}
            className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-100"
          >
            + Add Contribution
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TRACKED_TYPES.map((type) => {
          const total = getContributionsTotal(state, type, year);
          const limit = getContributionLimit(state, type, year);
          const pct = limit > 0 ? Math.min(100, (total / limit) * 100) : 0;
          const remaining = limit - total;
          const monthlyPace = daysLeft > 0 && remaining > 0
            ? (remaining / daysLeft) * 30
            : 0;
          const over = limit > 0 && total > limit;

          return (
            <div key={type} className="rounded-2xl border border-white/[0.06] bg-gray-900/60 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">{type}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-gray-50">
                    {formatCurrency(total)}
                  </p>
                  {limit > 0 ? (
                    <p className="mt-1 text-xs text-gray-500">
                      of <button
                        onClick={() => openLimitEdit(type)}
                        className="underline decoration-dotted underline-offset-2 hover:text-gray-300"
                        title="Click to override the limit"
                      >
                        {formatCurrency(limit)}
                      </button> limit
                    </p>
                  ) : (
                    <button
                      onClick={() => openLimitEdit(type)}
                      className="mt-1 text-xs text-gray-500 underline decoration-dotted underline-offset-2 hover:text-gray-300"
                    >
                      Set annual limit
                    </button>
                  )}
                </div>
                <button
                  onClick={() => openAdd(type)}
                  className="rounded-md border border-white/[0.08] px-2 py-0.5 text-xs text-gray-400 transition-colors hover:bg-white/[0.04] hover:text-gray-100"
                >
                  + Add
                </button>
              </div>

              {limit > 0 && (
                <>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                    <div
                      className={`h-full rounded-full ${over ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-gray-500">
                    <span>{pct.toFixed(0)}% of limit</span>
                    <span className={remaining < 0 ? 'text-red-400' : ''}>
                      {remaining >= 0
                        ? `${formatCurrency(remaining)} left`
                        : `${formatCurrency(Math.abs(remaining))} over`}
                    </span>
                  </div>
                  {monthlyPace > 0 && (
                    <p className="mt-2 text-[11px] text-gray-600">
                      Need ~{formatCurrency(monthlyPace)}/mo to max out
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {yearContributions.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gray-900/40">
          <div className="divide-y divide-white/[0.04]">
            {yearContributions.map((c) => (
              <div key={c.id} className="group flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                    {c.accountType}
                  </span>
                  <div>
                    <div className="text-sm text-gray-100">{c.note || 'Contribution'}</div>
                    {c.date && <div className="text-xs text-gray-500">{c.date}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums text-emerald-400">
                    +{formatCurrency(c.amount)}
                  </span>
                  <button
                    onClick={() => openEdit(c)}
                    className="text-xs text-gray-600 opacity-0 transition-opacity hover:text-gray-300 group-hover:opacity-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => dispatch({ type: 'DELETE_CONTRIBUTION', id: c.id })}
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

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Contribution' : 'Add Contribution'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Account Type</label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as AccountType)}
              className={inputClass}
            >
              {(['Roth IRA', '401k', 'HSA', 'Brokerage'] as AccountType[]).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Amount</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
              required
              autoFocus
            />
          </div>
          <div>
            <label className={labelClass}>Date (optional)</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Paycheck deduction, lump sum"
              className={inputClass}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
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

      <Modal
        open={editingLimit !== null}
        onClose={() => setEditingLimit(null)}
        title={editingLimit ? `${editingLimit} · ${year} Limit` : 'Annual Limit'}
      >
        <form onSubmit={saveLimit} className="space-y-4">
          <div>
            <label className={labelClass}>Annual Limit</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              className={inputClass}
              autoFocus
            />
            <p className="mt-1.5 text-xs text-gray-600">
              Overrides the default IRS limit for {year}.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingLimit(null)}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-100"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
