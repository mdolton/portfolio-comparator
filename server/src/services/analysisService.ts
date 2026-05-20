import Anthropic from '@anthropic-ai/sdk';
import db from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import * as portfolioService from './portfolioService.js';
import * as transactionService from './transactionService.js';
import * as holdingsEnrichment from './holdingsEnrichment.js';
import type { PortfolioAnalysis } from '../../../shared/types.js';

const MODEL = 'claude-sonnet-4-6';

// Generous ceiling so the full 4-section analysis is never truncated mid-sentence.
// Output is billed per token actually generated, so a high cap costs nothing for
// the typical short analysis; it just removes the cliff that cut responses off.
const MAX_TOKENS = 8000;

const SYSTEM_PROMPT = `You are an experienced portfolio analyst. Given a user's portfolio data and their notes (which may contain their investment thesis), produce a clear, grounded analysis. Take the user's stated thesis seriously and reference it explicitly. Be concrete: name specific holdings when discussing strengths, risks, or suggestions. Reason about position sizing, concentration, recent transaction activity, and how the holdings align with the stated thesis.

Return markdown with exactly these sections in this order:

## Overview
## Strengths
## Risks
## Suggestions

End with a single italic line: *This is informational analysis, not financial advice.*

If the portfolio has no holdings, return a brief Overview noting that, and a single bullet under each remaining section explaining the portfolio is empty and the user should add transactions first.
If the user has not provided notes, ground the analysis in the holdings and transaction patterns alone and note that no thesis was stated.`;

export function getAnalysis(portfolioId: number): PortfolioAnalysis | null {
  const row = db
    .prepare('SELECT * FROM portfolio_analyses WHERE portfolio_id = ?')
    .get(portfolioId) as PortfolioAnalysis | undefined;
  return row ?? null;
}

export async function generateAnalysis(portfolioId: number): Promise<PortfolioAnalysis> {
  const portfolio = portfolioService.getPortfolioById(portfolioId);
  if (!portfolio) throw new AppError(404, 'Portfolio not found');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AppError(500, 'ANTHROPIC_API_KEY not configured on server');
  }

  const enriched = await holdingsEnrichment.getEnrichedHoldings(portfolioId);
  const transactions = transactionService.getTransactionsByPortfolio(portfolioId);

  const userPayload = {
    notes: portfolio.notes ?? '',
    totals: { cost: enriched.totalCost, value: enriched.totalValue },
    holdings: enriched.holdings.map((h) => ({
      ticker: h.ticker,
      shares: h.shares,
      avgCost: h.avgCost,
      totalCost: h.totalCost,
      currentPrice: h.currentPrice,
      marketValue: h.marketValue,
      gainLoss: h.gainLoss,
      gainLossPercent: h.gainLossPercent,
    })),
    transactions: transactions.map((t) => ({
      ticker: t.ticker,
      type: t.type,
      shares: t.shares,
      price: t.price,
      date: t.date,
    })),
  };

  const client = new Anthropic({ apiKey });

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(userPayload, null, 2) }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw new AppError(502, `Claude API request failed: ${message}`);
  }

  const content = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (!content) {
    throw new AppError(502, 'Claude returned an empty response');
  }

  // Never persist a silently-truncated analysis. With MAX_TOKENS this should
  // effectively never fire, but if it does, fail loudly so the user can retry
  // rather than seeing an analysis that stops mid-sentence.
  if (response.stop_reason === 'max_tokens') {
    throw new AppError(
      502,
      `Analysis was cut off after ${MAX_TOKENS} tokens. Try regenerating it.`,
    );
  }

  db.prepare(
    `INSERT INTO portfolio_analyses (portfolio_id, content, model)
     VALUES (?, ?, ?)
     ON CONFLICT(portfolio_id) DO UPDATE SET
       content = excluded.content,
       model = excluded.model,
       generated_at = datetime('now')`,
  ).run(portfolioId, content, MODEL);

  return getAnalysis(portfolioId)!;
}
