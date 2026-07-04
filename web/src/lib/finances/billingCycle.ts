import type { CreditCard, Transaction, MonthlyBill } from '@/lib/finances-types';

export function getBillingCycle(statementDate: number, year: number, month: number) {
  // For month M with statementDate D:
  //   cycle end:   M / D
  //   cycle start: (M-1) / (D+1)
  // e.g. statementDate=18, month=April → Mar 19 → Apr 18
  const endDate = new Date(year, month - 1, statementDate);
  let startMonth = month - 1;
  let startYear = year;
  if (startMonth < 1) { startMonth = 12; startYear--; }
  const startDate = new Date(startYear, startMonth - 1, statementDate + 1);
  return { startDate, endDate };
}

export function computeBillsFromTransactions(
  cards: CreditCard[],
  transactions: Transaction[],
): MonthlyBill[] {
  const today = new Date();
  const results: MonthlyBill[] = [];

  for (const card of cards) {
    if (!card.plaidAccountId) continue;

    // Look at: next month (open cycle) + current month + 5 months back = 7 total
    // offset -1 → next month's cycle (currently open, purchases made after stmt date)
    // offset  0 → current month's cycle
    // offset  1-5 → past cycles
    for (let offset = -1; offset <= 5; offset++) {
      let month = today.getMonth() + 1 - offset; // 1-indexed
      let year = today.getFullYear();
      while (month < 1) { month += 12; year--; }
      while (month > 12) { month -= 12; year++; }

      let { startDate, endDate } = getBillingCycle(card.statementDate, year, month);

      // Clamp the cycle start to the card's opening date so the first (shorter)
      // billing cycle doesn't pull in pre-open transactions from Plaid.
      if (card.openedDate) {
        const opened = new Date(card.openedDate + 'T12:00:00');
        if (startDate < opened) startDate = new Date(opened.getFullYear(), opened.getMonth(), opened.getDate());
      }

      const spent = transactions
        .filter(t => {
          if (t.plaidAccountId !== card.plaidAccountId) return false;
          if (t.amount >= 0) return false; // expenses only
          const txDate = new Date(t.year, t.month - 1, t.day);
          return txDate >= startDate && txDate <= endDate;
        })
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const rounded = Math.round(spent * 100) / 100;
      results.push({
        cardId: card.id,
        year,
        month,
        spentAmount: rounded,
        // If statement has closed, billedAmount = final total; if open, it's a running projection
        billedAmount: rounded,
      });
    }
  }

  return results;
}
