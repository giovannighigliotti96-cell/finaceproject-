import { useMemo } from 'react';
import { format, parse, differenceInMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import { useShallow } from 'zustand/react/shallow';
import { useFinanceStore } from '../store/useFinanceStore';

/**
 * Hook per analisi storica multi-periodo
 * Supporta: mese, trimestre, semestre, anno
 * Zero impatto su codice esistente (hook isolato)
 */
export function useHistoricalAnalysis(viewType = 'month', selectedPeriodId = null) {
  const periods = useFinanceStore(useShallow(state => state.data.periods || []));
  const transactions = useFinanceStore(useShallow(state => state.data.transactions || []));
  const categories = useFinanceStore(useShallow(state => state.data.categories || []));
  const settings = useFinanceStore(useShallow(state => state.data.settings || {}));

  return useMemo(() => {
    if (!periods || !transactions) {
      return { isDataSufficient: false, availablePeriods: [], periodData: null };
    }

    // Solo periodi chiusi, ordinati cronologicamente
    const closedPeriods = periods
      .filter(p => p.status === 'closed')
      .sort((a, b) => a.id.localeCompare(b.id)); // id = 'yyyy-MM'

    // ─── VALIDAZIONE DATI SUFFICIENTI ───────────────────────────────────
    const minPeriodsRequired = {
      month: 1,
      quarter: 3,
      semester: 6,
      year: 12,
    };

    const isDataSufficient = closedPeriods.length >= minPeriodsRequired[viewType];

    if (!isDataSufficient) {
      return {
        isDataSufficient: false,
        availablePeriods: [],
        periodData: null,
        minRequired: minPeriodsRequired[viewType],
        currentCount: closedPeriods.length,
      };
    }

    // ─── RAGGRUPPA PERIODI PER TIPO VISTA ──────────────────────────────
    const groupPeriods = () => {
      switch (viewType) {
        case 'month':
          // Ogni periodo è un mese
          return closedPeriods.map(p => ({
            id: p.id,
            label: format(parse(p.id + '-01', 'yyyy-MM-dd', new Date()), 'MMMM yyyy', { locale: it }),
            periods: [p],
          }));

        case 'quarter':
          // Raggruppa per trimestri (3 mesi consecutivi)
          const quarters = [];
          for (let i = 0; i <= closedPeriods.length - 3; i++) {
            const chunk = closedPeriods.slice(i, i + 3);
            // Verifica consecutività
            const isConsecutive = chunk.every((p, idx) => {
              if (idx === 0) return true;
              const prev = parse(chunk[idx - 1].id + '-01', 'yyyy-MM-dd', new Date());
              const curr = parse(p.id + '-01', 'yyyy-MM-dd', new Date());
              return differenceInMonths(curr, prev) === 1;
            });
            if (isConsecutive) {
              const firstMonth = parse(chunk[0].id + '-01', 'yyyy-MM-dd', new Date());
              const lastMonth = parse(chunk[2].id + '-01', 'yyyy-MM-dd', new Date());
              quarters.push({
                id: `${chunk[0].id}_Q`,
                label: `${format(firstMonth, 'MMM', { locale: it })} - ${format(lastMonth, 'MMM yyyy', { locale: it })}`,
                periods: chunk,
              });
            }
          }
          return quarters;

        case 'semester':
          // Raggruppa per semestri (6 mesi consecutivi)
          const semesters = [];
          for (let i = 0; i <= closedPeriods.length - 6; i++) {
            const chunk = closedPeriods.slice(i, i + 6);
            const isConsecutive = chunk.every((p, idx) => {
              if (idx === 0) return true;
              const prev = parse(chunk[idx - 1].id + '-01', 'yyyy-MM-dd', new Date());
              const curr = parse(p.id + '-01', 'yyyy-MM-dd', new Date());
              return differenceInMonths(curr, prev) === 1;
            });
            if (isConsecutive) {
              const firstMonth = parse(chunk[0].id + '-01', 'yyyy-MM-dd', new Date());
              const lastMonth = parse(chunk[5].id + '-01', 'yyyy-MM-dd', new Date());
              semesters.push({
                id: `${chunk[0].id}_S`,
                label: `${format(firstMonth, 'MMM yyyy', { locale: it })} - ${format(lastMonth, 'MMM yyyy', { locale: it })}`,
                periods: chunk,
              });
            }
          }
          return semesters;

        case 'year':
          // Raggruppa per anni (12 mesi consecutivi)
          const years = [];
          for (let i = 0; i <= closedPeriods.length - 12; i++) {
            const chunk = closedPeriods.slice(i, i + 12);
            const isConsecutive = chunk.every((p, idx) => {
              if (idx === 0) return true;
              const prev = parse(chunk[idx - 1].id + '-01', 'yyyy-MM-dd', new Date());
              const curr = parse(p.id + '-01', 'yyyy-MM-dd', new Date());
              return differenceInMonths(curr, prev) === 1;
            });
            if (isConsecutive) {
              const firstMonth = parse(chunk[0].id + '-01', 'yyyy-MM-dd', new Date());
              const lastMonth = parse(chunk[11].id + '-01', 'yyyy-MM-dd', new Date());
              years.push({
                id: `${chunk[0].id}_Y`,
                label: `${format(firstMonth, 'MMM yyyy', { locale: it })} - ${format(lastMonth, 'MMM yyyy', { locale: it })}`,
                periods: chunk,
              });
            }
          }
          return years;

        default:
          return [];
      }
    };

    const availablePeriods = groupPeriods();

    if (availablePeriods.length === 0) {
      return {
        isDataSufficient: false,
        availablePeriods: [],
        periodData: null,
        message: 'Non ci sono periodi consecutivi sufficienti per questa vista',
      };
    }

    // Auto-select ultimo periodo disponibile se non specificato
    const selectedId = selectedPeriodId || availablePeriods[availablePeriods.length - 1].id;
    const selectedGroup = availablePeriods.find(g => g.id === selectedId);

    if (!selectedGroup) {
      return { isDataSufficient: true, availablePeriods, periodData: null };
    }

    // ─── CALCOLA DATI PER PERIODO SELEZIONATO ──────────────────────────
    const periodIds = selectedGroup.periods.map(p => p.id);
    const periodTx = transactions.filter(t => periodIds.includes(t.periodId) && t.status === 'paid');

    const entrate = periodTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const usciteFisse = periodTx.filter(t => t.type === 'expense' && t.nature === 'fixed').reduce((s, t) => s + t.amount, 0);
    const usciteVariabili = periodTx.filter(t => t.type === 'expense' && t.nature === 'variable').reduce((s, t) => s + t.amount, 0);
    const usciteStraordinarie = periodTx.filter(t => t.type === 'expense' && t.nature === 'extraordinary').reduce((s, t) => s + t.amount, 0);
    const investimenti = periodTx.filter(t => t.type === 'investment').reduce((s, t) => s + t.amount, 0);

    const usciteTotali = usciteFisse + usciteVariabili + usciteStraordinarie;
    const risparmio = entrate - usciteTotali;
    const savingsRate = entrate > 0 ? (risparmio / entrate) * 100 : 0;

    // Breakdown per categoria
    const categoryBreakdown = categories.map(cat => {
      const catTx = periodTx.filter(t => t.categoryId === cat.id && t.type === 'expense');
      const total = catTx.reduce((s, t) => s + t.amount, 0);
      return {
        id: cat.id,
        name: cat.name,
        group: cat.group,
        amount: total,
        percentage: usciteTotali > 0 ? (total / usciteTotali) * 100 : 0,
        budget: settings.categoryBudgets?.[cat.id] || null,
        budgetUsage: settings.categoryBudgets?.[cat.id] ? (total / (settings.categoryBudgets[cat.id] * selectedGroup.periods.length)) * 100 : null,
      };
    }).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);

    // ─── COMPARAZIONE CON PERIODO PRECEDENTE ────────────────────────────
    let comparisonData = null;
    const currentIndex = availablePeriods.findIndex(g => g.id === selectedId);
    if (currentIndex > 0) {
      const prevGroup = availablePeriods[currentIndex - 1];
      const prevPeriodIds = prevGroup.periods.map(p => p.id);
      const prevTx = transactions.filter(t => prevPeriodIds.includes(t.periodId) && t.status === 'paid');

      const prevEntrate = prevTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const prevUscite = prevTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const prevRisparmio = prevEntrate - prevUscite;
      const prevSavingsRate = prevEntrate > 0 ? (prevRisparmio / prevEntrate) * 100 : 0;

      comparisonData = {
        entrate: {
          value: prevEntrate,
          delta: entrate - prevEntrate,
          deltaPercent: prevEntrate > 0 ? ((entrate - prevEntrate) / prevEntrate) * 100 : 0,
        },
        uscite: {
          value: prevUscite,
          delta: usciteTotali - prevUscite,
          deltaPercent: prevUscite > 0 ? ((usciteTotali - prevUscite) / prevUscite) * 100 : 0,
        },
        risparmio: {
          value: prevRisparmio,
          delta: risparmio - prevRisparmio,
          deltaPercent: prevRisparmio !== 0 ? ((risparmio - prevRisparmio) / Math.abs(prevRisparmio)) * 100 : 0,
        },
        savingsRate: {
          value: prevSavingsRate,
          delta: savingsRate - prevSavingsRate,
        },
      };

      // Comparazione per categoria
      comparisonData.categories = categoryBreakdown.map(cat => {
        const prevCatTx = prevTx.filter(t => t.categoryId === cat.id && t.type === 'expense');
        const prevAmount = prevCatTx.reduce((s, t) => s + t.amount, 0);
        return {
          ...cat,
          prevAmount,
          delta: cat.amount - prevAmount,
          deltaPercent: prevAmount > 0 ? ((cat.amount - prevAmount) / prevAmount) * 100 : 0,
        };
      });
    }

    // ─── TREND ULTIMI 6 PERIODI ────────────────────────────────────────
    const trendPeriods = availablePeriods.slice(-6);
    const trendData = trendPeriods.map(group => {
      const pIds = group.periods.map(p => p.id);
      const pTx = transactions.filter(t => pIds.includes(t.periodId) && t.status === 'paid');
      const pEntrate = pTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const pUscite = pTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const pRisparmio = pEntrate - pUscite;
      return {
        label: group.label.split(' ').slice(-2).join(' '), // abbreviato per grafico
        entrate: pEntrate,
        uscite: pUscite,
        risparmio: pRisparmio,
      };
    });

    // ─── INSIGHTS AUTOMATICI ────────────────────────────────────────────
    const insights = [];
    if (comparisonData) {
      if (comparisonData.savingsRate.delta < -5) {
        insights.push({ type: 'warning', text: `Savings rate in calo di ${Math.abs(comparisonData.savingsRate.delta).toFixed(1)}pp rispetto al periodo precedente` });
      }
      if (comparisonData.uscite.deltaPercent > 10) {
        insights.push({ type: 'warning', text: `Uscite aumentate del ${comparisonData.uscite.deltaPercent.toFixed(1)}% rispetto al periodo precedente` });
      }
      if (comparisonData.risparmio.value < 0 && risparmio < 0) {
        insights.push({ type: 'error', text: 'Risparmio negativo per due periodi consecutivi' });
      }
      if (savingsRate > 20) {
        insights.push({ type: 'success', text: `Ottimo savings rate: ${savingsRate.toFixed(1)}%` });
      }
    }

    // ─── RETURN FINALE ──────────────────────────────────────────────────
    return {
      isDataSufficient: true,
      availablePeriods,
      selectedPeriod: selectedGroup,
      periodData: {
        entrate,
        usciteFisse,
        usciteVariabili,
        usciteStraordinarie,
        investimenti,
        usciteTotali,
        risparmio,
        savingsRate,
      },
      categoryBreakdown,
      comparisonData,
      trendData,
      insights,
    };
  }, [periods, transactions, categories, settings, viewType, selectedPeriodId]);
}
