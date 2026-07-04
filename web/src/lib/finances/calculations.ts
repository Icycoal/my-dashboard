import type { FinanceState, Transaction, YearlyPaySchedule } from '@/lib/finances-types';
import { getDaysInMonth } from './formatters';
import { getMonthlyNetPay, getBiweeklyDatesInMonth, calculateBiweeklyPaycheckNet, calculateMonthlyPaycheck, calculateBiweeklyBreakdown, getEffectiveHourlyRate, calculateAnnualFederalTax, getStandardDeduction, type AnnualTaxSummary } from './tax';
import { getContributionLimit, getContributionsTotal } from './contributions';
import { getMortgageInfo, getMonthlyOwnershipCosts, isOwnedMonth, isOnOrAfterPurchase, isMortgageActiveMonth, isRentCategory } from './realEstate';
import { BIWEEKLY_CHECKS_PER_YEAR, BIWEEKLY_DAYS_PER_CHECK } from './constants';
import { financeSettings } from '@/lib/clientSettings';

/**
 * Single source of truth for per-check 401k and HSA amounts. Used by PaySection, cash flow, and projection.
 * `annual401k`/`annualHsa` are the true full-year totals — already-logged lump-sum
 * contributions (e.g. maxed out early, outside payroll) plus whatever's left to
 * withhold from remaining paychecks. perCheck drops to 0 once a limit is already met,
 * but the annual total still reflects the money that was actually invested this year.
 */
export function getBiweeklyContribAmounts(
  state: FinanceState,
  year: number,
): { perCheck401k: number; perCheckHsa: number; numChecks: number; annual401k: number; annualHsa: number } {
  const { payConfig } = state;
  if (!payConfig.biweeklyStartDate) return { perCheck401k: 0, perCheckHsa: 0, numChecks: 0, annual401k: 0, annualHsa: 0 };

  const biweeklyStartYear = new Date(payConfig.biweeklyStartDate + 'T12:00:00').getFullYear();
  const fromMonth = year > biweeklyStartYear ? 1 : (payConfig.contrib401kFromMonth ?? 1);
  let numChecks = 0;
  for (let m = fromMonth; m <= 12; m++) {
    numChecks += getBiweeklyDatesInMonth(payConfig.biweeklyStartDate, year, m).length;
  }

  const limit401k = getContributionLimit(state, '401k', year);
  const limitHsa   = getContributionLimit(state, 'HSA',  year);
  const contributed401k = getContributionsTotal(state, '401k', year);
  const contributedHsa  = getContributionsTotal(state, 'HSA',  year);

  const { defaultEmployee401kPct } = financeSettings();
  // Employee eligibility runs off contrib401kFromMonth (already applied via `fromMonth`
  // above), independent of the employer-match waiting period. An explicit per-year
  // contributionLimits override (e.g. a manually chosen catch-up target) is used
  // directly as the target rather than being capped by the standing %-of-gross rate.
  const contribPct  = (payConfig.employeeContrib401kPct ?? defaultEmployee401kPct) / 100;
  // Mirrors calculateYearlySchedule's "second half" convention: with a mid-year raise (via
  // salaryByYear or annualRaisePct), rate from July on is the representative rate for a
  // target spread evenly across the remaining checks, since almost every year's remaining
  // checks extend into H2.
  const effectiveRate = getEffectiveHourlyRate(payConfig, year, 7);
  const grossPerCheck = effectiveRate * payConfig.hoursPerDay * BIWEEKLY_DAYS_PER_CHECK;
  const hasExplicit401kLimit = state.contributionLimits?.[`${year}-401k`] != null;
  const target401k  = hasExplicit401kLimit
    ? limit401k
    : Math.min(limit401k, contribPct * grossPerCheck * BIWEEKLY_CHECKS_PER_YEAR);
  const remaining401k = Math.max(0, target401k - contributed401k);
  const perCheck401k = numChecks > 0 ? Math.round(remaining401k / numChecks * 100) / 100 : 0;

  const remainingHsa = Math.max(0, limitHsa - contributedHsa);
  const perCheckHsa  = numChecks > 0 ? Math.round(remainingHsa / numChecks * 100) / 100 : 0;

  const annual401k = Math.round((contributed401k + perCheck401k * numChecks) * 100) / 100;
  const annualHsa  = Math.round((contributedHsa  + perCheckHsa  * numChecks) * 100) / 100;

  return { perCheck401k, perCheckHsa, numChecks, annual401k, annualHsa };
}

