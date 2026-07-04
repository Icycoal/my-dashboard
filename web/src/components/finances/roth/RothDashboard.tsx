import { useState, useRef } from 'react';
import { useFinance } from '@/lib/FinanceProvider';
import { parseFidelityCSV } from '@/lib/finances/fidelityCSV';
import { fetchQuotes } from '@/lib/finances/api';
import { getLifetimeContributionsTotal } from '@/lib/finances/contributions';
import SummaryCard from '@/components/finances/common/SummaryCard';
import Modal from '@/components/finances/common/Modal';
import ContributionTracker from './ContributionTracker';
import IBKRSection from './IBKRSection';
import type { RothSnapshot, RothHolding, AccountType } from '@/lib/finances-types';
import type { FinanceAction } from '@/lib/finances-types';

const cellClass = 'rounded border border-white/[0.08] bg-gray-950/60 px-2 py-1 text-sm text-gray-100 focus:border-white/20 focus:outline-none w-full';

function ManualEntryModal({
  open, onClose, accountType, dispatch,
}: {
  open: boolean; onClose: () => void; accountType: AccountType; dispatch: React.Dispatch<FinanceAction>;
}) {
  type Row = { symbol: string; description: string; shares: string; value: string };
  const blank = (): Row => ({ symbol: '', description: '', shares: '', value: '' });
  const [rows, setRows] = useState<Row[]>([blank()]);

  function update(i: number, field: keyof Row, val: string) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  }

  function save() {
    const holdings: RothHolding[] = rows
      .filter(r => r.symbol.trim() && parseFloat(r.value) > 0)
      .map(r => {
        const value = parseFloat(r.value) || 0;
        const qty   = parseFloat(r.shares) || 0;
        const price = qty > 0 ? value / qty : 0;
        return {
          symbol: r.symbol.trim().toUpperCase(),
          description: r.description.trim(),
          quantity: qty,
          lastPrice: price,
          currentValue: value,
          costBasis: value,
          gainLoss: 0,
          gainLossPercent: 0,
        };
      });
    if (!holdings.length) return;
    const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);
    const snapshot: RothSnapshot = {
      id: crypto.randomUUID(),
      accountType,
      importedAt: new Date().toISOString(),
      holdings,
      totalValue,
      totalCostBasis: totalValue,
      totalGainLoss: 0,
    };
    dispatch({ type: 'ADD_ROTH_SNAPSHOT', snapshot });
    setRows([blank()]);
    onClose();
  }

  const total = rows.reduce((s, r) => s + (parseFloat(r.value) || 0), 0);

  return (
    <Modal open={open} onClose={onClose} title={`Manual Entry → ${accountType}`}>
      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_1.5fr_1fr_1fr_auto] gap-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
          <span>Symbol</span><span>Description</span><span>Shares</span><span>Value ($)</span><span />
        </div>
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_1.5fr_1fr_1fr_auto] gap-2 items-center">
            <input placeholder="VIGAX"  value={row.symbol}      onChange={e => update(i, 'symbol', e.target.value)}      className={cellClass} />
            <input placeholder="Fund name" value={row.description} onChange={e => update(i, 'description', e.target.value)} className={cellClass} />
            <input placeholder="8.901"  type="number" step="any" value={row.shares} onChange={e => update(i, 'shares', e.target.value)} className={cellClass} />
            <input placeholder="2363.30" type="number" step="0.01" value={row.value}  onChange={e => update(i, 'value', e.target.value)}  className={cellClass} />
            <button onClick={() => setRows(r => r.filter((_, idx) => idx !== i))} className="text-gray-600 hover:text-red-400 text-lg leading-none">×</button>
          </div>
        ))}
        <button onClick={() => setRows(r => [...r, blank()])} className="text-xs text-gray-500 hover:text-gray-300">+ Add row</button>
        <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
          <span className="text-sm font-semibold text-gray-200">Total: ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-gray-200">Cancel</button>
            <button onClick={save} className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-950 hover:bg-gray-100">Save</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const ACCOUNT_TYPES: AccountType[] = ['Roth IRA', '401k', 'Brokerage', 'HSA'];

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

const SKIP_SYMBOLS = new Set(['SPAXX', 'SPAXX**', 'FCASH', 'FDRXX', 'FZFXX', 'PENDING ACTIVITY']);

