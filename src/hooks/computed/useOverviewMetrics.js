import { useMemo } from 'react';
import { differenceInDays, startOfDay, addDays, format, parseISO } from 'date-fns';

// Parsing helpers (P2-9)
function parsePeriodMonth(val) {
  // val expected 'yyyy-MM'
  try {
    const [y, m] = String(val).split('-').map(Number);
    if (!y || !m) return null;
    return new Date(y, m - 1, 1);
  } catch (_) { return null; }
}

function parseDayDate(val) {
  // Accepts 'yyyy-MM-dd' or 'yyyy-MM' fallback to first day of month
  if (!val) return null;
  if (/^\d{4}-\d{2}$/.test(val)) return parsePeriodMonth(val);
  // safe ISO parse for full dates
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

import { useFinanceStore } from '../../store/useFinanceStore';
import { useShallow } from 'zustand/react/shallow';

export function useOverviewMetrics() {
  const settings = useFinanceStore(useShallow(state => state.data.settings || {}));
  const periods = useFinanceStore(useShallow(state => state.data.periods || []));
  const accounts = useFinanceStore(useShallow(state => state.data.accounts || []));
  const transactions = useFinanceStore(useShallow(state => state.data.transactions || []));
  const storeLiabilities = useFinanceStore(useShallow(state => state.data.liabilities || []));
  const recurringRules = useFinanceStore(useShallow(state => state.data.recurringRules || []));
  const goals = useFinanceStore(useShallow(state => state.data.goals || []));
  const categories = useFinanceStore(useShallow(state => state.data.categories || []));

  return useMemo(() => {
    if (!settings) return {};
    // AUDIT REAL CODE: useFinanceComputed contains implementations for many GAPs.
    // - isPeriodOverrun implemented [GAP-C06]
    // - cashDragAnnuo uses settings.expectedReturnRate [GAP-F05]
    // - proiezioneAnnualeRisparmio present [GAP-C02]
    // - safetyBufferConsigliato includes investmentMonthlyPlanned [GAP-C05]
    // - investment P&L fields added (investmentContributions, investmentNetChange, investmentPLPercent) [GAP-K03]
    const today = startOfDay(new Date());

    // â”€â”€ PERIODO ATTIVO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // FIX 2.6: rimosso fallback || periods[0] â€” se non trovato â†’ EmptyState
    const activePeriod = periods.find(p => p.id === settings.activePeriodId);
    if (!activePeriod) return {};

    const parsedStart = parseDayDate(activePeriod?.startDate);
    const parsedEnd = parseDayDate(activePeriod?.endDate);
    const startDate = parsedStart || today;
    const endDate = parsedEnd || today;

    // FIX 1.3: le tx storiche (periodi closed) restano in DB ma le escludiamo dai calcoli
    // filtrando solo per periodId del ciclo attivo.
    const periodTx = transactions.filter(t => t.periodId === activePeriod.id);
    const paidPeriodTx = periodTx.filter(t => t.status === 'paid');
    const plannedPeriodTx = periodTx.filter(t => t.status === 'planned');

    // â”€â”€ PATRIMONIALE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let operatingLiquidity = 0;
    let restrictedSavings = 0;
    let investments = 0;
    // Include explicit liabilities stored in `data.liabilities` and accounts of type 'liability'
    const liabilitiesFromAccounts = accounts.filter(a => a.type === 'liability').reduce((s, a) => s + (a.currentBalance ?? a.balance ?? 0), 0);
    const totalLiabilities = storeLiabilities.reduce((s, l) => s + (l.principal || 0), 0) + liabilitiesFromAccounts;
    const totalMonthlyDebtService = storeLiabilities.reduce((s, l) => s + (l.monthlyPayment || 0), 0);

    accounts.forEach(acc => {
      const bal = acc.currentBalance ?? acc.balance ?? 0;
      if (acc.type === 'operating_liquidity') operatingLiquidity += bal;
      if (acc.type === 'savings') restrictedSavings += bal;
      if (acc.type === 'investments') investments += bal;
    });

    const totalAssets = operatingLiquidity + restrictedSavings + investments;
    const netWorth = totalAssets - totalLiabilities; // FIX F01


    // â”€â”€ ACTUAL (giÃ  pagati nel ciclo) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const incomeActual = paidPeriodTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const fixedExpensesActual = paidPeriodTx.filter(t => t.nature === 'fixed' && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const investmentActual = paidPeriodTx.filter(t => t.type === 'investment').reduce((s, t) => s + t.amount, 0);
    const variableExpensesActual = paidPeriodTx.filter(t => t.type === 'expense' && t.nature === 'variable').reduce((s, t) => s + t.amount, 0);
    const extraordinaryExpensesActual = paidPeriodTx.filter(t => t.nature === 'extraordinary').reduce((s, t) => s + t.amount, 0);

    // investmentActual is a patrimonial transfer (asset movement) and must NOT be treated
    // as an operational expense that reduces cash-flow KPIs. Keep it separate.
    const totalExpensesActual = fixedExpensesActual + variableExpensesActual + extraordinaryExpensesActual;

    // â”€â”€ LOGICA NETTO COSTI FISSI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // FIX F02: Escludi type === 'investment' dalle uscite fisse che erodono il saldo operativo ai fini dei costi
    const usciteFissePianificateResidue = plannedPeriodTx
      .filter(t => t.nature === 'fixed' && t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);

    const investimentiPianificatiResidui = plannedPeriodTx
      .filter(t => t.nature === 'fixed' && t.type === 'investment')
      .reduce((s, t) => s + t.amount, 0);

    // --- Recurring income expected (GAP-S01)
    const recurringIncomeExpected = plannedPeriodTx
      .filter(t => t.nature === 'fixed' && t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);

    // FIX F02: Anche i costi totali ciclo escludono gli investimenti
    const costiFissiTotaliCiclo = fixedExpensesActual + usciteFissePianificateResidue;

    // â”€â”€ SPENDIBILE GIORNALIERO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let giorniMancantiAlProssimoAccredito = differenceInDays(endDate, today);
    if (giorniMancantiAlProssimoAccredito < 0) giorniMancantiAlProssimoAccredito = 0;
    const isPeriodOverrun = differenceInDays(today, endDate) > 0;

    // Sottraiamo anche gli investimenti residui perché comunque escono dal conto corrente
    // FIX: se lo stipendio non è ancora stato registrato come "paid", incomeActual = 0.
    // In quel caso usiamo defaultIncome come stima prudente per non mostrare €0/giorno.
    const incomeBase = incomeActual > 0 ? incomeActual : (settings.defaultIncome ?? 0);
    const costiFissiTotaliCicloCompleto = usciteFissePianificateResidue + fixedExpensesActual;
    const investimentiTotaliCiclo = investimentiPianificatiResidui + investmentActual;
    const redditoNettoCiclo = incomeBase - costiFissiTotaliCicloCompleto - investimentiTotaliCiclo;
    const liquiditaDisponibileScudo = Math.max(0, redditoNettoCiclo - settings.safetyBuffer - variableExpensesActual);
    const divisoreGiorni = giorniMancantiAlProssimoAccredito <= 0 ? 1 : giorniMancantiAlProssimoAccredito;
    const spendibileGiornalieroFinoAlProssimoStipendio = isPeriodOverrun ? 0 : (liquiditaDisponibileScudo / divisoreGiorni);

    // â”€â”€ FORECAST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const totalDaysInPeriod = differenceInDays(endDate, startDate) || 30;
    const daysElapsed = Math.max(2, differenceInDays(today, startDate) + 1);

    const spesaMediaGiornalieraVariabileAttuale = variableExpensesActual / daysElapsed;

    // FIX 8.2: proiezioneVariabileBase fix
    // Richiediamo almeno 7 giorni per avere un run-rate minimamente stabile,
    // altrimenti singole spese lumpy nei primi 3 giorni sballano la proiezione mensile.
    const proiezioneAffidabile = daysElapsed >= 7;
    const proiezioneVariabileBase = proiezioneAffidabile
      ? variableExpensesActual + (spesaMediaGiornalieraVariabileAttuale * giorniMancantiAlProssimoAccredito)
      : null; // null = non mostrare

    // FIX 1.6: scenari forecast centralizzati qui (non nei componenti)
    const opening = activePeriod.openingBalance ?? 0;
    // FIX 8.4: Forecast Stress scenario fix
    const catNecessarieSt = ['alimentari', 'salute', 'trasporti'];
    const variabiliNecessarie = paidPeriodTx
      .filter(t => t.nature === 'variable' && catNecessarieSt.includes(t.categoryId))
      .reduce((s, t) => s + t.amount, 0);
    const variabiliDiscrezionali = variableExpensesActual - variabiliNecessarie;

    const daysElapsedSafe = Math.max(1, daysElapsed);
    const burnNecessario = (variabiliNecessarie / daysElapsedSafe) * totalDaysInPeriod;
    const burnDiscrezionale = (variabiliDiscrezionali / daysElapsedSafe) * totalDaysInPeriod;

    const proiezioneStress = burnNecessario + (burnDiscrezionale * 1.3);
    const proiezionePrudente = burnNecessario + (burnDiscrezionale * 0.8);

    // --- SAVINGS HEALTH MONITOR (Moved up for Forecast) ---
    const savingsTargetBuffer = settings.safetyBuffer ?? 0;
    const projectedClosingForHealth = operatingLiquidity - usciteFissePianificateResidue - investimentiPianificatiResidui;
    const unboundedLiquidity = redditoNettoCiclo - savingsTargetBuffer - variableExpensesActual;
    const targetClosingMin = projectedClosingForHealth - unboundedLiquidity;

    // FIX FORECAST: Usa la logica basata sulla liquidità operativa reale (come Savings Health Monitor)
    const targetChiusura = targetClosingMin;
    const saldoBaseChiusura = proiezioneAffidabile
      ? projectedClosingForHealth - (proiezioneVariabileBase - variableExpensesActual)
      : null;

    const scenariForecast = proiezioneAffidabile ? [
      { name: 'Prudente (-20% discrezionali)', saldo: projectedClosingForHealth - (proiezionePrudente - variableExpensesActual), color: 'var(--status-green)' },
      { name: 'Base (Attuale)', saldo: saldoBaseChiusura, color: 'var(--chart-primary)' },
      { name: 'Stress (+30% discrezionali)', saldo: projectedClosingForHealth - (proiezioneStress - variableExpensesActual), color: 'var(--status-red)' },
    ] : [];

    const gapTarget = saldoBaseChiusura !== null ? saldoBaseChiusura - targetChiusura : null;
    const isOffTrack = gapTarget !== null && gapTarget < 0;

    const carryOver = targetClosingMin - savingsTargetBuffer;
    const erosionMargin = unboundedLiquidity;
    const isSavingsEroding = erosionMargin < 0;
    const savingsHealthStatus =
      erosionMargin >= savingsTargetBuffer * 0.5 ? 'safe' :   // margine > 50% del buffer
        erosionMargin >= 0 ? 'at_risk' :                         // stretto ma positivo
          'eroding';                                               // già sotto il target
    // Quanti euro extra posso ancora spendere senza erodere il buffer?
    // FIX: Se erosionMargin è positivo, posso spendere erosionMargin in totale (o diviso per i giorni).
    // Se è negativo, ho overspending.
    const savingsMarginDailyExtra = giorniMancantiAlProssimoAccredito > 0
      ? erosionMargin / giorniMancantiAlProssimoAccredito
      : null;

    // --- PHASE 3: Extraordinary Income ---
    const extraordinaryIncome = paidPeriodTx
      .filter(t => t.type === 'income' && t.isExtraordinaryIncome)
      .reduce((s, t) => s + t.amount, 0);

    const ordinaryIncome = incomeActual - extraordinaryIncome;

    // Savings Rate: usa costiFissiTotaliCiclo (paid + planned) per non gonfiare il tasso
    // a inizio ciclo quando le spese fisse devono ancora essere pagate.
    // fixedExpensesActual (solo paid) causava 94% al giorno 2 invece del reale ~68%.
    const savingsRateOrdinary = ordinaryIncome > 0
      ? ((ordinaryIncome - costiFissiTotaliCiclo - variableExpensesActual) / ordinaryIncome) * 100
      : 0;

    const savingsRateTotal = ordinaryIncome > 0
      ? ((ordinaryIncome - costiFissiTotaliCiclo - variableExpensesActual) / ordinaryIncome) * 100
      : 0;

    const hasExtraordinaryIncome = extraordinaryIncome > 0;

    // --- NUOVI KPI AGGIUNTI ---
    const totalIncome = incomeActual;
    // FIX: usa costiFissiTotaliCiclo (paid + planned) — non solo fixedExpensesActual (paid)
    const totalExpenses = variableExpensesActual + costiFissiTotaliCiclo;
    const savingsRate = totalIncome > 0
      ? ((totalIncome - totalExpenses) / totalIncome) * 100
      : 0;

    const fixedCostCoverage = costiFissiTotaliCiclo > 0
      ? totalIncome / costiFissiTotaliCiclo
      : 0;

    const totalSavings = goals ? goals.reduce((s, g) => s + (g.currentAmount || 0), 0) : 0;
    const variableCategories = categories.filter(c => c.group === 'variable');
    const budgetVariabileTotale = variableCategories.reduce((sum, cat) =>
      sum + (settings.categoryBudgets?.[cat.id] || 0), 0);

    // Usa il budget per calcolare le stime a lungo termine, evitando sbalzi nei primi giorni.
    const stimaVariabileMensile = budgetVariabileTotale > 0 
      ? budgetVariabileTotale 
      : (variableExpensesActual / Math.max(15, daysElapsed)) * 30;

    const spesaMensileMedia = stimaVariabileMensile + costiFissiTotaliCiclo;
    // PHASE 9 KPI: Emergency Fund Ratio -> (operatingLiquidity + savings + investments) / spesaMensileMedia
    const emergencyFundRatio = spesaMensileMedia > 0
      ? (operatingLiquidity + restrictedSavings + investments) / spesaMensileMedia
      : 0;

    // Debt-to-Income Ratio
    const debtToIncomeRatio = incomeActual > 0
      ? (totalMonthlyDebtService / incomeActual) * 100
      : 0;

    // ---------------------------
    const savingsRateTarget = settings.defaultIncome > 0 ? (settings.targetSavingsAmount / settings.defaultIncome) * 100 : 0;
    const fixedCostCoverageRatio = fixedCostCoverage;

    // F04: Burn Rate Necessario vs Discrezionale
    const catNecessarie = ['alimentari', 'salute', 'trasporti'];
    const catDiscrezionali = ['ristorazione', 'abbigliamento', 'intrattenimento', 'varie', 'straordinario'];

    const spesaNecessariaActual = paidPeriodTx
      .filter(t => t.type === 'expense' && t.nature === 'variable' && catNecessarie.includes(t.categoryId))
      .reduce((s, t) => s + t.amount, 0);
    const spesaDiscrezionaleActual = paidPeriodTx
      .filter(t => t.type === 'expense' && t.nature === 'variable' && catDiscrezionali.includes(t.categoryId))
      .reduce((s, t) => s + t.amount, 0);

    const burnRateNecessario = spesaNecessariaActual / daysElapsed;
    const burnRateDiscrezionale = spesaDiscrezionaleActual / daysElapsed;
    let giorniRimanenti = Math.max(1, differenceInDays(endDate, today));
    const burnRateMinimale = burnRateNecessario + (usciteFissePianificateResidue / giorniRimanenti);

    // F05: Debt Service (placeholder, richiede espansione data model liabilities)
    const debtService = paidPeriodTx.filter(t => t.type === 'liability_payment').reduce((s, t) => s + t.amount, 0);
    const redditoDisponibileNetto = incomeActual - costiFissiTotaliCiclo - debtService;

    // F08: Ratios
    const ratioFissiSuReddito = incomeActual > 0 ? (costiFissiTotaliCiclo / incomeActual) * 100 : 0;
    const ciboActual = paidPeriodTx.filter(t => t.categoryId === 'alimentari' || t.categoryId === 'ristorazione').reduce((s, t) => s + t.amount, 0);
    const ratioCiboSuReddito = incomeActual > 0 ? (ciboActual / incomeActual) * 100 : 0;

    // Efficienza Intra-Ciclo
    // budgetVariabileTotale calcolato sopra per spesaMensileMedia
    const totalActualVariable = variableExpensesActual;
    const efficienzaBudget = budgetVariabileTotale > 0
      ? Math.round(((budgetVariabileTotale - totalActualVariable) / budgetVariabileTotale) * 100)
      : null; // null if no budgets set

    const pacingRatio = (budgetVariabileTotale > 0 && totalDaysInPeriod > 0)
      ? (variableExpensesActual / budgetVariabileTotale) / (daysElapsed / totalDaysInPeriod)
      : 1;

    // --- PHASE 4: Safety Buffer Intelligente ---
    const spesaFissaMensileMedia = costiFissiTotaliCiclo;
    // PAC rimosso da totalMonthlyObligations (è accumulo, non obbligazione)
    const bufferByObligations = spesaFissaMensileMedia * 3;
    const bufferByIncome = ((settings.defaultIncome ?? 0) * 12) * 0.20;
    const safetyBufferConsigliato = Math.min(bufferByObligations, bufferByIncome);
    const safetyBufferAdeguato = (settings.safetyBuffer ?? 0) >= safetyBufferConsigliato * 0.8;

    // --- PHASE 5: Proiezione Annuale (Round-2 GAP-C02) ---
    // La stima del risparmio del ciclo corrente basata sul Base scenario (che usa operatingLiquidity).
    // Usiamo targetClosingMin - savingsTargetBuffer come baseline del risparmio target, 
    // e vi aggiungiamo l'eventuale extra buffer.
    const risparmioStimaCicloCorrente = Math.max(0, (saldoBaseChiusura ?? targetClosingMin) - targetClosingMin + carryOver);

    // Weighted historic average over up to 6 closed periods (more weight to recent)
    const recentClosed = periods.filter(p => p.id !== activePeriod.id && p.status === 'closed').slice(-6);
    let proiezioneAnnualeRisparmio;
    if (recentClosed.length >= 2) {
      const datiStorici = recentClosed.map((p, idx) => {
        const pTx = transactions.filter(t => t.periodId === p.id && t.status === 'paid');
        const pOrdInc = pTx.filter(t => t.type === 'income' && !t.isExtraordinaryIncome).reduce((s, t) => s + t.amount, 0);
        const pExp = pTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        return { risparmio: Math.max(0, pOrdInc - pExp), peso: idx + 1 };
      });
      const totalPeso = datiStorici.reduce((s, r) => s + r.peso, 0) || 1;
      const mediaRisparmio = datiStorici.reduce((s, r) => s + r.risparmio * r.peso, 0) / totalPeso;
      proiezioneAnnualeRisparmio = mediaRisparmio * 12;
    } else {
      proiezioneAnnualeRisparmio = risparmioStimaCicloCorrente * 12;
    }

    const goalsMonthlyTarget = goals
      ? goals
        .filter(g => g.deadline && g.currentAmount < g.targetAmount)
        .reduce((sum, g) => {
          const targetDate = g.deadline ? (g.deadline.length === 7 ? parseISO(g.deadline + '-01') : parseISO(g.deadline)) : today;
          const monthsLeft = Math.max(1, differenceInDays(targetDate, today) / 30);
          return sum + (g.targetAmount - g.currentAmount) / monthsLeft;
        }, 0)
      : 0;

    const proiezioneVsObiettiviGap = proiezioneAnnualeRisparmio / 12 - goalsMonthlyTarget;
    const inLineaConObiettivi = proiezioneVsObiettiviGap >= 0;

    const risparmioNettoMensile = Math.max(0, risparmioStimaCicloCorrente) / totalDaysInPeriod * 30;
    const goalFundingRate = goalsMonthlyTarget > 0
      ? Math.min(100, (risparmioNettoMensile / goalsMonthlyTarget) * 100)
      : 100;

    // --- PHASE 6: Alert Regole in Scadenza ---
    const ALERT_DAYS_BEFORE_EXPIRY = 30;
    const regolaInScadenza = recurringRules
      .filter(rule => {
        if (!rule.endDate) return false;
        const endDateObj = rule.endDate ? parseISO(rule.endDate + '-01') : today; // endDate is 'yyyy-MM'
        const daysToExpiry = differenceInDays(endDateObj, today);
        return daysToExpiry >= 0 && daysToExpiry <= ALERT_DAYS_BEFORE_EXPIRY;
      })
      .map(rule => ({
        name: rule.name,
        amount: rule.amount,
        endDate: rule.endDate,
        daysLeft: rule.endDate ? differenceInDays(parseISO(rule.endDate + '-01'), today) : null,
      }));
    const hasRegolaInScadenza = regolaInScadenza.length > 0;

    // --- PHASE 7: Inflazione Budget ---
    const budgetsLastUpdated = settings.budgetsLastUpdated
      ? parseISO(settings.budgetsLastUpdated)
      : null;
    const budgetStaleMonths = budgetsLastUpdated
      ? differenceInDays(today, budgetsLastUpdated) / 30
      : 999;
    const budgetStale = budgetStaleMonths > 6;

    const currentRatio = usciteFissePianificateResidue > 0
      ? (operatingLiquidity - settings.safetyBuffer) / usciteFissePianificateResidue
      : 999;

    const dailyBreakeven = costiFissiTotaliCiclo / totalDaysInPeriod;

    // Wealth Building

    // --- STORICO E WEALTH ACCUMULATION ---
    const closedPeriods = periods
      .filter(p => p.id !== activePeriod.id)
      .sort((a, b) => a.endDate.localeCompare(b.endDate)) // ← crescente: più vecchi prima
      .slice(-6); // ← ultimi 6 = più recenti
    let storicoSavingsRate = 0;
    if (closedPeriods.length > 0) {
      const historicalRates = closedPeriods.map(p => {
        const pTx = transactions.filter(t => t.periodId === p.id && t.status === 'paid');
        const pInc = pTx.filter(t => t.type === 'income' && !t.isExtraordinaryIncome).reduce((s, t) => s + t.amount, 0); // [GAP-C04] exclude extraordinary
        const pExp = pTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        return pInc > 0 ? ((pInc - pExp) / pInc) * 100 : 0;
      });
      const totalPeso = historicalRates.reduce((s, _, idx) => s + (idx + 1), 0) || 1;
      storicoSavingsRate = historicalRates.reduce((s, r, idx) => s + r * (idx + 1), 0) / totalPeso;
    }
    const wealthAccumulationRate = incomeActual > 0 ? (investmentActual / incomeActual) * 100 : 0;
    const mesiDiAutonomia = spesaMensileMedia > 0 ? (operatingLiquidity + restrictedSavings + investments) / spesaMensileMedia : 0;

    const expectedReturnRate = Number(settings.expectedReturnRate ?? 3.5) / 100;
    const cashDragAnnuo = Math.max(0, operatingLiquidity - (settings.safetyBuffer ?? 0)) * expectedReturnRate;

    // --- G2: MoM Net Worth Growth ---
    // prevNetWorth = openingBalance + openingInvestments del periodo closed più recente + immobili (invariati)
    // Usiamo closedPeriods già calcolato sopra (ordinato ASC, slice -6 → l'ultimo è il più recente)
    const realEstateValue = accounts
      .filter(a => a.type === 'real_estate')
      .reduce((s, a) => s + (a.currentBalance ?? a.balance ?? 0), 0);
    let momNetWorthGrowth = null; // null = nessun ciclo precedente disponibile
    if (closedPeriods.length > 0) {
      const lastClosed = closedPeriods[closedPeriods.length - 1];
      const prevNetWorth = (lastClosed.openingBalance ?? 0) + (lastClosed.openingInvestments ?? 0) + realEstateValue;
      if (prevNetWorth > 0) {
        momNetWorthGrowth = ((netWorth - prevNetWorth) / prevNetWorth) * 100;
      }
    }

    // --- G5: FIRE Number & Progress ---
    // CORREZIONE family officer: investmentActual è accumulo patrimoniale, NON spesa operativa.
    // annualExpenses usa solo spese effettive (fissi + variabili), non il PAC.
    // FIX: Usa media storica pesata degli ultimi 6 cicli chiusi per stabilità
    let fireAnnualExpenses;
    if (recentClosed.length >= 2) {
      const datiStoriciSpese = recentClosed.map((p, idx) => {
        const pTx = transactions.filter(t => t.periodId === p.id && t.status === 'paid');
        const pFixedExp = pTx.filter(t => t.type === 'expense' && t.nature === 'fixed').reduce((s, t) => s + t.amount, 0);
        const pVarExp = pTx.filter(t => t.type === 'expense' && t.nature === 'variable').reduce((s, t) => s + t.amount, 0);
        return { spesaTotale: pFixedExp + pVarExp, peso: idx + 1 };
      });
      const totalPesoSpese = datiStoriciSpese.reduce((s, r) => s + r.peso, 0) || 1;
      const mediaSpesamensile = datiStoriciSpese.reduce((s, r) => s + r.spesaTotale * r.peso, 0) / totalPesoSpese;
      fireAnnualExpenses = mediaSpesamensile * 12;
    } else {
      // Fallback: usa ciclo corrente se non ci sono dati storici
      fireAnnualExpenses = (costiFissiTotaliCiclo + variableExpensesActual) * 12;
    }
    const fireNumber = fireAnnualExpenses > 0 ? fireAnnualExpenses * 25 : null; // Regola del 4% (SWR)
    const fireProgress = (fireNumber !== null && fireNumber > 0 && investments > 0)
      ? Math.min(100, (investments / fireNumber) * 100)
      : 0;
    // yearsToFire: formula CAGR con contribuzione mensile costante (più realistica del semplice log)
    // PV*(1+r)^n + PMT*((1+r)^n - 1)/r = FV  →  risolto iterativamente in modo chiuso
    // Semplificazione: usa log(FV/PV)/log(1+r) quando investmentActual=0, altrimenti stima analitica
    let yearsToFire = null;
    if (fireNumber !== null && fireNumber > 0 && expectedReturnRate > 0) {
      if (investments >= fireNumber) {
        yearsToFire = 0;
      } else if (investments > 0) {
        const monthlyContrib = investmentActual > 0 ? investmentActual : 0;
        if (monthlyContrib > 0) {
          // FV = PV*(1+r)^n + PMT*((1+r)^n - 1)/r  → stima numerica con max 600 iterazioni (50 anni)
          const monthlyRate = expectedReturnRate / 12;
          let bal = investments;
          let months = 0;
          while (bal < fireNumber && months < 600) {
            bal = bal * (1 + monthlyRate) + monthlyContrib;
            months++;
          }
          yearsToFire = months < 600 ? months / 12 : null;
        } else {
          // Nessuna contribuzione: crescita solo da rendimento
          yearsToFire = Math.log(fireNumber / investments) / Math.log(1 + expectedReturnRate);
        }
      }
    }

    // FIX 1.2: Simulazione CashControl corretta (no double counting)
    // Partiamo da operatingLiquidity grezzo, sottraiamo:
    //   - gli spike fissi nei giorni in cui cadono (from plannedPeriodTx)
    //   - il burn variabile giornaliero reale (spesaMedia, non spendibile)
    const daysToSalary = Math.max(1, differenceInDays(endDate, today) + 1);
    const dailyVariableBurn = Math.max(0, spesaMediaGiornalieraVariabileAttuale);

    // FIX 3.10: soglia spike parametrica (10% della liquiditÃ  disponibile o min 50â‚¬)
    const spikeThreshold = Math.max(50, liquiditaDisponibileScudo * 0.1);

    let simulatedBalance = operatingLiquidity;
    const bridgeData = [];
    const stressDays = [];
    let giorniCritici = 0; // F06: Cash Conversion Cycle

    // FIX: include TUTTE le tx pianificate (fissi + variabili + straordinarie).
    // Così anche i costi variabili significativi (es. 120€ pianificati) compaiono
    // come addebiti rilevanti nel CashControl e vengono simulati nel grafico.
    const plannedSpikeTx = plannedPeriodTx; // fixed + variable + extraordinary

    for (let i = 0; i < daysToSalary; i++) {
      const currentSimDay = addDays(today, i);
      const dayStr = format(currentSimDay, 'dd/MM');

      // Tutti gli addebiti pianificati che cadono in questo giorno (fissi E variabili)
      let spikesTotal = 0;
      const spikeNames = [];
      plannedSpikeTx.forEach(tx => {
        try {
          const txDate = tx.date ? (parseDayDate(tx.date) || today) : today;
          if (
            txDate.getDate() === currentSimDay.getDate() &&
            txDate.getMonth() === currentSimDay.getMonth()
          ) {
            spikesTotal += tx.amount;
            spikeNames.push(tx.description);
          }
        } catch (_) { /* ignora date malformate */ }
      });

      simulatedBalance -= (dailyVariableBurn + spikesTotal);

      if (simulatedBalance < settings.safetyBuffer) {
        giorniCritici++; // F06
      }

      if (spikesTotal > spikeThreshold) {
        stressDays.push({ date: dayStr, amount: spikesTotal, names: spikeNames.join(', ') });
      }

      bridgeData.push({
        date: dayStr,
        Saldo: Number(simulatedBalance.toFixed(2)),
      });
    }

    const finalBridgeBalance = bridgeData.length > 0 ? bridgeData[bridgeData.length - 1].Saldo : 0;

    // --- GAP-K04: Liquidity Ratio completo ---
    // Current Ratio: (operatingLiquidity + restrictedSavings) / current liabilities (uscite fisse residue)
    // Nota: questi ratio misurano la copertura dei soli fissi residui.
    const liquidityCurrentRatio = usciteFissePianificateResidue > 0
      ? (operatingLiquidity + restrictedSavings) / usciteFissePianificateResidue
      : Infinity;

    // Quick Ratio: exclude restricted savings
    const liquidityQuickRatio = usciteFissePianificateResidue > 0
      ? operatingLiquidity / usciteFissePianificateResidue
      : Infinity;

    // --- New KPI: obligationsCoverageRatio ---
    // Include: uscite fisse residue + mensilità debiti + investimenti pianificati residui
    const totalObligations = (usciteFissePianificateResidue || 0) + (totalMonthlyDebtService || 0) + (investimentiPianificatiResidui || 0);
    const obligationsCoverageRatio = totalObligations > 0
      ? (operatingLiquidity + restrictedSavings + investments) / totalObligations
      : Infinity;

    // Liquid Coverage Days: days the liquidity covers fixed + variable run-rate
    // FIX: spesaMensileMedia include già i costi fissi. Evitiamo il double counting.
    const dailyObligations = spesaMensileMedia / 30;
    const liquidityCoverageDays = dailyObligations > 0 ? (operatingLiquidity + restrictedSavings + investments) / dailyObligations : Infinity;

    // --- GAP-K05: Expense Ratio per categoria ---
    const expenseByCategory = paidPeriodTx.reduce((map, t) => {
      if (t.type !== 'expense') return map;
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
      return map;
    }, {});
    const expenseRatioByCategory = {};
    Object.keys(expenseByCategory).forEach(catId => {
      expenseRatioByCategory[catId] = incomeActual > 0 ? (expenseByCategory[catId] / incomeActual) * 100 : 0;
    });

    // --- GAP-K06: True Savings Rate ---
    // True Savings Rate = (Net Worth change + savings contributions - extraordinary flows) / income
    const previousNetWorth = (activePeriod.openingBalance ?? 0) + (activePeriod.openingInvestments ?? 0);
    const netWorthChange = netWorth - previousNetWorth;
    const savingsContributions = paidPeriodTx.filter(t => t.type === 'investment').reduce((s, t) => s + t.amount, 0);
    const extraordinaryFlows = extraordinaryExpensesActual + extraordinaryIncome;
    const trueSavingsRate = incomeActual > 0 ? ((netWorthChange + savingsContributions - extraordinaryFlows) / incomeActual) * 100 : 0;

    // --- GAP-K07: Income Concentration Index ---
    // Share of top 3 income sources by amount as percent of total income
    const incomeSources = paidPeriodTx.filter(t => t.type === 'income').reduce((map, t) => {
      const src = t.source || 'unspecified';
      map[src] = (map[src] || 0) + t.amount;
      return map;
    }, {});
    const sortedIncomeShares = Object.values(incomeSources).sort((a, b) => b - a);
    const top3Sum = sortedIncomeShares.slice(0, 3).reduce((s, v) => s + v, 0);
    const incomeConcentrationIndex = incomeActual > 0 ? (top3Sum / incomeActual) * 100 : 0;

    // --- GAP-S02: Inflazione nei budget + suggerimento adegua ---
    // Calcolo semplice: se budgetsLastUpdated > 12 mesi, suggerire adeguamento per tasso inflazione impostato
    const inflationRate = settings.assumedInflationRate ?? 0.03; // 3% default
    const suggestBudgetAdjustment = budgetStaleMonths > 12;
    const adjustedBudgetPreview = suggestBudgetAdjustment ?
      Object.fromEntries(Object.entries(settings.categoryBudgets || {}).map(([k, v]) => [k, Math.round(v * (1 + inflationRate))]))
      : null;

    // --- GAP-S05: Validazione openingBalance vs teorico ---
    // teoricOpening = sum(accounts balances at start of period derived from transactions) fallback: activePeriod.openingBalance
    const theoreticOpening = accounts ? accounts.reduce((s, a) => s + (a.openingBalance ?? a.balance ?? 0), 0) : (activePeriod.openingBalance ?? opening);
    const openingBalanceValid = Math.abs((activePeriod.openingBalance ?? opening) - theoreticOpening) <= (settings.reconciliationTolerance ?? 10);

    // --- GAP-K03: P&L portafoglio investimenti ---
    // investmentContributions: totale versato/investito nel periodo (planned + paid)
    const investmentContributions = periodTx
      .filter(t => t.type === 'investment' && (t.status === 'paid' || t.status === 'planned'))
      .reduce((s, t) => s + t.amount, 0);

    // investmentWithdrawals: tentativo di inferire prelievi dal tipo 'withdrawal' o 'investment_withdrawal'
    const investmentWithdrawals = periodTx
      .filter(t => (t.type === 'investment_withdrawal' || t.subtype === 'withdrawal' || t.type === 'withdrawal') && t.status === 'paid')
      .reduce((s, t) => s + t.amount, 0);

    // openingInvestments: opportunistico campo del periodo (se presente nel modello dati)
    const openingInvestments = activePeriod.openingInvestments ?? 0;

    // investmentNetChange: variazione netta del valore del portafoglio rispetto all'apertura del periodo
    const investmentNetChange = investments - openingInvestments - (investmentContributions - investmentWithdrawals);

    // P1-6: make investment P&L robust — compute only if there is a dedicated investments account
    const hasInvestmentsAccount = accounts.some(a => a.type === 'investments');
    let investmentPLPercent = null;
    if (hasInvestmentsAccount && (openingInvestments + (investmentContributions - investmentWithdrawals)) > 0) {
      investmentPLPercent = (investmentNetChange / (openingInvestments + (investmentContributions - investmentWithdrawals))) * 100;
    }
    return {
      activePeriod,
      // Patrimoniale
      operatingLiquidity,
      restrictedSavings,
      investments,
      liabilities: totalLiabilities,
      totalMonthlyDebtService,
      debtToIncomeRatio,
      totalAssets,
      netWorth,
      risparmioNettoMensile,
      goalsMonthlyTarget,
      goalFundingRate,
      // Actual
      incomeActual,
      fixedExpensesActual,
      investmentActual,
      variableExpensesActual,
      extraordinaryExpensesActual,
      totalExpensesActual,
      // Fissi pianificati
      usciteFissePianificateResidue,
      costiFissiTotaliCiclo,
      // KPI primario
      liquiditaDisponibileScudo,
      spendibileGiornalieroFinoAlProssimoStipendio,
      giorniMancantiAlProssimoAccredito,
      // Tempo
      totalDaysInPeriod,
      daysElapsed,
      // Forecast (FIX 1.6 â€” centralizzato)
      spesaMediaGiornalieraVariabileAttuale,
      proiezioneVariabileBase,
      proiezioneAffidabile,
      scenariForecast,
      targetChiusura,
      saldoBaseChiusura,
      gapTarget,
      isPeriodOverrun,
      isOffTrack,
      // CFO KPIs
      savingsRate,
      savingsRateTarget,
      fixedCostCoverage,
      fixedCostCoverageRatio,
      burnRateNecessario,
      burnRateDiscrezionale,
      burnRateMinimale,
      redditoDisponibileNetto,
      ratioFissiSuReddito,
      ratioCiboSuReddito,
      emergencyFundRatio,
      pacingRatio,
      currentRatio,
      dailyBreakeven,
      cashDragAnnuo,
      giorniCritici,

      // New KPIs Export
      extraordinaryIncome,
      ordinaryIncome,
      savingsRateOrdinary,
      savingsRateTotal,
      hasExtraordinaryIncome,
      safetyBufferConsigliato,
      safetyBufferAdeguato,
      proiezioneAnnualeRisparmio,
      investmentContributions,
      investmentWithdrawals,
      investmentNetChange,
      investmentPLPercent,
      // Additional exports added to match documentation
      adjustedBudgetPreview,
      openingBalanceValid,
      trueSavingsRate,
      incomeConcentrationIndex,
      liquidityCurrentRatio,
      liquidityQuickRatio,
      liquidityCoverageDays,
      obligationsCoverageRatio,
      expenseRatioByCategory,
      recurringIncomeExpected,
      goalsMonthlyTarget,
      goalFundingRate,
      risparmioNettoMensile,
      proiezioneVsObiettiviGap,
      inLineaConObiettivi,
      regolaInScadenza,
      hasRegolaInScadenza,
      budgetStale,
      budgetStaleMonths,
      efficienzaBudget,
      storicoSavingsRate,
      wealthAccumulationRate,
      mesiDiAutonomia,
      // G2: MoM Net Worth
      momNetWorthGrowth,
      // G5: FIRE
      fireNumber,
      fireProgress,
      yearsToFire,
      fireAnnualExpenses,
      // Savings Health Monitor
      savingsHealthStatus,
      erosionMargin,
      targetClosingMin,
      carryOver,
      savingsMarginDailyExtra,
      isSavingsEroding,
      savingsTargetBuffer,

      // CashControl simulation (FIX 1.2 â€” centralizzato)
      bridgeData,
      stressDays,
      daysToSalary,
      finalBridgeBalance,
      spikeThreshold,
      // Transazioni
      periodTx,
      paidPeriodTx,
      plannedPeriodTx,
    };
  }, [settings, periods, accounts, transactions, storeLiabilities, recurringRules, goals, categories]);
}