export function getMonthlyTotal(state: FinanceState, year: number, month: number): number {
  const billsTotal = state.creditCards.reduce((sum, card) => {
    const bill = state.monthlyBills.find(
      b => b.cardId === card.id && b.year === year && b.month === month
    );
    // Totals reflect actual billed amounts only. monthlyBudget is a spending
    // cap (used for the budget bar), not a stand-in for an amount due.
    if (bill && bill.billedAmount > 0) return sum + bill.billedAmount;
    return sum;
  }, 0);

  const recurringTotal = state.recurringPayments
    .reduce((sum, r) => sum + r.amount, 0);

  return billsTotal + recurringTotal;
}

export function getCardMonthlyBill(state: FinanceState, cardId: string, year: number, month: number) {
  return state.monthlyBills.find(
    b => b.cardId === cardId && b.year === year && b.month === month
  );
}

export function getMonthlySpentTotal(state: FinanceState, year: number, month: number): number {
  return state.monthlyBills
    .filter(b => b.year === year && b.month === month)
    .reduce((sum, b) => sum + b.spentAmount, 0);
}

export interface CardBudgetLine {
  id: string;
  name: string;
  budget: number;
  spent: number;
  remaining: number;
}

export interface DailyBudgetSummary {
  year: number;
  month: number;
  /** Where the target month sits relative to today. */
  status: 'past' | 'current' | 'future';
  /** Budget actually used: the manual override when set, otherwise the sum of card budgets. */
  totalBudget: number;
  /** Sum of per-card monthlyBudget, regardless of override (shown for reference). */
  cardBudgetTotal: number;
  /** The manual override amount when set, else null. */
  override: number | null;
  spent: number;
  remaining: number;
  daysInMonth: number;
  /** Days already elapsed in the month (full month if past, today's date if current, 0 if future). */
  daysElapsed: number;
  /** Average spent per elapsed day so far (0 before any day elapsed). */
  avgPerDaySpent: number;
  /** Days remaining in the month, including today (0 for past months). */
  daysLeft: number;
  /** Calendar weeks remaining (today's partial week counts as one). */
  weeksLeft: number;
  /** Remaining budget evenly split across the days left. */
  perDay: number;
  /** Remaining budget evenly split across the weeks left. */
  perWeek: number;
  perCard: CardBudgetLine[];
}

/**
 * "What can I still spend this month" tracker for any month. Budget = sum of
 * each card's monthlyBudget (or the manual override). Spent ignores statement
 * cycles entirely: it sums card transactions dated within the calendar month,
 * mapped to cards by Plaid account. For the current month the remainder is
 * sliced into a per-day / per-week allowance for the days left; past months are
 * fully elapsed (0 days left) and future months have the whole month remaining.
 * `target` defaults to the month containing `now`; `now` is injectable for testing.
 */
