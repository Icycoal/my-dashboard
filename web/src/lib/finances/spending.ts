import type { FinanceState, Transaction } from '@/lib/finances-types';
import { getDaysInMonth } from './formatters';
import { MS_PER_DAY } from './constants';

function occurrencesInMonth(tx: Transaction, year: number, month: number): number {
  const txStart = new Date(tx.year, tx.month - 1, tx.day);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month - 1, getDaysInMonth(year, month));
  if (monthEnd < txStart) return 0;
  if (tx.endDate) {
    const [ey, em, ed] = tx.endDate.split('-').map(Number);
    if (monthStart > new Date(ey, em - 1, ed)) return 0;
  }

  switch (tx.recurrence) {
    case 'once':
      return tx.year === year && tx.month === month ? 1 : 0;
    case 'weekly': {
      const first = txStart < monthStart ? monthStart : txStart;
      const firstDiff = Math.round((first.getTime() - txStart.getTime()) / MS_PER_DAY);
      const offset = (7 - (firstDiff % 7)) % 7;
      let count = 0;
      const cursor = new Date(first);
      cursor.setDate(cursor.getDate() + offset);
      while (cursor <= monthEnd) {
        count++;
        cursor.setDate(cursor.getDate() + 7);
      }
      return count;
    }
    case 'monthly':
      return year > tx.year || (year === tx.year && month >= tx.month) ? 1 : 0;
    case 'annually':
      return month === tx.month && year >= tx.year ? 1 : 0;
    default:
      return 0;
  }
}

/**
 * Returns category -> total spent (positive number) for the given month.
 * Includes manual + imported transactions (expenses only) and recurringPayments.
 * Excludes "Transfer" category.
 */
export function getMonthlySpendingByCategory(
  state: FinanceState,
  year: number,
  month: number,
): Map<string, number> {
  const result = new Map<string, number>();

  for (const tx of state.transactions) {
    if (tx.category === 'Transfer') continue;
    if (tx.amount >= 0) continue;
    const count = occurrencesInMonth(tx, year, month);
    if (count === 0) continue;
    const spent = Math.abs(tx.amount) * count;
    result.set(tx.category, (result.get(tx.category) ?? 0) + spent);
  }

  for (const r of state.recurringPayments ?? []) {
    if (r.amount <= 0) continue;
    result.set('Recurring', (result.get('Recurring') ?? 0) + r.amount);
  }

  return result;
}

export function getMonthlySpendingTotal(state: FinanceState, year: number, month: number): number {
  let total = 0;
  for (const v of getMonthlySpendingByCategory(state, year, month).values()) total += v;
  return total;
}

export function getMonthlyIncome(state: FinanceState, year: number, month: number): number {
  let total = 0;
  for (const tx of state.transactions) {
    if (tx.category === 'Transfer') continue;
    if (tx.amount <= 0) continue;
    total += tx.amount * occurrencesInMonth(tx, year, month);
  }
  return total;
}
