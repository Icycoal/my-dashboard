export interface CreditCard {
  id: string;
  name: string;
  statementDate: number;
  dueDate: number;
  openedDate?: string;
  benefits?: string;
  plaidAccountId?: string;
  monthlyBudget?: number;
}

export interface MonthlyBill {
  cardId: string;
  year: number;
  month: number; // 1-12
  billedAmount: number;
  spentAmount: number;
}

export interface RecurringPayment {
  id: string;
  name: string;
  amount: number;
  dueDate: number;
}

export interface Paycheck {
  id: string;
  year: number;
  month: number;
  day: number;
  amount: number;
}

export type RecurrenceType = 'once' | 'weekly' | 'monthly' | 'annually';

export interface Transaction {
  id: string;
  category: string;
  amount: number; // positive = income, negative = expense
  year: number;
  month: number;
  day: number;
  description: string;
  recurrence: RecurrenceType;
  endDate?: string; // YYYY-MM-DD, inclusive — only applies to recurring transactions
  plaidTransactionId?: string;
  plaidAccountId?: string;
}

export interface PlaidLinkedAccount {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  mask: string | null;
}

export interface PlaidAccount {
  id: string;
  institutionId: string;
  institutionName: string;
  accounts: PlaidLinkedAccount[];
  lastSynced: string | null;
}

export interface PayConfig {
  hourlyRate: number;
  hoursPerDay: number;
  payDay?: number;
  filingStatus: 'single' | 'married';
  standardDeduction?: number;
  traditional401k: number; // fixed $ per month, pre-tax
  roth401k: number;        // fixed $ per month, post-tax
  contrib401kFromMonth?: number; // 1-12, month from which 401k deductions start
  hsaMonthly: number;      // fixed $ per month, post-tax but tax-deductible on return
  rothIraMonthly: number;  // fixed $ per month, post-tax, no deduction
  oooByMonth?: Record<string, number>; // key: "YYYY-MM", value: out-of-office days
  fixedMonthlyGross?: number;      // salaried gross per paycheck, used when >= fixedGrossFromPayMonth
  fixedGrossFromPayMonth?: number; // 1–12: first pay month where salary applies
  biweeklyStartDate?: string;      // ISO "YYYY-MM-DD" of first biweekly paycheck; enables biweekly schedule from that date
  biweeklyNetAmount?: number;      // take-home per biweekly check; when set, used directly instead of computing from gross
  firstPayMonth?: number;          // 1–12: first pay month to show in the monthly table (default 1)
  annualRaisePct?: number;         // e.g. 3 for 3% raise each July
  raiseStartYear?: number;         // year of first raise (raise applies every July from this year on)
  salaryByYear?: Record<string, number>; // annual gross salary override per year; keys are year strings e.g. "2028"; looked up as most-recent entry ≤ current year
  employeeContrib401kPct?: number; // e.g. 6 for 6% of gross; when set, overrides traditional401k dollar amount
  employerMatchPct?: number;       // e.g. 3 for 3% employer match (free money, doesn't reduce net pay)
  ficaStartDate?: string;          // ISO "YYYY-MM-DD"; Social Security + Medicare withheld from paychecks on/after this date
}

export interface Holiday {
  id: string;
  date: string; // ISO "YYYY-MM-DD"
  name: string;
}

export interface RothHolding {
  symbol: string;
  description: string;
  quantity: number;
  lastPrice: number;
  currentValue: number;
  costBasis: number;
  gainLoss: number;
  gainLossPercent: number;
}

export type AccountType = 'Roth IRA' | '401k' | 'Brokerage' | 'HSA';

export interface RothSnapshot {
  id: string;
  accountType?: AccountType;
  importedAt: string; // ISO date
  lastRefreshedAt?: string;
  holdings: RothHolding[];
  totalValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
}

export interface StockQuote {
  price: number;
  change: number;
  changePercent: number;
}

export interface ThirteenFManager {
  cik: string;
  name: string;
}

export interface ThirteenFFiling {
  accession: string;
  filingDate: string;
  periodOfReport: string;
}

export interface ThirteenFHolding {
  issuer: string;
  titleOfClass: string;
  cusip: string;
  valueUsd: number;
  shares: number;
  pctOfPortfolio: number;
}