export function getDailyBudgetSummary(
  state: FinanceState,
  target?: { year: number; month: number },
  now: Date = new Date(),
): DailyBudgetSummary {
  const year = target?.year ?? now.getFullYear();
  const month = target?.month ?? now.getMonth() + 1;
  const daysInMonth = getDaysInMonth(year, month);

  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;
  const status: DailyBudgetSummary['status'] =
    year < nowYear || (year === nowYear && month < nowMonth) ? 'past'
    : year === nowYear && month === nowMonth ? 'current'
    : 'future';

  // Days elapsed / left depend on where the month sits relative to today.
  const daysElapsed = status === 'past' ? daysInMonth : status === 'current' ? now.getDate() : 0;
  const daysLeft = status === 'past' ? 0 : daysInMonth - daysElapsed + (status === 'current' ? 1 : 0);
  const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7));

  // Map Plaid account -> card so transactions can be attributed to a card.
  const acctToCard = new Map<string, string>();
  state.creditCards.forEach(c => { if (c.plaidAccountId) acctToCard.set(c.plaidAccountId, c.id); });

  // Calendar-month spend per card: expense transactions dated this month, on a
  // card account. Statement cycles don't matter — only the transaction date.
  const spentByCard = new Map<string, number>();
  for (const tx of state.transactions) {
    if (tx.category === 'Transfer' || tx.amount >= 0) continue;
    if (tx.year !== year || tx.month !== month) continue;
    const cardId = tx.plaidAccountId ? acctToCard.get(tx.plaidAccountId) : undefined;
    if (!cardId) continue;
    spentByCard.set(cardId, (spentByCard.get(cardId) ?? 0) + Math.abs(tx.amount));
  }

  const perCard: CardBudgetLine[] = state.creditCards.map(card => {
    const budget = card.monthlyBudget && card.monthlyBudget > 0 ? card.monthlyBudget : 0;
    const spent = spentByCard.get(card.id) ?? 0;
    return { id: card.id, name: card.name, budget, spent, remaining: budget - spent };
  });

  const cardBudgetTotal = perCard.reduce((s, c) => s + c.budget, 0);
  const override = state.spendBudgetOverride && state.spendBudgetOverride > 0 ? state.spendBudgetOverride : null;
  const totalBudget = override ?? cardBudgetTotal;
  const spent = perCard.reduce((s, c) => s + c.spent, 0);
  const remaining = totalBudget - spent;

  return {
    year,
    month,
    status,
    totalBudget,
    cardBudgetTotal,
    override,
    spent,
    remaining,
    daysInMonth,
    daysElapsed,
    avgPerDaySpent: daysElapsed > 0 ? spent / daysElapsed : 0,
    daysLeft,
    weeksLeft,
    perDay: daysLeft > 0 ? remaining / daysLeft : 0,
    perWeek: daysLeft > 0 ? remaining / weeksLeft : 0,
    perCard,
  };
}

export interface DailyBalanceEntry {
  day: number;
  balance: number;
  events: { label: string; amount: number }[];
}

/**
 * Check if a recurring transaction fires on a given date.
 */
export function doesTransactionOccur(tx: Transaction, year: number, month: number, day: number): boolean {
  const txDate = new Date(tx.year, tx.month - 1, tx.day);
  const checkDate = new Date(year, month - 1, day);

  if (checkDate < txDate) return false;

  if (tx.endDate) {
    const [ey, em, ed] = tx.endDate.split('-').map(Number);
    const endDate = new Date(ey, em - 1, ed);
    if (checkDate > endDate) return false;
  }

  switch (tx.recurrence) {
    case 'once':
      return tx.year === year && tx.month === month && tx.day === day;

    case 'weekly': {
      const diffTime = checkDate.getTime() - txDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays % 7 === 0;
    }

    case 'monthly':
      return day === tx.day && (year > tx.year || (year === tx.year && month >= tx.month));

    case 'annually':
      return month === tx.month && day === tx.day && year >= tx.year;

    default:
      return false;
  }
}

/**
 * Calculate daily balances for a month, starting from a given balance.
 * Accounts for: auto paycheck, credit card bills, recurring payments,
 * one-time transactions, and recurring transactions (weekly/monthly/annually).
 */
