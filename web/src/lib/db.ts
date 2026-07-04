import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "dashboard.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      type        TEXT NOT NULL,
      category    TEXT NOT NULL,
      label       TEXT NOT NULL,
      description TEXT,
      updated_at  TEXT DEFAULT (datetime('now'))
    )
  `);
  seedDefaults(db);
  _db = db;
  return db;
}

interface SeedRow {
  key: string;
  value: unknown;
  type: "number" | "boolean" | "json";
  category: string;
  label: string;
  description?: string;
}

function seed(db: Database.Database, rows: SeedRow[]) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO admin_settings (key, value, type, category, label, description)
    VALUES (@key, @value, @type, @category, @label, @description)
  `);
  for (const row of rows) {
    stmt.run({ ...row, value: JSON.stringify(row.value), description: row.description ?? null });
  }
}

function seedDefaults(db: Database.Database) {
  // ── finances ─────────────────────────────────────────────────────────
  seed(db, [
    { key: "finances.contrib_401k_start_year", value: 2027, type: "number", category: "finances", label: "401k Contribution Start Year", description: "First year eligible for 401k (6-month wait after hire date)" },
    { key: "finances.last_monthly_pay_year",   value: 2026, type: "number", category: "finances", label: "Last Monthly Pay Year",        description: "Last calendar year with monthly paychecks" },
    { key: "finances.last_monthly_pay_month",  value: 8,    type: "number", category: "finances", label: "Last Monthly Pay Month",       description: "Last month (1–12) with monthly paychecks" },
    { key: "finances.monthly_pay_day",         value: 1,    type: "number", category: "finances", label: "Monthly Pay Day",             description: "Day of month monthly paycheck fires" },
    { key: "finances.default_employee_401k_pct", value: 6,  type: "number", category: "finances", label: "Default Employee 401k %",     description: "Default employee 401k contribution percentage" },
    { key: "finances.default_employer_match_pct", value: 6, type: "number", category: "finances", label: "Default Employer Match %",    description: "Default employer 401k match percentage" },
    { key: "finances.hysa_savings_rate",        value: 0.034, type: "number", category: "finances", label: "HYSA Savings Rate",         description: "High-yield savings account APY (e.g. 0.034 = 3.4%)" },
    { key: "finances.surplus_brokerage_ratio",  value: 0.9,   type: "number", category: "finances", label: "Surplus → Brokerage Ratio", description: "Fraction of monthly surplus routed to brokerage (rest → HYSA)" },
    { key: "finances.surplus_savings_ratio",    value: 0.1,   type: "number", category: "finances", label: "Surplus → HYSA Ratio",      description: "Fraction of monthly surplus routed to HYSA" },
    { key: "finances.default_mortgage_rate_pct", value: 6.5, type: "number", category: "finances", label: "Default Mortgage Rate %",    description: "Default mortgage interest rate for real estate calculator" },
    { key: "finances.default_loan_term_years",   value: 30,  type: "number", category: "finances", label: "Default Loan Term (years)", description: "Default mortgage loan term in years" },
    { key: "finances.default_appreciation_rate_pct", value: 3, type: "number", category: "finances", label: "Default Appreciation Rate %", description: "Default annual home appreciation rate" },
    { key: "finances.birth_year",               value: 2000, type: "number", category: "finances", label: "Birth Year",                description: "Used for age calculations in projections" },
    { key: "finances.birth_month",              value: 1,    type: "number", category: "finances", label: "Birth Month",               description: "1-12; used with Birth Year to prorate the HSA family→individual limit switch at age 26" },
    { key: "finances.budget_warning_threshold_pct", value: 80, type: "number", category: "finances", label: "Budget Warning Threshold %", description: "Budget usage % at which a warning is shown" },
  ]);

  // ── tax ───────────────────────────────────────────────────────────────
  seed(db, [
    { key: "tax.ss_rate",       value: 0.062,  type: "number", category: "tax", label: "Social Security Rate",   description: "Employee FICA Social Security withholding rate" },
    { key: "tax.medicare_rate", value: 0.0145, type: "number", category: "tax", label: "Medicare Rate",          description: "Employee FICA Medicare withholding rate" },
    {
      key: "tax.ss_wage_base", type: "json", category: "tax", label: "SS Wage Base by Year",
      description: "Social Security taxable wage ceiling per year",
      value: { 2026: 176100, 2027: 180900, 2028: 185600, 2029: 190500, 2030: 195600, 2031: 200900, 2032: 206400, 2033: 212100, 2034: 218000 },
    },
    {
      key: "tax.standard_deduction_single", type: "json", category: "tax", label: "Standard Deduction (Single)",
      description: "IRS standard deduction for single filers by year",
      value: { 2024: 14600, 2025: 15000, 2026: 15700, 2027: 16100, 2028: 16500, 2029: 16900, 2030: 17300, 2031: 17700, 2032: 18100, 2033: 18500, 2034: 18900 },
    },
    {
      key: "tax.brackets_single", type: "json", category: "tax", label: "Federal Tax Brackets (Single)",
      description: "2026 federal income tax brackets for single filers",
      value: [
        { min: 0,      max: 11925,  rate: 0.10 },
        { min: 11925,  max: 48475,  rate: 0.12 },
        { min: 48475,  max: 103350, rate: 0.22 },
        { min: 103350, max: 197300, rate: 0.24 },
        { min: 197300, max: 250525, rate: 0.32 },
        { min: 250525, max: 626350, rate: 0.35 },
        { min: 626350, max: null,   rate: 0.37 },
      ],
    },
    {
      key: "tax.brackets_married", type: "json", category: "tax", label: "Federal Tax Brackets (Married)",
      description: "2026 federal income tax brackets for married filing jointly",
      value: [
        { min: 0,      max: 23850,  rate: 0.10 },
        { min: 23850,  max: 96950,  rate: 0.12 },
        { min: 96950,  max: 206700, rate: 0.22 },
        { min: 206700, max: 394600, rate: 0.24 },
        { min: 394600, max: 501050, rate: 0.32 },
        { min: 501050, max: 751600, rate: 0.35 },
        { min: 751600, max: null,   rate: 0.37 },
      ],
    },
  ]);

  // ── contributions ─────────────────────────────────────────────────────
  seed(db, [
    {
      key: "contributions.roth_ira_limits", type: "json", category: "contributions", label: "Roth IRA Contribution Limits",
      description: "IRS Roth IRA annual contribution limits by year (under 50)",
      value: { 2024: 7000, 2025: 7000, 2026: 7500, 2027: 8000, 2028: 8000, 2029: 8000, 2030: 8000, 2031: 8500, 2032: 8500, 2033: 9000, 2034: 9000 },
    },
    {
      key: "contributions.401k_limits", type: "json", category: "contributions", label: "401k Contribution Limits",
      description: "IRS 401k annual contribution limits by year (employee deferral)",
      value: { 2024: 23000, 2025: 23500, 2026: 24500, 2027: 25500, 2028: 26500, 2029: 27500, 2030: 28500, 2031: 29500, 2032: 30500, 2033: 31500, 2034: 32500 },
    },
    {
      key: "contributions.hsa_limits", type: "json", category: "contributions", label: "HSA Contribution Limits (Family)",
      description: "IRS HSA annual contribution limits by year (family coverage)",
      value: { 2024: 8300, 2025: 8550, 2026: 8750, 2027: 9000, 2028: 9250, 2029: 9500, 2030: 9750, 2031: 10000, 2032: 10250, 2033: 10500, 2034: 10750 },
    },
    {
      key: "contributions.hsa_limits_individual", type: "json", category: "contributions", label: "HSA Contribution Limits (Individual)",
      description: "IRS HSA annual contribution limits by year (self-only coverage); applies once you age off family coverage at 26",
      value: { 2024: 4150, 2025: 4300, 2026: 4400, 2027: 4525, 2028: 4650, 2029: 4775, 2030: 4900, 2031: 5025, 2032: 5150, 2033: 5275, 2034: 5400 },
    },
  ]);

  // ── algorithm ─────────────────────────────────────────────────────────
  seed(db, [
    {
      key: "algorithm.scoring_weights", type: "json", category: "algorithm", label: "Scoring Weights",
      description: "Portfolio scoring component weights (must sum to 1.0)",
      value: { quality: 0.30, consensus: 0.25, conviction: 0.25, momentum: 0.20 },
    },
    { key: "algorithm.top_n",                    value: 20,   type: "number", category: "algorithm", label: "Top N Stocks",              description: "Number of top-ranked stocks to include in portfolio" },
    { key: "algorithm.weight_floor",              value: 2,    type: "number", category: "algorithm", label: "Weight Floor (%)",          description: "Minimum allocation % per position" },
    { key: "algorithm.weight_cap",                value: 15,   type: "number", category: "algorithm", label: "Weight Cap (%)",            description: "Maximum allocation % per position" },
    { key: "algorithm.conviction_cap_pct",        value: 20,   type: "number", category: "algorithm", label: "Conviction Cap (%)",        description: "Maximum % of portfolio = maximum conviction score" },
    { key: "algorithm.momentum_change_threshold", value: 0.10, type: "number", category: "algorithm", label: "Momentum Change Threshold", description: "Share count change % that qualifies as significant momentum" },
    { key: "algorithm.redistribution_iterations", value: 5,    type: "number", category: "algorithm", label: "Redistribution Iterations", description: "Weight redistribution convergence iterations" },
    { key: "algorithm.convergence_tolerance",     value: 0.01, type: "number", category: "algorithm", label: "Convergence Tolerance",     description: "Weight allocation convergence tolerance" },
    { key: "algorithm.cache_max_age_days",        value: 7,    type: "number", category: "algorithm", label: "Cache Max Age (days)",      description: "Days before SEC filing cache is considered stale" },
    { key: "algorithm.filings_per_manager",       value: 2,    type: "number", category: "algorithm", label: "Filings per Manager",       description: "Number of most-recent 13F filings to fetch per manager" },
    { key: "algorithm.fetch_batch_size",          value: 5,    type: "number", category: "algorithm", label: "Fetch Batch Size",          description: "Number of managers to process in parallel during SEC fetch" },
    { key: "algorithm.fetch_batch_delay_ms",      value: 600,  type: "number", category: "algorithm", label: "Fetch Batch Delay (ms)",   description: "Delay between batches when fetching SEC filings" },
    {
      key: "algorithm.curated_managers", type: "json", category: "algorithm", label: "Curated Managers",
      description: "13F filers to track, with tier and weight. Tier 1=1.0, Tier 2=0.8, Tier 3=0.6",
      value: [
        { cik: "0001067983", name: "Berkshire Hathaway",    tier: 1, tierWeight: 1.0 },
        { cik: "0001037389", name: "Renaissance Technologies", tier: 1, tierWeight: 1.0 },
        { cik: "0001350694", name: "Bridgewater Associates", tier: 2, tierWeight: 0.8 },
        { cik: "0001336528", name: "Pershing Square",        tier: 2, tierWeight: 0.8 },
        { cik: "0001656456", name: "Appaloosa Management",   tier: 2, tierWeight: 0.8 },
        { cik: "0001423053", name: "Citadel Advisors",       tier: 3, tierWeight: 0.6 },
        { cik: "0001179392", name: "Two Sigma Investments",  tier: 3, tierWeight: 0.6 },
        { cik: "0001061768", name: "Baupost Group",          tier: 3, tierWeight: 0.6 },
        { cik: "0001079114", name: "Greenlight Capital",     tier: 3, tierWeight: 0.6 },
        { cik: "0001040273", name: "Third Point",            tier: 3, tierWeight: 0.6 },
      ],
    },
  ]);

  // ── apartments ────────────────────────────────────────────────────────
  seed(db, [
    {
      key: "apartments.utility_baselines", type: "json", category: "apartments", label: "Utility Baselines by Region",
      description: "Monthly utility costs ($) for a 1-bedroom, by US Census region",
      value: {
        Northeast: { electricity: 90,  gas: 70, water: 45, sewer: 40, trash: 25 },
        Midwest:   { electricity: 95,  gas: 75, water: 40, sewer: 35, trash: 22 },
        South:     { electricity: 130, gas: 45, water: 50, sewer: 40, trash: 25 },
        West:      { electricity: 100, gas: 50, water: 55, sewer: 45, trash: 28 },
      },
    },
    { key: "apartments.internet_monthly", value: 65, type: "number", category: "apartments", label: "Internet Monthly ($)", description: "Flat national monthly internet estimate" },
    { key: "apartments.bedroom_factor_studio", value: 0.8,  type: "number", category: "apartments", label: "Bedroom Factor (studio)", description: "Utility cost multiplier for studio units" },
    { key: "apartments.bedroom_factor_per_br", value: 0.35, type: "number", category: "apartments", label: "Bedroom Factor per BR",   description: "Utility multiplier added per bedroom above 1BR" },
  ]);
}
