import { describe, it, expect } from 'vitest';
import type { Transaction } from '../../../shared/types.js';
import { cashDelta, computeCashBalance } from './portfolioMath';

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