export function calculateDailyBalances(
  state: FinanceState,
  year: number,
  month: number,
  startingBalance: number,
): DailyBalanceEntry[] {
  const daysInMonth = getDaysInMonth(year, month);
  const entries: DailyBalanceEntry[] = [];
  let balance = startingBalance;

  const { monthlyPayDay, lastMonthlyPayYear, lastMonthlyPayMonth } = financeSettings();
  const payDay = state.payConfig.payDay ?? monthlyPayDay;
  const biweeklyStartDate = state.payConfig.biweeklyStartDate;
  const isBiweeklyMonth = biweeklyStartDate ? (() => {
    const biStart = new Date(biweeklyStartDate + 'T12:00:00');
    return new Date(year, month - 1, 1) >= new Date(biStart.getFullYear(), biStart.getMonth(), 1);
  })() : false;

  const biweeklyPayDays = isBiweeklyMonth
    ? getBiweeklyDatesInMonth(biweeklyStartDate!, year, month)
    : [];
  const { perCheck401k: auto401kPerCheck, perCheckHsa: autoHsaPerCheck } =
    isBiweeklyMonth ? getBiweeklyContribAmounts(state, year) : { perCheck401k: undefined, perCheckHsa: undefined };

  const biweeklyEffectiveRate = isBiweeklyMonth ? getEffectiveHourlyRate(state.payConfig, year, month) : 0;
  const biweeklyPayConfigForMonth = isBiweeklyMonth && biweeklyEffectiveRate !== state.payConfig.hourlyRate
    ? { ...state.payConfig, hourlyRate: biweeklyEffectiveRate }
    : state.payConfig;

  // In a fully biweekly year with 27 pay periods, scale each check down so the
  // annual total stays the same as a 26-check year. Only applies to years after
  // the transition year (where the partial biweekly count is intentionally low).
  const biweeklyNormFactor = (() => {
    if (!biweeklyStartDate || !isBiweeklyMonth) return 1;
    const biweeklyYear = new Date(biweeklyStartDate + 'T12:00:00').getFullYear();
    if (year <= biweeklyYear) return 1;
    let annualCount = 0;
    for (let m = 1; m <= 12; m++) annualCount += getBiweeklyDatesInMonth(biweeklyStartDate, year, m).length;
    return annualCount > 0 ? BIWEEKLY_CHECKS_PER_YEAR / annualCount : 1;
  })();

  const biweeklyCheckNet = isBiweeklyMonth
    ? calculateBiweeklyPaycheckNet(biweeklyPayConfigForMonth, { traditional401kPerCheck: auto401kPerCheck, hsaPerCheck: autoHsaPerCheck }, month, year) * biweeklyNormFactor
    : 0;

  const monthlyActive = year < lastMonthlyPayYear
    || (year === lastMonthlyPayYear && month <= lastMonthlyPayMonth);
  const autoPayNet = monthlyActive
    ? getMonthlyNetPay(state.payConfig, year, month, state.holidays ?? [])
    : 0;

  // House: from the purchase date on, Rent-category transactions stop firing and the
  // monthly ownership costs (mortgage P&I, HOA, property tax, insurance, maintenance)
  // fire instead, on the purchase date's day-of-month. Driven entirely by
  // state.realEstate, so moving the purchase date moves the rent → house handoff.
  const re = state.realEstate;
  const houseActive = !!re && re.purchaseDate !== '' && isOwnedMonth(re, year, month);
  const houseDay = houseActive ? Math.min(getMortgageInfo(re!).purchaseDay, daysInMonth) : 0;
  const houseCosts = houseActive ? getMonthlyOwnershipCosts(re!) : null;
  const mortgageActive = houseActive && isMortgageActiveMonth(re!, year, month);

  for (let day = 1; day <= daysInMonth; day++) {
    const events: { label: string; amount: number }[] = [];

    // Monthly paycheck on payDay
    if (day === payDay && autoPayNet > 0) {
      events.push({ label: 'Paycheck (net)', amount: autoPayNet });
      balance += autoPayNet;
    }

    // Biweekly paychecks on their schedule (additive with monthly)
    if (isBiweeklyMonth && biweeklyPayDays.includes(day) && biweeklyCheckNet > 0) {
      events.push({ label: 'Paycheck (biweekly)', amount: biweeklyCheckNet });
      balance += biweeklyCheckNet;
    }

    // Manual/additional paychecks
    state.paychecks
      .filter(p => p.year === year && p.month === month && p.day === day)
      .forEach(p => {
        events.push({ label: 'Paycheck', amount: p.amount });
        balance += p.amount;
      });

    // Credit card bills on their due dates.
    // The statement that closed last month is due this month, so look up month-1.
    // Fall back to the card's monthlyBudget for months with no billed amount.
    state.creditCards.forEach(card => {
      if (card.dueDate === day) {
        const billMonth = month === 1 ? 12 : month - 1;
        const billYear = month === 1 ? year - 1 : year;
        const bill = state.monthlyBills.find(
          b => b.cardId === card.id && b.year === billYear && b.month === billMonth
        );
        if (bill && bill.billedAmount > 0) {
          events.push({ label: card.name, amount: -bill.billedAmount });
          balance -= bill.billedAmount;
        } else if (card.monthlyBudget && card.monthlyBudget > 0) {
          // Only fall back to budget if the bill month is on or after the card's opening month.
          // Before the card existed there's no statement, so no payment is due.
          const cardOpened = card.openedDate ? new Date(card.openedDate + 'T12:00:00') : null;
          const billDate = new Date(billYear, billMonth - 1, 1);
          if (!cardOpened || billDate >= new Date(cardOpened.getFullYear(), cardOpened.getMonth(), 1)) {
            events.push({ label: `${card.name} (budget)`, amount: -card.monthlyBudget });
            balance -= card.monthlyBudget;
          }
        }
      }
    });

    // Recurring payments (credit card related, monthly on dueDate)
    state.recurringPayments.forEach(r => {
      if (r.dueDate === day) {
        events.push({ label: r.name, amount: -r.amount });
        balance -= r.amount;
      }
    });

    // Transactions (one-time + recurring: weekly/monthly/annually)
    state.transactions.forEach(t => {
      if (t.category === 'Transfer') return;
      // Rent ends at the house purchase date — ownership costs below replace it.
      if (re && re.purchaseDate !== '' && isRentCategory(t.category) && isOnOrAfterPurchase(re, year, month, day)) return;
      if (doesTransactionOccur(t, year, month, day)) {
        events.push({ label: t.description || t.category, amount: t.amount });
        balance += t.amount;
      }
    });

    // House costs, itemized so each line is visible in the day grid
    if (houseCosts && day === houseDay) {
      const houseLines: [string, number][] = [
        ['Mortgage (P&I)', mortgageActive ? houseCosts.mortgage : 0],
        ['HOA', houseCosts.hoa],
        ['Property Tax', houseCosts.propertyTax],
        ['Home Insurance', houseCosts.insurance],
        ['Home Maintenance', houseCosts.maintenance],
      ];
      for (const [label, amount] of houseLines) {
        if (amount <= 0) continue;
        events.push({ label, amount: -amount });
        balance -= amount;
      }
    }

    // End-of-month brokerage: invest a % of whatever is left (only if positive).
    // Skip if user has manually logged a Brokerage transaction this month (it handles the deduction).
    if (day === daysInMonth) {
      const pct = state.brokerageMonthlyPct ?? 0;
      const hasBrokerageTransaction = state.transactions.some(
        t => t.category === 'Brokerage' && t.year === year && t.month === month
      );
      if (pct > 0 && balance > 0 && !hasBrokerageTransaction) {
        const invest = Math.round(balance * pct * 100) / 100;
        events.push({ label: 'Auto-Invest (Brokerage)', amount: -invest });
        balance -= invest;
      }
    }

    entries.push({ day, balance: Math.round(balance * 100) / 100, events });
  }

  return entries;
}

