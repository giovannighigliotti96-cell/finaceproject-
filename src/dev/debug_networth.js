/**
 * DEBUG SCRIPT: Verifica calcolo Net Worth
 * 
 * Esegui questo script dalla console del browser per diagnosticare
 * perché il Net Worth non si aggiorna quando aggiungi un'entrata.
 */

export function debugNetWorth() {
  const store = window.__FINANCE_STORE__;
  if (!store) {
    console.error('❌ Store non trovato. Assicurati di essere nella pagina dell\'app.');
    return;
  }

  const data = store.getState().data;
  
  console.group('🔍 DEBUG NET WORTH');
  
  // 1. Verifica accounts
  console.group('📊 ACCOUNTS');
  data.accounts.forEach(acc => {
    console.log(`${acc.name} (${acc.id}):`, {
      type: acc.type,
      currentBalance: acc.currentBalance,
      balance: acc.balance,
    });
  });
  console.groupEnd();
  
  // 2. Calcola manualmente operatingLiquidity
  const operatingLiquidity = data.accounts
    .filter(a => a.type === 'operating_liquidity')
    .reduce((s, a) => s + (a.currentBalance ?? a.balance ?? 0), 0);
  
  const restrictedSavings = data.accounts
    .filter(a => a.type === 'savings')
    .reduce((s, a) => s + (a.currentBalance ?? a.balance ?? 0), 0);
  
  const investments = data.accounts
    .filter(a => a.type === 'investments')
    .reduce((s, a) => s + (a.currentBalance ?? a.balance ?? 0), 0);
  
  const totalAssets = operatingLiquidity + restrictedSavings + investments;
  
  const liabilities = (data.liabilities || []).reduce((s, l) => s + (l.principal || 0), 0);
  const liabilitiesFromAccounts = data.accounts
    .filter(a => a.type === 'liability')
    .reduce((s, a) => s + (a.currentBalance ?? a.balance ?? 0), 0);
  
  const totalLiabilities = liabilities + liabilitiesFromAccounts;
  
  const netWorth = totalAssets - totalLiabilities;
  
  console.group('💰 CALCOLO NET WORTH');
  console.log('Operating Liquidity:', operatingLiquidity);
  console.log('Restricted Savings:', restrictedSavings);
  console.log('Investments:', investments);
  console.log('─────────────────────');
  console.log('Total Assets:', totalAssets);
  console.log('Total Liabilities:', totalLiabilities);
  console.log('─────────────────────');
  console.log('NET WORTH:', netWorth);
  console.groupEnd();
  
  // 3. Verifica ultima transazione
  const lastTx = data.transactions[data.transactions.length - 1];
  console.group('📝 ULTIMA TRANSAZIONE');
  console.log(lastTx);
  console.groupEnd();
  
  // 4. Verifica acc_main
  const accMain = data.accounts.find(a => a.id === 'acc_main');
  console.group('🏦 ACC_MAIN');
  if (accMain) {
    console.log('✅ Trovato:', accMain);
    if (accMain.type !== 'operating_liquidity') {
      console.warn('⚠️ PROBLEMA: acc_main non ha type="operating_liquidity"!');
      console.log('Type attuale:', accMain.type);
    }
  } else {
    console.error('❌ acc_main non trovato!');
  }
  console.groupEnd();
  
  console.groupEnd();
  
  return {
    operatingLiquidity,
    restrictedSavings,
    investments,
    totalAssets,
    totalLiabilities,
    netWorth,
    accMain,
  };
}

// Esponi globalmente per debug
if (typeof window !== 'undefined') {
  window.debugNetWorth = debugNetWorth;
}
