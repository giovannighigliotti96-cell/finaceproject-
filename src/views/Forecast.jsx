import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useOverviewMetrics } from '../hooks/computed/useOverviewMetrics';
import { useFinanceStore } from '../store/useFinanceStore';
import { Target, AlertTriangle, Clock, TrendingDown, Minus, TrendingUp, ShieldCheck, ShieldAlert } from 'lucide-react';
import EmptyState from '../components/EmptyState';

/* ── helper ── */
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/* ── ScenarioCard ── */
function ScenarioCard({ scenario, targetChiusura, safetyBuffer, formatEuro, isBase }) {
  const { name, saldo, color, description } = scenario;

  const lowerName = name.toLowerCase();
  const ScenIcon = lowerName.includes('prud') ? TrendingDown
    : lowerName.includes('stress') ? TrendingUp
    : Minus;

  const gapVsTarget = saldo - targetChiusura;
  const gapVsBuffer = saldo - safetyBuffer;
  const aboveTarget  = gapVsTarget >= 0;
  const aboveBuffer  = gapVsBuffer >= 0;

  const range = Math.max(targetChiusura - safetyBuffer, 1);
  const progressRaw = ((saldo - safetyBuffer) / range) * 100;
  const progressPct = clamp(progressRaw, 0, 110);

  const barColor = !aboveBuffer ? 'var(--status-red)'
    : aboveTarget ? 'var(--status-green)'
    : 'var(--status-yellow)';

  const statusLabel = !aboveBuffer ? 'Sotto buffer'
    : aboveTarget ? 'Sopra target'
    : 'Tra buffer e target';
  const statusColor = !aboveBuffer ? 'var(--status-red)'
    : aboveTarget ? 'var(--status-green)'
    : 'var(--status-yellow)';
  const statusBg = !aboveBuffer ? 'var(--status-red-bg)'
    : aboveTarget ? 'var(--status-green-bg)'
    : 'var(--status-yellow-bg)';
  const StatusIcon = !aboveBuffer ? ShieldAlert : ShieldCheck;

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: `1px solid var(--border-color)`,
      borderTop: `3px solid ${barColor}`,
      borderRadius: 'var(--radius-lg)',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      position: 'relative',
      transition: 'box-shadow 0.2s ease',
      boxShadow: isBase ? 'var(--shadow-md)' : 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: `${color}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <ScenIcon size={18} color={color} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {name}
            </div>
            {description && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>
            )}
          </div>
        </div>

        {isBase && (
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.55rem',
            borderRadius: 'var(--radius-full)',
            background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
            textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
          }}>Attuale</span>
        )}
      </div>

      <div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4 }}>
          Saldo stimato a chiusura
        </div>
        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: barColor, lineHeight: 1 }}>
          {formatEuro(saldo)}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 6 }}>
          <span style={{ color: 'var(--status-red)', fontWeight: 600 }}>Buffer {formatEuro(safetyBuffer)}</span>
          <span style={{ color: 'var(--status-green)', fontWeight: 600 }}>Target {formatEuro(targetChiusura)}</span>
        </div>
        <div style={{
          width: '100%', height: 8, borderRadius: 99,
          background: 'var(--bg-tertiary)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${clamp(progressPct, 0, 100)}%`,
            borderRadius: 99,
            background: barColor,
            transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
          }} />
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 5,
        }}>
          <span>0%</span>
          <span>{progressPct > 105 ? '>100%' : `${Math.round(progressPct)}%`} del percorso</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: '0.72rem', fontWeight: 600, padding: '0.25rem 0.6rem',
          borderRadius: 'var(--radius-full)',
          background: aboveTarget ? 'var(--status-green-bg)' : 'var(--status-red-bg)',
          color: aboveTarget ? 'var(--status-green)' : 'var(--status-red)',
        }}>
          {aboveTarget ? <Target size={11} /> : <AlertTriangle size={11} />}
          {gapVsTarget >= 0 ? '+' : ''}{formatEuro(gapVsTarget)} vs Target
        </div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: '0.72rem', fontWeight: 600, padding: '0.25rem 0.6rem',
          borderRadius: 'var(--radius-full)',
          background: aboveBuffer ? 'var(--status-green-bg)' : 'var(--status-red-bg)',
          color: aboveBuffer ? 'var(--status-green)' : 'var(--status-red)',
        }}>
          <StatusIcon size={11} />
          {gapVsBuffer >= 0 ? '+' : ''}{formatEuro(gapVsBuffer)} vs Buffer
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0.5rem 0.75rem',
        borderRadius: 'var(--radius-md)',
        background: statusBg,
        marginTop: 'auto',
      }}>
        <StatusIcon size={13} color={statusColor} />
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: statusColor }}>{statusLabel}</span>
      </div>
    </div>
  );
}

/* ── Main View ── */
export default function Forecast({ onNavigate }) {
  const data = useFinanceStore(useShallow(state => state.data || {}));
  const computed = useOverviewMetrics();
  const formatEuro = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

  if (!computed.activePeriod) return <EmptyState onGoToAdmin={() => onNavigate?.('admin')} />;

  const {
    scenariForecast,
    proiezioneAffidabile,
    spesaMediaGiornalieraVariabileAttuale,
    costiFissiTotaliCiclo,
    targetChiusura,
    daysElapsed,
    proiezioneAnnualeRisparmio,
    goalsMonthlyTarget,
    proiezioneVsObiettiviGap,
    inLineaConObiettivi,
  } = computed;

  const safetyBuffer = data?.settings?.safetyBuffer ?? 0;

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div>
        <h2>Motore di Previsione</h2>
        <p className="kpi-sub">
          Proiezioni basate sulla tua spesa variabile media attuale di {formatEuro(spesaMediaGiornalieraVariabileAttuale)}/gg.
        </p>
      </div>

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
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3>Scenari di Chiusura Ciclo</h3>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--status-green)' }}>
                  <span style={{ width: 14, height: 3, background: 'var(--status-green)', borderRadius: 2, display: 'inline-block' }} />
                  Target ({formatEuro(targetChiusura)})
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--status-red)' }}>
                  <span style={{ width: 14, height: 3, background: 'var(--status-red)', borderRadius: 2, display: 'inline-block' }} />
                  Buffer ({formatEuro(safetyBuffer)})
                </span>
              </div>
            </div>

            <div className="grid-3col">
              {(scenariForecast || []).map((scenario, i) => (
                <ScenarioCard
                  key={i}
                  scenario={scenario}
                  targetChiusura={targetChiusura}
                  safetyBuffer={safetyBuffer}
                  formatEuro={formatEuro}
                  isBase={i === 1}
                />
              ))}
            </div>

            <div style={{
              display: 'flex', gap: '1rem', marginTop: '1.25rem',
              padding: '0.75rem 1rem',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-secondary)',
              flexWrap: 'wrap',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--status-green)', display: 'inline-block' }} />
                Sopra il target
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--status-yellow)', display: 'inline-block' }} />
                Tra buffer e target
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--status-red)', display: 'inline-block' }} />
                Sotto il buffer — attenzione
              </span>
            </div>
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
