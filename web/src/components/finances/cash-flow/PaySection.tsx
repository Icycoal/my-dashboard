import { useState, useEffect, useMemo } from 'react';
import { useFinance } from '@/lib/FinanceProvider';
import { formatCurrency, MONTH_NAMES } from '@/lib/finances/formatters';
import { calculateMonthlyPaycheck, calculateAnnualFederalTax, getStandardDeduction, workMonthFor, calculateBiweeklyBreakdown, getBiweeklyDatesInMonth, getEffectiveHourlyRate } from '@/lib/finances/tax';
import { getPlannedMonthlyContribution, getContributionLimit, getContributionsTotal } from '@/lib/finances/contributions';
import { getBiweeklyContribAmounts, calculateAnnualTaxSummary } from '@/lib/finances/calculations';
import { financeSettings } from '@/lib/clientSettings';
import Modal from '@/components/finances/common/Modal';

const inputClass = 'mt-1.5 w-full rounded-lg border border-white/[0.08] bg-gray-950/60 px-3.5 py-2 text-sm text-gray-100 placeholder:text-gray-600 transition-colors focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/5';
const labelClass = 'block text-xs font-medium uppercase tracking-[0.06em] text-gray-500';
const chipInputClass = 'w-20 rounded-md border border-white/[0.08] bg-gray-950/60 px-1.5 py-0.5 text-right text-xs tabular-nums text-gray-100 focus:border-white/20 focus:outline-none';

