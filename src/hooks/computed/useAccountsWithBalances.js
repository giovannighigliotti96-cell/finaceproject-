import { useMemo } from 'react';
import { useFinanceStore } from '../../store/useFinanceStore';
import { useShallow } from 'zustand/react/shallow';

export function useAccountsWithBalances() {
  const accounts = useFinanceStore(useShallow(state => state.data.accounts || []));
  const transactions = useFinanceStore(useShallow(state => state.data.transactions || []));

  return useMemo(() => {
    return accounts.map(acc => {
      // CQRS: Il saldo è calcolato dinamicamente on-the-fly sulla base delle transazioni storiche
      const netDelta = transactions
        .filter(t => t.accountId === acc.id && t.status === 'paid')
        .reduce((sum, t) => sum + (t.type === 'expense' ? -t.amount : t.amount), 0);
        
      return {
        ...acc,
        computedBalance: (acc.openingBalance || 0) + netDelta
      };
    });
  }, [accounts, transactions]);
}
