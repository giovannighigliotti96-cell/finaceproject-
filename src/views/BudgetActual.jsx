import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useOverviewMetrics } from '../hooks/computed/useOverviewMetrics';
import { useFinanceStore } from '../store/useFinanceStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import EmptyState from '../components/EmptyState';

export default function BudgetActual({ onNavigate }) {
  const data = useFinanceStore(useShallow(state => state.data || {}));
  const computed = useOverviewMetrics();
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
  // KPI P2-8: total of expenses in categories without budget
  const totalSenzaBudget = categoriesSenzaBudget.reduce((s, c) => {
    const spent = (computed.paidPeriodTx || []).filter(t => t.categoryId === c.id && t.type === 'expense').reduce((ss, t) => ss + t.amount, 0);
    return s + spent;
  }, 0);
  const countSenzaBudget = categoriesSenzaBudget.length;
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
      {countSenzaBudget > 0 && (
        <div className="card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="kpi-label">Spese senza budget</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>
              {formatEuro(totalSenzaBudget)}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{countSenzaBudget} categorie coinvolte</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Categorie principali</div>
            <div style={{ marginTop: '0.5rem', fontWeight: 700 }}>{categoriesSenzaBudget.map(c => c.name).slice(0,5).join(', ')}</div>
          </div>
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
