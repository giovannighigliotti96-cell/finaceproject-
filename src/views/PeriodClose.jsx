import React, { useState } from 'react';
import { useFinanceData } from '../context/FinanceContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { Lock, ShieldAlert, CheckCircle, AlertTriangle, Wallet, ArrowRight } from 'lucide-react';
import { format, parseISO, addMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import EmptyState from '../components/EmptyState';

export default function PeriodClose({ onNavigate }) {
  const { data, computed } = useFinanceData();
  // FIX 1.1: usa la nuova azione closePeriodAndOpenNext che genera i fissi
  const closePeriodAndOpenNext = useFinanceStore(state => state.closePeriodAndOpenNext);

  const [realBankBalance, setRealBankBalance] = useState(computed.operatingLiquidity ?? 0);
  // FIX 1.1: wizard richiede inserimento stipendio
  const [salaryAmount, setSalaryAmount] = useState(data.settings?.defaultIncome || 1900);
  const [isExtraordinaryIncome, setIsExtraordinaryIncome] = useState(false);
    const [accountUpdates, setAccountUpdates] = useState({});

  const formatEuro = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

  const theoreticalBalance = computed.operatingLiquidity ?? 0;
  const discrepancy = Number(realBankBalance) - theoreticalBalance;
  const isDiscrepancyHigh = Math.abs(discrepancy) > 10;
  const pendingFixed = (computed.plannedPeriodTx || []).filter(t => t.nature === 'fixed');

  const handleClosePeriod = () => {
    if (!computed.activePeriod) return;
    if (!window.confirm('Sei sicuro di voler chiudere il ciclo corrente e aprire quello successivo?')) return;

    if (Math.abs(discrepancy) > 10) {
      alert(`ATTENZIONE: Lo scostamento è di ${formatEuro(discrepancy)}. Verrà creata una transazione di Rettifica nel ciclo corrente per far quadrare i conti prima della chiusura.`);
    }
    const investmentAccount = data.accounts.find(a => a.type === 'investments');
const realInvestmentsBalance = investmentAccount
  ? (accountUpdates[investmentAccount.id] ?? investmentAccount.currentBalance ?? 0)
  : 0;
    // FIX 1.1: closePeriodAndOpenNext genera automaticamente i costi fissi planned
    closePeriodAndOpenNext({
      realBankBalance: Number(realBankBalance),
      salaryAmount: Number(salaryAmount) > 0 ? Number(salaryAmount) : null,
      discrepancy,
      isExtraordinaryIncome,
      accountUpdates, // [GAP-S03]
      realInvestmentsBalance,
    });

    const nextStart = format(
  addMonths(parseISO(computed.activePeriod.startDate), 1),
  'dd MMM', { locale: it }
);
    alert(`Ciclo chiuso. ✓ Nuovo ciclo aperto da ${nextStart}. Costi fissi generati automaticamente.`);
  };

  if (!computed.activePeriod) return <EmptyState onGoToAdmin={() => onNavigate?.('admin')} />;

  const checks = [
    { ok: Math.abs(discrepancy) < 10, label: 'Quadratura dei Conti', sub: `Scostamento: ${formatEuro(discrepancy)}` },
    { ok: pendingFixed.length === 0, label: 'Pesi Morti Liquidati', sub: pendingFixed.length > 0 ? `${pendingFixed.length} spese fisse non ancora confermate` : 'Tutti i costi fissi confermati' },
    { ok: true, label: 'Quota Investimenti', sub: 'Bonifici PAC eseguiti (Pay Yourself First)' },
  ];

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div>
        <h2>Chiusura Ciclo Fiscale</h2>
        <p className="kpi-sub">Quadratura dei conti e generazione automatica del ciclo successivo.</p>
      </div>

      <div className="grid-2col" style={{ alignItems: 'start' }}>

        {/* RICONCILIAZIONE */}
        <div className="card" style={{ borderLeft: `4px solid ${isDiscrepancyHigh ? 'var(--status-red)' : 'var(--status-green)'}` }}>
          <h3 className="flex items-center gap-2 mb-4">
            <ShieldAlert size={18} color={isDiscrepancyHigh ? 'var(--status-red)' : 'var(--status-green)'} />
            Riconciliazione Bancaria
          </h3>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between p-3 rounded" style={{ background: 'var(--bg-tertiary)' }}>
              <span className="text-sm text-muted">Saldo Teorico (App)</span>
              <span className="font-bold">{formatEuro(theoreticalBalance)}</span>
            </div>

            <div>
              <label className="kpi-label mb-1">Saldo Reale (Estratto Conto Oggi)</label>
              <input
                type="number"
                value={realBankBalance}
                onChange={e => setRealBankBalance(e.target.value)}
                style={{ fontSize: '1.25rem', fontWeight: 700, width: '100%', padding: '0.5rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded" style={{ background: discrepancy !== 0 ? 'var(--status-red-bg)' : 'var(--status-green-bg)' }}>
              <span className="text-sm">Scostamento</span>
              <span className="font-bold" style={{ color: discrepancy !== 0 ? 'var(--status-red)' : 'var(--status-green)' }}>
                {discrepancy > 0 ? '+' : ''}{formatEuro(discrepancy)}
              </span>
            </div>

            {Math.abs(discrepancy) > 10 && (
              <div className="flex flex-col gap-2 p-3 rounded" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
                <span className="text-xs font-bold text-muted uppercase tracking-wider">Azione Automatica alla Chiusura:</span>
                <div className="flex items-center justify-between text-sm">
                  <span>Rettifica Riconciliazione Bancaria</span>
                  <span className="font-bold" style={{ color: discrepancy > 0 ? 'var(--status-green)' : 'var(--text-primary)' }}>
                    {discrepancy > 0 ? '+' : '-'}{formatEuro(Math.abs(discrepancy))}
                  </span>
                </div>
                <span className="text-xs text-muted">Verrà registrata come transazione <em>Variabile</em> per far quadrare i conti.</span>
              </div>
            )}
          </div>
        </div>

        {/* CHECKLIST + CHIUSURA */}
        <div className="card">
          <h3 className="flex items-center gap-2 mb-4">
            <Lock size={18} />
            Chiusura Ciclo
          </h3>

          {/* FIX 1.1: input stipendio obbligatorio nel wizard di chiusura */}
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <Wallet size={14} color="var(--status-green)" />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                Stipendio Nuovo Ciclo (opzionale)
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              I costi fissi del ciclo successivo vengono generati automaticamente.
              Inserisci lo stipendio se già accreditato, oppure lascia a 0 e registralo dopo da Admin.
            </p>
            <input
              type="number"
              value={salaryAmount}
              onChange={e => setSalaryAmount(e.target.value)}
              placeholder="Importo stipendio (opzionale)"
              style={{ width: '100%', padding: '0.625rem 0.75rem', fontSize: '1rem', fontWeight: 700, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--status-green)', boxSizing: 'border-box' }}
            />
            
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="checkbox"
                id="extraordinary_close"
                checked={isExtraordinaryIncome}
                onChange={e => setIsExtraordinaryIncome(e.target.checked)}
                style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
              />
              <label htmlFor="extraordinary_close" style={{ fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>
                Tredicesima / Entrata Straordinaria
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-4 mb-6">
            {checks.map((c, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle size={18} color={c.ok ? 'var(--status-green)' : 'var(--status-yellow)'} style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.label}</div>
                  <div className="kpi-sub mt-1">{c.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* OPTIONAL: aggiorna saldi altri conti prima di confermare (GAP-S03) */}
          {data.accounts.filter(a => a.type !== 'operating_liquidity').length > 0 && (
            <div className="mb-4 p-3" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <h4 style={{ marginBottom: '0.5rem', fontWeight: 700 }}>Aggiorna Saldi Patrimonio (opzionale)</h4>
              <p className="kpi-sub" style={{ marginBottom: '0.75rem' }}>Inserisci eventuali aggiornamenti dei conti non-operativi (es. investimenti, immobili).</p>
              {data.accounts.filter(a => a.type !== 'operating_liquidity').map(acc => (
                <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontWeight: 600 }}>{acc.name}</label>
                  <input type="number" defaultValue={acc.currentBalance} onChange={e => setAccountUpdates(prev => ({ ...prev, [acc.id]: parseFloat(e.target.value) }))} style={{ width: 140, textAlign: 'right', padding: '0.35rem', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-4">
            <button
              onClick={handleClosePeriod}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.875rem', background: 'var(--text-primary)', color: 'var(--bg-secondary)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}
            >
              <Lock size={16} /> Chiudi Ciclo e Apri il Prossimo
              <ArrowRight size={16} />
            </button>
            <p className="text-center kpi-sub mt-2" style={{ fontSize: '0.72rem' }}>
              Sigilla le transazioni · Trasferisce {formatEuro(Number(realBankBalance))} al nuovo ciclo · <strong>Genera automaticamente i costi fissi</strong>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
