import * as transactionService from './transactionService.js';
import * as marketService from './marketService.js';
import type { Holding } from '../../../shared/types.js';

export interface EnrichedHoldings {
  holdings: Holding[];
  totalValue: number | null;
  totalCost: number;
}

export async function getEnrichedHoldings(portfolioId: number): Promise<EnrichedHoldings> {
  const holdings = transactionService.getHoldings(portfolioId);

  let totalValue: number | null = 0;
  for (const holding of holdings) {
    try {
      const quote = await marketService.getQuote(holding.ticker);
      holding.currentPrice = quote.price;
      holding.marketValue = holding.shares * quote.price;
      holding.gainLoss = holding.marketValue - holding.totalCost;
      holding.gainLossPercent =
        holding.totalCost > 0 ? (holding.gainLoss / holding.totalCost) * 100 : null;
      if (totalValue !== null) totalValue += holding.marketValue;
    } catch {
      totalValue = null;
    }
  }

  return {
    holdings,
    totalValue,
    totalCost: holdings.reduce((sum, h) => sum + h.totalCost, 0),
  };
}
