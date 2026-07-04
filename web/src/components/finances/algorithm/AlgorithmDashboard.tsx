import { useState, useMemo } from 'react';
import { useFinance } from '@/lib/FinanceProvider';
import { useAlgorithmFetch } from '@/hooks/useAlgorithmFetch';
import { runAlgorithm } from '@/lib/finances/algorithmEngine';
import { clientAlgorithmConfig } from '@/lib/clientSettings';
import type { StockScore } from '@/lib/finances-types';

function SummaryCards({
  stockCount,
  topPick,
  rothTotal,
  managersLoaded,
}: {
  stockCount: number;
  topPick: string;
  rothTotal: number;
  managersLoaded: number;
}) {
  const cards = [
    { label: 'Stocks Analyzed', value: stockCount.toLocaleString() },
    { label: 'Top Pick', value: topPick },
    { label: 'Roth Value', value: `$${rothTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
    { label: 'Managers Loaded', value: `${managersLoaded}/10` },
  ];
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map(c => (
        <div key={c.label} className="rounded-2xl border border-white/[0.06] bg-gray-900/60 px-5 py-4 transition-colors hover:border-white/10">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">{c.label}</div>
          <div className="mt-2 text-xl font-semibold tracking-tight tabular-nums text-gray-50">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function ExpandedRow({ score }: { score: StockScore }) {
  return (
    <tr>
      <td colSpan={11} className="bg-white/[0.02] px-6 py-4">
        <div className="text-sm">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">Held by</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {score.holders.map(h => (
              <div key={h.name} className="flex items-center gap-2 text-xs text-gray-400">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                  h.tier === 1 ? 'bg-gray-100' : h.tier === 2 ? 'bg-gray-400' : 'bg-gray-600'
                }`} />
                <span className="font-medium text-gray-200">{h.name}</span>
                <span className="text-gray-700">·</span>
                <span className="tabular-nums">{h.pctOfPortfolio.toFixed(1)}%</span>
                <span className="text-gray-700">·</span>
                <span className={
                  h.momentum === 'New' || h.momentum.startsWith('+')
                    ? 'text-emerald-400'
                    : h.momentum.startsWith('-')
                      ? 'text-red-400'
                      : 'text-gray-500'
                }>{h.momentum}</span>
              </div>
            ))}
          </div>
        </div>
      </td>
    </tr>
  );
}

