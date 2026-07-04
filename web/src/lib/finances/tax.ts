import type { PayConfig, Holiday } from '@/lib/finances-types';
import { taxSettings } from '@/lib/clientSettings';

function extrapolateTable(table: Record<number, number>, year: number): number {
  if (table[year] != null) return table[year];
  const years = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (years.length === 0) return 0;
  const first = years[0], last = years[years.length - 1];
  if (year < first) return table[first];
  const inc = years.length > 1 ? (table[last] - table[first]) / (last - first) : 0;
  return Math.round(table[last] + inc * (year - last));
}

export function getStandardDeduction(year: number): number {
  return extrapolateTable(taxSettings().standardDeductionSingle, year);
}

function getFicaStartYearMonth(config: PayConfig): { year: number; month: number } | null {
  if (!config.ficaStartDate) return null;
  const [y, m] = config.ficaStartDate.split('-').map(Number);
  return { year: y, month: m };
}

function ficaApplies(config: PayConfig, year: number, month: number): boolean {
  const start = getFicaStartYearMonth(config);
  if (!start) return false;
  return year > start.year || (year === start.year && month >= start.month);
}

function calcFicaWithheld(grossPay: number, annualGross: number, year: number): number {
  if (annualGross <= 0) return 0;
  const ts = taxSettings();
  const wageBase = extrapolateTable(ts.ssWageBase, year);
  const annualSS = Math.min(annualGross, wageBase) * ts.ssRate;
  const annualMedicare = annualGross * ts.medicareRate;
  const share = grossPay / annualGross;
  return Math.round((annualSS + annualMedicare) * share * 100) / 100;
}

export function calculateAnnualFederalTax(taxableIncome: number, filingStatus: 'single' | 'married'): number {
  const ts = taxSettings();
  const brackets = filingStatus === 'single' ? ts.bracketsSingle : ts.bracketsMarried;
  let tax = 0;
  let remaining = taxableIncome;

  for (const bracket of brackets) {
    const max = bracket.max ?? Infinity;
    const taxableInBracket = Math.min(remaining, max - bracket.min);
    if (taxableInBracket <= 0) break;
    tax += taxableInBracket * bracket.rate;
    remaining -= taxableInBracket;
  }

  return tax;
}

export function getWeekdaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let weekdays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day !== 0 && day !== 6) weekdays++;
  }
  return weekdays;
}

// Count holidays (from provided list) that fall on a weekday in the given month.
export function getHolidayCountInMonth(holidays: Holiday[], year: number, month: number): number {
  return holidays.filter(h => {
    const d = new Date(h.date + 'T00:00:00');
    if (isNaN(d.getTime())) return false;
    if (d.getFullYear() !== year || d.getMonth() + 1 !== month) return false;
    const dow = d.getDay();
    return dow !== 0 && dow !== 6;
  }).length;
}

export interface PaycheckBreakdown {
  weekdays: number;      // total Mon–Fri in the month
  holidays: number;      // holidays on weekdays
  ooo: number;           // user out-of-office days
  workedDays: number;    // weekdays − holidays − ooo
  hours: number;
  grossPay: number;
  annualGross: number;
  traditional401k: number;
  roth401k: number;
  hsaContribution: number;
  rothIraContribution: number;
  taxableIncome: number;
  federalTaxWithheld: number;
  ficaWithheld: number;
  netPay: number;
  effectiveRate: number;
}

export interface AnnualTaxSummary {
  annualGross: number;
  annual401kTraditional: number;
  annual401kRoth: number;
  annualHSA: number;
  annualRothIRA: number;
  totalWithheld: number;
  taxableIncomeActual: number;
  taxOwedActual: number;
  annualFica: number;
  refund: number;
  totalInvested: number;
}

// Paychecks lag their work period by two months: a paycheck received in
// (payYear, payMonth) pays for work done two months prior.
export function workMonthFor(payYear: number, payMonth: number): { year: number; month: number } {
  let month = payMonth - 2;
  let year = payYear;
  if (month <= 0) { month += 12; year -= 1; }
  return { year, month };
}

