import { useFinance } from '@/lib/FinanceProvider';
import { formatCurrency } from '@/lib/finances/formatters';
import { getStandardDeduction, splitAnnualFica } from '@/lib/finances/tax';
import { calculateAnnualTaxSummary } from '@/lib/finances/calculations';

export default function TaxSummary() {
  const { state } = useFinance();
  const { payConfig, activeYear: year } = state;

  const taxSummary = calculateAnnualTaxSummary(state, year);
  const hasTrad401k = taxSummary.annual401kTraditional > 0;
  const hasHSA = taxSummary.annualHSA > 0;
  const hasFica = taxSummary.annualFica > 0;

  // Derive SS/Medicare split proportionally from the partial-year FICA total.
  const ficaFullYear = splitAnnualFica(taxSummary.annualGross, year);
  const ficaFullTotal = ficaFullYear.socialSecurity + ficaFullYear.medicare;
  const ficaScale = ficaFullTotal > 0 ? taxSummary.annualFica / ficaFullTotal : 0;
  const displaySS = ficaFullYear.socialSecurity * ficaScale;
  const displayMedicare = ficaFullYear.medicare * ficaScale;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-gray-900/40 p-6">
      <h3 className="mb-4 text-sm font-medium uppercase tracking-[0.08em] text-gray-500">{year} Tax Summary</h3>
      <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
        <div className="text-gray-500">Gross Income</div>
        <div className="text-right font-medium tabular-nums text-gray-100">{formatCurrency(taxSummary.annualGross)}</div>

        {hasTrad401k && <>
          <div className="text-gray-500">Pre-tax 401k</div>
          <div className="text-right tabular-nums text-gray-400">−{formatCurrency(taxSummary.annual401kTraditional)}</div>
        </>}

        {hasHSA && <>
          <div className="text-gray-500">HSA Deduction</div>
          <div className="text-right tabular-nums text-gray-400">−{formatCurrency(taxSummary.annualHSA)}</div>
        </>}

        <div className="text-gray-500">Standard Deduction</div>
        <div className="text-right tabular-nums text-gray-400">−{formatCurrency(getStandardDeduction(year))}</div>

        <div className="border-t border-white/[0.06] pt-2.5 font-medium text-gray-300">Taxable Income</div>
        <div className="border-t border-white/[0.06] pt-2.5 text-right font-medium tabular-nums text-gray-100">{formatCurrency(taxSummary.taxableIncomeActual)}</div>

        {hasFica && <>
          <div className="text-gray-500">Social Security (6.2%)</div>
          <div className="text-right tabular-nums text-red-400">−{formatCurrency(displaySS)}</div>

          <div className="text-gray-500">Medicare (1.45%)</div>
          <div className="text-right tabular-nums text-red-400">−{formatCurrency(displayMedicare)}</div>
        </>}

        <div className="text-gray-500">Tax Actually Owed</div>
        <div className="text-right tabular-nums text-red-400">{formatCurrency(taxSummary.taxOwedActual)}</div>

        <div className="text-gray-500">Tax Withheld from Paychecks</div>
        <div className="text-right tabular-nums text-red-400">{formatCurrency(taxSummary.totalWithheld)}</div>

        <div className="border-t border-white/[0.06] pt-2.5 font-semibold text-gray-100">
          {taxSummary.refund >= 0 ? 'Expected Refund' : 'Tax Owed'}
        </div>
        <div className={`border-t border-white/[0.06] pt-2.5 text-right font-semibold tabular-nums ${taxSummary.refund >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {formatCurrency(Math.abs(taxSummary.refund))}
        </div>

        <div className="mt-2 border-t border-white/[0.06] pt-2.5 text-gray-500">Total Invested</div>
        <div className="mt-2 border-t border-white/[0.06] pt-2.5 text-right font-medium tabular-nums text-gray-100">{formatCurrency(taxSummary.totalInvested)}</div>
      </div>
      <p className="mt-4 text-xs text-gray-600">
        {payConfig.ficaStartDate
          ? `FICA applies from ${payConfig.ficaStartDate}. `
          : 'No FICA taxes. '}
        HSA deduction claimed on return, not withheld.
      </p>
    </div>
  );
}
