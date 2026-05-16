# Copia del codice richiesto

Questo documento contiene il contenuto dei file richiesti, copiati integralmente dal repository.

---

## src/hooks/useFinanceComputed.js

```javascript

```javascript
// file content inserted below
``` 

<!-- Begin file: src/hooks/useFinanceComputed.js -->

```javascript

USEFINANCECOMPUTED.JS 

import { useMemo } from 'react';
import { differenceInDays, startOfDay, parseISO, addDays, format } from 'date-fns';

export function useFinanceComputed(data) {
  return useMemo(() => {
    if (!data || !data.settings) return {};

    const { settings, periods, accounts, transactions, liabilities: storeLiabilities = [] } = data;
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

    const startDate = activePeriod?.startDate ? parseISO(activePeriod.startDate) : today;
    const endDate = activePeriod?.endDate ? parseISO(activePeriod.endDate) : today;

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
    
    // FIX F02: investmentActual non Ã¨ una spesa, Ã¨ un trasferimento di asset.
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

    // Sottraiamo anche gli investimenti residui perchÃ© comunque escono dal conto corrente
    const liquiditaDisponibileScudo = operatingLiquidity - usciteFissePianificateResidue - investimentiPianificatiResidui - settings.safetyBuffer;
    const divisoreGiorni = giorniMancantiAlProssimoAccredito <= 0 ? 1 : giorniMancantiAlProssimoAccredito;
    const spendibileGiornalieroFinoAlProssimoStipendio = isPeriodOverrun ? 0 : (liquiditaDisponibileScudo / divisoreGiorni);

    // â”€â”€ FORECAST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const totalDaysInPeriod = differenceInDays(endDate, startDate) || 30;
    const daysElapsed = Math.max(1, differenceInDays(today, startDate));

    const spesaMediaGiornalieraVariabileAttuale = variableExpensesActual / daysElapsed;

    // FIX 8.2: proiezioneVariabileBase fix
    const proiezioneAffidabile = daysElapsed >= 3;
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

    const targetChiusura = (activePeriod.openingBalance ?? 0) + (settings.targetSavingsAmount || 0);
    const saldoBaseChiusura = proiezioneAffidabile ? opening + incomeActual - costiFissiTotaliCiclo - investimentiPianificatiResidui - proiezioneVariabileBase : null;
    
    const scenariForecast = proiezioneAffidabile ? [
      { name: 'Prudente (-20% discrezionali)', saldo: opening + incomeActual - costiFissiTotaliCiclo - investimentiPianificatiResidui - proiezionePrudente, color: 'var(--status-green)' },
      { name: 'Base (Attuale)',                saldo: saldoBaseChiusura, color: 'var(--chart-primary)' },
      { name: 'Stress (+30% discrezionali)',   saldo: opening + incomeActual - costiFissiTotaliCiclo - investimentiPianificatiResidui - proiezioneStress, color: 'var(--status-red)' },
    ] : [];

    const gapTarget = saldoBaseChiusura !== null ? saldoBaseChiusura - targetChiusura : null;
    const isOffTrack = gapTarget !== null && gapTarget < 0;

    // --- PHASE 3: Extraordinary Income ---
    const extraordinaryIncome = paidPeriodTx
      .filter(t => t.type === 'income' && t.isExtraordinaryIncome)
      .reduce((s, t) => s + t.amount, 0);

    const ordinaryIncome = incomeActual - extraordinaryIncome;

    // Savings Rate uses ONLY ordinary income as denominator to avoid distortion
    const savingsRateOrdinary = ordinaryIncome > 0
      ? ((ordinaryIncome - (fixedExpensesActual + variableExpensesActual)) / ordinaryIncome) * 100
      : 0;

    const savingsRateTotal = ordinaryIncome > 0
      ? ((ordinaryIncome - fixedExpensesActual - variableExpensesActual) / ordinaryIncome) * 100
      : 0;

    const hasExtraordinaryIncome = extraordinaryIncome > 0;

    // --- NUOVI KPI AGGIUNTI ---
    const totalIncome = incomeActual;
    const totalExpenses = variableExpensesActual + fixedExpensesActual;
    const savingsRate = totalIncome > 0
      ? ((totalIncome - totalExpenses) / totalIncome) * 100
      : 0;
    
    const fixedCostCoverage = costiFissiTotaliCiclo > 0
      ? totalIncome / costiFissiTotaliCiclo
      : 0;

    const totalSavings = data.goals ? data.goals.reduce((s, g) => s + (g.currentAmount || 0), 0) : 0;
    const spesaMensileMedia = daysElapsed > 0
      ? ((variableExpensesActual + fixedExpensesActual) / daysElapsed) * 30
      : 0;
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
    const debtService = paidPeriodTx.filter(t => t.type === 'liability_payment').reduce((s,t) => s + t.amount, 0);
    const redditoDisponibileNetto = incomeActual - costiFissiTotaliCiclo - debtService;

    // F08: Ratios
    const ratioFissiSuReddito = incomeActual > 0 ? (costiFissiTotaliCiclo / incomeActual) * 100 : 0;
    const ciboActual = paidPeriodTx.filter(t => t.categoryId === 'alimentari' || t.categoryId === 'ristorazione').reduce((s,t) => s + t.amount, 0);
    const ratioCiboSuReddito = incomeActual > 0 ? (ciboActual / incomeActual) * 100 : 0;

    // Efficienza Intra-Ciclo
    const variableCategories = data.categories.filter(c => c.group === 'variable');
    const budgetVariabileTotale = variableCategories.reduce((sum, cat) =>
      sum + (settings.categoryBudgets?.[cat.id] || 0), 0);
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
    const risparmioStimaCicloCorrente = Math.max(0, (saldoBaseChiusura ?? opening) - opening);

    // Weighted historic average over up to 6 closed periods (more weight to recent)
    const recentClosed = data.periods.filter(p => p.id !== activePeriod.id && p.status === 'closed').slice(-6);
    let proiezioneAnnualeRisparmio;
    if (recentClosed.length >= 2) {
      const datiStorici = recentClosed.map((p, idx) => {
        const pTx = transactions.filter(t => t.periodId === p.id && t.status === 'paid');
        const pOrdInc = pTx.filter(t => t.type === 'income' && !t.isExtraordinaryIncome).reduce((s,t) => s + t.amount, 0);
        const pExp = pTx.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
        return { risparmio: Math.max(0, pOrdInc - pExp), peso: idx + 1 };
      });
      const totalPeso = datiStorici.reduce((s,r) => s + r.peso, 0) || 1;
      const mediaRisparmio = datiStorici.reduce((s,r) => s + r.risparmio * r.peso, 0) / totalPeso;
      proiezioneAnnualeRisparmio = mediaRisparmio * 12;
    } else {
      proiezioneAnnualeRisparmio = risparmioStimaCicloCorrente * 12;
    }

    const goalsMonthlyTarget = data.goals
      ? data.goals
          .filter(g => g.deadline && g.currentAmount < g.targetAmount)
          .reduce((sum, g) => {
            const targetDate = g.deadline ? (g.deadline.length === 7 ? parseISO(g.deadline + '-01') : parseISO(g.deadline)) : today;
            const monthsLeft = Math.max(1, differenceInDays(targetDate, today) / 30);
            return sum + (g.targetAmount - g.currentAmount) / monthsLeft;
          }, 0)
      : 0;

    const proiezioneVsObiettiviGap = proiezioneAnnualeRisparmio / 12 - goalsMonthlyTarget;
    const inLineaConObiettivi = proiezioneVsObiettiviGap >= 0;

    const risparmioNettoMensile = Math.max(0, (saldoBaseChiusura || 0) - opening) / totalDaysInPeriod * 30;
    const goalFundingRate = goalsMonthlyTarget > 0
      ? Math.min(100, (risparmioNettoMensile / goalsMonthlyTarget) * 100)
      : 100;

    // --- PHASE 6: Alert Regole in Scadenza ---
    const ALERT_DAYS_BEFORE_EXPIRY = 30;
    const regolaInScadenza = data.recurringRules
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
    const closedPeriods = data.periods
  .filter(p => p.id !== activePeriod.id)
  .sort((a, b) => a.endDate.localeCompare(b.endDate)) // ← crescente: più vecchi prima
  .slice(-6); // ← ultimi 6 = più recenti
    let storicoSavingsRate = 0;
    if (closedPeriods.length > 0) {
      const historicalRates = closedPeriods.map(p => {
        const pTx = transactions.filter(t => t.periodId === p.id && t.status === 'paid');
        const pInc = pTx.filter(t => t.type === 'income' && !t.isExtraordinaryIncome).reduce((s,t) => s+t.amount, 0); // [GAP-C04] exclude extraordinary
        const pExp = pTx.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
        return pInc > 0 ? ((pInc - pExp) / pInc) * 100 : 0;
      });
      const totalPeso = historicalRates.reduce((s, _, idx) => s + (idx + 1), 0) || 1;
storicoSavingsRate = historicalRates.reduce((s, r, idx) => s + r * (idx + 1), 0) / totalPeso;
    }
    const wealthAccumulationRate = incomeActual > 0 ? (investmentActual / incomeActual) * 100 : 0;
    const mesiDiAutonomia = spesaMensileMedia > 0 ? (operatingLiquidity + restrictedSavings + investments) / spesaMensileMedia : 0;

    const expectedReturnRate = Number(settings.expectedReturnRate ?? 3.5) / 100;
    const cashDragAnnuo = Math.max(0, operatingLiquidity - (settings.safetyBuffer ?? 0)) * expectedReturnRate;

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

    const plannedFixedTx = plannedPeriodTx.filter(t => t.nature === 'fixed');

    for (let i = 0; i < daysToSalary; i++) {
      const currentSimDay = addDays(today, i);
      const dayStr = format(currentSimDay, 'dd/MM');

      // Costi fissi che cadono in questo giorno specifico
      let spikesTotal = 0;
      const spikeNames = [];
      plannedFixedTx.forEach(tx => {
        try {
          const txDate = tx.date ? parseISO(tx.date) : today;
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
    const liquidityCurrentRatio = usciteFissePianificateResidue > 0
      ? (operatingLiquidity + restrictedSavings) / usciteFissePianificateResidue
      : Infinity;

    // Quick Ratio: exclude restricted savings
    const liquidityQuickRatio = usciteFissePianificateResidue > 0
      ? operatingLiquidity / usciteFissePianificateResidue
      : Infinity;

    // Liquid Coverage Days: days the liquidity covers fixed + variable run-rate
    const dailyObligations = (costiFissiTotaliCiclo + (spesaMensileMedia / 30 * totalDaysInPeriod)) / totalDaysInPeriod || 0;
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
    const savingsContributions = paidPeriodTx.filter(t => t.type === 'investment').reduce((s,t) => s + t.amount, 0);
    const extraordinaryFlows = extraordinaryExpensesActual + extraordinaryIncome;
    const trueSavingsRate = incomeActual > 0 ? ((netWorthChange + savingsContributions - extraordinaryFlows) / incomeActual) * 100 : 0;

    // --- GAP-K07: Income Concentration Index ---
    // Share of top 3 income sources by amount as percent of total income
    const incomeSources = paidPeriodTx.filter(t => t.type === 'income').reduce((map, t) => {
      const src = t.source || 'unspecified';
      map[src] = (map[src] || 0) + t.amount;
      return map;
    }, {});
    const sortedIncomeShares = Object.values(incomeSources).sort((a,b) => b - a);
    const top3Sum = sortedIncomeShares.slice(0,3).reduce((s,v) => s+v, 0);
    const incomeConcentrationIndex = incomeActual > 0 ? (top3Sum / incomeActual) * 100 : 0;

    // --- GAP-S02: Inflazione nei budget + suggerimento adegua ---
    // Calcolo semplice: se budgetsLastUpdated > 12 mesi, suggerire adeguamento per tasso inflazione impostato
    const inflationRate = settings.assumedInflationRate ?? 0.03; // 3% default
    const suggestBudgetAdjustment = budgetStaleMonths > 12;
    const adjustedBudgetPreview = suggestBudgetAdjustment ?
      Object.fromEntries(Object.entries(settings.categoryBudgets || {}).map(([k,v]) => [k, Math.round(v * (1 + inflationRate))]))
      : null;

    // --- GAP-S05: Validazione openingBalance vs teorico ---
    // teoricOpening = sum(accounts balances at start of period derived from transactions) fallback: activePeriod.openingBalance
    const theoreticOpening = data.accounts ? data.accounts.reduce((s, a) => s + (a.openingBalance ?? a.balance ?? 0), 0) : (activePeriod.openingBalance ?? opening);
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

    const investmentPLPercent = (openingInvestments + (investmentContributions - investmentWithdrawals)) > 0
      ? (investmentNetChange / (openingInvestments + (investmentContributions - investmentWithdrawals))) * 100
      : 0;
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
  }, [data]);

}

USEFINANCESTORE.JS 
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '../lib/storage';
import { addMonths, format, parse, getDaysInMonth } from 'date-fns';

// RECURRING RULES DEFINITION (HARDENED 2.0)
const RECURRING_RULES = [
  { id: 'rule_famiglia', name: 'Spese Famiglia', dayOfMonth: 5, amount: 600.00, type: 'expense', startDate: '2026-06', endDate: null },
  { id: 'rule_pac', name: 'Investimento PAC', dayOfMonth: 10, amount: 400.00, type: 'investment', startDate: null, endDate: null },
  { id: 'rule_consulenza', name: 'Consulenza Racca', dayOfMonth: 20, amount: 275.00, type: 'expense', startDate: null, endDate: '2026-08' },
  { id: 'rule_telefono', name: 'Telefono', dayOfMonth: 15, amount: 51.62, type: 'expense', startDate: null, endDate: '2026-07' },
];

// ─── STATO INIZIALE — COMPLETAMENTE VUOTO ───────────────────────────────────
const initialData = {
  settings: {
    currency: 'EUR',
    activePeriodId: null,
    defaultIncome: 1900,
    safetyBuffer: 1000,
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
    githubToken: '',
    gistId: '',
    lastSync: null,
  },
  periods: [],
  accounts: [],
  liabilities: [],
  recurringRules: RECURRING_RULES,
  transactions: [],
  categories: [
    { id: 'famiglia', name: 'Famiglia', group: 'fixed' },
    { id: 'pac', name: 'Investimento PAC', group: 'fixed' },
    { id: 'consulenza', name: 'Consulenza', group: 'fixed' },
    { id: 'telefono', name: 'Telefono', group: 'fixed' },
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

// ─── UTILITY: AUDIT LOG ──────────────────────────────────────────────────────
function appendAudit(log, action, details = {}) {
  const newEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    action,
    details,
    timestamp: Date.now(),
  };
  const updated = [...log, newEntry];
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

          let updatedAccounts = state.data.accounts.map(acc => {
            if (acc.id !== newTx.accountId || newTx.status !== 'paid') return acc;
            const delta = (newTx.type === 'expense' || newTx.type === 'investment')
              ? -newTx.amount : newTx.amount;
            return { ...acc, currentBalance: acc.currentBalance + delta };
          });

           // PAC Auto-accumulo — routing: investments se esiste, altrimenti savings (Fondo Emergenza)
          if (newTx.type === 'investment' && newTx.status === 'paid') {
            const investmentAccount =
              state.data.accounts.find(a => a.type === 'investments') ||
              state.data.accounts.find(a => a.type === 'savings');
            if (investmentAccount) {
              updatedAccounts = updatedAccounts.map(acc =>
                acc.id === investmentAccount.id
                  ? { ...acc, currentBalance: acc.currentBalance + newTx.amount }
                  : acc
              );
            }
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
              const delta = (tx.type === 'expense' || tx.type === 'investment')
                ? tx.amount : -tx.amount;
              return { ...acc, currentBalance: acc.currentBalance + delta };
            });

             // PAC Auto-accumulo revert
            if (tx.type === 'investment') {
              const investmentAccount =
                state.data.accounts.find(a => a.type === 'investments') ||
                state.data.accounts.find(a => a.type === 'savings');
              if (investmentAccount) {
                updatedAccounts = updatedAccounts.map(acc =>
                  acc.id === investmentAccount.id
                    ? { ...acc, currentBalance: acc.currentBalance - tx.amount }
                    : acc
                );
              }
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
            const delta = (tx.type === 'expense' || tx.type === 'investment')
              ? -tx.amount : tx.amount;
            return { ...acc, currentBalance: acc.currentBalance + delta };
          });

             // PAC Auto-accumulo — routing: investments se esiste, altrimenti savings
          if (tx.type === 'investment') {
            const investmentAccount =
              state.data.accounts.find(a => a.type === 'investments') ||
              state.data.accounts.find(a => a.type === 'savings');
            if (investmentAccount) {
              updatedAccounts = updatedAccounts.map(acc =>
                acc.id === investmentAccount.id
                  ? { ...acc, currentBalance: acc.currentBalance + tx.amount }
                  : acc
              );
            }
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
            t.id === transactionId ? { ...t, status: 'planned', paidAt: undefined } : t
          );
          let updatedAccounts = state.data.accounts.map(acc => {
            if (acc.id !== tx.accountId) return acc;
            const delta = (tx.type === 'expense' || tx.type === 'investment')
              ? tx.amount : -tx.amount;
            return { ...acc, currentBalance: acc.currentBalance + delta };
          });

           // PAC Auto-accumulo revert — routing: investments se esiste, altrimenti savings
          if (tx.type === 'investment') {
            const investmentAccount =
              state.data.accounts.find(a => a.type === 'investments') ||
              state.data.accounts.find(a => a.type === 'savings');
            if (investmentAccount) {
              updatedAccounts = updatedAccounts.map(acc =>
                acc.id === investmentAccount.id
                  ? { ...acc, currentBalance: acc.currentBalance - tx.amount }
                  : acc
              );
            }
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
              transactions: [...keptTransactions, salaryTx, ...plannedTxs],
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
            targetClosingBalance: Number(realBankBalance) + Number(minSavingsNext),openingInvestments: parseFloat(realInvestmentsBalance) || 0,
          });

          // Aggiorna saldo conto con valore reale
          let updatedAccounts = data.accounts.map(a =>
            a.id === 'acc_main' ? { ...a, currentBalance: Number(realBankBalance) } : a
          );

          // If accountUpdates passed in args, apply them (GAP-S03 support)
          // Note: closePeriodAndOpenNext signature may include accountUpdates in caller
          if (accountUpdates && Object.keys(accountUpdates).length > 0) {
            updatedAccounts = updatedAccounts.map(a =>
              accountUpdates[a.id] !== undefined
                ? { ...a, currentBalance: Number(accountUpdates[a.id]) }
                : a
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

      // ── RESET CON EXPORT PREVENTIVO (FIX 1.4) ────────────────────────────
      // NON chiamare direttamente: usare il componente Settings che fa l'export prima.
      resetToDefaults: () => {
        exportStateAsJSON(get().data); // FIX 1.4: backup automatico prima del reset
        set(() => ({ data: initialData }));
      },

      syncToCloud: async () => {
        const data = get().data;
        const { githubToken, gistId } = data.settings;
        if (!githubToken || !gistId) throw new Error("Configura Github Token e Gist ID nelle impostazioni.");
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ files: { "cfo-backup.json": { content: JSON.stringify(data, null, 2) } } })
        });
        if (!response.ok) throw new Error("Errore di rete durante il salvataggio su GitHub.");
        set(state => ({ data: { ...state.data, settings: { ...state.data.settings, lastSync: new Date().toISOString() } } }));
      },

      restoreFromCloud: async () => {
        const { githubToken, gistId } = get().data.settings;
        if (!githubToken || !gistId) throw new Error("Configura Github Token e Gist ID nelle impostazioni.");
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
          headers: { 'Authorization': `Bearer ${githubToken}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        if (!response.ok) throw new Error("Impossibile scaricare i dati. Verifica Token e Gist ID.");
        const result = await response.json();
        const fileContent = result.files["cfo-backup.json"]?.content;
        if (!fileContent || fileContent === "{}") throw new Error("Nessun dato valido trovato nel Gist.");
        set({ data: JSON.parse(fileContent) });
      },
    }),
    {
      name: 'private-cfo-clean',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);

FINANCECONTEXT.JSX 
import React, { createContext, useContext } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useFinanceComputed } from '../hooks/useFinanceComputed';

const FinanceContext = createContext(null);

export const FinanceProvider = ({ children }) => {
  const data = useFinanceStore((state) => state.data);
  const setData = useFinanceStore((state) => state.setData);

  const computed = useFinanceComputed(data);

  return (
    <FinanceContext.Provider value={{ data, setData, computed }}>
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinanceData = () => {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinanceData must be used within FinanceProvider');
  return ctx;
};

ACCOUNT.JSX

import React, { useState } from 'react';
import { useFinanceData } from '../context/FinanceContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { Landmark, Shield, TrendingUp, Wallet, Plus, Trash2, Edit3, X, Check, Building } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { useToast } from '../components/Toast';
import EmptyState from '../components/EmptyState';

const ACCOUNT_TYPE_LABELS = {
  operating_liquidity: 'Conto Corrente',
  savings:             'Conto Risparmio',
  investments:         'Portafoglio Investimenti',
  pension:             'Fondo Pensione',
  real_estate:         'Immobile (Stima)',
};

const ICONS = {
  operating_liquidity: Wallet,
  savings: Shield,
  investments: TrendingUp,
  pension: Landmark,
  real_estate: Building,
};

const COLORS = {
  operating_liquidity: '#3b82f6',
  savings: 'var(--status-green)',
  investments: '#8b5cf6',
  pension: 'var(--status-yellow)',
  real_estate: 'var(--text-primary)',
};

export default function Accounts({ onNavigate }) {
  const { data, computed } = useFinanceData();
  const addAccount = useFinanceStore(state => state.addAccount);
  const updateAccount = useFinanceStore(state => state.updateAccount);
  const deleteAccount = useFinanceStore(state => state.deleteAccount);
  const showToast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'operating_liquidity', currentBalance: '' });

  const formatEuro = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

  const resetForm = () => {
    setForm({ name: '', type: 'operating_liquidity', currentBalance: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = () => {
    if (!form.name.trim()) { showToast('Inserisci un nome', 'error'); return; }
    const balance = parseFloat(form.currentBalance);
    if (isNaN(balance)) { showToast('Saldo non valido', 'error'); return; }
    if (editingId) {
      updateAccount(editingId, { name: form.name, type: form.type, currentBalance: balance });
      showToast('Conto aggiornato', 'success');
    } else {
      addAccount({ name: form.name, type: form.type, currentBalance: balance });
      showToast('Conto aggiunto', 'success');
    }
    resetForm();
  };

  const handleEdit = (acc) => {
    setForm({ name: acc.name, type: acc.type, currentBalance: acc.currentBalance ?? acc.balance ?? 0 });
    setEditingId(acc.id);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    try {
      if (window.confirm('Eliminare questo conto?')) {
        deleteAccount(id);
        showToast('Conto eliminato', 'success');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const accounts = data.accounts || [];

  // ── CALCOLI PATRIMONIO ───────────────────────────────────────────
  const liquidNetWorth = accounts
    .filter(a => a.type !== 'real_estate')
    .reduce((sum, acc) => sum + (acc.currentBalance ?? acc.balance ?? 0), 0);

  const realEstateValue = accounts
    .filter(a => a.type === 'real_estate')
    .reduce((sum, acc) => sum + (acc.currentBalance ?? acc.balance ?? 0), 0);

  const totalNetWorth = liquidNetWorth + realEstateValue;

  // G-12: storico patrimonio — DOPO totalNetWorth
  const wealthHistory = [...(data.periods || [])]
  .sort((a, b) => a.startDate.localeCompare(b.startDate))
  .map(p => {
    // Net worth reale = liquidità apertura + investimenti apertura + immobili (stima costante)
    const pOpeningBalance = p.openingBalance ?? 0;
    const pOpeningInvestments = p.openingInvestments ?? 0;
    return {
      label: format(parseISO(p.startDate), 'MMM yy', { locale: it }),
      patrimonio: pOpeningBalance + pOpeningInvestments + realEstateValue,
    };
  });
if (wealthHistory.length > 0) {
  wealthHistory.push({ label: 'Oggi', patrimonio: totalNetWorth });
}

  const progressPct = totalNetWorth <= 0 ? 0 : Math.min(100, (liquidNetWorth / totalNetWorth) * 100);

  const inputStyle = {
    width: '100%', padding: '0.625rem 0.75rem',
    background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    fontSize: '0.95rem', boxSizing: 'border-box',
  };

  const grouped = Object.keys(ACCOUNT_TYPE_LABELS).map(typeKey => ({
    type: typeKey,
    label: ACCOUNT_TYPE_LABELS[typeKey],
    icon: ICONS[typeKey],
    color: COLORS[typeKey],
    accounts: accounts.filter(a => a.type === typeKey),
  })).filter(g => g.accounts.length > 0);

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2>Conti & Patrimonio</h2>
          <p className="kpi-sub">Family Officer Net Worth Tracking</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus size={16} /> Aggiungi Conto
        </button>
      </div>

      {/* PATRIMONIO TOTALE */}
      <div className="card" style={{ padding: '2rem' }}>
        <div className="kpi-label mb-2 text-center">Patrimonio Netto Totale</div>
        <div className="text-center" style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--text-primary)' }}>
          {formatEuro(totalNetWorth)}
        </div>
        <div className="flex justify-between mt-8 text-sm font-bold text-muted">
          <span>Liquidità e Investimenti: {formatEuro(liquidNetWorth)}</span>
          <span>Immobili: {formatEuro(realEstateValue)}</span>
        </div>
        <div className="progress-container mt-2" style={{ height: 8 }}>
          <div className="progress-bar" style={{ width: `${progressPct}%`, backgroundColor: totalNetWorth <= 0 ? 'var(--status-red)' : 'var(--chart-primary)' }} />
        </div>
      </div>
      {/* INVESTMENT P&L */}
{(() => {
  const activePeriod = data.periods?.find(p => p.id === data.settings?.activePeriodId);
  const openingInvestments = activePeriod?.openingInvestments ?? null;
  const investmentAccount = accounts.find(a => a.type === 'investments');
  const currentInvestments = investmentAccount ? (investmentAccount.currentBalance ?? 0) : 0;
  const investmentContributions = (data.transactions || [])
    .filter(t => t.periodId === activePeriod?.id && t.type === 'investment')
    .reduce((s, t) => s + t.amount, 0);
  const costBasis = (openingInvestments ?? 0) + investmentContributions;
  const pl = currentInvestments - costBasis;
  const plPct = costBasis > 0 ? (pl / costBasis) * 100 : null;

  if (openingInvestments === null || !investmentAccount) return null;

  const color = plPct === null ? 'var(--text-muted)' : plPct >= 0 ? 'var(--status-green)' : 'var(--status-red)';

  return (
    <div className="card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="kpi-label mb-1">Rendimento Portafoglio (ciclo corrente)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color }}>
            {plPct === null ? '—' : `${plPct >= 0 ? '+' : ''}${plPct.toFixed(2)}%`}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            P&L: {pl >= 0 ? '+' : ''}{formatEuro(pl)} · Base: {formatEuro(costBasis)}
          </div>
        </div>
        <TrendingUp size={32} color={color} style={{ opacity: 0.4 }} />
      </div>
    </div>
  );
})()}

      {/* ── LIQUIDITY RATIOS ─────────────────────────────────────────── */}
      {computed.usciteFissePianificateResidue > 0 && (
        <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div>
            <div className="kpi-label mb-1">Current Ratio</div>
            <div style={{
              fontSize: '2rem', fontWeight: 900, lineHeight: 1,
              color: computed.liquidityCurrentRatio < 1 ? 'var(--status-red)' : computed.liquidityCurrentRatio < 1.5 ? 'var(--status-yellow)' : 'var(--status-green)'
            }}>
              {computed.liquidityCurrentRatio === Infinity ? '∞' : computed.liquidityCurrentRatio?.toFixed(2)}x
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              (C/C + Risparmio) ÷ Fissi residui
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {computed.liquidityCurrentRatio < 1
                ? '⚠ Liquidità insufficiente per coprire i fissi'
                : computed.liquidityCurrentRatio < 1.5
                ? '⚡ Margine stretto — monitorare'
                : '✓ Copertura adeguata'}
            </div>
          </div>

          <div>
            <div className="kpi-label mb-1">Quick Ratio</div>
            <div style={{
              fontSize: '2rem', fontWeight: 900, lineHeight: 1,
              color: computed.liquidityQuickRatio < 1 ? 'var(--status-red)' : computed.liquidityQuickRatio < 1.5 ? 'var(--status-yellow)' : 'var(--status-green)'
            }}>
              {computed.liquidityQuickRatio === Infinity ? '∞' : computed.liquidityQuickRatio?.toFixed(2)}x
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Solo C/C ÷ Fissi residui
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {computed.liquidityQuickRatio < 1
                ? '⚠ Saldo operativo sotto i fissi residui'
                : computed.liquidityQuickRatio < 1.5
                ? '⚡ Margine stretto sul conto corrente'
                : '✓ C/C copre i fissi residui'}
            </div>
          </div>
        </div>
      )}

      {/* G-12: GRAFICO CRESCITA PATRIMONIO */}
      {wealthHistory.length >= 2 && (
        <div className="card" style={{ height: 280 }}>
          <h3 className="mb-4">Crescita Patrimonio nel Tempo</h3>
          <ResponsiveContainer width="100%" height="82%">
            <LineChart data={wealthHistory} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} width={55} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '12px' }}
                formatter={v => [formatEuro(v), 'Patrimonio']}
              />
              <ReferenceLine y={totalNetWorth} stroke="var(--status-green)" strokeDasharray="4 4"
                label={{ value: 'Oggi', position: 'insideTopRight', fontSize: 10, fill: 'var(--status-green)' }}
              />
              <Line type="monotone" dataKey="patrimonio" stroke="#8b5cf6" strokeWidth={3}
                dot={{ r: 5, fill: '#8b5cf6', strokeWidth: 0 }} activeDot={{ r: 7, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* FORM NUOVO/MODIFICA CONTO */}
      {showForm && (
        <div className="card" style={{ borderTop: '3px solid var(--chart-primary)' }}>
          <h3 className="mb-4">{editingId ? 'Modifica Conto' : 'Nuovo Conto'}</h3>
          <div className="grid-3col mb-4">
            <div>
              <label className="kpi-label mb-1">Nome Conto</label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label className="kpi-label mb-1">Tipo</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={inputStyle}>
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="kpi-label mb-1">Saldo Attuale (€)</label>
              <input type="number" step="0.01" value={form.currentBalance} onChange={e => setForm(p => ({ ...p, currentBalance: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost flex items-center gap-2" onClick={resetForm}><X size={15} /> Annulla</button>
            <button className="btn btn-primary flex items-center gap-2" onClick={handleSave}><Check size={15} /> Salva</button>
          </div>
        </div>
      )}

      {/* LISTA CONTI */}
      {grouped.length === 0 && !showForm ? (
        <EmptyState onGoToAdmin={() => onNavigate?.('admin')} />
      ) : (
        <div className="grid-2col">
          {grouped.map(group => {
            const Icon = group.icon;
            const groupTotal = group.accounts.reduce((s, a) => s + (a.currentBalance ?? a.balance ?? 0), 0);
            return (
              <div key={group.type} className="card" style={{ borderTop: `3px solid ${group.color}` }}>
                <div className="flex items-center gap-3 mb-4">
                  <div style={{ padding: '0.5rem', backgroundColor: `${group.color}1a`, borderRadius: 'var(--radius-md)', color: group.color }}>
                    <Icon size={20} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{group.label}</div>
                  <div className="ml-auto font-bold text-lg">{formatEuro(groupTotal)}</div>
                </div>
                <div className="flex flex-col gap-2">
                  {group.accounts.map(acc => {
                    const isLinked = data.transactions.some(t => t.accountId === acc.id);
                    return (
                      <div key={acc.id} className="flex items-center justify-between p-3 rounded" style={{ backgroundColor: 'var(--bg-primary)' }}>
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{acc.name}</div>
                          {acc.earmarkedAmount > 0 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Accantonato: {formatEuro(acc.earmarkedAmount)}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <span style={{ fontWeight: 700, color: (acc.currentBalance ?? acc.balance ?? 0) < 0 ? 'var(--status-red)' : 'var(--text-primary)' }}>
                            {formatEuro(acc.currentBalance ?? acc.balance ?? 0)}
                          </span>
                          <div className="flex gap-2">
                            <button onClick={() => handleEdit(acc)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><Edit3 size={14} /></button>
                            <button onClick={() => handleDelete(acc.id)} disabled={isLinked} style={{ background: 'none', border: 'none', cursor: isLinked ? 'not-allowed' : 'pointer', color: isLinked ? 'var(--text-muted)' : 'var(--status-red)', opacity: isLinked ? 0.3 : 1 }}><Trash2 size={14} /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

ADMINSETUP.JSX 

import React, { useState } from 'react';
import { useFinanceData } from '../context/FinanceContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { PlusCircle, Calendar, Wallet, Landmark, ShieldCheck, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminSetup() {
  const { data, computed } = useFinanceData();
  const registerSalaryAndStartCycle = useFinanceStore(state => state.registerSalaryAndStartCycle);
  const markFixedCostAsPaid = useFinanceStore(state => state.markFixedCostAsPaid);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    amount: data.settings.defaultIncome || 1900,
    dateStr: '',
    bankBalance: '',
    isExtraordinaryIncome: false,
  });
  const [saved, setSaved] = useState(false);

  const formatEuro = (val) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.dateStr) return alert('Inserisci la data di accredito.');
    if (!form.bankBalance || isNaN(Number(form.bankBalance))) return alert('Inserisci il saldo reale post-accredito.');
    registerSalaryAndStartCycle(form);
    setSaved(true);
    setShowForm(false);
  };

  const inputStyle = {
    width: '100%',
    padding: '0.875rem 1rem',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '1.25rem',
    fontWeight: 700,
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginBottom: '0.5rem',
  };

  const pendingFixedCosts = computed.plannedPeriodTx?.filter(t => t.nature === 'fixed') || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '900px', margin: '0 auto' }}>

      {/* TITLE */}
      <div style={{ textAlign: 'center', paddingBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <ShieldCheck size={22} color="var(--text-primary)" />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.03em' }}>Governance del Ciclo</h1>
        </div>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Il nuovo ciclo parte solo quando registri lo stipendio
        </p>
      </div>

      {/* STATO: NESSUN CICLO */}
      {!computed.activePeriod && !showForm && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', borderStyle: 'dashed', border: '2px dashed var(--border-color)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.7 }}>
            Nessun ciclo fiscale attivo.<br />
            <strong style={{ color: 'var(--text-secondary)' }}>Quando arriva lo stipendio</strong> (tra l'11 e il 12 maggio),<br />
            registralo qui per attivare il sistema.
          </div>
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 2.5rem',
              background: 'var(--text-primary)',
              color: 'var(--bg-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
            }}
          >
            <PlusCircle size={20} />
            Registra Stipendio e Avvia Ciclo
          </button>
        </div>
      )}

      {/* STATO: CICLO ATTIVO, bottone per nuovo ciclo */}
      {computed.activePeriod && !showForm && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 2.5rem',
              background: 'var(--text-primary)',
              color: 'var(--bg-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
            }}
          >
            <PlusCircle size={20} />
            Registra Nuovo Stipendio
          </button>
        </div>
      )}

      {/* FORM REGISTRAZIONE */}
      {showForm && (
        <div className="card" style={{ borderTop: '3px solid var(--status-green)' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1.5rem' }}>
            Registrazione Accredito Stipendio
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
            
              <div>
                <label style={labelStyle}><Wallet size={11} /> Importo (€)</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  style={{ ...inputStyle, color: 'var(--status-green)' }}
                />
              </div>
              <div>
                <label style={labelStyle}><Calendar size={11} /> Data Accredito (gg/mm/aaaa)</label>
                <input
                  type="text"
                  placeholder="es. 12/05/2026"
                  value={form.dateStr}
                  onChange={e => setForm({ ...form, dateStr: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}><Landmark size={11} /> Saldo Reale Banca (€)</label>
                <input
                  type="number"
                  value={form.bankBalance}
                  onChange={e => setForm({ ...form, bankBalance: e.target.value })}
                  placeholder="Saldo effettivo post-accredito"
                  style={inputStyle}
                />
              </div>
              <div>
  <label style={labelStyle}><ArrowRight size={11} /> Portafoglio Investimenti (€)</label>
  <input
    type="number"
    value={form.openingInvestments ?? ''}
    onChange={e => setForm({ ...form, openingInvestments: e.target.value })}
    placeholder="Valore attuale portafoglio"
    style={{ ...inputStyle, color: 'var(--chart-primary)' }}
  />
</div>
            </div>

            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="checkbox"
                id="extraordinary"
                checked={form.isExtraordinaryIncome}
                onChange={e => setForm({ ...form, isExtraordinaryIncome: e.target.checked })}
                style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
              />
              <label htmlFor="extraordinary" style={{ fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600 }}>
                Tredicesima / Entrata Straordinaria
              </label>
            </div>

            <div style={{ display: 'flex', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button
                type="submit"
                style={{
                  flex: 1, padding: '0.875rem',
                  background: 'var(--status-green)', color: 'white',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer',
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                }}
              >
                Salva e Avvia Ciclo
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  padding: '0.875rem 1.5rem',
                  background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RIEPILOGO CICLO + COSTI FISSI */}
      {computed.activePeriod && (
        <div className="grid-2col" style={{ alignItems: 'start' }}>

          {/* CICLO */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Calendar size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Ciclo Fiscale Attivo
              </span>
              <span style={{ marginLeft: 'auto', background: 'var(--status-green-bg)', color: 'var(--status-green)', borderRadius: '999px', padding: '0.15rem 0.75rem', fontSize: '0.65rem', fontWeight: 800 }}>
                OPEN
              </span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, marginBottom: '1rem' }}>
              {computed.activePeriod.startDate} → {computed.activePeriod.endDate}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Giorni rimasti</span>
                <span style={{ fontWeight: 800 }}>{computed.giorniMancantiAlProssimoAccredito} gg</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Saldo apertura</span>
                <span style={{ fontWeight: 800 }}>{formatEuro(computed.activePeriod.openingBalance)}</span>
              </div>
            </div>
          </div>

          {/* COSTI FISSI PENDENTI */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Costi Fissi Pendenti
              </span>
              {pendingFixedCosts.length > 0 && (
                <span style={{ marginLeft: 'auto', background: 'var(--status-red-bg)', color: 'var(--status-red)', borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.65rem', fontWeight: 800 }}>
                  {pendingFixedCosts.length}
                </span>
              )}
            </div>

            {pendingFixedCosts.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Tutti i costi fissi confermati ✓
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {pendingFixedCosts.map(tx => (
                  <div key={tx.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.75rem 1rem', background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--status-red)',
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{tx.description}</div>
                      <div style={{ fontWeight: 800, color: 'var(--status-red)', fontSize: '0.85rem', marginTop: '0.1rem' }}>
                        {formatEuro(tx.amount)}
                      </div>
                    </div>
                    <button
                      onClick={() => markFixedCostAsPaid(tx.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.45rem 0.9rem',
                        background: 'rgba(16,185,129,0.1)', border: '1px solid var(--status-green)',
                        borderRadius: 'var(--radius-md)', color: 'var(--status-green)',
                        fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      ✓ Pagato
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

BUDGETACTUAL.JSX

import React from 'react';
import { useFinanceData } from '../context/FinanceContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import EmptyState from '../components/EmptyState';

export default function BudgetActual({ onNavigate }) {
  const { data, computed } = useFinanceData();
  const formatEuro = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

  if (!computed.activePeriod) return <EmptyState onGoToAdmin={() => onNavigate?.('admin')} />;

  // FIX 2.4: budget per categoria da settings invece di 300 hardcoded
  const categoryBudgets = data.settings.categoryBudgets || {};

  const budgetData = data.categories
    .filter(c => c.group === 'variable')
    .map(cat => {
      const budget = categoryBudgets[cat.id] ?? 0;
      const spent  = (computed.paidPeriodTx || [])
        .filter(t => t.categoryId === cat.id && t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0);
      const pct    = budget > 0 ? (spent / budget) * 100 : (spent > 0 ? 100 : 0);
      return { name: cat.name, budget, spent, pct: Math.min(100, pct), rawPct: pct };
    })
    .filter(item => item.budget > 0 || item.spent > 0) // Nascondi categorie vuote con budget 0
    .sort((a, b) => b.spent - a.spent);

  const getColor = (pct) => pct >= 100 ? 'var(--status-red)' : pct > 80 ? 'var(--status-yellow)' : 'var(--chart-primary)';

  const noBudgetsConfigured = Object.values(categoryBudgets).every(v => !v || v === 0);
  const categoriesSenzaBudget = data.categories
  .filter(c => c.group === 'variable')
  .filter(c => {
    const budget = categoryBudgets[c.id] ?? 0;
    const spent = (computed.paidPeriodTx || [])
      .filter(t => t.categoryId === c.id && t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    return budget === 0 && spent > 0;
  });
  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2>Budget vs Actual</h2>
          <p className="kpi-sub">Confronto tra budget mensile e spesa effettiva per categoria variabile.</p>
        </div>
        {computed.efficienzaBudget !== undefined && (
          <div style={{ display: 'flex', gap: '2rem', textAlign: 'right' }}>
            <div>
              <div className="kpi-label">Pacing Ratio</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: computed.pacingRatio > 1 ? 'var(--status-red)' : 'var(--status-green)' }}>
                {computed.pacingRatio?.toFixed(2)}x
              </div>
            </div>
            <div>
              <div className="kpi-label">Efficienza Budget</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: computed.efficienzaBudget >= 0 ? 'var(--status-green)' : 'var(--status-red)' }}>
                {computed.efficienzaBudget >= 0 ? '+' : ''}{computed.efficienzaBudget?.toFixed(1)}% di avanzo
              </div>
            </div>
          </div>
        )}
      </div>

      {noBudgetsConfigured && (
        <div className="flex items-start gap-3 p-4 rounded" style={{ background: 'var(--status-yellow-bg)', border: '1px solid var(--status-yellow)' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--status-yellow)', fontWeight: 600 }}>
            ⚠ Nessun budget configurato.{' '}
            <span style={{ fontWeight: 400 }}>
              Vai in <strong>Impostazioni</strong> per definire il budget mensile per ogni categoria variabile.
            </span>
          </span>
        </div>
      )}
      {categoriesSenzaBudget.length > 0 && (
  <div className="flex items-start gap-3 p-4 rounded" style={{ background: 'var(--status-yellow-bg)', border: '1px solid var(--status-yellow)' }}>
    <span style={{ fontSize: '0.875rem', color: 'var(--status-yellow)', fontWeight: 600 }}>
      ⚠ {categoriesSenzaBudget.length === 1 ? 'categoria ha' : 'categorie hanno'} spese ma nessun budget:{' '}
      <strong>{categoriesSenzaBudget.map(c => c.name).join(', ')}</strong>.{' '}
      <span style={{ fontWeight: 400 }}>Vai in <strong>Impostazioni</strong> per definire un limite di spesa.</span>
    </span>
  </div>
)}

      {!noBudgetsConfigured && budgetData.length > 0 && (
        <>
          <div className="card" style={{ height: 340 }}>
            <h3 className="mb-4">Distribuzione per Categoria</h3>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={budgetData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                <XAxis type="number" stroke="var(--text-secondary)" fontSize={11} tickFormatter={v => `€${v}`} />
                <YAxis dataKey="name" type="category" stroke="var(--text-primary)" fontSize={12} width={130} />
                <Tooltip
                  cursor={{ fill: 'var(--bg-tertiary)' }}
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '12px' }}
                  formatter={(value, name) => [formatEuro(value), name === 'spent' ? 'Speso' : 'Budget']}
                />
                <Bar dataKey="budget" fill="var(--bg-tertiary)" radius={[0, 4, 4, 0]} barSize={18} />
                <Bar dataKey="spent" radius={[0, 4, 4, 0]} barSize={18}>
                  {budgetData.map((entry, i) => <Cell key={i} fill={getColor(entry.rawPct)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
            {budgetData.map((item, i) => {
              const catId = data.categories.find(c => c.name === item.name)?.id;
              const incomeRatio = catId ? (computed.expenseRatioByCategory?.[catId] ?? null) : null;
              return (
                <div key={i} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 600 }}>{item.name}</h4>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: getColor(item.rawPct) }}>
                      {Math.round(item.rawPct)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted mb-2">
                    <span>Speso: <strong style={{ color: 'var(--text-primary)' }}>{formatEuro(item.spent)}</strong></span>
                    <span>Budget: {formatEuro(item.budget)}</span>
                  </div>
                  <div className="progress-container">
                    <div className="progress-bar" style={{ width: `${item.pct}%`, backgroundColor: getColor(item.rawPct) }} />
                  </div>
                  {item.budget > 0 && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {item.rawPct < 100 ? (
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--status-green)' }}>
                          ✓ Rimangono {formatEuro(item.budget - item.spent)}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--status-red)' }}>
                          ⚠ Sforato di {formatEuro(item.spent - item.budget)}
                        </span>
                      )}
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {computed.giorniMancantiAlProssimoAccredito}gg al stipendio
                      </span>
                    </div>
                  )}
                  {incomeRatio != null && incomeRatio > 0 && (
                    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>% sul reddito</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: incomeRatio > 20 ? 'var(--status-red)' : incomeRatio > 10 ? 'var(--status-yellow)' : 'var(--text-muted)' }}>
                        {incomeRatio.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      
      {!noBudgetsConfigured && budgetData.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <p>Nessuna spesa variabile registrata ancora questo ciclo.</p>
        </div>
      )}
    </div>
  );
}

CASHCONTROL.JSX

import React, { useMemo } from 'react';
import { useFinanceData } from '../context/FinanceContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import EmptyState from '../components/EmptyState';

export default function CashControl({ onNavigate }) {
  const { data, computed } = useFinanceData();
  const formatEuro = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

  if (!computed.activePeriod) return <EmptyState onGoToAdmin={() => onNavigate?.('admin')} />;

  // FIX 1.2 + 1.6 + F06: dati ora provengono dal context
  const { bridgeData, stressDays, daysToSalary, finalBridgeBalance, giorniCritici } = computed;
  const isSafe = finalBridgeBalance >= data.settings.safetyBuffer;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h2>Cash Control: Bridge to Salary</h2>
        <p className="kpi-sub">
          Simulazione dell'erosione del saldo fino al prossimo accredito.{' '}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Burn variabile: {formatEuro(computed.spesaMediaGiornalieraVariabileAttuale)}/gg (media storica)
          </span>
        </p>
      </div>

      {/* GRAFICO PRINCIPALE */}
      <div className="card" style={{ height: '380px', padding: '1.5rem 1rem 1rem' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Proiezione Saldo Operativo (gg per gg)
        </p>
        <ResponsiveContainer width="100%" height="90%">
          <AreaChart data={bridgeData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradBalance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="var(--text-secondary)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              interval={Math.floor(daysToSalary / 7)}
            />
            <YAxis
              stroke="var(--text-secondary)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `€${v}`}
              width={70}
            />
            <Tooltip
              cursor={{ stroke: 'var(--border-color)', strokeWidth: 1 }}
              contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}
              formatter={v => [formatEuro(v), 'Saldo Previsto']}
            />
            <ReferenceLine
              y={data.settings.safetyBuffer}
              stroke="var(--status-yellow)"
              strokeDasharray="5 5"
              label={{ value: `Buffer ${formatEuro(data.settings.safetyBuffer)}`, position: 'insideTopRight', fontSize: 10, fill: 'var(--status-yellow)' }}
            />
            <Area
              type="monotone"
              dataKey="Saldo"
              stroke="#3b82f6"
              strokeWidth={3}
              fill="url(#gradBalance)"
              dot={false}
              activeDot={{ r: 7, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid-2col" style={{ alignItems: 'start' }}>
        {/* STRESS DAYS */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <AlertTriangle size={16} color="var(--status-yellow)" />
            <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Addebiti Fissi Rilevanti
            </span>
          </div>
          {stressDays.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Nessun giorno critico rilevato.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {stressDays.map((sd, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--status-red)' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{sd.date}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{sd.names}</div>
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--status-red)' }}>
                    -{formatEuro(sd.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RUNWAY ANALYSIS */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <TrendingDown size={16} color="var(--text-muted)" />
            <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Analisi Runway
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { label: 'Giorni alla paga', value: `${daysToSalary} gg`, color: 'var(--text-primary)' },
              { label: 'Giorni critici (< Buffer)', value: `${giorniCritici} gg`, color: giorniCritici > 0 ? 'var(--status-red)' : 'var(--status-green)' },
              { label: 'Burn variabile/gg (media)', value: formatEuro(computed.spesaMediaGiornalieraVariabileAttuale), color: 'var(--status-yellow)' },
              { label: 'Impegni fissi residui', value: formatEuro(computed.usciteFissePianificateResidue), color: 'var(--status-red)' },
              { label: 'Saldo finale stimato', value: formatEuro(finalBridgeBalance), color: isSafe ? 'var(--status-green)' : 'var(--status-red)' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: i < 4 ? '1px solid var(--border-color)' : 'none' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{row.label}</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

DAILYSPENDING.JSX 

import React, { useState } from 'react';
import { useFinanceData } from '../context/FinanceContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import TransactionFormModal from '../components/TransactionFormModal';
import { format, parseISO, addDays } from 'date-fns';
import { Plus } from 'lucide-react';
import EmptyState from '../components/EmptyState';

export default function VariableCosts({ onNavigate }) {
  const { data, computed } = useFinanceData();
  const deleteTransaction = useFinanceStore(state => state.deleteTransaction);
  const [filterNature, setFilterNature] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const formatEuro = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);
const formatDate = (dateStr) => {
  try { return format(parseISO(dateStr), 'dd/MM/yy'); }
  catch { return '—'; }
};
  if (!computed.activePeriod) return <EmptyState onGoToAdmin={() => onNavigate?.('admin')} />;

  // Solo uscite variabili (esclude fisse e stipendio)
  const variableTx = (computed.periodTx || []).filter(
    t => t.nature === 'variable' || t.nature === 'extraordinary'
  );
  const sortedTx = [...variableTx].sort((a, b) => new Date(b.date) - new Date(a.date));
  const filteredTx = filterNature === 'all' ? sortedTx : sortedTx.filter(t => t.nature === filterNature);

  // Grafico cumulato spesa variabile
  const startDate = parseISO(computed.activePeriod.startDate);
  let cum = 0;
  const daysToRender = Math.max(1, (computed.daysElapsed ?? 0) + 1);
  const chartData = Array.from({ length: daysToRender }, (_, i) => {
    const day = addDays(startDate, i);
    const dateStr = format(day, 'yyyy-MM-dd');
    const daySpend = variableTx
      .filter(t => t.date === dateStr && t.status === 'paid')
      .reduce((s, t) => s + t.amount, 0);
    cum += daySpend;
    return { date: format(day, 'dd/MM'), cumulative: Number(cum.toFixed(2)) };
  });

  const totalVariablePaid = variableTx.filter(t => t.status === 'paid').reduce((s, t) => s + t.amount, 0);
  const totalVariablePlanned = variableTx.filter(t => t.status === 'planned').reduce((s, t) => s + t.amount, 0);

  const statusColors = {
    paid:    { bg: 'rgba(16,185,129,0.12)',  color: 'var(--status-green)'  },
    planned: { bg: 'rgba(245,158,11,0.12)',  color: 'var(--status-yellow)' },
  };
  const natureColors = {
    variable:      { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6'  },
    extraordinary: { bg: 'rgba(249,115,22,0.12)',  color: '#f97316'  },
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2>Costi Variabili</h2>
          <p className="kpi-sub">Spese discrezionali del ciclo fiscale attivo</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> Nuova Spesa
        </button>
      </div>

      {/* KPI */}
      <div className="grid-3col">
        <div className="card">
          <div className="kpi-label">Speso (Actual)</div>
          <div className="kpi-value text-xl text-yellow">{formatEuro(totalVariablePaid)}</div>
          <p className="kpi-sub mt-1">Già contabilizzato</p>
        </div>
        <div className="card">
          <div className="kpi-label">Spendibile al Giorno</div>
          <div className="kpi-value text-xl" style={{ color: computed.spendibileGiornalieroFinoAlProssimoStipendio >= 0 ? 'var(--status-green)' : 'var(--status-red)' }}>
            {formatEuro(computed.spendibileGiornalieroFinoAlProssimoStipendio)}
          </div>
          <p className="kpi-sub mt-1">Al netto di fissi e buffer</p>
        </div>
        <div className="card">
          <div className="kpi-label">Giorni al Prossimo Stipendio</div>
          <div className="kpi-value text-xl">{computed.giorniMancantiAlProssimoAccredito} <span className="text-sm font-medium text-muted">gg</span></div>
          <p className="kpi-sub mt-1">Media: {formatEuro(computed.spesaMediaGiornalieraVariabileAttuale ?? 0)}/gg</p>
        </div>
      </div>

      {/* Chart */}
      <div className="card" style={{ height: 280 }}>
        <h3 className="mb-4">Andamento Cumulato Spesa Variabile</h3>
        <ResponsiveContainer width="100%" height="82%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `€${v}`} width={65} />
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '12px' }}
              formatter={v => [formatEuro(v), 'Spesa Cumulata']}
            />
            <Line type="monotone" dataKey="cumulative" stroke="var(--status-yellow)" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3>Registro Movimenti Variabili</h3>
          <select
            value={filterNature}
            onChange={e => setFilterNature(e.target.value)}
            style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
          >
            <option value="all">Tutte</option>
            <option value="variable">Variabili</option>
            <option value="extraordinary">Straordinarie</option>
          </select>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrizione</th>
              <th>Natura</th>
              <th>Stato</th>
              <th style={{ textAlign: 'right' }}>Importo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredTx.map(tx => {
              const sc = statusColors[tx.status] || statusColors.paid;
              const nc = natureColors[tx.nature] || natureColors.variable;
              return (
                <tr key={tx.id}>
                  <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {formatDate(tx.date)}
                  </td>
                  <td style={{ fontWeight: 600 }}>{tx.description}</td>
                  <td>
                    <span className="badge" style={{ backgroundColor: nc.bg, color: nc.color }}>
                      {tx.nature}
                    </span>
                  </td>
                  <td>
                    <span className="badge" style={{ backgroundColor: sc.bg, color: sc.color }}>
                      {tx.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    -{formatEuro(tx.amount)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                  <button
                    onClick={() => {
                  if (window.confirm(`Eliminare "${tx.description}"?`)) {
                  deleteTransaction(tx.id);
      }
    }}
    style={{
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: 'var(--status-red)',
      opacity: 0.6,
      padding: '0.25rem',
    }}
    title="Elimina transazione"
  >
    🗑
  </button>
</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredTx.length === 0 && (
          <div className="p-8 text-center text-muted italic text-sm">
            Nessuna spesa variabile registrata ancora.<br />
            Usa il pulsante "Nuova Spesa" per aggiungere una transazione.
          </div>
        )}
      </div>

      <TransactionFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

FIXEDCOSTS.JSX 

import React from 'react';
import { useFinanceData } from '../context/FinanceContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import EmptyState from '../components/EmptyState';

export default function FixedCosts({ onNavigate }) {
  const { data, computed } = useFinanceData();
  const markFixedCostAsPaid = useFinanceStore(state => state.markFixedCostAsPaid);
  const unmarkFixedCostAsPaid = useFinanceStore(state => state.unmarkFixedCostAsPaid);

  const formatEuro = (val) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

  if (!computed.activePeriod) return <EmptyState onGoToAdmin={() => onNavigate?.('admin')} />;

  // Transazioni fisse del ciclo corrente (paid + planned). Include anche income ricorrenti
  const allFixedTx = computed.periodTx.filter(
  t => t.nature === 'fixed' && (t.type === 'expense' || t.type === 'investment')
);
  const paidFixed    = allFixedTx.filter(t => t.status === 'paid');
  const plannedFixed = allFixedTx.filter(t => t.status === 'planned');

  const totalFixed   = allFixedTx.reduce((s, t) => s + t.amount, 0);
  const totalPaid    = paidFixed.reduce((s, t) => s + t.amount, 0);
  const totalPlanned = plannedFixed.reduce((s, t) => s + t.amount, 0);

  // Regole ricorrenti con info scadenza per la sezione informativa
  const currentPeriodId = computed.activePeriod.id;
  const activeRules = data.recurringRules.filter(r =>
    (!r.startDate || currentPeriodId >= r.startDate) &&
    (!r.endDate   || currentPeriodId <= r.endDate)
  );
  const expiringRules = activeRules.filter(r => r.endDate && r.endDate === currentPeriodId);
  const futureRules   = data.recurringRules.filter(r => r.startDate && currentPeriodId < r.startDate);

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div>
        <h2>Costi Fissi</h2>
        <p className="kpi-sub">Impegni ricorrenti del ciclo fiscale. Confermali man mano che vengono addebitati.</p>
      </div>

      {/* KPI Summary */}
      <div className="grid-3col">
        <div className="card" style={{ borderTop: '3px solid var(--border-color)' }}>
          <div className="kpi-label">Totale Fissi del Ciclo</div>
          <div className="kpi-value text-xl">{formatEuro(totalFixed)}</div>
          <p className="kpi-sub mt-1">{allFixedTx.length} voci pianificate</p>
        </div>
        <div className="card" style={{ borderTop: '3px solid var(--status-green)' }}>
          <div className="kpi-label">Già Confermati (Pagati)</div>
          <div className="kpi-value text-xl text-green">{formatEuro(totalPaid)}</div>
          <p className="kpi-sub mt-1">{paidFixed.length} voci pagate</p>
        </div>
        <div className="card" style={{ borderTop: '3px solid var(--status-yellow)' }}>
          <div className="kpi-label">Ancora da Confermare</div>
          <div className="kpi-value text-xl text-yellow">{formatEuro(totalPlanned)}</div>
          <p className="kpi-sub mt-1">{plannedFixed.length} voci in attesa · già detratte dallo spendibile</p>
        </div>
      </div>

      {/* INFO: Scadenze imminenti */}
      {expiringRules.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded" style={{ background: 'var(--status-yellow-bg)', border: '1px solid var(--status-yellow)' }}>
          <AlertCircle size={18} color="var(--status-yellow)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--status-yellow)' }}>Ultima rata questo mese</div>
            <div className="kpi-sub mt-1">
              {expiringRules.map(r => r.name).join(', ')} — non verrà più addebitato il mese prossimo.
            </div>
          </div>
        </div>
      )}

      {/* TABELLA PRINCIPALE */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3>Dettaglio Voci del Ciclo Attivo</h3>
          <span className="kpi-sub">{format(parseISO(computed.activePeriod.startDate), 'dd MMM', { locale: it })} → {format(parseISO(computed.activePeriod.endDate), 'dd MMM yyyy', { locale: it })}</span>
        </div>

        {/* DA PAGARE */}
        {plannedFixed.length > 0 && (
          <div>
            <div className="px-4 py-2 border-b flex items-center gap-2" style={{ background: 'var(--bg-primary)' }}>
              <Clock size={13} color="var(--status-yellow)" />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                Da Confermare
              </span>
            </div>
            {plannedFixed
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .map(tx => (
                <div key={tx.id} className="flex items-center justify-between border-b" style={{ padding: '1rem 1.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{tx.description}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Previsto: {format(parseISO(tx.date), 'dd MMMM yyyy', { locale: it })}
                      {tx.type === 'investment' && (
                        <span style={{ marginLeft: '0.5rem', color: '#8b5cf6', fontWeight: 600 }}>· Investimento</span>
                      )}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--status-red)' }}>
                        {formatEuro(tx.amount)}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--status-yellow)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        pianificato
                      </div>
                    </div>
                    <button
                      onClick={() => markFixedCostAsPaid(tx.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.6rem 1.25rem',
                        background: 'rgba(16,185,129,0.1)',
                        border: '1px solid var(--status-green)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--status-green)',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'background 0.15s',
                      }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(16,185,129,0.2)'}
                      onMouseOut={e => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}
                    >
                      <CheckCircle2 size={15} /> Pagato
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* GIA PAGATI */}
        {paidFixed.length > 0 && (
          <div>
            <div className="px-4 py-2 border-b flex items-center gap-2" style={{ background: 'var(--bg-primary)' }}>
              <CheckCircle2 size={13} color="var(--status-green)" />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                Già Confermati
              </span>
            </div>
            {paidFixed
              .sort((a, b) => new Date(b.paidAt || b.date) - new Date(a.paidAt || a.date))
              .map(tx => (
                <div key={tx.id} className="flex items-center justify-between border-b" style={{ padding: '1rem 1.5rem', opacity: 0.7 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', textDecoration: 'line-through', color: 'var(--text-secondary)' }}>
                      {tx.description}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {format(parseISO(tx.date), 'dd MMMM', { locale: it })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-secondary)' }}>
                      {formatEuro(tx.amount)}
                    </span>
                    <CheckCircle2 size={20} color="var(--status-green)" />
                    <button
                      onClick={() => unmarkFixedCostAsPaid(tx.id)}
                      style={{
                        marginLeft: '0.5rem',
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.7rem',
                        background: 'transparent',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {allFixedTx.length === 0 && (
          <div className="p-8 text-center text-muted italic text-sm">
            Nessun costo fisso nel ciclo corrente.<br/>
            Vai in Admin / Setup → "Registra Stipendio" per inizializzare il ciclo.
          </div>
        )}
      </div>

      {/* INFO REGOLE ATTIVE */}
      <div className="card">
        <h3 className="mb-4">Regole Attive per questo Ciclo</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {data.recurringRules.map(rule => {
            const isActive =
              (!rule.startDate || currentPeriodId >= rule.startDate) &&
              (!rule.endDate   || currentPeriodId <= rule.endDate);
            const isFuture = rule.startDate && currentPeriodId < rule.startDate;
            const isExpiring = rule.endDate && rule.endDate === currentPeriodId;
            return (
              <div key={rule.id} className="flex items-center justify-between p-3 rounded border" style={{
                background: isActive ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
                borderColor: isActive ? 'var(--border-color)' : 'transparent',
                opacity: isActive ? 1 : 0.4,
              }}>
                <div style={{ display: 'flex', flex: 1, gap: '1rem', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{rule.name}</span>
                    <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      giorno {rule.dayOfMonth} del mese
                    </span>
                  </div>
                  {rule.endDate && (
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.6rem',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: isExpiring ? 'var(--status-yellow-bg)' : 'var(--bg-tertiary)',
                      color: isExpiring ? 'var(--status-yellow)' : 'var(--text-muted)',
                    }}>
                      {isExpiring ? '⚠ Ultima rata' : `Fino a ${rule.endDate}`}
                    </span>
                  )}
                  {!rule.endDate && !rule.startDate && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Permanente</span>
                  )}
                  {rule.startDate && currentPeriodId < rule.startDate && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.6rem', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
                      ▶ Parte da {rule.startDate}
                    </span>
                  )}
                </div>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: isActive ? 'var(--text-primary)' : 'var(--text-muted)', minWidth: '90px', textAlign: 'right' }}>
                  {formatEuro(rule.amount)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

FORECAST.JSX

import React from 'react';
import { useFinanceData } from '../context/FinanceContext';
import { Target, AlertTriangle, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import EmptyState from '../components/EmptyState';

export default function Forecast({ onNavigate }) {
  const { data, computed } = useFinanceData();
  const formatEuro = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

  if (!computed.activePeriod) return <EmptyState onGoToAdmin={() => onNavigate?.('admin')} />;

  // FIX 1.6: tutti i dati ora provengono dal context (SSOT)
  const {
    scenariForecast,
    proiezioneAffidabile,
    spesaMediaGiornalieraVariabileAttuale,
    costiFissiTotaliCiclo,
    targetChiusura,
    saldoBaseChiusura,
    gapTarget,
    isOffTrack,
    daysElapsed,
    proiezioneAnnualeRisparmio,
    goalsMonthlyTarget,
    proiezioneVsObiettiviGap,
    inLineaConObiettivi,
  } = computed;

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div>
        <h2>Motore di Previsione</h2>
        <p className="kpi-sub">
          Proiezioni basate sulla tua spesa variabile media attuale di {formatEuro(spesaMediaGiornalieraVariabileAttuale)}/gg.
        </p>
      </div>

      {/* FIX 3.9: avviso proiezione non affidabile nei primi giorni */}
      {!proiezioneAffidabile && (
        <div className="flex items-start gap-3 p-4 rounded" style={{ background: 'var(--status-yellow-bg)', border: '1px solid var(--status-yellow)' }}>
          <Clock size={18} color="var(--status-yellow)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--status-yellow)' }}>
              Proiezione non ancora disponibile
            </div>
            <div className="kpi-sub mt-1">
              Servono almeno 3 giorni di spesa variabile per calcolare una proiezione affidabile.
              Oggi è il giorno {daysElapsed} del ciclo.
            </div>
          </div>
        </div>
      )}

      {proiezioneAffidabile && (
        <>
          <div className="grid-3col">
            <div className="card">
              <div className="kpi-label">Spesa Media Giornaliera</div>
              <div className="kpi-value text-xl">{formatEuro(spesaMediaGiornalieraVariabileAttuale)}<span className="text-sm font-medium text-muted"> / gg</span></div>
              <p className="kpi-sub mt-1">Calcolata su {daysElapsed} gg trascorsi.</p>
            </div>

            <div className="card">
              <div className="kpi-label">Uscite Totali Proiettate</div>
              <div className="kpi-value text-xl text-yellow">
                {formatEuro(costiFissiTotaliCiclo + (computed.proiezioneVariabileBase || 0))}
              </div>
              <p className="kpi-sub mt-1">Fissi {formatEuro(costiFissiTotaliCiclo)} + Variabili proiettati</p>
            </div>

            <div className="card" style={{ borderTop: `3px solid ${isOffTrack ? 'var(--status-red)' : 'var(--status-green)'}` }}>
              <div className="kpi-label">Chiusura Stimata (Base)</div>
              <div className="kpi-value text-xl" style={{ color: isOffTrack ? 'var(--status-red)' : 'var(--status-green)' }}>
                {saldoBaseChiusura !== null ? formatEuro(saldoBaseChiusura) : '—'}
              </div>
              {gapTarget !== null && (
                <div className="flex items-center gap-1 mt-1 text-xs font-medium" style={{ color: isOffTrack ? 'var(--status-red)' : 'var(--status-green)' }}>
                  {isOffTrack ? <AlertTriangle size={12} /> : <Target size={12} />}
                  Target {formatEuro(targetChiusura)}: {gapTarget > 0 ? '+' : ''}{formatEuro(gapTarget)}
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ height: 380 }}>
            <h3 className="mb-4">Scenari di Chiusura Ciclo</h3>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={scenariForecast} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `€${v}`} width={80} />
                <Tooltip
                  cursor={{ fill: 'var(--bg-tertiary)' }}
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '12px' }}
                  formatter={(value) => formatEuro(value)}
                />
                <ReferenceLine y={targetChiusura} stroke="var(--status-green)" strokeDasharray="4 4"
                  label={{ position: 'insideTopRight', value: 'Target', fill: 'var(--status-green)', fontSize: 11 }} />
                <ReferenceLine y={data.settings.safetyBuffer} stroke="var(--status-red)" strokeDasharray="4 4"
                  label={{ position: 'insideBottomRight', value: 'Buffer', fill: 'var(--status-red)', fontSize: 11 }} />
                <Bar dataKey="saldo" radius={[6, 6, 0, 0]} maxBarSize={120}>
                  {scenariForecast.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ borderTop: `3px solid ${inLineaConObiettivi ? 'var(--status-green)' : 'var(--status-red)'}` }}>
            <h3 className="mb-4">Proiezione Annuale e Obiettivi</h3>
            <div className="grid-3col">
              <div>
                <div className="kpi-label">Risparmio Stimato Annuo</div>
                <div className="kpi-value text-xl">{formatEuro(proiezioneAnnualeRisparmio)}</div>
                <p className="kpi-sub mt-1">Estrapolazione del risparmio del ciclo corrente</p>
              </div>
              <div>
                <div className="kpi-label">Target Mensile Obiettivi</div>
                <div className="kpi-value text-xl">{formatEuro(goalsMonthlyTarget)}</div>
                <p className="kpi-sub mt-1">Importo necessario per i tuoi obiettivi con scadenza</p>
              </div>
              <div>
                <div className="kpi-label">Gap Annualizzato</div>
                <div className="kpi-value text-xl" style={{ color: inLineaConObiettivi ? 'var(--status-green)' : 'var(--status-red)' }}>
                  {proiezioneVsObiettiviGap > 0 ? '+' : ''}{formatEuro(proiezioneVsObiettiviGap * 12)}
                </div>
                <p className="kpi-sub mt-1">Differenza proiettata a fine anno</p>
              </div>
            </div>
            {goalsMonthlyTarget === 0 && (
              <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Nessun obiettivo con scadenza impostato.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

GOALS.JSX 

import React, { useState } from 'react';
import { useFinanceData } from '../context/FinanceContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { useToast } from '../components/Toast';
import { Target, Plus, Trash2, Edit3, Check, X } from 'lucide-react';
import EmptyState from '../components/EmptyState';

export default function Goals({ onNavigate }) {
  const { data, computed } = useFinanceData();
  // AUDIT REAL CODE: Goals view reads `computed.goalFundingRate` (if present) and uses store.goals.
  // UI earmarking not added here yet; store provides assignGoalToAccount/unassignGoalFromAccount.
  const addGoal = useFinanceStore(state => state.addGoal);
  const updateGoal = useFinanceStore(state => state.updateGoal);
  const deleteGoal = useFinanceStore(state => state.deleteGoal);
  const assignGoalToAccount = useFinanceStore(state => state.assignGoalToAccount);
  const unassignGoalFromAccount = useFinanceStore(state => state.unassignGoalFromAccount);
  const showToast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', targetAmount: '', currentAmount: '', deadline: '' });

  // FIX 3.11: Goals non usa più EmptyState — mostra sempre anche senza ciclo attivo
  // (i goals sono indipendenti dal ciclo corrente)

  const formatEuro = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

  const resetForm = () => {
    setForm({ name: '', targetAmount: '', currentAmount: '', deadline: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = () => {
    const target = parseFloat(form.targetAmount);
    const current = parseFloat(form.currentAmount || 0);

    if (!form.name.trim()) { showToast('Inserisci un nome per l\'obiettivo', 'error'); return; }
    if (isNaN(target) || target <= 0) { showToast('Importo target non valido', 'error'); return; }
    if (isNaN(current) || current < 0) { showToast('Importo attuale non valido', 'error'); return; }

    if (editingId) {
      updateGoal(editingId, { name: form.name, targetAmount: target, currentAmount: current, deadline: form.deadline });
      showToast('Obiettivo aggiornato', 'success');
    } else {
      addGoal({ name: form.name, targetAmount: target, currentAmount: current, deadline: form.deadline });
      showToast('Obiettivo aggiunto', 'success');
    }
    resetForm();
  };

  const handleEdit = (goal) => {
    setForm({ name: goal.name, targetAmount: goal.targetAmount, currentAmount: goal.currentAmount, deadline: goal.deadline || '' });
    setEditingId(goal.id);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (!window.confirm('Eliminare questo obiettivo?')) return;
    deleteGoal(id);
    showToast('Obiettivo eliminato', 'warning');
  };

  const goals = data.goals || [];
  const accounts = data.accounts || [];
  // G-13: se il goal ha earmarkedAccountId, mostra il saldo reale del conto come currentAmount
const goalsWithLiveBalance = goals.map(goal => {
  if (!goal.earmarkedAccountId) return goal;
  const linked = accounts.find(a => a.id === goal.earmarkedAccountId);
  if (!linked) return goal;
  const liveBalance = linked.currentBalance ?? linked.balance ?? 0;
  return { ...goal, currentAmount: liveBalance };
});

  const calculateRequiredMonthly = (allGoals) => {
    let totalMonthly = 0;
    allGoals.forEach(g => {
      const remaining = g.targetAmount - g.currentAmount;
      if (remaining <= 0 || !g.deadline) return;
      const deadlineDate = new Date(g.deadline + '-01');
      const today = new Date();
      let months = (deadlineDate.getFullYear() - today.getFullYear()) * 12 + (deadlineDate.getMonth() - today.getMonth());
      if (months < 1) months = 1;
      totalMonthly += remaining / months;
    });
    return totalMonthly;
  };

  const targetMensileNecessario = calculateRequiredMonthly(goalsWithLiveBalance);
  const targetPianificato = data.settings?.targetSavingsAmount || 0;
  const isTargetSafe = targetPianificato >= targetMensileNecessario;

  const inputStyle = {
    width: '100%', padding: '0.625rem 0.75rem',
    background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    fontSize: '0.95rem', boxSizing: 'border-box',
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2>Obiettivi Finanziari</h2>
          <p className="kpi-sub">Traccia i tuoi traguardi patrimoniali nel lungo periodo.</p>
        </div>
        <button
          className="btn btn-primary flex items-center gap-2"
          onClick={() => { resetForm(); setShowForm(true); }}
        >
          <Plus size={16} /> Nuovo Obiettivo
        </button>
      </div>

      <div className="grid-2col">
        <div className="card" style={{ borderTop: `3px solid ${isTargetSafe ? 'var(--status-green)' : 'var(--status-red)'}` }}>
          <div className="kpi-label">Obiettivo Mensile Aggregato</div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: isTargetSafe ? 'var(--status-green)' : 'var(--status-red)' }}>
              {formatEuro(targetMensileNecessario)} / mese
            </span>
            {!isTargetSafe && targetMensileNecessario > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--status-red)' }}>Dovresti risparmiare di più!</span>}
          </div>
        </div>
        <div className="card" style={{ borderTop: '3px solid var(--text-primary)' }}>
          <div className="kpi-label">Risparmio Pianificato (Settings)</div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              {formatEuro(targetPianificato)} / ciclo
            </span>
          </div>
        </div>
      </div>
      
      <div className="card" style={{ padding: '1rem', borderTop: `3px solid ${computed.goalFundingRate == null ? 'var(--border-color)' : computed.goalFundingRate >= 100 ? 'var(--status-green)' : 'var(--status-yellow)'}` }}>
  <div className="flex flex-col gap-2">
    <span>Ritmo risparmio attuale copre</span>
    {computed.goalFundingRate == null ? (
      <strong style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>— % del target mensile goal</strong>
    ) : (
      <>
        <strong style={{ fontSize: '1.2rem' }}>{computed.goalFundingRate.toFixed(0)}% del target mensile goal</strong>
        {computed.goalFundingRate < 100 && (
          <p className="kpi-sub" style={{ color: 'var(--status-red)' }}>
            ⚠️ Ritmo insufficiente: mancano {((computed.goalsMonthlyTarget ?? 0) - (computed.risparmioNettoMensile ?? 0)).toFixed(0)}€/mese
          </p>
        )}
      </>
    )}
  </div>
</div>

      {/* FORM ADD/EDIT */}
      {showForm && (
        <div className="card" style={{ borderTop: '3px solid var(--chart-primary)' }}>
          <h3 className="mb-4">{editingId ? 'Modifica Obiettivo' : 'Nuovo Obiettivo'}</h3>
          <div className="grid-3col mb-4">
            <div>
              <label className="kpi-label mb-1">Nome Obiettivo</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="es. Fondo Emergenza, Vacanza..."
                style={inputStyle}
              />
            </div>
            <div>
              <label className="kpi-label mb-1">Target (€)</label>
              <input
                type="number"
                value={form.targetAmount}
                onChange={e => setForm(p => ({ ...p, targetAmount: e.target.value }))}
                min={1}
                style={{ ...inputStyle, color: 'var(--status-green)', fontWeight: 700 }}
              />
            </div>
            <div>
              <label className="kpi-label mb-1">Già Accantonato (€)</label>
              <input
                type="number"
                value={form.currentAmount}
                onChange={e => setForm(p => ({ ...p, currentAmount: e.target.value }))}
                min={0}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="kpi-label mb-1">Entro il (Mese/Anno - Opzionale)</label>
              <input
                type="month"
                value={form.deadline || ''}
                onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost flex items-center gap-2" onClick={resetForm}>
              <X size={15} /> Annulla
            </button>
            <button className="btn btn-primary flex items-center gap-2" onClick={handleSave}>
              <Check size={15} /> {editingId ? 'Aggiorna' : 'Aggiungi'}
            </button>
          </div>
        </div>
      )}

      {/* GOALS GRID */}
      {goals.length === 0 && !showForm && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ width: 56, height: 56, background: 'var(--bg-tertiary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <Target size={24} color="var(--text-muted)" />
          </div>
          <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>Nessun obiettivo</h3>
          <p className="kpi-sub">Premi "Nuovo Obiettivo" per iniziare a tracciare i tuoi traguardi finanziari.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
        {goalsWithLiveBalance.map(goal => {
          const pct = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
          const rawPct = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
          const color = rawPct >= 100 ? 'var(--status-green)' : rawPct > 60 ? 'var(--chart-primary)' : 'var(--status-yellow)';
          const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

          return (
            <div key={goal.id} className="card" style={{ position: 'relative' }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>{goal.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {remaining > 0 ? `Mancano ${formatEuro(remaining)}` : '🎉 Obiettivo raggiunto!'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleEdit(goal)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(goal.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-red)', padding: '0.25rem' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color }}>{formatEuro(goal.currentAmount)}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color }}>{Math.round(rawPct)}%</span>
              </div>
              <div className="progress-container" style={{ height: 8 }}>
                <div className="progress-bar" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
              <div className="flex justify-between text-xs text-muted mt-2">
                <span>Attuale: {formatEuro(goal.currentAmount)}</span>
                <span>Target: {formatEuro(goal.targetAmount)} {goal.deadline && `(entro ${goal.deadline})`}</span>
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Earmark su conto</label>
                <select
                  value={goal.earmarkedAccountId || ''}
                  onChange={e => {
                    const accId = e.target.value || null;
                    if (!accId) {
                      unassignGoalFromAccount(goal.id);
                      showToast('Earmark rimosso', 'success');
                      return;
                    }
                    assignGoalToAccount(goal.id, accId);
                    showToast('Earmark aggiornato', 'success');
                  }}
                  style={{ padding: '0.4rem', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="">— Nessun conto —</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                  ))}
                </select>
                {goal.earmarkedAccountId && (
                  <button onClick={() => { unassignGoalFromAccount(goal.id); showToast('Earmark rimosso', 'success'); }} className="btn btn-ghost" style={{ marginLeft: 'auto' }}>
                    Rimuovi
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

OVERVIEW.JSX 

import React from 'react';
import { useFinanceData } from '../context/FinanceContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { CheckCircle2, ShieldCheck, Zap, TrendingDown, Calendar } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

export default function Overview({ onNavigate }) {
  const { data, computed } = useFinanceData();
  const markFixedCostAsPaid = useFinanceStore(state => state.markFixedCostAsPaid);
  const formatEuro = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

  if (!computed.activePeriod) return <EmptyState onGoToAdmin={() => onNavigate?.('admin')} />;

  const pendingFixedCosts = computed.plannedPeriodTx?.filter(t => t.nature === 'fixed') || [];
  const isPositive = (computed.spendibileGiornalieroFinoAlProssimoStipendio ?? 0) >= 0;

  // ── Totali uscite del ciclo (per il tab di riepilogo) ───────────────────────
  const allFixedTx      = computed.periodTx?.filter(t => t.nature === 'fixed' && (t.type === 'expense' || t.type === 'investment')) || [];
  const totalFissiCiclo = allFixedTx.reduce((s, t) => s + t.amount, 0);          // paid + planned
  const totalVariabili  = computed.variableExpensesActual ?? 0;                   // solo paid
  const totalSpeso      = (computed.fixedExpensesActual ?? 0) + (computed.investmentActual ?? 0) + totalVariabili; // solo effettivamente usciti
  const totalImpegni    = computed.usciteFissePianificateResidue ?? 0;            // pianificati non ancora pagati

  return (
    <div className="animate-fade-in flex flex-col gap-6">

      {/* --- EXTRAORDINARY INCOME BADGE --- */}
      {computed.hasExtraordinaryIncome && (
        <div style={{ background: 'var(--status-yellow-bg)', color: 'var(--status-yellow)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={16} />
          Mese con entrata straordinaria — KPI normalizzati sul reddito ordinario
        </div>
      )}

      {/* --- PERIOD OVERRUN BANNER --- */}
      {computed.isPeriodOverrun && (
        <div style={{ background: 'var(--status-red-bg)', color: 'var(--status-red)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendingDown size={16} />
          Il periodo è scaduto — aggiorna la data di chiusura o registra lo stipendio per aprire il nuovo ciclo.
        </div>
      )}

      {/* ── HERO: SPENDIBILE GIORNALIERO ─────────────────────────────── */}
      <div className="card" style={{
        textAlign: 'center',
        padding: '3rem 2rem',
        background: 'linear-gradient(160deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)',
        borderTop: `4px solid ${isPositive ? 'var(--status-green)' : 'var(--status-red)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Zap size={14} color="var(--status-yellow)" />
          <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Budget Spendibile Giornaliero · Netto Costi Fissi
          </span>
        </div>
        <div style={{ fontSize: '4.5rem', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em', color: isPositive ? 'var(--status-green)' : 'var(--status-red)' }}>
          {formatEuro(computed.spendibileGiornalieroFinoAlProssimoStipendio ?? 0)}
        </div>
        <div style={{ marginTop: '1.25rem', display: 'inline-flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-primary)', padding: '0.5rem 1.25rem', borderRadius: '999px', border: '1px solid var(--border-color)' }}>
          <Calendar size={13} color="var(--text-muted)" />
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Prossimo stipendio
          </span>
          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            {format(parseISO(computed.activePeriod.endDate), 'dd MMMM yyyy', { locale: it })}
          </strong>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--status-green)' }}>
            tra {computed.giorniMancantiAlProssimoAccredito} gg
          </span>
        </div>
        <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          Patrimonio Netto:&nbsp;
          <span style={{ color: (computed.netWorth ?? 0) >= 0 ? 'var(--status-green)' : 'var(--status-red)', fontWeight: 800 }}>
            {formatEuro(computed.netWorth ?? 0)}
          </span>
        </div>
      </div>

      {/* --- ALERT REGOLE IN SCADENZA --- */}
      {computed.hasRegolaInScadenza && (
        <div style={{ background: 'var(--bg-tertiary)', borderLeft: '4px solid var(--status-yellow)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ℹ️ Regole in scadenza
          </div>
          {computed.regolaInScadenza.map((r, i) => (
            <div key={i} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {r.name} ({formatEuro(r.amount)}) termina in {r.daysLeft} giorni.
              Lo Spendibile Giornaliero aumenterà di {formatEuro(r.amount / computed.totalDaysInPeriod)}/giorno dal prossimo ciclo.
            </div>
          ))}
        </div>
      )}

      {/* ── RIGA CFO KPIs (Wealth & Efficiency) ──────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '-1rem' }}>
        <div className="card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: `3px solid ${computed.savingsRateTotal >= computed.savingsRateTarget ? 'var(--status-green)' : 'var(--status-yellow)'}` }}>
          <div className="kpi-label">Savings Rate</div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: computed.savingsRateTotal >= computed.savingsRateTarget ? 'var(--status-green)' : 'var(--status-yellow)' }}>
              {computed.savingsRateTotal?.toFixed(1)}%
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Totale vs {computed.savingsRateTarget?.toFixed(1)}%</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Ordinario: {computed.savingsRateOrdinary?.toFixed(1)}%
          </div>
        </div>

        <div className="card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: `3px solid ${computed.fixedCostCoverageRatio < 1.5 ? 'var(--status-red)' : 'var(--status-green)'}` }}>
          <div className="kpi-label">Fixed Cost Coverage</div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: computed.fixedCostCoverageRatio < 1.5 ? 'var(--status-red)' : 'var(--status-green)' }}>
              {computed.fixedCostCoverageRatio > 900 ? '∞' : computed.fixedCostCoverageRatio?.toFixed(2)}x
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{computed.fixedCostCoverageRatio < 1.5 ? 'Rischio (<1.5)' : 'Sicuro (>1.5)'}</span>
          </div>
        </div>

        <div className="card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: `3px solid ${computed.emergencyFundRatio < 3 ? 'var(--status-red)' : 'var(--status-green)'}` }}>
          <div className="kpi-label">Autonomia Finanziaria</div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: computed.emergencyFundRatio < 3 ? 'var(--status-red)' : 'var(--status-green)' }}>
              {computed.emergencyFundRatio > 900 ? '∞' : computed.emergencyFundRatio?.toFixed(1)} mesi
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{computed.emergencyFundRatio < 3 ? 'Rischio (<3 mesi)' : 'Ottimale'}</span>
          </div>
        </div>

        <div className="card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: `3px solid var(--status-green)` }}>
          <div className="kpi-label">Risparmio Cumulato (Storico)</div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--status-green)' }}>
              {computed.storicoSavingsRate?.toFixed(1)}%
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Media ultimi 6 cicli</span>
          </div>
        </div>

        <div className="card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: `3px solid var(--status-green)` }}>
          <div className="kpi-label">Wealth Accumulation Rate</div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--status-green)' }}>
              {computed.wealthAccumulationRate?.toFixed(1)}%
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PAC + Investimenti vs Entrate</span>
          </div>
        </div>

        <div className="card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '3px solid var(--border-color)' }}>
  <div className="kpi-label">Debt-to-Income (DTI)</div>
  <div className="flex items-center gap-2">
    {computed.totalMonthlyDebtService > 0 ? (
      <>
        <span style={{ fontSize: '1.5rem', fontWeight: 900, color: computed.debtToIncomeRatio < 20 ? 'var(--status-green)' : computed.debtToIncomeRatio < 30 ? 'var(--status-yellow)' : 'var(--status-red)' }}>
          {computed.debtToIncomeRatio?.toFixed(1)}%
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Soglia sana: {'<'} 30%</span>
      </>
    ) : (
      <>
        <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-muted)' }}>—</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nessun debito registrato</span>
      </>
    )}
  </div>
</div>

        <div className="card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: `3px solid var(--status-yellow)` }}>
          <div className="kpi-label">Cash Drag Annuo</div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--status-yellow)' }}>
              {formatEuro(computed.cashDragAnnuo || 0)}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rendimento perso su liquidità in eccesso</span>
          </div>
        </div>
      </div>

      {/* ── RIGA KPI: 3 numeri chiave ────────────────────────────────── */}
      <div className="grid-3col">

        {/* Liquidità disponibile netta */}
        <div className="card" style={{ borderLeft: '4px solid var(--status-green)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
            <ShieldCheck size={14} color="var(--status-green)" />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Liquidità Netta
            </span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, lineHeight: 1, color: isPositive ? 'var(--text-primary)' : 'var(--status-red)' }}>
            {formatEuro(computed.liquiditaDisponibileScudo ?? 0)}
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {[
              { label: 'Saldo banca',     value: computed.operatingLiquidity ?? 0,            sign: '',  color: 'var(--text-primary)'  },
              { label: 'Fissi residui',   value: computed.usciteFissePianificateResidue ?? 0, sign: '−', color: 'var(--status-red)'    },
              { label: 'Buffer',          value: data.settings.safetyBuffer ?? 0,             sign: '−', color: 'var(--status-yellow)' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                <span style={{ fontWeight: 700, color: r.color }}>{r.sign} {formatEuro(r.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Totale speso finora */}
        <div className="card" style={{ borderLeft: '4px solid var(--status-yellow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
            <TrendingDown size={14} color="var(--status-yellow)" />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Totale Uscite al Momento
            </span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, lineHeight: 1, color: 'var(--text-primary)' }}>
            {formatEuro(totalSpeso)}
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {[
              { label: 'Costi fissi pagati',    value: (computed.fixedExpensesActual ?? 0) + (computed.investmentActual ?? 0) },
              { label: 'Costi variabili',        value: totalVariabili },
              { label: 'Impegni fissi in attesa',value: totalImpegni, italic: true },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)', fontStyle: r.italic ? 'italic' : 'normal' }}>{r.label}</span>
                <span style={{ fontWeight: r.italic ? 600 : 700, color: r.italic ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                  {formatEuro(r.value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Totale impegni fissi del ciclo */}
        <div className="card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
            <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#8b5cf6', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Uscite Strutturali del Ciclo
            </span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, lineHeight: 1, color: '#8b5cf6' }}>
            {formatEuro(totalFissiCiclo)}
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {allFixedTx.map(tx => (
              <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {tx.status === 'paid'
                    ? <CheckCircle2 size={11} color="var(--status-green)" />
                    : <span style={{ width: 11, height: 11, borderRadius: '50%', border: '1.5px solid var(--status-yellow)', display: 'inline-block' }} />
                  }
                  {tx.description}
                </span>
                <span style={{ fontWeight: 700, color: tx.status === 'paid' ? 'var(--status-green)' : 'var(--text-muted)' }}>
                  {formatEuro(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
            {/* ── REDDITO RICORRENTE ATTESO ────────────────────────────────── */}
      {(computed.recurringIncomeExpected ?? 0) > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--status-green)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Reddito Ricorrente Atteso
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Entrate fisse pianificate ancora da incassare questo ciclo
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--status-green)', lineHeight: 1 }}>
              + {formatEuro(computed.recurringIncomeExpected)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Già incassato: {formatEuro(computed.incomeActual ?? 0)}
            </div>
          </div>
        </div>
      )}

      
      {/* ── CHECKLIST COSTI FISSI PENDENTI ──────────────────────────── */}
      {pendingFixedCosts.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <CheckCircle2 size={16} />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Costi Fissi da Confermare
            </span>
            <span style={{ marginLeft: 'auto', background: 'var(--status-red-bg)', color: 'var(--status-red)', borderRadius: '999px', padding: '0.1rem 0.6rem', fontSize: '0.7rem', fontWeight: 800 }}>
              {pendingFixedCosts.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pendingFixedCosts.map(tx => (
              <div key={tx.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.75rem 1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                borderLeft: '3px solid var(--status-red)',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{tx.description}</div>
                  <div style={{ fontWeight: 700, color: 'var(--status-red)', fontSize: '0.8rem' }}>{formatEuro(tx.amount)}</div>
                </div>
                <button
                  onClick={() => markFixedCostAsPaid(tx.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.45rem 1rem', background: 'rgba(16,185,129,0.1)',
                    border: '1px solid var(--status-green)', borderRadius: 'var(--radius-md)',
                    color: 'var(--status-green)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  <CheckCircle2 size={14} /> Pagato
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

PERIODCLOSE.JSX 

import React, { useState } from 'react';
import { useFinanceData } from '../context/FinanceContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { Lock, ShieldAlert, CheckCircle, AlertTriangle, Wallet, ArrowRight } from 'lucide-react';
import { format, parseISO, addMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import EmptyState from '../components/EmptyState';

export default function PeriodClose({ onNavigate }) {
  const { data, computed } = useFinanceData();
  // FIX 1.1: usa la nuova azione closePeriodAndOpenNext che genera i fissi
  const closePeriodAndOpenNext = useFinanceStore(state => state.closePeriodAndOpenNext);

  const [realBankBalance, setRealBankBalance] = useState(computed.operatingLiquidity ?? 0);
  // FIX 1.1: wizard richiede inserimento stipendio
  const [salaryAmount, setSalaryAmount] = useState(data.settings?.defaultIncome || 1900);
  const [isExtraordinaryIncome, setIsExtraordinaryIncome] = useState(false);
    const [accountUpdates, setAccountUpdates] = useState({});

  const formatEuro = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

  const theoreticalBalance = computed.operatingLiquidity ?? 0;
  const discrepancy = Number(realBankBalance) - theoreticalBalance;
  const isDiscrepancyHigh = Math.abs(discrepancy) > 10;
  const pendingFixed = (computed.plannedPeriodTx || []).filter(t => t.nature === 'fixed');

  const handleClosePeriod = () => {
    if (!computed.activePeriod) return;
    if (!window.confirm('Sei sicuro di voler chiudere il ciclo corrente e aprire quello successivo?')) return;

    if (Math.abs(discrepancy) > 10) {
      alert(`ATTENZIONE: Lo scostamento è di ${formatEuro(discrepancy)}. Verrà creata una transazione di Rettifica nel ciclo corrente per far quadrare i conti prima della chiusura.`);
    }
    const investmentAccount = data.accounts.find(a => a.type === 'investments');
const realInvestmentsBalance = investmentAccount
  ? (accountUpdates[investmentAccount.id] ?? investmentAccount.currentBalance ?? 0)
  : 0;
    // FIX 1.1: closePeriodAndOpenNext genera automaticamente i costi fissi planned
    closePeriodAndOpenNext({
      realBankBalance: Number(realBankBalance),
      salaryAmount: Number(salaryAmount) > 0 ? Number(salaryAmount) : null,
      discrepancy,
      isExtraordinaryIncome,
      accountUpdates, // [GAP-S03]
      realInvestmentsBalance,
    });

    const nextStart = format(
  addMonths(parseISO(computed.activePeriod.startDate), 1),
  'dd MMM', { locale: it }
);
    alert(`Ciclo chiuso. ✓ Nuovo ciclo aperto da ${nextStart}. Costi fissi generati automaticamente.`);
  };

  if (!computed.activePeriod) return <EmptyState onGoToAdmin={() => onNavigate?.('admin')} />;

  const checks = [
    { ok: Math.abs(discrepancy) < 10, label: 'Quadratura dei Conti', sub: `Scostamento: ${formatEuro(discrepancy)}` },
    { ok: pendingFixed.length === 0, label: 'Pesi Morti Liquidati', sub: pendingFixed.length > 0 ? `${pendingFixed.length} spese fisse non ancora confermate` : 'Tutti i costi fissi confermati' },
    { ok: true, label: 'Quota Investimenti', sub: 'Bonifici PAC eseguiti (Pay Yourself First)' },
  ];

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div>
        <h2>Chiusura Ciclo Fiscale</h2>
        <p className="kpi-sub">Quadratura dei conti e generazione automatica del ciclo successivo.</p>
      </div>

      <div className="grid-2col" style={{ alignItems: 'start' }}>

        {/* RICONCILIAZIONE */}
        <div className="card" style={{ borderLeft: `4px solid ${isDiscrepancyHigh ? 'var(--status-red)' : 'var(--status-green)'}` }}>
          <h3 className="flex items-center gap-2 mb-4">
            <ShieldAlert size={18} color={isDiscrepancyHigh ? 'var(--status-red)' : 'var(--status-green)'} />
            Riconciliazione Bancaria
          </h3>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between p-3 rounded" style={{ background: 'var(--bg-tertiary)' }}>
              <span className="text-sm text-muted">Saldo Teorico (App)</span>
              <span className="font-bold">{formatEuro(theoreticalBalance)}</span>
            </div>

            <div>
              <label className="kpi-label mb-1">Saldo Reale (Estratto Conto Oggi)</label>
              <input
                type="number"
                value={realBankBalance}
                onChange={e => setRealBankBalance(e.target.value)}
                style={{ fontSize: '1.25rem', fontWeight: 700, width: '100%', padding: '0.5rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded" style={{ background: discrepancy !== 0 ? 'var(--status-red-bg)' : 'var(--status-green-bg)' }}>
              <span className="text-sm">Scostamento</span>
              <span className="font-bold" style={{ color: discrepancy !== 0 ? 'var(--status-red)' : 'var(--status-green)' }}>
                {discrepancy > 0 ? '+' : ''}{formatEuro(discrepancy)}
              </span>
            </div>

            {Math.abs(discrepancy) > 10 && (
              <div className="flex flex-col gap-2 p-3 rounded" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
                <span className="text-xs font-bold text-muted uppercase tracking-wider">Azione Automatica alla Chiusura:</span>
                <div className="flex items-center justify-between text-sm">
                  <span>Rettifica Riconciliazione Bancaria</span>
                  <span className="font-bold" style={{ color: discrepancy > 0 ? 'var(--status-green)' : 'var(--text-primary)' }}>
                    {discrepancy > 0 ? '+' : '-'}{formatEuro(Math.abs(discrepancy))}
                  </span>
                </div>
                <span className="text-xs text-muted">Verrà registrata come transazione <em>Variabile</em> per far quadrare i conti.</span>
              </div>
            )}
          </div>
        </div>

        {/* CHECKLIST + CHIUSURA */}
        <div className="card">
          <h3 className="flex items-center gap-2 mb-4">
            <Lock size={18} />
            Chiusura Ciclo
          </h3>

          {/* FIX 1.1: input stipendio obbligatorio nel wizard di chiusura */}
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <Wallet size={14} color="var(--status-green)" />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                Stipendio Nuovo Ciclo (opzionale)
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              I costi fissi del ciclo successivo vengono generati automaticamente.
              Inserisci lo stipendio se già accreditato, oppure lascia a 0 e registralo dopo da Admin.
            </p>
            <input
              type="number"
              value={salaryAmount}
              onChange={e => setSalaryAmount(e.target.value)}
              placeholder="Importo stipendio (opzionale)"
              style={{ width: '100%', padding: '0.625rem 0.75rem', fontSize: '1rem', fontWeight: 700, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--status-green)', boxSizing: 'border-box' }}
            />
            
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="checkbox"
                id="extraordinary_close"
                checked={isExtraordinaryIncome}
                onChange={e => setIsExtraordinaryIncome(e.target.checked)}
                style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
              />
              <label htmlFor="extraordinary_close" style={{ fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>
                Tredicesima / Entrata Straordinaria
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-4 mb-6">
            {checks.map((c, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle size={18} color={c.ok ? 'var(--status-green)' : 'var(--status-yellow)'} style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.label}</div>
                  <div className="kpi-sub mt-1">{c.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* OPTIONAL: aggiorna saldi altri conti prima di confermare (GAP-S03) */}
          {data.accounts.filter(a => a.type !== 'operating_liquidity').length > 0 && (
            <div className="mb-4 p-3" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <h4 style={{ marginBottom: '0.5rem', fontWeight: 700 }}>Aggiorna Saldi Patrimonio (opzionale)</h4>
              <p className="kpi-sub" style={{ marginBottom: '0.75rem' }}>Inserisci eventuali aggiornamenti dei conti non-operativi (es. investimenti, immobili).</p>
              {data.accounts.filter(a => a.type !== 'operating_liquidity').map(acc => (
                <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontWeight: 600 }}>{acc.name}</label>
                  <input type="number" defaultValue={acc.currentBalance} onChange={e => setAccountUpdates(prev => ({ ...prev, [acc.id]: parseFloat(e.target.value) }))} style={{ width: 140, textAlign: 'right', padding: '0.35rem', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-4">
            <button
              onClick={handleClosePeriod}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.875rem', background: 'var(--text-primary)', color: 'var(--bg-secondary)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}
            >
              <Lock size={16} /> Chiudi Ciclo e Apri il Prossimo
              <ArrowRight size={16} />
            </button>
            <p className="text-center kpi-sub mt-2" style={{ fontSize: '0.72rem' }}>
              Sigilla le transazioni · Trasferisce {formatEuro(Number(realBankBalance))} al nuovo ciclo · <strong>Genera automaticamente i costi fissi</strong>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

SETTINGS.JSX 

import React, { useState } from 'react';
import { useFinanceData } from '../context/FinanceContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { exportStateAsJSON } from '../store/useFinanceStore';
import { useToast } from '../components/Toast';
import { Shield, PiggyBank, BarChart2, Download, Trash2, Save, Cloud, CloudUpload, CloudDownload, RefreshCw } from 'lucide-react';

export default function Settings() {
  const { data, computed } = useFinanceData();
  // AUDIT REAL CODE: Settings exposes expectedReturnRate; assumedInflationRate and reconciliationTolerance
  // were added to initial settings in the store for S02 and S05.
  const updateSettings  = useFinanceStore(state => state.updateSettings);
  const resetToDefaults = useFinanceStore(state => state.resetToDefaults);
  const syncToCloud     = useFinanceStore(state => state.syncToCloud);
  const restoreFromCloud= useFinanceStore(state => state.restoreFromCloud);
  const showToast = useToast();

  const s = data.settings;

  // Stato locale per editare senza commit immediato
  const [buffer, setBuffer]   = useState(s.safetyBuffer);
  const [savings, setSavings] = useState(s.targetSavingsAmount || 190);
  const [income, setIncome]   = useState(s.defaultIncome);
  const [returnRate, setReturnRate] = useState(s.expectedReturnRate ?? 3.5);

  // Cloud Sync
  const [githubToken, setGithubToken] = useState(s.githubToken || '');
  const [gistId, setGistId] = useState(s.gistId || '');
  const [isSyncing, setIsSyncing] = useState(false);

  // Budget per categoria
  const variableCategories = data.categories.filter(c => c.group === 'variable');
  const [budgets, setBudgets] = useState({ ...(s.categoryBudgets || {}) });

  const handleSave = () => {
    const safeBuffer  = parseFloat(buffer);
    const safeSavings = parseFloat(savings);
    const safeIncome  = parseFloat(income);

    if (isNaN(safeBuffer) || safeBuffer < 0)  { showToast('Buffer di sicurezza non valido', 'error'); return; }
    if (isNaN(safeSavings) || safeSavings < 0) { showToast('Obiettivo risparmio non valido', 'error');  return; }
    if (isNaN(safeIncome)  || safeIncome  <= 0){ showToast('Reddito di default non valido', 'error');   return; }

    const sanitizedBudgets = {};
    Object.entries(budgets).forEach(([k, v]) => {
      const parsed = parseFloat(v);
      sanitizedBudgets[k] = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    });

    updateSettings({
      safetyBuffer:         safeBuffer,
      targetSavingsAmount:  safeSavings,
      defaultIncome:        safeIncome,
      categoryBudgets:      sanitizedBudgets,
      budgetsLastUpdated:   new Date().toISOString(),
      expectedReturnRate:   parseFloat(returnRate),
      githubToken:          githubToken.trim(),
      gistId:               gistId.trim(),
    });
    showToast('Impostazioni salvate con successo', 'success');
  };

  const handleExport = () => {
    exportStateAsJSON(data);
    showToast('Backup JSON scaricato', 'success');
  };

  const handleReset = () => {
    if (!window.confirm('⚠️ Sei sicuro? Tutti i dati verranno cancellati. Un backup JSON verrà scaricato automaticamente prima del reset.')) return;
    const typed = window.prompt('Digita RESET per confermare la cancellazione totale:');
    if (typed !== 'RESET') { showToast('Reset annullato', 'warning'); return; }
    resetToDefaults(); // esporta automaticamente prima di resettare
    showToast('Database azzerato. Backup salvato automaticamente.', 'warning');
  };

  const handlePush = async () => {
    try {
      setIsSyncing(true);
      await syncToCloud();
      showToast('Sincronizzazione completata con successo', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePull = async () => {
    if (!window.confirm("Attenzione: sovrascriverà i dati locali. Procedere?")) return;
    try {
      setIsSyncing(true);
      await restoreFromCloud();
      showToast('Ripristino cloud completato', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.625rem 0.75rem',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    fontWeight: 600,
    boxSizing: 'border-box',
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div>
        <h2>Impostazioni</h2>
        <p className="kpi-sub">Configura i parametri chiave del tuo CFO Personale.</p>
      </div>

      {/* ── PARAMETRI FINANZIARI ───────────────────────────────────────────── */}
      <div className="card">
        <h3 className="flex items-center gap-2 mb-5">
          <Shield size={16} /> Parametri Finanziari
        </h3>
        <div className="grid-3col">
          <div>
            <label className="kpi-label mb-2">
              Buffer di Sicurezza (€)
            </label>
            <input
              type="number"
              value={buffer}
              onChange={e => setBuffer(e.target.value)}
              min={0}
              step={50}
              style={{ ...inputStyle, color: 'var(--status-yellow)', fontSize: '1.1rem' }}
            />
            <p className="kpi-sub mt-1">
              Importo minimo intoccabile. Viene sottratto da ogni KPI di disponibilità.
            </p>
            {computed.safetyBufferAdeguato ? (
              <p style={{ color: 'var(--status-green)', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 600 }}>
                ✓ Buffer adeguato rispetto alle tue uscite fisse
              </p>
            ) : (
              <p style={{ color: 'var(--status-red)', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 600 }}>
                ⚠ Buffer consigliato: €{computed.safetyBufferConsigliato?.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (3x fissi mensili o 20% reddito annuo)
              </p>
            )}
          </div>

          <div>
            <label className="kpi-label mb-2">
              Obiettivo Risparmio/Ciclo (€)
            </label>
            <input
              type="number"
              value={savings}
              onChange={e => setSavings(e.target.value)}
              min={0}
              step={50}
              style={{ ...inputStyle, color: 'var(--status-green)', fontSize: '1.1rem' }}
            />
            <p className="kpi-sub mt-1">
              Target di saldo minimo a fine ciclo (usato da Forecast).
            </p>
          </div>

          <div>
            <label className="kpi-label mb-2">
              Reddito Default (€)
            </label>
            <input
              type="number"
              value={income}
              onChange={e => setIncome(e.target.value)}
              min={1}
              step={50}
              style={{ ...inputStyle, fontSize: '1.1rem' }}
            />
            <p className="kpi-sub mt-1">
              Pre-compila il form di registrazione stipendio.
            </p>
          </div>

          <div>
            <label className="kpi-label mb-2">
              Rendimento atteso investimenti (%)
            </label>
            <input
              type="number"
              value={returnRate}
              onChange={e => setReturnRate(e.target.value)}
              min={0}
              max={20}
              step={0.1}
              style={{ ...inputStyle, fontSize: '1.0rem' }}
            />
            <p className="kpi-sub mt-1">
              Usato per il calcolo del Cash Drag. Default prudenziale: 3.5%.
            </p>
          </div>
        </div>
      </div>

      {/* ── BUDGET PER CATEGORIA ──────────────────────────────────────────── */}
      <div className="card">
        <h3 className="mb-4">Budget Mensile per Categoria Variabile</h3>
        
        {computed.budgetStale && (
          <div style={{ background: 'var(--status-yellow-bg)', color: 'var(--status-yellow)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1.5rem' }}>
            ⚠ Budget non aggiornati da più di 6 mesi. Rivaluta le soglie per alimentari e utenze.
          </div>
        )}
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {variableCategories.map(cat => (
            <div key={cat.id}>
              <label className="kpi-label mb-1">{cat.name}</label>
              <input
                type="number"
                value={budgets[cat.id] ?? 0}
                onChange={e => setBudgets(prev => ({ ...prev, [cat.id]: e.target.value }))}
                min={0}
                step={10}
                style={inputStyle}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── CLOUD SYNC ───────────────────────────────────────────────────────── */}
      <div className="card">
        <h3 className="flex items-center gap-2 mb-3">
          <Cloud size={16} /> Cloud Sync (GitHub Gists)
        </h3>
        <div className="grid-2col mb-4">
          <div>
            <label className="kpi-label mb-2">GitHub Token</label>
            <input type="password" value={githubToken} onChange={e => setGithubToken(e.target.value)} style={inputStyle} placeholder="ghp_..." />
          </div>
          <div>
            <label className="kpi-label mb-2">Gist ID</label>
            <input type="text" value={gistId} onChange={e => setGistId(e.target.value)} style={inputStyle} placeholder="ID del Gist" />
          </div>
        </div>
        {s.lastSync && (
          <div className="kpi-sub mb-4">
            Ultima sincronizzazione: {new Date(s.lastSync).toLocaleString('it-IT')}
          </div>
        )}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={handlePull} disabled={isSyncing} className="btn btn-ghost flex items-center gap-2">
            {isSyncing ? <RefreshCw size={15} className="animate-spin" /> : <CloudDownload size={15} />}
            Ripristina da Cloud
          </button>
          <button onClick={handlePush} disabled={isSyncing} className="btn btn-ghost flex items-center gap-2">
            {isSyncing ? <RefreshCw size={15} className="animate-spin" /> : <CloudUpload size={15} />}
            Backup Ora
          </button>
        </div>
      </div>

      {/* ── AZIONI ───────────────────────────────────────────────────────── */}
      <div className="grid-2col">
        <div className="card">
          <h3 className="flex items-center gap-2 mb-3">
            <Download size={16} /> Backup Dati
          </h3>
          <p className="kpi-sub mb-4">
            Esporta l'intero database come JSON. Utile per backup, migrazione o condivisione con il commercialista.
          </p>
          <button
            onClick={handleExport}
            className="btn btn-ghost flex items-center gap-2"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Download size={15} /> Scarica Backup JSON
          </button>
        </div>

        <div className="card" style={{ borderTop: '3px solid var(--status-red)' }}>
          <h3 className="flex items-center gap-2 mb-3" style={{ color: 'var(--status-red)' }}>
            <Trash2 size={16} /> Reset Totale
          </h3>
          <p className="kpi-sub mb-4">
            Cancella tutti i dati. Un backup JSON viene scaricato automaticamente prima del reset. Questa operazione è irreversibile.
          </p>
          <button
            onClick={handleReset}
            className="btn btn-danger flex items-center gap-2"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Trash2 size={15} /> Cancella Tutti i Dati
          </button>
        </div>
      </div>

      {/* ── SALVA ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSave}
          className="btn btn-primary flex items-center gap-2"
          style={{ padding: '0.75rem 2rem', fontSize: '0.95rem' }}
        >
          <Save size={16} /> Salva Impostazioni
        </button>
      </div>
    </div>
  );
}

APP.JSX 

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import { FinanceProvider } from './context/FinanceContext';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import { useFinanceStore } from './store/useFinanceStore';

const Overview = lazy(() => import('./views/Overview'));
const CashControl = lazy(() => import('./views/CashControl'));
const BudgetActual = lazy(() => import('./views/BudgetActual'));
const DailySpending = lazy(() => import('./views/DailySpending'));
const FixedCosts = lazy(() => import('./views/FixedCosts'));
const Forecast = lazy(() => import('./views/Forecast'));
const Goals = lazy(() => import('./views/Goals'));
const Accounts = lazy(() => import('./views/Accounts'));
const AdminSetup = lazy(() => import('./views/AdminSetup'));
const PeriodClose = lazy(() => import('./views/PeriodClose'));
const SettingsView = lazy(() => import('./views/Settings'));

import './index.css';

// FIX 3.5: Hydration guard — skeleton durante init async di IndexedDB
function HydrationGate({ children }) {
  const [hydrated, setHydrated] = useState(
    useFinanceStore.persist?.hasHydrated?.() ?? false
  );

  useEffect(() => {
    if (!hydrated) {
      const unsub = useFinanceStore.persist.onFinishHydration(() => {
        setHydrated(true);
      });
      return unsub;
    }
  }, [hydrated]);

  if (!hydrated) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        flexDirection: 'column',
        gap: '1rem',
      }}>
        <div style={{
          width: 40, height: 40,
          border: '3px solid var(--border-color)',
          borderTop: '3px solid var(--text-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Caricamento dati…
        </p>
      </div>
    );
  }

  return children;
}

const router = createHashRouter([
  {
    path: '/',
    element: (
      <ErrorBoundary>
        <ToastProvider>
          <HydrationGate>
            <FinanceProvider>
              <Layout />
            </FinanceProvider>
          </HydrationGate>
        </ToastProvider>
      </ErrorBoundary>
    ),
    children: [
      { index: true, element: <Overview /> },
      { path: 'overview', element: <Navigate to="/" replace /> },
      { path: 'cash', element: <CashControl /> },
      { path: 'variable', element: <DailySpending /> },
      { path: 'fixed', element: <FixedCosts /> },
      { path: 'budget', element: <BudgetActual /> },
      { path: 'forecast', element: <Forecast /> },
      { path: 'accounts', element: <Accounts /> },
      { path: 'admin', element: <AdminSetup /> },
      { path: 'period-close', element: <PeriodClose /> },
      { path: 'goals', element: <Goals /> },
      { path: 'settings', element: <SettingsView /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ]
  }
]);

function App() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-muted">Caricamento in corso...</div>}>
      <RouterProvider router={router} />
    </Suspense>
  );
}

export default App;

EMPTYSTATE.JSX 

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// FIX 4.3: rimossa data hardcoded "12 maggio"
export default function EmptyState() {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: 400,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1.25rem',
      textAlign: 'center',
      padding: '3rem 2rem',
    }}>
      <div style={{
        width: 64, height: 64,
        borderRadius: '50%',
        backgroundColor: 'var(--bg-tertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <ShieldCheck size={36} color="var(--text-muted)" />
      </div>

      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Nessun Ciclo Attivo
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: 360, lineHeight: 1.6 }}>
          Il sistema è inattivo. Registra il tuo stipendio in <strong>Admin / Setup</strong> per
          inizializzare il primo ciclo fiscale e attivare tutti i KPI.
        </p>
      </div>

      <button
        className="btn btn-primary"
        onClick={() => navigate('/admin')}
        style={{ padding: '0.75rem 1.75rem' }}
      >
        Vai ad Admin / Setup →
      </button>
    </div>
  );
}

TOAST.JSX 

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: { icon: CheckCircle, color: 'var(--status-green)', bg: 'var(--status-green-bg)' },
  error:   { icon: XCircle,     color: 'var(--status-red)',   bg: 'var(--status-red-bg)'   },
  warning: { icon: AlertTriangle, color: 'var(--status-yellow)', bg: 'var(--status-yellow-bg)' },
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', duration = 3500) => {
    const id = `toast_${Date.now()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const dismiss = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 380 }}>
        {toasts.map(toast => {
          const cfg = ICONS[toast.type] || ICONS.success;
          const Icon = cfg.icon;
          return (
            <div
              key={toast.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.875rem 1rem',
                background: 'var(--bg-secondary)',
                border: `1px solid ${cfg.color}`,
                borderLeft: `4px solid ${cfg.color}`,
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                animation: 'toastIn 0.25s ease forwards',
                minWidth: 280,
              }}
            >
              <Icon size={18} color={cfg.color} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                {toast.message}
              </span>
              <button
                onClick={() => dismiss(toast.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.15rem', display: 'flex', alignItems: 'center' }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.showToast;
};

LAYOUT.JSX 

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Wallet,
  PieChart,
  TrendingUp,
  Target,
  Moon,
  Sun,
  Lock,
  Landmark,
  Settings as SettingsIcon,
  ShieldCheck,
  ListOrdered,
  ReceiptText,
  Menu,
  X,
} from 'lucide-react';
import ErrorBoundary from './ErrorBoundary';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useFinanceData } from '../context/FinanceContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'cash', label: 'Cash Control', icon: Wallet },
  { id: 'variable', label: 'Costi Variabili', icon: ListOrdered },
  { id: 'fixed', label: 'Costi Fissi', icon: ReceiptText },
  { id: 'budget', label: 'Budget vs Actual', icon: PieChart },
  { id: 'forecast', label: 'Forecast', icon: TrendingUp },
  { id: 'accounts', label: 'Conti & Patrimonio', icon: Landmark },
  { id: 'admin', label: 'Admin / Setup', icon: ShieldCheck },
  { id: 'period-close', label: 'Chiudi Ciclo', icon: Lock },
  { id: 'goals', label: 'Obiettivi', icon: Target },
  { id: 'settings', label: 'Impostazioni', icon: SettingsIcon },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeView = location.pathname.replace('/', '') || 'overview';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { computed, data } = useFinanceData();
  const updateSettings = useFinanceStore(state => state.updateSettings);
  const theme = data?.settings?.theme || 'dark';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' });

  const pendingFixed = (computed.plannedPeriodTx || []).filter(t => t.nature === 'fixed').length;

  return (
    <div className="app-container">
      {/* FIX 3.12: overlay mobile per chiudere sidebar */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, display: 'none' }}
          className="sidebar-overlay"
        />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={24} color="var(--text-primary)" />
          <span style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Private CFO</span>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            // Badge: mostra il numero di costi fissi pending sulla voce "Costi Fissi"
            const showBadge = item.id === 'fixed' && pendingFixed > 0;
            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => { navigate(item.id === 'overview' ? '/' : `/${item.id}`); setSidebarOpen(false); }}
                style={{ position: 'relative' }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {showBadge && (
                  <span style={{
                    marginLeft: 'auto',
                    minWidth: '20px',
                    height: '20px',
                    borderRadius: '10px',
                    backgroundColor: isActive ? 'var(--bg-secondary)' : 'var(--status-red)',
                    color: isActive ? 'var(--status-red)' : 'white',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                  }}>
                    {pendingFixed}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
          <div className="kpi-sub mb-2">Workspace Attivo</div>
          <div className="flex items-center gap-2">
            <div style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg-primary)', fontWeight: 800, fontSize: '0.85rem' }}>
              G
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Giovanni</span>
          </div>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────────────── */}
      <main className="main-content">
        <header className="header">
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              {navItems.find(n => n.id === activeView)?.label}
            </div>
            {computed.activePeriod && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '2px', background: 'var(--bg-tertiary)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Ciclo Fiscale:</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-primary)' }}>
                  {format(parseISO(computed.activePeriod?.startDate || new Date().toISOString()), 'dd MMM', { locale: it })} — {format(parseISO(computed.activePeriod?.endDate || new Date().toISOString()), 'dd MMM yyyy', { locale: it })}
                </span>
                <span className="badge" style={{ backgroundColor: 'var(--status-green-bg)', color: 'var(--status-green)', fontSize: '0.6rem' }}>
                  OPEN
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* KPI Header */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: 600 }}>
                Spendibile al giorno
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: computed.spendibileGiornalieroFinoAlProssimoStipendio >= 0 ? 'var(--status-green)' : 'var(--status-red)' }}>
                {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(computed.spendibileGiornalieroFinoAlProssimoStipendio ?? 0)}
              </div>
            </div>

            <div style={{ height: '36px', width: '1px', backgroundColor: 'var(--border-color)' }} />

            {/* FIX 3.12: hamburger per mobile */}
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="hamburger-btn"
              style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.45rem', cursor: 'pointer', color: 'var(--text-primary)', display: 'none', alignItems: 'center' }}
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <button
              onClick={toggleTheme}
              style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-full)', padding: '0.45rem', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <div className="content-area">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}

TRANSACTION FORM MODAL 

import React, { useState } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { X } from 'lucide-react';
import { format } from 'date-fns';

export default function TransactionFormModal({ isOpen, onClose }) {
  const addTransaction = useFinanceStore(state => state.addTransaction);
  const data = useFinanceStore(state => state.data);

  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    categoryId: data.categories.find(c => c.group === 'variable')?.id || '',
    accountId: data.accounts.find(a => a.type === 'operating_liquidity')?.id || '',
    amount: '',
    type: 'expense', // income, expense, transfer, investment
    nature: 'variable', // fixed, variable, extraordinary
    status: 'paid', // planned, paid
    source: '',
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.description || !formData.amount || !formData.accountId) return;

    addTransaction({
      ...formData,
      amount: parseFloat(formData.amount),
      periodId: data.settings.activePeriodId,
      notes: ''
    });

    // Reset parziale form mantenendo le selezioni per input rapidi consecutivi
    setFormData({
      ...formData,
      description: '',
      amount: ''
    });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '550px', margin: '20px', padding: '2rem' }}>
        <div className="flex justify-between items-center mb-6">
          <h2 style={{ margin: 0 }}>Nuova Transazione</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          <div className="grid-2col" style={{ marginBottom: 0, gap: '1rem' }}>
            <div>
              <label className="kpi-label">Tipo Operazione</label>
              <select
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value })}
                className="w-full p-2 rounded-md"
                style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              >
                <option value="expense">Spesa (Uscita)</option>
                <option value="income">Entrata (Stipendio/Bonus)</option>
                <option value="investment">Investimento (Bonifico Broker)</option>
              </select>
            </div>

            <div>
              <label className="kpi-label">Stato Contabile</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full p-2 rounded-md"
                style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              >
                <option value="paid">Già Pagato (Movimenta Saldo)</option>
                <option value="planned">Pianificato (Impegno Cassa)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="kpi-label">Conto Origine/Destinazione</label>
            <select
              value={formData.accountId}
              onChange={e => setFormData({ ...formData, accountId: e.target.value })}
              className="w-full p-2 rounded-md"
              style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
            >
              {data.accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name} ({acc.type.replace('_', ' ')})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="kpi-label">Natura della Spesa</label>
            <div className="flex gap-2 mt-1">
              {['variable', 'fixed', 'extraordinary'].map(nat => (
                <button
                  key={nat}
                  type="button"
                  onClick={() => setFormData({ ...formData, nature: nat })}
                  style={{
                    flex: 1, padding: '0.5rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    backgroundColor: formData.nature === nat ? 'var(--chart-primary)' : 'var(--bg-tertiary)',
                    color: formData.nature === nat ? 'white' : 'var(--text-secondary)',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  {nat === 'variable' ? 'Variabile (Budget)' : nat === 'fixed' ? 'Fissa (Ricorrente)' : 'Straordinaria'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid-2col" style={{ marginBottom: 0, gap: '1rem' }}>
            <div>
              <label className="kpi-label">Data Contabile</label>
              <input type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full p-2 rounded-md"
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label className="kpi-label">Importo (€)</label>
              <input type="number" step="0.01" min="0" required
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className="w-full p-2 rounded-md font-bold"
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--status-red)' }}
              />
            </div>
          </div>

          <div className="grid-2col" style={{ marginBottom: 0, gap: '1rem' }}>
            <div>
              <label className="kpi-label">Descrizione / Beneficiario</label>
              <input type="text" placeholder="es. Spesa Esselunga" required
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-2 rounded-md"
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label className="kpi-label">Categoria Analitica</label>
              <select
                value={formData.categoryId}
                onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full p-2 rounded-md"
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              >
                {data.categories.filter(c => {
  if (formData.type === 'income') return c.group === 'fixed';
  return c.group === formData.nature;
}).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
         {formData.type === 'income' && (
  <div>
    <label className="kpi-label">Fonte Reddito</label>
    <select
      value={formData.source}
      onChange={e => setFormData({ ...formData, source: e.target.value })}
      className="w-full p-2 rounded-md"
      style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
    >
      <option value="">— Seleziona fonte —</option>
      <option value="stipendio">Stipendio</option>
      <option value="freelance">Freelance / Consulenza</option>
      <option value="bonus">Bonus / Premio</option>
      <option value="rendita">Rendita / Investimenti</option>
      <option value="altro">Altro</option>
    </select>
  </div>
)}

            <button type="submit" style={{
          
            marginTop: '1rem', padding: '1rem',
            backgroundColor: 'var(--text-primary)', color: 'var(--bg-secondary)',
            border: 'none', borderRadius: 'var(--radius-md)',
            fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem'
          }}>
            {formData.status === 'planned' ? 'Pianifica Impegno' : 'Registra Transazione Reale'}
          </button>
        </form>
      </div>
    </div>
  );
}