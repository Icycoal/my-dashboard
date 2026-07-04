import { NextResponse } from "next/server";
import { getAllSettings, updateSetting } from "@/lib/settings";
import type { AppSettings, TaxSettings, ContributionSettings, FinanceSettings, AlgorithmConfig } from "@/lib/finances-types";

function buildAppSettings(): AppSettings {
  const rows = getAllSettings();
  const byKey: Record<string, unknown> = {};
  for (const row of rows) {
    byKey[row.key] = JSON.parse(row.value);
  }

  const finances: FinanceSettings = {
    contrib401kStartYear:       byKey["finances.contrib_401k_start_year"] as number,
    lastMonthlyPayYear:         byKey["finances.last_monthly_pay_year"] as number,
    lastMonthlyPayMonth:        byKey["finances.last_monthly_pay_month"] as number,
    monthlyPayDay:              byKey["finances.monthly_pay_day"] as number,
    defaultEmployee401kPct:     byKey["finances.default_employee_401k_pct"] as number,
    defaultEmployerMatchPct:    byKey["finances.default_employer_match_pct"] as number,
    hysaSavingsRate:            byKey["finances.hysa_savings_rate"] as number,
    surplusBrokerageRatio:      byKey["finances.surplus_brokerage_ratio"] as number,
    surplusSavingsRatio:        byKey["finances.surplus_savings_ratio"] as number,
    defaultMortgageRatePct:     byKey["finances.default_mortgage_rate_pct"] as number,
    defaultLoanTermYears:       byKey["finances.default_loan_term_years"] as number,
    defaultAppreciationRatePct: byKey["finances.default_appreciation_rate_pct"] as number,
    birthYear:                  byKey["finances.birth_year"] as number,
    birthMonth:                 byKey["finances.birth_month"] as number,
    budgetWarningThresholdPct:  byKey["finances.budget_warning_threshold_pct"] as number,
  };

  const tax: TaxSettings = {
    ssRate:                   byKey["tax.ss_rate"] as number,
    medicareRate:             byKey["tax.medicare_rate"] as number,
    ssWageBase:               byKey["tax.ss_wage_base"] as Record<number, number>,
    standardDeductionSingle:  byKey["tax.standard_deduction_single"] as Record<number, number>,
    bracketsSingle:           byKey["tax.brackets_single"] as TaxSettings["bracketsSingle"],
    bracketsMarried:          byKey["tax.brackets_married"] as TaxSettings["bracketsMarried"],
  };

  const contributions: ContributionSettings = {
    rothIraLimits: byKey["contributions.roth_ira_limits"] as Record<number, number>,
    k401Limits:    byKey["contributions.401k_limits"] as Record<number, number>,
    hsaLimits:     byKey["contributions.hsa_limits"] as Record<number, number>,
    hsaLimitsIndividual: byKey["contributions.hsa_limits_individual"] as Record<number, number>,
  };

  const algorithm: AlgorithmConfig = {
    scoringWeights:             byKey["algorithm.scoring_weights"] as AlgorithmConfig["scoringWeights"],
    topN:                       byKey["algorithm.top_n"] as number,
    weightFloor:                byKey["algorithm.weight_floor"] as number,
    weightCap:                  byKey["algorithm.weight_cap"] as number,
    convictionCapPct:           byKey["algorithm.conviction_cap_pct"] as number,
    momentumChangeThreshold:    byKey["algorithm.momentum_change_threshold"] as number,
    redistributionIterations:   byKey["algorithm.redistribution_iterations"] as number,
    convergenceTolerance:       byKey["algorithm.convergence_tolerance"] as number,
    cacheMaxAgeDays:            byKey["algorithm.cache_max_age_days"] as number,
    filingsPerManager:          byKey["algorithm.filings_per_manager"] as number,
    fetchBatchSize:             byKey["algorithm.fetch_batch_size"] as number,
    fetchBatchDelayMs:          byKey["algorithm.fetch_batch_delay_ms"] as number,
    curatedManagers:            byKey["algorithm.curated_managers"] as AlgorithmConfig["curatedManagers"],
  };

  return { finances, tax, contributions, algorithm };
}

export async function GET() {
  try {
    return NextResponse.json(buildAppSettings());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { key, value } = await req.json() as { key: string; value: unknown };
    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
    updateSetting(key, value);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
