export interface Portfolio {
  id: number;
  name: string;
  notes: string;
  created_at: string;
}

export interface Transaction {
  id: number;
  portfolio_id: number;
  ticker: string;
  type: 'buy' | 'sell';
  shares: number;
  price: number;
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
  totalValue: number | null;
  totalCost: number;
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

export interface CreatePortfolioRequest {
  name: string;
}

export interface UpdatePortfolioRequest {
  notes?: string;
}

export interface CreateTransactionRequest {
  ticker: string;
  type: 'buy' | 'sell';
  shares: number;
  price: number;
  date: string;
}

export interface PortfolioAnalysis {
  id: number;
  portfolio_id: number;
  content: string;
  model: string;
  generated_at: string;
}
