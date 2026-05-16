import React, { useState } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { validateTransactionSemantic } from '../utils/transactionValidator';

export default function TransactionFormModal({ isOpen, onClose }) {
  const addTransaction = useFinanceStore(state => state.addTransaction);
  const data = useFinanceStore(state => state.data);

  const [formData, setFormData] = useState({
  date: format(new Date(), 'yyyy-MM-dd'),
  description: '',
  categoryId: data.categories.find(c => c.group === 'variable')?.id || '',
  accountId: data.accounts.find(a => a.type === 'operating_liquidity')?.id || '',
  amount: '',
  type: 'expense',
  nature: 'variable',
  status: 'paid',
  source: '',
});

const [formError, setFormError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
  e.preventDefault();
  setFormError(null);

  if (!formData.description || !formData.amount || !formData.accountId) {
    setFormError('Compila tutti i campi obbligatori: descrizione, importo e conto.');
    return;
  }

  const parsed = parseFloat(formData.amount);
  if (isNaN(parsed) || parsed <= 0) {
    setFormError('Importo non valido. Inserisci un numero maggiore di 0.');
    return;
  }

  const validation = validateTransactionSemantic({ ...formData, amount: parsed }, data);
  if (!validation.valid) {
    setFormError(validation.errors[0]);
    return;
  }

  try {
    addTransaction({
      ...formData,
      amount: parsed,
      periodId: data.settings.activePeriodId,
      notes: ''
    });
  } catch (err) {
    console.error(err);
    setFormError('Errore durante la registrazione della transazione. Controlla i dati e riprova.');
    return;
  }

  setFormData({
    ...formData,
    description: '',
    amount: ''
  });
  onClose();
};

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '550px', margin: '20px', padding: '2rem' }}>
        <div className="flex justify-between items-center mb-6">
          <h2 style={{ margin: 0 }}>Nuova Transazione</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          <div className="grid-2col" style={{ marginBottom: 0, gap: '1rem' }}>
            <div>
              <label className="kpi-label">Tipo Operazione</label>
              <select
                value={formData.type}
                onChange={e => {
  const newType = e.target.value;
  setFormData({
    ...formData,
    type: newType,
    nature: newType === 'income' ? 'fixed' : formData.nature,
  });
}}
                className="w-full p-2 rounded-md"
                style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              >
                <option value="expense">Spesa (Uscita)</option>
                <option value="income">Entrata (Stipendio/Bonus)</option>
                <option value="investment">Investimento (Bonifico Broker)</option>
              </select>
            </div>

            <div>
              <label className="kpi-label">Stato Contabile</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full p-2 rounded-md"
                style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              >
                <option value="paid">Già Pagato (Movimenta Saldo)</option>
                <option value="planned">Pianificato (Impegno Cassa)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="kpi-label">Conto Origine/Destinazione</label>
            <select
              value={formData.accountId}
              onChange={e => setFormData({ ...formData, accountId: e.target.value })}
              className="w-full p-2 rounded-md"
              style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
            >
              {data.accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name} ({acc.type.replace('_', ' ')})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="kpi-label">Natura della Spesa</label>
            <div className="flex gap-2 mt-1">
              {['variable', 'fixed', 'extraordinary'].map(nat => (
                <button
                  key={nat}
                  type="button"
                  onClick={() => setFormData({ ...formData, nature: nat })}
                  style={{
                    flex: 1, padding: '0.5rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    backgroundColor: formData.nature === nat ? 'var(--chart-primary)' : 'var(--bg-tertiary)',
                    color: formData.nature === nat ? 'white' : 'var(--text-secondary)',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  {nat === 'variable' ? 'Variabile (Budget)' : nat === 'fixed' ? 'Fissa (Ricorrente)' : 'Straordinaria'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid-2col" style={{ marginBottom: 0, gap: '1rem' }}>
            <div>
              <label className="kpi-label">Data Contabile</label>
              <input type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full p-2 rounded-md"
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label className="kpi-label">Importo (€)</label>
              <input type="number" step="0.01" min="0" required
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className="w-full p-2 rounded-md font-bold"
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--status-red)' }}
              />
            </div>
          </div>

          <div className="grid-2col" style={{ marginBottom: 0, gap: '1rem' }}>
            <div>
              <label className="kpi-label">Descrizione / Beneficiario</label>
              <input type="text" placeholder="es. Spesa Esselunga" required
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-2 rounded-md"
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label className="kpi-label">Categoria Analitica</label>
              <select
                value={formData.categoryId}
                onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full p-2 rounded-md"
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              >
                {data.categories
  .filter(c => {
    // Le entrate possono usare categorie di qualsiasi natura
    if (formData.type === 'income') return c.group === formData.nature;
    return c.group === formData.nature;
  })
  .map(c => (
    <option key={c.id} value={c.id}>
      {c.name}
    </option>
  ))}
              </select>
            </div>
          </div>
         {formData.type === 'income' && (
  <div>
    <label className="kpi-label">Fonte Reddito</label>
    <select
      value={formData.source}
      onChange={e => setFormData({ ...formData, source: e.target.value })}
      className="w-full p-2 rounded-md"
      style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
    >
      <option value="">— Seleziona fonte —</option>
      <option value="stipendio">Stipendio</option>
      <option value="freelance">Freelance / Consulenza</option>
      <option value="bonus">Bonus / Premio</option>
      <option value="rendita">Rendita / Investimenti</option>
      <option value="altro">Altro</option>
    </select>
  </div>
)}
{formError && (
  <div style={{ color: 'var(--status-red)', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
    ⚠️ {formError}
  </div>
)}

            <button type="submit" style={{
          
            marginTop: '1rem', padding: '1rem',
            backgroundColor: 'var(--text-primary)', color: 'var(--bg-secondary)',
            border: 'none', borderRadius: 'var(--radius-md)',
            fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem'
          }}>
            {formData.status === 'planned' ? 'Pianifica Impegno' : 'Registra Transazione Reale'}
          </button>
        </form>
      </div>
    </div>
  );
}
