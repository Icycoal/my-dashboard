import { useState } from 'react';
import { useFinance } from '@/lib/FinanceProvider';
import { formatCurrency, MONTH_FULL_NAMES, getCurrentMonthYear } from '@/lib/finances/formatters';
import { getMonthlyTotal, getMonthlySpentTotal } from '@/lib/finances/calculations';
import SummaryCard from '@/components/finances/common/SummaryCard';
import CardSummaryCard from './CardSummaryCard';
import BillsTable from './BillsTable';
import AddCardForm from './AddCardForm';
import AddRecurringForm from './AddRecurringForm';
import BudgetDashboard from '../budgets/BudgetDashboard';

export default function CreditCardDashboard() {
  const { state } = useFinance();
  const [showAddCard, setShowAddCard] = useState(false);
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const year = state.activeYear;
  const { month: currentMonth } = getCurrentMonthYear();
  const monthTotal = getMonthlyTotal(state, year, currentMonth);
  const monthSpent = getMonthlySpentTotal(state, year, currentMonth);

  const today = new Date().getDate();
  const nextDueCard = [...state.creditCards]
    .sort((a, b) => a.dueDate - b.dueDate)
    .find(c => c.dueDate >= today) ?? state.creditCards[0];

  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? year - 1 : year;
  const prevTotal = getMonthlyTotal(state, prevYear, prevMonth);
  const change = prevTotal > 0 ? ((monthTotal - prevTotal) / prevTotal) * 100 : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-50">Credit Cards</h1>
        <p className="mt-1 text-sm text-gray-500">Track bills, due dates, and monthly totals.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          title={`${MONTH_FULL_NAMES[currentMonth - 1]} Total`}
          value={monthTotal > 0 ? formatCurrency(monthTotal) : '$0.00'}
          subtitle={`${state.creditCards.length} cards`}
          color="blue"
        />
        <SummaryCard
          title="Next Due"
          value={nextDueCard ? `${nextDueCard.name}` : 'No cards'}
          subtitle={nextDueCard ? `Due on the ${nextDueCard.dueDate}th` : undefined}
          color="amber"
        />
        <SummaryCard
          title="vs Last Month"
          value={prevTotal > 0 ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}%` : '--'}
          subtitle={monthSpent > 0 ? `${formatCurrency(monthSpent)} spent so far` : undefined}
          color={change > 0 ? 'red' : 'green'}
        />
      </div>

      {state.creditCards.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {state.creditCards.map(card => (
            <CardSummaryCard key={card.id} card={card} />
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setShowAddCard(true)}
          className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-100"
        >
          + Add Card
        </button>
        <button
          onClick={() => setShowAddRecurring(true)}
          className="rounded-lg border border-white/[0.08] px-3.5 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-gray-100"
        >
          + Add Recurring Payment
        </button>
      </div>

      {state.creditCards.length > 0 ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-medium uppercase tracking-[0.08em] text-gray-500">Monthly Bills · {year}</h2>
          </div>
          <BillsTable />
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/[0.08] p-12 text-center">
          <p className="text-gray-400">No credit cards added yet.</p>
          <p className="mt-1 text-sm text-gray-600">Click "Add Card" to get started.</p>
        </div>
      )}

      <div className="border-t border-white/[0.06] pt-8">
        <BudgetDashboard />
      </div>

      <AddCardForm open={showAddCard} onClose={() => setShowAddCard(false)} />
      <AddRecurringForm open={showAddRecurring} onClose={() => setShowAddRecurring(false)} />
    </div>
  );
}
