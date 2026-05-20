import * as transactionService from './transactionService.js';
import * as marketService from './marketService.js';
import type { Holding } from '../../../shared/types.js';

export interface EnrichedHoldings {
  holdings: Holding[];
  securitiesValue: number | null;
  totalCost: number;
  cash: number;
  totalValue: number | null;
}

export async function getEnrichedHoldings(portfolioId: number): Promise<EnrichedHoldings> {
  const holdings = transactionService.getHoldings(portfolioId);

  let securitiesValue: number | null = 0;
  for (const holding of holdings) {
    try {
      const quote = await marketService.getQuote(holding.ticker);
      holding.currentPrice = quote.price;
      holding.marketValue = holding.shares * quote.price;
      holding.gainLoss = holding.marketValue - holding.totalCost;
      holding.gainLossPercent =
        holding.totalCost > 0 ? (holding.gainLoss / holding.totalCost) * 100 : null;
      if (securitiesValue !== null) securitiesValue += holding.marketValue;
    } catch {
      securitiesValue = null;
    }
  }

  const cash = transactionService.getCashBalance(portfolioId);
  const totalCost = holdings.reduce((sum, h) => sum + h.totalCost, 0);
  const totalValue = securitiesValue === null ? null : securitiesValue + cash;

  return { holdings, securitiesValue, totalCost, cash, totalValue };
}
