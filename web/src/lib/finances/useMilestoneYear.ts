import type { FinanceState } from '@/lib/finances-types';
import { calculateYearlySchedule } from './calculations';
import { financeSettings } from '@/lib/clientSettings';

/**
 * Returns the first projected calendar year when net worth reaches $1M,
 * using a 10% annual return and contributions from the yearly pay schedule.
 * Used to size year pickers and schedule tables across the app.
 */
export function computeMilestoneYear(state: FinanceState, currentYear: number): number {
  const RETURN   = 0.10;
  const HORIZON  = 60;
  const FALLBACK = currentYear + 40;

  // Latest investment value per account type
  const latestByType = new Map<string, { value: number; importedAt: string }>();
  for (const snap of state.rothSnapshots) {
    const key  = snap.accountType ?? 'Roth IRA';
    const prev = latestByType.get(key);
    if (!prev || snap.importedAt > prev.importedAt) {
      latestByType.set(key, { value: snap.totalValue, importedAt: snap.importedAt });
    }
  }
  const investmentsNow = Array.from(latestByType.values()).reduce((s, v) => s + v.value, 0)
    + state.currentBalance * financeSettings().surplusBrokerageRatio;

  // Liabilities
  const ccTotal = state.creditCards.reduce((sum, card) => {
    const bill = state.monthlyBills
      .filter(b => b.cardId === card.id && b.billedAmount > 0)
      .sort((a, b) => (b.year - a.year) * 12 + (b.month - a.month))[0];
    return sum + (bill?.billedAmount ?? 0);
  }, 0);
  const startingDebts = ccTotal + (state.debts ?? []).reduce((s, d) => s + d.balance, 0);

  const schedule = calculateYearlySchedule(state, currentYear, currentYear + HORIZON);
  const lastSched = schedule[currentYear + HORIZON];

  let bal = investmentsNow;
  for (let y = 1; y <= HORIZON; y++) {
    const sched = schedule[currentYear + y - 1] ?? lastSched;
    bal = bal * (1 + RETURN) + (sched?.investmentContribs ?? 0);
    if (bal - startingDebts >= 1_000_000) return currentYear + y;
  }

  return FALLBACK;
}
