import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCashFlowMetrics } from '../hooks/computed/useCashFlowMetrics';
import { useFinanceStore } from '../store/useFinanceStore';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import KpiInfo from '../components/KpiInfo';

export default function CashControl({ onNavigate }) {
  const computed = useCashFlowMetrics();
  const dataSettings = useFinanceStore(useShallow(state => state.data.settings || {}));
  const formatEuro = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

  if (!computed.activePeriod) return <EmptyState onGoToAdmin={() => onNavigate?.('admin')} />;

  // FIX 1.2 + 1.6 + F06: dati ora provengono dal context
  const { bridgeData, stressDays, daysToSalary, finalBridgeBalance, giorniCritici } = computed;
  const isSafe = finalBridgeBalance >= (dataSettings.safetyBuffer || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h2>Cash Control: Bridge to Salary</h2>
        <p className="kpi-sub">
          Simulazione dell'erosione del saldo fino al prossimo accredito.{' '}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Burn variabile: {formatEuro(computed.spesaMediaGiornalieraVariabileAttuale)}/gg (media storica)
          </span>
        </p>
      </div>

      {/* GRAFICO PRINCIPALE */}
      <div className="card" style={{ height: '380px', padding: '1.5rem 1rem 1rem' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Proiezione Saldo Operativo (gg per gg)
        </p>
        <ResponsiveContainer width="100%" height="90%">
          <AreaChart data={bridgeData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradBalance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="var(--text-secondary)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              minTickGap={20}
              interval={Math.floor(daysToSalary / 7)}
            />
            <YAxis
              stroke="var(--text-secondary)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `€${v}`}
              width={70}
            />
            <Tooltip
              cursor={{ stroke: 'var(--border-color)', strokeWidth: 1 }}
              contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}
              formatter={v => [formatEuro(v), 'Saldo Previsto']}
            />
            <ReferenceLine
              y={dataSettings.safetyBuffer || 0}
              stroke="var(--status-yellow)"
              strokeDasharray="5 5"
              label={{ value: `Buffer ${formatEuro(dataSettings.safetyBuffer || 0)}`, position: 'insideTopRight', fontSize: 10, fill: 'var(--status-yellow)' }}
            />
            <Area
              type="monotone"
              dataKey="Saldo"
              stroke="#3b82f6"
              strokeWidth={3}
              fill="url(#gradBalance)"
              dot={false}
              activeDot={{ r: 7, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid-2col" style={{ alignItems: 'start' }}>
        {/* STRESS DAYS */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <AlertTriangle size={16} color="var(--status-yellow)" />
            <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Addebiti Rilevanti
            </span>
            <KpiInfo text="Giorni in cui c'è un addebito pianificato significativo (fisso o variabile) che supera la soglia di attenzione. Sia i costi fissi che le spese variabili pianificate compaiono qui." position="below" />
          </div>
          {stressDays.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Nessun giorno critico rilevato.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {stressDays.map((sd, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--status-red)' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{sd.date}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{sd.names}</div>
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--status-red)' }}>
                    -{formatEuro(sd.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RUNWAY ANALYSIS */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <TrendingDown size={16} color="var(--text-muted)" />
            <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Analisi Runway
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { label: 'Giorni alla paga', value: `${computed.giorniMancantiAlProssimoAccredito} gg`, color: 'var(--text-primary)', info: 'Quanti giorni mancano al prossimo accredito dello stipendio (data fine ciclo).' },
              { label: 'Giorni critici (< Buffer)', value: `${giorniCritici} gg`, color: giorniCritici > 0 ? 'var(--status-red)' : 'var(--status-green)', info: `Giorni simulati in cui il saldo scenderebbe sotto il buffer di sicurezza (${formatEuro(dataSettings.safetyBuffer || 0)}). Zero è ottimale.` },
              { label: 'Burn variabile/gg (media)', value: formatEuro(computed.spesaMediaGiornalieraVariabileAttuale), color: 'var(--status-yellow)', info: 'Media giornaliera delle spese variabili già pagate in questo ciclo. Usata per proiettare il saldo futuro.' },
              { label: 'Impegni fissi residui', value: formatEuro(computed.usciteFissePianificateResidue), color: 'var(--status-red)', info: 'Totale delle spese fisse ancora da pagare in questo ciclo (pianificate ma non ancora confermate).' },
              { label: 'Saldo finale stimato', value: formatEuro(finalBridgeBalance), color: isSafe ? 'var(--status-green)' : 'var(--status-red)', info: 'Saldo del conto corrente stimato al giorno del prossimo stipendio, dopo burn variabile e addebiti fissi.' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: i < 4 ? '1px solid var(--border-color)' : 'none' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  {row.label}
                  <KpiInfo text={row.info} position="below" />
                </span>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
