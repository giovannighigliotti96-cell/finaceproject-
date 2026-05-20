import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '../lib/storage';
import { addMonths, format, parse, getDaysInMonth } from 'date-fns';

import { demoData } from '../lib/demoData';

// RECURRING RULES DEFINITION (HARDENED 2.0)
// PAC RIMOSSO: il PAC era un trasferimento patrimoniale interno, non una spesa operativa.
// L'utente gestisce il buffer PAC tramite settings.safetyBuffer.
const RECURRING_RULES = [
  { id: 'rule_famiglia_maggio', name: 'Spese Famiglia', dayOfMonth: 5, amount: 200.00, type: 'expense', startDate: null, endDate: '2026-05' },
  { id: 'rule_famiglia', name: 'Spese Famiglia', dayOfMonth: 5, amount: 500.00, type: 'expense', startDate: '2026-06', endDate: null },
  { id: 'rule_consulenza', name: 'Consulenza Racca', dayOfMonth: 20, amount: 275.00, type: 'expense', startDate: null, endDate: '2026-08' },
  { id: 'rule_telefono', name: 'Telefono', dayOfMonth: 15, amount: 51.62, type: 'expense', startDate: null, endDate: '2026-07' },
];

// ─── STATO INIZIALE — COMPLETAMENTE VUOTO ───────────────────────────────────
const emptyData = {
  settings: {
    currency: 'EUR',
    activePeriodId: null,
    defaultIncome: 1900,
    safetyBuffer: 50,
    expectedReturnRate: 3.5,
    theme: 'dark',
    // AUDIT NOTE: added assumedInflationRate and reconciliationTolerance for S02/S05
    assumedInflationRate: 0.03,
    reconciliationTolerance: 10,
    // Budget per categoria variabile (categoryId -> importo EUR)
    categoryBudgets: {
      alimentari: 400,
      ristorazione: 150,
      trasporti: 100,
      abbigliamento: 100,
      intrattenimento: 80,
      salute: 80,
      varie: 100,
      straordinario: 0,
    },
    targetSavingsAmount: 190,
    budgetsLastUpdated: null,
    lastCloudSync: null,
    syncStatus: 'offline',
    firebaseUid: null,
    authEmail: 'admin@finance.it',
    authPassword: 'admin',
    pensionConfig: {
      tfrDestination: 'fondo',     // 'fondo' o 'azienda'
      currentTfrBalance: 0,        // Saldo ufficiale estratto conto portale fondo
      lastStatementDate: '2025-12',// Anno-Mese competenza del saldo (YYYY-MM)
      monthlyAccrual: 175,         // Quota TFR mensile maturata in busta paga
      currentAge: 30,
      retirementAge: 67,
      annualReturn: 3.5,
      voluntaryContributionPercentage: 0,
      employerContributionPercentage: 1.5
    },
  },
  categorizationRules: [
    { pattern: 'esselunga|coop|pam|carrefour|conad|lidl|aldi|crai', categoryId: 'alimentari' },
    { pattern: 'ristorante|pizzeria|bar|gelateria|mcdonald|kfc|sushi|trattoria|pub', categoryId: 'ristorazione' },
    { pattern: 'amazon|paypal|satispay|tabacchi|farmacia', categoryId: 'varie' },
    { pattern: 'netflix|spotify|prime|disney|dazn', categoryId: 'intrattenimento' },
    { pattern: 'trenitalia|italo|eni|q8|tamoil|telepass|atm|taxi|uber', categoryId: 'trasporti' }
  ],
  periods: [],
  accounts: [],
  liabilities: [],
  recurringRules: [],
  transactions: [],
  categories: [
    { id: 'alimentari', name: 'Alimentari', group: 'variable' },
    { id: 'ristorazione', name: 'Ristorazione', group: 'variable' },
    { id: 'trasporti', name: 'Trasporti', group: 'variable' },
    { id: 'abbigliamento', name: 'Abbigliamento', group: 'variable' },
    { id: 'intrattenimento', name: 'Intrattenimento', group: 'variable' },
    { id: 'salute', name: 'Salute', group: 'variable' },
    { id: 'varie', name: 'Varie', group: 'variable' },
    { id: 'straordinario', name: 'Straordinario', group: 'variable' },
  ],
  goals: [],
  auditLog: [],
};

const initialData = import.meta.env.VITE_IS_DEMO === 'true' ? demoData : emptyData;

// ─── UTILITY: AUDIT LOG ──────────────────────────────────────────────────────
function appendAudit(log, action, details = {}) {
  const safeLog = Array.isArray(log) ? log : [];
  const newEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    action,
    details,
    timestamp: Date.now(),
  };
  const updated = [...safeLog, newEntry];
  return updated.length > 200 ? updated.slice(updated.length - 200) : updated;
}