export default function PaySection({ yearlyAutoInvest = 0 }: { yearlyAutoInvest?: number }) {
  const { state, dispatch } = useFinance();
  const year = state.activeYear;
  const { payConfig } = state;
  const holidays = state.holidays ?? [];
  const { defaultEmployee401kPct, defaultEmployerMatchPct, contrib401kStartYear, lastMonthlyPayYear, lastMonthlyPayMonth: lastMonthlyPayMonthSetting } = financeSettings();

  const [showConfig, setShowConfig] = useState(false);
  const [showHolidays, setShowHolidays] = useState(false);
  const [rateInput, setRateInput] = useState(payConfig.hourlyRate.toString());
  const [hoursInput, setHoursInput] = useState(payConfig.hoursPerDay.toString());
  const [payDayInput, setPayDayInput] = useState((payConfig.payDay ?? '').toString());
  const [filingInput, setFilingInput] = useState(payConfig.filingStatus);
  const [fixedGrossInput, setFixedGrossInput] = useState((payConfig.fixedMonthlyGross ?? '').toString());
  const [fixedFromMonthInput, setFixedFromMonthInput] = useState((payConfig.fixedGrossFromPayMonth ?? '').toString());
  const [firstPayMonthInput, setFirstPayMonthInput] = useState((payConfig.firstPayMonth ?? 1).toString());
  const [annualRaisePctInput, setAnnualRaisePctInput] = useState((payConfig.annualRaisePct ?? '').toString());
  const [raiseStartYearInput, setRaiseStartYearInput] = useState((payConfig.raiseStartYear ?? '').toString());
  const [employeeContrib401kPctInput, setEmployeeContrib401kPctInput] = useState((payConfig.employeeContrib401kPct ?? defaultEmployee401kPct).toString());
  const [employerMatchPctInput, setEmployerMatchPctInput] = useState((payConfig.employerMatchPct ?? defaultEmployerMatchPct).toString());
  const [biweeklyStartDateInput, setBiweeklyStartDateInput] = useState(payConfig.biweeklyStartDate ?? '');
  const [biweeklyNetAmountInput, setBiweeklyNetAmountInput] = useState((payConfig.biweeklyNetAmount ?? '').toString());
  const [ficaStartDateInput, setFicaStartDateInput] = useState(payConfig.ficaStartDate ?? '');
  const [trad401kInput, setTrad401kInput] = useState((payConfig.traditional401k ?? 0).toString());
  const [roth401kInput, setRoth401kInput] = useState((payConfig.roth401k ?? 0).toString());
  const [hsaInput, setHsaInput] = useState((payConfig.hsaMonthly ?? 0).toString());
  const [rothIraInput, setRothIraInput] = useState((payConfig.rothIraMonthly ?? 0).toString());

  // Local state for inline chip inputs — allows free typing without reset-on-clear bug.
  // useEffect only syncs back when the stored value genuinely differs (e.g. modal saved a new value).
  const [chipTradValue, setChipTradValue] = useState((payConfig.traditional401k ?? 0).toString());
  const [chipHsaValue, setChipHsaValue] = useState((payConfig.hsaMonthly ?? 0).toString());
  const [chipRothIraValue, setChipRothIraValue] = useState((payConfig.rothIraMonthly ?? 0).toString());

  useEffect(() => {
    if ((parseFloat(chipTradValue) || 0) !== (payConfig.traditional401k ?? 0))
      setChipTradValue((payConfig.traditional401k ?? 0).toString());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payConfig.traditional401k]);
  useEffect(() => {
    if ((parseFloat(chipHsaValue) || 0) !== (payConfig.hsaMonthly ?? 0))
      setChipHsaValue((payConfig.hsaMonthly ?? 0).toString());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payConfig.hsaMonthly]);
  useEffect(() => {
    if ((parseFloat(chipRothIraValue) || 0) !== (payConfig.rothIraMonthly ?? 0))
      setChipRothIraValue((payConfig.rothIraMonthly ?? 0).toString());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payConfig.rothIraMonthly]);

  function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    dispatch({
      type: 'SET_PAY_CONFIG',
      config: {
        ...payConfig,
        hourlyRate: parseFloat(rateInput) || 0,
        hoursPerDay: parseFloat(hoursInput) || 0,
        payDay: parseInt(payDayInput) || undefined,
        filingStatus: filingInput,
        fixedMonthlyGross: parseFloat(fixedGrossInput) || undefined,
        fixedGrossFromPayMonth: parseInt(fixedFromMonthInput) || undefined,
        firstPayMonth: parseInt(firstPayMonthInput) > 1 ? parseInt(firstPayMonthInput) : undefined,
        annualRaisePct: parseFloat(annualRaisePctInput) || undefined,
        raiseStartYear: parseInt(raiseStartYearInput) || undefined,
        employeeContrib401kPct: parseFloat(employeeContrib401kPctInput) || undefined,
        employerMatchPct: parseFloat(employerMatchPctInput) || undefined,
        biweeklyStartDate: biweeklyStartDateInput || undefined,
        biweeklyNetAmount: parseFloat(biweeklyNetAmountInput) || undefined,
        ficaStartDate: ficaStartDateInput || undefined,
        traditional401k: parseFloat(trad401kInput) || 0,
        roth401k: parseFloat(roth401kInput) || 0,
        hsaMonthly: parseFloat(hsaInput) || 0,
        rothIraMonthly: parseFloat(rothIraInput) || 0,
      },
    });
    setShowConfig(false);
  }

  // Input on pay-month row edits the underlying work-month's OOO (prior month).
  function updateOOO(payMonth: number, value: number) {
    const { year: wy, month: wm } = workMonthFor(year, payMonth);
    const key = `${wy}-${String(wm).padStart(2, '0')}`;
    const oooByMonth = { ...(payConfig.oooByMonth ?? {}), [key]: Math.max(0, value) };
    dispatch({ type: 'SET_PAY_CONFIG', config: { ...payConfig, oooByMonth } });
  }

  function getOOO(payMonth: number): number {
    const { year: wy, month: wm } = workMonthFor(year, payMonth);
    const key = `${wy}-${String(wm).padStart(2, '0')}`;
    return payConfig.oooByMonth?.[key] ?? 0;
  }

  const plannedHsa = getPlannedMonthlyContribution(state, 'HSA', year);
  const contributionOverrides = {
    hsaMonthly: !(payConfig.hsaMonthly > 0) && plannedHsa > 0 ? plannedHsa : undefined,
  };
  const lastMonthlyPayMonth = year < lastMonthlyPayYear ? 12
    : year === lastMonthlyPayYear ? lastMonthlyPayMonthSetting
    : 0;

  const firstMonthlyPayMonth = payConfig.firstPayMonth ?? 1;

  const allBreakdowns = Array.from({ length: 12 }, (_, i) =>
    calculateMonthlyPaycheck(payConfig, year, i + 1, holidays, contributionOverrides)
  );
  const breakdowns = allBreakdowns.slice(firstMonthlyPayMonth - 1, lastMonthlyPayMonth);

  const totalHours = breakdowns.reduce((s, b) => s + b.hours, 0);
  const totalGross = breakdowns.reduce((s, b) => s + b.grossPay, 0);
  const totalTrad = breakdowns.reduce((s, b) => s + b.traditional401k, 0);
  const totalRoth = breakdowns.reduce((s, b) => s + b.roth401k, 0);
  const totalHSA = breakdowns.reduce((s, b) => s + b.hsaContribution, 0);
  const totalRothIRA = breakdowns.reduce((s, b) => s + b.rothIraContribution, 0);
  const totalTax = breakdowns.reduce((s, b) => s + b.federalTaxWithheld, 0);
  const totalFica = breakdowns.reduce((s, b) => s + b.ficaWithheld, 0);
  const totalNet = breakdowns.reduce((s, b) => s + b.netPay, 0);

  const taxSummary = calculateAnnualTaxSummary(state, year);

  // Auto per-check 401k and HSA: (limit − contributed) ÷ biweekly checks from contrib start month.
  // annual401k/annualHsa are the true full-year totals, including any lump sum already
  // logged (e.g. maxed out early, outside payroll) — perCheck can be 0 while annual > 0.
  const {
    perCheck401k: auto401kPerCheck,
    perCheckHsa: autoHsaPerCheck,
    numChecks: numChecksWithin401k,
    annual401k: autoAnnual401k,
    annualHsa: autoAnnualHsa,
  } = useMemo(
    () => getBiweeklyContribAmounts(state, year),
    [state, year],
  );

  const hasTrad401k = (payConfig.traditional401k ?? 0) > 0 || auto401kPerCheck > 0 || autoAnnual401k > 0;
  const hasRoth401k = (payConfig.roth401k ?? 0) > 0 && !payConfig.biweeklyStartDate;
  const hasHSA = (payConfig.hsaMonthly ?? 0) > 0 || plannedHsa > 0 || autoHsaPerCheck > 0 || autoAnnualHsa > 0;
  const hasRothIRA = (payConfig.rothIraMonthly ?? 0) > 0;

  // For the biweekly card, pass the FICA start month so the per-check breakdown reflects FICA
  // once it applies. When FICA starts mid-year, show the post-FICA check (more informative).
  const ficaStartParts = payConfig.ficaStartDate ? payConfig.ficaStartDate.split('-').map(Number) : null;
  const biweeklyFicaMonth = ficaStartParts && ficaStartParts[0] <= year ? ficaStartParts[1] : undefined;
  // Use the current month (for active year) or July (for future years) to pick the right effective rate.
  const currentMonth = new Date().getMonth() + 1;
  const biweeklyDisplayMonth = year === new Date().getFullYear() ? currentMonth : 7;
  const biweeklyEffectiveRate = getEffectiveHourlyRate(payConfig, year, biweeklyDisplayMonth);
  const biweeklyBD = payConfig.biweeklyStartDate
    ? calculateBiweeklyBreakdown(
        { ...payConfig, hourlyRate: biweeklyEffectiveRate },
        { ...contributionOverrides, traditional401kPerCheck: auto401kPerCheck, hsaPerCheck: autoHsaPerCheck },
        biweeklyFicaMonth,
        year,
      )
    : null;
  const hasFica = totalFica > 0 || (biweeklyBD?.ficaWithheld ?? 0) > 0;

  function updateField(patch: Partial<typeof payConfig>) {
    dispatch({ type: 'SET_PAY_CONFIG', config: { ...payConfig, ...patch } });
  }

  const taxSavingsFromHSA = (() => {
    const taxWithoutHsaDeduction = calculateAnnualFederalTax(
      taxSummary.taxableIncomeActual + taxSummary.annualHSA,
      payConfig.filingStatus,
    );
    return Math.min(Math.max(0, taxWithoutHsaDeduction - taxSummary.taxOwedActual), 1924.56);
  })();

  // Yearly projection — computed independently from annual values, not scaled from per-check.
  const yearlyTrad401k      = autoAnnual401k;
  const yearlyGross         = biweeklyBD ? biweeklyBD.grossPay * 26 : 0;
  const yearlyHSA           = autoAnnualHsa;
  const yearlyRothIRA       = (payConfig.rothIraMonthly ?? 0) * 12;
  const yearlyRoth401k      = biweeklyBD ? biweeklyBD.roth401k * numChecksWithin401k : 0;
  const yearlyTaxable       = Math.max(0, yearlyGross - yearlyTrad401k - yearlyHSA - getStandardDeduction(year));
  const yearlyFederalTax    = calculateAnnualFederalTax(yearlyTaxable, payConfig.filingStatus);
  const yearlyFica          = biweeklyBD ? biweeklyBD.ficaWithheld * numChecksWithin401k : 0;
  const yearlyNetPay        = yearlyGross - yearlyTrad401k - yearlyRoth401k - yearlyHSA - yearlyRothIRA - yearlyFederalTax - yearlyFica;
  const yearlyEmployerMatch  = year < contrib401kStartYear ? 0 : ((payConfig.employerMatchPct ?? defaultEmployerMatchPct) / 100) * yearlyGross;
  const yearlyTotalEarnings = yearlyNetPay + yearlyTrad401k + yearlyRoth401k + yearlyHSA + yearlyRothIRA + yearlyEmployerMatch;

  const chipLabelClass = 'flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-gray-950/60 px-2.5 py-1 text-xs';
  const thClass = 'px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-[0.06em] text-gray-500';
  const tdClass = 'px-3 py-2.5 text-right text-sm tabular-nums';

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-[0.08em] text-gray-500">Pay Breakdown</h2>
          <p className="mt-0.5 text-[11px] text-gray-600">Row = paycheck month. Values reflect prior month&apos;s work.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={chipLabelClass}>
            <span className="font-medium text-gray-300">Trad 401k</span>
            <span className="text-sm tabular-nums text-gray-200">{formatCurrency(auto401kPerCheck)}/check</span>
            <span className="text-[10px] text-gray-600">from</span>
            <select
              value={payConfig.contrib401kFromMonth ?? 1}
              onChange={e => updateField({ contrib401kFromMonth: parseInt(e.target.value) })}
              className="rounded border border-white/[0.08] bg-gray-950/60 px-1 py-0.5 text-xs text-gray-300 focus:border-white/20 focus:outline-none"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i} value={i + 1}>{name.slice(0, 3)}</option>
              ))}
            </select>
          </div>
          <div className={chipLabelClass}>
            <span className="font-medium text-gray-300">HSA</span>
            <span className="text-sm tabular-nums text-gray-200">{formatCurrency(autoHsaPerCheck)}/check</span>
            <span className="text-[10px] text-gray-600">
              {taxSavingsFromHSA > 0 ? `refunds ${formatCurrency(taxSavingsFromHSA)}/yr` : 'deductible'}
            </span>
          </div>
          <label className={chipLabelClass}>
            <span className="font-medium text-gray-300">Roth IRA</span>
            <span className="text-gray-500">$</span>
            <input
              type="number"
              min="0"
              step="1"
              value={chipRothIraValue}
              onChange={e => { setChipRothIraValue(e.target.value); updateField({ rothIraMonthly: parseFloat(e.target.value) || 0 }); }}
              onBlur={e => updateField({ rothIraMonthly: parseFloat(e.target.value) || 0 })}
              className={chipInputClass}
            />
            <span className="text-[10px] text-gray-600">tax-free later</span>
          </label>
          {yearlyAutoInvest > 0 && (
            <div className={chipLabelClass}>
              <span className="font-medium text-gray-300">Auto-Invest</span>
              <span className="text-sm tabular-nums text-gray-200">{formatCurrency(yearlyAutoInvest)}/yr</span>
              <span className="text-[10px] text-gray-600">brokerage</span>
            </div>
          )}
          <button
            onClick={() => setShowHolidays(true)}
            className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-gray-100"
          >
            Holidays ({holidays.filter(h => new Date(h.date + 'T00:00:00').getFullYear() === year).length})
          </button>
          <button
            onClick={() => {
              setRateInput(payConfig.hourlyRate.toString());
              setHoursInput(payConfig.hoursPerDay.toString());
              setPayDayInput((payConfig.payDay ?? '').toString());
              setFilingInput(payConfig.filingStatus);
              setFixedGrossInput((payConfig.fixedMonthlyGross ?? '').toString());
              setFixedFromMonthInput((payConfig.fixedGrossFromPayMonth ?? '').toString());
              setFirstPayMonthInput((payConfig.firstPayMonth ?? 1).toString());
              setAnnualRaisePctInput((payConfig.annualRaisePct ?? '').toString());
              setRaiseStartYearInput((payConfig.raiseStartYear ?? '').toString());
              setEmployeeContrib401kPctInput((payConfig.employeeContrib401kPct ?? defaultEmployee401kPct).toString());
              setEmployerMatchPctInput((payConfig.employerMatchPct ?? defaultEmployerMatchPct).toString());
              setBiweeklyStartDateInput(payConfig.biweeklyStartDate ?? '');
              setBiweeklyNetAmountInput((payConfig.biweeklyNetAmount ?? '').toString());
              setFicaStartDateInput(payConfig.ficaStartDate ?? '');
              setShowConfig(true);
            }}
            className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-gray-100"
          >
            {payConfig.biweeklyStartDate && payConfig.biweeklyNetAmount
              ? `Biweekly from ${payConfig.biweeklyStartDate} · ${formatCurrency(payConfig.biweeklyNetAmount)}/check`
              : payConfig.fixedMonthlyGross && payConfig.fixedGrossFromPayMonth
              ? `${MONTH_NAMES[payConfig.fixedGrossFromPayMonth - 1]}+: ${formatCurrency(payConfig.fixedMonthlyGross)}/mo · ${payConfig.hourlyRate}/hr before`
              : `$${payConfig.hourlyRate}/hr · ${payConfig.hoursPerDay}hr/day`}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gray-900/40">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-gray-500">Month</th>
                <th className={thClass}>Wkdays</th>
                <th className={thClass} title="Weekdays − holidays − OOO">Worked</th>
                <th className={thClass}>Hours</th>
                <th className={thClass}>Gross</th>
                {hasTrad401k && <th className={thClass}>Trad 401k</th>}
                {hasHSA && <th className={thClass}>HSA</th>}
                {hasRoth401k && <th className={thClass}>Roth 401k</th>}
                {hasRothIRA && <th className={thClass}>Roth IRA</th>}
                <th className={thClass}>Fed Tax</th>
                {hasFica && <th className={thClass} title="Social Security + Medicare">FICA</th>}
                <th className={thClass}>Net Pay</th>
                <th className={thClass} title="Net Pay + Trad 401k + Roth 401k + HSA + Roth IRA + Employer Match">Total Earnings</th>
              </tr>
            </thead>
            <tbody>
              {breakdowns.map((b, i) => {
                const payMonth = firstMonthlyPayMonth + i;
                const isCurrentMonth = payMonth === new Date().getMonth() + 1 && year === new Date().getFullYear();
                return (
                  <tr
                    key={payMonth}
                    className={`border-b border-white/[0.04] transition-colors ${isCurrentMonth ? 'bg-white/[0.025]' : 'hover:bg-white/[0.02]'}`}
                  >
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-200">
                      {MONTH_NAMES[payMonth - 1]}
                      <span className="ml-1.5 text-[10px] font-normal text-gray-600">
                        ({MONTH_NAMES[workMonthFor(year, payMonth).month - 1].slice(0, 3)} work)
                      </span>
                    </td>
                    <td className={`${tdClass} text-gray-500`}>{b.weekdays}</td>
                    <td className={tdClass}>
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-gray-400">{b.workedDays}</span>
                        {b.holidays > 0 && (
                          <span className="text-[10px] text-gray-600" title={`${b.holidays} holiday(s)`}>−{b.holidays}h</span>
                        )}
                        <input
                          type="number"
                          min="0"
                          max={b.weekdays}
                          value={getOOO(payMonth)}
                          onChange={e => updateOOO(payMonth, parseInt(e.target.value) || 0)}
                          className="w-9 rounded border border-white/[0.08] bg-gray-950/60 px-1 py-0.5 text-right text-xs tabular-nums text-gray-300 focus:border-white/20 focus:outline-none"
                          title="OOO days"
                        />
                      </div>
                    </td>
                    <td className={`${tdClass} text-gray-400`}>{b.hours}</td>
                    <td className={`${tdClass} text-gray-300`}>{formatCurrency(b.grossPay)}</td>
                    {hasTrad401k && (
                      <td className={`${tdClass} text-gray-400`}>
                        {b.traditional401k > 0 ? `−${formatCurrency(b.traditional401k)}` : '—'}
                      </td>
                    )}
                    {hasHSA && (
                      <td className={`${tdClass} text-gray-400`}>
                        {b.hsaContribution > 0 ? `−${formatCurrency(b.hsaContribution)}` : '—'}
                      </td>
                    )}
                    {hasRoth401k && (
                      <td className={`${tdClass} text-gray-400`}>
                        {b.roth401k > 0 ? `−${formatCurrency(b.roth401k)}` : '—'}
                      </td>
                    )}
                    {hasRothIRA && (
                      <td className={`${tdClass} text-gray-400`}>
                        {b.rothIraContribution > 0 ? `−${formatCurrency(b.rothIraContribution)}` : '—'}
                      </td>
                    )}
                    <td className={`${tdClass} text-red-400`}>−{formatCurrency(b.federalTaxWithheld)}</td>
                    {hasFica && (
                      <td className={`${tdClass} text-red-400`}>
                        {b.ficaWithheld > 0 ? `−${formatCurrency(b.ficaWithheld)}` : '—'}
                      </td>
                    )}
                    <td className={`${tdClass} font-semibold text-gray-50`}>{formatCurrency(b.netPay)}</td>
                    <td className={`${tdClass} font-semibold text-emerald-400`}>
                      {formatCurrency(b.netPay + b.traditional401k + b.roth401k + b.hsaContribution + b.rothIraContribution)}
                    </td>
                  </tr>
                );
              })}
              {breakdowns.length > 0 && (
                <tr className="border-t border-white/[0.08] bg-white/[0.025]">
                  <td className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Total</td>
                  <td className={`${tdClass} text-gray-500`}>
                    {breakdowns.reduce((s, b) => s + b.weekdays, 0)}
                  </td>
                  <td className={`${tdClass} text-gray-400`}>
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{breakdowns.reduce((s, b) => s + b.workedDays, 0)}</span>
                      <span className="text-[10px] text-gray-600" title="Total holidays + OOO">
                        −{breakdowns.reduce((s, b) => s + b.holidays + b.ooo, 0)}
                      </span>
                    </div>
                  </td>
                  <td className={`${tdClass} text-gray-300`}>{totalHours}</td>
                  <td className={`${tdClass} text-gray-200`}>{formatCurrency(totalGross)}</td>
                  {hasTrad401k && <td className={`${tdClass} text-gray-300`}>−{formatCurrency(totalTrad)}</td>}
                  {hasHSA && <td className={`${tdClass} text-gray-300`}>−{formatCurrency(totalHSA)}</td>}
                  {hasRoth401k && <td className={`${tdClass} text-gray-300`}>−{formatCurrency(totalRoth)}</td>}
                  {hasRothIRA && <td className={`${tdClass} text-gray-300`}>−{formatCurrency(totalRothIRA)}</td>}
                  <td className={`${tdClass} text-red-400`}>−{formatCurrency(totalTax)}</td>
                  {hasFica && <td className={`${tdClass} text-red-400`}>−{formatCurrency(totalFica)}</td>}
                  <td className={`${tdClass} font-semibold text-gray-50`}>{formatCurrency(totalNet)}</td>
                  <td
                    className={`${tdClass} font-semibold text-emerald-400`}
                    title={`Net + Trad 401k + Roth 401k + HSA + Roth IRA + ${taxSummary.refund >= 0 ? 'refund' : 'tax owed'} (${formatCurrency(taxSummary.refund)})`}
                  >
                    {formatCurrency(totalNet + totalTrad + totalRoth + totalHSA + totalRothIRA + taxSummary.refund)}
                  </td>
                </tr>
              )}
              {biweeklyBD && (
                <>
                  <tr className="border-t-2 border-blue-500/20 bg-blue-500/5">
                    <td className="px-4 py-3 text-sm font-medium text-blue-300">
                      Biweekly Check
                      <div className="text-[10px] font-normal text-blue-400/60">
                        per paycheck · from {payConfig.biweeklyStartDate}
                      </div>
                    </td>
                    <td className={`${tdClass} text-gray-600`}>—</td>
                    <td className={`${tdClass} text-[10px] text-blue-400/60`}>Full-time</td>
                    <td className={`${tdClass} text-gray-400`}>{biweeklyBD.hours}</td>
                    <td className={`${tdClass} text-gray-300`}>{formatCurrency(biweeklyBD.grossPay)}</td>
                    {hasTrad401k && <td className={`${tdClass} text-gray-400`}>−{formatCurrency(biweeklyBD.traditional401k)}</td>}
                    {hasHSA && <td className={`${tdClass} text-gray-400`}>−{formatCurrency(biweeklyBD.hsaContribution)}</td>}
                    {hasRoth401k && <td className={`${tdClass} text-gray-400`}>−{formatCurrency(biweeklyBD.roth401k)}</td>}
                    {hasRothIRA && <td className={`${tdClass} text-gray-400`}>−{formatCurrency(biweeklyBD.rothIraContribution)}</td>}
                    <td className={`${tdClass} text-red-400`}>−{formatCurrency(biweeklyBD.federalTaxWithheld)}</td>
                    {hasFica && (
                      <td className={`${tdClass} text-red-400`}>
                        {biweeklyBD.ficaWithheld > 0 ? `−${formatCurrency(biweeklyBD.ficaWithheld)}` : '—'}
                      </td>
                    )}
                    <td className={`${tdClass} font-semibold text-gray-50`}>{formatCurrency(biweeklyBD.netPay)}</td>
                    <td className={`${tdClass} font-semibold text-emerald-400`}>
                      {formatCurrency(biweeklyBD.netPay + biweeklyBD.traditional401k + biweeklyBD.roth401k + biweeklyBD.hsaContribution + biweeklyBD.rothIraContribution)}
                    </td>
                  </tr>
                  <tr className="border-t border-blue-500/10 bg-blue-500/[0.03]">
                    <td className="px-4 py-3 text-sm font-medium text-blue-200/80">
                      Yearly Projection
                      <div className="text-[10px] font-normal text-blue-400/50">
                        {numChecksWithin401k} paychecks · {year}
                      </div>
                    </td>
                    <td className={`${tdClass} text-gray-600`}>—</td>
                    <td className={`${tdClass} text-[10px] text-blue-400/50`}>Full-time</td>
                    <td className={`${tdClass} text-gray-400`}>{biweeklyBD.hours * numChecksWithin401k}</td>
                    <td className={`${tdClass} text-gray-300`}>{formatCurrency(yearlyGross)}</td>
                    {hasTrad401k && <td className={`${tdClass} text-gray-400`}>−{formatCurrency(yearlyTrad401k)}</td>}
                    {hasHSA && <td className={`${tdClass} text-gray-400`}>−{formatCurrency(yearlyHSA)}</td>}
                    {hasRoth401k && <td className={`${tdClass} text-gray-400`}>−{formatCurrency(yearlyRoth401k)}</td>}
                    {hasRothIRA && <td className={`${tdClass} text-gray-400`}>−{formatCurrency(yearlyRothIRA)}</td>}
                    <td className={`${tdClass} text-red-400`}>−{formatCurrency(yearlyFederalTax)}</td>
                    {hasFica && (
                      <td className={`${tdClass} text-red-400`}>
                        {yearlyFica > 0 ? `−${formatCurrency(yearlyFica)}` : '—'}
                      </td>
                    )}
                    <td className={`${tdClass} font-semibold text-gray-50`}>{formatCurrency(yearlyNetPay)}</td>
                    <td className={`${tdClass} font-semibold text-emerald-400`}>{formatCurrency(yearlyTotalEarnings)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showConfig} onClose={() => setShowConfig(false)} title="Pay Configuration">
        <form onSubmit={saveConfig} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Hourly Rate ($)</label>
              <input
                type="number"
                step="0.01"
                value={rateInput}
                onChange={e => setRateInput(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Hours / Day</label>
              <input
                type="number"
                step="0.5"
                value={hoursInput}
                onChange={e => setHoursInput(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Pay Day (day of month)</label>
            <input
              type="number"
              min="1"
              max="31"
              value={payDayInput}
              onChange={e => setPayDayInput(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Filing Status</label>
            <select
              value={filingInput}
              onChange={e => setFilingInput(e.target.value as 'single' | 'married')}
              className={inputClass}
            >
              <option value="single">Single</option>
              <option value="married">Married Filing Jointly</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>First Pay Month</label>
            <select
              value={firstPayMonthInput}
              onChange={e => setFirstPayMonthInput(e.target.value)}
              className={inputClass}
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-gray-600">First month shown in the monthly pay table. Set to May if employment started in May.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Annual Raise %</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={annualRaisePctInput}
                onChange={e => setAnnualRaisePctInput(e.target.value)}
                placeholder="e.g. 3"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Raise Start Year</label>
              <input
                type="number"
                step="1"
                value={raiseStartYearInput}
                onChange={e => setRaiseStartYearInput(e.target.value)}
                placeholder="e.g. 2027"
                className={inputClass}
              />
              <p className="mt-1 text-[10px] text-gray-600">Raise applies every July from this year on.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Employee 401k %</label>
              <input
                type="number" step="0.5" min="0" max="100"
                value={employeeContrib401kPctInput}
                onChange={e => setEmployeeContrib401kPctInput(e.target.value)}
                placeholder="e.g. 6"
                className={inputClass}
              />
              <p className="mt-1 text-[10px] text-gray-600">% of gross per paycheck. Overrides the fixed dollar amount in projection.</p>
            </div>
            <div>
              <label className={labelClass}>Employer Match %</label>
              <input
                type="number" step="0.5" min="0" max="100"
                value={employerMatchPctInput}
                onChange={e => setEmployerMatchPctInput(e.target.value)}
                placeholder="e.g. 3"
                className={inputClass}
              />
              <p className="mt-1 text-[10px] text-gray-600">Free money added to 401k on top of your contribution.</p>
            </div>
          </div>
          <div className="space-y-3 rounded-lg border border-white/[0.06] bg-gray-950/40 p-4">
            <h4 className="text-xs font-medium uppercase tracking-[0.08em] text-gray-400">Salary Override · Fixed Monthly Gross</h4>
            <p className="text-[10px] text-gray-600">When set, replaces the hourly calculation for the selected months.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Fixed Monthly Gross ($)</label>
                <input
                  type="number"
                  step="1"
                  value={fixedGrossInput}
                  onChange={e => setFixedGrossInput(e.target.value)}
                  placeholder="e.g. 5833"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Starting Pay Month</label>
                <select
                  value={fixedFromMonthInput}
                  onChange={e => setFixedFromMonthInput(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— hourly only —</option>
                  {MONTH_NAMES.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>First Biweekly Paycheck Date</label>
              <input
                type="date"
                value={biweeklyStartDateInput}
                onChange={e => setBiweeklyStartDateInput(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-[10px] text-gray-600">
                Repeats every 14 days. Net is auto-calculated from your hourly rate. Leave blank for monthly.
              </p>
            </div>
            <div>
              <label className={labelClass}>Fixed Take-Home Per Check ($)</label>
              <input
                type="number"
                step="0.01"
                value={biweeklyNetAmountInput}
                onChange={e => setBiweeklyNetAmountInput(e.target.value)}
                placeholder="Leave blank to auto-calculate"
                className={inputClass}
              />
              <p className="mt-1 text-[10px] text-gray-600">
                When set, this overrides all contribution calculations in the calendar. <strong className="text-amber-400">Clear this to let Roth IRA / 401k / HSA changes affect your paycheck.</strong>
              </p>
            </div>
            <div>
              <label className={labelClass}>FICA Start Date (SS + Medicare)</label>
              <input
                type="date"
                value={ficaStartDateInput}
                onChange={e => setFicaStartDateInput(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-[10px] text-gray-600">
                Social Security (6.2%) + Medicare (1.45%) withheld from paychecks on or after this date. Leave blank if exempt.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowConfig(false)} className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-gray-200">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-100">
              Save
            </button>
          </div>
        </form>
      </Modal>

      <HolidaysModal open={showHolidays} onClose={() => setShowHolidays(false)} year={year} />
    </section>
  );
}

function HolidaysModal({ open, onClose, year }: { open: boolean; onClose: () => void; year: number }) {
  const { state, dispatch } = useFinance();
  const holidays = state.holidays ?? [];
  const [name, setName] = useState('');
  const [date, setDate] = useState('');

  const yearHolidays = holidays
    .filter(h => new Date(h.date + 'T00:00:00').getFullYear() === year)
    .sort((a, b) => a.date.localeCompare(b.date));

  function addHoliday(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !name.trim()) return;
    dispatch({
      type: 'ADD_HOLIDAY',
      holiday: { id: crypto.randomUUID(), date, name: name.trim() },
    });
    setName('');
    setDate('');
  }

  function adpDefaults(): { date: string; name: string }[] {
    const toISO = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const observed = (m: number, d: number): string => {
      const date = new Date(year, m, d);
      const dow = date.getDay();
      if (dow === 6) return toISO(new Date(year, m, d - 1));
      if (dow === 0) return toISO(new Date(year, m, d + 1));
      return toISO(date);
    };
    const nth = (m: number, weekday: number, n: number): string => {
      if (n === -1) {
        const last = new Date(year, m, 0);
        const diff = (last.getDay() - weekday + 7) % 7;
        return toISO(new Date(year, m - 1, last.getDate() - diff));
      }
      const first = new Date(year, m - 1, 1);
      const diff = (weekday - first.getDay() + 7) % 7;
      return toISO(new Date(year, m - 1, 1 + diff + (n - 1) * 7));
    };
    return [
      { date: observed(0, 1), name: "New Year's Day" },
      { date: nth(1, 1, 3), name: 'MLK Jr. Day' },
      { date: nth(2, 1, 3), name: "Presidents' Day" },
      { date: nth(5, 1, -1), name: 'Memorial Day' },
      { date: observed(6, 4), name: 'Independence Day' },
      { date: nth(9, 1, 1), name: 'Labor Day' },
      { date: observed(10, 11), name: 'Veterans Day' },
      { date: nth(11, 4, 4), name: 'Thanksgiving' },
    ];
  }

  function seedADP() {
    const existing = new Set(yearHolidays.map(h => h.date));
    const toAdd = adpDefaults().filter(h => !existing.has(h.date));
    dispatch({
      type: 'SET_HOLIDAYS',
      holidays: [...holidays, ...toAdd.map(h => ({ id: crypto.randomUUID(), ...h }))],
    });
  }

  function resetToADP() {
    if (yearHolidays.length > 0 && !confirm(`Replace all ${year} holidays with ADP defaults?`)) return;
    const otherYears = holidays.filter(h => new Date(h.date + 'T00:00:00').getFullYear() !== year);
    const fresh = adpDefaults().map(h => ({ id: crypto.randomUUID(), ...h }));
    dispatch({ type: 'SET_HOLIDAYS', holidays: [...otherYears, ...fresh] });
  }

  function clearYear() {
    if (yearHolidays.length === 0) return;
    if (!confirm(`Remove all ${yearHolidays.length} holidays for ${year}?`)) return;
    const otherYears = holidays.filter(h => new Date(h.date + 'T00:00:00').getFullYear() !== year);
    dispatch({ type: 'SET_HOLIDAYS', holidays: otherYears });
  }

  return (
    <Modal open={open} onClose={onClose} title={`Holidays · ${year}`}>
      <div className="space-y-4">
        <form onSubmit={addHoliday} className="flex gap-2">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="rounded-lg border border-white/[0.08] bg-gray-950/60 px-3 py-2 text-sm text-gray-100 focus:border-white/20 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Name (e.g. Memorial Day)"
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 rounded-lg border border-white/[0.08] bg-gray-950/60 px-3 py-2 text-sm text-gray-100 focus:border-white/20 focus:outline-none"
          />
          <button type="submit" className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-950 hover:bg-gray-100">
            Add
          </button>
        </form>

        <div className="flex gap-2">
          <button
            onClick={seedADP}
            className="flex-1 rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-medium text-gray-300 hover:bg-white/5"
          >
            Seed ADP (add missing)
          </button>
          <button
            onClick={resetToADP}
            className="flex-1 rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-medium text-gray-300 hover:bg-white/5"
          >
            Reset to ADP
          </button>
          <button
            onClick={clearYear}
            disabled={yearHolidays.length === 0}
            className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:text-gray-600 disabled:hover:bg-transparent"
          >
            Clear year
          </button>
        </div>

        <div className="max-h-64 space-y-1 overflow-y-auto">
          {yearHolidays.length === 0 ? (
            <p className="text-sm text-gray-500">No holidays for {year}. Add manually or seed ADP defaults.</p>
          ) : (
            yearHolidays.map(h => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-gray-950/40 px-3 py-2">
                <div>
                  <div className="text-sm text-gray-100">{h.name}</div>
                  <div className="text-xs text-gray-500">{h.date}</div>
                </div>
                <button
                  onClick={() => dispatch({ type: 'DELETE_HOLIDAY', id: h.id })}
                  className="text-xs text-gray-500 hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