export interface CuratedManager {
  cik: string;
  name: string;
  tier: 1 | 2 | 3;
  tierWeight: number;
}

export interface ManagerFilingData {
  cik: string;
  name: string;
  filings: ThirteenFFiling[];
  holdings: Record<string, ThirteenFHolding[]>; // accession → holdings
}

export interface AlgorithmCache {
  fetchedAt: string; // ISO date
  managers: ManagerFilingData[];
}

export interface StockScore {
  issuer: string;
  cusip: string;
  symbol: string | null;
  quality: number;
  consensus: number;
  conviction: number;
  momentum: number;
  composite: number;
  targetPct: number;
  currentPct: number;
  overUnder: number;
  action: 'Buy' | 'Sell' | 'Hold';
  holders: { name: string; tier: number; pctOfPortfolio: number; momentum: string }[];
}

export interface AlgorithmResult {
  ranAt: string; // ISO date
  scores: StockScore[];
  rothTotal: number;
}

export interface Budget {
  id: string;
  category: string;
  monthlyLimit: number;
}

export interface Debt {
  id: string;
  name: string;
  balance: number;
  interestRate?: number;
}

export interface RealEstateConfig {
  purchaseDate: string;        // ISO "YYYY-MM-DD" — last day of rent, first day of ownership costs
  purchasePrice: number;
  downPayment: number;
  mortgageRatePct: number;     // e.g. 6.5
  loanTermYears: number;       // e.g. 30
  appreciationRatePct: number; // e.g. 3
  hoaMonthly?: number;             // HOA dues, $ per month
  propertyTaxAnnualPct?: number;   // annual property tax as % of purchase price (e.g. 1.1)
  insuranceMonthly?: number;       // homeowners/HO-6 insurance, $ per month
  maintenanceMonthly?: number;     // upkeep reserve, $ per month
}

export interface Contribution {
  id: string;
  accountType: AccountType;
  year: number;
  amount: number;
  date?: string; // ISO "YYYY-MM-DD"
  note?: string;
}

export interface YearlyPaySchedule {
  trad401k: number;
  roth401k: number;
  hsa: number;
  rothIra: number;
  employerMatch: number;
  investmentContribs: number;
  netPay: number;
  grossPay: number;
  fica: number;
}

export interface FinanceState {
  activeYear: number;
  creditCards: CreditCard[];
  monthlyBills: MonthlyBill[];
  recurringPayments: RecurringPayment[];
  paychecks: Paycheck[];
  transactions: Transaction[];
  currentBalance: number;
  currentBalanceDate: string; // ISO date string "YYYY-MM-DD"
  payConfig: PayConfig;
  holidays: Holiday[];
  rothSnapshots: RothSnapshot[];
  plaidAccounts: PlaidAccount[];
  algorithmCache?: AlgorithmCache;
  algorithmResult?: AlgorithmResult;
  budgets: Budget[];
  debts: Debt[];
  contributions: Contribution[];
  contributionLimits?: Record<string, number>; // key: "YYYY-<AccountType>" e.g. "2026-Roth IRA"
  realEstate?: RealEstateConfig;
  spendBudgetOverride?: number; // optional manual monthly spend budget; when set (>0) replaces the sum of card budgets
  brokerageMonthlyPct?: number; // 0–1: fraction of end-of-month balance to auto-invest; 0 = disabled
}

