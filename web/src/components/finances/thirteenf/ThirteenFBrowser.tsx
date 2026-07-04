import { useState } from 'react';
import { searchFunds, fetchFilings, fetchHoldings } from '@/lib/finances/api';
import { useFinance } from '@/lib/FinanceProvider';
import SummaryCard from '@/components/finances/common/SummaryCard';
import type { ThirteenFManager, ThirteenFFiling, ThirteenFHolding } from '@/lib/finances-types';

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

type View = 'search' | 'filings' | 'holdings';

const thClass = 'px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500';

export default function ThirteenFBrowser() {
  const { state } = useFinance();
  const [view, setView] = useState<View>('search');
  const [query, setQuery] = useState('');
  const [managers, setManagers] = useState<ThirteenFManager[]>([]);
  const [selectedManager, setSelectedManager] = useState<ThirteenFManager | null>(null);
  const [filings, setFilings] = useState<ThirteenFFiling[]>([]);
  const [selectedFiling, setSelectedFiling] = useState<ThirteenFFiling | null>(null);
  const [holdings, setHoldings] = useState<ThirteenFHolding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOverlap, setShowOverlap] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const results = await searchFunds(query);
      setManagers(results);
      if (results.length === 0) setError('No managers found for that query.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectManager(manager: ThirteenFManager) {
    setSelectedManager(manager);
    setLoading(true);
    setError('');
    try {
      const f = await fetchFilings(manager.cik);
      setFilings(f);
      setView('filings');
      if (f.length === 0) setError('No 13F filings found for this manager.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load filings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectFiling(filing: ThirteenFFiling) {
    if (!selectedManager) return;
    setSelectedFiling(filing);
    setLoading(true);
    setError('');
    try {
      const h = await fetchHoldings(selectedManager.cik, filing.accession);
      setHoldings(h);
      setView('holdings');
      if (h.length === 0) setError('No holdings found in this filing.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load holdings');
    } finally {
      setLoading(false);
    }
  }

  function goBack() {
    if (view === 'holdings') { setView('filings'); setHoldings([]); }
    else if (view === 'filings') { setView('search'); setFilings([]); setSelectedManager(null); }
  }

  const rothSnapshot = (state.rothSnapshots ?? [])[0] ?? null;
  const rothSymbols = new Set(
    rothSnapshot?.holdings.map(h => h.symbol.toUpperCase()) ?? [],
  );

  const totalValue = holdings.reduce((s, h) => s + h.valueUsd, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-50">13F Filings</h2>
          <p className="mt-1 text-sm text-gray-500">Browse institutional holdings from SEC filings.</p>
        </div>
        {view !== 'search' && (
          <button onClick={goBack} className="rounded-lg border border-white/[0.08] px-3.5 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-gray-100">
            ← Back
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {view === 'search' && (
        <>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search fund manager (e.g. Berkshire Hathaway)"
              className="flex-1 rounded-lg border border-white/[0.08] bg-gray-950/60 px-3.5 py-2 text-sm text-gray-100 placeholder:text-gray-600 transition-colors focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/5"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="rounded-lg bg-white px-5 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
          </form>

          {managers.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {managers.map(m => (
                <button
                  key={m.cik}
                  onClick={() => handleSelectManager(m)}
                  className="rounded-2xl border border-white/[0.06] bg-gray-900/60 p-5 text-left transition-colors hover:border-white/10 hover:bg-gray-900/80"
                >
                  <p className="text-sm font-medium text-gray-100">{m.name}</p>
                  <p className="mt-1 text-xs text-gray-500">CIK · {m.cik}</p>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {view === 'filings' && selectedManager && (
        <>
          <div className="rounded-2xl border border-white/[0.06] bg-gray-900/60 p-5">
            <p className="text-sm font-semibold text-gray-100">{selectedManager.name}</p>
            <p className="mt-1 text-xs text-gray-500">CIK · {selectedManager.cik}</p>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Loading filings…</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-gray-900/40">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left">
                    <th className={thClass}>Filing Date</th>
                    <th className={thClass}>Period of Report</th>
                    <th className={thClass}>Accession</th>
                    <th className={thClass}></th>
                  </tr>
                </thead>
                <tbody>
                  {filings.map(f => (
                    <tr key={f.accession} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-gray-100 tabular-nums">{f.filingDate}</td>
                      <td className="px-4 py-3 text-gray-300 tabular-nums">{f.periodOfReport}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{f.accession}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleSelectFiling(f)}
                          className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-gray-100"
                        >
                          View Holdings →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {view === 'holdings' && selectedManager && selectedFiling && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard title="Total Value" value={fmt(totalValue)} color="blue" />
            <SummaryCard title="Positions" value={String(holdings.length)} color="purple" />
            <SummaryCard title="Filing Date" value={selectedFiling.filingDate} color="green" />
            <SummaryCard title="Period" value={selectedFiling.periodOfReport} color="amber" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-200">{selectedManager.name}</span> · {holdings.length} positions
            </p>
            {rothSnapshot && (
              <button
                onClick={() => setShowOverlap(!showOverlap)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  showOverlap
                    ? 'bg-white text-gray-950'
                    : 'border border-white/[0.08] text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                {showOverlap ? 'Showing overlap' : 'Compare with my portfolio'}
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Loading holdings…</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-gray-900/40">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left">
                    <th className={thClass}>Issuer</th>
                    <th className={thClass}>Class</th>
                    <th className={thClass}>CUSIP</th>
                    <th className={`${thClass} text-right`}>Value</th>
                    <th className={`${thClass} text-right`}>Shares</th>
                    <th className={`${thClass} text-right`}>% of Portfolio</th>
                    {showOverlap && <th className={`${thClass} text-center`}>In My Portfolio</th>}
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h, i) => {
                    const issuerUpper = h.issuer.toUpperCase();
                    const isOverlap = showOverlap && (
                      rothSymbols.has(h.cusip) ||
                      [...rothSymbols].some(sym => issuerUpper.includes(sym) || sym.includes(issuerUpper.slice(0, 4)))
                    );
                    return (
                      <tr
                        key={`${h.cusip}-${i}`}
                        className={`border-b border-white/[0.04] transition-colors ${isOverlap ? 'bg-white/[0.05]' : 'hover:bg-white/[0.02]'}`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-100">{h.issuer}</td>
                        <td className="px-4 py-3 text-gray-500">{h.titleOfClass}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{h.cusip}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-100">{fmt(h.valueUsd)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-300">{h.shares.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-300">{h.pctOfPortfolio.toFixed(2)}%</td>
                        {showOverlap && (
                          <td className="px-4 py-3 text-center">
                            {isOverlap ? <span className="font-medium text-emerald-400">Yes</span> : <span className="text-gray-700">—</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
