import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useFinanceStore } from '../store/useFinanceStore';
import { usePensionProjection } from '../hooks/computed/usePensionProjection';
import { Briefcase, TrendingUp, ShieldCheck, Info, PiggyBank, Scale } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Pension() {
  const formatEuro = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);
  const config = useFinanceStore(useShallow(state => state.data.settings?.pensionConfig || {}));
  const updatePensionConfig = useFinanceStore(state => state.updatePensionConfig);
  
  const {
    tfrDest,
    grossBalanceAtRetirement,
    applicableTaxRate,
    netBalanceAtRetirement,
    realPowerOfPurchase,
    projectionChartData,
    totalInvested
  } = usePensionProjection();

  const handleUpdate = (key, value) => {
    updatePensionConfig({ [key]: value });
  };

  const handleToggleVoluntary = (e) => {
    const isChecked = e.target.checked;
    updatePensionConfig({
      voluntaryContributionPercentage: isChecked ? 1.5 : 0
    });
  };

  const isVoluntaryActive = config.voluntaryContributionPercentage > 0;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem', paddingBottom: '100px' }}>
      <header className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Briefcase size={28} color="var(--chart-primary)" />
          Previdenza & TFR
        </h1>
        <p className="kpi-sub" style={{ fontSize: '1rem', maxWidth: '800px' }}>
          Proiezione del capitale pensionistico cumulato nel tempo. Confronta l'opzione "Fondo Pensione" con il "TFR in Azienda" e analizza il reale potere d'acquisto decurtato dall'inflazione (stimata 2% annuo).
        </p>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-start' }}>
        
        {/* COLONNA SINISTRA: CONFIGURAZIONE */}
        <div className="card" style={{ flex: '1 1 350px', position: 'sticky', top: '1rem' }}>
          <h2 className="text-xl font-bold mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Scale size={20} color="var(--chart-secondary)" />
            Parametri Simulazione
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="kpi-label mb-2 block">Destinazione TFR</label>
              <select 
                value={config.tfrDestination}
                onChange={(e) => handleUpdate('tfrDestination', e.target.value)}
                style={{
                  width: '100%', padding: '0.75rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)'
                }}
              >
                <option value="fondo">Fondo Pensione / Mercato (Rendimento variabile, agevolazioni fiscali)</option>
                <option value="azienda">TFR in Azienda / INPS (Rivalutazione legale, tassazione ordinaria)</option>
              </select>
            </div>

            <div>
              <label className="kpi-label mb-2 block">TFR Attuale / Capitale Iniziale (€)</label>
              <input 
                type="number"
                value={config.currentTfr}
                onChange={(e) => handleUpdate('currentTfr', parseFloat(e.target.value) || 0)}
                style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label className="kpi-label mb-2 block">Contributo Mensile (TFR Lordo) (€)</label>
              <input 
                type="number"
                value={config.monthlyContribution}
                onChange={(e) => handleUpdate('monthlyContribution', parseFloat(e.target.value) || 0)}
                style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label className="kpi-label mb-2 block">Età Attuale</label>
                <input 
                  type="number"
                  value={config.currentAge}
                  onChange={(e) => handleUpdate('currentAge', parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="kpi-label mb-2 block">Età Pensione</label>
                <input 
                  type="number"
                  value={config.retirementAge}
                  onChange={(e) => handleUpdate('retirementAge', parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            {config.tfrDestination === 'fondo' && (
              <div>
                <label className="kpi-label mb-2 block">Rendimento Annuo Stimato (%)</label>
                <input 
                  type="number" step="0.1"
                  value={config.annualReturn}
                  onChange={(e) => handleUpdate('annualReturn', parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>*Applicato in modo composto mensilmente.</p>
              </div>
            )}

            {config.tfrDestination === 'azienda' && (
              <div className="p-3 mt-2 rounded" style={{ background: 'var(--status-yellow-bg)', border: '1px solid var(--status-yellow)' }}>
                <p className="text-xs" style={{ color: 'var(--status-yellow)' }}>
                  <strong>Nota:</strong> Stai simulando il TFR lasciato in azienda. Il rendimento stimato inserito viene ignorato e sostituito dalla rivalutazione di legge italiana: 1.5% fisso + 75% inflazione (stimata al 2%). Rendimento lordo totale applicato: ~3% annuo.
                </p>
              </div>
            )}

            {/* Contribuzione Volontaria (Solo se Fondo Pensione) */}
            {config.tfrDestination === 'fondo' && (
              <div className="p-4 mt-2 rounded" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox"
                    checked={isVoluntaryActive}
                    onChange={handleToggleVoluntary}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--chart-primary)' }}
                  />
                  <span className="font-bold" style={{ fontSize: '0.9rem' }}>Attiva Contribuzione Volontaria (1.5%)</span>
                </label>
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Versando l'1.5% del tuo stipendio, hai diritto al <strong>contributo del datore di lavoro (1.5%)</strong>. I contributi volontari e datoriali si sommeranno al TFR generando maggiore interesse composto.
                </p>
              </div>
            )}

          </div>
        </div>

        {/* COLONNA DESTRA: RISULTATI E GRAFICI */}
        <div style={{ flex: '1 1 600px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            
            <div className="card" style={{ borderTop: '3px solid var(--chart-tertiary)' }}>
              <div className="kpi-label mb-1 flex items-center gap-2"><TrendingUp size={16} /> Capitale Lordo Maturato</div>
              <div className="kpi-value text-2xl">{formatEuro(grossBalanceAtRetirement)}</div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Capitale versato: {formatEuro(totalInvested)}</p>
            </div>

            <div className="card" style={{ borderTop: '3px solid var(--status-red)' }}>
              <div className="kpi-label mb-1 flex items-center gap-2"><Info size={16} /> Tassazione (Uscita)</div>
              <div className="kpi-value text-2xl" style={{ color: 'var(--status-red)' }}>
                {(applicableTaxRate * 100).toFixed(2)}%
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {tfrDest === 'fondo' ? `Agevolazione Fondo Pensione applicata` : `Aliquota Media Irpef Standard (Flat)`}
              </p>
            </div>

            <div className="card" style={{ borderTop: '3px solid var(--status-green)' }}>
              <div className="kpi-label mb-1 flex items-center gap-2"><PiggyBank size={16} /> Capitale Netto Liquidato</div>
              <div className="kpi-value text-2xl" style={{ color: 'var(--status-green)' }}>{formatEuro(netBalanceAtRetirement)}</div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Quello che riceverai sul conto</p>
            </div>

            <div className="card" style={{ borderTop: '3px solid var(--chart-primary)' }}>
              <div className="kpi-label mb-1 flex items-center gap-2"><ShieldCheck size={16} /> Valore Reale (Potere d'Acquisto)</div>
              <div className="kpi-value text-2xl" style={{ color: 'var(--chart-primary)' }}>{formatEuro(realPowerOfPurchase)}</div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Netto svalutato dell'inflazione 2%</p>
            </div>

          </div>

          {/* CHART */}
          <div className="card flex-1">
            <h3 className="text-lg font-bold mb-4">Proiezione a Lungo Termine</h3>
            
            <div style={{ height: '400px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={projectionChartData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorNominal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-tertiary)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="var(--chart-tertiary)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-primary)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="var(--chart-primary)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--text-muted)" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="var(--text-muted)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="age" tick={{ fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                  <YAxis 
                    tickFormatter={(val) => `€${(val / 1000).toFixed(0)}k`} 
                    tick={{ fill: 'var(--text-muted)' }} 
                    tickLine={false} 
                    axisLine={false} 
                    width={80}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
                    itemStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                    formatter={(value) => [formatEuro(value), '']}
                    labelFormatter={(label) => `Età: ${label}`}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Area type="monotone" name="Capitale Nominale" dataKey="nominalBalance" stroke="var(--chart-tertiary)" fillOpacity={1} fill="url(#colorNominal)" />
                  <Area type="monotone" name="Potere d'Acquisto Reale" dataKey="realBalance" stroke="var(--chart-primary)" fillOpacity={1} fill="url(#colorReal)" />
                  <Area type="monotone" name="Capitale Versato (TFR + Contr.)" dataKey="invested" stroke="var(--text-muted)" fillOpacity={0.5} fill="url(#colorInvested)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
