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

export default function AddRecurringForm({ open, onClose }: Props) {
  const { dispatch } = useFinance();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !amount || !dueDate) return;
    dispatch({
      type: 'ADD_RECURRING',
      payment: {
        id: generateId(),
        name,
        amount: parseFloat(amount),
        dueDate: parseInt(dueDate),
      },
    });
    setName('');
    setAmount('');
    setDueDate('');
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Recurring Payment">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Guitar + Apple" className={inputClass} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Amount</label>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="44.79" className={inputClass} required />
          </div>
          <div>
            <label className={labelClass}>Due Date</label>
            <input type="number" min="1" max="31" value={dueDate} onChange={e => setDueDate(e.target.value)} placeholder="Day of month" className={inputClass} required />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-gray-200">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-100">
            Add Payment
          </button>
        </div>
      </form>
    </Modal>
  );
}
