'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchIBKRPortfolio, type IBKRPortfolio } from '@/lib/finances/ibkrApi';
import { useFinance } from '@/lib/FinanceProvider';
import SummaryCard from '@/components/finances/common/SummaryCard';
import type { RothSnapshot, RothHolding } from '@/lib/finances-types';

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function pnlColor(n: number | null | undefined): 'green' | 'red' | 'blue' {
  if (n == null) return 'blue';
  return n >= 0 ? 'green' : 'red';
}

const thClass = 'px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500';

function portfolioToSnapshot(data: IBKRPortfolio): RothSnapshot {
  // Consolidate positions by symbol: the same ticker can be held across
  // multiple IBKR accounts, and the holdings table renders one row per symbol
  // (keyed by symbol). Merge value/cost/quantity so each symbol appears once.
  const bySymbol = new Map<string, RothHolding>();
  for (const acct of Object.values(data.accounts)) {
    for (const p of acct.positions) {
      const symbol = p.contractDesc ?? '—';
      const qty    = p.position ?? 0;
      const price  = p.mktPrice ?? 0;
      const value  = p.mktValue ?? qty * price;
      const cost   = (p.avgCost ?? price) * qty;
      const gl     = p.unrealizedPnl ?? (value - cost);

      const existing = bySymbol.get(symbol);
      if (existing) {
        existing.quantity     += qty;
        existing.currentValue += value;
        existing.costBasis    += cost;
        existing.gainLoss     += gl;
        // Weighted average price across the merged lots.
        existing.lastPrice     = existing.quantity > 0 ? existing.currentValue / existing.quantity : price;
        existing.gainLossPercent = existing.costBasis > 0 ? (existing.gainLoss / existing.costBasis) * 100 : 0;
      } else {
        bySymbol.set(symbol, {
          symbol,
          description:     p.assetClass ?? '',
          quantity:        qty,
          lastPrice:       price,
          currentValue:    value,
          costBasis:       cost,
          gainLoss:        gl,
          gainLossPercent: cost > 0 ? (gl / cost) * 100 : 0,
        });
      }
    }
  }
  const holdings = [...bySymbol.values()];

  const totalValue     = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalCostBasis = holdings.reduce((s, h) => s + h.costBasis,    0);

  return {
    id:           crypto.randomUUID(),
    accountType:  'Brokerage',
    importedAt:   new Date().toISOString(),
    holdings,
    totalValue,
    totalCostBasis,
    totalGainLoss: totalValue - totalCostBasis,
  };
}

export default function IBKRSection() {
  const { dispatch } = useFinance();
  const [portfolio, setPortfolio] = useState<IBKRPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const sync = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIBKRPortfolio();
      setPortfolio(data);
      setLastSynced(new Date());
      dispatch({ type: 'ADD_ROTH_SNAPSHOT', snapshot: portfolioToSnapshot(data) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => { sync(); }, [sync]);

  const accountEntries = portfolio ? Object.entries(portfolio.accounts) : [];
  const allPositions = accountEntries
    .flatMap(([, data]) => data.positions)
    .sort((a, b) => (b.mktValue ?? 0) - (a.mktValue ?? 0));

  const totalNAV = accountEntries.reduce((s, [, d]) => s + (d.summary.netliquidation?.amount ?? 0), 0);
  const totalBuyingPower = accountEntries.reduce((s, [, d]) => s + (d.summary.buyingpower?.amount ?? 0), 0);
  const totalUnrealizedPnl = Object.values(portfolio?.pnl ?? {}).reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0);
  const totalDailyPnl = Object.values(portfolio?.pnl ?? {}).reduce((s, p) => s + (p.dailyPnl ?? 0), 0);
  const totalPositionsValue = allPositions.reduce((s, p) => s + (p.mktValue ?? 0), 0);

  const gatewayDown =
    error != null &&
    (error.includes('503') ||
      error.includes('not authenticated') ||
      error.includes('gateway') ||
      error.includes('fetch'));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-[0.08em] text-gray-500">
            Interactive Brokers · Live
          </h2>
          {lastSynced && (
            <p className="mt-0.5 text-xs text-gray-600">
              Updated {lastSynced.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={sync}
          disabled={loading}
          className="rounded-lg border border-white/[0.08] px-3.5 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-gray-100 disabled:opacity-50"
        >
          {loading ? 'Syncing…' : 'Sync'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          {gatewayDown
            ? 'IBKR gateway not connected. Start the gateway and log in at http://localhost:5055, then click Sync.'
            : error}
        </div>
      )}

      {portfolio && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard title="Net Liquidation" value={fmt(totalNAV)} color="blue" />
            <SummaryCard title="Buying Power" value={fmt(totalBuyingPower)} color="purple" />
            <SummaryCard
              title="Unrealized P&L"
              value={fmt(totalUnrealizedPnl)}
              color={pnlColor(totalUnrealizedPnl)}
            />
            <SummaryCard
              title="Daily P&L"
              value={fmt(totalDailyPnl)}
              color={pnlColor(totalDailyPnl)}
            />
          </div>

          {allPositions.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-gray-900/40">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left">
                    <th className={thClass}>Ticker</th>
                    <th className={thClass}>Class</th>
                    <th className={`${thClass} text-right`}>Shares</th>
                    <th className={`${thClass} text-right`}>Price</th>
                    <th className={`${thClass} text-right`}>Value</th>
                    <th className={`${thClass} text-right`}>Avg Cost</th>
                    <th className={`${thClass} text-right`}>Unrealized P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {allPositions.map((p, i) => (
                    <tr
                      key={`${p.conid ?? i}`}
                      className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3 font-medium text-gray-100">{p.contractDesc ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{p.assetClass ?? ''}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-300">
                        {p.position?.toLocaleString() ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-300">{fmt(p.mktPrice)}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-100">
                        {fmt(p.mktValue)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-400">{fmt(p.avgCost)}</td>
                      <td
                        className={`px-4 py-3 text-right font-medium tabular-nums ${
                          (p.unrealizedPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {fmt(p.unrealizedPnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/[0.08] bg-white/[0.025] font-semibold text-gray-100">
                    <td
                      className="px-4 py-3 text-[11px] uppercase tracking-[0.08em] text-gray-400"
                      colSpan={4}
                    >
                      Total
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(totalPositionsValue)}</td>
                    <td />
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${
                        totalUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {fmt(totalUnrealizedPnl)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/[0.08] p-8 text-center">
              <p className="text-sm text-gray-500">No open positions in your IBKR account.</p>
            </div>
          )}
        </>
      )}

      {!portfolio && !loading && !error && (
        <div className="rounded-2xl border border-dashed border-white/[0.08] p-8 text-center">
          <p className="text-sm text-gray-500">Click Sync to load live positions from Interactive Brokers.</p>
        </div>
      )}
    </div>
  );
}
