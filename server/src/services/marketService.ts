import db from '../db.js';
import type { TickerSearchResult, Quote } from '../../../shared/types.js';

const YF_HEADERS = { 'User-Agent': 'Mozilla/5.0' };

export async function searchTickers(query: string): Promise<TickerSearchResult[]> {
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0&listsCount=0`;
    const res = await fetch(url, { headers: YF_HEADERS });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      quotes?: Array<{
        symbol?: string;
        shortname?: string;
        longname?: string;
        exchange?: string;
        quoteType?: string;
      }>;
    };
    return (data.quotes || [])
      .filter((q) => q.symbol && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF'))
      .map((q) => ({
        symbol: q.symbol!,
        name: q.shortname || q.longname || '',
        exchange: q.exchange || '',
        type: q.quoteType || '',
      }));
  } catch {
    return [];
  }
}

export async function getQuote(symbol: string): Promise<Quote> {
  // Use the chart API with range=1d to get current quote data
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  const res = await fetch(url, { headers: YF_HEADERS });

  if (!res.ok) {
    throw new Error(`Yahoo Finance returned ${res.status} for ${symbol}`);
  }

  const data = (await res.json()) as {
    chart?: {
      result?: Array<{
        meta?: {
          symbol?: string;
          shortName?: string;
          regularMarketPrice?: number;
          previousClose?: number;
        };
      }>;
    };
  };

  const meta = data.chart?.result?.[0]?.meta;
  if (!meta) throw new Error(`No data found for ${symbol}`);

  const price = meta.regularMarketPrice ?? 0;
  const prevClose = meta.previousClose ?? price;
  const change = price - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol: meta.symbol || symbol,
    price,
    change,
    changePercent,
    name: meta.shortName || symbol,
  };
}

export async function getHistoricalPrices(
  ticker: string,
  startDate: string,
  endDate: string,
): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();

  // Check cache first
  const cached = db
    .prepare('SELECT date, close_price FROM price_cache WHERE ticker = ? AND date BETWEEN ? AND ?')
    .all(ticker, startDate, endDate) as Array<{ date: string; close_price: number }>;

  for (const row of cached) {
    priceMap.set(row.date, row.close_price);
  }

  // If we have enough cached data, skip fetch
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const expectedTradingDays = Math.floor(daysDiff * 5 / 7);

  if (cached.length >= expectedTradingDays * 0.9) {
    return priceMap;
  }

  // Fetch from Yahoo Finance chart API
  try {
    const period1 = Math.floor(start.getTime() / 1000);
    const period2 = Math.floor(end.getTime() / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d`;

    const res = await fetch(url, { headers: YF_HEADERS });

    if (!res.ok) {
      console.error(`Yahoo chart API returned ${res.status} for ${ticker}`);
      return priceMap;
    }

    const data = (await res.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: {
            quote?: Array<{ close?: (number | null)[] }>;
          };
        }>;
      };
    };

    const result = data.chart?.result?.[0];
    if (!result?.timestamp || !result.indicators?.quote?.[0]?.close) {
      return priceMap;
    }

    const timestamps = result.timestamp;
    const closes = result.indicators.quote[0].close;

    const insertStmt = db.prepare(
      'INSERT OR IGNORE INTO price_cache (ticker, date, close_price) VALUES (?, ?, ?)',
    );

    const rows: Array<{ date: string; close: number }> = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (close == null) continue;
      const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
      rows.push({ date, close });
    }

    const insertMany = db.transaction((r: typeof rows) => {
      for (const row of r) {
        insertStmt.run(ticker, row.date, row.close);
      }
    });
    insertMany(rows);

    for (const row of rows) {
      priceMap.set(row.date, row.close);
    }
  } catch (err) {
    console.error(`Failed to fetch historical prices for ${ticker}:`, err);
  }

  return priceMap;
}