export interface ForwardBalanceResult {
  /** "YYYY-MM" → daily entries for that month */
  dailyBalances: Map<string, DailyBalanceEntry[]>;
  /** year → total brokerage invested that calendar year */
  yearlyBrokerage: Map<number, number>;
  /** year → net change in end-of-year cash balance (clamped to 0) */
  yearlySurplus: Map<number, number>;
  /** year → actual cash balance at end of year (can be negative) */
  yearlyCashEndBalance: Map<number, number>;
}

/**
 * Calculate balances forward from the current balance date.
 * Returns daily balances plus per-year brokerage and surplus aggregates
 * so callers don't need to re-scan events or re-run the simulation.
 */
export function calculateForwardBalances(
  state: FinanceState,
  throughYear: number,
  throughMonth: number,
): ForwardBalanceResult {
  const dailyBalances = new Map<string, DailyBalanceEntry[]>();
  const yearlyBrokerage = new Map<number, number>();
  const yearlySurplus = new Map<number, number>();
  const yearlyCashEndBalance = new Map<number, number>();

  const [anchorYear, anchorMonth, anchorDay] = state.currentBalanceDate
    .split('-')
    .map(Number);

  let balance = state.currentBalance;
  let prevYearEndBal = balance;
  let y = anchorYear;
  let m = anchorMonth;

  while (y < throughYear || (y === throughYear && m <= throughMonth)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const entries = calculateDailyBalances(state, y, m, balance);

    // For the anchor month: the user's currentBalance is what they have at the
    // START of anchor day (before any events fire that day). So we offset using
    // the previous day's ending balance (= start-of-anchor-day balance).
    if (y === anchorYear && m === anchorMonth) {
      const balanceBeforeAnchorDay = anchorDay > 1
        ? entries[anchorDay - 2].balance
        : balance;
      const offset = state.currentBalance - balanceBeforeAnchorDay;
      for (const e of entries) {
        e.balance = Math.round((e.balance + offset) * 100) / 100;
      }
    }

    // Accumulate brokerage invested this month into the year bucket
    let monthBrokerage = 0;
    for (const entry of entries) {
      for (const ev of entry.events) {
        if (ev.label === 'Auto-Invest (Brokerage)') monthBrokerage += Math.abs(ev.amount);
      }
    }
    yearlyBrokerage.set(y, (yearlyBrokerage.get(y) ?? 0) + monthBrokerage);

    dailyBalances.set(key, entries);
    balance = entries[entries.length - 1]?.balance ?? balance;

    m++;
    if (m > 12) {
      yearlySurplus.set(y, Math.max(0, Math.round(balance - prevYearEndBal)));
      yearlyCashEndBalance.set(y, Math.round(balance * 100) / 100);
      prevYearEndBal = balance;
      m = 1; y++;
    }
  }

  // Record surplus for the final (possibly partial) year
  if (!yearlySurplus.has(y)) {
    yearlySurplus.set(y, Math.max(0, Math.round(balance - prevYearEndBal)));
    yearlyCashEndBalance.set(y, Math.round(balance * 100) / 100);
  }

  return { dailyBalances, yearlyBrokerage, yearlySurplus, yearlyCashEndBalance };
}

