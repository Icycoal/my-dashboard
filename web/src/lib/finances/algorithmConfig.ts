import type { CuratedManager } from '@/lib/finances-types';

export const CURATED_MANAGERS: CuratedManager[] = [
  // Tier 1 — Highest signal
  { cik: '0001067983', name: 'Berkshire Hathaway', tier: 1, tierWeight: 1.0 },
  { cik: '0001037389', name: 'Renaissance Technologies', tier: 1, tierWeight: 1.0 },
  // Tier 2 — High conviction
  { cik: '0001350694', name: 'Bridgewater Associates', tier: 2, tierWeight: 0.8 },
  { cik: '0001336528', name: 'Pershing Square', tier: 2, tierWeight: 0.8 },
  { cik: '0001656456', name: 'Appaloosa Management', tier: 2, tierWeight: 0.8 },
  // Tier 3 — Diversified/quant
  { cik: '0001423053', name: 'Citadel Advisors', tier: 3, tierWeight: 0.6 },
  { cik: '0001179392', name: 'Two Sigma Investments', tier: 3, tierWeight: 0.6 },
  { cik: '0001061768', name: 'Baupost Group', tier: 3, tierWeight: 0.6 },
  { cik: '0001079114', name: 'Greenlight Capital', tier: 3, tierWeight: 0.6 },
  { cik: '0001040273', name: 'Third Point', tier: 3, tierWeight: 0.6 },
];

export const SCORING_WEIGHTS = {
  quality: 0.30,
  consensus: 0.25,
  conviction: 0.25,
  momentum: 0.20,
} as const;

export const TOTAL_TIER_WEIGHT = CURATED_MANAGERS.reduce((s, m) => s + m.tierWeight, 0);

export const TOP_N = 20;
export const WEIGHT_FLOOR = 2;   // minimum % allocation
export const WEIGHT_CAP = 15;    // maximum % allocation
export const CACHE_MAX_AGE_DAYS = 7;
export const FILINGS_PER_MANAGER = 2; // fetch last 2 for momentum
export const FETCH_BATCH_SIZE = 5;
export const FETCH_BATCH_DELAY_MS = 600;

// Scoring engine thresholds
export const CONVICTION_CAP_PCT        = 20;   // max % of portfolio = max conviction
export const MOMENTUM_CHANGE_THRESHOLD = 0.10; // 10% share change = significant move
export const REDISTRIBUTION_ITERATIONS = 5;
export const CONVERGENCE_TOLERANCE     = 0.01;
