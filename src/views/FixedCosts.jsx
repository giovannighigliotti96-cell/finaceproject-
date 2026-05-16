import React from 'react';
import { useFinanceData } from '../context/FinanceContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import EmptyState from '../components/EmptyState';
import KpiInfo from '../components/KpiInfo';

export default function FixedCosts({ onNavigate }) {
  const { data, computed } = useFinanceData();
  const allFixedTx = computed.periodTx?.filter(t => t.nature === 'fixed') || [];
  const plannedFixed = allFixedTx.filter(t => t.status === 'planned');
  const paidFixed = allFixedTx.filter(t => t.status === 'paid');
  const incomeActual = computed.incomeActual ?? 0; // G3: per calcolo % su reddito
  const markFixedCostAsPaid = useFinanceStore(state => state.markFixedCostAsPaid);
  const unmarkFixedCostAsPaid = useFinanceStore(state => state.unmarkFixedCostAsPaid);

  const formatEuro = (val) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

  if (!computed.activePeriod) return <EmptyState onGoToAdmin={() => onNavigate?.('admin')} />;

  // Transazioni fisse del ciclo corrente (paid + planned).
  // Separiamo spese fisse dagli investimenti programmati (PAC) per chiarezza (P2-7).
  const expenseFixedTx = computed.periodTx.filter(t => t.nature === 'fixed' && t.type === 'expense');
  const investmentFixedTx = computed.periodTx.filter(t => t.nature === 'fixed' && t.type === 'investment');
  const paidExpenseFixed = expenseFixedTx.filter(t => t.status === 'paid');
  const plannedExpenseFixed = expenseFixedTx.filter(t => t.status === 'planned');

  const paidInvestmentFixed = investmentFixedTx.filter(t => t.status === 'paid');
  const plannedInvestmentFixed = investmentFixedTx.filter(t => t.status === 'planned');

  const totalExpensesFixed = expenseFixedTx.reduce((s, t) => s + t.amount, 0);
  const totalInvestmentsFixed = investmentFixedTx.reduce((s, t) => s + t.amount, 0);

  // Regole ricorrenti con info scadenza per la sezione informativa
  const currentPeriodId = computed.activePeriod.id;
  const activeRules = data.recurringRules.filter(r =>
    (!r.startDate || currentPeriodId >= r.startDate) &&
    (!r.endDate || currentPeriodId <= r.endDate)
  );
  const expiringRules = activeRules.filter(r => r.endDate && r.endDate === currentPeriodId);
  const futureRules = data.recurringRules.filter(r => r.startDate && currentPeriodId < r.startDate);

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div>
        <h2>Costi Fissi</h2>
        <p className="kpi-sub">Impegni ricorrenti del ciclo fiscale. Confermali man mano che vengono addebitati.</p>
      </div>

      {/* KPI Summary: separiamo uscite fisse e trasferimenti patrimoniali (PAC) */}
      <div className="grid-3col">
        <div className="card" style={{ borderTop: '3px solid var(--border-color)' }}>
          <div className="kpi-label" style={{ display: 'flex', alignItems: 'center' }}>Totale Uscite Fisse <KpiInfo text="Somma di tutte le spese fisse del ciclo (pagate + pianificate), esclusi i trasferimenti patrimoniali. È il costo strutturale del mese." /></div>
          <div className="kpi-value text-xl">{formatEuro(totalExpensesFixed)}</div>
          <p className="kpi-sub mt-1">{expenseFixedTx.length} voci pianificate</p>
        </div>
        <div className="card" style={{ borderTop: '3px solid var(--status-green)' }}>
          <div className="kpi-label" style={{ display: 'flex', alignItems: 'center' }}>Già Confermati (Pagati) <KpiInfo text="Spese fisse che hai già marcato come 'pagate' in questo ciclo. Il saldo del conto è già stato ridotto di questi importi." /></div>
          <div className="kpi-value text-xl text-green">{formatEuro(paidExpenseFixed.reduce((s, t) => s + t.amount, 0))}</div>
          <p className="kpi-sub mt-1">{paidExpenseFixed.length} voci pagate</p>
        </div>
        <div className="card" style={{ borderTop: '3px solid var(--status-yellow)' }}>
          <div className="kpi-label" style={{ display: 'flex', alignItems: 'center' }}>Trasferimenti (PAC) <KpiInfo text="Trasferimenti patrimoniali pianificati (es. PAC investimento). Non sono spese: i soldi rimangono tuoi, cambia solo il conto dove si trovano." /></div>
          <div className="kpi-value text-xl text-yellow">{formatEuro(totalInvestmentsFixed)}</div>
          <p className="kpi-sub mt-1">{investmentFixedTx.length} trasferimenti pianificati</p>
        </div>
      </div>

      {/* INFO: Scadenze imminenti */}
      {expiringRules.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded" style={{ background: 'var(--status-yellow-bg)', border: '1px solid var(--status-yellow)' }}>
          <AlertCircle size={18} color="var(--status-yellow)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--status-yellow)' }}>Ultima rata questo mese</div>
            <div className="kpi-sub mt-1">
              {expiringRules.map(r => r.name).join(', ')} — non verrà più addebitato il mese prossimo.
            </div>
          </div>
        </div>
      )}

      {/* TABELLA PRINCIPALE */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3>Dettaglio Voci del Ciclo Attivo</h3>
          <span className="kpi-sub">{format(parseISO(computed.activePeriod.startDate), 'dd MMM', { locale: it })} → {format(parseISO(computed.activePeriod.endDate), 'dd MMM yyyy', { locale: it })}</span>
        </div>

        {/* DA PAGARE */}
        {plannedFixed.length > 0 && (
          <div>
            <div className="px-4 py-2 border-b flex items-center gap-2" style={{ background: 'var(--bg-primary)' }}>
              <Clock size={13} color="var(--status-yellow)" />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                Da Confermare
              </span>
            </div>
            {plannedFixed
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .map(tx => (
                <div key={tx.id} className="flex items-center justify-between border-b" style={{ padding: '1rem 1.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{tx.description}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Previsto: {format(parseISO(tx.date), 'dd MMMM yyyy', { locale: it })}
                      {tx.type === 'investment' && (
                        <span style={{ marginLeft: '0.5rem', color: '#8b5cf6', fontWeight: 600 }}>· Trasferimento patrimoniale</span>
                      )}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--status-red)' }}>
                        {formatEuro(tx.amount)}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--status-yellow)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        pianificato
                      </div>
                    </div>
                    {/* G3: % su reddito */}
                    {incomeActual > 0 && (
                      <div style={{ textAlign: 'right', minWidth: '54px' }}>
                        <span style={{
                          fontSize: '0.75rem', fontWeight: 700,
                          color: (tx.amount / incomeActual) >= 0.15 ? 'var(--status-red)'
                            : (tx.amount / incomeActual) >= 0.08 ? 'var(--status-yellow)'
                            : 'var(--status-green)',
                        }}>
                          {((tx.amount / incomeActual) * 100).toFixed(1)}%
                        </span>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>su reddito</div>
                      </div>
                    )}
                    <button
                      onClick={() => markFixedCostAsPaid(tx.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.6rem 1.25rem',
                        background: 'rgba(16,185,129,0.1)',
                        border: '1px solid var(--status-green)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--status-green)',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'background 0.15s',
                      }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(16,185,129,0.2)'}
                      onMouseOut={e => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}
                    >
                      <CheckCircle2 size={15} /> Pagato
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* GIA PAGATI */}
        {paidFixed.length > 0 && (
          <div>
            <div className="px-4 py-2 border-b flex items-center gap-2" style={{ background: 'var(--bg-primary)' }}>
              <CheckCircle2 size={13} color="var(--status-green)" />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                Già Confermati
              </span>
            </div>
            {paidFixed
              .sort((a, b) => new Date(b.paidAt || b.date) - new Date(a.paidAt || a.date))
              .map(tx => (
                <div key={tx.id} className="flex items-center justify-between border-b" style={{ padding: '1rem 1.5rem', opacity: 0.7 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', textDecoration: 'line-through', color: 'var(--text-secondary)' }}>
                      {tx.description}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {format(parseISO(tx.date), 'dd MMMM', { locale: it })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-secondary)' }}>
                      {formatEuro(tx.amount)}
                    </span>
                    {/* G3: % su reddito */}
                    {incomeActual > 0 && (
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 700,
                        color: (tx.amount / incomeActual) >= 0.15 ? 'var(--status-red)'
                          : (tx.amount / incomeActual) >= 0.08 ? 'var(--status-yellow)'
                          : 'var(--text-muted)',
                      }}>
                        {((tx.amount / incomeActual) * 100).toFixed(1)}%
                      </span>
                    )}
                    <CheckCircle2 size={20} color="var(--status-green)" />
                    <button
                      onClick={() => unmarkFixedCostAsPaid(tx.id)}
                      style={{
                        marginLeft: '0.5rem',
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.7rem',
                        background: 'transparent',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {allFixedTx.length === 0 && (
          <div className="p-8 text-center text-muted italic text-sm">
            Nessun costo fisso nel ciclo corrente.<br />
            Vai in Admin / Setup → "Registra Stipendio" per inizializzare il ciclo.
          </div>
        )}
      </div>

      {/* INFO REGOLE ATTIVE */}
      <div className="card">
        <h3 className="mb-4">Regole Attive per questo Ciclo</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {data.recurringRules.map(rule => {
            const isActive =
              (!rule.startDate || currentPeriodId >= rule.startDate) &&
              (!rule.endDate || currentPeriodId <= rule.endDate);
            const isFuture = rule.startDate && currentPeriodId < rule.startDate;
            const isExpiring = rule.endDate && rule.endDate === currentPeriodId;
            return (
              <div key={rule.id} className="flex items-center justify-between p-3 rounded border" style={{
                background: isActive ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
                borderColor: isActive ? 'var(--border-color)' : 'transparent',
                opacity: isActive ? 1 : 0.4,
              }}>
                <div style={{ display: 'flex', flex: 1, gap: '1rem', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{rule.name}</span>
                    <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      giorno {rule.dayOfMonth} del mese
                    </span>
                  </div>
                  {rule.endDate && (
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.6rem',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: isExpiring ? 'var(--status-yellow-bg)' : 'var(--bg-tertiary)',
                      color: isExpiring ? 'var(--status-yellow)' : 'var(--text-muted)',
                    }}>
                      {isExpiring ? '⚠ Ultima rata' : `Fino a ${rule.endDate}`}
                    </span>
                  )}
                  {!rule.endDate && !rule.startDate && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Permanente</span>
                  )}
                  {rule.startDate && currentPeriodId < rule.startDate && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.6rem', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
                      ▶ Parte da {rule.startDate}
                    </span>
                  )}
                </div>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: isActive ? 'var(--text-primary)' : 'var(--text-muted)', minWidth: '90px', textAlign: 'right' }}>
                  {formatEuro(rule.amount)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
