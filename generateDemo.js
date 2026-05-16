import fs from 'fs';
import { format, subMonths } from 'date-fns';

const baseData = {
  settings: {
    currency: 'EUR',
    activePeriodId: '2026-05',
    defaultIncome: 2500,
    safetyBuffer: 500,
    expectedReturnRate: 4.0,
    theme: 'dark',
    assumedInflationRate: 0.03,
    reconciliationTolerance: 10,
    categoryBudgets: {
      alimentari: 400,
      ristorazione: 200,
      trasporti: 150,
      intrattenimento: 100,
      varie: 100
    },
    targetSavingsAmount: 500,
    budgetsLastUpdated: '2026-05-01T00:00:00.000Z',
    githubToken: '',
    gistId: '',
    lastSync: null
  },
  accounts: [
    { id: 'acc_main', name: 'Conto Corrente Principale', type: 'operating_liquidity', currentBalance: 3500.50 },
    { id: 'acc_invest', name: 'Portafoglio ETF', type: 'investments', currentBalance: 15400 }
  ],
  liabilities: [],
  recurringRules: [
    { id: 'rule_affitto', name: 'Affitto Casa', dayOfMonth: 5, amount: 800, type: 'expense', startDate: null, endDate: null },
    { id: 'rule_bollette', name: 'Bolletta Luce/Gas', dayOfMonth: 15, amount: 120, type: 'expense', startDate: null, endDate: null },
    { id: 'rule_netflix', name: 'Abbonamento Netflix', dayOfMonth: 20, amount: 13.99, type: 'expense', startDate: null, endDate: null }
  ],
  categories: [
    { id: 'affitto', name: 'Affitto', group: 'fixed' },
    { id: 'bollette', name: 'Bollette', group: 'fixed' },
    { id: 'netflix', name: 'Netflix', group: 'fixed' },
    { id: 'alimentari', name: 'Alimentari', group: 'variable' },
    { id: 'ristorazione', name: 'Ristorazione', group: 'variable' },
    { id: 'trasporti', name: 'Trasporti', group: 'variable' },
    { id: 'intrattenimento', name: 'Intrattenimento', group: 'variable' },
    { id: 'varie', name: 'Varie', group: 'variable' }
  ],
  goals: [
    { id: 'goal_demo1', name: 'Fondo Emergenza', targetAmount: 10000, currentAmount: 8500, deadline: '2026-12', color: '#3b82f6', icon: 'PiggyBank' },
    { id: 'goal_demo2', name: 'Vacanza Giappone', targetAmount: 3000, currentAmount: 1200, deadline: '2027-04', color: '#10b981', icon: 'Plane' }
  ],
  auditLog: []
};

const periods = [];
const transactions = [];

let currentBalance = 3200;
let currentInvestments = 15000;

// Current open month (2026-05)
periods.push({
  id: '2026-05',
  type: 'fiscal',
  startDate: '2026-05-01',
  endDate: '2026-06-01',
  status: 'open',
  openingBalance: currentBalance,
  targetClosingBalance: currentBalance + 500,
  openingInvestments: currentInvestments
});

// Transactions for open month
transactions.push(
  { id: 'tx_demo_salary_05', date: '2026-05-01', periodId: '2026-05', accountId: 'acc_main', type: 'income', nature: 'fixed', status: 'paid', amount: 2500, description: 'Stipendio Mensile', categoryId: 'stipendio', isExtraordinaryIncome: false, createdAt: Date.now() },
  { id: 'tx_demo_affitto_05', date: '2026-05-05', periodId: '2026-05', accountId: 'acc_main', type: 'expense', nature: 'fixed', status: 'paid', amount: 800, description: 'Affitto Casa', categoryId: 'affitto', createdAt: Date.now() },
  { id: 'tx_demo_spesa1_05', date: '2026-05-02', periodId: '2026-05', accountId: 'acc_main', type: 'expense', nature: 'variable', status: 'paid', amount: 145.50, description: 'Spesa Esselunga', categoryId: 'alimentari', createdAt: Date.now() },
  { id: 'tx_demo_cena_05', date: '2026-05-08', periodId: '2026-05', accountId: 'acc_main', type: 'expense', nature: 'variable', status: 'paid', amount: 65, description: 'Cena Pizzeria', categoryId: 'ristorazione', createdAt: Date.now() },
  { id: 'tx_demo_bollette_05', date: '2026-05-15', periodId: '2026-05', accountId: 'acc_main', type: 'expense', nature: 'fixed', status: 'planned', amount: 120, description: 'Bolletta Luce/Gas', categoryId: 'bollette', createdAt: Date.now() },
  { id: 'tx_demo_netflix_05', date: '2026-05-20', periodId: '2026-05', accountId: 'acc_main', type: 'expense', nature: 'fixed', status: 'planned', amount: 13.99, description: 'Abbonamento Netflix', categoryId: 'netflix', createdAt: Date.now() },
  { id: 'tx_demo_invest_05', date: '2026-05-06', periodId: '2026-05', accountId: 'acc_invest', type: 'investment', nature: 'variable', status: 'paid', amount: 400, description: 'Acquisto ETF', categoryId: 'varie', createdAt: Date.now() }
);

