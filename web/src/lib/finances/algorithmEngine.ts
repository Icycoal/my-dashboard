import type {
  AlgorithmCache,
  AlgorithmResult,
  RothHolding,
  StockScore,
  ThirteenFHolding,
} from '@/lib/finances-types';
import { clientAlgorithmConfig } from '@/lib/clientSettings';

interface StockEntry {
  issuer: string;
  cusip: string;
  holders: {
    cik: string;
    name: string;
    tierWeight: number;
    tier: number;
    pctOfPortfolio: number;
    // For momentum: shares in latest filing, shares in previous filing (null = not held)
    sharesLatest: number | null;
    sharesPrevious: number | null;
  }[];
}

/**
 * Build a map of every stock held by any curated manager, with per-manager details.
 */
export function buildStockMap(cache: AlgorithmCache): Map<string, StockEntry> {
  const stocks = new Map<string, StockEntry>();
  const curatedManagers = clientAlgorithmConfig().curatedManagers;

  for (const mgr of cache.managers) {
    const config = curatedManagers.find(m => m.cik === mgr.cik);
    if (!config) continue;

    // Sort filings by period descending to get latest first
    const sortedFilings = [...mgr.filings].sort(
      (a, b) => b.periodOfReport.localeCompare(a.periodOfReport)
    );

    const latestAccession = sortedFilings[0]?.accession;
    const previousAccession = sortedFilings[1]?.accession;

    const latestHoldings = latestAccession ? (mgr.holdings[latestAccession] || []) : [];
    const previousHoldings = previousAccession ? (mgr.holdings[previousAccession] || []) : [];

    // Index previous holdings by cusip for quick lookup
    const prevByCusip = new Map<string, ThirteenFHolding>();
    for (const h of previousHoldings) {
      prevByCusip.set(h.cusip, h);
    }

    for (const h of latestHoldings) {
      const key = h.cusip;
      let entry = stocks.get(key);
      if (!entry) {
        entry = { issuer: h.issuer, cusip: h.cusip, holders: [] };
        stocks.set(key, entry);
      }

      const prev = prevByCusip.get(h.cusip);

      entry.holders.push({
        cik: mgr.cik,
        name: config.name,
        tierWeight: config.tierWeight,
        tier: config.tier,
        pctOfPortfolio: h.pctOfPortfolio,
        sharesLatest: h.shares,
        sharesPrevious: prev ? prev.shares : null,
      });
    }
  }

  return stocks;
}

function scoreQuality(entry: StockEntry, totalTierWeight: number): number {
  const holderWeight = entry.holders.reduce((s, h) => s + h.tierWeight, 0);
  return (holderWeight / totalTierWeight) * 100;
}

function scoreConsensus(entry: StockEntry, totalManagers: number): number {
  const count = entry.holders.length;
  let score = (count / totalManagers) * 100;
  if (count === 1) score *= 0.5;
  return score;
}

function scoreConviction(entry: StockEntry, convictionCapPct: number): number {
  let weightedSum = 0;
  let weightSum = 0;
  for (const h of entry.holders) {
    const capped = Math.min(h.pctOfPortfolio, convictionCapPct);
    weightedSum += h.tierWeight * capped;
    weightSum += h.tierWeight;
  }
  if (weightSum === 0) return 0;
  const avgConviction = weightedSum / weightSum;
  return (avgConviction / convictionCapPct) * 100;
}

function scoreMomentum(entry: StockEntry, momentumChangeThreshold: number): number {
  let weightedSum = 0;
  let weightSum = 0;

  for (const h of entry.holders) {
    let signal: number;
    if (h.sharesPrevious === null) {
      signal = 1;
    } else if (h.sharesLatest === null) {
      signal = -1;
    } else {
      const change = (h.sharesLatest - h.sharesPrevious) / h.sharesPrevious;
      if (change > momentumChangeThreshold) signal = 0.5;
      else if (change < -momentumChangeThreshold) signal = -0.5;
      else signal = 0;
    }
    weightedSum += h.tierWeight * signal;
    weightSum += h.tierWeight;
  }

  if (weightSum === 0) return 50;
  const raw = weightedSum / weightSum;
  return (raw + 1) * 50;
}

export function scoreStocks(stockMap: Map<string, StockEntry>): StockScore[] {
  const cfg = clientAlgorithmConfig();
  const { scoringWeights, convictionCapPct, momentumChangeThreshold, curatedManagers } = cfg;
  const totalTierWeight = curatedManagers.reduce((s, m) => s + m.tierWeight, 0);
  const totalManagers = curatedManagers.length;
  const scores: StockScore[] = [];

  for (const [, entry] of stockMap) {
    const quality = scoreQuality(entry, totalTierWeight);
    const consensus = scoreConsensus(entry, totalManagers);
    const conviction = scoreConviction(entry, convictionCapPct);
    const momentum = scoreMomentum(entry, momentumChangeThreshold);

    const composite =
      scoringWeights.quality * quality +
      scoringWeights.consensus * consensus +
      scoringWeights.conviction * conviction +
      scoringWeights.momentum * momentum;

    scores.push({
      issuer: entry.issuer,
      cusip: entry.cusip,
      symbol: null, // resolved later
      quality: Math.round(quality * 10) / 10,
      consensus: Math.round(consensus * 10) / 10,
      conviction: Math.round(conviction * 10) / 10,
      momentum: Math.round(momentum * 10) / 10,
      composite: Math.round(composite * 10) / 10,
      targetPct: 0,
      currentPct: 0,
      overUnder: 0,
      action: 'Hold',
      holders: entry.holders.map(h => ({
        name: h.name,
        tier: h.tier,
        pctOfPortfolio: h.pctOfPortfolio,
        momentum:
          h.sharesPrevious === null
            ? 'New'
            : h.sharesLatest !== null && h.sharesPrevious > 0
              ? (() => {
                  const chg = (h.sharesLatest - h.sharesPrevious) / h.sharesPrevious;
                  if (chg > 0.10) return `+${(chg * 100).toFixed(0)}%`;
                  if (chg < -0.10) return `${(chg * 100).toFixed(0)}%`;
                  return 'Flat';
                })()
              : 'Flat',
      })),
    });
  }

  scores.sort((a, b) => b.composite - a.composite);
  return scores;
}

