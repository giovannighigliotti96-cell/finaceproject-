import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useFinanceStore } from '../store/useFinanceStore';
import { usePensionProjection } from '../hooks/computed/usePensionProjection';
import { useOverviewMetrics } from '../hooks/computed/useOverviewMetrics';
import {
  Briefcase, TrendingUp, ShieldCheck, PiggyBank,
  Scale, AlertCircle, CheckCircle2, Info
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';

// ─── Utils ───────────────────────────────────────────────────────────────────
const formatEuro = (val) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val ?? 0);

/** Converte in modo sicuro qualsiasi input a Number; ritorna fallback se non finito */
const toNum = (val, fallback = 0) => {
  const n = Number(val);
  return isFinite(n) ? n : fallback;
};

/** Handler onChange per input numerici: salva sempre un Number, mai una stringa */
const numChange = (setter, key, isInt = false) => (e) => {
  const raw = e.target.value;
  if (raw === '' || raw === null) { setter(key, 0); return; }
  const n = isInt ? parseInt(raw, 10) : parseFloat(raw);
  setter(key, isFinite(n) ? n : 0);
};

// ─── Stili condivisi ─────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%',
  padding: '0.65rem 0.75rem',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-muted)',
  marginBottom: '0.4rem',
};

// ─── Sub-componenti ───────────────────────────────────────────────────────────
function FormField({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color, borderColor, badge }) {
  return (
    <div className="card" style={{ borderTop: `3px solid ${borderColor || 'var(--border-color)'}`, transition: 'opacity 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
        {Icon && <Icon size={14} color={color || 'var(--text-muted)'} />}
        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ fontSize: '2rem', fontWeight: 900, color: color || 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
        {badge && (
          <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
            {badge}
          </span>
        )}
      </div>
      {sub && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem', lineHeight: 1.3 }}>{sub}</p>}
    </div>
  );
}

// ─── Vista principale ─────────────────────────────────────────────────────────
export default function Pension() {
  const cfg = useFinanceStore(useShallow(state => state.data?.settings?.pensionConfig || {}));
  const updatePensionConfig = useFinanceStore(state => state.updatePensionConfig);

  const proj = usePensionProjection();
  const { fireNumber } = useOverviewMetrics(); // Per linea di riferimento FIRE

  // Setter centralizzato — always saves to the NEW field names
  const set = (key, val) => updatePensionConfig({ [key]: val });

  // Lettura con backward-compat per stato persistito con vecchi nomi
  const portalBalance   = toNum(cfg.currentTfrBalance ?? cfg.currentTfr, 0);
  const monthlyAccrual  = toNum(cfg.monthlyAccrual ?? cfg.monthlyContribution, 175);
  const currentAge      = toNum(cfg.currentAge, 30);
  const retirementAge   = toNum(cfg.retirementAge, 67);
  const annualReturn    = toNum(cfg.annualReturn, 3.5);
  const lastStatement   = cfg.lastStatementDate || '2025-12';
  const tfrDest         = cfg.tfrDestination || 'fondo';
  const isVoluntaryActive = toNum(cfg.voluntaryContributionPercentage, 0) > 0;

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.5rem', paddingBottom: '100px' }}>

      {/* ── HEADER ── */}
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
          <Briefcase size={26} color="var(--chart-primary)" />
          Previdenza & TFR
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '700px', lineHeight: 1.5 }}>
          Proiezione del montante previdenziale con correzione automatica del mismatch temporale tra estratto conto del portale e TFR realmente maturato in azienda ad oggi.
        </p>
      </header>

      {/* ── ALERT GAP BANNER (Spostato in cima, condizionale) ── */}
      {proj.gapMonths > 0 && (
        <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertCircle size={22} color="#f59e0b" style={{ flexShrink: 0 }} />
          <div style={{ color: '#f59e0b', fontSize: '0.9rem', fontWeight: 600 }}>
            Gap rilevato: i contributi degli ultimi {proj.gapMonths} mesi ({formatEuro(proj.gapAccrued)}) non sono ancora stati contabilizzati sul portale del fondo.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-start' }}>

        {/* ── COLONNA SINISTRA: FORM ── */}
        <div className="card" style={{ flex: '1 1 340px', minWidth: '320px', maxWidth: '400px', position: 'sticky', top: '1rem' }}>
          <h2 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <Scale size={16} />
            ⚙️ Parametri Simulazione
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Destinazione TFR */}
            <FormField label="Destinazione TFR">
              <select
                value={tfrDest}
                onChange={e => set('tfrDestination', e.target.value)}
                style={inputStyle}
              >
                <option value="fondo">Fondo Pensione / Comparto Mercato</option>
                <option value="azienda">TFR in Azienda / INPS (legge)</option>
              </select>
            </FormField>

            {/* Sezione estratto conto */}
            <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--chart-secondary)', marginBottom: '0.75rem' }}>
                📋 Estratto Conto Portale Fondo
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <FormField label="Saldo Ufficiale Portale (€)">
                  <input
                    type="number"
                    min="0"
                    style={inputStyle}
                    value={portalBalance}
                    onChange={numChange(set, 'currentTfrBalance', false)}
                  />
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    Il saldo che vedi sul portale del fondo (può essere "vecchio").
                  </p>
                </FormField>

                <FormField label="Mese Competenza Estratto Conto">
                  <input
                    type="month"
                    max="2050-12"
                    style={inputStyle}
                    value={lastStatement}
                    onChange={e => set('lastStatementDate', e.target.value)}
                  />
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    A quale mese si riferisce il saldo sopra? Le aziende versano con ritardo.
                  </p>
                </FormField>

                <FormField label="Quota TFR Mensile in Busta Paga (€)">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    style={inputStyle}
                    value={monthlyAccrual}
                    onChange={numChange(set, 'monthlyAccrual', false)}
                  />
                </FormField>
              </div>
            </div>

            {/* Dati anagrafici */}
            <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                👤 Dati Personali & Proiezione
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <FormField label="Età Attuale">
                  <input
                    type="number"
                    min="18"
                    max="80"
                    style={inputStyle}
                    value={currentAge}
                    onChange={numChange(set, 'currentAge', true)}
                  />
                </FormField>
                <FormField label="Età Pensione">
                  <input
                    type="number"
                    min="50"
                    max="80"
                    style={inputStyle}
                    value={retirementAge}
                    onChange={numChange(set, 'retirementAge', true)}
                  />
                </FormField>
              </div>
            </div>

            {/* Rendimento (solo fondo) */}
            {tfrDest !== 'azienda' && (
              <FormField label="Rendimento Annuo Stimato (%)">
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.1"
                  style={inputStyle}
                  value={annualReturn}
                  onChange={numChange(set, 'annualReturn', false)}
                />
                <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  Capitalizzato mensilmente (tasso / 12).
                </p>
              </FormField>
            )}

            {/* Banner info TFR in azienda */}
            {tfrDest === 'azienda' && (
              <div style={{ background: 'var(--status-yellow-bg)', border: '1px solid var(--status-yellow)', borderRadius: 'var(--radius-md)', padding: '0.75rem' }}>
                <p style={{ fontSize: '0.72rem', color: 'var(--status-yellow)', lineHeight: 1.4 }}>
                  <strong>Rivalutazione INPS applicata:</strong> 1.5% fisso + 75% inflazione (2%) = ~3% annuo. Tassazione uscita: 23% flat (IRPEF media).
                </p>
              </div>
            )}

            {/* Toggle Contribuzione Volontaria (solo fondo) */}
            {tfrDest !== 'azienda' && (
              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isVoluntaryActive}
                    onChange={e => set('voluntaryContributionPercentage', e.target.checked ? 1.5 : 0)}
                    style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: 'var(--chart-primary)', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Attiva Contribuzione Volontaria (1.5%)</div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                      Versando l'1.5% del reddito, il datore di lavoro aggiunge un ulteriore 1.5% gratuito.
                    </p>
                  </div>
                </label>
              </div>
            )}

          </div>
        </div>

        {/* ── COLONNA DESTRA: KPI + CHART ── */}
        <div style={{ flex: '2 1 600px', display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: '0' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '-0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              📊 Situazione Attuale
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Proiezione basata sui parametri a sinistra →</span>
          </div>

          {/* HERO CARD: Saldo Reale Oggi */}
          <div className="card" style={{ borderTop: '4px solid #00BCD4', background: 'rgba(0, 188, 212, 0.05)', padding: '2rem', transition: 'opacity 0.3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <CheckCircle2 size={16} color="#00BCD4" />
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Saldo Reale Stimato Ad Oggi</span>
            </div>
            <div style={{ fontSize: '3.5rem', fontWeight: 900, color: '#00BCD4', lineHeight: 1, margin: '0.5rem 0' }}>
              {formatEuro(proj.realCurrentBalance)}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Portale: {formatEuro(portalBalance)} <span style={{ opacity: 0.5 }}>+</span> {proj.gapMonths} mesi non contabilizzati ({formatEuro(proj.gapAccrued)})
            </p>
          </div>

          {/* KPI Grid (3-col) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <KpiCard
              icon={TrendingUp}
              label="Capitale Lordo a Pensione"
              value={formatEuro(proj.grossBalanceAtRetirement)}
              sub={`Versato totale: ${formatEuro(proj.totalInvested)}`}
              color="var(--text-primary)"
              borderColor="var(--chart-tertiary)"
            />

            {/* Tassazione (Aggiornata semantica) */}
            <KpiCard
              icon={Info}
              label="Tassazione Uscita"
              value={`${(proj.applicableTaxRate * 100).toFixed(1)}%`}
              badge={proj.tfrDest === 'fondo' ? 'Agevolato' : null}
              sub={proj.tfrDest === 'fondo' ? 'Agevolazione FP: max 15% → min 9%' : 'IRPEF media standard (flat 23%)'}
              color="var(--text-primary)"
              borderColor="var(--border-color)"
            />

            <KpiCard
              icon={PiggyBank}
              label="Potere d'Acquisto Reale"
              value={formatEuro(proj.realPowerOfPurchase)}
              sub="Netto svalutato per inflazione 2%/anno"
              color="var(--text-primary)"
              borderColor="var(--chart-primary)"
            />
          </div>

          {/* CHART */}
          <div className="card" style={{ marginTop: '0.5rem' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={16} />
              📈 Proiezione a Lungo Termine
            </h3>

            <div style={{ width: '100%' }}>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={proj.projectionChartData} margin={{ top: 20, right: 20, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gNominal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--chart-tertiary)" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="var(--chart-tertiary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--chart-primary)" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="var(--chart-primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gInvested" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--text-muted)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--text-muted)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  
                  <XAxis
                    dataKey="age"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => `${v} anni`}
                  />
                  
                  {/* Dominio Y dinamico per ridurre lo spazio bianco in alto */}
                  <YAxis
                    domain={[0, dataMax => Math.ceil(dataMax * 1.1)]}
                    tickFormatter={v => `€${(v / 1000).toFixed(0)}k`}
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={72}
                  />

                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                    }}
                    formatter={(value, name) => [formatEuro(value), name]}
                    labelFormatter={(label, payload) => {
                      const yearOffset = payload?.[0]?.payload?.yearOffset || 0;
                      const currentYear = new Date().getFullYear();
                      return `Anno: ${currentYear + yearOffset} (Età: ${label} anni)`;
                    }}
                  />
                  
                  <Legend wrapperStyle={{ fontSize: '0.78rem', paddingTop: '16px' }} iconType="circle" />

                  {/* Linee di riferimento */}
                  {fireNumber > 0 && (
                    <ReferenceLine 
                      y={fireNumber} 
                      stroke="var(--status-yellow)" 
                      strokeDasharray="4 4" 
                      label={{ position: 'insideTopLeft', value: 'Obiettivo FIRE', fill: 'var(--text-muted)', fontSize: 10, offset: 10 }} 
                    />
                  )}
                  <ReferenceLine 
                    x={retirementAge} 
                    stroke="var(--text-muted)" 
                    strokeDasharray="4 4" 
                    label={{ position: 'insideBottomRight', value: `Pensione`, fill: 'var(--text-muted)', fontSize: 10, offset: 10 }} 
                  />

                  <Area
                    type="monotone"
                    dataKey="nominalBalance"
                    name="Capitale Nominale"
                    stroke="var(--chart-tertiary)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#gNominal)"
                  />
                  <Area
                    type="monotone"
                    dataKey="realBalance"
                    name="Potere d'Acquisto Reale"
                    stroke="var(--chart-primary)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#gReal)"
                  />
                  <Area
                    type="monotone"
                    dataKey="invested"
                    name="Capitale Versato"
                    stroke="var(--text-muted)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    fillOpacity={1}
                    fill="url(#gInvested)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
