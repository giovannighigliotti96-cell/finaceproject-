import React, { createContext, useContext, useEffect } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useFinanceComputed } from '../hooks/useFinanceComputed';

const FinanceContext = createContext(null);

export function FinanceProvider({ children }) {
  const data = useFinanceStore((state) => state.data);
  const setData = useFinanceStore((state) => state.setData);
  const purgeRecurringRule = useFinanceStore((state) => state.purgeRecurringRule);
  const reconcileOperatingAccount = useFinanceStore((state) => state.reconcileOperatingAccount);

  const computed = useFinanceComputed(data);

  // Migrazione one-shot: rimuove rule_pac dai dati persistiti in IndexedDB.
  // Il PAC era un trasferimento interno, non una spesa operativa.
  // Riconcilia anche il saldo conto operativo (corregge anomalie da account Revolut eliminato).
  useEffect(() => {
    const hasPac = (data.recurringRules || []).some(r => r.id === 'rule_pac');
    if (hasPac) purgeRecurringRule('rule_pac');
    reconcileOperatingAccount();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <FinanceContext.Provider value={{ data, setData, computed }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinanceData() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinanceData must be used within FinanceProvider');
  return ctx;
}
