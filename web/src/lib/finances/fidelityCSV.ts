import type { RothHolding, RothSnapshot } from '@/lib/finances-types';

function parseNum(raw: string): number {
  const cleaned = raw.replace(/[$,%"]/g, '').trim();
  if (!cleaned || cleaned === 'n/a' || cleaned === '--') return 0;
  return parseFloat(cleaned) || 0;
}

/**
 * Parse a Fidelity positions CSV export into a RothSnapshot.
 *
 * Fidelity CSVs typically have a header row like:
 *   Account Number, ..., Symbol, Description, Quantity, Last Price,
 *   Current Value, Today's Gain/Loss ..., Cost Basis Total, Gain/Loss ...
 *
 * We look for columns by name (case-insensitive, partial match) so minor
 * format changes from Fidelity don't break things.
 */
export function parseFidelityCSV(csvText: string): RothSnapshot {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());

  // Find the header row — first row containing "Symbol"
  let headerIdx = lines.findIndex(l => /symbol/i.test(l));
  if (headerIdx === -1) throw new Error('Could not find a header row with "Symbol" in the CSV.');

  const headers = splitCSVRow(lines[headerIdx]).map(h => h.toLowerCase().replace(/["\s]/g, ''));

  const col = (hint: string) => headers.findIndex(h => h.includes(hint));
  const iSymbol = col('symbol');
  const iDesc = col('description');
  const iQty = col('quantity');
  const iPrice = col('lastprice');
  const iValue = col('currentvalue');
  const iCost = col('costbasis');
  const iGainLoss = findGainLossCol(headers);
  const iGainPct = findGainLossPctCol(headers);

  if (iSymbol === -1) throw new Error('Could not find "Symbol" column.');

  const holdings: RothHolding[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = splitCSVRow(lines[i]);
    const symbol = (cells[iSymbol] ?? '').replace(/"/g, '').trim();
    if (!symbol || /^(total|account)/i.test(symbol)) continue;

    const quantity = parseNum(cells[iQty] ?? '');
    const lastPrice = parseNum(cells[iPrice] ?? '');
    const currentValue = parseNum(cells[iValue] ?? '') || quantity * lastPrice;
    const costBasis = parseNum(cells[iCost] ?? '');
    const gainLoss = iGainLoss !== -1 ? parseNum(cells[iGainLoss] ?? '') : currentValue - costBasis;
    const gainLossPercent = iGainPct !== -1 ? parseNum(cells[iGainPct] ?? '') : (costBasis ? (gainLoss / costBasis) * 100 : 0);

    holdings.push({
      symbol,
      description: (cells[iDesc] ?? '').replace(/"/g, '').trim(),
      quantity,
      lastPrice,
      currentValue,
      costBasis,
      gainLoss,
      gainLossPercent: Math.round(gainLossPercent * 100) / 100,
    });
  }

  if (holdings.length === 0) throw new Error('No holdings found in CSV.');

  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalCostBasis = holdings.reduce((s, h) => s + h.costBasis, 0);
  const totalGainLoss = holdings.reduce((s, h) => s + h.gainLoss, 0);

  return {
    id: crypto.randomUUID(),
    importedAt: new Date().toISOString(),
    holdings,
    totalValue,
    totalCostBasis,
    totalGainLoss,
  };
}

function findGainLossCol(headers: string[]): number {
  return headers.findIndex(h => h.includes('gain/loss') && !h.includes('%') && !h.includes('percent') && !h.includes('today'));
}

function findGainLossPctCol(headers: string[]): number {
  return headers.findIndex(h => (h.includes('gain/loss') && (h.includes('%') || h.includes('percent'))) && !h.includes('today'));
}

function splitCSVRow(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}
