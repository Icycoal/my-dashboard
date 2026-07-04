import { financesRequest } from '@/lib/api';

export interface IBKRSummaryField {
  amount: number | null;
  currency: string | null;
}

export interface IBKRSummary {
  netliquidation?: IBKRSummaryField;
  totalcashvalue?: IBKRSummaryField;
  buyingpower?: IBKRSummaryField;
  grosspositionvalue?: IBKRSummaryField;
  unrealizedpnl?: IBKRSummaryField;
  realizedpnl?: IBKRSummaryField;
}

export interface IBKRPosition {
  conid?: number;
  contractDesc?: string;
  assetClass?: string;
  position?: number;
  mktPrice?: number;
  mktValue?: number;
  avgCost?: number;
  unrealizedPnl?: number;
  realizedPnl?: number;
  currency?: string;
}

export interface IBKRTrade {
  execution_id?: string;
  symbol?: string;
  side?: string;
  size?: string;
  price?: string;
  commission?: string;
  trade_time_r?: number;
  account?: string;
  company_name?: string;
}

export interface IBKRPnLEntry {
  dailyPnl?: number;
  unrealizedPnl?: number;
  realizedPnl?: number;
}

export interface IBKRPortfolio {
  accounts: Record<string, { summary: IBKRSummary; positions: IBKRPosition[] }>;
  trades: IBKRTrade[];
  pnl: Record<string, IBKRPnLEntry>;
}

export function fetchIBKRPortfolio(): Promise<IBKRPortfolio> {
  return financesRequest<IBKRPortfolio>('ibkr/portfolio');
}
