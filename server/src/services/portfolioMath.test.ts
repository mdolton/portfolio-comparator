import { describe, it, expect } from 'vitest';
import type { Transaction } from '../../../shared/types.js';
import { cashDelta, computeCashBalance, computeHoldings, negativeShareViolation, holdingsAtDate, portfolioValueAtDate } from './portfolioMath';

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
