export interface Portfolio {
  id: number;
  name: string;
  notes: string;
  created_at: string;
}

export type TransactionType = 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'dividend';

export interface Transaction {
  id: number;
  portfolio_id: number;
  type: TransactionType;
  ticker: string | null;
  shares: number | null;
  price: number | null;
  amount: number | null;
  date: string;
  created_at: string;
}

export interface Holding {
  ticker: string;
  shares: number;
  avgCost: number;
  totalCost: number;
  currentPrice: number | null;
  marketValue: number | null;
  gainLoss: number | null;
  gainLossPercent: number | null;
}

export interface PortfolioWithHoldings extends Portfolio {
  holdings: Holding[];
  securitiesValue: number | null;
  totalValue: number | null;
  totalCost: number;
  cash: number;
}

export interface TickerSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  name: string;
}

export interface PerformancePoint {
  date: string;
  [portfolioName: string]: string | number;
}

export interface PerformanceResponse {
  value: PerformancePoint[];  // total portfolio value in dollars
  growth: PerformancePoint[]; // cumulative time-weighted return in percent
}

export type PerformanceMetric = 'value' | 'growth';

export interface CreatePortfolioRequest {
  name: string;
}

export interface UpdatePortfolioRequest {
  notes?: string;
}

export interface CreateTransactionRequest {
  type: TransactionType;
  ticker?: string | null;
  shares?: number | null;
  price?: number | null;
  amount?: number | null;
  date: string;
}

export interface PortfolioAnalysis {
  id: number;
  portfolio_id: number;
  content: string;
  model: string;
  generated_at: string;
}
