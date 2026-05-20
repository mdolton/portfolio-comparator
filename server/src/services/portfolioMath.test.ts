import { describe, it, expect } from 'vitest';
import type { Transaction } from '../../../shared/types.js';
import { cashDelta, computeCashBalance, computeHoldings, negativeShareViolation, holdingsAtDate, portfolioValueAtDate, externalCashFlow, timeWeightedReturnSeries } from './portfolioMath';

let nextId = 1;
function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: nextId++,
    portfolio_id: 1,
    type: 'buy',
    ticker: null,
    shares: null,
    price: null,
    amount: null,
    date: '2024-01-01',
    created_at: '',
    ...partial,
  } as Transaction;
}

describe('cashDelta', () => {
  it('is negative cost for a buy', () => {
    expect(cashDelta(tx({ type: 'buy', shares: 10, price: 5 }))).toBe(-50);
  });
  it('is positive proceeds for a sell', () => {
    expect(cashDelta(tx({ type: 'sell', shares: 10, price: 5 }))).toBe(50);
  });
  it('adds for deposit and dividend', () => {
    expect(cashDelta(tx({ type: 'deposit', amount: 100 }))).toBe(100);
    expect(cashDelta(tx({ type: 'dividend', amount: 7 }))).toBe(7);
  });
  it('subtracts for withdrawal', () => {
    expect(cashDelta(tx({ type: 'withdrawal', amount: 30 }))).toBe(-30);
  });
});

describe('computeCashBalance', () => {
  it('sums all deltas', () => {
    const txs = [
      tx({ type: 'deposit', amount: 1000, date: '2024-01-01' }),
      tx({ type: 'buy', shares: 10, price: 20, date: '2024-01-02' }),
      tx({ type: 'dividend', amount: 5, date: '2024-01-03' }),
      tx({ type: 'sell', shares: 4, price: 25, date: '2024-01-04' }),
    ];
    // 1000 - 200 + 5 + 100
    expect(computeCashBalance(txs)).toBe(905);
  });
  it('respects the asOf date (inclusive)', () => {
    const txs = [
      tx({ type: 'deposit', amount: 1000, date: '2024-01-01' }),
      tx({ type: 'buy', shares: 10, price: 20, date: '2024-01-05' }),
    ];
    expect(computeCashBalance(txs, '2024-01-03')).toBe(1000);
    expect(computeCashBalance(txs, '2024-01-05')).toBe(800);
  });
  it('can go negative', () => {
    expect(computeCashBalance([tx({ type: 'buy', shares: 1, price: 10 })])).toBe(-10);
  });
});

describe('computeHoldings', () => {
  it('aggregates buys and sells into positions, ignoring cash entries', () => {
    const txs = [
      tx({ type: 'deposit', amount: 1000, date: '2024-01-01' }),
      tx({ type: 'buy', ticker: 'AAPL', shares: 10, price: 100, date: '2024-01-02' }),
      tx({ type: 'buy', ticker: 'AAPL', shares: 10, price: 120, date: '2024-01-03' }),
      tx({ type: 'sell', ticker: 'AAPL', shares: 5, price: 130, date: '2024-01-04' }),
      tx({ type: 'dividend', ticker: 'AAPL', amount: 12, date: '2024-01-05' }),
    ];
    const holdings = computeHoldings(txs);
    expect(holdings).toHaveLength(1);
    const aapl = holdings[0];
    expect(aapl.ticker).toBe('AAPL');
    expect(aapl.shares).toBe(15);
    // cost basis: 2200 total, sell removes 5 * (2200/20)=550 -> 1650
    expect(aapl.totalCost).toBeCloseTo(1650);
    expect(aapl.avgCost).toBeCloseTo(110);
    expect(aapl.currentPrice).toBeNull();
  });

  it('drops fully-sold positions', () => {
    const txs = [
      tx({ type: 'buy', ticker: 'MSFT', shares: 5, price: 10, date: '2024-01-01' }),
      tx({ type: 'sell', ticker: 'MSFT', shares: 5, price: 12, date: '2024-01-02' }),
    ];
    expect(computeHoldings(txs)).toHaveLength(0);
  });
});

describe('negativeShareViolation', () => {
  it('returns null when balances stay non-negative', () => {
    const trades = [
      tx({ type: 'buy', ticker: 'AAPL', shares: 10, date: '2024-01-01' }),
      tx({ type: 'sell', ticker: 'AAPL', shares: 10, date: '2024-01-02' }),
    ];
    expect(negativeShareViolation(trades)).toBeNull();
  });

  it('flags a sell that exceeds holdings', () => {
    const trades = [
      tx({ type: 'buy', ticker: 'AAPL', shares: 5, date: '2024-01-01' }),
      tx({ type: 'sell', ticker: 'AAPL', shares: 8, date: '2024-01-02' }),
    ];
    const v = negativeShareViolation(trades);
    expect(v).not.toBeNull();
    expect(v?.ticker).toBe('AAPL');
    expect(v?.date).toBe('2024-01-02');
    expect(v?.balance).toBeCloseTo(-3);
  });

  it('ignores cash transactions', () => {
    const trades = [
      tx({ type: 'withdrawal', amount: 9999, date: '2024-01-01' }),
      tx({ type: 'buy', ticker: 'AAPL', shares: 1, date: '2024-01-02' }),
    ];
    expect(negativeShareViolation(trades)).toBeNull();
  });
});

