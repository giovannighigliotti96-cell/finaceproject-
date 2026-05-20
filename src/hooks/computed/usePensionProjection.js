import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useFinanceStore } from '../../store/useFinanceStore';

const INFLATION_RATE = 0.02; // 2% annuo fisso

/**
 * Calcola la differenza in mesi interi tra una data YYYY-MM e la data corrente.
 * Restituisce un valore >= 0.
 */
function calcMonthsGap(lastStatementDate) {
  try {
    const [yearStr, monthStr] = String(lastStatementDate).split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1–12
    if (isNaN(year) || isNaN(month)) return 0;

    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth() + 1; // 1–12

    const gap = (nowYear - year) * 12 + (nowMonth - month);
    return Math.max(0, gap);
  } catch {
    return 0;
  }
}

export function usePensionProjection() {
  const cfg = useFinanceStore(
    useShallow(state => state.data.settings?.pensionConfig || {})
  );
  const defaultIncome = useFinanceStore(state => state.data.settings?.defaultIncome || 0);

  return useMemo(() => {
    // ── Sanitizzazione Input ─────────────────────────────────────────────────
    const tfrDest = cfg.tfrDestination === 'azienda' ? 'azienda' : 'fondo';
    const portalBalance  = Number(cfg.currentTfrBalance) || 0;
    const lastStatement  = cfg.lastStatementDate || '2025-12';
    const monthlyAccrual = Number(cfg.monthlyAccrual) || 0;
    const currentAge     = Math.max(18, Number(cfg.currentAge) || 30);
    const retirementAge  = Math.max(currentAge + 1, Number(cfg.retirementAge) || 67);
    const annualReturn   = Number(cfg.annualReturn) || 0;
    const volPerc        = Number(cfg.voluntaryContributionPercentage) || 0;
    const empPerc        = Number(cfg.employerContributionPercentage) || 0;

    // ── Step 1: Gap temporale (mesi tra estratto conto e OGGI) ───────────────
    const gapMonths = calcMonthsGap(lastStatement);
    // Saldo reale ad oggi = saldo portale + quote accumulate nei mesi di gap
    const gapAccrued        = gapMonths * monthlyAccrual;
    const realCurrentBalance = portalBalance + gapAccrued;

    // ── Step 2: Contributo mensile totale da OGGI alla pensione ──────────────
    const voluntaryAmount = (defaultIncome * volPerc) / 100;
    const employerAmount  = volPerc > 0 ? (defaultIncome * empPerc) / 100 : 0;
    // Il contributo mensile totale è: quota TFR busta paga + eventuale volontario + datoriale
    const totalMonthlyContribution = monthlyAccrual + voluntaryAmount + employerAmount;

    // ── Step 3: Tasso mensile di capitalizzazione ────────────────────────────
    let annualRate;
    if (tfrDest === 'fondo') {
      annualRate = annualReturn / 100;
    } else {
      // Rivalutazione legale TFR in azienda: 1.5% fisso + 75% inflazione
      annualRate = 0.015 + (0.75 * INFLATION_RATE); // ≈ 3% annuo
    }
    const monthlyRate = annualRate / 12;

    // ── Step 4: Proiezione anno per anno dalla data odierna ──────────────────
    const yearsToRetirement = retirementAge - currentAge;
    const projectionChartData = [];
    let balance = realCurrentBalance;
    let totalInvested = realCurrentBalance;

    // Punto di partenza (Età attuale = "oggi")
    projectionChartData.push({
      age: currentAge,
      nominalBalance: Math.round(balance),
      realBalance: Math.round(balance),
      invested: Math.round(totalInvested),
    });

    for (let y = 1; y <= yearsToRetirement; y++) {
      for (let m = 0; m < 12; m++) {
        balance = balance * (1 + monthlyRate) + totalMonthlyContribution;
        totalInvested += totalMonthlyContribution;
      }
      // Potere d'acquisto reale: svalutato dell'inflazione composta
      const realBalance = balance / Math.pow(1 + INFLATION_RATE, y);

      projectionChartData.push({
        age: currentAge + y,
        nominalBalance: Math.round(balance),
        realBalance: Math.round(realBalance),
        invested: Math.round(totalInvested),
      });
    }

    // ── Step 5: Calcolo Fiscale Finale ───────────────────────────────────────
    let applicableTaxRate;
    if (tfrDest === 'fondo') {
      // Regola agevolata: 15% - 0.3% per ogni anno oltre i 15 (floor 9%)
      const extraYears = Math.max(0, yearsToRetirement - 15);
      applicableTaxRate = Math.max(0.09, 0.15 - extraYears * 0.003);
    } else {
      applicableTaxRate = 0.23; // IRPEF media flat su TFR in azienda
    }

    const grossBalanceAtRetirement = balance;
    const netBalanceAtRetirement   = grossBalanceAtRetirement * (1 - applicableTaxRate);
    const realPowerOfPurchase       = netBalanceAtRetirement / Math.pow(1 + INFLATION_RATE, yearsToRetirement);

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
