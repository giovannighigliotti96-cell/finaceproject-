import React from 'react';
import { useFinanceData } from '../context/FinanceContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { CheckCircle2, ShieldCheck, Zap, TrendingDown, Calendar } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import KpiInfo from '../components/KpiInfo';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

export default function Overview({ onNavigate }) {
  const { data, computed } = useFinanceData();
  const markFixedCostAsPaid = useFinanceStore(state => state.markFixedCostAsPaid);
  const formatEuro = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

  if (!computed.activePeriod) return <EmptyState onGoToAdmin={() => onNavigate?.('admin')} />;

  const pendingFixedCosts = computed.plannedPeriodTx?.filter(t => t.nature === 'fixed') || [];
  const isPositive = (computed.spendibileGiornalieroFinoAlProssimoStipendio ?? 0) >= 0;

  // ── Totali uscite del ciclo (per il tab di riepilogo) ───────────────────────
  const allFixedTx      = computed.periodTx?.filter(t => t.nature === 'fixed' && (t.type === 'expense' || t.type === 'investment')) || [];
  const totalFissiCiclo = allFixedTx.reduce((s, t) => s + t.amount, 0);          // paid + planned
  const totalVariabili  = computed.variableExpensesActual ?? 0;                   // solo paid
  const totalSpeso      = (computed.fixedExpensesActual ?? 0) + (computed.investmentActual ?? 0) + totalVariabili; // solo effettivamente usciti
  const totalImpegni    = computed.usciteFissePianificateResidue ?? 0;            // pianificati non ancora pagati

  return (
    <div className="animate-fade-in flex flex-col gap-6">

      {/* --- EXTRAORDINARY INCOME BADGE --- */}
      {computed.hasExtraordinaryIncome && (
        <div style={{ background: 'var(--status-yellow-bg)', color: 'var(--status-yellow)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={16} />
          Mese con entrata straordinaria — KPI normalizzati sul reddito ordinario
        </div>
      )}

      {/* --- PERIOD OVERRUN BANNER --- */}
      {computed.isPeriodOverrun && (
        <div style={{ background: 'var(--status-red-bg)', color: 'var(--status-red)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendingDown size={16} />
          Il periodo è scaduto — aggiorna la data di chiusura o registra lo stipendio per aprire il nuovo ciclo.
        </div>
      )}

      {/* ── HERO: SPENDIBILE GIORNALIERO ─────────────────────────────── */}
      <div className="card" style={{
        textAlign: 'center',
        padding: '3rem 2rem',
        background: 'linear-gradient(160deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)',
        borderTop: `4px solid ${isPositive ? 'var(--status-green)' : 'var(--status-red)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Zap size={14} color="var(--status-yellow)" />
          <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Budget Spendibile Giornaliero · Netto Costi Fissi
          </span>
          <KpiInfo text="Quanto puoi spendere ogni giorno fino al prossimo stipendio. Calcolato come: stipendio − fissi − buffer − variabili già spese, diviso per i giorni rimasti." />
        </div>
        <div style={{ fontSize: '4.5rem', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em', color: isPositive ? 'var(--status-green)' : 'var(--status-red)' }}>
          {formatEuro(computed.spendibileGiornalieroFinoAlProssimoStipendio ?? 0)}
        </div>
        <div style={{ marginTop: '1.25rem', display: 'inline-flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-primary)', padding: '0.5rem 1.25rem', borderRadius: '999px', border: '1px solid var(--border-color)' }}>
          <Calendar size={13} color="var(--text-muted)" />
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Prossimo stipendio
          </span>
          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            {format(parseISO(computed.activePeriod.endDate), 'dd MMMM yyyy', { locale: it })}
          </strong>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--status-green)' }}>
            tra {computed.giorniMancantiAlProssimoAccredito} gg
          </span>
        </div>
        <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          Patrimonio Netto:&nbsp;
          <span style={{ color: (computed.netWorth ?? 0) >= 0 ? 'var(--status-green)' : 'var(--status-red)', fontWeight: 800 }}>
            {formatEuro(computed.netWorth ?? 0)}
          </span>
        </div>
      </div>

      {/* --- SAVINGS HEALTH MONITOR ---------------------------------------- */}
      {computed.activePeriod && (() => {
        const status = computed.savingsHealthStatus; // 'safe' | 'at_risk' | 'eroding'
        const borderColor = status === 'safe' ? 'var(--status-green)'
          : status === 'at_risk' ? 'var(--status-yellow)'
          : 'var(--status-red)';
        const bg = status === 'safe' ? 'rgba(16,185,129,0.06)'
          : status === 'at_risk' ? 'rgba(245,158,11,0.07)'
          : 'rgba(239,68,68,0.08)';
        const label = status === 'safe' ? '✓ In linea con l\'obiettivo'
          : status === 'at_risk' ? '⚡ Margine stretto — attenzione alle spese'
          : '⚠ Stai erodendo il risparmio target';
        const em = computed.erosionMargin ?? 0;
        const buf = computed.savingsTargetBuffer ?? 0;
        // progress bar: 0% = tutto eroso, 100% = margine = buf
        const barPct = buf > 0 ? Math.min(100, Math.max(0, ((em + buf) / (buf * 1.5)) * 100)) : 0;
        return (
          <div style={{ background: bg, border: `1.5px solid ${borderColor}`, borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Obiettivo Risparmio · Buffer +{formatEuro(buf)}
                  <KpiInfo text={`Stai andando verso la chiusura del mese con almeno +${formatEuro(buf)} rispetto a quello che avevi prima dello stipendio? Verde = sì, giallo = margine stretto, rosso = stai erodendo il risparmio.`} />
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: borderColor }}>{label}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: borderColor, lineHeight: 1 }}>
                  {em >= 0 ? '+' : ''}{formatEuro(em)}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {em >= 0 ? 'margine disponibile' : 'già eroso'}
                </div>
              </div>
            </div>
            {/* Barra erosione */}
            <div style={{ height: 8, background: 'var(--bg-tertiary)', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${barPct}%`, background: borderColor, borderRadius: '999px', transition: 'width 0.4s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Target chiusura min: <strong style={{ color: 'var(--text-secondary)' }}>{formatEuro(computed.targetClosingMin ?? 0)}</strong></span>
              {computed.savingsMarginDailyExtra !== null && (
                <span>
                  {computed.savingsMarginDailyExtra >= 0
                    ? <>Puoi spendere ancora <strong style={{ color: 'var(--status-green)' }}>{formatEuro(computed.savingsMarginDailyExtra)}/gg</strong> extra</>
                    : <>Overspending <strong style={{ color: 'var(--status-red)' }}>{formatEuro(Math.abs(computed.savingsMarginDailyExtra))}/gg</strong></>
                  }
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* --- ALERT REGOLE IN SCADENZA --- */}
      {computed.hasRegolaInScadenza && (
        <div style={{ background: 'var(--bg-tertiary)', borderLeft: '4px solid var(--status-yellow)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ℹ️ Regole in scadenza
          </div>
          {computed.regolaInScadenza.map((r, i) => (
            <div key={i} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {r.name} ({formatEuro(r.amount)}) termina in {r.daysLeft} giorni.
              Lo Spendibile Giornaliero aumenterà di {formatEuro(r.amount / computed.totalDaysInPeriod)}/giorno dal prossimo ciclo.
            </div>
          ))}
        </div>
      )}

      {/* ── RIGA CFO KPIs (Wealth & Efficiency) ──────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '-1rem' }}>
        <div className="card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: `3px solid ${computed.savingsRateTotal >= computed.savingsRateTarget ? 'var(--status-green)' : 'var(--status-yellow)'}` }}>
          <div className="kpi-label" style={{ display: 'flex', alignItems: 'center' }}>Savings Rate <KpiInfo text="Quanta parte del tuo stipendio riesci a risparmiare. Esempio: 20% significa che ogni 100€ guadagnati, 20 vengono messi da parte. Sopra il 20% sei in zona ottimale." /></div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: computed.savingsRateTotal >= computed.savingsRateTarget ? 'var(--status-green)' : 'var(--status-yellow)' }}>
              {computed.savingsRateTotal?.toFixed(1)}%
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Totale vs {computed.savingsRateTarget?.toFixed(1)}%</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Ordinario: {computed.savingsRateOrdinary?.toFixed(1)}%
          </div>
        </div>

        <div className="card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: `3px solid ${computed.fixedCostCoverageRatio < 1.5 ? 'var(--status-red)' : 'var(--status-green)'}` }}>
          <div className="kpi-label" style={{ display: 'flex', alignItems: 'center' }}>Fixed Cost Coverage <KpiInfo text="Quante volte il tuo stipendio copre le spese fisse del mese. Se è 2x, guadagni il doppio di quello che paghi in fissi. Sotto 1.5x inizia ad essere stretto." /></div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: computed.fixedCostCoverageRatio < 1.5 ? 'var(--status-red)' : 'var(--status-green)' }}>
              {computed.fixedCostCoverageRatio > 900 ? '∞' : computed.fixedCostCoverageRatio?.toFixed(2)}x
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{computed.fixedCostCoverageRatio < 1.5 ? 'Rischio (<1.5)' : 'Sicuro (>1.5)'}</span>
          </div>
        </div>

        <div className="card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: `3px solid ${computed.emergencyFundRatio < 3 ? 'var(--status-red)' : 'var(--status-green)'}` }}>
          <div className="kpi-label" style={{ display: 'flex', alignItems: 'center' }}>Autonomia Finanziaria <KpiInfo text="Per quanti mesi potresti vivere con la tua liquidità attuale (conto + risparmi + investimenti) se smettessi di guadagnare. Minimo consigliato: 3 mesi." /></div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: computed.emergencyFundRatio < 3 ? 'var(--status-red)' : 'var(--status-green)' }}>
              {computed.emergencyFundRatio > 900 ? '∞' : computed.emergencyFundRatio?.toFixed(1)} mesi
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{computed.emergencyFundRatio < 3 ? 'Rischio (<3 mesi)' : 'Ottimale'}</span>
          </div>
        </div>

        <div className="card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: `3px solid var(--status-green)` }}>
          <div className="kpi-label" style={{ display: 'flex', alignItems: 'center' }}>Risparmio Cumulato (Storico) <KpiInfo text="La media ponderata del tasso di risparmio degli ultimi 6 cicli. È più affidabile del dato mensile perché livella i mesi anomali o con entrate straordinarie." /></div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--status-green)' }}>
              {computed.storicoSavingsRate?.toFixed(1)}%
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Media ultimi 6 cicli</span>
          </div>
        </div>


        <div className="card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: `3px solid var(--status-yellow)` }}>
          <div className="kpi-label" style={{ display: 'flex', alignItems: 'center' }}>Cash Drag Annuo <KpiInfo text="Il rendimento che 'perdi' ogni anno tenendo troppa liquidità sul conto corrente invece di investirla. Non è una perdita visibile, ma è un costo implicito reale." /></div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--status-yellow)' }}>
              {formatEuro(computed.cashDragAnnuo || 0)}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rendimento perso su liquidità in eccesso</span>
          </div>
        </div>
      </div>

      {/* ── RIGA KPI: 3 numeri chiave ────────────────────────────────── */}
      <div className="grid-3col">

        {/* Liquidità disponibile netta */}
        <div className="card" style={{ borderLeft: '4px solid var(--status-green)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
            <ShieldCheck size={14} color="var(--status-green)" />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Liquidità Netta
            </span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, lineHeight: 1, color: isPositive ? 'var(--text-primary)' : 'var(--status-red)' }}>
            {formatEuro(computed.liquiditaDisponibileScudo ?? 0)}
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {[
              { label: 'Stipendio ciclo',    value: computed.incomeActual ?? 0,                                                               sign: '+', color: 'var(--text-primary)'  },
              { label: 'Fissi totali',        value: (computed.fixedExpensesActual ?? 0) + (computed.usciteFissePianificateResidue ?? 0),      sign: '−', color: 'var(--status-red)'    },
              { label: 'Variabili pagate',    value: computed.variableExpensesActual ?? 0,                                                     sign: '−', color: 'var(--status-yellow)' },
              { label: 'Buffer riservato',    value: data.settings.safetyBuffer ?? 0,                                                         sign: '−', color: 'var(--status-yellow)' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                <span style={{ fontWeight: 700, color: r.color }}>{r.sign} {formatEuro(r.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Totale speso finora */}
        <div className="card" style={{ borderLeft: '4px solid var(--status-yellow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
            <TrendingDown size={14} color="var(--status-yellow)" />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Totale Uscite al Momento
            </span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, lineHeight: 1, color: 'var(--text-primary)' }}>
            {formatEuro(totalSpeso)}
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {[
              { label: 'Costi fissi pagati',    value: (computed.fixedExpensesActual ?? 0) + (computed.investmentActual ?? 0) },
              { label: 'Costi variabili',        value: totalVariabili },
              { label: 'Impegni fissi in attesa',value: totalImpegni, italic: true },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)', fontStyle: r.italic ? 'italic' : 'normal' }}>{r.label}</span>
                <span style={{ fontWeight: r.italic ? 600 : 700, color: r.italic ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                  {formatEuro(r.value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Totale impegni fissi del ciclo */}
        <div className="card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
            <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#8b5cf6', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Uscite Strutturali del Ciclo
            </span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, lineHeight: 1, color: '#8b5cf6' }}>
            {formatEuro(totalFissiCiclo)}
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {allFixedTx.map(tx => (
              <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {tx.status === 'paid'
                    ? <CheckCircle2 size={11} color="var(--status-green)" />
                    : <span style={{ width: 11, height: 11, borderRadius: '50%', border: '1.5px solid var(--status-yellow)', display: 'inline-block' }} />
                  }
                  {tx.description}
                </span>
                <span style={{ fontWeight: 700, color: tx.status === 'paid' ? 'var(--status-green)' : 'var(--text-muted)' }}>
                  {formatEuro(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
            {/* ── REDDITO RICORRENTE ATTESO ────────────────────────────────── */}
      {(computed.recurringIncomeExpected ?? 0) > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--status-green)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Reddito Ricorrente Atteso
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Entrate fisse pianificate ancora da incassare questo ciclo
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--status-green)', lineHeight: 1 }}>
              + {formatEuro(computed.recurringIncomeExpected)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Già incassato: {formatEuro(computed.incomeActual ?? 0)}
            </div>
          </div>
        </div>
      )}

      
      {/* ── CHECKLIST COSTI FISSI PENDENTI ──────────────────────────── */}
      {pendingFixedCosts.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <CheckCircle2 size={16} />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Costi Fissi da Confermare
            </span>
            <span style={{ marginLeft: 'auto', background: 'var(--status-red-bg)', color: 'var(--status-red)', borderRadius: '999px', padding: '0.1rem 0.6rem', fontSize: '0.7rem', fontWeight: 800 }}>
              {pendingFixedCosts.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pendingFixedCosts.map(tx => (
              <div key={tx.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.75rem 1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                borderLeft: '3px solid var(--status-red)',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{tx.description}</div>
                  <div style={{ fontWeight: 700, color: 'var(--status-red)', fontSize: '0.8rem' }}>{formatEuro(tx.amount)}</div>
                </div>
                <button
                  onClick={() => markFixedCostAsPaid(tx.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.45rem 1rem', background: 'rgba(16,185,129,0.1)',
                    border: '1px solid var(--status-green)', borderRadius: 'var(--radius-md)',
                    color: 'var(--status-green)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  <CheckCircle2 size={14} /> Pagato
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