describe('holdingsAtDate', () => {
  it('returns share balances as of a date (inclusive)', () => {
    const txs = [
      tx({ type: 'buy', ticker: 'AAPL', shares: 10, price: 100, date: '2024-01-01' }),
      tx({ type: 'sell', ticker: 'AAPL', shares: 4, price: 110, date: '2024-01-05' }),
    ];
    expect(holdingsAtDate(txs, '2024-01-03').get('AAPL')).toBe(10);
    expect(holdingsAtDate(txs, '2024-01-05').get('AAPL')).toBe(6);
  });
});

describe('portfolioValueAtDate', () => {
  it('adds priced securities to the cash balance at the date', () => {
    const txs = [
      tx({ type: 'deposit', amount: 1000, date: '2024-01-01' }),
      tx({ type: 'buy', ticker: 'AAPL', shares: 5, price: 100, date: '2024-01-02' }),
    ];
    const prices = new Map([['AAPL', 120]]);
    // cash: 1000 - 500 = 500; securities: 5 * 120 = 600
    expect(portfolioValueAtDate(txs, prices, '2024-01-02')).toBe(1100);
  });

  it('skips securities with no known price but still counts cash', () => {
    const txs = [
      tx({ type: 'deposit', amount: 200, date: '2024-01-01' }),
      tx({ type: 'buy', ticker: 'XYZ', shares: 1, price: 50, date: '2024-01-02' }),
    ];
    const prices = new Map<string, number>();
    // securities unpriced -> 0; cash: 200 - 50 = 150
    expect(portfolioValueAtDate(txs, prices, '2024-01-02')).toBe(150);
  });
});

describe('externalCashFlow', () => {
  it('is the positive amount for a deposit', () => {
    expect(externalCashFlow(tx({ type: 'deposit', amount: 100 }))).toBe(100);
  });
  it('is the negative amount for a withdrawal', () => {
    expect(externalCashFlow(tx({ type: 'withdrawal', amount: 30 }))).toBe(-30);
  });
  it('is zero for a dividend (counts as return, not an external flow)', () => {
    expect(externalCashFlow(tx({ type: 'dividend', amount: 7 }))).toBe(0);
  });
  it('is zero for buys and sells (internal cash<->shares swaps)', () => {
    expect(externalCashFlow(tx({ type: 'buy', shares: 10, price: 5 }))).toBe(0);
    expect(externalCashFlow(tx({ type: 'sell', shares: 10, price: 5 }))).toBe(0);
  });
});

describe('timeWeightedReturnSeries', () => {
  it('is flat at 0% when the market does not move', () => {
    const out = timeWeightedReturnSeries([
      { date: 'd1', value: 100, flow: 100 },
      { date: 'd2', value: 100, flow: 0 },
      { date: 'd3', value: 100, flow: 0 },
    ]);
    expect(out.map((p) => p.growthPct)).toEqual([0, 0, 0]);
  });

  it('does not jump when a deposit arrives', () => {
    const out = timeWeightedReturnSeries([
      { date: 'd1', value: 100, flow: 100 }, // baseline
      { date: 'd2', value: 110, flow: 0 },   // +10% market
      { date: 'd3', value: 210, flow: 100 }, // +100 deposit, no market move
      { date: 'd4', value: 231, flow: 0 },   // +10% on 210
    ]);
    expect(out[0].growthPct).toBeCloseTo(0);
    expect(out[1].growthPct).toBeCloseTo(10);
    expect(out[2].growthPct).toBeCloseTo(10); // deposit did not move the line
    expect(out[3].growthPct).toBeCloseTo(21);
  });

  it('counts a dividend as growth', () => {
    const out = timeWeightedReturnSeries([
      { date: 'd1', value: 100, flow: 100 },
      { date: 'd2', value: 105, flow: 0 }, // +5 dividend lands in value, flow=0
    ]);
    expect(out[1].growthPct).toBeCloseTo(5);
  });

  it('does not drop when a withdrawal is taken', () => {
    const out = timeWeightedReturnSeries([
      { date: 'd1', value: 100, flow: 100 },
      { date: 'd2', value: 50, flow: -50 }, // withdraw 50, no market move
      { date: 'd3', value: 55, flow: 0 },   // +10% on remaining 50
    ]);
    expect(out[1].growthPct).toBeCloseTo(0);
    expect(out[2].growthPct).toBeCloseTo(10);
  });

  it('handles emptying then re-funding the account without dividing by zero', () => {
    const out = timeWeightedReturnSeries([
      { date: 'd1', value: 100, flow: 100 },
      { date: 'd2', value: 0, flow: -100 }, // withdraw everything
      { date: 'd3', value: 50, flow: 50 },  // re-fund
      { date: 'd4', value: 60, flow: 0 },   // +20% on 50
    ]);
    expect(out.map((p) => p.growthPct)).toEqual([0, 0, 0, expect.closeTo(20)]);
  });

  it('starts the baseline at the first day with positive value', () => {
    const out = timeWeightedReturnSeries([
      { date: 'd1', value: 0, flow: 0 },     // no activity yet -> omitted
      { date: 'd2', value: 0, flow: 0 },     // omitted
      { date: 'd3', value: 200, flow: 200 }, // baseline 0%
      { date: 'd4', value: 220, flow: 0 },   // +10%
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ date: 'd3', growthPct: 0 });
    expect(out[1].date).toBe('d4');
    expect(out[1].growthPct).toBeCloseTo(10);
  });
});
