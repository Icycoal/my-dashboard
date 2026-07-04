import { useState } from 'react';
import { useFinance } from '@/lib/FinanceProvider';
import { generateId } from '@/lib/finances/formatters';
import Modal from '@/components/finances/common/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
}

const inputClass = 'mt-1.5 w-full rounded-lg border border-white/[0.08] bg-gray-950/60 px-3.5 py-2 text-sm text-gray-100 placeholder:text-gray-600 transition-colors focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/5';
const labelClass = 'block text-xs font-medium uppercase tracking-[0.06em] text-gray-500';

export default function AddCardForm({ open, onClose }: Props) {
  const { dispatch } = useFinance();
  const [name, setName] = useState('');
  const [statementDate, setStatementDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [openedDate, setOpenedDate] = useState('');
  const [benefits, setBenefits] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !statementDate || !dueDate) return;
    const budget = parseFloat(monthlyBudget);
    dispatch({
      type: 'ADD_CARD',
      card: {
        id: generateId(),
        name,
        statementDate: parseInt(statementDate),
        dueDate: parseInt(dueDate),
        openedDate: openedDate || undefined,
        benefits: benefits || undefined,
        monthlyBudget: !isNaN(budget) && budget > 0 ? budget : undefined,
      },
    });
    setName('');
    setStatementDate('');
    setDueDate('');
    setOpenedDate('');
    setBenefits('');
    setMonthlyBudget('');
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Credit Card">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Card Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Freedom Flex" className={inputClass} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Statement Date</label>
            <input type="number" min="1" max="31" value={statementDate} onChange={e => setStatementDate(e.target.value)} placeholder="Day of month" className={inputClass} required />
          </div>
          <div>
            <label className={labelClass}>Due Date</label>
            <input type="number" min="1" max="31" value={dueDate} onChange={e => setDueDate(e.target.value)} placeholder="Day of month" className={inputClass} required />
          </div>
        </div>
        <div>
          <label className={labelClass}>Opened Date (optional)</label>
          <input type="date" value={openedDate} onChange={e => setOpenedDate(e.target.value)} className={inputClass} />
          <p className="mt-1.5 text-xs text-gray-600">
            First day the card was active. Used to avoid including pre-opening charges in the first billing cycle.
          </p>
        </div>
        <div>
          <label className={labelClass}>Monthly Budget (optional)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={monthlyBudget}
            onChange={e => setMonthlyBudget(e.target.value)}
            placeholder="Projected spend for cash flow"
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-gray-600">
            Used as the projected charge for months with no billed amount yet.
          </p>
        </div>
        <div>
          <label className={labelClass}>Benefits (optional)</label>
          <input type="text" value={benefits} onChange={e => setBenefits(e.target.value)} placeholder="e.g. 5% on groceries" className={inputClass} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-gray-200">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-100">
            Add Card
          </button>
        </div>
      </form>
    </Modal>
  );
}