// Utility: calcola target minimo di risparmio tenendo conto dei goals (GAP-C03)
function calcMinSavingsTarget(settings, goals = []) {
  const goalsMonthlyTarget = (goals ?? [])
    .filter(g => g.status !== 'completed' && (g.targetAmount || 0) > 0 && g.deadline)
    .reduce((sum, g) => {
      const targetDate = g.deadline.length === 7 ? parse(g.deadline + '-01', 'yyyy-MM-dd', new Date()) : parse(g.deadline, 'yyyy-MM-dd', new Date());
      const monthsLeft = Math.max(1, Math.ceil((targetDate - new Date()) / (1000 * 60 * 60 * 24 * 30)));
      return sum + Math.max(0, ((g.targetAmount || 0) - (g.currentAmount || 0)) / monthsLeft);
    }, 0);

  return Math.max(Number(settings.targetSavingsAmount || 0), Math.ceil(goalsMonthlyTarget));
}

// ─── FUNZIONE PURA: GENERA TRANSAZIONI FISSI PIANIFICATI ────────────────────
// Estratta da registerSalaryAndStartCycle per essere riutilizzata da PeriodClose.
// FIX 1.1 + FIX 2.7 (dayOfMonth edge case per mesi corti e febbraio)
export function generatePlannedFixedCosts(periodId, startDateObj, recurringRules) {
  const planned = [];
  const ts = Date.now();

  recurringRules.forEach(rule => {
    const isValid =
      (!rule.startDate || periodId >= rule.startDate) &&
      (!rule.endDate || periodId <= rule.endDate);
    if (!isValid) return;

    const year = startDateObj.getFullYear();
    const month = startDateObj.getMonth();

    // FIX 2.7: cap dayOfMonth al numero reale di giorni del mese corrente
    const daysInCurrentMonth = getDaysInMonth(new Date(year, month));
    const safeDay = Math.min(rule.dayOfMonth, daysInCurrentMonth);

    let txDateObj = new Date(year, month, safeDay);

    // Se il giorno (cappato) è già passato rispetto alla data stipendio → mese successivo
    if (safeDay < startDateObj.getDate()) {
      const nextMonth = addMonths(txDateObj, 1);
      const daysInNextMonth = getDaysInMonth(nextMonth);
      const safeDayNext = Math.min(rule.dayOfMonth, daysInNextMonth);
      txDateObj = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), safeDayNext);
    }

    planned.push({
      id: `tx_${ts}_${Math.random().toString(36).slice(2)}_${rule.id}`,
      date: format(txDateObj, 'yyyy-MM-dd'),
      periodId,
      accountId: 'acc_main',
      type: rule.type,
      nature: 'fixed',
      status: 'planned',
      amount: rule.amount,
      description: rule.name,
      categoryId: rule.id.replace('rule_', ''),
      createdAt: ts,
    });
  });

  return planned;
}

// ─── UTILITY: PARSE AMOUNT SAFE (supporta virgola europea) ──────────────────
function parseSafeAmount(raw) {
  if (typeof raw === 'number') return raw;
  const normalized = String(raw).replace(',', '.');
  return parseFloat(normalized);
}

// Helper centralizzato per trasferimenti verso account di tipo 'investments' (apply/revert)
function applyInvestmentTransfer(accounts, tx, direction = 'apply') {
  // direction: 'apply' to credit investments, 'revert' to undo credit
  const amt = Number(tx.amount) || 0;
  if (amt === 0) return accounts;

  const investmentAccount = accounts.find(a => a.type === 'investments') || accounts.find(a => a.type === 'savings');
  if (!investmentAccount) return accounts;

  return accounts.map(acc => {
    if (acc.id === tx.accountId && tx.status === 'paid') {
      // source account: expense/investment reduces balance when applying, increases when reverting
      const delta = (tx.type === 'investment') ? (direction === 'apply' ? -amt : amt) : 0;
      return { ...acc, currentBalance: acc.currentBalance + delta };
    }
    if (acc.id === investmentAccount.id && tx.status === 'paid') {
      // destination: investments account increased when applying, decreased when reverting
      const delta = (tx.type === 'investment') ? (direction === 'apply' ? amt : -amt) : 0;
      return { ...acc, currentBalance: acc.currentBalance + delta };
    }
    return acc;
  });
}