export function allocateWeights(scores: StockScore[]): StockScore[] {
  const { topN, weightFloor, weightCap, redistributionIterations, convergenceTolerance } = clientAlgorithmConfig();
  const top = scores.slice(0, topN);

  let rawWeights = top.map(s => Math.pow(s.composite, 1.5));
  let total = rawWeights.reduce((s, w) => s + w, 0);

  if (total === 0) return scores;

  let pcts = rawWeights.map(w => (w / total) * 100);

  for (let iter = 0; iter < redistributionIterations; iter++) {
    let excess = 0;
    let unfrozen = 0;

    for (let i = 0; i < pcts.length; i++) {
      if (pcts[i] < weightFloor) {
        excess -= weightFloor - pcts[i];
        pcts[i] = weightFloor;
      } else if (pcts[i] > weightCap) {
        excess += pcts[i] - weightCap;
        pcts[i] = weightCap;
      } else {
        unfrozen++;
      }
    }

    if (Math.abs(excess) < convergenceTolerance || unfrozen === 0) break;

    const redistribute = excess / unfrozen;
    for (let i = 0; i < pcts.length; i++) {
      if (pcts[i] > weightFloor && pcts[i] < weightCap) {
        pcts[i] += redistribute;
      }
    }
  }

  total = pcts.reduce((s, p) => s + p, 0);
  pcts = pcts.map(p => (p / total) * 100);

  for (let i = 0; i < top.length; i++) {
    top[i] = { ...top[i], targetPct: Math.round(pcts[i] * 100) / 100 };
  }

  const rest = scores.slice(topN).map(s => ({ ...s, targetPct: 0 }));

  return [...top, ...rest];
}

/**
 * Match 13F issuer names to Roth ticker symbols.
 */
export function resolveSymbols(
  scores: StockScore[],
  rothHoldings: RothHolding[]
): StockScore[] {
  // Build lookup from normalized issuer name fragments → symbol
  const symbolMap = new Map<string, string>();
  for (const h of rothHoldings) {
    const desc = h.description.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
    symbolMap.set(desc, h.symbol);
    // Also map the symbol itself
    symbolMap.set(h.symbol.toUpperCase(), h.symbol);
  }

  return scores.map(s => {
    const issuerNorm = s.issuer.toUpperCase().replace(/[^A-Z0-9 ]/g, '');

    // Try exact match on full issuer name
    if (symbolMap.has(issuerNorm)) {
      return { ...s, symbol: symbolMap.get(issuerNorm)! };
    }

    // Try matching first significant word(s) of issuer against Roth descriptions
    for (const [desc, sym] of symbolMap) {
      // Skip very short keys (symbol-only entries)
      if (desc.length < 4) continue;
      const issuerPrefix = issuerNorm.split(' ')[0];
      if (issuerPrefix.length >= 4 && desc.includes(issuerPrefix)) {
        return { ...s, symbol: sym };
      }
      if (desc.split(' ')[0].length >= 4 && issuerNorm.includes(desc.split(' ')[0])) {
        return { ...s, symbol: sym };
      }
    }

    return s;
  });
}

export function runAlgorithm(
  cache: AlgorithmCache,
  rothHoldings: RothHolding[],
  rothTotal: number
): AlgorithmResult {
  const stockMap = buildStockMap(cache);
  let scores = scoreStocks(stockMap);
  scores = allocateWeights(scores);
  scores = resolveSymbols(scores, rothHoldings);

  // Calculate current % from Roth holdings
  const rothBySymbol = new Map<string, number>();
  for (const h of rothHoldings) {
    rothBySymbol.set(h.symbol, h.currentValue);
  }

  scores = scores.map(s => {
    if (s.symbol && rothBySymbol.has(s.symbol)) {
      const currentPct = rothTotal > 0
        ? Math.round((rothBySymbol.get(s.symbol)! / rothTotal) * 10000) / 100
        : 0;
      rothBySymbol.delete(s.symbol); // mark as matched
      const overUnder = Math.round((s.targetPct - currentPct) * 100) / 100;
      return {
        ...s,
        currentPct,
        overUnder,
        action: (overUnder > 1 ? 'Buy' : overUnder < -1 ? 'Sell' : 'Hold') as 'Buy' | 'Sell' | 'Hold',
      };
    }
    return {
      ...s,
      overUnder: s.targetPct,
      action: s.targetPct > 0 ? 'Buy' as const : 'Hold' as const,
    };
  });

  // Add Roth holdings not in top scored stocks (overweight → sell)
  const extraScores: StockScore[] = [];
  for (const [sym, value] of rothBySymbol) {
    const currentPct = rothTotal > 0 ? Math.round((value / rothTotal) * 10000) / 100 : 0;
    const holding = rothHoldings.find(h => h.symbol === sym);
    extraScores.push({
      issuer: holding?.description || sym,
      cusip: '',
      symbol: sym,
      quality: 0,
      consensus: 0,
      conviction: 0,
      momentum: 0,
      composite: 0,
      targetPct: 0,
      currentPct,
      overUnder: -currentPct,
      action: 'Sell',
      holders: [],
    });
  }

  return {
    ranAt: new Date().toISOString(),
    scores: [...scores, ...extraScores],
    rothTotal,
  };
}
