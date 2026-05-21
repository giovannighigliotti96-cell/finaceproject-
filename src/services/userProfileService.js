export function extractUserProfile(storeData, computedMetrics, tfrMaturato) {
  if (!storeData || !computedMetrics) return null;

  return {
    liquidity: {
      operating: computedMetrics.operatingLiquidity || 0,
      restricted: computedMetrics.restrictedSavings || 0,
      total: (computedMetrics.operatingLiquidity || 0) + (computedMetrics.restrictedSavings || 0)
    },
    assets: {
      investments: computedMetrics.investments || 0,
      tfr: tfrMaturato || 0,
      netWorth: computedMetrics.netWorth || 0
    },
    cashFlow: {
      monthlyFixedExpenses: computedMetrics.costiFissiTotaliCiclo || 0,
      monthlyEstimatedVariable: (computedMetrics.spesaMediaGiornalieraVariabileAttuale * 30) || 0,
      monthlyNetSavings: computedMetrics.risparmioNettoMensile || 0
    },
    goals: {
      fireNumber: computedMetrics.fireNumber || null,
      runwayMonths: computedMetrics.costiFissiTotaliCiclo > 0 
        ? ((computedMetrics.operatingLiquidity + computedMetrics.restrictedSavings) / computedMetrics.costiFissiTotaliCiclo).toFixed(1)
        : null
    }
  };
}
