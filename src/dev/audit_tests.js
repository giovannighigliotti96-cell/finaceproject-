import { useFinanceStore, generatePlannedFixedCosts } from '../store/useFinanceStore';
import { parse, format, addMonths } from 'date-fns';

/**
 * AUDIT TEST SUITE
 * Run these tests to verify financial logic.
 */
export async function runAuditTests() {
  const results = [];
  const log = (msg, pass) => results.push({ msg, pass });

  console.log('--- STARTING AUDIT TESTS ---');

  // Helper to reset store to a clean state for testing
  const resetStore = () => {
    useFinanceStore.getState().setData({
      settings: {
        currency: 'EUR',
        activePeriodId: null,
        defaultIncome: 1900,
        safetyBuffer: 1000,
        categoryBudgets: {},
        targetSavingsAmount: 190,
      },
      periods: [],
      accounts: [
        { id: 'acc_main', name: 'Main', type: 'operating_liquidity', currentBalance: 2000 },
        { id: 'acc_inv', name: 'Investments', type: 'investments', currentBalance: 5000 }
      ],
      transactions: [],
      categories: [],
      goals: [],
      recurringRules: [],
    });
  };

  // 1. TEST: Investment Symmetry
  try {
    resetStore();
    const store = useFinanceStore.getState();
    
    // Add an investment transaction
    store.addTransaction({
      amount: 400,
      accountId: 'acc_main',
      type: 'investment',
      status: 'paid',
      description: 'PAC Test',
      date: '2026-05-10',
      periodId: '2026-05'
    });

    const state = useFinanceStore.getState().data;
    const mainAcc = state.accounts.find(a => a.id === 'acc_main');
    const invAcc = state.accounts.find(a => a.id === 'acc_inv');

    // BUG EXPECTED: mainAcc.currentBalance should be 1600 (2000 - 400), but currently it's 2000.
    log('Investment: Source account balance reduction', mainAcc.currentBalance === 1600);
    log('Investment: Dest account balance increase', invAcc.currentBalance === 5400);

    // Delete it
    const tx = state.transactions[0];
    store.deleteTransaction(tx.id);
    
    const state2 = useFinanceStore.getState().data;
    const mainAcc2 = state2.accounts.find(a => a.id === 'acc_main');
    const invAcc2 = state2.accounts.find(a => a.id === 'acc_inv');
    log('Investment Delete: Idempotency (balances back to 2000/5000)', mainAcc2.currentBalance === 2000 && invAcc2.currentBalance === 5000);
  } catch (e) {
    log('Investment Symmetry Test Failed: ' + e.message, false);
  }

  // 2. TEST: acc_main Hardcoding
  try {
    resetStore();
    const store = useFinanceStore.getState();
    // Rename main account ID
    store.setData(data => ({
      ...data,
      accounts: data.accounts.map(a => a.id === 'acc_main' ? { ...a, id: 'acc_real_main' } : a)
    }));

    // Register salary
    store.registerSalaryAndStartCycle({
      amount: 1900,
      dateStr: '01/06/2026',
      bankBalance: 2000,
      isExtraordinaryIncome: false,
      openingInvestments: 5000
    });

    const state = useFinanceStore.getState().data;
    const realMain = state.accounts.find(a => a.id === 'acc_real_main');
    const accMain = state.accounts.find(a => a.id === 'acc_main');

    log('acc_main Hardcoding: System should use existing main account if renamed', !!realMain && realMain.currentBalance === 2000);
    log('acc_main Hardcoding: System should NOT create duplicate acc_main', !state.accounts.some(a => a.id === 'acc_main' && a.name !== 'Main'));
  } catch (e) {
    log('acc_main Test Failed: ' + e.message, false);
  }

  // 3. TEST: Cycle Consistency
  try {
    resetStore();
    const store = useFinanceStore.getState();
    
    // Register on 15th
    store.registerSalaryAndStartCycle({
      amount: 1900,
      dateStr: '15/05/2026',
      bankBalance: 1000,
      isExtraordinaryIncome: false
    });

    const state = useFinanceStore.getState().data;
    const period = state.periods[0];
    log('Cycle: startDate correct', period.startDate === '2026-05-15');
    log('Cycle: endDate is +1 month', period.endDate === '2026-06-15');
    log('Cycle: periodId is yyyy-MM', period.id === '2026-05');
  } catch (e) {
    log('Cycle Test Failed: ' + e.message, false);
  }

  console.log('--- AUDIT TEST RESULTS ---');
  results.forEach(r => console.log(`${r.pass ? '✅' : '❌'} ${r.msg}`));
  console.log('--------------------------');
  
  return results;
}
