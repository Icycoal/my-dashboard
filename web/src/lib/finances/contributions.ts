import type { AccountType, FinanceState } from '@/lib/finances-types';
import { MS_PER_DAY } from './constants';
import { contribSettings, financeSettings } from '@/lib/clientSettings';

function lookupLimit(limits: Record<number, number>, year: number): number {
  if (limits[year] != null) return limits[year];
  const knownYears = Object.keys(limits).map(Number).sort((a, b) => a - b);
  if (knownYears.length < 2) return knownYears.length === 1 ? limits[knownYears[0]] : 0;
  const firstYear = knownYears[0];
  const lastYear  = knownYears[knownYears.length - 1];
  const annualIncrement = (limits[lastYear] - limits[firstYear]) / (lastYear - firstYear);
  return Math.round(limits[lastYear] + annualIncrement * (year - lastYear));
}

/**
 * HSA limit switches from family to self-only coverage at age 26 (aging off a
 * parent's family plan). The turn-26 year is prorated by month — IRS limits
 * are determined by coverage type per month, not a clean annual cutover.
 */
function getHsaLimit(year: number): number {
  const cs = contribSettings();
  const { birthYear, birthMonth } = financeSettings();
  const turn26Year = birthYear + 26;

  if (year < turn26Year) return lookupLimit(cs.hsaLimits, year);
  if (year > turn26Year) return lookupLimit(cs.hsaLimitsIndividual, year);

  const monthsFamily = Math.min(12, Math.max(0, birthMonth - 1));
  const monthsIndividual = 12 - monthsFamily;
  const familyLimit = lookupLimit(cs.hsaLimits, year);
  const individualLimit = lookupLimit(cs.hsaLimitsIndividual, year);
  return Math.round((monthsFamily * familyLimit + monthsIndividual * individualLimit) / 12);
}

export function getContributionLimit(
  state: FinanceState,
  accountType: AccountType,
  year: number,
): number {
  const override = state.contributionLimits?.[`${year}-${accountType}`];
  if (override != null) return override;

  if (accountType === 'HSA') return getHsaLimit(year);

  const cs = contribSettings();
  const limits: Record<number, number> =
    accountType === 'Roth IRA' ? cs.rothIraLimits
    : accountType === '401k'   ? cs.k401Limits
    : {};

  return lookupLimit(limits, year);
}

export function getContributionsTotal(
  state: FinanceState,
  accountType: AccountType,
  year: number,
): number {
  return (state.contributions ?? [])
    .filter((c) => c.accountType === accountType && c.year === year)
    .reduce((sum, c) => sum + c.amount, 0);
}

export function getLifetimeContributionsTotal(
  state: FinanceState,
  accountType: AccountType,
): number {
  return (state.contributions ?? [])
    .filter((c) => c.accountType === accountType)
    .reduce((sum, c) => sum + c.amount, 0);
}

export function getDaysLeftInYear(year: number): number {
  const now = new Date();
  const endOfYear = new Date(year, 11, 31);
  if (now.getFullYear() !== year) return year > now.getFullYear() ? 365 : 0;
  const diff = Math.ceil((endOfYear.getTime() - now.getTime()) / MS_PER_DAY);
  return Math.max(0, diff);
}

/**
 * Monthly contribution needed to max out by year-end, spread over the
 * remaining months (inclusive of the current month). Returns 0 when there is
 * no limit set, the user is already at/over the limit, or the year is done.
 */
export function getPlannedMonthlyContribution(
  state: FinanceState,
  accountType: AccountType,
  year: number,
): number {
  const limit = getContributionLimit(state, accountType, year);
  if (limit <= 0) return 0;
  const contributed = getContributionsTotal(state, accountType, year);
  const remaining = limit - contributed;
  if (remaining <= 0) return 0;

  const now = new Date();
  let monthsLeft: number;
  if (now.getFullYear() < year) monthsLeft = 12;
  else if (now.getFullYear() > year) monthsLeft = 0;
  else monthsLeft = 12 - (now.getMonth() + 1) + 1;

  if (monthsLeft <= 0) return 0;
  return remaining / monthsLeft;
}