function ResultsTable({ scores }: { scores: StockScore[] }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const recommended = scores.filter(s => s.targetPct > 0);
  const overweight = scores.filter(s => s.targetPct === 0 && s.currentPct > 0);

  const thClass = 'px-3 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500';

  const renderRow = (s: StockScore, idx: number, globalIdx: number) => {
    const isExpanded = expandedIdx === globalIdx;
    const actionColor =
      s.action === 'Buy' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
        : s.action === 'Sell' ? 'text-red-400 bg-red-500/10 border border-red-500/20'
          : 'text-gray-400 bg-white/[0.04] border border-white/[0.06]';

    return (
      <>
        <tr
          key={`row-${globalIdx}`}
          onClick={() => setExpandedIdx(isExpanded ? null : globalIdx)}
          className="cursor-pointer border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
        >
          <td className="px-3 py-2.5 text-xs tabular-nums text-gray-600">{idx + 1}</td>
          <td className="px-3 py-2.5">
            <div className="text-sm">
              {s.symbol ? <span className="mr-2 font-mono font-medium text-gray-100">{s.symbol}</span> : null}
              <span className="text-gray-500">{s.issuer}</span>
            </div>
          </td>
          <td className="px-3 py-2.5 text-sm font-semibold tabular-nums text-gray-50">{s.composite.toFixed(1)}</td>
          <td className="px-3 py-2.5 text-sm tabular-nums text-gray-400">{s.quality.toFixed(1)}</td>
          <td className="px-3 py-2.5 text-sm tabular-nums text-gray-400">{s.consensus.toFixed(1)}</td>
          <td className="px-3 py-2.5 text-sm tabular-nums text-gray-400">{s.conviction.toFixed(1)}</td>
          <td className="px-3 py-2.5 text-sm tabular-nums text-gray-400">{s.momentum.toFixed(1)}</td>
          <td className="px-3 py-2.5 text-sm font-medium tabular-nums text-gray-100">{s.targetPct.toFixed(1)}%</td>
          <td className="px-3 py-2.5 text-sm tabular-nums text-gray-400">{s.currentPct > 0 ? `${s.currentPct.toFixed(1)}%` : '—'}</td>
          <td className={`px-3 py-2.5 text-sm font-medium tabular-nums ${s.overUnder > 0 ? 'text-emerald-400' : s.overUnder < 0 ? 'text-red-400' : 'text-gray-600'}`}>
            {s.overUnder > 0 ? '+' : ''}{s.overUnder.toFixed(1)}%
          </td>
          <td className="px-3 py-2.5">
            <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${actionColor}`}>
              {s.action}
            </span>
          </td>
        </tr>
        {isExpanded && <ExpandedRow key={`exp-${globalIdx}`} score={s} />}
      </>
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gray-900/40">
      <table className="w-full">
        <thead className="border-b border-white/[0.06]">
          <tr>
            <th className={thClass}>#</th>
            <th className={thClass}>Stock</th>
            <th className={thClass}>Score</th>
            <th className={thClass}>Quality</th>
            <th className={thClass}>Consensus</th>
            <th className={thClass}>Conviction</th>
            <th className={thClass}>Momentum</th>
            <th className={thClass}>Target %</th>
            <th className={thClass}>Current %</th>
            <th className={thClass}>Over/Under</th>
            <th className={thClass}>Action</th>
          </tr>
        </thead>
        <tbody>
          {recommended.map((s, i) => renderRow(s, i, i))}
          {overweight.length > 0 && (
            <tr>
              <td colSpan={11} className="border-t border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">
                Current Holdings — Not in Top {recommended.length}
              </td>
            </tr>
          )}
          {overweight.map((s, i) => renderRow(s, i, recommended.length + i))}
        </tbody>
      </table>
    </div>
  );
}

export default function AlgorithmDashboard() {
  const { state, dispatch } = useFinance();
  const { fetchAll, fetching, progress, error } = useAlgorithmFetch();

  const cache = state.algorithmCache;
  const result = state.algorithmResult;

  const cacheAge = useMemo(() => {
    if (!cache) return null;
    const days = (Date.now() - new Date(cache.fetchedAt).getTime()) / (1000 * 60 * 60 * 24);
    return Math.round(days * 10) / 10;
  }, [cache]);

  const isStale = cacheAge !== null && cacheAge > clientAlgorithmConfig().cacheMaxAgeDays;

  const latestRoth = state.rothSnapshots[0];

  const handleRun = async (useCache: boolean) => {
    let c = cache;
    if (!useCache || !c) {
      const fetched = await fetchAll();
      if (!fetched) return;
      c = fetched;
    }
    if (!c) return;

    const holdings = latestRoth?.holdings || [];
    const rothTotal = latestRoth?.totalValue || 0;
    const algoResult = runAlgorithm(c, holdings, rothTotal);
    dispatch({ type: 'SET_ALGORITHM_RESULT', result: algoResult });
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-50">Stock-Picking Algorithm</h2>
          <p className="mt-1 text-sm text-gray-500">
            Composite scoring from the 10 top institutional managers' 13F filings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cache && !isStale && (
            <button
              onClick={() => handleRun(true)}
              disabled={fetching}
              className="rounded-lg border border-white/[0.08] px-3.5 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-gray-100 disabled:opacity-50"
            >
              Use Cached Data
            </button>
          )}
          <button
            onClick={() => handleRun(false)}
            disabled={fetching}
            className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            {cache ? 'Refresh from SEC' : 'Run Algorithm'}
          </button>
          {result && (
            <button
              onClick={() => dispatch({ type: 'CLEAR_ALGORITHM_DATA' })}
              className="rounded-lg border border-red-500/20 px-3.5 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {cacheAge !== null && (
        <div className="mb-4 rounded-lg border border-white/[0.06] bg-gray-900/60 px-4 py-2.5 text-xs text-gray-400">
          Cache is <span className="tabular-nums text-gray-200">{cacheAge} days</span> old · {cache!.managers.length} managers loaded.
          {isStale && <span className="text-amber-400"> · data may be outdated</span>}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{error}</div>
      )}

      {fetching && progress && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="uppercase tracking-[0.08em] text-gray-500">{progress.label}</span>
            <span className="tabular-nums text-gray-500">{progress.current}/{progress.total}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gray-200 transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {!latestRoth && !fetching && (
        <div className="mb-4 rounded-lg border border-white/[0.06] bg-gray-900/60 px-4 py-2.5 text-xs text-gray-400">
          No Roth IRA snapshot. Import one on the Investments page for portfolio comparison.
        </div>
      )}

      {result && (
        <>
          <SummaryCards
            stockCount={result.scores.filter(s => s.composite > 0).length}
            topPick={result.scores[0]?.symbol || result.scores[0]?.issuer || '—'}
            rothTotal={result.rothTotal}
            managersLoaded={cache?.managers.length || 0}
          />
          <ResultsTable scores={result.scores} />
          <div className="mt-3 text-xs text-gray-600">
            Last run · {new Date(result.ranAt).toLocaleString()}
          </div>
        </>
      )}
    </div>
  );
}
