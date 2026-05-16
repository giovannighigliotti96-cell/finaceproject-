export function validateTransactionSemantic(tx, data) {
  const errors = [];

  const account = (data.accounts || []).find(a => a.id === tx.accountId);
  const category = (data.categories || []).find(c => c.id === tx.categoryId);

  if (!account) errors.push('Conto non valido o non selezionato.');
  if (!category) errors.push('Categoria non valida o non selezionata.');

  if (tx.type === 'investment') {
    if (!account || (account.type !== 'investments' && account.type !== 'savings')) {
      errors.push('Gli investimenti sono consentiti solo su conti tipo "investments" o "savings".');
    }
  }

  // Rimosso vincolo: le entrate possono avere qualsiasi natura (fixed, variable, extraordinary)
  // per supportare rimborsi e altre entrate straordinarie

  if (tx.type === 'expense' && tx.nature === 'variable') {
    if (category && category.group !== 'variable') {
      errors.push('Una spesa variabile deve appartenere a una categoria variabile.');
    }
  }

  if (tx.type === 'expense' && tx.nature === 'fixed') {
    if (category && category.group !== 'fixed') {
      errors.push('Una spesa fissa deve appartenere a una categoria fissa.');
    }
  }

  if (tx.status === 'paid' && !tx.accountId) {
    errors.push('Una transazione con status "paid" deve avere un conto associato.');
  }

  if (!tx.amount || tx.amount <= 0) {
    errors.push("L'importo deve essere maggiore di zero.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}