export interface ContributionOverrides {
  hsaMonthly?: number;
  rothIraMonthly?: number;
  traditional401kPerCheck?: number; // per biweekly check; when set, overrides config.traditional401k * 12/26
  hsaPerCheck?: number;             // per biweekly check; when set, overrides config.hsaMonthly * 12/26
}

export function calculateMonthlyPaycheck(
  config: PayConfig,
  year: number,
  month: number,
  holidays: Holiday[] = [],
  overrides?: ContributionOverrides,
): PaycheckBreakdown {
  const { year: wy, month: wm } = workMonthFor(year, month);
  const weekdays = getWeekdaysInMonth(wy, wm);
  const holidayCount = getHolidayCountInMonth(holidays, wy, wm);
  const oooKey = `${wy}-${String(wm).padStart(2, '0')}`;
  const ooo = config.oooByMonth?.[oooKey] ?? 0;
  const workedDays = Math.max(0, weekdays - holidayCount - ooo);
  const hours = workedDays * config.hoursPerDay;

  const isFixed = !!(config.fixedMonthlyGross && config.fixedGrossFromPayMonth && month >= config.fixedGrossFromPayMonth);
  // Monthly/hourly paychecks only ever represent contractor work predating the biweekly
  // full-time switch, so they always use the raw contractor rate — never the
  // salaryByYear-derived effective rate, which is for the biweekly schedule only.
  const hourlyRateForMonth = config.hourlyRate;
  const grossPay = isFixed ? config.fixedMonthlyGross! : hours * hourlyRateForMonth;

  // When biweekly is active, 401k is deducted from biweekly checks only — not from monthly paycheck.
  const hasBiweekly = !!config.biweeklyStartDate;
  const contrib401kFromMonth = config.contrib401kFromMonth ?? 1;
  const traditional401k = !hasBiweekly && month >= contrib401kFromMonth ? (config.traditional401k ?? 0) : 0;
  const roth401k = !hasBiweekly && month >= contrib401kFromMonth ? (config.roth401k ?? 0) : 0;
  // When biweekly is active, HSA and Roth IRA also come from biweekly only.
  const hsaContribution = hasBiweekly ? 0 : (overrides?.hsaMonthly ?? config.hsaMonthly ?? 0);
  const rothIraContribution = hasBiweekly ? 0 : (overrides?.rothIraMonthly ?? config.rothIraMonthly ?? 0);

  // 12 paychecks received in `year` = 12 work months shifted back by one.
  const annualGross = Array.from({ length: 12 }, (_, i) => {
    const payMonth = i + 1;
    if (config.fixedMonthlyGross && config.fixedGrossFromPayMonth && payMonth >= config.fixedGrossFromPayMonth) {
      return config.fixedMonthlyGross;
    }
    const { year: wYear, month: wMonth } = workMonthFor(year, payMonth);
    const wd = getWeekdaysInMonth(wYear, wMonth);
    const hol = getHolidayCountInMonth(holidays, wYear, wMonth);
    const mKey = `${wYear}-${String(wMonth).padStart(2, '0')}`;
    const mOoo = config.oooByMonth?.[mKey] ?? 0;
    const worked = Math.max(0, wd - hol - mOoo);
    return worked * config.hoursPerDay * config.hourlyRate;
  }).reduce((a, b) => a + b, 0);

  // Annual 401k for withholding: zero when biweekly handles it, otherwise only the active months.
  const monthsWith401k = hasBiweekly ? 0 : Math.max(0, 13 - contrib401kFromMonth);
  const annualTraditional = (config.traditional401k ?? 0) * monthsWith401k;
  // HSA is pre-tax and reduces federal taxable income; include it when monthly paychecks carry it.
  const annualHsaForWithholding = hasBiweekly ? 0 : (config.hsaMonthly ?? 0) * 12;
  const annualTaxableForWithholding = Math.max(0, annualGross - annualTraditional - annualHsaForWithholding - getStandardDeduction(year));
  const annualTaxWithheld = calculateAnnualFederalTax(annualTaxableForWithholding, config.filingStatus);

  const monthShare = annualGross > 0 ? grossPay / annualGross : 0;
  const federalTaxWithheld = Math.round(annualTaxWithheld * monthShare * 100) / 100;

  const ficaWithheld = ficaApplies(config, year, month)
    ? calcFicaWithheld(grossPay, annualGross, year)
    : 0;

  const netPay = Math.round((grossPay - traditional401k - roth401k - hsaContribution - rothIraContribution - federalTaxWithheld - ficaWithheld) * 100) / 100;
  const totalDeductions = traditional401k + roth401k + hsaContribution + rothIraContribution + federalTaxWithheld + ficaWithheld;
  const effectiveRate = grossPay > 0 ? (totalDeductions / grossPay) * 100 : 0;

  return {
    weekdays,
    holidays: holidayCount,
    ooo,
    workedDays,
    hours,
    grossPay: Math.round(grossPay * 100) / 100,
    annualGross: Math.round(annualGross * 100) / 100,
    traditional401k,
    roth401k,
    hsaContribution,
    rothIraContribution,
    taxableIncome: Math.round((grossPay - traditional401k) * 100) / 100,
    federalTaxWithheld,
    ficaWithheld,
    netPay,
    effectiveRate: Math.round(effectiveRate * 10) / 10,
  };
}