export type FinanceAction =
  | { type: 'SET_YEAR'; year: number }
  | { type: 'ADD_CARD'; card: CreditCard }
  | { type: 'EDIT_CARD'; card: CreditCard }
  | { type: 'DELETE_CARD'; cardId: string }
  | { type: 'SET_BILL'; bill: MonthlyBill }
  | { type: 'ADD_RECURRING'; payment: RecurringPayment }
  | { type: 'DELETE_RECURRING'; id: string }
  | { type: 'ADD_PAYCHECK'; paycheck: Paycheck }
  | { type: 'DELETE_PAYCHECK'; id: string }
  | { type: 'ADD_TRANSACTION'; transaction: Transaction }
  | { type: 'DELETE_TRANSACTION'; id: string }
  | { type: 'SET_CURRENT_BALANCE'; balance: number; date: string }
  | { type: 'SET_PAY_CONFIG'; config: PayConfig }
  | { type: 'ADD_HOLIDAY'; holiday: Holiday }
  | { type: 'DELETE_HOLIDAY'; id: string }
  | { type: 'SET_HOLIDAYS'; holidays: Holiday[] }
  | { type: 'ADD_ROTH_SNAPSHOT'; snapshot: RothSnapshot }
  | { type: 'DELETE_ROTH_SNAPSHOT'; id: string }
  | { type: 'UPDATE_ROTH_PRICES'; snapshotId: string; quotes: Record<string, StockQuote> }
  | { type: 'UPDATE_HOLDING_COST_BASIS'; snapshotId: string; symbol: string; costBasis: number }
  | { type: 'SET_ALGORITHM_CACHE'; cache: AlgorithmCache }
  | { type: 'SET_ALGORITHM_RESULT'; result: AlgorithmResult }
  | { type: 'CLEAR_ALGORITHM_DATA' }
  | { type: 'ADD_PLAID_ACCOUNT'; account: PlaidAccount }
  | { type: 'REMOVE_PLAID_ACCOUNT'; id: string }
  | { type: 'UPDATE_PLAID_ACCOUNT'; account: PlaidAccount }
  | { type: 'IMPORT_PLAID_TRANSACTIONS'; transactions: Transaction[] }
  | { type: 'SET_BUDGET'; budget: Budget }
  | { type: 'DELETE_BUDGET'; id: string }
  | { type: 'ADD_DEBT'; debt: Debt }
  | { type: 'EDIT_DEBT'; debt: Debt }
  | { type: 'DELETE_DEBT'; id: string }
  | { type: 'ADD_CONTRIBUTION'; contribution: Contribution }
  | { type: 'EDIT_CONTRIBUTION'; contribution: Contribution }
  | { type: 'DELETE_CONTRIBUTION'; id: string }
  | { type: 'SET_CONTRIBUTION_LIMIT'; year: number; accountType: AccountType; limit: number }
  | { type: 'SET_REAL_ESTATE'; config: RealEstateConfig | undefined }
  | { type: 'SET_SPEND_BUDGET'; amount: number | undefined }
  | { type: 'SET_BROKERAGE_PCT'; pct: number }
  | { type: 'LOAD_STATE'; state: FinanceState };

// ── Admin settings types ─────────────────────────────────────────────────────

export interface TaxBracket {
  min: number;
  max: number | null; // null = Infinity (top bracket)
  rate: number;
}

export interface TaxSettings {
  ssRate: number;
  medicareRate: number;
  ssWageBase: Record<number, number>;
  standardDeductionSingle: Record<number, number>;
  bracketsSingle: TaxBracket[];
  bracketsMarried: TaxBracket[];
}

export interface ContributionSettings {
  rothIraLimits: Record<number, number>;
  k401Limits: Record<number, number>;
  hsaLimits: Record<number, number>;           // family-coverage limits
  hsaLimitsIndividual: Record<number, number>; // self-only-coverage limits, used from age 26 on
}

export interface FinanceSettings {
  contrib401kStartYear: number;
  lastMonthlyPayYear: number;
  lastMonthlyPayMonth: number;
  monthlyPayDay: number;
  defaultEmployee401kPct: number;
  defaultEmployerMatchPct: number;
  hysaSavingsRate: number;
  surplusBrokerageRatio: number;
  surplusSavingsRatio: number;
  defaultMortgageRatePct: number;
  defaultLoanTermYears: number;
  defaultAppreciationRatePct: number;
  birthYear: number;
  birthMonth: number; // 1–12; used with birthYear to prorate the HSA family→individual limit switch at age 26
  budgetWarningThresholdPct: number;
}

export interface AlgorithmConfig {
  scoringWeights: { quality: number; consensus: number; conviction: number; momentum: number };
  topN: number;
  weightFloor: number;
  weightCap: number;
  convictionCapPct: number;
  momentumChangeThreshold: number;
  redistributionIterations: number;
  convergenceTolerance: number;
  cacheMaxAgeDays: number;
  filingsPerManager: number;
  fetchBatchSize: number;
  fetchBatchDelayMs: number;
  curatedManagers: CuratedManager[];
}

export interface AppSettings {
  finances: FinanceSettings;
  tax: TaxSettings;
  contributions: ContributionSettings;
  algorithm: AlgorithmConfig;
}
