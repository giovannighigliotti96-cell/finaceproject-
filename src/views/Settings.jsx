import React, { useState, useRef } from 'react';
import { useFinanceData } from '../context/FinanceContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { exportStateAsJSON } from '../store/useFinanceStore';
import { useToast } from '../components/Toast';
import { Shield, PiggyBank, BarChart2, Download, Trash2, Save, Cloud, CloudUpload, CloudDownload, RefreshCw, Upload } from 'lucide-react';

export default function Settings() {
  const { data, computed } = useFinanceData();
  // AUDIT REAL CODE: Settings exposes expectedReturnRate; assumedInflationRate and reconciliationTolerance
  // were added to initial settings in the store for S02 and S05.
  const updateSettings  = useFinanceStore(state => state.updateSettings);
  const setData         = useFinanceStore(state => state.setData);
  const resetToDefaults = useFinanceStore(state => state.resetToDefaults);
  const syncToCloud     = useFinanceStore(state => state.syncToCloud);
  const restoreFromCloud= useFinanceStore(state => state.restoreFromCloud);
  const showToast = useToast();
  const fileInputRef = useRef(null);

  const s = data.settings;

  // Stato locale per editare senza commit immediato
  const [buffer, setBuffer]   = useState(s.safetyBuffer);
  const [savings, setSavings] = useState(s.targetSavingsAmount || 190);
  const [income, setIncome]   = useState(s.defaultIncome);
  const [returnRate, setReturnRate] = useState(s.expectedReturnRate ?? 3.5);

  // Authentication
  const [authEmail, setAuthEmail] = useState(s.authEmail || 'admin@finance.it');
  const [authPassword, setAuthPassword] = useState(s.authPassword || 'admin');

  // Cloud Sync
  const [githubToken, setGithubToken] = useState(s.githubToken || '');
  const [gistId, setGistId] = useState(s.gistId || '');
  const [isSyncing, setIsSyncing] = useState(false);

  // Budget per categoria
  const variableCategories = data.categories.filter(c => c.group === 'variable');
  const [budgets, setBudgets] = useState({ ...(s.categoryBudgets || {}) });

  const handleSave = () => {
    const safeBuffer  = parseFloat(buffer);
    const safeSavings = parseFloat(savings);
    const safeIncome  = parseFloat(income);

    if (isNaN(safeBuffer) || safeBuffer < 0)  { showToast('Buffer di sicurezza non valido', 'error'); return; }
    if (isNaN(safeSavings) || safeSavings < 0) { showToast('Obiettivo risparmio non valido', 'error');  return; }
    if (isNaN(safeIncome)  || safeIncome  <= 0){ showToast('Reddito di default non valido', 'error');   return; }

    const sanitizedBudgets = {};
    Object.entries(budgets).forEach(([k, v]) => {
      const parsed = parseFloat(v);
      sanitizedBudgets[k] = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    });

    updateSettings({
      safetyBuffer:         safeBuffer,
      targetSavingsAmount:  safeSavings,
      defaultIncome:        safeIncome,
      categoryBudgets:      sanitizedBudgets,
      budgetsLastUpdated:   new Date().toISOString(),
      expectedReturnRate:   parseFloat(returnRate),
      githubToken:          githubToken.trim(),
      gistId:               gistId.trim(),
      authEmail:            authEmail.trim(),
      authPassword:         authPassword,
    });
    showToast('Impostazioni salvate con successo', 'success');
  };

  const handleExport = () => {
    exportStateAsJSON(data);
    showToast('Backup JSON scaricato', 'success');
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      
      // Validazione base
      if (!imported.settings || !imported.periods || !imported.transactions) {
        showToast('File JSON non valido: struttura dati mancante', 'error');
        return;
      }

      if (!window.confirm('⚠️ Importare questi dati sovrascriverà tutti i dati attuali. Continuare?')) {
        return;
      }

      // Importa i dati
      setData(imported);
      showToast('Dati importati con successo!', 'success');
      
      // Reset input per permettere re-import dello stesso file
      e.target.value = '';
    } catch (err) {
      console.error('Import error:', err);
      showToast('Errore durante l\'importazione: ' + err.message, 'error');
    }
  };

  const handleReset = () => {
    if (!window.confirm('⚠️ Sei sicuro? Tutti i dati verranno cancellati. Un backup JSON verrà scaricato automaticamente prima del reset.')) return;
    const typed = window.prompt('Digita RESET per confermare la cancellazione totale:');
    if (typed !== 'RESET') { showToast('Reset annullato', 'warning'); return; }
    resetToDefaults(); // esporta automaticamente prima di resettare
    showToast('Database azzerato. Backup salvato automaticamente.', 'warning');
  };

  const handlePush = async () => {
    // Validazione token prima di tentare
    const token = githubToken.trim();
    if (!token) {
      showToast('Inserisci il GitHub Token prima di fare il backup', 'error');
      return;
    }
    
    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
      showToast('Il token GitHub deve iniziare con "ghp_" o "github_pat_"', 'error');
      return;
    }

    try {
      setIsSyncing(true);
      await syncToCloud();
      showToast('Sincronizzazione completata con successo', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePull = async () => {
    if (!window.confirm("Attenzione: sovrascriverà i dati locali. Procedere?")) return;
    try {
      setIsSyncing(true);
      await restoreFromCloud();
      showToast('Ripristino cloud completato', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.625rem 0.75rem',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    fontWeight: 600,
    boxSizing: 'border-box',
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div>
        <h2>Impostazioni</h2>
        <p className="kpi-sub">Configura i parametri chiave del tuo CFO Personale.</p>
      </div>

      {/* ── AUTENTICAZIONE ───────────────────────────────────────────── */}
      <div className="card">
        <h3 className="flex items-center gap-2 mb-5">
          <Shield size={16} /> Credenziali di Accesso
        </h3>
        <p className="kpi-sub mb-4">
          Modifica la mail e la password usate per accedere a questa dashboard.
        </p>
        <div className="grid-2col">
          <div>
            <label className="kpi-label mb-2">Email di Accesso</label>
            <input
              type="email"
              value={authEmail}
              onChange={e => setAuthEmail(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="kpi-label mb-2">Password di Accesso</label>
            <input
              type="text"
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* ── PARAMETRI FINANZIARI ───────────────────────────────────────────── */}
      <div className="card">
        <h3 className="flex items-center gap-2 mb-5">
          <Shield size={16} /> Parametri Finanziari
        </h3>
        <div className="grid-3col">
          <div>
            <label className="kpi-label mb-2">
              Buffer di Sicurezza (€)
            </label>
            <input
              type="number"
              value={buffer}
              onChange={e => setBuffer(e.target.value)}
              min={0}
              step={50}
              style={{ ...inputStyle, color: 'var(--status-yellow)', fontSize: '1.1rem' }}
            />
            <p className="kpi-sub mt-1">
              Importo minimo intoccabile sul conto. Viene sottratto da ogni KPI di disponibilità e usato come <strong>target di chiusura ciclo</strong> nel Forecast e nel Monitor Risparmio.
            </p>
            {computed.safetyBufferAdeguato ? (
              <p style={{ color: 'var(--status-green)', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 600 }}>
                ✓ Buffer adeguato rispetto alle tue uscite fisse
              </p>
            ) : (
              <p style={{ color: 'var(--status-red)', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 600 }}>
                ⚠ Buffer consigliato: €{computed.safetyBufferConsigliato?.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (3x fissi mensili o 20% reddito annuo)
              </p>
            )}
          </div>

          <div>
            <label className="kpi-label mb-2">
              Obiettivo Risparmio Mensile — Goals (€)
            </label>
            <input
              type="number"
              value={savings}
              onChange={e => setSavings(e.target.value)}
              min={0}
              step={50}
              style={{ ...inputStyle, color: 'var(--status-green)', fontSize: '1.1rem' }}
            />
            <p className="kpi-sub mt-1">
              Quanto vuoi accantonare ogni mese verso i tuoi <strong>obiettivi finanziari</strong> (Goals). Non influisce su spendibile o forecast: è solo un riferimento per la sezione Goals.
            </p>
          </div>

          <div>
            <label className="kpi-label mb-2">
              Reddito Default (€)
            </label>
            <input
              type="number"
              value={income}
              onChange={e => setIncome(e.target.value)}
              min={1}
              step={50}
              style={{ ...inputStyle, fontSize: '1.1rem' }}
            />
            <p className="kpi-sub mt-1">
              Pre-compila il form di registrazione stipendio.
            </p>
          </div>

          <div>
            <label className="kpi-label mb-2">
              Rendimento atteso investimenti (%)
            </label>
            <input
              type="number"
              value={returnRate}
              onChange={e => setReturnRate(e.target.value)}
              min={0}
              max={20}
              step={0.1}
              style={{ ...inputStyle, fontSize: '1.0rem' }}
            />
            <p className="kpi-sub mt-1">
              Usato per il calcolo del Cash Drag. Default prudenziale: 3.5%.
            </p>
          </div>
        </div>
      </div>

      {/* ── BUDGET PER CATEGORIA ──────────────────────────────────────────── */}
      <div className="card">
        <h3 className="mb-4">Budget Mensile per Categoria Variabile</h3>
        
        {computed.budgetStale && (
          <div style={{ background: 'var(--status-yellow-bg)', color: 'var(--status-yellow)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1.5rem' }}>
            ⚠ Budget non aggiornati da più di 6 mesi. Rivaluta le soglie per alimentari e utenze.
          </div>
        )}
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {variableCategories.map(cat => (
            <div key={cat.id}>
              <label className="kpi-label mb-1">{cat.name}</label>
              <input
                type="number"
                value={budgets[cat.id] ?? 0}
                onChange={e => setBudgets(prev => ({ ...prev, [cat.id]: e.target.value }))}
                min={0}
                step={10}
                style={inputStyle}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── CLOUD SYNC ───────────────────────────────────────────────────────── */}
      <div className="card">
        <h3 className="flex items-center gap-2 mb-3">
          <Cloud size={16} /> Cloud Sync (GitHub Gists) - Backup Automatico
        </h3>
        <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem' }}>
          <strong>✨ Backup Automatico Attivo</strong>
          <p style={{ marginTop: '0.25rem', color: 'var(--text-muted)' }}>
            I tuoi dati vengono salvati automaticamente su GitHub ogni 24 ore quando apri l'app. 
            <strong> Serve solo il Token</strong> - il Gist viene creato automaticamente al primo backup!
          </p>
        </div>
        
        {/* Istruzioni dettagliate */}
        <div style={{ background: 'var(--status-yellow-bg)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem', border: '1px solid var(--status-yellow)' }}>
          <strong style={{ color: 'var(--status-yellow)' }}>📝 Come creare il token (2 minuti):</strong>
          <ol style={{ marginTop: '0.5rem', marginLeft: '1.25rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            <li>Vai su <a href="https://github.com/settings/tokens/new?scopes=gist&description=CFO%20Backup" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--chart-primary)', textDecoration: 'underline' }}>questa pagina</a></li>
            <li>Seleziona <strong>solo</strong> il permesso "gist" ✅</li>
            <li>Clicca "Generate token" in fondo</li>
            <li>Copia il token (inizia con <code>ghp_</code>)</li>
            <li>Incollalo qui sotto e clicca "Salva Impostazioni"</li>
          </ol>
        </div>
        
        <div className="grid-2col mb-4">
          <div>
            <label className="kpi-label mb-2">GitHub Token (obbligatorio)</label>
            <input 
              type="password" 
              value={githubToken} 
              onChange={e => setGithubToken(e.target.value.trim())} 
              style={inputStyle} 
              placeholder="ghp_..." 
            />
            <p className="kpi-sub mt-1">
              Il token deve iniziare con <code>ghp_</code> o <code>github_pat_</code>
            </p>
          </div>
          <div>
            <label className="kpi-label mb-2">Gist ID (opzionale - auto-generato)</label>
            <input 
              type="text" 
              value={gistId} 
              onChange={e => setGistId(e.target.value.trim())} 
              style={inputStyle} 
              placeholder="Lascia vuoto per crearlo automaticamente" 
              disabled
            />
            <p className="kpi-sub mt-1">
              Viene creato automaticamente al primo backup. Non modificare.
            </p>
          </div>
        </div>
        {s.lastSync && (
          <div className="kpi-sub mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--status-green)', fontSize: '1.2rem' }}>✓</span>
            <span>
              Ultimo backup: <strong>{new Date(s.lastSync).toLocaleString('it-IT')}</strong>
              {(() => {
                const hoursSince = (Date.now() - new Date(s.lastSync).getTime()) / (1000 * 60 * 60);
                if (hoursSince < 24) {
                  return <span style={{ color: 'var(--status-green)', marginLeft: '0.5rem' }}>({Math.floor(hoursSince)}h fa)</span>;
                } else {
                  return <span style={{ color: 'var(--status-yellow)', marginLeft: '0.5rem' }}>({Math.floor(hoursSince / 24)}gg fa)</span>;
                }
              })()}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={handlePull} disabled={isSyncing} className="btn btn-ghost flex items-center gap-2">
            {isSyncing ? <RefreshCw size={15} className="animate-spin" /> : <CloudDownload size={15} />}
            Ripristina da Cloud
          </button>
          <button onClick={handlePush} disabled={isSyncing} className="btn btn-ghost flex items-center gap-2">
            {isSyncing ? <RefreshCw size={15} className="animate-spin" /> : <CloudUpload size={15} />}
            Backup Manuale Ora
          </button>
        </div>
      </div>

      {/* ── AZIONI ───────────────────────────────────────────────────────── */}
      <div className="grid-2col">
        <div className="card">
          <h3 className="flex items-center gap-2 mb-3">
            <Download size={16} /> Backup & Ripristino
          </h3>
          <p className="kpi-sub mb-4">
            Esporta l'intero database come JSON o importa un backup precedente. Utile per sincronizzare tra browser diversi o fare backup manuali.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
            <button
              onClick={handleExport}
              className="btn btn-ghost flex items-center gap-2"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Download size={15} /> Scarica Backup JSON
            </button>
            <button
              onClick={handleImport}
              className="btn btn-ghost flex items-center gap-2"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Upload size={15} /> Carica Backup JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <div className="card" style={{ borderTop: '3px solid var(--status-yellow)' }}>
          <h3 className="flex items-center gap-2 mb-3" style={{ color: 'var(--status-yellow)' }}>
            <RefreshCw size={16} /> Riconciliazione Saldi
          </h3>
          <p className="kpi-sub mb-4">
            Ricalcola il saldo del conto corrente partendo dall'apertura del ciclo e applicando tutte le transazioni pagate. Usa questo se noti discrepanze tra liquidità e patrimonio netto.
          </p>
          <button
            onClick={() => {
              if (window.confirm('Ricalcolare il saldo del conto corrente dalle transazioni?\n\nQuesta operazione è sicura e non cancella dati.')) {
                const reconcile = useFinanceStore.getState().reconcileOperatingAccount;
                reconcile();
                showToast('✅ Saldo riconciliato con successo!', 'success');
                setTimeout(() => window.location.reload(), 500);
              }
            }}
            className="btn btn-ghost flex items-center gap-2"
            style={{ width: '100%', justifyContent: 'center', color: 'var(--status-yellow)', borderColor: 'var(--status-yellow)' }}
          >
            <RefreshCw size={15} /> Riconcilia Saldi Ora
          </button>
        </div>
      </div>

      <div className="grid-2col">
        <div className="card" style={{ borderTop: '3px solid var(--status-red)' }}>
          <h3 className="flex items-center gap-2 mb-3" style={{ color: 'var(--status-red)' }}>
            <Trash2 size={16} /> Reset Totale
          </h3>
          <p className="kpi-sub mb-4">
            Cancella tutti i dati. Un backup JSON viene scaricato automaticamente prima del reset. Questa operazione è irreversibile.
          </p>
          <button
            onClick={handleReset}
            className="btn btn-danger flex items-center gap-2"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Trash2 size={15} /> Cancella Tutti i Dati
          </button>
        </div>
      </div>

      {/* ── SALVA ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSave}
          className="btn btn-primary flex items-center gap-2"
          style={{ padding: '0.75rem 2rem', fontSize: '0.95rem' }}
        >
          <Save size={16} /> Salva Impostazioni
        </button>
      </div>
    </div>
  );
}