// calculateAnnualTaxSummary lives in calculations.ts — it needs calculateYearlySchedule's
// biweekly-aware totals (this file's calculateMonthlyPaycheck-only view misses biweekly
// pay entirely once biweeklyStartDate is set).

/**
 * Returns the effective hourly rate for a given pay year and month.
 * Checks salaryByYear first (most-recent entry ≤ year wins), then falls back
 * to annualRaisePct compounding every July from raiseStartYear onward.
 */
export function getEffectiveHourlyRate(config: PayConfig, year: number, month: number): number {
  if (config.salaryByYear) {
    const years = Object.keys(config.salaryByYear).map(Number).sort((a, b) => a - b);
    let salary: number | undefined;
    for (const y of years) {
      if (y <= year) salary = config.salaryByYear[String(y)];
    }
    if (salary != null) return salary / (config.hoursPerDay * 10 * 26);
  }
  const raisePct = (config.annualRaisePct ?? 0) / 100;
  const raiseStartYear = config.raiseStartYear ?? Infinity;
  if (raisePct === 0 || year < raiseStartYear) return config.hourlyRate;
  const raises = month < 7
    ? Math.max(0, year - raiseStartYear)
    : Math.max(0, year - raiseStartYear + 1);
  return config.hourlyRate * Math.pow(1 + raisePct, raises);
}

/** Returns the days of the month (1-based) on which biweekly paychecks land. */
export function getBiweeklyDatesInMonth(startDateISO: string, year: number, month: number): number[] {
  // Use UTC midnight throughout so DST transitions never skew the 14-day arithmetic.
  const origin = new Date(startDateISO + 'T00:00:00Z');
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd   = new Date(Date.UTC(year, month, 0));   // day 0 = last day of previous month

  if (origin > monthEnd) return [];

  // Fast-forward to first occurrence on or after month start
  let candidate = new Date(origin);
  if (candidate < monthStart) {
    const diffMs = monthStart.getTime() - candidate.getTime();
    const periods = Math.floor(diffMs / (14 * 24 * 60 * 60 * 1000));
    candidate = new Date(candidate.getTime() + periods * 14 * 24 * 60 * 60 * 1000);
    if (candidate < monthStart) candidate = new Date(candidate.getTime() + 14 * 24 * 60 * 60 * 1000);
  }

  const result: number[] = [];
  while (candidate <= monthEnd) {
    if (candidate.getUTCMonth() + 1 === month && candidate.getUTCFullYear() === year) {
      result.push(candidate.getUTCDate());
    }
    candidate = new Date(candidate.getTime() + 14 * 24 * 60 * 60 * 1000);
  }
  return result;
}

export interface BiweeklyBreakdown {
  hours: number;
  grossPay: number;
  traditional401k: number;
  roth401k: number;
  hsaContribution: number;
  rothIraContribution: number;
  federalTaxWithheld: number;
  ficaWithheld: number;
  netPay: number;
}

