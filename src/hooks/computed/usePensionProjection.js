import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useFinanceStore } from '../../store/useFinanceStore';

export function usePensionProjection() {
  const pensionConfig = useFinanceStore(useShallow(state => state.data.settings?.pensionConfig || {}));
  const defaultIncome = useFinanceStore(state => state.data.settings?.defaultIncome || 0);
  const inflationRate = 0.02; // Inflazione stimata fissa al 2%

  return useMemo(() => {
    // Sanitizzazione degli input
    const tfrDest = pensionConfig.tfrDestination === 'azienda' ? 'azienda' : 'fondo';
    const currentTfr = Number(pensionConfig.currentTfr) || 0;
    const monthlyCont = Number(pensionConfig.monthlyContribution) || 0;
    const currentAge = Number(pensionConfig.currentAge) || 30;
    const retirementAge = Number(pensionConfig.retirementAge) || 67;
    const annualReturn = Number(pensionConfig.annualReturn) || 0;
    const volContPerc = Number(pensionConfig.voluntaryContributionPercentage) || 0;
    const empContPerc = Number(pensionConfig.employerContributionPercentage) || 0;

    const yearsToRetirement = Math.max(0, retirementAge - currentAge);
    const monthsToRetirement = yearsToRetirement * 12;

    // Calcolo del contributo volontario e datoriale in base alla % (se attivato)
    const voluntaryAmount = (defaultIncome * volContPerc) / 100;
    const employerAmount = volContPerc > 0 ? (defaultIncome * empContPerc) / 100 : 0;
    const totalMonthlyContribution = monthlyCont + voluntaryAmount + employerAmount;

    // Logica di capitalizzazione basata sulla destinazione
    let nominalBalance = currentTfr;
    let totalInvested = currentTfr;
    const projectionChartData = [];

    // Parametri specifici per lo scenario
    let monthlyRate = 0;
    let annualRate = 0;

    if (tfrDest === 'fondo') {
      // Rendimento di mercato composto mensilmente
      annualRate = annualReturn / 100;
      monthlyRate = annualRate / 12;
    } else {
      // TFR in azienda: 1.5% fisso + 75% inflazione (0.02 * 0.75 = 0.015) => 3% annuo totale
      annualRate = 0.015 + (0.75 * inflationRate);
      monthlyRate = annualRate / 12; // Approssimiamo al mese per la simulazione
    }

    // Aggiungiamo il punto di partenza (Anno 0)
    projectionChartData.push({
      age: currentAge,
      nominalBalance: Math.round(nominalBalance),
      realBalance: Math.round(nominalBalance),
      invested: Math.round(totalInvested)
    });

    for (let y = 1; y <= yearsToRetirement; y++) {
      for (let m = 0; m < 12; m++) {
        nominalBalance = nominalBalance * (1 + monthlyRate) + totalMonthlyContribution;
        totalInvested += totalMonthlyContribution;
      }

      // Attualizzazione: il potere d'acquisto reale si svaluta dell'inflazione (2%) ogni anno
      const realBalance = nominalBalance / Math.pow(1 + inflationRate, y);

      projectionChartData.push({
        age: currentAge + y,
        nominalBalance: Math.round(nominalBalance),
        realBalance: Math.round(realBalance),
        invested: Math.round(totalInvested)
      });
    }

    // Calcolo Fiscale Finale
    let applicableTaxRate = 0;

    if (tfrDest === 'fondo') {
      // Regola agevolata Fondo Pensione
      const yearsOfPermanence = yearsToRetirement; // Assumiamo iscrizione odierna
      const extraYears = Math.max(0, yearsOfPermanence - 15);
      const discount = extraYears * 0.003;
      applicableTaxRate = Math.max(0.09, 0.15 - discount);
    } else {
      // Regola standard TFR in azienda (Irpef media, assumiamo flat 23%)
      applicableTaxRate = 0.23;
    }

    // Il lordo è il balance nominale a fine periodo
    const grossBalanceAtRetirement = nominalBalance;
    
    // Tasse sul capitale accumulato (escludendo i rendimenti già tassati anno per anno nei fondi o le dinamiche complesse,
    // per semplificare applichiamo l'aliquota sul totale, sebbene nella realtà le tasse sui rendimenti dei FP siano al 20%).
    // Modello semplificato richiesto: applichiamo l'aliquota finale sul montante per la parte soggetta.
    // In questo modulo calcoliamo l'aliquota sul totale come indicato.
    const totalTaxes = grossBalanceAtRetirement * applicableTaxRate;
    const netBalanceAtRetirement = grossBalanceAtRetirement - totalTaxes;
    
    // Valore reale netto (potere d'acquisto effettivo)
    const realPowerOfPurchase = netBalanceAtRetirement / Math.pow(1 + inflationRate, yearsToRetirement);

    return {
      tfrDest,
      grossBalanceAtRetirement,
      applicableTaxRate,
      netBalanceAtRetirement,
      realPowerOfPurchase,
      projectionChartData,
      totalInvested
    };
  }, [pensionConfig, defaultIncome]);
}