// We need 13 CLOSED months, so back from 2026-04 to 2025-04.
// Let's go backwards and build them so that balances make sense.
let loopBalance = currentBalance;
let loopInvest = currentInvestments;

const baseDate = new Date('2026-05-01');

for (let i = 1; i <= 13; i++) {
  const d = subMonths(baseDate, i);
  const nextD = subMonths(baseDate, i - 1);
  const periodId = format(d, 'yyyy-MM');
  const startDateStr = format(d, 'yyyy-MM-dd');
  const endDateStr = format(nextD, 'yyyy-MM-dd');

  // Roughly, each month the user saved 500, so previous month's opening was 500 less
  const prevOpening = loopBalance - 400; 
  const prevInvest = loopInvest - 400;

  periods.push({
    id: periodId,
    type: 'fiscal',
    startDate: startDateStr,
    endDate: endDateStr,
    status: 'closed',
    openingBalance: prevOpening,
    targetClosingBalance: loopBalance,
    openingInvestments: prevInvest
  });

  // Some random variation for historical authenticity
  const foodVar = 300 + Math.floor(Math.random() * 150);
  const restVar = 100 + Math.floor(Math.random() * 150);

  transactions.push(
    { id: `tx_sal_${periodId}`, date: `${periodId}-01`, periodId, accountId: 'acc_main', type: 'income', nature: 'fixed', status: 'paid', amount: 2500, description: 'Stipendio', categoryId: 'stipendio', isExtraordinaryIncome: false, createdAt: Date.now() },
    { id: `tx_aff_${periodId}`, date: `${periodId}-05`, periodId, accountId: 'acc_main', type: 'expense', nature: 'fixed', status: 'paid', amount: 800, description: 'Affitto Casa', categoryId: 'affitto', createdAt: Date.now() },
    { id: `tx_bol_${periodId}`, date: `${periodId}-10`, periodId, accountId: 'acc_main', type: 'expense', nature: 'fixed', status: 'paid', amount: 120, description: 'Bollette', categoryId: 'bollette', createdAt: Date.now() },
    { id: `tx_food_${periodId}`, date: `${periodId}-15`, periodId, accountId: 'acc_main', type: 'expense', nature: 'variable', status: 'paid', amount: foodVar, description: 'Spesa Alimentari', categoryId: 'alimentari', createdAt: Date.now() },
    { id: `tx_rest_${periodId}`, date: `${periodId}-20`, periodId, accountId: 'acc_main', type: 'expense', nature: 'variable', status: 'paid', amount: restVar, description: 'Ristoranti', categoryId: 'ristorazione', createdAt: Date.now() },
    { id: `tx_inv_${periodId}`, date: `${periodId}-25`, periodId, accountId: 'acc_invest', type: 'investment', nature: 'variable', status: 'paid', amount: 400, description: 'Acquisto ETF', categoryId: 'varie', createdAt: Date.now() }
  );

  loopBalance = prevOpening;
  loopInvest = prevInvest;
}

const finalObj = { ...baseData, periods, transactions };

const fileContent = `export const demoData = ${JSON.stringify(finalObj, null, 2)};\n`;

fs.writeFileSync('./src/lib/demoData.js', fileContent);
console.log('Successfully generated 13 months of demo data.');