/** Full per-check breakdown computed from hourly rate × 10 workdays. */
export function calculateBiweeklyBreakdown(
  config: PayConfig,
  overrides?: ContributionOverrides,
  month?: number,
  year?: number,
): BiweeklyBreakdown {
  const hours = config.hoursPerDay * 10; // 2 weeks × 5 days
  const grossPay = Math.round(config.hourlyRate * hours * 100) / 100;
  const annualGross = grossPay * 26;

  const biweeklyStartYear = config.biweeklyStartDate
    ? new Date(config.biweeklyStartDate + 'T12:00:00').getFullYear()
    : null;
  const contrib401kFromMonth = config.contrib401kFromMonth ?? 1;
  // contrib401kFromMonth only restricts the start year; all months apply in subsequent years.
  const applies401k = month == null
    || biweeklyStartYear == null
    || year == null
    || year > biweeklyStartYear
    || month >= contrib401kFromMonth;
  const traditional401k = applies401k
    ? (overrides?.traditional401kPerCheck ?? Math.round((config.traditional401k ?? 0) * 12 / 26 * 100) / 100)
    : 0;
  const roth401k = applies401k ? Math.round((config.roth401k ?? 0) * 12 / 26 * 100) / 100 : 0;
  const hsaContribution = overrides?.hsaPerCheck
    ?? Math.round((overrides?.hsaMonthly ?? config.hsaMonthly ?? 0) * 12 / 26 * 100) / 100;
  const rothIraContribution = Math.round((overrides?.rothIraMonthly ?? config.rothIraMonthly ?? 0) * 12 / 26 * 100) / 100;

  // Use actual per-check deductions × 26 as annual approximation for tax withholding.
  // Both traditional 401k and HSA are pre-tax and reduce federal taxable income.
  const annualTaxable = Math.max(0, annualGross - traditional401k * 26 - hsaContribution * 26 - getStandardDeduction(year ?? new Date().getFullYear()));
  const federalTaxWithheld = Math.round(calculateAnnualFederalTax(annualTaxable, config.filingStatus) / 26 * 100) / 100;

  const ficaYear = year ?? new Date().getFullYear();
  const ficaWithheld = month != null && ficaApplies(config, ficaYear, month)
    ? calcFicaWithheld(grossPay, annualGross, ficaYear)
    : 0;

  const netPay = Math.round((grossPay - traditional401k - roth401k - hsaContribution - rothIraContribution - federalTaxWithheld - ficaWithheld) * 100) / 100;

  return { hours, grossPay, traditional401k, roth401k, hsaContribution, rothIraContribution, federalTaxWithheld, ficaWithheld, netPay };
}

/** Net amount deposited per biweekly paycheck. Uses biweeklyNetAmount override when set. */
export function calculateBiweeklyPaycheckNet(
  config: PayConfig,
  overrides?: ContributionOverrides,
  month?: number,
  year?: number,
): number {
  if (config.biweeklyNetAmount) return config.biweeklyNetAmount;
  if (!config.biweeklyStartDate) return 0;
  return calculateBiweeklyBreakdown(config, overrides, month, year).netPay;
}

/** Returns the next biweekly pay date on or after fromDate. */
export function getNextBiweeklyDate(startDateISO: string, fromDate: Date): Date {
  const origin = new Date(startDateISO + 'T00:00:00Z');
  if (fromDate <= origin) return origin;
  const diffMs = fromDate.getTime() - origin.getTime();
  const periods = Math.ceil(diffMs / (14 * 24 * 60 * 60 * 1000));
  return new Date(origin.getTime() + periods * 14 * 24 * 60 * 60 * 1000);
}

/** Returns the approximate full-year SS and Medicare split for display purposes. */
export function splitAnnualFica(annualGross: number, year: number): { socialSecurity: number; medicare: number } {
  const ts = taxSettings();
  const wageBase = extrapolateTable(ts.ssWageBase, year);
  return {
    socialSecurity: Math.min(annualGross, wageBase) * ts.ssRate,
    medicare: annualGross * ts.medicareRate,
  };
}

export function getMonthlyNetPay(
  config: PayConfig,
  year: number,
  month: number,
  holidays: Holiday[] = [],
  overrides?: ContributionOverrides,
): number {
  return calculateMonthlyPaycheck(config, year, month, holidays, overrides).netPay;
}
