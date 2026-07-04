import { useState } from 'react';
import type { CreditCard } from '@/lib/finances-types';
import { useFinance } from '@/lib/FinanceProvider';
import { formatCurrency, getCurrentMonthYear } from '@/lib/finances/formatters';
import { getCardMonthlyBill } from '@/lib/finances/calculations';
import { computeBillsFromTransactions } from '@/lib/finances/billingCycle';
import Modal from '@/components/finances/common/Modal';

const inputClass = 'mt-1.5 w-full rounded-lg border border-white/[0.08] bg-gray-950/60 px-3.5 py-2 text-sm text-gray-100 placeholder:text-gray-600 transition-colors focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/5';
const labelClass = 'block text-xs font-medium uppercase tracking-[0.06em] text-gray-500';

interface Props {
  card: CreditCard;
}

export default function CardSummaryCard({ card }: Props) {
  const { state, dispatch } = useFinance();
  const [linking, setLinking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editStatementDate, setEditStatementDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editOpenedDate, setEditOpenedDate] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editBenefits, setEditBenefits] = useState('');

  const { month: currentMonth } = getCurrentMonthYear();
  const bill = getCardMonthlyBill(state, card.id, state.activeYear, currentMonth);
  const pct = bill && bill.billedAmount > 0
    ? Math.min(100, (bill.spentAmount / bill.billedAmount) * 100)
    : 0;
  const over = bill ? bill.spentAmount > bill.billedAmount : false;

  const plaidOptions = (state.plaidAccounts ?? []).flatMap(conn =>
    conn.accounts.map(a => ({ value: a.id, label: `${conn.institutionName} · ${a.name}${a.mask ? ` ····${a.mask}` : ''}` }))
  );

  function linkAccount(plaidAccountId: string) {
    dispatch({ type: 'EDIT_CARD', card: { ...card, plaidAccountId: plaidAccountId || undefined } });
    setLinking(false);
  }

  function openEdit() {
    setEditName(card.name);
    setEditStatementDate(card.statementDate.toString());
    setEditDueDate(card.dueDate.toString());
    setEditOpenedDate(card.openedDate ?? '');
    setEditBudget(card.monthlyBudget?.toString() ?? '');
    setEditBenefits(card.benefits ?? '');
    setEditing(true);
  }

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    const budget = parseFloat(editBudget);
    const updatedCard: CreditCard = {
      ...card,
      name: editName,
      statementDate: parseInt(editStatementDate),
      dueDate: parseInt(editDueDate),
      openedDate: editOpenedDate || undefined,
      monthlyBudget: !isNaN(budget) && budget > 0 ? budget : undefined,
      benefits: editBenefits || undefined,
    };
    dispatch({ type: 'EDIT_CARD', card: updatedCard });
    // Recompute bills immediately so the updated openedDate / statementDate takes effect.
    const bills = computeBillsFromTransactions([updatedCard], state.transactions);
    for (const bill of bills) dispatch({ type: 'SET_BILL', bill });
    setEditing(false);
  }

  function deleteCard() {
    if (confirm(`Delete ${card.name}? This also removes all its bill history.`)) {
      dispatch({ type: 'DELETE_CARD', cardId: card.id });
    }
  }

  const linkedAccount = plaidOptions.find(o => o.value === card.plaidAccountId);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-gray-900/60 p-5 transition-colors hover:border-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-gray-100">{card.name}</h3>
          <p className="mt-1 text-xs text-gray-500">
            Due {card.dueDate}th · Stmt {card.statementDate}th
            {card.openedDate && <span> · Opened {card.openedDate}</span>}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <button
            onClick={openEdit}
            className="mt-0.5 text-xs text-gray-600 hover:text-gray-400 transition-colors"
            title="Edit card"
          >
            Edit
          </button>
          <div className="text-right">
            <p className="text-lg font-semibold tracking-tight tabular-nums text-gray-50">
              {bill ? formatCurrency(bill.billedAmount) : '--'}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-gray-600">This month</p>
          </div>
        </div>
      </div>

      {bill && bill.spentAmount > 0 && (
        <div className="mt-4 space-y-1.5">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full ${over ? 'bg-red-400/80' : 'bg-gray-300'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs tabular-nums text-gray-500">
            {formatCurrency(bill.spentAmount)} spent
          </p>
        </div>
      )}

      {card.monthlyBudget != null && card.monthlyBudget > 0 && (() => {
        const budget = card.monthlyBudget;
        const actual = bill?.spentAmount && bill.spentAmount > 0
          ? bill.spentAmount
          : bill?.billedAmount ?? 0;
        const bpct = Math.min(100, (actual / budget) * 100);
        const bover = actual > budget;
        return (
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.08em] text-gray-600">
              <span>Budget</span>
              <span className="tabular-nums text-gray-500">{formatCurrency(budget)}</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full ${bover ? 'bg-red-400/80' : 'bg-emerald-400/80'}`}
                style={{ width: `${bpct}%` }}
              />
            </div>
          </div>
        );
      })()}

      {card.benefits && (
        <p className="mt-4 border-t border-white/[0.04] pt-3 text-xs text-gray-500">{card.benefits}</p>
      )}

      <div className="mt-3 border-t border-white/[0.04] pt-3">
        {linking ? (
          <select
            autoFocus
            defaultValue={card.plaidAccountId ?? ''}
            onChange={e => linkAccount(e.target.value)}
            onBlur={() => setLinking(false)}
            className="w-full rounded-lg border border-white/[0.08] bg-gray-950 px-2 py-1.5 text-xs text-gray-300 focus:outline-none"
          >
            <option value="">— unlinked —</option>
            {plaidOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <button
            onClick={() => setLinking(true)}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            {linkedAccount ? `⟳ ${linkedAccount.label}` : '+ Link Plaid account'}
          </button>
        )}
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title={`Edit ${card.name}`}>
        <form onSubmit={saveEdit} className="space-y-4">
          <div>
            <label className={labelClass}>Card Name</label>
            <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className={inputClass} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Statement Date</label>
              <input type="number" min="1" max="31" value={editStatementDate} onChange={e => setEditStatementDate(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Due Date</label>
              <input type="number" min="1" max="31" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} className={inputClass} required />
            </div>
          </div>
          <div>
            <label className={labelClass}>Opened Date (optional)</label>
            <input type="date" value={editOpenedDate} onChange={e => setEditOpenedDate(e.target.value)} className={inputClass} />
            <p className="mt-1.5 text-xs text-gray-600">
              First day the card was active — prevents pre-opening charges from inflating the first cycle.
            </p>
          </div>
          <div>
            <label className={labelClass}>Monthly Budget (optional)</label>
            <input type="number" step="0.01" min="0" value={editBudget} onChange={e => setEditBudget(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Benefits (optional)</label>
            <input type="text" value={editBenefits} onChange={e => setEditBenefits(e.target.value)} className={inputClass} />
          </div>
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={deleteCard}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-900/20"
            >
              Delete Card
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-gray-200">
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-100">
                Save
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
