import React, { useState } from 'react';
import { useFinanceData } from '../context/FinanceContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { useToast } from '../components/Toast';
import { Target, Plus, Trash2, Edit3, Check, X } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import KpiInfo from '../components/KpiInfo';
import { differenceInDays, addMonths, format } from 'date-fns';
import { it } from 'date-fns/locale';

export default function Goals({ onNavigate }) {
  const { data, computed } = useFinanceData();
  // AUDIT REAL CODE: Goals view reads `computed.goalFundingRate` (if present) and uses store.goals.
  // UI earmarking not added here yet; store provides assignGoalToAccount/unassignGoalFromAccount.
  const addGoal = useFinanceStore(state => state.addGoal);
  const updateGoal = useFinanceStore(state => state.updateGoal);
  const deleteGoal = useFinanceStore(state => state.deleteGoal);
  const assignGoalToAccount = useFinanceStore(state => state.assignGoalToAccount);
  const unassignGoalFromAccount = useFinanceStore(state => state.unassignGoalFromAccount);
  const showToast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', targetAmount: '', currentAmount: '', deadline: '' });

  // FIX 3.11: Goals non usa più EmptyState — mostra sempre anche senza ciclo attivo
  // (i goals sono indipendenti dal ciclo corrente)

  const formatEuro = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);

  const resetForm = () => {
    setForm({ name: '', targetAmount: '', currentAmount: '', deadline: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = () => {
    const target = parseFloat(form.targetAmount);
    const current = parseFloat(form.currentAmount || 0);

    if (!form.name.trim()) { showToast('Inserisci un nome per l\'obiettivo', 'error'); return; }
    if (isNaN(target) || target <= 0) { showToast('Importo target non valido', 'error'); return; }
    if (isNaN(current) || current < 0) { showToast('Importo attuale non valido', 'error'); return; }

    if (editingId) {
      updateGoal(editingId, { name: form.name, targetAmount: target, currentAmount: current, deadline: form.deadline });
      showToast('Obiettivo aggiornato', 'success');
    } else {
      addGoal({ name: form.name, targetAmount: target, currentAmount: current, deadline: form.deadline });
      showToast('Obiettivo aggiunto', 'success');
    }
    resetForm();
  };

  const handleEdit = (goal) => {
    setForm({ name: goal.name, targetAmount: goal.targetAmount, currentAmount: goal.currentAmount, deadline: goal.deadline || '' });
    setEditingId(goal.id);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (!window.confirm('Eliminare questo obiettivo?')) return;
    deleteGoal(id);
    showToast('Obiettivo eliminato', 'warning');
  };

  const goals = data.goals || [];
  const accounts = data.accounts || [];
  // G-13: se il goal ha earmarkedAccountId, mostra il saldo reale del conto come currentAmount
const goalsWithLiveBalance = goals.map(goal => {
  if (!goal.earmarkedAccountId) return goal;
  const linked = accounts.find(a => a.id === goal.earmarkedAccountId);
  if (!linked) return goal;
  const liveBalance = linked.currentBalance ?? linked.balance ?? 0;
  return { ...goal, currentAmount: liveBalance };
});

  const calculateRequiredMonthly = (allGoals) => {
    let totalMonthly = 0;
    allGoals.forEach(g => {
      const remaining = g.targetAmount - g.currentAmount;
      if (remaining <= 0 || !g.deadline) return;
      const deadlineDate = new Date(g.deadline + '-01');
      const today = new Date();
      let months = (deadlineDate.getFullYear() - today.getFullYear()) * 12 + (deadlineDate.getMonth() - today.getMonth());
      if (months < 1) months = 1;
      totalMonthly += remaining / months;
    });
    return totalMonthly;
  };

  const targetMensileNecessario = calculateRequiredMonthly(goalsWithLiveBalance);
  const targetPianificato = data.settings?.targetSavingsAmount || 0;
  const isTargetSafe = targetPianificato >= targetMensileNecessario;

  // G4: helper per calcolare velocity per singolo goal
  const today = new Date();
  const getGoalVelocity = (goal) => {
    if (!goal.deadline) return null;
    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
    if (remaining <= 0) return { ratio: Infinity, requiredRate: 0, currentRate: 0, eta: null };

    const deadlineDate = new Date(goal.deadline + '-01');
    const monthsLeft = Math.max(1, differenceInDays(deadlineDate, today) / 30);
    const requiredRate = remaining / monthsLeft;

    // currentRate: usa risparmioNettoMensile diviso per numero goals attivi con deadline
    const activeGoalsWithDeadline = goalsWithLiveBalance.filter(g => g.deadline && (g.targetAmount - g.currentAmount) > 0).length || 1;
    const currentRate = Math.max(0, (computed.risparmioNettoMensile ?? 0) / activeGoalsWithDeadline);

    const ratio = requiredRate > 0 ? currentRate / requiredRate : (currentRate > 0 ? Infinity : 0);

    // ETA dinamico: quando raggiungiamo il goal al ritmo attuale
    let eta = null;
    if (currentRate > 0 && remaining > 0) {
      const monthsNeeded = remaining / currentRate;
      eta = addMonths(today, Math.ceil(monthsNeeded));
    }

    return { ratio, requiredRate, currentRate, eta };
  };

  const inputStyle = {
    width: '100%', padding: '0.625rem 0.75rem',
    background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    fontSize: '0.95rem', boxSizing: 'border-box',
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2>Obiettivi Finanziari</h2>
          <p className="kpi-sub">Traccia i tuoi traguardi patrimoniali nel lungo periodo.</p>
        </div>
        <button
          className="btn btn-primary flex items-center gap-2"
          onClick={() => { resetForm(); setShowForm(true); }}
        >
          <Plus size={16} /> Nuovo Obiettivo
        </button>
      </div>

      <div className="grid-2col">
        <div className="card" style={{ borderTop: `3px solid ${isTargetSafe ? 'var(--status-green)' : 'var(--status-red)'}` }}>
          <div className="kpi-label" style={{ display: 'flex', alignItems: 'center' }}>Obiettivo Mensile Aggregato <KpiInfo text="Quanto devi risparmiare ogni mese per raggiungere TUTTI i tuoi obiettivi entro le rispettive scadenze. Se è superiore al tuo risparmio pianificato, sei in ritardo." position="below" /></div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: isTargetSafe ? 'var(--status-green)' : 'var(--status-red)' }}>
              {formatEuro(targetMensileNecessario)} / mese
            </span>
            {!isTargetSafe && targetMensileNecessario > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--status-red)' }}>Dovresti risparmiare di più!</span>}
          </div>
        </div>
        <div className="card" style={{ borderTop: '3px solid var(--text-primary)' }}>
          <div className="kpi-label" style={{ display: 'flex', alignItems: 'center' }}>Risparmio Pianificato (Settings) <KpiInfo text="L'obiettivo di risparmio mensile che hai impostato nelle Impostazioni. È il tuo 'budget risparmio' per ciclo." position="below" /></div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              {formatEuro(targetPianificato)} / ciclo
            </span>
          </div>
        </div>
      </div>
      
      <div className="card" style={{ padding: '1rem', borderTop: `3px solid ${computed.goalFundingRate == null ? 'var(--border-color)' : computed.goalFundingRate >= 100 ? 'var(--status-green)' : 'var(--status-yellow)'}` }}>
  <div className="flex flex-col gap-2">
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>Ritmo risparmio attuale copre <KpiInfo text="Percentuale del target mensile goal coperta dal tuo risparmio netto attuale. Sotto il 100% significa che al ritmo attuale non raggiungerai gli obiettivi in tempo." position="below" /></span>
    {computed.goalFundingRate == null ? (
      <strong style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>— % del target mensile goal</strong>
    ) : (
      <>
        <strong style={{ fontSize: '1.2rem' }}>{computed.goalFundingRate.toFixed(0)}% del target mensile goal</strong>
        {computed.goalFundingRate < 100 && (
          <p className="kpi-sub" style={{ color: 'var(--status-red)' }}>
            ⚠️ Ritmo insufficiente: mancano {((computed.goalsMonthlyTarget ?? 0) - (computed.risparmioNettoMensile ?? 0)).toFixed(0)}€/mese
          </p>
        )}
      </>
    )}
  </div>
</div>

      {/* FORM ADD/EDIT */}
      {showForm && (
        <div className="card" style={{ borderTop: '3px solid var(--chart-primary)' }}>
          <h3 className="mb-4">{editingId ? 'Modifica Obiettivo' : 'Nuovo Obiettivo'}</h3>
          <div className="grid-3col mb-4">
            <div>
              <label className="kpi-label mb-1">Nome Obiettivo</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="es. Fondo Emergenza, Vacanza..."
                style={inputStyle}
              />
            </div>
            <div>
              <label className="kpi-label mb-1">Target (€)</label>
              <input
                type="number"
                value={form.targetAmount}
                onChange={e => setForm(p => ({ ...p, targetAmount: e.target.value }))}
                min={1}
                style={{ ...inputStyle, color: 'var(--status-green)', fontWeight: 700 }}
              />
            </div>
            <div>
              <label className="kpi-label mb-1">Già Accantonato (€)</label>
              <input
                type="number"
                value={form.currentAmount}
                onChange={e => setForm(p => ({ ...p, currentAmount: e.target.value }))}
                min={0}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="kpi-label mb-1">Entro il (Mese/Anno - Opzionale)</label>
              <input
                type="month"
                value={form.deadline || ''}
                onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost flex items-center gap-2" onClick={resetForm}>
              <X size={15} /> Annulla
            </button>
            <button className="btn btn-primary flex items-center gap-2" onClick={handleSave}>
              <Check size={15} /> {editingId ? 'Aggiorna' : 'Aggiungi'}
            </button>
          </div>
        </div>
      )}

      {/* GOALS GRID */}
      {goals.length === 0 && !showForm && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ width: 56, height: 56, background: 'var(--bg-tertiary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <Target size={24} color="var(--text-muted)" />
          </div>
          <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>Nessun obiettivo</h3>
          <p className="kpi-sub">Premi "Nuovo Obiettivo" per iniziare a tracciare i tuoi traguardi finanziari.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
        {goalsWithLiveBalance.map(goal => {
          const pct = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
          const rawPct = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
          const color = rawPct >= 100 ? 'var(--status-green)' : rawPct > 60 ? 'var(--chart-primary)' : 'var(--status-yellow)';
          const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

          return (
            <div key={goal.id} className="card" style={{ position: 'relative' }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>{goal.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {remaining > 0 ? `Mancano ${formatEuro(remaining)}` : '🎉 Obiettivo raggiunto!'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleEdit(goal)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(goal.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-red)', padding: '0.25rem' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color }}>{formatEuro(goal.currentAmount)}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color }}>{Math.round(rawPct)}%</span>
              </div>
              <div className="progress-container" style={{ height: 8 }}>
                <div className="progress-bar" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
              <div className="flex justify-between text-xs text-muted mt-2">
                <span>Attuale: {formatEuro(goal.currentAmount)}</span>
                <span>Target: {formatEuro(goal.targetAmount)} {goal.deadline && `(entro ${goal.deadline})`}</span>
              </div>
              {/* G4: Goal Velocity */}
              {(() => {
                const v = getGoalVelocity(goal);
                if (!v) return null;
                const isComplete = goal.currentAmount >= goal.targetAmount;
                if (isComplete) return (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--status-green)', fontWeight: 700 }}>
                    🎉 Obiettivo raggiunto!
                  </div>
                );
                const ratioColor = v.ratio >= 1.1 ? 'var(--status-green)' : v.ratio >= 0.8 ? 'var(--status-yellow)' : 'var(--status-red)';
                const ratioLabel = v.ratio === Infinity ? '∞' : v.ratio.toFixed(2);
                return (
                  <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Velocity (attuale/richiesta)</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: ratioColor }}>
                        {ratioLabel}x
                        {v.ratio < 0.8 && ' ⚠'}
                        {v.ratio >= 1.1 && ' ✓'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <span>Serve: {formatEuro(v.requiredRate)}/mese</span>
                      <span>Stima: {formatEuro(v.currentRate)}/mese</span>
                    </div>
                    {v.eta && (
                      <div style={{ fontSize: '0.72rem', color: ratioColor, fontWeight: 700 }}>
                        📅 ETA stimata: {format(v.eta, 'MMMM yyyy', { locale: it })}
                      </div>
                    )}
                  </div>
                );
              })()}
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Earmark su conto</label>
                <select
                  value={goal.earmarkedAccountId || ''}
                  onChange={e => {
                    const accId = e.target.value || null;
                    if (!accId) {
                      unassignGoalFromAccount(goal.id);
                      showToast('Earmark rimosso', 'success');
                      return;
                    }
                    assignGoalToAccount(goal.id, accId);
                    showToast('Earmark aggiornato', 'success');
                  }}
                  style={{ padding: '0.4rem', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="">— Nessun conto —</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                  ))}
                </select>
                {goal.earmarkedAccountId && (
                  <button onClick={() => { unassignGoalFromAccount(goal.id); showToast('Earmark rimosso', 'success'); }} className="btn btn-ghost" style={{ marginLeft: 'auto' }}>
                    Rimuovi
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