function CostBasisCell({
  snapshotId,
  symbol,
  value,
  dispatch,
}: {
  snapshotId: string;
  symbol: string;
  value: number;
  dispatch: React.Dispatch<FinanceAction>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value.toString());

  function commit() {
    const next = parseFloat(draft.replace(/[$,]/g, ''));
    if (!isNaN(next) && next !== value) {
      dispatch({ type: 'UPDATE_HOLDING_COST_BASIS', snapshotId, symbol, costBasis: next });
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <td className="px-4 py-3 text-right">
        <input
          autoFocus
          type="number"
          step="0.01"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setDraft(value.toString()); setEditing(false); }
          }}
          className="w-28 rounded-md border border-white/[0.08] bg-gray-950/60 px-2 py-1 text-right text-sm tabular-nums text-gray-100 focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/5"
        />
      </td>
    );
  }

  return (
    <td
      onClick={() => { setDraft(value.toString()); setEditing(true); }}
      title="Click to edit"
      className="cursor-pointer px-4 py-3 text-right tabular-nums text-gray-400 transition-colors hover:bg-white/[0.04] hover:text-gray-100"
    >
      {fmt(value)}
    </td>
  );
}

function HoldingsTable({
  snapshot,
  dispatch,
  contributionBasis,
}: {
  snapshot: RothSnapshot;
  dispatch: React.Dispatch<FinanceAction>;
  contributionBasis: number | null;
}) {
  const sorted = [...snapshot.holdings].sort((a, b) => b.currentValue - a.currentValue);
  const thClass = 'px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500';
  const displayBasis = contributionBasis ?? snapshot.totalCostBasis;
  const displayGainLoss = snapshot.totalValue - displayBasis;

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-gray-900/40">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-left">
            <th className={thClass}>Symbol</th>
            <th className={thClass}>Description</th>
            <th className={`${thClass} text-right`}>Shares</th>
            <th className={`${thClass} text-right`}>Price</th>
            <th className={`${thClass} text-right`}>Value</th>
            <th className={`${thClass} text-right`}>Cost Basis</th>
            <th className={`${thClass} text-right`}>Gain/Loss</th>
            <th className={`${thClass} text-right`}>%</th>
            <th className={`${thClass} text-right`}>Allocation</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(h => (
            <tr key={h.symbol} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
              <td className="px-4 py-3 font-medium text-gray-100">{h.symbol}</td>
              <td className="max-w-[200px] truncate px-4 py-3 text-gray-500">{h.description}</td>
              <td className="px-4 py-3 text-right tabular-nums text-gray-300">{h.quantity.toLocaleString()}</td>
              <td className="px-4 py-3 text-right tabular-nums text-gray-300">{fmt(h.lastPrice)}</td>
              <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-100">{fmt(h.currentValue)}</td>
              <CostBasisCell
                snapshotId={snapshot.id}
                symbol={h.symbol}
                value={h.costBasis}
                dispatch={dispatch}
              />
              <td className={`px-4 py-3 text-right font-medium tabular-nums ${h.gainLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmt(h.gainLoss)}
              </td>
              <td className={`px-4 py-3 text-right tabular-nums ${h.gainLossPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {h.gainLossPercent >= 0 ? '+' : ''}{h.gainLossPercent.toFixed(1)}%
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                {((h.currentValue / snapshot.totalValue) * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-white/[0.08] bg-white/[0.025] font-semibold text-gray-100">
            <td className="px-4 py-3 text-[11px] uppercase tracking-[0.08em] text-gray-400" colSpan={4}>Total</td>
            <td className="px-4 py-3 text-right tabular-nums">{fmt(snapshot.totalValue)}</td>
            <td className="px-4 py-3 text-right tabular-nums">
              {fmt(displayBasis)}
              {contributionBasis != null && (
                <div className="text-[10px] font-normal uppercase tracking-[0.06em] text-gray-600">from contributions</div>
              )}
            </td>
            <td className={`px-4 py-3 text-right tabular-nums ${displayGainLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmt(displayGainLoss)}
            </td>
            <td className={`px-4 py-3 text-right tabular-nums ${displayGainLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {displayBasis ? `${((displayGainLoss / displayBasis) * 100).toFixed(1)}%` : '—'}
            </td>
            <td className="px-4 py-3 text-right tabular-nums">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function RothDashboard() {
  const { state, dispatch } = useFinance();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [filterAccount, setFilterAccount] = useState<AccountType | 'All'>('All');
  const [showManual, setShowManual] = useState(false);

  const allSnapshots = state.rothSnapshots ?? [];

  // Latest snapshot per account type
  const latestPerType = new Map<AccountType, RothSnapshot>();
  for (const snap of allSnapshots) {
    const key = (snap.accountType ?? 'Roth IRA') as AccountType;
    const existing = latestPerType.get(key);
    if (!existing || snap.importedAt > existing.importedAt) latestPerType.set(key, snap);
  }

  const isAll = filterAccount === 'All';
  const latest = isAll ? null : (latestPerType.get(filterAccount as AccountType) ?? null);

  // Aggregate for "All Accounts" view
  const allLatest = Array.from(latestPerType.values());
  const aggValue     = allLatest.reduce((s, v) => s + v.totalValue, 0);
  const aggCostBasis = allLatest.reduce((s, snap) => {
    const type = (snap.accountType ?? 'Roth IRA') as AccountType;
    const contribs = getLifetimeContributionsTotal(state, type);
    return s + (contribs > 0 ? contribs : snap.totalCostBasis);
  }, 0);
  const aggGainLoss  = aggValue - aggCostBasis;
  const aggHoldings  = allLatest.flatMap(snap =>
    snap.holdings.map(h => ({ ...h, _account: snap.accountType ?? 'Roth IRA' }))
  ).sort((a, b) => b.currentValue - a.currentValue);

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (filterAccount === 'All') {
      setError('Pick a specific account in the dropdown before importing.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const snapshot = parseFidelityCSV(reader.result as string);
        snapshot.accountType = filterAccount;
        dispatch({ type: 'ADD_ROTH_SNAPSHOT', snapshot });
        setSelectedIdx(0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse CSV');
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleRefresh() {
    const targets = isAll ? allLatest : (latest ? [latest] : []);
    if (!targets.length || refreshing) return;
    setRefreshing(true);
    setError('');
    try {
      const symbols = [...new Set(
        targets.flatMap(s => s.holdings.map(h => h.symbol))
          .filter(s => !SKIP_SYMBOLS.has(s.replace(/\*+$/, '').toUpperCase()))
      )];
      const quotes = await fetchQuotes(symbols);
      for (const snap of targets) {
        dispatch({ type: 'UPDATE_ROTH_PRICES', snapshotId: snap.id, quotes });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh prices');
    } finally {
      setRefreshing(false);
    }
  }

  const accountSnaps = isAll ? [] : allSnapshots.filter(s => (s.accountType ?? 'Roth IRA') === filterAccount);
  const prev = accountSnaps[1] ?? null;
  const valueChange = latest && prev ? latest.totalValue - prev.totalValue : null;

  const latestAccountType: AccountType = latest?.accountType ?? 'Roth IRA';
  const lifetimeContributions = latest
    ? getLifetimeContributionsTotal(state, latestAccountType)
    : 0;
  const contributionBasis = lifetimeContributions > 0 ? lifetimeContributions : null;
  const displayBasis = contributionBasis ?? (latest?.totalCostBasis ?? 0);
  const displayGainLoss = latest ? latest.totalValue - displayBasis : 0;

  const selectClass = 'rounded-lg border border-white/[0.08] bg-gray-900/60 px-3 py-2 text-sm text-gray-200 transition-colors focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/5';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-50">Investments</h1>
          <p className="mt-1 text-sm text-gray-500">Fidelity positions · import via CSV export.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterAccount}
            onChange={e => { setFilterAccount(e.target.value as AccountType | 'All'); setSelectedIdx(0); }}
            className={selectClass}
          >
            <option value="All">All Accounts {allLatest.length > 0 ? `· ${fmt(aggValue)}` : ''}</option>
            {ACCOUNT_TYPES.map(t => {
              const snap = latestPerType.get(t);
              return (
                <option key={t} value={t}>
                  {t}{snap ? ` · ${new Date(snap.importedAt).toLocaleDateString()} · ${fmt(snap.totalValue)}` : ''}
                </option>
              );
            })}
          </select>
          {(latest || (isAll && allLatest.length > 0)) && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-lg border border-white/[0.08] px-3.5 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-gray-100 disabled:opacity-50"
            >
              {refreshing ? 'Refreshing…' : 'Refresh Prices'}
            </button>
          )}
          <button
            disabled={filterAccount === 'All'}
            onClick={() => setShowManual(true)}
            className={`rounded-lg border border-white/[0.08] px-3.5 py-2 text-sm font-medium transition-colors ${
              filterAccount === 'All'
                ? 'cursor-not-allowed text-gray-600'
                : 'text-gray-300 hover:bg-white/5 hover:text-gray-100'
            }`}
            title={filterAccount === 'All' ? 'Pick a specific account first' : `Enter manually into ${filterAccount}`}
          >
            Manual Entry
          </button>
          <label
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              filterAccount === 'All'
                ? 'cursor-not-allowed bg-white/[0.04] text-gray-600'
                : 'cursor-pointer bg-white text-gray-950 hover:bg-gray-100'
            }`}
            title={filterAccount === 'All' ? 'Pick a specific account first' : `Import into ${filterAccount}`}
          >
            {filterAccount === 'All' ? 'Import CSV' : `Import → ${filterAccount}`}
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              disabled={filterAccount === 'All'}
              onChange={handleImport}
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {isAll ? (
        allLatest.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.08] p-12 text-center">
            <p className="text-sm font-medium text-gray-300">No snapshots yet</p>
            <p className="mt-1 text-sm text-gray-600">Select an account type and use Manual Entry or Import CSV.</p>
          </div>
        ) : (
          <>
            <ContributionTracker />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCard title="Total Portfolio" value={fmt(aggValue)} color="blue" />
              <SummaryCard title="Cost Basis" value={fmt(aggCostBasis)} color="purple" />
              <SummaryCard
                title="Total Gain/Loss"
                value={fmt(aggGainLoss)}
                subtitle={aggCostBasis ? `${((aggGainLoss / aggCostBasis) * 100).toFixed(1)}%` : undefined}
                color={aggGainLoss >= 0 ? 'green' : 'red'}
              />
              <div className="rounded-2xl border border-white/[0.06] bg-gray-900/40 p-4 space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-gray-500">Snapshots</p>
                {allLatest.map(s => (
                  <div key={s.id} className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">{s.accountType ?? 'Roth IRA'} <span className="text-xs text-gray-600">· {new Date(s.importedAt).toLocaleDateString()}</span></span>
                    <button
                      onClick={() => dispatch({ type: 'DELETE_ROTH_SNAPSHOT', id: s.id })}
                      className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gray-900/40">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {['Account', 'Symbol', 'Description', 'Qty', 'Price', 'Value', 'Gain/Loss'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-[0.06em] text-gray-500 first:text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aggHoldings.map((h, i) => (
                      <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                        <td className="px-4 py-2.5 text-xs text-gray-500">{h._account}</td>
                        <td className="px-4 py-2.5 font-mono text-sm font-medium text-gray-100">{h.symbol}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-400">{h.description}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">{h.quantity.toFixed(3)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">{fmt(h.lastPrice)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-200">{fmt(h.currentValue)}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums ${h.gainLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(h.gainLoss)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/[0.08] bg-white/[0.025]">
                      <td colSpan={5} className="px-4 py-2.5 text-xs font-medium uppercase text-gray-500">Total</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-100">{fmt(aggValue)}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${aggGainLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(aggGainLoss)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )
      ) : !latest ? (
        <>
          {filterAccount === 'Brokerage' && (
            <div className="rounded-2xl border border-white/[0.06] bg-gray-900/40 p-6">
              <IBKRSection />
            </div>
          )}
          <div className="rounded-2xl border border-dashed border-white/[0.08] p-12 text-center">
            <p className="text-sm font-medium text-gray-300">No snapshot for {filterAccount}</p>
            <p className="mt-1 text-sm text-gray-600">Use Manual Entry or Import CSV above.</p>
          </div>
        </>
      ) : (
        <>
          {filterAccount === 'Brokerage' && (
            <div className="rounded-2xl border border-white/[0.06] bg-gray-900/40 p-6">
              <IBKRSection />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard title="Portfolio Value" value={fmt(latest.totalValue)} color="blue" />
            <SummaryCard
              title="Cost Basis"
              value={fmt(displayBasis)}
              subtitle={contributionBasis != null ? 'from contributions' : undefined}
              color="purple"
            />
            <SummaryCard
              title="Total Gain/Loss"
              value={fmt(displayGainLoss)}
              subtitle={displayBasis ? `${((displayGainLoss / displayBasis) * 100).toFixed(1)}%` : undefined}
              color={displayGainLoss >= 0 ? 'green' : 'red'}
            />
            <SummaryCard
              title="Since Last Import"
              value={valueChange !== null ? fmt(valueChange) : '—'}
              subtitle={valueChange !== null && prev ? `vs ${new Date(prev.importedAt).toLocaleDateString()}` : 'Only one snapshot'}
              color={valueChange === null ? 'blue' : valueChange >= 0 ? 'green' : 'red'}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-gray-500">
              {latest.accountType ?? 'Roth IRA'} · {latest.holdings.length} positions · imported {new Date(latest.importedAt).toLocaleString()}
              {latest.lastRefreshedAt && <> · refreshed {new Date(latest.lastRefreshedAt).toLocaleString()}</>}
            </p>
            <button
              onClick={() => { dispatch({ type: 'DELETE_ROTH_SNAPSHOT', id: latest.id }); setSelectedIdx(0); }}
              className="text-xs text-gray-600 transition-colors hover:text-red-400"
            >
              Delete snapshot
            </button>
          </div>

          <HoldingsTable snapshot={latest} dispatch={dispatch} contributionBasis={contributionBasis} />
        </>
      )}

      <ManualEntryModal
        open={showManual}
        onClose={() => setShowManual(false)}
        accountType={filterAccount === 'All' ? 'Roth IRA' : filterAccount}
        dispatch={dispatch}
      />
    </div>
  );
}
