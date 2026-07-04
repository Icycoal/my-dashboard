import type {
  AppSettings,
  FinanceSettings,
  TaxSettings,
  ContributionSettings,
  AlgorithmConfig,
  TaxBracket,
  CuratedManager,
} from './finances-types';

const DEFAULT_FINANCE: FinanceSettings = {
  contrib401kStartYear: 2027,
  lastMonthlyPayYear: 2026,
  lastMonthlyPayMonth: 9,
  monthlyPayDay: 1,
  defaultEmployee401kPct: 6,
  defaultEmployerMatchPct: 6,
  hysaSavingsRate: 0.034,
  surplusBrokerageRatio: 0.9,
  surplusSavingsRatio: 0.1,
  defaultMortgageRatePct: 6.5,
  defaultLoanTermYears: 30,
  defaultAppreciationRatePct: 3,
  birthYear: 2000,
  birthMonth: 1,
  budgetWarningThresholdPct: 80,
};

const DEFAULT_BRACKETS_SINGLE: TaxBracket[] = [
  { min: 0,      max: 11925,  rate: 0.10 },
  { min: 11925,  max: 48475,  rate: 0.12 },
  { min: 48475,  max: 103350, rate: 0.22 },
  { min: 103350, max: 197300, rate: 0.24 },
  { min: 197300, max: 250525, rate: 0.32 },
  { min: 250525, max: 626350, rate: 0.35 },
  { min: 626350, max: null,   rate: 0.37 },
];

const DEFAULT_BRACKETS_MARRIED: TaxBracket[] = [
  { min: 0,      max: 23850,  rate: 0.10 },
  { min: 23850,  max: 96950,  rate: 0.12 },
  { min: 96950,  max: 206700, rate: 0.22 },
  { min: 206700, max: 394600, rate: 0.24 },
  { min: 394600, max: 501050, rate: 0.32 },
  { min: 501050, max: 751600, rate: 0.35 },
  { min: 751600, max: null,   rate: 0.37 },
];

const DEFAULT_TAX: TaxSettings = {
  ssRate: 0.062,
  medicareRate: 0.0145,
  ssWageBase: { 2026: 176100, 2027: 180900, 2028: 185600, 2029: 190500, 2030: 195600, 2031: 200900, 2032: 206400, 2033: 212100, 2034: 218000 },
  standardDeductionSingle: { 2024: 14600, 2025: 15000, 2026: 15700, 2027: 16100, 2028: 16500, 2029: 16900, 2030: 17300, 2031: 17700, 2032: 18100, 2033: 18500, 2034: 18900 },
  bracketsSingle: DEFAULT_BRACKETS_SINGLE,
  bracketsMarried: DEFAULT_BRACKETS_MARRIED,
};

const DEFAULT_CONTRIBUTIONS: ContributionSettings = {
  rothIraLimits:  { 2024: 7000, 2025: 7000, 2026: 7500, 2027: 8000, 2028: 8000, 2029: 8000, 2030: 8000, 2031: 8500, 2032: 8500, 2033: 9000, 2034: 9000 },
  k401Limits:     { 2024: 23000, 2025: 23500, 2026: 24500, 2027: 25500, 2028: 26500, 2029: 27500, 2030: 28500, 2031: 29500, 2032: 30500, 2033: 31500, 2034: 32500 },
  hsaLimits:      { 2024: 8300, 2025: 8550, 2026: 8750, 2027: 9000, 2028: 9250, 2029: 9500, 2030: 9750, 2031: 10000, 2032: 10250, 2033: 10500, 2034: 10750 },
  hsaLimitsIndividual: { 2024: 4150, 2025: 4300, 2026: 4400, 2027: 4525, 2028: 4650, 2029: 4775, 2030: 4900, 2031: 5025, 2032: 5150, 2033: 5275, 2034: 5400 },
};

const DEFAULT_CURATED_MANAGERS: CuratedManager[] = [
  { cik: '0001067983', name: 'Berkshire Hathaway',     tier: 1, tierWeight: 1.0 },
  { cik: '0001037389', name: 'Renaissance Technologies', tier: 1, tierWeight: 1.0 },
  { cik: '0001350694', name: 'Bridgewater Associates',  tier: 2, tierWeight: 0.8 },
  { cik: '0001336528', name: 'Pershing Square',         tier: 2, tierWeight: 0.8 },
  { cik: '0001656456', name: 'Appaloosa Management',    tier: 2, tierWeight: 0.8 },
  { cik: '0001423053', name: 'Citadel Advisors',        tier: 3, tierWeight: 0.6 },
  { cik: '0001179392', name: 'Two Sigma Investments',   tier: 3, tierWeight: 0.6 },
  { cik: '0001061768', name: 'Baupost Group',           tier: 3, tierWeight: 0.6 },
  { cik: '0001079114', name: 'Greenlight Capital',      tier: 3, tierWeight: 0.6 },
  { cik: '0001040273', name: 'Third Point',             tier: 3, tierWeight: 0.6 },
];

const DEFAULT_ALGORITHM: AlgorithmConfig = {
  scoringWeights: { quality: 0.30, consensus: 0.25, conviction: 0.25, momentum: 0.20 },
  topN: 20,
  weightFloor: 2,
  weightCap: 15,
  convictionCapPct: 20,
  momentumChangeThreshold: 0.10,
  redistributionIterations: 5,
  convergenceTolerance: 0.01,
  cacheMaxAgeDays: 7,
  filingsPerManager: 2,
  fetchBatchSize: 5,
  fetchBatchDelayMs: 600,
  curatedManagers: DEFAULT_CURATED_MANAGERS,
};

let _settings: AppSettings | null = null;

export function initClientSettings(s: AppSettings): void {
  _settings = s;
}

export function getClientAppSettings(): AppSettings | null {
  return _settings;
}

export function financeSettings(): FinanceSettings {
  return _settings?.finances ?? DEFAULT_FINANCE;
}

export function taxSettings(): TaxSettings {
  return _settings?.tax ?? DEFAULT_TAX;
}

export function contribSettings(): ContributionSettings {
  return _settings?.contributions ?? DEFAULT_CONTRIBUTIONS;
}

export function clientAlgorithmConfig(): AlgorithmConfig {
  return _settings?.algorithm ?? DEFAULT_ALGORITHM;
}
