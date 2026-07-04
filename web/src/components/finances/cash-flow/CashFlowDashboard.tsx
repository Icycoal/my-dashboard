import { useState, useMemo } from 'react';
import { useFinance } from '@/lib/FinanceProvider';
import { formatCurrency, MONTH_NAMES, getDaysInMonth } from '@/lib/finances/formatters';
import { calculateForwardBalances, getBiweeklyContribAmounts } from '@/lib/finances/calculations';
import { computeMilestoneYear } from '@/lib/finances/useMilestoneYear';
import { getMonthlyNetPay, calculateBiweeklyPaycheckNet, getNextBiweeklyDate } from '@/lib/finances/tax';
import { getPlannedMonthlyContribution } from '@/lib/finances/contributions';
import SummaryCard from '@/components/finances/common/SummaryCard';
import DayByDayGrid from './DayByDayGrid';
import PaySection from './PaySection';
import AddTransactionForm from './AddTransactionForm';
import TransactionList from './TransactionList';
import CreditCardDashboard from '../credit-cards/CreditCardDashboard';
import TaxSummary from './TaxSummary';

type Tab = 'overview' | 'credit-cards';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CashFlowDashboard() {
  const { state, dispatch } = useFinance();
  const [tab, setTab] = useState<Tab>('overview');
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showLogReinvestment, setShowLogReinvestment] = useState(false);
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState(state.currentBalance.toString());
  const [editingBrokerage, setEditingBrokerage] = useState(false);
  const [brokerageInput, setBrokerageInput] = useState(
    ((state.brokerageMonthlyPct ?? 0) * 100).toFixed(0)
  );

  const year = state.activeYear;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentDay = new Date().getDate();

  const milestoneYear = useMemo(() => computeMilestoneYear(state, currentYear), [state, currentYear]);

  const { dailyBalances: balanceMap, yearlyBrokerage } = useMemo(
    () => calculateForwardBalances(state, year, 12),
    [state, year]
  );
  const currentKey = `${year}-${String(currentMonth).padStart(2, '0')}`;
  const currentEntries = balanceMap.get(currentKey);
  const todayBalance = currentEntries?.[currentDay - 1]?.balance ?? state.currentBalance;
  const endOfMonthBalance = currentEntries?.[currentEntries.length - 1]?.balance ?? todayBalance;

  const endOfYearEntries = balanceMap.get(`${year}-12`);
  const endOfYearBalance = endOfYearEntries?.[endOfYearEntries.length - 1]?.balance ?? todayBalance;
  const startOfYearBalance = year === currentYear
    ? state.currentBalance
    : (balanceMap.get(`${year - 1}-12`) ?? []).at(-1)?.balance ?? state.currentBalance;
  const yearSurplus = Math.round(endOfYearBalance - startOfYearBalance);


  const payDay = state.payConfig.payDay ?? 1;
  const biweeklyStartDate = state.payConfig.biweeklyStartDate;
  const today = new Date(currentYear, currentMonth - 1, currentDay);
  const isBiweeklyActive = biweeklyStartDate
    ? today >= new Date(biweeklyStartDate + 'T12:00:00')
    : false;

  const plannedHsaNext = getPlannedMonthlyContribution(state, 'HSA', year);
  const nextPayOverrides = {
    hsaMonthly: !(state.payConfig.hsaMonthly > 0) && plannedHsaNext > 0 ? plannedHsaNext : undefined,
  };

  let nextPayNet: number;
  let nextPayLabel: string;

  if (isBiweeklyActive && biweeklyStartDate) {
    const nextDate = getNextBiweeklyDate(biweeklyStartDate, new Date(currentYear, currentMonth - 1, currentDay + 1));
    const { perCheck401k, perCheckHsa } = getBiweeklyContribAmounts(state, nextDate.getFullYear());
    nextPayNet = calculateBiweeklyPaycheckNet(state.payConfig, {
      ...nextPayOverrides,
      traditional401kPerCheck: perCheck401k,
      hsaPerCheck: perCheckHsa,
    }, nextDate.getMonth() + 1, nextDate.getFullYear());
    const mo = MONTH_NAMES[nextDate.getMonth()];
    nextPayLabel = `${mo} ${nextDate.getDate()} · biweekly net`;
  } else {
    let nextPayMonth = currentDay >= payDay ? currentMonth + 1 : currentMonth;
    let nextPayYear = year;
    if (nextPayMonth > 12) { nextPayMonth = 1; nextPayYear++; }
    nextPayNet = getMonthlyNetPay(state.payConfig, nextPayYear, nextPayMonth, state.holidays ?? [], nextPayOverrides);
    nextPayLabel = `${MONTH_NAMES[nextPayMonth - 1]} ${payDay} · net`;
  }

  const upcomingBills = state.creditCards
    .filter(c => c.dueDate >= currentDay)
    .sort((a, b) => a.dueDate - b.dueDate);
  const nextBillCard = upcomingBills[0];

  function saveBrokerage() {
    const pct = parseFloat(brokerageInput) || 0;
    dispatch({ type: 'SET_BROKERAGE_PCT', pct: pct / 100 });
    setEditingBrokerage(false);
  }

  function saveBalance() {
    dispatch({
      type: 'SET_CURRENT_BALANCE',
      balance: parseFloat(balanceInput) || 0,
      date: todayISO(),
    });
    setEditingBalance(false);
  }

  const tabClass = (t: Tab) =>
    `rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
      tab === t ? 'bg-white/[0.08] text-gray-100' : 'text-gray-500 hover:text-gray-300'
    }`;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-50">Cash Flow</h1>
          <p className="mt-1 text-sm text-gray-500">Track balance, paychecks, and upcoming transactions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex max-w-[224px] items-center gap-1 overflow-x-auto rounded-lg border border-white/[0.06] bg-gray-900/60 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {Array.from({ length: milestoneYear - currentYear + 1 }, (_, i) => currentYear + i).map(y => (
              <button
                key={y}
                onClick={() => dispatch({ type: 'SET_YEAR', year: y })}
                className={`flex-shrink-0 rounded-md px-2.5 py-1 text-sm font-medium tabular-nums transition-colors ${
                  y === year
                    ? 'bg-white/[0.08] text-gray-100'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <button className={tabClass('overview')} onClick={() => setTab('overview')}>Overview</button>
            <button className={tabClass('credit-cards')} onClick={() => setTab('credit-cards')}>Credit Cards</button>
          </div>
        </div>
      </div>

      {tab === 'overview' ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard
              title="Current Balance"
              value={formatCurrency(todayBalance)}
              subtitle={`as of ${MONTH_NAMES[currentMonth - 1]} ${currentDay}`}
              color={todayBalance >= 0 ? 'green' : 'red'}
            />
            <SummaryCard
              title="Next Paycheck"
              value={formatCurrency(nextPayNet)}
              subtitle={nextPayLabel}
              color="blue"
            />
            <SummaryCard
              title="Next Bill Due"
              value={nextBillCard ? nextBillCard.name : 'None'}
              subtitle={nextBillCard ? `Due on the ${nextBillCard.dueDate}th` : undefined}
              color="amber"
            />
            <SummaryCard
              title="End of Month"
              value={formatCurrency(endOfMonthBalance)}
              subtitle="projected balance"
              color={endOfMonthBalance >= 0 ? 'purple' : 'red'}
            />
            <SummaryCard
              title="Dec 31 Balance"
              value={formatCurrency(endOfYearBalance)}
              subtitle={`${yearSurplus >= 0 ? '+' : ''}${formatCurrency(yearSurplus)} vs today`}
              color={endOfYearBalance >= 0 ? 'green' : 'red'}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-gray-900/60 px-3.5 py-2">
              <span className="text-xs uppercase tracking-[0.06em] text-gray-500">Balance</span>
              {editingBalance ? (
                <form onSubmit={e => { e.preventDefault(); saveBalance(); }} className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={balanceInput}
                    onChange={e => setBalanceInput(e.target.value)}
                    className="w-24 rounded-md border border-white/[0.08] bg-gray-950/60 px-2 py-1 text-sm tabular-nums text-gray-100 focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/5"
                    autoFocus
                  />
                  <button type="submit" className="text-xs font-medium text-gray-100 hover:text-white">Save</button>
                  <button type="button" onClick={() => setEditingBalance(false)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                </form>
              ) : (
                <button
                  onClick={() => { setBalanceInput(state.currentBalance.toString()); setEditingBalance(true); }}
                  className="text-sm font-semibold tabular-nums text-gray-50 hover:text-white"
                >
                  {formatCurrency(state.currentBalance)}
                </button>
              )}
              <span className="text-xs text-gray-600">· set {state.currentBalanceDate}</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-gray-900/60 px-3.5 py-2">
              <span className="text-xs uppercase tracking-[0.06em] text-gray-500">Invest</span>
              {editingBrokerage ? (
                <form onSubmit={e => { e.preventDefault(); saveBrokerage(); }} className="flex items-center gap-1">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={brokerageInput}
                    onChange={e => setBrokerageInput(e.target.value)}
                    className="w-14 rounded-md border border-white/[0.08] bg-gray-950/60 px-2 py-1 text-sm tabular-nums text-gray-100 focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/5"
                    autoFocus
                  />
                  <span className="text-sm text-gray-500">%</span>
                  <button type="submit" className="text-xs font-medium text-gray-100 hover:text-white">Save</button>
                  <button type="button" onClick={() => setEditingBrokerage(false)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                </form>
              ) : (
                <button
                  onClick={() => { setBrokerageInput(((state.brokerageMonthlyPct ?? 0) * 100).toFixed(0)); setEditingBrokerage(true); }}
                  className="text-sm font-semibold tabular-nums text-gray-50 hover:text-white"
                >
                  {((state.brokerageMonthlyPct ?? 0) * 100).toFixed(0)}%
                </button>
              )}
              <span className="text-xs text-gray-600">· of monthly balance</span>
            </div>
            {(state.brokerageMonthlyPct ?? 0) > 0 && (
              <button
                onClick={() => setShowLogReinvestment(true)}
                className="rounded-lg border border-teal-800/40 bg-teal-900/20 px-3.5 py-2 text-sm font-medium text-teal-400 transition-colors hover:bg-teal-900/30"
              >
                Log Reinvestment
              </button>
            )}
            <button
              onClick={() => setShowAddTransaction(true)}
              className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-100"
            >
              + Add Transaction
            </button>
          </div>

          <PaySection yearlyAutoInvest={yearlyBrokerage.get(year) ?? 0} />

          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-medium uppercase tracking-[0.08em] text-gray-500">Daily Balance · {year}</h2>
              <p className="text-xs text-gray-600">Paychecks auto-deposit on the {payDay}. Click a cell to add.</p>
            </div>
            <DayByDayGrid />
          </section>

          <TransactionList />
          <TaxSummary />

          <AddTransactionForm open={showAddTransaction} onClose={() => setShowAddTransaction(false)} />
          <AddTransactionForm
            open={showLogReinvestment}
            onClose={() => setShowLogReinvestment(false)}
            defaults={{
              category: 'Brokerage',
              description: 'Brokerage Reinvestment',
              amount: endOfMonthBalance > 0
                ? Math.round(endOfMonthBalance * (state.brokerageMonthlyPct ?? 0) * 100) / 100
                : 0,
              isExpense: true,
              month: currentMonth,
              day: getDaysInMonth(currentYear, currentMonth),
            }}
          />
        </>
      ) : (
        <CreditCardDashboard />
      )}
    </div>
  );
}
