import { useState } from 'react';
import { useFinance } from '@/lib/FinanceProvider';
import { generateId, MONTH_NAMES } from '@/lib/finances/formatters';
import Modal from '@/components/finances/common/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
}

const inputClass = 'mt-1.5 w-full rounded-lg border border-white/[0.08] bg-gray-950/60 px-3.5 py-2 text-sm text-gray-100 placeholder:text-gray-600 transition-colors focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/5';
const labelClass = 'block text-xs font-medium uppercase tracking-[0.06em] text-gray-500';

export default function AddPaycheckForm({ open, onClose }: Props) {
  const { state, dispatch } = useFinance();
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [day, setDay] = useState('');
  const [amount, setAmount] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!month || !day || !amount) return;
    dispatch({
      type: 'ADD_PAYCHECK',
      paycheck: {
        id: generateId(),
        year: state.activeYear,
        month: parseInt(month),
        day: parseInt(day),
        amount: parseFloat(amount),
      },
    });
    setDay('');
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Paycheck">
      <form onSubmit={handleSubmit} className="space-y-4">
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
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="2712.10" className={inputClass} required />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-gray-200">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-100">
            Add Paycheck
          </button>
        </div>
      </form>
    </Modal>
  );
}
