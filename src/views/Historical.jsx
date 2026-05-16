import React, { useState } from 'react';
import { useFinanceData } from '../context/FinanceContext';
import { useHistoricalAnalysis } from '../hooks/useHistoricalAnalysis';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import KpiInfo from '../components/KpiInfo';

export default function Historical({ onNavigate }) {
  const { data } = useFinanceData();
  const [viewType, setViewType] = useState('month');
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);

  const analysis = useHistoricalAnalysis(data, viewType, selectedPeriodId);

  const formatEuro = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);
  const formatPercent = (val) => `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;

  // ─── EMPTY STATE ────────────────────────────────────────────────────
  if (!analysis.isDataSufficient) {
    return (
      <div className="animate-fade-in">
        <EmptyState
          icon="📊"
          title="Dati insufficienti per l'analisi storica"
          message={`Servono almeno ${analysis.minRequired || 1} cicli chiusi per la vista ${viewType}. Attualmente hai ${analysis.currentCount || 0} cicli chiusi.`}
          action={analysis.currentCount > 0 ? { label: 'Vai a Overview', onClick: () => onNavigate?.('overview') } : null}
        />
      </div>
    );
  }

  const { availablePeriods, selectedPeriod, periodData, categoryBreakdown, comparisonData, trendData, insights } = analysis;

  // Auto-select ultimo periodo se non selezionato
  if (!selectedPeriodId && availablePeriods.length > 0) {
    setSelectedPeriodId(availablePeriods[availablePeriods.length - 1].id);
    return null;
  }

  if (!periodData) return null;

  // ─── HELPER: DELTA INDICATOR ────────────────────────────────────────
  const DeltaIndicator = ({ value, isInverted = false }) => {
    if (value === 0) return <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Minus size={14} /> 0%</span>;
    const isPositive = isInverted ? value < 0 : value > 0;
    const color = isPositive ? 'var(--status-green)' : 'var(--status-red)';
    const Icon = value > 0 ? TrendingUp : TrendingDown;
    return (
      <span style={{ color, display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 700 }}>
        <Icon size={14} /> {formatPercent(value)}
      </span>
    );
  };

  // ─── COLORI GRAFICI ─────────────────────────────────────────────────
  const COLORS = {
    entrate: '#10b981',
    uscite: '#ef4444',
    risparmio: '#3b82f6',
    fissi: '#8b5cf6',
    variabili: '#f59e0b',
    straordinari: '#f97316',
    investimenti: '#06b6d4',
  };

  const PIE_COLORS = ['#8b5cf6', '#f59e0b', '#f97316', '#06b6d4', '#ec4899', '#14b8a6', '#f43f5e'];

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      
      {/* ─── HEADER ─────────────────────────────────────────────────── */}
      <div>
        <h2>📊 Storico & Analisi</h2>
        <p className="kpi-sub">Analisi multi-periodo su cicli chiusi</p>
      </div>

      {/* ─── SELETTORI VISTA E PERIODO ──────────────────────────────── */}
      <div className="card" style={{ padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['month', 'quarter', 'semester', 'year'].map(type => (
              <button
                key={type}
                onClick={() => { setViewType(type); setSelectedPeriodId(null); }}
                className={viewType === type ? 'btn btn-primary' : 'btn btn-ghost'}
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              >
                {type === 'month' && 'Mese'}
                {type === 'quarter' && 'Trimestre'}
                {type === 'semester' && 'Semestre'}
                {type === 'year' && 'Anno'}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Periodo:</span>
            <select
              value={selectedPeriodId || ''}
              onChange={e => setSelectedPeriodId(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              {availablePeriods.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── INSIGHTS AUTOMATICI ────────────────────────────────────── */}
      {insights.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {insights.map((insight, i) => {
            const bgColor = insight.type === 'success' ? 'rgba(16,185,129,0.1)' : insight.type === 'warning' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';
            const borderColor = insight.type === 'success' ? 'var(--status-green)' : insight.type === 'warning' ? 'var(--status-yellow)' : 'var(--status-red)';
            const Icon = insight.type === 'success' ? CheckCircle : insight.type === 'warning' ? AlertTriangle : AlertCircle;
            return (
              <div key={i} style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Icon size={18} color={borderColor} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{insight.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── RIEPILOGO PERIODO ──────────────────────────────────────── */}
      <div className="card" style={{ padding: '1.5rem', borderTop: '4px solid var(--chart-primary)' }}>
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Riepilogo Periodo</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
          
          {/* Entrate */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Entrate</span>
              <KpiInfo text="Totale entrate (stipendi + altre entrate) nel periodo selezionato" />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: COLORS.entrate, lineHeight: 1 }}>
              {formatEuro(periodData.entrate)}
            </div>
            {comparisonData && (
              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>vs prev</span>
                <DeltaIndicator value={comparisonData.entrate.deltaPercent} />
              </div>
            )}
          </div>

          {/* Uscite */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Uscite</span>
              <KpiInfo text="Totale uscite (fissi + variabili + straordinari) nel periodo" />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: COLORS.uscite, lineHeight: 1 }}>
              {formatEuro(periodData.usciteTotali)}
            </div>
            {comparisonData && (
              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>vs prev</span>
                <DeltaIndicator value={comparisonData.uscite.deltaPercent} isInverted />
              </div>
            )}
          </div>

          {/* Risparmio */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Risparmio</span>
              <KpiInfo text="Entrate - Uscite (esclude investimenti)" />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: periodData.risparmio >= 0 ? COLORS.risparmio : COLORS.uscite, lineHeight: 1 }}>
              {formatEuro(periodData.risparmio)}
            </div>
            {comparisonData && (
              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>vs prev</span>
                <DeltaIndicator value={comparisonData.risparmio.deltaPercent} />
              </div>
            )}
          </div>

          {/* Savings Rate */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Savings Rate</span>
              <KpiInfo text="Percentuale del reddito risparmiata" />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: periodData.savingsRate >= 20 ? COLORS.entrate : periodData.savingsRate >= 10 ? COLORS.risparmio : COLORS.uscite, lineHeight: 1 }}>
              {periodData.savingsRate.toFixed(1)}%
            </div>
            {comparisonData && (
              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>vs prev</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: comparisonData.savingsRate.delta >= 0 ? COLORS.entrate : COLORS.uscite }}>
                  {comparisonData.savingsRate.delta >= 0 ? '+' : ''}{comparisonData.savingsRate.delta.toFixed(1)}pp
                </span>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ─── GRAFICI: TREND + BREAKDOWN ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        
        {/* Grafico Trend */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>📈 Trend Ultimi Periodi</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} minTickGap={20} />
              <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} width={50} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px', fontSize: '12px' }}
                formatter={(v, name) => [formatEuro(v), name === 'entrate' ? 'Entrate' : name === 'uscite' ? 'Uscite' : 'Risparmio']}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="entrate" stroke={COLORS.entrate} strokeWidth={2} dot={{ r: 4 }} name="Entrate" />
              <Line type="monotone" dataKey="uscite" stroke={COLORS.uscite} strokeWidth={2} dot={{ r: 4 }} name="Uscite" />
              <Line type="monotone" dataKey="risparmio" stroke={COLORS.risparmio} strokeWidth={3} dot={{ r: 5 }} name="Risparmio" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Grafico Breakdown Uscite */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>📊 Breakdown Uscite</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Fissi', value: periodData.usciteFisse, color: COLORS.fissi },
                  { name: 'Variabili', value: periodData.usciteVariabili, color: COLORS.variabili },
                  { name: 'Straordinari', value: periodData.usciteStraordinarie, color: COLORS.straordinari },
                ].filter(d => d.value > 0)}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={90}
                fill="#8884d8"
                dataKey="value"
              >
                {[
                  { name: 'Fissi', value: periodData.usciteFisse, color: COLORS.fissi },
                  { name: 'Variabili', value: periodData.usciteVariabili, color: COLORS.variabili },
                  { name: 'Straordinari', value: periodData.usciteStraordinarie, color: COLORS.straordinari },
                ].filter(d => d.value > 0).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={v => formatEuro(v)} contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: COLORS.fissi }} />
                Fissi
              </span>
              <strong>{formatEuro(periodData.usciteFisse)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: COLORS.variabili }} />
                Variabili
              </span>
              <strong>{formatEuro(periodData.usciteVariabili)}</strong>
            </div>
            {periodData.usciteStraordinarie > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: COLORS.straordinari }} />
                  Straordinari
                </span>
                <strong>{formatEuro(periodData.usciteStraordinarie)}</strong>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ─── DETTAGLIO PER CATEGORIA ────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1rem' }}>📋 Dettaglio per Categoria</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Categoria</th>
              <th style={{ textAlign: 'right' }}>Importo</th>
              <th style={{ textAlign: 'right' }}>% Uscite</th>
              {comparisonData && <th style={{ textAlign: 'right' }}>vs Prev</th>}
              <th style={{ textAlign: 'right' }}>Budget</th>
            </tr>
          </thead>
          <tbody>
            {/* Fissi */}
            <tr style={{ background: 'var(--bg-tertiary)', fontWeight: 700 }}>
              <td colSpan={comparisonData ? 5 : 4} style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                💰 Costi Fissi
              </td>
            </tr>
            {categoryBreakdown.filter(c => c.group === 'fixed').map(cat => (
              <tr key={cat.id}>
                <td>{cat.name}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatEuro(cat.amount)}</td>
                <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{cat.percentage.toFixed(1)}%</td>
                {comparisonData && (
                  <td style={{ textAlign: 'right' }}>
                    {comparisonData.categories.find(c => c.id === cat.id) ? (
                      <DeltaIndicator value={comparisonData.categories.find(c => c.id === cat.id).deltaPercent} isInverted />
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                )}
                <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
              </tr>
            ))}

            {/* Variabili */}
            <tr style={{ background: 'var(--bg-tertiary)', fontWeight: 700 }}>
              <td colSpan={comparisonData ? 5 : 4} style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                🛒 Costi Variabili
              </td>
            </tr>
            {categoryBreakdown.filter(c => c.group === 'variable').map(cat => {
              const budgetStatus = cat.budgetUsage !== null ? (cat.budgetUsage <= 100 ? '✓' : '⚠️') : '—';
              const budgetColor = cat.budgetUsage !== null ? (cat.budgetUsage <= 100 ? 'var(--status-green)' : 'var(--status-red)') : 'var(--text-muted)';
              return (
                <tr key={cat.id}>
                  <td>{cat.name}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatEuro(cat.amount)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{cat.percentage.toFixed(1)}%</td>
                  {comparisonData && (
                    <td style={{ textAlign: 'right' }}>
                      {comparisonData.categories.find(c => c.id === cat.id) ? (
                        <DeltaIndicator value={comparisonData.categories.find(c => c.id === cat.id).deltaPercent} isInverted />
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                  )}
                  <td style={{ textAlign: 'right', color: budgetColor, fontWeight: 600 }}>
                    {cat.budgetUsage !== null ? `${budgetStatus} ${cat.budgetUsage.toFixed(0)}%` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