// ─── UTILITY: PULISCI PATTERN REGEX SPORCHI ──────────────────────────────────
// Rimuove la sintassi Python (?i) dai pattern vecchi memorizzati nel browser
function sanitizeCategorizationRules(rules) {
  if (!Array.isArray(rules)) return [];
  return rules.map(rule => {
    let pattern = String(rule.pattern);
    // Rimuovi il prefisso (?i) che è sintassi Python/PCRE non valida in JavaScript
    pattern = pattern.replace(/^\(\?i\)/, '');
    // Se rimane una sola coppia di parentesi esterne, rimuovile (e.g. "(esselunga|coop)" → "esselunga|coop")
    pattern = pattern.replace(/^\((.+)\)$/, '$1');
    return { ...rule, pattern };
  }).filter(r => r.pattern && r.pattern.length > 0);
}

// ─── UTILITY: EXPORT JSON (safety net prima del reset) ──────────────────────
export function exportStateAsJSON(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `private-cfo-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── STORE ──────────────────────────────────────────────────────────────────
export const useFinanceStore = create(
  persist(
    (set, get) => ({
      data: initialData,

      setData: (newData) =>
        set({ data: typeof newData === 'function' ? newData(get().data) : newData }),

      updateSettings: (updates) =>
        set(state => ({ data: { ...state.data, settings: { ...state.data.settings, ...updates } } })),

      updatePensionConfig: (updates) =>
        set(state => ({
          data: {
            ...state.data,
            settings: {
              ...state.data.settings,
              pensionConfig: {
                ...state.data.settings.pensionConfig,
                ...updates
              }
            }
          }
        })),

      updatePeriod: (id, updates) =>
        set(state => ({
          data: {
            ...state.data,
            periods: state.data.periods.map(p => p.id === id ? { ...p, ...updates } : p),
          },
        })),

      addPeriod: (period) =>
        set(state => ({ data: { ...state.data, periods: [...state.data.periods, period] } })),

      // ── CRUD CONTI ───────────────────────────────────────────────────────
      addAccount: (account) => set(state => ({
        data: {
          ...state.data,
          accounts: [
            ...state.data.accounts,
            {
              ...account,
              id: `acc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              currentBalance: Number(account.currentBalance) || 0,
              createdAt: Date.now(),
            }
          ],
          auditLog: appendAudit(state.data.auditLog, 'ADD_ACCOUNT', { name: account.name })
        }
      })),

      deleteAccount: (accountId) => set(state => {
        const hasLinkedTx = state.data.transactions.some(t => t.accountId === accountId);
        if (hasLinkedTx) throw new Error('Impossibile eliminare: il conto ha transazioni collegate.');
        return {
          data: {
            ...state.data,
            accounts: state.data.accounts.filter(a => a.id !== accountId),
            auditLog: appendAudit(state.data.auditLog, 'DEL_ACCOUNT', { accountId })
          }
        };
      }),

      addLiability: (liability) => set(state => ({
        data: {
          ...state.data,
          liabilities: [...(state.data.liabilities || []), {
            ...liability,
            id: `liab_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            createdAt: Date.now(),
          }],
          auditLog: appendAudit(state.data.auditLog, 'ADD_LIABILITY', { name: liability.name })
        }
      })),

      updateLiability: (id, updates) => set(state => ({
        data: {
          ...state.data,
          liabilities: (state.data.liabilities || []).map(l => l.id === id ? { ...l, ...updates } : l)
        }
      })),

      deleteLiability: (id) => set(state => ({
        data: {
          ...state.data,
          liabilities: (state.data.liabilities || []).filter(l => l.id !== id),
          auditLog: appendAudit(state.data.auditLog, 'DEL_LIABILITY', { id })
        }
      })),

      updateAccount: (accountId, updates) => set(state => ({
        data: {
          ...state.data,
          accounts: state.data.accounts.map(a =>
            a.id === accountId ? { ...a, ...updates } : a
          ),
          auditLog: appendAudit(state.data.auditLog, 'UPD_ACCOUNT', { accountId })
        }
      })),

      // ── AGGIUNGI TRANSAZIONE ─────────────────────────────────────────────
      // FIX 2.2: validazione NaN + supporto virgola europea
      addTransaction: (tx) =>
        set(state => {
          const safeAmount = parseSafeAmount(tx.amount);
          if (isNaN(safeAmount) || safeAmount <= 0) {
            console.warn('[addTransaction] importo non valido, operazione rifiutata:', tx.amount);
            return state;
          }

          const newTx = {
            ...tx,
            amount: safeAmount,
            id: `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            createdAt: Date.now(),
          };

          // apply source delta and investment routing via centralized helper
          let updatedAccounts = state.data.accounts.map(acc => {
            if (acc.id !== newTx.accountId || newTx.status !== 'paid') return acc;
            const delta = (newTx.type === 'expense') ? -newTx.amount : newTx.amount;
            return { ...acc, currentBalance: acc.currentBalance + delta };
          });

          if (newTx.type === 'investment' && newTx.status === 'paid') {
            updatedAccounts = applyInvestmentTransfer(updatedAccounts, newTx, 'apply');
          }

          return {
            data: {
              ...state.data,
              transactions: [...state.data.transactions, newTx],
              accounts: updatedAccounts,
              auditLog: appendAudit(state.data.auditLog, 'ADD_TRANSACTION', {
                txId: newTx.id, description: newTx.description, amount: newTx.amount,
              }),
            },
          };
        }),

      // ── ELIMINA TRANSAZIONE ──────────────────────────────────────────────
      deleteTransaction: (transactionId) =>
        set(state => {
          const tx = state.data.transactions.find(t => t.id === transactionId);
          if (!tx) return state;

          let updatedAccounts = state.data.accounts;
          // Se era paid, revertiamo il saldo
          if (tx.status === 'paid') {
            updatedAccounts = state.data.accounts.map(acc => {
              if (acc.id !== tx.accountId) return acc;
              const delta = (tx.type === 'expense') ? tx.amount : -tx.amount;
              return { ...acc, currentBalance: acc.currentBalance + delta };
            });

            // use centralized helper to revert investment credit if applicable
            if (tx.type === 'investment') {
              updatedAccounts = applyInvestmentTransfer(updatedAccounts, tx, 'revert');
            }
          }

          return {
            data: {
              ...state.data,
              transactions: state.data.transactions.filter(t => t.id !== transactionId),
              accounts: updatedAccounts,
              auditLog: appendAudit(state.data.auditLog, 'DELETE_TRANSACTION', { txId: transactionId }),
            },
          };
        }),

      // ── MARCA COSTO FISSO COME PAGATO ────────────────────────────────────
      markFixedCostAsPaid: (transactionId) =>
        set(state => {
          const tx = state.data.transactions.find(t => t.id === transactionId);
          if (!tx || tx.status === 'paid') return state;

          const updatedTransactions = state.data.transactions.map(t =>
            t.id === transactionId ? { ...t, status: 'paid', paidAt: Date.now() } : t
          );
          let updatedAccounts = state.data.accounts.map(acc => {
            if (acc.id !== tx.accountId) return acc;
            const delta = (tx.type === 'expense') ? -tx.amount : tx.amount;
            return { ...acc, currentBalance: acc.currentBalance + delta };
          });

          if (tx.type === 'investment') {
            updatedAccounts = applyInvestmentTransfer(updatedAccounts, tx, 'apply');
          }

          return {
            data: {
              ...state.data,
              transactions: updatedTransactions,
              accounts: updatedAccounts,
              auditLog: appendAudit(state.data.auditLog, 'MARK_FIXED_PAID', {
                txId: transactionId, description: tx.description, amount: tx.amount,
              }),
            },
          };
        }),

      // ── ANNULLA MARCA COSTO FISSO COME PAGATO (FIX 1.4) ──────────────────
      unmarkFixedCostAsPaid: (transactionId) =>
        set(state => {
          const tx = state.data.transactions.find(t => t.id === transactionId);
          if (!tx || tx.status !== 'paid') return state;

          const updatedTransactions = state.data.transactions.map(t =>
            t.id === transactionId ? { ...t, status: 'planned', paidAt: null } : t
          );
          let updatedAccounts = state.data.accounts.map(acc => {
            if (acc.id !== tx.accountId) return acc;
            const delta = (tx.type === 'expense') ? tx.amount : -tx.amount;
            return { ...acc, currentBalance: acc.currentBalance + delta };
          });

          if (tx.type === 'investment') {
            updatedAccounts = applyInvestmentTransfer(updatedAccounts, tx, 'revert');
          }

          return {
            data: {
              ...state.data,
              transactions: updatedTransactions,
              accounts: updatedAccounts,
              auditLog: appendAudit(state.data.auditLog, 'UNMARK_FIXED_PAID', {
                txId: transactionId, description: tx.description, amount: tx.amount,
              }),
            },
          };
        }),

      // ── REGISTRA STIPENDIO E AVVIA CICLO ─────────────────────────────────
      // FIX 1.3: NON cancelliamo più la storia. Le tx dei cicli chiusi restano.
      // FIX 2.7: usa generatePlannedFixedCosts con fix dayOfMonth
      // FIX 3.8: guard su periodId duplicato
      registerSalaryAndStartCycle: ({ amount, dateStr, bankBalance, isExtraordinaryIncome, openingInvestments }) =>
        set(state => {
          const { periods, recurringRules, transactions, settings } = state.data;

          const startDateObj = parse(dateStr, 'dd/MM/yyyy', new Date());
          if (isNaN(startDateObj.getTime())) {
            console.warn('[registerSalaryAndStartCycle] data non valida:', dateStr);
            return state;
          }

          const startDate = format(startDateObj, 'yyyy-MM-dd');
          const endDate = format(addMonths(startDateObj, 1), 'yyyy-MM-dd');
          const periodId = format(startDateObj, 'yyyy-MM');

          // Guard: if an open period with same id already exists, abort to avoid duplicate open periods
          if (state.data.periods.some(p => p.id === periodId && p.status === 'open')) {
            console.warn('[registerSalaryAndStartCycle] periodo già aperto:', periodId);
            return state;
          }

          // FIX 3.8: rimuove eventuale periodo duplicato con stesso id (es. correzione data)
          const filteredPeriods = periods.filter(p => p.id !== periodId);
          // Chiudi tutti i periodi precedenti
          const updatedPeriods = filteredPeriods.map(p => ({ ...p, status: 'closed' }));

          const minSavings = calcMinSavingsTarget(settings, state.data.goals); // [GAP-C03]
          updatedPeriods.push({
            id: periodId,
            type: 'fiscal',
            startDate,
            endDate,
            status: 'open',
            openingBalance: Number(bankBalance),
            targetClosingBalance: Number(bankBalance) + Number(minSavings),
            openingInvestments: parseFloat(openingInvestments) || 0,  // ← aggiunta
          });
          // Crea/aggiorna conto principale
          const existingMain = state.data.accounts.find(a => a.id === 'acc_main');
          const updatedAccounts = existingMain
            ? state.data.accounts.map(a =>
              a.id === 'acc_main' ? { ...a, currentBalance: Number(bankBalance) } : a
            )
            : [{ id: 'acc_main', name: 'Conto Corrente', type: 'operating_liquidity', currentBalance: Number(bankBalance) }];

          // Transazione stipendio
          const ts = Date.now();
          const salaryTx = {
            id: `tx_${ts}_salary`,
            date: startDate,
            periodId,
            accountId: 'acc_main',
            type: 'income',
            nature: 'fixed',
            status: 'paid',
            amount: Number(amount),
            description: 'Accredito Stipendio',
            categoryId: 'stipendio',
            isExtraordinaryIncome: Boolean(isExtraordinaryIncome),
            createdAt: ts,
          };

          // Ensure salary not duplicated in same period (single source of truth)
          const salaryExists = transactions.some(t => t.periodId === periodId && t.type === 'income' && t.categoryId === 'stipendio');

          // FIX 1.1 + 2.7: usa la funzione estratta
          const plannedTxs = generatePlannedFixedCosts(periodId, startDateObj, recurringRules);

          // FIX 1.3: NON filtrare le tx storiche — le manteniamo tutte.
          // Le tx dei cicli closed non entrano nei calcoli perché FinanceContext filtra per periodId.
          // Rimuoviamo solo le planned del ciclo corrente se esistono (correzione registrazione)
          const keptTransactions = transactions.filter(t => t.periodId !== periodId);

          return {
            data: {
              ...state.data,
              settings: { ...settings, activePeriodId: periodId },
              periods: updatedPeriods,
              accounts: updatedAccounts,
              transactions: salaryExists ? [...keptTransactions, ...plannedTxs] : [...keptTransactions, salaryTx, ...plannedTxs],
              auditLog: appendAudit(state.data.auditLog, 'REGISTER_SALARY', {
                periodId, amount: Number(amount), bankBalance: Number(bankBalance), startDate,
              }),
            },
          };
        }),

      // ── CHIUDI CICLO CON GENERAZIONE FISSI (FIX 1.1) ───────────────────
      // Versione sicura di PeriodClose: genera i planned del nuovo ciclo.
      closePeriodAndOpenNext: ({ realBankBalance, salaryAmount, discrepancy, isExtraordinaryIncome, accountUpdates = {}, realInvestmentsBalance = 0 }) =>
        set(state => {
          const { data } = state;
          const activePeriod = data.periods.find(p => p.id === data.settings.activePeriodId);
          if (!activePeriod) return state;

          const currentStart = activePeriod?.startDate ? new Date(activePeriod.startDate + 'T00:00:00') : new Date();
          const nextStartObj = addMonths(currentStart, 1);
          const nextStart = format(nextStartObj, 'yyyy-MM-dd');
          const nextEnd = activePeriod?.endDate
            ? format(addMonths(new Date(activePeriod.endDate + 'T00:00:00'), 1), 'yyyy-MM-dd')
            : format(addMonths(new Date(), 1), 'yyyy-MM-dd');
          const nextPeriodId = format(nextStartObj, 'yyyy-MM');

          const updatedPeriods = data.periods.map(p =>
            p.id === activePeriod.id ? { ...p, status: 'closed' } : p
          );
          const minSavingsNext = calcMinSavingsTarget(data.settings, data.goals); // [GAP-C03]
          updatedPeriods.push({
            id: nextPeriodId,
            type: 'fiscal',
            startDate: nextStart,
            endDate: nextEnd,
            status: 'open',
            openingBalance: Number(realBankBalance),
            targetClosingBalance: Number(realBankBalance) + Number(minSavingsNext), openingInvestments: parseFloat(realInvestmentsBalance) || 0,
          });

          // Aggiorna saldo conto con valore reale (realBankBalance è fonte di verità)
          // If accountUpdates provided, verify coherence with realBankBalance for acc_main.
          const tolerance = data.settings?.reconciliationTolerance ?? 10;
          if (accountUpdates && accountUpdates['acc_main'] !== undefined) {
            const provided = Number(accountUpdates['acc_main']);
            if (Math.abs(provided - Number(realBankBalance)) > tolerance) {
              console.warn('[closePeriodAndOpenNext] incoerenza saldo acc_main rispetto a realBankBalance:', provided, realBankBalance);
              return state; // block closure due to incoherent account updates
            }
          }

          let updatedAccounts = data.accounts.map(a =>
            a.id === 'acc_main' ? { ...a, currentBalance: Number(realBankBalance) } : a
          );

          // If accountUpdates passed in args, apply them (GAP-S03 support) but do not overwrite acc_main with incoherent value
          if (accountUpdates && Object.keys(accountUpdates).length > 0) {
            updatedAccounts = updatedAccounts.map(a =>
              a.id === 'acc_main'
                ? { ...a, currentBalance: Number(realBankBalance) }
                : (accountUpdates[a.id] !== undefined
                  ? { ...a, currentBalance: Number(accountUpdates[a.id]) }
                  : a)
            );
          }

          // Stipendio del nuovo ciclo e rettifica ciclo corrente
          const ts = Date.now();
          const newTxs = [];

          // GAP-F09: Riconciliazione bancaria
          if (discrepancy && Math.abs(discrepancy) > (data.settings?.reconciliationTolerance ?? 10)) {
            newTxs.push({
              id: `tx_${ts}_rectification`,
              date: activePeriod.endDate || format(new Date(), 'yyyy-MM-dd'),
              periodId: activePeriod.id,
              accountId: 'acc_main',
              type: discrepancy > 0 ? 'income' : 'expense',
              nature: 'variable',
              status: 'paid',
              amount: Math.abs(discrepancy),
              description: 'Rettifica Riconciliazione Bancaria',
              categoryId: 'varie',
              createdAt: ts,
            });
          }

          if (salaryAmount && Number(salaryAmount) > 0) {
            newTxs.push({
              id: `tx_${ts}_salary_next`,
              date: nextStart,
              periodId: nextPeriodId,
              accountId: 'acc_main',
              type: 'income',
              nature: 'fixed',
              status: 'paid',
              amount: Number(salaryAmount),
              description: 'Accredito Stipendio',
              categoryId: 'stipendio',
              isExtraordinaryIncome: Boolean(isExtraordinaryIncome),
              createdAt: ts,
            });
          }

          // FIX 1.1: genera i costi fissi planned per il nuovo ciclo
          const plannedTxs = generatePlannedFixedCosts(nextPeriodId, nextStartObj, data.recurringRules);

          return {
            data: {
              ...data,
              settings: { ...data.settings, activePeriodId: nextPeriodId },
              periods: updatedPeriods,
              accounts: updatedAccounts,
              transactions: [...data.transactions, ...newTxs, ...plannedTxs],
              auditLog: appendAudit(data.auditLog, 'CLOSE_PERIOD', {
                closedPeriodId: activePeriod.id, nextPeriodId, realBankBalance,
              }),
            },
          };
        }),

      // ── GOALS CRUD ───────────────────────────────────────────────────────
      addGoal: (goal) =>
        set(state => ({
          data: {
            ...state.data,
            goals: [...state.data.goals, {
              ...goal,
              id: `goal_${Date.now()}`,
              currentAmount: goal.currentAmount || 0,
              earmarkedAccountId: goal.earmarkedAccountId || null,
            }],
          },
        })),

      updateGoal: (id, updates) =>
        set(state => ({
          data: {
            ...state.data,
            goals: state.data.goals.map(g => g.id === id ? { ...g, ...updates } : g),
          },
        })),

      deleteGoal: (id) =>
        set(state => ({
          data: {
            ...state.data,
            goals: state.data.goals.filter(g => g.id !== id),
          },
        })),

      // ── EARMARK GOAL ON ACCOUNT (GAP-S04) ──────────────────────────────
      assignGoalToAccount: (goalId, accountId) =>
        set(state => {
          const goal = state.data.goals.find(g => g.id === goalId);
          const account = state.data.accounts.find(a => a.id === accountId);
          if (!goal || !account) return state;

          // G-13: solo collegamento logico, nessuno spostamento di saldo
          const updatedGoals = state.data.goals.map(g =>
            g.id === goalId ? { ...g, earmarkedAccountId: accountId } : g
          );

          return {
            data: {
              ...state.data,
              goals: updatedGoals,
              auditLog: appendAudit(state.data.auditLog, 'ASSIGN_GOAL_ACCOUNT', { goalId, accountId }),
            },
          };
        }),

      unassignGoalFromAccount: (goalId) =>
        set(state => {
          const goal = state.data.goals.find(g => g.id === goalId);
          if (!goal) return state;

          // G-13: rimozione semplice del collegamento
          const updatedGoals = state.data.goals.map(g =>
            g.id === goalId ? { ...g, earmarkedAccountId: null } : g
          );

          return {
            data: {
              ...state.data,
              goals: updatedGoals,
              auditLog: appendAudit(state.data.auditLog, 'UNASSIGN_GOAL_ACCOUNT', { goalId }),
            },
          };
        }),

      // ── RIMUOVI REGOLA RICORRENTE (migrazione PAC) ───────────────────────
      purgeRecurringRule: (ruleId) =>
        set(state => ({
          data: {
            ...state.data,
            recurringRules: (state.data.recurringRules || []).filter(r => r.id !== ruleId),
            // Rimuovi anche le transazioni PLANNED generate da questa regola nel ciclo attivo
            transactions: state.data.transactions.filter(t =>
              !(t.status === 'planned' && t.categoryId === ruleId.replace('rule_', ''))
            ),
            auditLog: appendAudit(state.data.auditLog, 'DELETE_RECURRING_RULE', { ruleId }),
          },
        })),
        
      // Alias per coerenza UI
      deleteRecurringRule: (ruleId) => get().purgeRecurringRule(ruleId),

      // ── AGGIUNGI REGOLA RICORRENTE ─────────────────────────────────────────
      addRecurringRule: (rule) =>
        set(state => {
          const { data } = state;
          const newRule = { ...rule, id: `rule_${Date.now()}` };
          const updatedRules = [...(data.recurringRules || []), newRule];
          
          let newTransactions = [];
          const activePeriod = data.periods.find(p => p.id === data.settings.activePeriodId);
          if (activePeriod) {
            const startDateObj = parse(activePeriod.startDate, 'yyyy-MM-dd', new Date());
            // Genera la transazione pianificata SOLO per questa nuova regola, se valida per il ciclo in corso
            newTransactions = generatePlannedFixedCosts(activePeriod.id, startDateObj, [newRule]);
          }

          return {
            data: {
              ...data,
              recurringRules: updatedRules,
              transactions: [...data.transactions, ...newTransactions],
              auditLog: appendAudit(data.auditLog, 'ADD_RECURRING_RULE', { ruleName: rule.name }),
            },
          };
        }),

      // ── AGGIORNA REGOLA RICORRENTE ─────────────────────────────────────────
      updateRecurringRule: (ruleId, updates) =>
        set(state => {
          const { data } = state;
          const updatedRules = (data.recurringRules || []).map(r => r.id === ruleId ? { ...r, ...updates } : r);
          
          // Aggiorna ANCHE le transazioni PLANNED per questa regola nel ciclo attivo
          const updatedTransactions = data.transactions.map(t => {
            if (t.status === 'planned' && t.categoryId === ruleId.replace('rule_', '')) {
              return { 
                ...t, 
                amount: updates.amount !== undefined ? Number(updates.amount) : t.amount,
                description: updates.name || t.description
              };
            }
            return t;
          });

          return {
            data: {
              ...data,
              recurringRules: updatedRules,
              transactions: updatedTransactions,
              auditLog: appendAudit(data.auditLog, 'UPDATE_RECURRING_RULE', { ruleId }),
            },
          };
        }),

      // ── RICONCILIA SALDO CONTO OPERATIVO ─────────────────────────────────
      // Ricalcola il saldo reale di acc_main partendo dall'openingBalance del ciclo attivo.
      // IMPORTANTE: openingBalance già include lo stipendio, quindi aggiungiamo solo le entrate extra.
      reconcileOperatingAccount: () =>
        set(state => {
          const { data } = state;
          const activePeriod = data.periods.find(p => p.id === data.settings.activePeriodId);
          if (!activePeriod) return state;

          const opening = activePeriod.openingBalance ?? 0;
          
          // FIX CRITICO: openingBalance già include lo stipendio.
          // Aggiungiamo solo le entrate EXTRA (non-stipendio) e sottraiamo le spese.
          const paidTx = data.transactions.filter(t => t.periodId === activePeriod.id && t.status === 'paid');
          
          const extraIncome = paidTx
            .filter(t => t.type === 'income' && t.categoryId !== 'stipendio')
            .reduce((s, t) => s + t.amount, 0);
          
          const paidExpenses = paidTx
            .filter(t => t.type === 'expense')
            .reduce((s, t) => s + t.amount, 0);
          
          const correctBalance = opening + extraIncome - paidExpenses;

          const mainAccount = data.accounts.find(a => a.type === 'operating_liquidity')
            || data.accounts.find(a => a.id === 'acc_main');
          if (!mainAccount) return state;

          return {
            data: {
              ...data,
              accounts: data.accounts.map(a =>
                a.id === mainAccount.id ? { ...a, currentBalance: correctBalance } : a
              ),
              auditLog: appendAudit(data.auditLog, 'RECONCILE_ACCOUNT', {
                accountId: mainAccount.id, opening, extraIncome, paidExpenses, correctBalance,
              }),
            },
          };
        }),

      // ── RESET CON EXPORT PREVENTIVO (FIX 1.4) ────────────────────────────
      // NON chiamare direttamente: usare il componente Settings che fa l'export prima.
      resetToDefaults: () => {
        exportStateAsJSON(get().data); // FIX 1.4: backup automatico prima del reset
        set(() => ({ data: initialData }));
      },

      // Azioni speciali per Login/Logout su Vercel (Mantengono le credenziali personalizzate)
      resetToEmpty: () => {
        const { authEmail, authPassword } = get().data.settings;
        set(() => ({ 
          data: { 
            ...emptyData, 
            settings: { ...emptyData.settings, authEmail, authPassword } 
          } 
        }));
      },

      resetToDemo: () => {
        const { authEmail, authPassword } = get().data.settings;
        set(() => ({ 
          data: { 
            ...demoData, 
            settings: { ...demoData.settings, authEmail, authPassword } 
          } 
        }));
      },



      // ── BANK IMPORT LOGIC ──
      learnCategorizationRule: (keyword, categoryId) => {
        set((state) => {
          const rules = state.data.categorizationRules || [];
          const ruleExists = rules.some(r => r.pattern.toLowerCase() === keyword.toLowerCase());
          if (ruleExists) return state;
          
          return {
            data: {
              ...state.data,
              categorizationRules: [
                ...rules,
                  { pattern: keyword, categoryId }
              ]
            }
          };
        });
      },

      importTransactions: (transactionsToImport) => {
        set((state) => {
          const currentTx = state.data.transactions || [];
          const existingHashes = new Set(
            currentTx.map(t => `${t.date}_${t.amount}_${(t.description || '').toLowerCase().trim()}`)
          );

          let importedCount = 0;
          const newTx = [];

          transactionsToImport.forEach(incoming => {
            const hash = `${incoming.date}_${incoming.amount}_${(incoming.description || '').toLowerCase().trim()}`;
            if (!existingHashes.has(hash)) {
              newTx.push({
                id: `tx_imported_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                ...incoming,
                createdAt: Date.now()
              });
              existingHashes.add(hash);
              importedCount++;
            }
          });

          if (newTx.length === 0) return state;

          let updatedAccounts = state.data.accounts;
          newTx.forEach(tx => {
            updatedAccounts = updatedAccounts.map(acc => {
              if (acc.id !== tx.accountId || tx.status !== 'paid') return acc;
              const delta = (tx.type === 'expense') ? -tx.amount : tx.amount;
              return { ...acc, currentBalance: acc.currentBalance + delta };
            });
            if (tx.type === 'investment') {
              updatedAccounts = applyInvestmentTransfer(updatedAccounts, tx, 'apply');
            }
          });

          return {
            data: {
              ...state.data,
              transactions: [...currentTx, ...newTx],
              accounts: updatedAccounts
            }
          };
        });
      },


    }),
    {
      name: import.meta.env.VITE_IS_DEMO === 'true' ? 'private-cfo-demo' : 'private-cfo-clean',
      storage: createJSONStorage(() => import.meta.env.VITE_IS_DEMO === 'true' ? sessionStorage : idbStorage),
      onRehydrateStorage: () => (state, error) => {
        if (state && state.data && state.data.categorizationRules) {
          state.data.categorizationRules = sanitizeCategorizationRules(state.data.categorizationRules);
        }
      },
    }
  )
);
