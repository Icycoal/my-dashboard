import { useState, useEffect } from 'react';
import { useFinance } from '@/lib/FinanceProvider';
import { generateId, MONTH_NAMES } from '@/lib/finances/formatters';
import type { RecurrenceType } from '@/lib/finances-types';
import Modal from '@/components/finances/common/Modal';

interface TransactionDefaults {
  category?: string;
  description?: string;
  amount?: number;
  isExpense?: boolean;
  month?: number;
  day?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  defaultMonth?: number;
  defaultDay?: number;
  defaults?: TransactionDefaults;
}

const inputClass = 'mt-1.5 w-full rounded-lg border border-white/[0.08] bg-gray-950/60 px-3.5 py-2 text-sm text-gray-100 placeholder:text-gray-600 transition-colors focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/5';
const labelClass = 'block text-xs font-medium uppercase tracking-[0.06em] text-gray-500';

export default function AddTransactionForm({ open, onClose, defaultMonth, defaultDay, defaults }: Props) {
  const { state, dispatch } = useFinance();
  const [category, setCategory] = useState(defaults?.category ?? '');
  const [amount, setAmount] = useState(defaults?.amount?.toString() ?? '');
  const [isExpense, setIsExpense] = useState(defaults?.isExpense ?? true);
  const [month, setMonth] = useState((defaults?.month ?? defaultMonth ?? new Date().getMonth() + 1).toString());
  const [day, setDay] = useState((defaults?.day ?? defaultDay)?.toString() ?? '');
  const [description, setDescription] = useState(defaults?.description ?? '');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('once');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (open) {
      setCategory(defaults?.category ?? '');
      setAmount(defaults?.amount?.toString() ?? '');
      setIsExpense(defaults?.isExpense ?? true);
      setMonth((defaults?.month ?? defaultMonth ?? new Date().getMonth() + 1).toString());
      setDay((defaults?.day ?? defaultDay)?.toString() ?? '');
      setDescription(defaults?.description ?? '');
      setRecurrence('once');
      setEndDate('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !month || !day) return;
    const parsedAmount = parseFloat(amount);
    dispatch({
      type: 'ADD_TRANSACTION',
      transaction: {
        id: generateId(),
        category: category || (isExpense ? 'Expense' : 'Income'),
        amount: isExpense ? -parsedAmount : parsedAmount,
        year: state.activeYear,
        month: parseInt(month),
        day: parseInt(day),
        description: description || category || (isExpense ? 'Expense' : 'Income'),
        recurrence,
        endDate: recurrence !== 'once' && endDate ? endDate : undefined,
      },
    });
    setCategory('');
    setAmount('');
    setDescription('');
    setDay('');
    setRecurrence('once');
    setEndDate('');
    onClose();
  }

  const recurrenceOptions: { value: RecurrenceType; label: string }[] = [
    { value: 'once', label: 'One-time' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'annually', label: 'Annually' },
  ];

  const segClass = (active: boolean) =>
    `flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
      active ? 'bg-white/[0.08] text-gray-50' : 'text-gray-500 hover:text-gray-200'
    }`;

  return (
    <Modal open={open} onClose={onClose} title="Add Transaction">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-1 rounded-lg border border-white/[0.06] bg-gray-950/60 p-1">
          <button
            type="button"
            onClick={() => setIsExpense(true)}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              isExpense ? 'bg-white/[0.08] text-gray-50' : 'text-gray-500 hover:text-gray-200'
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setIsExpense(false)}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              !isExpense ? 'bg-white/[0.08] text-gray-50' : 'text-gray-500 hover:text-gray-200'
            }`}
          >
            Income
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Month</label>
            <select value={month} onChange={e => setMonth(e.target.value)} className={inputClass}>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Day</label>
            <input type="number" min="1" max="31" value={day} onChange={e => setDay(e.target.value)} className={inputClass} required />
          </div>
        </div>
        <div>
          <label className={labelClass}>Amount</label>
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={inputClass} required autoFocus />
        </div>
        <div>
          <label className={labelClass}>Recurrence</label>
          <div className="mt-1.5 flex gap-1 rounded-lg border border-white/[0.06] bg-gray-950/60 p-1">
            {recurrenceOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRecurrence(opt.value)}
                className={segClass(recurrence === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {recurrence !== 'once' && (
            <>
              <p className="mt-2 text-xs text-gray-500">
                {recurrence === 'weekly' && `Repeats every week starting ${MONTH_NAMES[parseInt(month) - 1]} ${day}`}
                {recurrence === 'monthly' && `Repeats on the ${day}th of every month`}
                {recurrence === 'annually' && `Repeats every ${MONTH_NAMES[parseInt(month) - 1]} ${day}`}
              </p>
              <div className="mt-2">
                <label className={labelClass}>End Date (optional)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className={inputClass}
                  placeholder="No end date"
                />
              </div>
            </>
          )}
        </div>
        <div>
          <label className={labelClass}>Category</label>
          <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Rent, Groceries, Subscription" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Description (optional)</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} className={inputClass} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-gray-200">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-100">
            Add
          </button>
        </div>
      </form>
    </Modal>
  );
}