/**
 * Computes the annual pay schedule for each year in [fromYear, toYear].
 * Single source of truth used by NetWorthProjection and any other consumer
 * that needs per-year totals (401k, HSA, net pay, gross pay, FICA, etc.).
 * `fromYear` is treated as the current year for "already contributed" adjustments.
 */
export function calculateYearlySchedule(
  state: FinanceState,
  fromYear: number,
  toYear: number,
): Record<number, YearlyPaySchedule> {
  const result: Record<number, YearlyPaySchedule> = {};
  const { contrib401kStartYear, defaultEmployee401kPct, defaultEmployerMatchPct } = financeSettings();

  const { payConfig } = state;
  const holidays = state.holidays ?? [];
  const biweeklyStartDate = payConfig.biweeklyStartDate ?? null;
  const biweeklyYear = biweeklyStartDate
    ? new Date(biweeklyStartDate + 'T12:00:00').getFullYear()
    : null;

  for (let yr = fromYear; yr <= toYear; yr++) {
    const isFullyMonthly = !biweeklyStartDate || (biweeklyYear != null && yr < biweeklyYear);

    if (isFullyMonthly) {
      const first = payConfig.firstPayMonth ?? 1;
      const bds = Array.from({ length: 13 - first }, (_, i) =>
        calculateMonthlyPaycheck(payConfig, yr, first + i, holidays)
      );
      const trad401k = bds.reduce((s, b) => s + b.traditional401k, 0);
      const roth401k  = bds.reduce((s, b) => s + b.roth401k, 0);
      const hsa       = bds.reduce((s, b) => s + b.hsaContribution, 0);
      const rothIra   = bds.reduce((s, b) => s + b.rothIraContribution, 0);
      const annualGross = bds.reduce((s, b) => s + b.grossPay, 0);
      const employerMatch = yr < contrib401kStartYear ? 0 : ((payConfig.employerMatchPct ?? defaultEmployerMatchPct) / 100) * annualGross;
      result[yr] = {
        trad401k, roth401k, hsa, rothIra, employerMatch,
        investmentContribs: trad401k + roth401k + hsa + rothIra + employerMatch,
        netPay: bds.reduce((s, b) => s + b.netPay, 0),
        grossPay: annualGross,
        fica: bds.reduce((s, b) => s + (b.ficaWithheld ?? 0), 0),
      };
    } else {
      const contrib401kFromMonth = payConfig.contrib401kFromMonth ?? 1;
      const checkCountFromMonth = (biweeklyYear != null && yr === biweeklyYear) ? contrib401kFromMonth : 1;

      const rateFirst  = getEffectiveHourlyRate(payConfig, yr, 1);
      const rateSecond = getEffectiveHourlyRate(payConfig, yr, 7);

      let totalChecks = 0, checksFor401k = 0;
      let checksFirst = 0, checksSecond = 0;
      for (let m = 1; m <= 12; m++) {
        const c = getBiweeklyDatesInMonth(biweeklyStartDate!, yr, m).length;
        totalChecks += c;
        if (m >= checkCountFromMonth) checksFor401k += c;
        if (m < 7) checksFirst += c; else checksSecond += c;
      }

      const limitHsa  = getContributionLimit(state, 'HSA', yr);
      // Employee eligibility runs off contrib401kFromMonth (checkCountFromMonth above),
      // independent of the employer-match waiting period (contrib401kStartYear, used
      // only for employerMatchAnnual below). An explicit per-year contributionLimits
      // override is used directly as the target rather than capped by the standing
      // %-of-gross rate.
      const contribPct = (payConfig.employeeContrib401kPct ?? defaultEmployee401kPct) / 100;
      const grossFirst  = rateFirst  * payConfig.hoursPerDay * BIWEEKLY_DAYS_PER_CHECK;
      const grossSecond = rateSecond * payConfig.hoursPerDay * BIWEEKLY_DAYS_PER_CHECK;
      const limit401k   = getContributionLimit(state, '401k', yr);
      const baseGross   = checksSecond > 0 ? grossSecond : grossFirst;
      const hasExplicit401kLimit = state.contributionLimits?.[`${yr}-401k`] != null;
      const targetAnnual401k = hasExplicit401kLimit
        ? limit401k
        : Math.min(limit401k, contribPct * baseGross * BIWEEKLY_CHECKS_PER_YEAR);
      // Already-logged lump-sum contributions (e.g. maxed out early, outside payroll) reduce
      // what's left to withhold from paychecks, but the money was still invested this year —
      // added back onto trad401k/hsa below so the annual total doesn't drop it.
      const contributed401k = yr === fromYear ? getContributionsTotal(state, '401k', yr) : 0;
      const remaining401k = Math.max(0, targetAnnual401k - contributed401k);
      const perCheck401kFirst  = checksFor401k > 0 ? Math.round(remaining401k * (checksFirst  / Math.max(checksFor401k, 1)) / Math.max(checksFirst,  1) * 100) / 100 : 0;
      const perCheck401kSecond = checksFor401k > 0 ? Math.round(remaining401k * (checksSecond / Math.max(checksFor401k, 1)) / Math.max(checksSecond, 1) * 100) / 100 : 0;

      const contributedHsa = yr === fromYear ? getContributionsTotal(state, 'HSA', yr) : 0;
      const remainingHsa = Math.max(0, limitHsa - contributedHsa);
      const perCheckHsa = checksFor401k > 0 ? Math.round(remainingHsa / checksFor401k * 100) / 100 : 0;

      const annualGrossApprox = baseGross * BIWEEKLY_CHECKS_PER_YEAR;
      const employerMatchAnnual = yr < contrib401kStartYear ? 0 : ((payConfig.employerMatchPct ?? defaultEmployerMatchPct) / 100) * annualGrossApprox;

      const bdFirst  = calculateBiweeklyBreakdown({ ...payConfig, hourlyRate: rateFirst },  { traditional401kPerCheck: perCheck401kFirst,  hsaPerCheck: perCheckHsa }, undefined, yr);
      const bdSecond = calculateBiweeklyBreakdown({ ...payConfig, hourlyRate: rateSecond }, { traditional401kPerCheck: perCheck401kSecond, hsaPerCheck: perCheckHsa }, undefined, yr);

      let trad401k = bdFirst.traditional401k     * checksFirst + bdSecond.traditional401k     * checksSecond + contributed401k;
      let roth401k  = bdFirst.roth401k            * checksFirst + bdSecond.roth401k            * checksSecond;
      let hsa       = bdFirst.hsaContribution     * checksFirst + bdSecond.hsaContribution     * checksSecond + contributedHsa;
      let rothIra   = bdFirst.rothIraContribution * checksFirst + bdSecond.rothIraContribution * checksSecond;

      // In a fully biweekly year (not the transition year), normalize annual
      // totals to BIWEEKLY_CHECKS_PER_YEAR so a 27-period year doesn't inflate
      // the projected annual income — the salary is fixed, only the per-check
      // amount changes.
      const isFullBiweeklyYear = biweeklyYear == null || yr > biweeklyYear;
      const normFactor = isFullBiweeklyYear && totalChecks > 0
        ? BIWEEKLY_CHECKS_PER_YEAR / totalChecks
        : 1;

      let netPay = 0;
      let fica = 0;
      if (payConfig.biweeklyNetAmount) {
        netPay = payConfig.biweeklyNetAmount * totalChecks * normFactor;
      } else {
        for (let m = 1; m <= 12; m++) {
          const checksInMonth = getBiweeklyDatesInMonth(biweeklyStartDate!, yr, m).length;
          if (checksInMonth === 0) continue;
          const rate = m < 7 ? rateFirst : rateSecond;
          const perCheck401k = m < 7 ? perCheck401kFirst : perCheck401kSecond;
          const bd = calculateBiweeklyBreakdown(
            { ...payConfig, hourlyRate: rate },
            { traditional401kPerCheck: perCheck401k, hsaPerCheck: perCheckHsa },
            m,
            yr,
          );
          netPay += bd.netPay * checksInMonth;
          fica   += bd.ficaWithheld * checksInMonth;
        }
        netPay *= normFactor;
        fica   *= normFactor;
      }

      let grossPay = (grossFirst * checksFirst + grossSecond * checksSecond) * normFactor;

      if (biweeklyYear != null && yr === biweeklyYear) {
        const firstMonthly = payConfig.firstPayMonth ?? 1;
        const biweeklyMonth = new Date(biweeklyStartDate! + 'T12:00:00').getMonth() + 1;
        for (let m = firstMonthly; m < biweeklyMonth; m++) {
          const mb = calculateMonthlyPaycheck(payConfig, yr, m, holidays);
          trad401k += mb.traditional401k;
          roth401k  += mb.roth401k;
          hsa       += mb.hsaContribution;
          rothIra   += mb.rothIraContribution;
          netPay    += mb.netPay;
          grossPay  += mb.grossPay;
          fica      += mb.ficaWithheld;
        }
      }

      result[yr] = {
        trad401k, roth401k, hsa, rothIra,
        employerMatch: employerMatchAnnual,
        investmentContribs: trad401k + roth401k + hsa + rothIra + employerMatchAnnual,
        netPay,
        grossPay,
        fica,
      };
    }
  }
  return result;
}

