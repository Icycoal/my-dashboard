import type { StockQuote, ThirteenFManager, ThirteenFFiling, ThirteenFHolding } from '@/lib/finances-types';
import { financesRequest } from '@/lib/api';

export async function fetchQuotes(symbols: string[]): Promise<Record<string, StockQuote>> {
  if (symbols.length === 0) return {};
  return financesRequest<Record<string, StockQuote>>('quotes', {
    query: { symbols: symbols.join(',') },
  });
}

export async function searchFunds(query: string): Promise<ThirteenFManager[]> {
  if (!query.trim()) return [];
  return financesRequest<ThirteenFManager[]>('13f/search', { query: { q: query } });
}

export async function fetchFilings(cik: string, limit = 5): Promise<ThirteenFFiling[]> {
  return financesRequest<ThirteenFFiling[]>('13f/filings', { query: { cik, limit } });
}

export async function fetchHoldings(cik: string, accession: string): Promise<ThirteenFHolding[]> {
  return financesRequest<ThirteenFHolding[]>('13f/holdings', { query: { cik, accession } });
}
