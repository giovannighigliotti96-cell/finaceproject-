import React from 'react';
import { useFinanceData } from '../context/FinanceContext';
import { Target, AlertTriangle, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import EmptyState from '../components/EmptyState';

export default function Forecast({ onNavigate }) {
  const { data, computed } = useFinanceData();
  const formatEuro = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

  if (!computed.activePeriod) return <EmptyState onGoToAdmin={() => onNavigate?.('admin')} />;

  // FIX 1.6: tutti i dati ora provengono dal context (SSOT)
  const {
    scenariForecast,
    proiezioneAffidabile,
    spesaMediaGiornalieraVariabileAttuale,
    costiFissiTotaliCiclo,
    targetChiusura,
    saldoBaseChiusura,
    gapTarget,
    isOffTrack,
    daysElapsed,
    proiezioneAnnualeRisparmio,
    goalsMonthlyTarget,
    proiezioneVsObiettiviGap,
    inLineaConObiettivi,
  } = computed;

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div>
        <h2>Motore di Previsione</h2>
        <p className="kpi-sub">
          Proiezioni basate sulla tua spesa variabile media attuale di {formatEuro(spesaMediaGiornalieraVariabileAttuale)}/gg.
        </p>
      </div>

      {/* FIX 3.9: avviso proiezione non affidabile nei primi giorni */}
      {!proiezioneAffidabile && (
        <div className="flex items-start gap-3 p-4 rounded" style={{ background: 'var(--status-yellow-bg)', border: '1px solid var(--status-yellow)' }}>
          <Clock size={18} color="var(--status-yellow)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--status-yellow)' }}>
              Proiezione non ancora disponibile
            </div>
            <div className="kpi-sub mt-1">
              Servono almeno 7 giorni di spesa variabile per calcolare una proiezione affidabile.
              Oggi è il giorno {daysElapsed} del ciclo.
            </div>
          </div>
        </div>
      )}

      {proiezioneAffidabile && (
        <>
          <div className="grid-3col">
            <div className="card">
              <div className="kpi-label">Spesa Media Giornaliera</div>
              <div className="kpi-value text-xl">{formatEuro(spesaMediaGiornalieraVariabileAttuale)}<span className="text-sm font-medium text-muted"> / gg</span></div>
              <p className="kpi-sub mt-1">Calcolata su {daysElapsed} gg trascorsi.</p>
            </div>

            <div className="card">
              <div className="kpi-label">Uscite Totali Proiettate</div>
              <div className="kpi-value text-xl text-yellow">
                {formatEuro(costiFissiTotaliCiclo + (computed.proiezioneVariabileBase || 0))}
              </div>
              <p className="kpi-sub mt-1">Fissi {formatEuro(costiFissiTotaliCiclo)} + Variabili proiettati</p>
            </div>

            <div className="card" style={{ borderTop: `3px solid ${isOffTrack ? 'var(--status-red)' : 'var(--status-green)'}` }}>
              <div className="kpi-label">Chiusura Stimata (Base)</div>
              <div className="kpi-value text-xl" style={{ color: isOffTrack ? 'var(--status-red)' : 'var(--status-green)' }}>
                {saldoBaseChiusura !== null ? formatEuro(saldoBaseChiusura) : '—'}
              </div>
              {gapTarget !== null && (
                <div className="flex items-center gap-1 mt-1 text-xs font-medium" style={{ color: isOffTrack ? 'var(--status-red)' : 'var(--status-green)' }}>
                  {isOffTrack ? <AlertTriangle size={12} /> : <Target size={12} />}
                  Target {formatEuro(targetChiusura)}: {gapTarget > 0 ? '+' : ''}{formatEuro(gapTarget)}
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ height: 380 }}>
            <h3 className="mb-4">Scenari di Chiusura Ciclo</h3>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={scenariForecast} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} minTickGap={20} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `€${v}`} width={80} />
                <Tooltip
                  cursor={{ fill: 'var(--bg-tertiary)' }}
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '12px' }}
                  formatter={(value) => formatEuro(value)}
                />
                <ReferenceLine y={targetChiusura} stroke="var(--status-green)" strokeDasharray="4 4"
                  label={{ position: 'insideTopRight', value: 'Target', fill: 'var(--status-green)', fontSize: 11 }} />
                <ReferenceLine y={data.settings.safetyBuffer} stroke="var(--status-red)" strokeDasharray="4 4"
                  label={{ position: 'insideBottomRight', value: 'Buffer', fill: 'var(--status-red)', fontSize: 11 }} />
                <Bar dataKey="saldo" radius={[6, 6, 0, 0]} maxBarSize={120}>
                  {scenariForecast.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ borderTop: `3px solid ${inLineaConObiettivi ? 'var(--status-green)' : 'var(--status-red)'}` }}>
            <h3 className="mb-4">Proiezione Annuale e Obiettivi</h3>
            <div className="grid-3col">
              <div>
                <div className="kpi-label">Risparmio Stimato Annuo</div>
                <div className="kpi-value text-xl">{formatEuro(proiezioneAnnualeRisparmio)}</div>
                <p className="kpi-sub mt-1">Estrapolazione del risparmio del ciclo corrente</p>
              </div>
              <div>
                <div className="kpi-label">Target Mensile Obiettivi</div>
                <div className="kpi-value text-xl">{formatEuro(goalsMonthlyTarget)}</div>
                <p className="kpi-sub mt-1">Importo necessario per i tuoi obiettivi con scadenza</p>
              </div>
              <div>
                <div className="kpi-label">Gap Annualizzato</div>
                <div className="kpi-value text-xl" style={{ color: inLineaConObiettivi ? 'var(--status-green)' : 'var(--status-red)' }}>
                  {proiezioneVsObiettiviGap > 0 ? '+' : ''}{formatEuro(proiezioneVsObiettiviGap * 12)}
                </div>
                <p className="kpi-sub mt-1">Differenza proiettata a fine anno</p>
              </div>
            </div>
            {goalsMonthlyTarget === 0 && (
              <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Nessun obiettivo con scadenza impostato.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
