import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useOverviewMetrics } from '../hooks/computed/useOverviewMetrics';
import { useFinanceStore } from '../store/useFinanceStore';
import { usePensionProjection } from '../hooks/computed/usePensionProjection';
import { Landmark, Shield, TrendingUp, Wallet, Plus, Trash2, Edit3, X, Check, Building, Briefcase } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { useToast } from '../components/Toast';
import EmptyState from '../components/EmptyState';
import KpiInfo from '../components/KpiInfo';

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
  const data = useFinanceStore(useShallow(state => state.data || {}));
  const computed = useOverviewMetrics();
  const addAccount = useFinanceStore(state => state.addAccount);
  const updateAccount = useFinanceStore(state => state.updateAccount);
  const deleteAccount = useFinanceStore(state => state.deleteAccount);
  const showToast = useToast();

  // TFR: saldo reale stimato ad oggi (portale + mesi di gap non contabilizzati)
  const { realCurrentBalance: tfrRealBalance = 0 } = usePensionProjection();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'operating_liquidity', currentBalance: '', updatePeriodOpening: false });

  const formatEuro = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

  const resetForm = () => {
    setForm({ name: '', type: 'operating_liquidity', currentBalance: '', updatePeriodOpening: false });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = () => {
    if (!form.name.trim()) { showToast('Inserisci un nome', 'error'); return; }
    const balance = parseFloat(form.currentBalance);
    if (isNaN(balance)) { showToast('Saldo non valido', 'error'); return; }
    if (editingId) {
      updateAccount(editingId, { name: form.name, type: form.type, currentBalance: balance }, form.updatePeriodOpening);
      showToast('Conto aggiornato', 'success');
    } else {
      addAccount({ name: form.name, type: form.type, currentBalance: balance });
      showToast('Conto aggiunto', 'success');
    }
    resetForm();
  };

  const handleEdit = (acc) => {
    setForm({ name: acc.name, type: acc.type, currentBalance: acc.currentBalance ?? acc.balance ?? 0, updatePeriodOpening: false });
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

  // TFR incluso nel Patrimonio Netto Totale come asset previdenziale stimato
  const tfrAsset = isFinite(tfrRealBalance) && tfrRealBalance > 0 ? tfrRealBalance : 0;
  const totalNetWorth = liquidNetWorth + realEstateValue + tfrAsset;

  // G-12: storico patrimonio — preferiamo snapshot contabili dai periodi chiusi se disponibili.
  // Se non esistono periodi chiusi, mostriamo comunque una "wealth proxy" chiaramente etichettata.
  const closedPeriods = (data.periods || []).filter(p => p.status === 'closed').sort((a, b) => a.startDate.localeCompare(b.startDate));

  let wealthHistory = [];
  if (closedPeriods.length > 0) {
    // Costruiamo la serie usando i closed periods come snapshot di chiusura (più sicuro/coerente)
    wealthHistory = closedPeriods.map(p => {
      const snapshotOpening = (p.openingBalance ?? 0) + (p.openingInvestments ?? 0);
      return {
        label: format(parseISO(p.endDate || p.startDate), 'MMM yy', { locale: it }),
        patrimonio: snapshotOpening + realEstateValue,
      };
    });
    // aggiungiamo il valore 'Oggi' come riferimento
    wealthHistory.push({ label: 'Oggi', patrimonio: totalNetWorth });
  } else {
    // Fallback: non abbiamo snapshot chiusi affidabili — mostriamo una proxy chiara
    wealthHistory = [...(data.periods || [])]
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map(p => ({
        label: format(parseISO(p.startDate), 'MMM yy', { locale: it }),
        patrimonio: (p.openingBalance ?? 0) + (p.openingInvestments ?? 0) + realEstateValue,
      }));
    if (wealthHistory.length > 0) wealthHistory.push({ label: 'Oggi', patrimonio: totalNetWorth });
  }


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
        {/* G2: MoM Net Worth Growth */}
        {computed.momNetWorthGrowth !== null && computed.momNetWorthGrowth !== undefined && (
          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              fontSize: '0.85rem', fontWeight: 700,
              color: computed.momNetWorthGrowth >= 0 ? 'var(--status-green)' : 'var(--status-red)',
              background: computed.momNetWorthGrowth >= 0 ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)',
              padding: '0.25rem 0.75rem', borderRadius: '999px',
            }}>
              {computed.momNetWorthGrowth >= 0 ? '▲' : '▼'}
              {Math.abs(computed.momNetWorthGrowth).toFixed(2)}% vs ciclo precedente
              <KpiInfo text="Crescita % del patrimonio netto rispetto al mese scorso. Calcolato su saldo apertura + investimenti del ciclo precedente." />
            </span>
          </div>
        )}
        <div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: '1rem',
  marginTop: '2rem'
}}>
  {[
    {
      label: 'Liquidità',
      value: accounts
        .filter(a => a.type === 'operating_liquidity')
        .reduce((s, a) => s + (a.currentBalance ?? a.balance ?? 0), 0),
      color: '#3b82f6'
    },
    {
      label: 'Risparmi',
      value: accounts
        .filter(a => a.type === 'savings')
        .reduce((s, a) => s + (a.currentBalance ?? a.balance ?? 0), 0),
      color: 'var(--status-green)'
    },
    {
      label: 'Investimenti',
      value: accounts
        .filter(a => a.type === 'investments' || a.type === 'pension')
        .reduce((s, a) => s + (a.currentBalance ?? a.balance ?? 0), 0),
      color: '#8b5cf6'
    },
    {
      label: 'Immobili',
      value: realEstateValue,
      color: 'var(--text-primary)'
    }
  ].map(kpi => (
    <div key={kpi.label} style={{
      padding: '1rem',
      backgroundColor: 'var(--bg-primary)',
      borderRadius: 'var(--radius-md)',
      borderTop: `3px solid ${kpi.color}`
    }}>
      <div className="kpi-label mb-1">{kpi.label}</div>
      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: kpi.value < 0 ? 'var(--status-red)' : kpi.color }}>
        {formatEuro(kpi.value)}
      </div>
    </div>
  ))}
  {/* 5ª card: Previdenza / TFR */}
  <div style={{
    padding: '1rem',
    backgroundColor: 'var(--bg-primary)',
    borderRadius: 'var(--radius-md)',
    borderTop: '3px solid #818cf8',
    background: 'linear-gradient(160deg, rgba(99,102,241,0.08) 0%, var(--bg-primary) 100%)'
  }}>
    <div className="kpi-label mb-1" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
      <Briefcase size={11} /> Previdenza / TFR
    </div>
    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#a5b4fc' }}>
      {formatEuro(tfrAsset)}
    </div>
    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
      TFR reale stimato ad oggi
    </div>
  </div>
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

  const color = plPct === null ? 'var(--text-muted)' : plPct >= 0 ? 'var(--status-green)' : 'var(--status-red)';

  return (
    <div className="card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="kpi-label mb-1">Rendimento Portafoglio (ciclo corrente)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color }}>
            {plPct === null ? 'n.d.' : `${plPct >= 0 ? '+' : ''}${plPct.toFixed(2)}%`}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {plPct === null
              ? 'P&L stimato non disponibile: manca un account investimenti dedicato o base dati incoerente.'
              : `P&L: ${pl >= 0 ? '+' : ''}${formatEuro(pl)} · Base: ${formatEuro(costBasis)}`}
          </div>
        </div>
        <TrendingUp size={32} color={color} style={{ opacity: 0.4 }} />
      </div>
    </div>
  );
})()}

      {/* G5: FIRE Number & Progress */}
      {computed.fireNumber !== null && computed.fireNumber !== undefined && (
        <div className="card" style={{ borderTop: '3px solid #8b5cf6' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
          <div className="kpi-label mb-1" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>🔥 FIRE Number <KpiInfo text="Il patrimonio investito che ti serve per smettere di lavorare, secondo la regola del 4%: puoi prelevare ogni anno il 4% del tuo portafoglio senza esaurirlo in 30+ anni." position="below" /></div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Patrimonio investito necessario per l'indipendenza finanziaria (regola 4%)</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#8b5cf6' }}>{formatEuro(computed.fireNumber)}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Base: {formatEuro(computed.fireAnnualExpenses ?? 0)}/anno × 25</div>
            </div>
          </div>
          {/* Barra progresso FIRE */}
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Portafoglio attuale: <strong style={{ color: '#8b5cf6' }}>{formatEuro(computed.investments ?? 0)}</strong></span>
              <span style={{ fontWeight: 700, color: '#8b5cf6' }}>{(computed.fireProgress ?? 0).toFixed(1)}%</span>
            </div>
            <div style={{ height: 10, background: 'var(--bg-tertiary)', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, computed.fireProgress ?? 0)}%`,
                background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
                borderRadius: '999px',
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
          {computed.yearsToFire !== null && computed.yearsToFire !== undefined && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              ⏱ Stima: <strong style={{ color: '#8b5cf6' }}>
                {computed.yearsToFire === 0 ? 'Già raggiunto! 🎉' : `${computed.yearsToFire.toFixed(1)} anni`}
              </strong> al FIRE (tasso {(Number(data.settings?.expectedReturnRate ?? 3.5)).toFixed(1)}% annuo + PAC {formatEuro(computed.investmentActual ?? 0)}/mese)
            </div>
          )}
        </div>
      )}

      {/* ── LIQUIDITY RATIOS ─────────────────────────────────────────── */}
      {computed.usciteFissePianificateResidue > 0 && (
        <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div>
            <div className="kpi-label mb-1" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>Current Ratio <KpiInfo text="Quante volte la tua liquidità (conto corrente + risparmi) copre i costi fissi ancora da pagare questo mese. Sopra 1.5x sei tranquillo, sotto 1x è rischio." /></div>
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
            <div className="kpi-label mb-1" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>Quick Ratio <KpiInfo text="Come il Current Ratio, ma considera solo il conto corrente operativo, senza i conti risparmio. Misura quanto sei liquido 'subito'." /></div>
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
      {computed.usciteFissePianificateResidue > 0 && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>Obligations Coverage Ratio <KpiInfo text="Tutta la tua ricchezza liquida (conto + risparmi + investimenti) divisa per i costi fissi residui del mese. Mostra quante risorse hai in totale rispetto agli obblighi rimasti." position="below" /></div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: computed.obligationsCoverageRatio === Infinity ? 'var(--text-muted)' : (computed.obligationsCoverageRatio < 1 ? 'var(--status-red)' : computed.obligationsCoverageRatio < 1.5 ? 'var(--status-yellow)' : 'var(--status-green)') }}>
            {computed.obligationsCoverageRatio === Infinity ? 'n.d.' : (computed.obligationsCoverageRatio)?.toFixed(2) + 'x'}
          </div>
        </div>
      )}

      {/* G-12: GRAFICO CRESCITA PATRIMONIO */}
      {wealthHistory.length >= 2 && (
        <div className="card" style={{ height: 280 }}>
          <h3 className="mb-4">Crescita Patrimonio nel Tempo</h3>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            {(data.periods || []).some(p => p.status === 'closed')
              ? 'Serie costruita sui snapshot di chiusura dei periodi (contabili)'
              : 'Wealth proxy storico: apertura cicli + stime immobiliari (non snapshot contabili)'}
          </div>
          <ResponsiveContainer width="100%" height="82%">
            <LineChart data={wealthHistory} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} minTickGap={20} />
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
          {editingId && (
            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="checkbox" 
                id="update_period" 
                checked={form.updatePeriodOpening} 
                onChange={e => setForm(p => ({ ...p, updatePeriodOpening: e.target.checked }))} 
              />
              <label htmlFor="update_period" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Applica questo saldo anche come Saldo Iniziale del ciclo corrente (usa se stai correggendo un errore di chiusura mese)
              </label>
            </div>
          )}
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
                            <button onClick={() => handleEdit(acc)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 'bold' }}>Modifica</button>
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