/**
 * Full-year tax summary for a single year, built on calculateYearlySchedule so it stays
 * correct whether the year is fully monthly, fully biweekly, or a mixed transition year.
 * Federal withholding is recovered as a residual: every per-period netPay in tax.ts equals
 * gross − trad401k − roth401k − hsa − rothIra − fedTax − fica, and that identity still holds
 * once summed across the year, so there's no need to re-derive fedTax period by period here.
 */
export function calculateAnnualTaxSummary(state: FinanceState, year: number): AnnualTaxSummary {
  const sched = calculateYearlySchedule(state, year, year)[year];

  const totalWithheld = Math.round(
    (sched.grossPay - sched.trad401k - sched.roth401k - sched.hsa - sched.rothIra - sched.netPay - sched.fica) * 100
  ) / 100;

  const taxableIncomeActual = Math.max(0, sched.grossPay - sched.trad401k - sched.hsa - getStandardDeduction(year));
  const taxOwedActual = calculateAnnualFederalTax(taxableIncomeActual, state.payConfig.filingStatus);
  const refund = Math.round((totalWithheld - taxOwedActual) * 100) / 100;

  return {
    annualGross: Math.round(sched.grossPay * 100) / 100,
    annual401kTraditional: sched.trad401k,
    annual401kRoth: sched.roth401k,
    annualHSA: sched.hsa,
    annualRothIRA: sched.rothIra,
    totalWithheld,
    taxableIncomeActual: Math.round(taxableIncomeActual * 100) / 100,
    taxOwedActual: Math.round(taxOwedActual * 100) / 100,
    annualFica: Math.round(sched.fica * 100) / 100,
    refund,
    totalInvested: sched.trad401k + sched.roth401k + sched.hsa + sched.rothIra,
  };
}
