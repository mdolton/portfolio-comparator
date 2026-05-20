import type { Transaction } from '../../../shared/types.js';

/** Cash impact of a single transaction. */
export function cashDelta(
  tx: Pick<Transaction, 'type' | 'shares' | 'price' | 'amount'>,
): number {
  switch (tx.type) {
    case 'buy':
      return -((tx.shares ?? 0) * (tx.price ?? 0));
    case 'sell':
      return (tx.shares ?? 0) * (tx.price ?? 0);
    case 'deposit':
    case 'dividend':
      return tx.amount ?? 0;
    case 'withdrawal':
      return -(tx.amount ?? 0);
    default:
      return 0;
  }
}

/** Cash balance from summing deltas, optionally only through `asOf` (inclusive). */
export function computeCashBalance(
  txs: Array<Pick<Transaction, 'type' | 'shares' | 'price' | 'amount' | 'date'>>,
  asOf?: string,
): number {
  return txs.reduce(
    (sum, tx) => (asOf && tx.date > asOf ? sum : sum + cashDelta(tx)),
    0,
  );
}
