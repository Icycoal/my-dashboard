import { useEffect, useMemo, useRef, useState } from 'react';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart, Legend,
} from 'recharts';
import { useFinance } from '@/lib/FinanceProvider';
import { formatCurrency } from '@/lib/finances/formatters';
import { getLifetimeContributionsTotal } from '@/lib/finances/contributions';
import { calculateForwardBalances, calculateYearlySchedule, getBiweeklyContribAmounts, doesTransactionOccur } from '@/lib/finances/calculations';
import { getMortgageInfo, getMonthlyOwnershipCosts, isOnOrAfterPurchase, isMortgageActiveMonth, isRentCategory } from '@/lib/finances/realEstate';
import { getBiweeklyDatesInMonth } from '@/lib/finances/tax';
import { financeSettings } from '@/lib/clientSettings';

const inputClass =
  'w-full rounded-lg border border-white/[0.08] bg-gray-950/60 px-3 py-1.5 text-sm tabular-nums text-gray-100 focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/5';
const labelClass = 'block text-[11px] font-medium uppercase tracking-[0.06em] text-gray-500';


export default function NetWorthProjection({
  startingInvestments,
  startingCash,
  startingCardDebts,
  onMilestone,
}: {
  startingInvestments: number;
  startingCash: number;
  /** Current credit-card statement balances. Offset today's net worth only — the
   *  cash-flow sim pays these bills on their due dates, so carrying them into
   *  future years would double-count them. */
  startingCardDebts: number;
  onMilestone?: (m: { year: number; age: number } | null) => void;
}) {
  const { state, dispatch } = useFinance();
  const currentYear = new Date().getFullYear();
  const { birthYear, defaultMortgageRatePct, defaultLoanTermYears, defaultAppreciationRatePct } = financeSettings();

  const [years, setYears] = useState(30);
  const [returnRate, setReturnRate] = useState(10);
  const [coastYear, setCoastYear] = useState<number | ''>('');

  const yearlySchedule = useMemo(
    () => calculateYearlySchedule(state, currentYear, currentYear + years),
    [state, currentYear, years],
  );

  // Monthly display values — use first full future year so the display reflects steady state.
  const displayMonthly = useMemo(() => {
    const sched = yearlySchedule[currentYear + 1] ?? yearlySchedule[currentYear];
    if (!sched) return { trad401k: 0, roth401k: 0, hsa: 0, rothIra: 0, total: 0 };
    return {
      trad401k: sched.trad401k / 12,
      roth401k:  sched.roth401k  / 12,
      hsa:       sched.hsa       / 12,
      rothIra:   sched.rothIra   / 12,
      total:     sched.investmentContribs / 12,
    };
  }, [yearlySchedule, currentYear]);

  // Per-year surplus, brokerage, and cash end-balance come directly from calculateForwardBalances.
  // Extend through the full projection range so deficit detection works for distant years too.
  // steady* values are the fallbacks for years beyond the simulation horizon — taken from the
  // last fully simulated year, which already reflects the rent → house handoff (the first
  // future year may still be paying rent, so it would be the wrong steady state).
  const { yearlyCashSurplus, yearlyBrokerageContribs, yearlyCashEndBalance, steadySurplus, steadyBrokerage, steadyCash } = useMemo(() => {
    const lastSimYear = currentYear + Math.max(years, 8) + 1;
    const { yearlySurplus, yearlyBrokerage, yearlyCashEndBalance } = calculateForwardBalances(state, lastSimYear, 12);
    return {
      yearlyCashSurplus: yearlySurplus,
      yearlyBrokerageContribs: yearlyBrokerage,
      yearlyCashEndBalance,
      steadySurplus: yearlySurplus.get(lastSimYear) ?? 0,
      steadyBrokerage: yearlyBrokerage.get(lastSimYear) ?? 0,
      steadyCash: yearlyCashEndBalance.get(lastSimYear) ?? 0,
    };
  }, [state, currentYear, years]);

  // Annual living expenses = credit card budgets + recurring payments + recurring transactions
  // actually active that year (respects each transaction's start date and endDate — e.g. a
  // lease that ended shouldn't keep counting against future years).
  const re = state.realEstate;

  // Shared mortgage math — used both to project the housing expense (replacing rent
  // below) and to run the loan amortization in the main projection.
  const reMortgage = useMemo(() => {
    if (!re || re.purchaseDate === '') {
      return { rePurchaseYear: null as number | null, rePurchaseMonth: 0, reLoanAmount: 0, reMonthlyRate: 0, reMonthlyPmt: 0, reAppMo: 0, reOwnershipCosts: null as ReturnType<typeof getMonthlyOwnershipCosts> | null };
    }
    const info = getMortgageInfo(re);
    return {
      rePurchaseYear: info.purchaseYear,
      rePurchaseMonth: info.purchaseMonth - 1, // 0-indexed, matches projection loop below
      reLoanAmount: info.loanAmount,
      reMonthlyRate: info.monthlyRate,
      reMonthlyPmt: info.monthlyPayment,
      reAppMo: info.appreciationMonthly,
      reOwnershipCosts: getMonthlyOwnershipCosts(re),
    };
  }, [re]);

  // housingByYear isolates just the Rent → Mortgage line (still folded into the totals
  // below for cash-flow surplus math) so the UI can show it as its own line — it's the
  // one expense whose character changes entirely (fixed rent vs. rate-dependent mortgage).
  const { expenses: annualExpensesByYear, housing: housingByYear } = useMemo(() => {
    const ccBudget  = state.creditCards.reduce((s, c) => s + (c.monthlyBudget ?? 0), 0);
    const recurring = state.recurringPayments.reduce((s, r) => s + r.amount, 0);
    const flatAnnual = (ccBudget + recurring) * 12;

    const recurringTxns = state.transactions.filter(t => t.category !== 'Transfer' && t.amount < 0 && t.recurrence !== 'once');

    const { rePurchaseYear, rePurchaseMonth, reOwnershipCosts } = reMortgage;
    const rePurchaseMonth1 = rePurchaseMonth + 1; // reMortgage's month is 0-indexed; transactions use 1-indexed months

    const expenses = new Map<number, number>();
    const housing = new Map<number, number>();
    for (let yr = currentYear; yr <= currentYear + years; yr++) {
      let txAnnual = 0;
      let housingAnnual = 0;
      for (const t of recurringTxns) {
        if (t.recurrence === 'monthly') {
          for (let m = 1; m <= 12; m++) {
            // Once the house is bought, rent stops — the full ownership cost (below) replaces it.
            if (isRentCategory(t.category) && re && rePurchaseYear != null && isOnOrAfterPurchase(re, yr, m, t.day)) continue;
            if (doesTransactionOccur(t, yr, m, t.day)) {
              txAnnual += Math.abs(t.amount);
              if (isRentCategory(t.category)) housingAnnual += Math.abs(t.amount);
            }
          }
        } else if (t.recurrence === 'annually') {
          if (doesTransactionOccur(t, yr, t.month, t.day)) txAnnual += Math.abs(t.amount);
        } else if (t.recurrence === 'weekly') {
          const daysInYear = (yr % 4 === 0 && (yr % 100 !== 0 || yr % 400 === 0)) ? 366 : 365;
          for (let d = 1; d <= daysInYear; d++) {
            const date = new Date(yr, 0, d);
            if (doesTransactionOccur(t, yr, date.getMonth() + 1, date.getDate())) txAnnual += Math.abs(t.amount);
          }
        }
      }
      if (re && rePurchaseYear != null && reOwnershipCosts) {
        for (let m = 1; m <= 12; m++) {
          const isAtOrAfterPurchase = yr > rePurchaseYear || (yr === rePurchaseYear && m >= rePurchaseMonth1);
          if (isAtOrAfterPurchase) {
            // Full carrying cost, not just P&I — HOA, property tax, insurance, maintenance.
            // P&I drops off once the loan term ends; the other costs run for life.
            const monthlyCost = isMortgageActiveMonth(re, yr, m)
              ? reOwnershipCosts.total
              : reOwnershipCosts.total - reOwnershipCosts.mortgage;
            txAnnual += monthlyCost;
            housingAnnual += monthlyCost;
          }
        }
      }
      expenses.set(yr, flatAnnual + txAnnual);
      housing.set(yr, housingAnnual);
    }
    return { expenses, housing };
  }, [state.creditCards, state.recurringPayments, state.transactions, currentYear, years, reMortgage]);

  // Starting balance per account type from latest snapshots.
  const startingByType = useMemo(() => {
    const latest = new Map<string, { value: number; importedAt: string }>();
    for (const snap of state.rothSnapshots) {
      const key = snap.accountType ?? 'Roth IRA';
      const prev = latest.get(key);
      if (!prev || snap.importedAt > prev.importedAt) latest.set(key, { value: snap.totalValue, importedAt: snap.importedAt });
    }
    // Fall back to lifetime contributions total when no snapshot has been imported.
    return {
      trad401k: latest.get('401k')?.value ?? getLifetimeContributionsTotal(state, '401k'),
      hsa:      latest.get('HSA')?.value  ?? getLifetimeContributionsTotal(state, 'HSA'),
      rothIra:  latest.get('Roth IRA')?.value ?? getLifetimeContributionsTotal(state, 'Roth IRA'),
      brokerage: latest.get('Brokerage')?.value ?? 0,
    };
  }, [state.rothSnapshots, startingCash]);

  // Local string buffer for the real-estate inputs. The store's values are numbers that
  // get parsed/rounded on every dispatch, so binding `value` straight to them fights
  // typing — a decimal point or a cleared field instantly collapses back to "6" or "0"
  // before the next keystroke lands. Keep the raw typed string as the source of truth
  // for display, and dispatch a best-effort parsed number alongside it so the chart
  // still updates live.
  const reDefaults = {
    purchaseDate: '', purchasePrice: '', downPayment: '',
    mortgageRatePct: String(defaultMortgageRatePct),
    loanTermYears: String(defaultLoanTermYears),
    appreciationRatePct: String(defaultAppreciationRatePct),
    hoaMonthly: '0', propertyTaxAnnualPct: '0', insuranceMonthly: '0', maintenanceMonthly: '0',
  };
  const reToFields = (cfg: NonNullable<typeof re>): Record<string, string> => ({
    purchaseDate: cfg.purchaseDate,
    purchasePrice: String(cfg.purchasePrice),
    downPayment: String(cfg.downPayment),
    mortgageRatePct: String(cfg.mortgageRatePct),
    loanTermYears: String(cfg.loanTermYears),
    appreciationRatePct: String(cfg.appreciationRatePct),
    hoaMonthly: String(cfg.hoaMonthly ?? 0),
    propertyTaxAnnualPct: String(cfg.propertyTaxAnnualPct ?? 0),
    insuranceMonthly: String(cfg.insuranceMonthly ?? 0),
    maintenanceMonthly: String(cfg.maintenanceMonthly ?? 0),
  });
  const [reFields, setReFields] = useState<Record<string, string>>(() => (re ? reToFields(re) : reDefaults));
  const reFieldsInitialized = useRef(!!re);
  useEffect(() => {
    if (reFieldsInitialized.current || !re) return;
    setReFields(reToFields(re));
    reFieldsInitialized.current = true;
  }, [re]);

  const projection = useMemo(() => {
    const annualRate     = returnRate / 100;
    const monthlyRate    = annualRate / 12;
    const checkRate      = (1 + annualRate) ** (1 / 26) - 1;   // per biweekly check
    const now = new Date();
    const monthsLeftThisYear = 12 - now.getMonth();

    const biweeklyStartDate = state.payConfig.biweeklyStartDate ?? null;
    const biweeklyStartYear = biweeklyStartDate
      ? new Date(biweeklyStartDate + 'T12:00:00').getFullYear()
      : null;

    const rows: {
      year: number; age: number; label: string;
      bal401k: number; balHsa: number; balRothIra: number; balBrokerage: number; balCash: number;
      balRealEstate: number; investments: number; netWorth: number; totalInput: number;
    }[] = [];

    let bal401k      = startingByType.trad401k;
    let balHsa       = startingByType.hsa;
    let balRothIra   = startingByType.rothIra;
    let balBrokerage = startingByType.brokerage;
    // Cash mirrors the cash-flow simulation's checking balance rather than compounding
    // independently — the sim already routes surplus into brokerage (counted below), so
    // letting the starting balance also grow here would double-count it.
    let balCash      = startingCash;

    // Real estate — mortgage math computed once in reMortgage, shared with annualExpensesByYear.
    const { rePurchaseYear, rePurchaseMonth, reLoanAmount, reMonthlyRate, reMonthlyPmt, reAppMo } = reMortgage;
    let loanBalance       = 0;
    let homeValue         = 0;
    let balRealEstate     = 0;

    const scheduledYears = Object.keys(yearlySchedule).map(Number).sort((a, b) => a - b);
    const lastScheduledYear = scheduledYears[scheduledYears.length - 1] ?? currentYear;
    const lastSched = yearlySchedule[lastScheduledYear];

    const totalAll = () => bal401k + balHsa + balRothIra + balBrokerage + balCash + balRealEstate;

    // Named loans have no payment stream in the model: with a rate set they compound
    // annually (an unpaid loan grows), without one they stay flat. Log payments as you
    // make them by editing the debt's balance down. Card balances are NOT carried
    // forward — the cash-flow sim pays each statement on its due date.
    const loanDebts = state.debts ?? [];
    const loansAt = (asOfYear: number) => loanDebts.reduce(
      (s, d) => s + d.balance * Math.pow(1 + (d.interestRate ?? 0) / 100, Math.max(0, asOfYear - currentYear)),
      0,
    );

    let totalInput = totalAll();

    rows.push({
      year: currentYear, age: currentYear - birthYear,
      label: `${currentYear} · ${currentYear - birthYear}`,
      bal401k, balHsa, balRothIra, balBrokerage, balCash, balRealEstate,
      investments: totalAll(),
      netWorth: totalAll() - startingCardDebts - loansAt(currentYear),
      totalInput,
    });

    for (let y = 1; y <= Math.max(years, 60); y++) {
      const projYear  = currentYear + y;
      const accumYear = projYear - 1;
      const monthsInYear = y === 1 ? monthsLeftThisYear : 12; // used only for non-biweekly fallback
      const sched = yearlySchedule[accumYear];
      const ref = sched ?? lastSched;

      // Use biweekly compounding when in biweekly territory, monthly otherwise.
      const isBiweekly = biweeklyStartDate != null && biweeklyStartYear != null && accumYear >= biweeklyStartYear;
      let numPeriods: number;
      let iRate: number;   // investment rate per period
      if (isBiweekly) {
        numPeriods = accumYear === currentYear
          ? getBiweeklyContribAmounts(state, accumYear).numChecks
          : (() => { let n = 0; for (let m = 1; m <= 12; m++) n += getBiweeklyDatesInMonth(biweeklyStartDate!, accumYear, m).length; return n; })();
        iRate = checkRate;
      } else {
        numPeriods = monthsInYear > 0 ? monthsInYear : 12;
        iRate = monthlyRate;
      }

      const periods = numPeriods > 0 ? numPeriods : (isBiweekly ? 26 : 12);
      const coasting = coastYear !== '' && accumYear >= coastYear;

      // Deficit: cash flow simulation shows negative end-of-year balance → stop all
      // contributions and liquidate investments instead of adding to them.
      const cashEndBalance = yearlyCashEndBalance.get(accumYear);
      const inDeficit = cashEndBalance !== undefined && cashEndBalance < 0;

      const per401k          = (coasting || inDeficit) ? 0 : (ref?.trad401k      ?? 0) / periods;
      const perEmployerMatch = (coasting || inDeficit) ? 0 : (ref?.employerMatch ?? 0) / periods;
      const perHsa           = (coasting || inDeficit) ? 0 : (ref?.hsa           ?? 0) / periods;
      const perRothIra       = (coasting || inDeficit) ? 0 : (ref?.rothIra       ?? 0) / periods;

      const annualBrokerage = inDeficit ? 0 : (yearlyBrokerageContribs.get(accumYear) ?? steadyBrokerage);
      const perBrokerage = (coasting || inDeficit) ? 0 : annualBrokerage / periods;

      for (let p = 0; p < periods; p++) {
        bal401k      = bal401k      * (1 + iRate) + per401k + perEmployerMatch;
        balHsa       = balHsa       * (1 + iRate) + perHsa;
        balRothIra   = balRothIra   * (1 + iRate) + perRothIra;
        balBrokerage = balBrokerage * (1 + iRate) + perBrokerage;
      }

      // Checking cash: the sim's actual end-of-year balance (house costs included),
      // held at the last simulated year's level beyond the horizon. Deficit years
      // land at 0 — the liquidation below covers the shortfall from investments.
      balCash = Math.max(0, cashEndBalance ?? steadyCash);

      // Liquidate investments to cover cash deficit (brokerage → Roth IRA → HSA → 401k)
      if (inDeficit && cashEndBalance !== undefined) {
        let remaining = Math.abs(cashEndBalance);
        const fromBrokerage = Math.min(balBrokerage, remaining);
        balBrokerage = Math.max(0, balBrokerage - fromBrokerage);
        remaining -= fromBrokerage;
        if (remaining > 0) {
          const fromRothIra = Math.min(balRothIra, remaining);
          balRothIra = Math.max(0, balRothIra - fromRothIra);
          remaining -= fromRothIra;
        }
        if (remaining > 0) {
          const fromHsa = Math.min(balHsa, remaining);
          balHsa = Math.max(0, balHsa - fromHsa);
          remaining -= fromHsa;
        }
        if (remaining > 0) {
          bal401k = Math.max(0, bal401k - remaining);
        }
      }

      // Real estate: apply down payment then run monthly amortization
      if (re && rePurchaseYear != null) {
        if (accumYear === rePurchaseYear) {
          homeValue   = re.purchasePrice;
          loanBalance = reLoanAmount;
          // Down payment comes out of brokerage: balCash mirrors the checking sim,
          // which never holds down-payment-sized cash (surplus auto-invests monthly).
          balBrokerage = Math.max(0, balBrokerage - re.downPayment);
        }
        if (accumYear >= rePurchaseYear && homeValue > 0) {
          const monthsActive = accumYear === rePurchaseYear ? 12 - rePurchaseMonth : 12;
          for (let mo = 0; mo < monthsActive; mo++) {
            homeValue  *= (1 + reAppMo);
            const interest = loanBalance * reMonthlyRate;
            const principal = Math.max(0, reMonthlyPmt - interest);
            loanBalance = Math.max(0, loanBalance - principal);
          }
          balRealEstate = homeValue - loanBalance;
        }
      }

      if (!coasting && !inDeficit) totalInput += (ref?.investmentContribs ?? 0) + annualBrokerage;

      const age = accumYear - birthYear;
      rows.push({
        year: projYear, age,
        label: `${projYear} · ${age}`,
        bal401k, balHsa, balRothIra, balBrokerage, balCash, balRealEstate,
        investments: totalAll(),
        netWorth: totalAll() - loansAt(accumYear),
        totalInput,
      });
    }
    return rows;
  }, [years, returnRate, yearlyCashEndBalance, yearlyBrokerageContribs, steadyBrokerage, steadyCash,
      yearlySchedule, startingByType, startingCash, startingCardDebts, state.debts, currentYear, coastYear, reMortgage, state.payConfig.biweeklyStartDate]);

  // Rent that the house replaces: monthly Rent recurrences still active in the month
  // before the purchase date. Shown in the handoff strip so the rent → house monthly
  // delta is visible at a glance.
  const rentAtHandoff = useMemo(() => {
    if (!re || re.purchaseDate === '') return 0;
    const info = getMortgageInfo(re);
    let y = info.purchaseYear, m = info.purchaseMonth - 1;
    if (m < 1) { m = 12; y -= 1; }
    return state.transactions
      .filter(t => isRentCategory(t.category) && t.recurrence === 'monthly' && t.amount < 0)
      .reduce((s, t) => s + (doesTransactionOccur(t, y, m, t.day) ? Math.abs(t.amount) : 0), 0);
  }, [re, state.transactions]);

  const final = projection[projection.length - 1];
  const millionRow = projection.find(r => r.netWorth >= 1_000_000);

  const onMilestoneRef = useRef(onMilestone);
  onMilestoneRef.current = onMilestone;
  useEffect(() => {
    onMilestoneRef.current?.(millionRow ? { year: millionRow.year, age: millionRow.age } : null);
  }, [millionRow]);

  // Per-year surplus for display in the schedule table — stop at the $1M milestone year.
  const scheduleTableRows = useMemo(() => {
    const biweeklyStartDate = state.payConfig.biweeklyStartDate ?? null;
    const cutoff = millionRow?.year ?? currentYear + years;
    return Object.keys(yearlySchedule).map(Number).sort((a, b) => a - b).filter(yr => yr <= cutoff).map(yr => {
      const sched = yearlySchedule[yr];
      const cashSurplus = yearlyCashSurplus.get(yr);
      const expensesForYear = annualExpensesByYear.get(yr) ?? 0;
      let surplus: number;
      if (cashSurplus !== undefined)  surplus = cashSurplus;
      else if (expensesForYear > 0)   surplus = Math.max(0, sched.netPay - expensesForYear);
      else                            surplus = steadySurplus;
      let checkCount: number | null = null;
      if (biweeklyStartDate) {
        checkCount = 0;
        for (let m = 1; m <= 12; m++) checkCount += getBiweeklyDatesInMonth(biweeklyStartDate, yr, m).length;
      }
      const cashEndBalance = yearlyCashEndBalance.get(yr);
      const isDeficitYear = cashEndBalance !== undefined && cashEndBalance < 0;
      const housingForYear = housingByYear.get(yr) ?? 0;
      // Purchase year mixes rent (pre-purchase months) and mortgage (post-purchase months);
      // any full year after that is mortgage-only, any full year before is rent-only.
      const isPurchaseYear = reMortgage.rePurchaseYear === yr;
      const isMortgage = reMortgage.rePurchaseYear != null && yr > reMortgage.rePurchaseYear;
      return { yr, sched, surplus, expensesForYear, checkCount, isDeficitYear, cashEndBalance, housingForYear, isMortgage, isPurchaseYear };
    });
  }, [yearlySchedule, yearlyCashSurplus, yearlyCashEndBalance, steadySurplus, annualExpensesByYear, housingByYear, reMortgage, state.payConfig.biweeklyStartDate, millionRow, currentYear, years]);

  return (
    <section className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium uppercase tracking-[0.08em] text-gray-500">Projection</h2>
        <p className="text-xs text-gray-600">
          Compounded monthly · schedule-driven contributions · card balances settle via cash flow · loans accrue at their APR
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {([50_000, 100_000, 250_000, 500_000, 1_000_000] as const).map(target => {
          const hit = projection.find(r => r.netWorth >= target);
          const already = hit?.year === currentYear;
          const yearsAway = hit ? hit.year - 1 - currentYear : null;
          const label = target === 1_000_000 ? '$1M' : `$${target / 1000}K`;
          return (
            <div
              key={target}
              className={`rounded-xl border p-4 text-center ${
                already
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : hit
                  ? 'border-white/[0.06] bg-gray-900/60'
                  : 'border-white/[0.04] bg-white/[0.01] opacity-50'
              }`}
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-gray-500">{label}</p>
              {already ? (
                <>
                  <p className="mt-2 text-xl font-semibold text-emerald-400">Now</p>
                  <p className="mt-0.5 text-xs text-gray-500">age {hit!.age}</p>
                </>
              ) : hit ? (
                <>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-gray-50">{hit.year - 1}</p>
                  <p className="mt-0.5 text-sm text-gray-400">age {hit.age}</p>
                  <p className="mt-1 text-xs text-gray-600">{yearsAway}y from now</p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-xl font-semibold text-gray-600">—</p>
                  <p className="mt-0.5 text-xs text-gray-600">beyond 60y</p>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="rounded-2xl border border-white/[0.06] bg-gray-900/40 p-5">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Years</label>
            <input
              type="number" min={1} max={60} value={years}
              onChange={(e) => setYears(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
          <div>
            <label className={labelClass}>Annual Return %</label>
            <input
              type="number" step="0.1" min={0} max={30} value={returnRate}
              onChange={(e) => setReturnRate(Math.max(0, Math.min(30, parseFloat(e.target.value) || 0)))}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
          <div>
            <label className={labelClass}>Coast Year <span className="normal-case text-gray-600">(stop adding)</span></label>
            <input
              type="number" min={currentYear} max={currentYear + 60}
              value={coastYear}
              placeholder="none"
              onChange={(e) => {
                const v = parseInt(e.target.value);
                setCoastYear(isNaN(v) ? '' : v);
              }}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
        </div>

        {/* Real estate config */}
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className={labelClass}>Real Estate</span>
            {re && (
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: 'SET_REAL_ESTATE', config: undefined });
                  setReFields(reDefaults);
                  reFieldsInitialized.current = false;
                }}
                className="text-[10px] text-gray-600 hover:text-red-400"
              >
                Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { label: 'Purchase Date', key: 'purchaseDate', type: 'date', step: undefined },
              { label: 'Purchase Price ($)', key: 'purchasePrice', type: 'number', step: '1000' },
              { label: 'Down Payment ($)', key: 'downPayment', type: 'number', step: '1000' },
              { label: 'Mortgage Rate (%)', key: 'mortgageRatePct', type: 'number', step: '0.1' },
              { label: 'Loan Term (yrs)', key: 'loanTermYears', type: 'number', step: '1' },
              { label: 'Appreciation (%)', key: 'appreciationRatePct', type: 'number', step: '0.1' },
              { label: 'HOA ($/mo)', key: 'hoaMonthly', type: 'number', step: '10' },
              { label: 'Property Tax (%/yr)', key: 'propertyTaxAnnualPct', type: 'number', step: '0.05' },
              { label: 'Insurance ($/mo)', key: 'insuranceMonthly', type: 'number', step: '10' },
              { label: 'Maintenance ($/mo)', key: 'maintenanceMonthly', type: 'number', step: '10' },
            ].map(({ label, key, type, step }) => (
              <div key={key}>
                <label className={labelClass}>{label}</label>
                <input
                  type={type}
                  step={step}
                  value={reFields[key]}
                  onChange={e => {
                    const strVal = e.target.value;
                    setReFields(prev => ({ ...prev, [key]: strVal }));
                    reFieldsInitialized.current = true;
                    const val = type === 'date' ? strVal : (strVal.trim() === '' ? 0 : parseFloat(strVal));
                    if (type !== 'date' && isNaN(val as number)) return;
                    dispatch({
                      type: 'SET_REAL_ESTATE',
                      config: { purchaseDate: '', purchasePrice: 0, downPayment: 0, mortgageRatePct: defaultMortgageRatePct, loanTermYears: defaultLoanTermYears, appreciationRatePct: defaultAppreciationRatePct, ...re, [key]: val },
                    });
                  }}
                  className={`mt-1 ${inputClass}`}
                  placeholder={type === 'date' ? 'YYYY-MM-DD' : undefined}
                />
              </div>
            ))}
          </div>

          {/* Rent → house handoff: the one number that changes on the purchase date */}
          {re && re.purchaseDate !== '' && reMortgage.reOwnershipCosts && (
            <div className="mt-3 rounded-xl border border-orange-500/20 bg-orange-500/[0.04] px-4 py-3 text-xs">
              <p className="text-gray-400">
                Rent <span className="tabular-nums font-medium text-gray-200">{formatCurrency(rentAtHandoff)}/mo</span>
                <span className="text-gray-600"> until </span>
                <span className="tabular-nums text-gray-300">{re.purchaseDate}</span>
                <span className="text-gray-600"> → house </span>
                <span className={`tabular-nums font-semibold ${reMortgage.reOwnershipCosts.total > rentAtHandoff ? 'text-orange-300' : 'text-emerald-300'}`}>
                  {formatCurrency(reMortgage.reOwnershipCosts.total)}/mo
                </span>
                <span className={`ml-1.5 tabular-nums ${reMortgage.reOwnershipCosts.total > rentAtHandoff ? 'text-orange-400/70' : 'text-emerald-400/70'}`}>
                  ({reMortgage.reOwnershipCosts.total > rentAtHandoff ? '+' : ''}{formatCurrency(reMortgage.reOwnershipCosts.total - rentAtHandoff)}/mo)
                </span>
              </p>
              <p className="mt-1.5 text-[11px] text-gray-500">
                {([
                  ['P&I', reMortgage.reOwnershipCosts.mortgage],
                  ['HOA', reMortgage.reOwnershipCosts.hoa],
                  ['Property tax', reMortgage.reOwnershipCosts.propertyTax],
                  ['Insurance', reMortgage.reOwnershipCosts.insurance],
                  ['Maintenance', reMortgage.reOwnershipCosts.maintenance],
                ] as const).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${formatCurrency(v)}`).join(' + ')}
                <span className="text-gray-600"> · cash flow charges these on the {getMortgageInfo(re).purchaseDay}
                {getMortgageInfo(re).purchaseDay === 1 ? 'st' : getMortgageInfo(re).purchaseDay === 2 ? 'nd' : getMortgageInfo(re).purchaseDay === 3 ? 'rd' : 'th'} of each month from the purchase date</span>
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-gray-600 sm:grid-cols-4">
          <div>Trad 401k <span className="tabular-nums text-gray-400">{formatCurrency(displayMonthly.trad401k)}/mo</span></div>
          <div>Roth 401k <span className="tabular-nums text-gray-400">{formatCurrency(displayMonthly.roth401k)}/mo</span></div>
          <div>Roth IRA <span className="tabular-nums text-gray-400">{formatCurrency(displayMonthly.rothIra)}/mo</span></div>
          <div>HSA <span className="tabular-nums text-gray-400">{formatCurrency(displayMonthly.hsa)}/mo</span></div>
        </div>
      </div>

      {/* Per-year schedule table */}
      <div className="rounded-2xl border border-white/[0.06] bg-gray-900/40 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.06em] text-gray-500">Per-Year Schedule</h3>
          <p className="mt-0.5 text-[10px] text-gray-600">
            Contributions from actual pay schedule · Other Expenses excludes the Rent/Mortgage column (Surplus reflects both) · brokerage from monthly % of cash balance
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Year', 'Gross Pay', 'Emp 401k', 'HSA', 'Fed Tax', 'FICA', 'Rent/Mortgage', 'Other Expenses', 'Net Pay', 'Surplus', 'Match', 'Brokerage', 'HYSA', 'Total Invested'].map(h => (
                  <th key={h} className="px-4 py-2 text-right text-[11px] font-medium uppercase tracking-[0.06em] text-gray-500 first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scheduleTableRows.map(({ yr, sched, surplus, expensesForYear, checkCount, isDeficitYear, cashEndBalance, housingForYear, isMortgage, isPurchaseYear }) => {
                const isCurrentYear = yr === currentYear;
                const totalTaxes = sched.grossPay - sched.trad401k - sched.roth401k - sched.hsa - sched.rothIra - sched.netPay;
                const fedTax     = Math.max(0, totalTaxes - sched.fica);
                const brokerageAmt = isDeficitYear ? 0 : (yearlyBrokerageContribs.get(yr) ?? 0);
                const hysaAmt     = 0;
                return (
                  <tr key={yr} className={`border-b border-white/[0.04] ${isCurrentYear ? 'bg-white/[0.02]' : ''} ${isDeficitYear ? 'bg-red-950/20' : ''}`}>
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-200">
                      {yr}
                      <span className="ml-1.5 text-[10px] font-normal text-gray-600">· {yr - birthYear}</span>
                      {checkCount === 27 && (
                        <span className="ml-1.5 text-[10px] font-semibold text-amber-400" title="27-paycheck year — one extra biweekly check">27✓</span>
                      )}
                      {isDeficitYear && (
                        <span className="ml-1.5 text-[10px] font-semibold text-red-400" title={`Cash ends at ${formatCurrency(cashEndBalance ?? 0)} — investments liquidated`}>deficit</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-gray-300">{formatCurrency(sched.grossPay)}</td>
                    <td className={`px-4 py-2.5 text-right text-sm tabular-nums ${isDeficitYear ? 'text-red-400/50 line-through' : 'text-gray-400'}`}>{formatCurrency(sched.trad401k)}</td>
                    <td className={`px-4 py-2.5 text-right text-sm tabular-nums ${isDeficitYear ? 'text-red-400/50 line-through' : 'text-gray-400'}`}>{formatCurrency(sched.hsa)}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-red-400/70">{fedTax > 0 ? formatCurrency(fedTax) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-red-300/50">{sched.fica > 0 ? formatCurrency(sched.fica) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-orange-400/80">
                      {housingForYear > 0 ? `-${formatCurrency(housingForYear)}` : '—'}
                      {isPurchaseYear && <span className="ml-1 text-[10px] text-gray-600">mixed</span>}
                      {isMortgage && <span className="ml-1 text-[10px] text-gray-600">mtg</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-red-400/70">{expensesForYear - housingForYear > 0 ? `-${formatCurrency(expensesForYear - housingForYear)}` : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-gray-300">{formatCurrency(sched.netPay)}</td>
                    <td className={`px-4 py-2.5 text-right text-sm tabular-nums ${isDeficitYear ? 'text-red-400 font-medium' : 'text-gray-300'}`}>
                      {isDeficitYear
                        ? `−${formatCurrency(Math.abs(cashEndBalance ?? 0))}`
                        : formatCurrency(surplus)
                      }
                    </td>
                    <td className={`px-4 py-2.5 text-right text-sm tabular-nums ${isDeficitYear ? 'text-red-400/40 line-through' : 'text-emerald-600'}`}>{sched.employerMatch > 0 ? formatCurrency(sched.employerMatch) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-amber-400/80">
                      {brokerageAmt > 0 ? formatCurrency(brokerageAmt) : '—'}
                      {yr === currentYear && !isDeficitYear && <span className="ml-1 text-[10px] text-gray-600">partial</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-cyan-400/80">
                      {hysaAmt > 0 ? formatCurrency(hysaAmt) : '—'}
                    </td>
                    <td className={`px-4 py-2.5 text-right text-sm tabular-nums font-medium ${isDeficitYear ? 'text-red-400/60' : 'text-gray-200'}`}>
                      {isDeficitYear ? '—' : formatCurrency(sched.investmentContribs + brokerageAmt + hysaAmt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-white/[0.06] bg-gray-900/40 p-5">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projection.filter(r => r.year <= currentYear + years)} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#ffffff10" strokeDasharray="3 3" />
              <XAxis
                dataKey="year"
                stroke="#69718a"
                fontSize={11}
                tickFormatter={(y: number) => `${y} · ${y - 1 - birthYear}`}
              />
              <YAxis stroke="#69718a" fontSize={11} tickFormatter={(n: number) => {
                if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
                if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
                return `$${Math.round(n)}`;
              }} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const total = (payload as { value: number }[]).reduce((s, p) => s + (p.value || 0), 0);
                  const row = projection.find(r => r.year === label);
                  const input = row?.totalInput ?? 0;
                  const growth = total - input;
                  return (
                    <div style={{ background: '#0a0a0a', border: '1px solid #ffffff15', borderRadius: 8, fontSize: 12, padding: '8px 12px' }}>
                      <p style={{ color: '#97a0b5', marginBottom: 6 }}>{(label as number) - 1} · age {(label as number) - 1 - birthYear}</p>
                      {(payload as { name: string; value: number; color: string }[]).map(p => (
                        <p key={p.name} style={{ color: p.color }}>{p.name}: {formatCurrency(p.value)}</p>
                      ))}
                      <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #ffffff20' }}>
                        <p style={{ color: '#f9fafb', fontWeight: 600 }}>Total: {formatCurrency(total)}</p>
                        <p style={{ color: '#69718a', marginTop: 2 }}>Total Input: {formatCurrency(input)}</p>
                        <p style={{ color: growth >= 0 ? '#34d399' : '#f87171', marginTop: 2 }}>Growth: {formatCurrency(growth)}</p>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="bal401k"        stackId="1" name="401k"        stroke="#666eff" fill="#666eff" fillOpacity={0.5} strokeWidth={0} />
              <Area type="monotone" dataKey="balHsa"         stackId="1" name="HSA"         stroke="#10b981" fill="#10b981" fillOpacity={0.5} strokeWidth={0} />
              <Area type="monotone" dataKey="balRothIra"     stackId="1" name="Roth IRA"    stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.5} strokeWidth={0} />
              <Area type="monotone" dataKey="balBrokerage"   stackId="1" name="Brokerage"   stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.5} strokeWidth={0} />
              <Area type="monotone" dataKey="balCash"        stackId="1" name="Cash"        stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.5} strokeWidth={0} />
              {re && <Area type="monotone" dataKey="balRealEstate" stackId="1" name="Real Estate" stroke="#f97316" fill="#f97316" fillOpacity={0.5} strokeWidth={0} />}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
