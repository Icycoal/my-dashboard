// Employment / enrollment gates
export const CONTRIB_401K_START_YEAR = 2027; // 6-month wait after July 1, 2026 start

// Monthly paycheck schedule: fires on payDay through this month/year (overlaps with biweekly Aug–Sep)
export const LAST_MONTHLY_PAY_YEAR  = 2026;
export const LAST_MONTHLY_PAY_MONTH = 9; // September
export const MONTHLY_PAY_DAY        = 1; // 1st of the month

// Paycheck math
export const BIWEEKLY_CHECKS_PER_YEAR = 26;
export const BIWEEKLY_DAYS_PER_CHECK  = 10; // 2 weeks × 5 days

// Payroll defaults (fallback when not in payConfig)
export const DEFAULT_EMPLOYEE_401K_PCT  = 6;
export const DEFAULT_EMPLOYER_MATCH_PCT = 6;

// Time
export const MS_PER_DAY = 86_400_000;

// Investing defaults
export const HYSA_SAVINGS_RATE       = 0.034; // 3.4% APY
export const SURPLUS_BROKERAGE_RATIO = 0.9;   // 90% of surplus → brokerage
export const SURPLUS_SAVINGS_RATIO   = 0.1;   // 10% of surplus → HYSA

// Real estate form defaults
export const DEFAULT_MORTGAGE_RATE_PCT     = 6.5;
export const DEFAULT_LOAN_TERM_YEARS       = 30;
export const DEFAULT_APPRECIATION_RATE_PCT = 3;

// UI thresholds
export const BUDGET_WARNING_THRESHOLD_PCT = 80;

