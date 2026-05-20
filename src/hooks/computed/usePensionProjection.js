import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useFinanceStore } from '../../store/useFinanceStore';

const INFLATION_RATE = 0.02; // 2% annuo fisso

/**
 * Calcola la differenza in mesi interi tra una stringa "YYYY-MM" e OGGI.
 * Restituisce sempre un intero >= 0.
 */
function calcMonthsGap(lastStatementDate) {
  if (!lastStatementDate || typeof lastStatementDate !== 'string') return 0;
  const parts = lastStatementDate.split('-');
  if (parts.length < 2) return 0;

  const year  = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10); // 1–12
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return 0;

  const now      = new Date();
  const nowYear  = now.getFullYear();
  const nowMonth = now.getMonth() + 1; // 1–12

  const gap = (nowYear - year) * 12 + (nowMonth - month);
  return Math.max(0, gap);
}

/**
 * Coerce sicura: converte qualunque input (stringa, undefined, null, NaN) in un Number.
 * Se il risultato è NaN o Infinity, ritorna il fallback (default 0).
 */
function safeNum(value, fallback = 0) {
  const n = Number(value);
  return isFinite(n) ? n : fallback;
}

export function usePensionProjection() {
  const cfg = useFinanceStore(
    useShallow(state => state.data?.settings?.pensionConfig || {})
  );
  const defaultIncome = useFinanceStore(
    state => safeNum(state.data?.settings?.defaultIncome, 0)
  );

  return useMemo(() => {
    // ─────────────────────────────────────────────────────────────────────────
    // SANITIZZAZIONE — gestisce sia la nuova nomenclatura che quella vecchia
    // (backward compat con stato persistito in IndexedDB da versioni precedenti)
    // ─────────────────────────────────────────────────────────────────────────
    const tfrDest = cfg.tfrDestination === 'azienda' ? 'azienda' : 'fondo';

    // Saldo portale: nuova chiave "currentTfrBalance", fallback vecchia "currentTfr"
    const portalBalance  = safeNum(cfg.currentTfrBalance ?? cfg.currentTfr, 0);

    // Quota mensile: nuova chiave "monthlyAccrual", fallback vecchia "monthlyContribution"
    const monthlyAccrual = safeNum(cfg.monthlyAccrual ?? cfg.monthlyContribution, 0);

    const lastStatement  = (typeof cfg.lastStatementDate === 'string' && cfg.lastStatementDate)
      ? cfg.lastStatementDate
      : '2025-12';

    const currentAge     = Math.max(18,           safeNum(cfg.currentAge,    30));
    const retirementAge  = Math.max(currentAge+1,  safeNum(cfg.retirementAge, 67));
    const annualReturn   = safeNum(cfg.annualReturn, 3.5);
    const volPerc        = safeNum(cfg.voluntaryContributionPercentage, 0);
    const empPerc        = safeNum(cfg.employerContributionPercentage,  1.5);

    // ─── STEP 1: GAP TEMPORALE ───────────────────────────────────────────────
    const gapMonths      = calcMonthsGap(lastStatement); // es. 5
    const gapAccrued     = gapMonths * monthlyAccrual;    // es. 5 * 175 = 875
    const realCurrentBalance = portalBalance + gapAccrued; // es. 1223 + 875 = 2098

    // ─── STEP 2: CONTRIBUTO MENSILE FUTURO (da oggi alla pensione) ───────────
    const voluntaryAmount = defaultIncome > 0 ? (defaultIncome * volPerc / 100) : 0;
    const employerAmount  = (volPerc > 0 && defaultIncome > 0) ? (defaultIncome * empPerc / 100) : 0;
    // Contributo totale mensile: quota TFR busta + eventuale volontario + datoriale
    const totalMonthlyContribution = monthlyAccrual + voluntaryAmount + employerAmount;

    // ─── STEP 3: TASSO MENSILE DI CAPITALIZZAZIONE ──────────────────────────
    let annualRate;
    if (tfrDest === 'fondo') {
      annualRate = annualReturn / 100; // es. 3.5 / 100 = 0.035
    } else {
      // Rivalutazione legale INPS: 1.5% fisso + 75% * inflazione 2% = 0.015 + 0.015 = 0.030
      annualRate = 0.015 + (0.75 * INFLATION_RATE);
    }
    const monthlyRate = annualRate / 12; // es. 0.035 / 12 ≈ 0.002917

    // ─── STEP 4: CICLO DI PROIEZIONE ANNO PER ANNO ──────────────────────────
    const yearsToRetirement = retirementAge - currentAge; // es. 67 - 30 = 37

    let balance      = realCurrentBalance;        // partenza: saldo reale oggi
    let totalInvested = realCurrentBalance;       // traccia il capitale versato cumulato

    const projectionChartData = [];

    // Punto di partenza (anno 0 = età attuale)
    projectionChartData.push({
      age:            currentAge,
      nominalBalance: Math.round(balance),
      realBalance:    Math.round(balance),
      invested:       Math.round(totalInvested),
    });

    for (let y = 1; y <= yearsToRetirement; y++) {
      // Compounding mensile per i 12 mesi dell'anno corrente
      for (let m = 0; m < 12; m++) {
        balance       = balance * (1 + monthlyRate) + totalMonthlyContribution;
        totalInvested = totalInvested + totalMonthlyContribution;
      }

      // Potere d'acquisto reale: deflazioniamo con inflazione 2% composta
      const realBalance = balance / Math.pow(1 + INFLATION_RATE, y);

      projectionChartData.push({
        age:            currentAge + y,
        nominalBalance: Math.round(balance),
        realBalance:    Math.round(realBalance),
        invested:       Math.round(totalInvested),
      });
    }

    // ─── STEP 5: TASSAZIONE FINALE ───────────────────────────────────────────
    let applicableTaxRate;
    if (tfrDest === 'fondo') {
      // Agevolazione Fondo Pensione: 15% - 0.3% per ogni anno oltre i 15 (floor 9%)
      const extraYears = Math.max(0, yearsToRetirement - 15);
      applicableTaxRate = Math.max(0.09, 0.15 - extraYears * 0.003);
    } else {
      applicableTaxRate = 0.23; // IRPEF media flat su TFR in azienda
    }

    const grossBalanceAtRetirement = balance;
    const netBalanceAtRetirement   = grossBalanceAtRetirement * (1 - applicableTaxRate);
    const realPowerOfPurchase      = netBalanceAtRetirement / Math.pow(1 + INFLATION_RATE, yearsToRetirement);

    return {
      tfrDest,
      gapMonths,
      gapAccrued,
      realCurrentBalance,
      totalInvested,
      grossBalanceAtRetirement,
      applicableTaxRate,
      netBalanceAtRetirement,
      realPowerOfPurchase,
      projectionChartData,
    };
  }, [cfg, defaultIncome]);
}
