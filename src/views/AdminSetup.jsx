import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useOverviewMetrics } from '../hooks/computed/useOverviewMetrics';
import { useFinanceStore } from '../store/useFinanceStore';
import { PlusCircle, Calendar, Wallet, Landmark, ShieldCheck, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminSetup() {
  const data = useFinanceStore(useShallow(state => state.data || {}));
  const computed = useOverviewMetrics();
  const registerSalaryAndStartCycle = useFinanceStore(state => state.registerSalaryAndStartCycle);
  const markFixedCostAsPaid = useFinanceStore(state => state.markFixedCostAsPaid);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    amount: data.settings.defaultIncome || 1900,
    dateStr: '',
    bankBalance: '',
    isExtraordinaryIncome: false,
  });
  const [saved, setSaved] = useState(false);

  const formatEuro = (val) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.dateStr) return alert('Inserisci la data di accredito.');
    if (!form.bankBalance || isNaN(Number(form.bankBalance))) return alert('Inserisci il saldo reale post-accredito.');
    // Tentativo di registrazione: controlliamo se il ciclo è stato effettivamente creato
    const before = data.settings.activePeriodId;
    try {
      registerSalaryAndStartCycle(form);
    } catch (err) {
      console.error(err);
      return alert('Errore durante la registrazione. Controlla i dati.');
    }
    const after = useFinanceStore.getState().data.settings.activePeriodId;
    if (after === before) {
      // Detect specific causes by simple heuristics
      const periodId = (form.dateStr && form.dateStr.includes('/')) ? (() => {
        const [d,m,y] = form.dateStr.split('/'); return `${y}-${m.padStart(2,'0')}`;
      })() : null;
      if (periodId && data.periods.some(p => p.id === periodId && p.status === 'open')) {
        alert('Operazione annullata: esiste già un ciclo aperto con lo stesso periodo.');
      } else {
        alert('Operazione non completata: probabilmente lo stipendio era già registrato o dati incoerenti.');
      }
      return;
    }
    setSaved(true);
    setShowForm(false);
  };

  const inputStyle = {
    width: '100%',
    padding: '0.875rem 1rem',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '1.25rem',
    fontWeight: 700,
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginBottom: '0.5rem',
  };

  const pendingFixedCosts = computed.plannedPeriodTx?.filter(t => t.nature === 'fixed') || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '900px', margin: '0 auto' }}>

      {/* TITLE */}
      <div style={{ textAlign: 'center', paddingBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <ShieldCheck size={22} color="var(--text-primary)" />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.03em' }}>Governance del Ciclo</h1>
        </div>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Il nuovo ciclo parte solo quando registri lo stipendio
        </p>
      </div>

      {/* STATO: NESSUN CICLO */}
      {!computed.activePeriod && !showForm && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', borderStyle: 'dashed', border: '2px dashed var(--border-color)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.7 }}>
            Nessun ciclo fiscale attivo.<br />
            <strong style={{ color: 'var(--text-secondary)' }}>Quando arriva lo stipendio</strong> (tra l'11 e il 12 maggio),<br />
            registralo qui per attivare il sistema.
          </div>
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 2.5rem',
              background: 'var(--text-primary)',
              color: 'var(--bg-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
            }}
          >
            <PlusCircle size={20} />
            Registra Stipendio e Avvia Ciclo
          </button>
        </div>
      )}

      {/* STATO: CICLO ATTIVO, bottone per nuovo ciclo */}
      {computed.activePeriod && !showForm && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 2.5rem',
              background: 'var(--text-primary)',
              color: 'var(--bg-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
            }}
          >
            <PlusCircle size={20} />
            Registra Nuovo Stipendio
          </button>
        </div>
      )}

      {/* FORM REGISTRAZIONE */}
      {showForm && (
        <div className="card" style={{ borderTop: '3px solid var(--status-green)' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1.5rem' }}>
            Registrazione Accredito Stipendio
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
            
              <div>
                <label style={labelStyle}><Wallet size={11} /> Importo (€)</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  style={{ ...inputStyle, color: 'var(--status-green)' }}
                />
              </div>
              <div>
                <label style={labelStyle}><Calendar size={11} /> Data Accredito (gg/mm/aaaa)</label>
                <input
                  type="text"
                  placeholder="es. 12/05/2026"
                  value={form.dateStr}
                  onChange={e => setForm({ ...form, dateStr: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}><Landmark size={11} /> Saldo Reale Banca (€)</label>
                <input
                  type="number"
                  value={form.bankBalance}
                  onChange={e => setForm({ ...form, bankBalance: e.target.value })}
                  placeholder="Saldo effettivo post-accredito"
                  style={inputStyle}
                />
              </div>
              <div>
  <label style={labelStyle}><ArrowRight size={11} /> Portafoglio Investimenti (€)</label>
  <input
    type="number"
    value={form.openingInvestments ?? ''}
    onChange={e => setForm({ ...form, openingInvestments: e.target.value })}
    placeholder="Valore attuale portafoglio"
    style={{ ...inputStyle, color: 'var(--chart-primary)' }}
  />
</div>
            </div>

            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="checkbox"
                id="extraordinary"
                checked={form.isExtraordinaryIncome}
                onChange={e => setForm({ ...form, isExtraordinaryIncome: e.target.checked })}
                style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
              />
              <label htmlFor="extraordinary" style={{ fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600 }}>
                Tredicesima / Entrata Straordinaria
              </label>
            </div>

            <div style={{ display: 'flex', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button
                type="submit"
                style={{
                  flex: 1, padding: '0.875rem',
                  background: 'var(--status-green)', color: 'white',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer',
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                }}
              >
                Salva e Avvia Ciclo
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  padding: '0.875rem 1.5rem',
                  background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RIEPILOGO CICLO + COSTI FISSI */}
      {computed.activePeriod && (
        <div className="grid-2col" style={{ alignItems: 'start' }}>

          {/* CICLO */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Calendar size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Ciclo Fiscale Attivo
              </span>
              <span style={{ marginLeft: 'auto', background: 'var(--status-green-bg)', color: 'var(--status-green)', borderRadius: '999px', padding: '0.15rem 0.75rem', fontSize: '0.65rem', fontWeight: 800 }}>
                OPEN
              </span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, marginBottom: '1rem' }}>
              {computed.activePeriod.startDate} → {computed.activePeriod.endDate}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Giorni rimasti</span>
                <span style={{ fontWeight: 800 }}>{computed.giorniMancantiAlProssimoAccredito} gg</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Saldo apertura</span>
                <span style={{ fontWeight: 800 }}>{formatEuro(computed.activePeriod.openingBalance)}</span>
              </div>
            </div>
          </div>

          {/* COSTI FISSI PENDENTI */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Costi Fissi Pendenti
              </span>
              {pendingFixedCosts.length > 0 && (
                <span style={{ marginLeft: 'auto', background: 'var(--status-red-bg)', color: 'var(--status-red)', borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.65rem', fontWeight: 800 }}>
                  {pendingFixedCosts.length}
                </span>
              )}
            </div>

            {pendingFixedCosts.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Tutti i costi fissi confermati ✓
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {pendingFixedCosts.map(tx => (
                  <div key={tx.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.75rem 1rem', background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--status-red)',
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{tx.description}</div>
                      <div style={{ fontWeight: 800, color: 'var(--status-red)', fontSize: '0.85rem', marginTop: '0.1rem' }}>
                        {formatEuro(tx.amount)}
                      </div>
                    </div>
                    <button
                      onClick={() => markFixedCostAsPaid(tx.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.45rem 0.9rem',
                        background: 'rgba(16,185,129,0.1)', border: '1px solid var(--status-green)',
                        borderRadius: 'var(--radius-md)', color: 'var(--status-green)',
                        fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      ✓ Pagato
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
