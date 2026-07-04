import type { RealEstateConfig } from '@/lib/finances-types';

/**
 * Single source of truth for house math. Both the cash-flow simulation
 * (calculateDailyBalances) and the net-worth projection derive the rent → house
 * handoff from here, so changing realEstate.purchaseDate in one place moves the
 * last rent payment AND the first mortgage/HOA payment everywhere at once.
 */

export interface MortgageInfo {
  purchaseYear: number;
  purchaseMonth: number; // 1-12
  purchaseDay: number;
  loanAmount: number;
  monthlyRate: number;
  termMonths: number;
  /** Monthly principal + interest payment. */
  monthlyPayment: number;
  appreciationMonthly: number;
}

export function getMortgageInfo(re: RealEstateConfig): MortgageInfo {
  const [py, pm, pd] = re.purchaseDate.split('-').map(Number);
  const loanAmount = Math.max(0, re.purchasePrice - re.downPayment);
  const monthlyRate = re.mortgageRatePct / 100 / 12;
  const termMonths = re.loanTermYears * 12;
  const monthlyPayment = monthlyRate > 0
    ? loanAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths) / (Math.pow(1 + monthlyRate, termMonths) - 1)
    : termMonths > 0 ? loanAmount / termMonths : 0;
  return {
    purchaseYear: py,
    purchaseMonth: pm,
    purchaseDay: pd,
    loanAmount,
    monthlyRate,
    termMonths,
    monthlyPayment,
    appreciationMonthly: re.appreciationRatePct / 100 / 12,
  };
}

export interface OwnershipCosts {
  mortgage: number;
  hoa: number;
  /** Annual property tax (% of purchase price) divided across 12 months. */
  propertyTax: number;
  insurance: number;
  maintenance: number;
  /** Full monthly cost of the house: P&I + HOA + tax + insurance + maintenance. */
  total: number;
}

/** Everything the house costs per month, itemized. */
export function getMonthlyOwnershipCosts(re: RealEstateConfig): OwnershipCosts {
  const mortgage = getMortgageInfo(re).monthlyPayment;
  const hoa = re.hoaMonthly ?? 0;
  const propertyTax = ((re.propertyTaxAnnualPct ?? 0) / 100) * re.purchasePrice / 12;
  const insurance = re.insuranceMonthly ?? 0;
  const maintenance = re.maintenanceMonthly ?? 0;
  return { mortgage, hoa, propertyTax, insurance, maintenance, total: mortgage + hoa + propertyTax + insurance + maintenance };
}

/**
 * The transaction category that the house handoff replaces. Free-text categories mean
 * "rent", "Rent " etc. must all connect — every rent check in the app goes through here.
 */
export function isRentCategory(category: string): boolean {
  return category.trim().toLowerCase() === 'rent';
}

/**
 * True while the loan is still amortizing: the termMonths starting at the purchase
 * month. After the final payment, P&I stops but HOA/tax/insurance/maintenance continue.
 */
export function isMortgageActiveMonth(re: RealEstateConfig, year: number, month: number): boolean {
  const { purchaseYear, purchaseMonth, termMonths } = getMortgageInfo(re);
  const monthIndex = (year - purchaseYear) * 12 + (month - purchaseMonth);
  return monthIndex >= 0 && monthIndex < termMonths;
}

/** True from the purchase month onward — the months that carry mortgage/HOA instead of rent. */
export function isOwnedMonth(re: RealEstateConfig, year: number, month: number): boolean {
  const { purchaseYear, purchaseMonth } = getMortgageInfo(re);
  return year > purchaseYear || (year === purchaseYear && month >= purchaseMonth);
}

/**
 * True when a dated occurrence falls on/after the purchase date. Rent-category
 * transactions stop here: the purchase date is the first day of ownership, so the
 * last rent is whatever fires strictly before it.
 */
export function isOnOrAfterPurchase(re: RealEstateConfig, year: number, month: number, day: number): boolean {
  const { purchaseYear, purchaseMonth, purchaseDay } = getMortgageInfo(re);
  if (year !== purchaseYear) return year > purchaseYear;
  if (month !== purchaseMonth) return month > purchaseMonth;
  return day >= purchaseDay;
}
