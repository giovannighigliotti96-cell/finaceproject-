import React, { useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useFinanceStore } from '../store/useFinanceStore';
import * as XLSX from 'xlsx';
import { UploadCloud, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { format, parse } from 'date-fns';

export default function ImportBanca({ onNavigate }) {
  const data = useFinanceStore(useShallow(state => state.data || {}));
  const importTransactions = useFinanceStore(state => state.importTransactions);
  const learnCategorizationRule = useFinanceStore(state => state.learnCategorizationRule);

  const [inbox, setInbox] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [importedSuccess, setImportedSuccess] = useState(false);

  const accountId = data.accounts?.[0]?.id || ''; // default to first account

  const excelDateToJSDate = (serial) => {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
  };

  const classifyTransaction = (description) => {
    const rules = data.categorizationRules || [];
    for (let rule of rules) {
      try {
        // Sanitizza il pattern: rimuovi sintassi Python (?i)
        let cleanPattern = String(rule.pattern).replace(/^\(\?i\)/, '');
        cleanPattern = cleanPattern.replace(/^\((.+)\)$/, '$1');
        
        if (cleanPattern && new RegExp(cleanPattern, 'i').test(description)) {
          return rule.categoryId;
        }
      } catch (err) {
        // Se il pattern è ancora invalido, skippa
        console.warn(`Pattern invalido: "${rule.pattern}"`, err.message);
        continue;
      }
    }
    return '';
  };

  const processExcel = (file) => {
    setIsProcessing(true);
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const dataBuffer = new Uint8Array(e.target.result);
        const workbook = XLSX.read(dataBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to 2D array
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Intesa Sanpaolo typically has the header row at index 16. Let's find it dynamically:
        let headerRowIndex = rawData.findIndex(row => row[0] === 'Data' && row[1] === 'Operazione');
        if (headerRowIndex === -1) {
          throw new Error('Formato Intesa Sanpaolo non riconosciuto: intestazioni colonna mancanti.');
        }

        const txRows = rawData.slice(headerRowIndex + 1).filter(r => r.length > 0 && r[0]);

        const parsedTx = txRows.map((row, idx) => {
          let dateStr = '';
          if (typeof row[0] === 'number') {
            dateStr = format(excelDateToJSDate(row[0]), 'yyyy-MM-dd');
          } else {
            // fallback for DD/MM/YYYY text
            try {
              dateStr = format(parse(row[0], 'dd/MM/yyyy', new Date()), 'yyyy-MM-dd');
            } catch {
              dateStr = new Date().toISOString().split('T')[0];
            }
          }

          const operazione = row[1] || '';
          const dettagli = row[2] || '';
          const fullDescription = `${operazione} ${dettagli}`.trim();
          
          let amount = parseFloat(row[7]);
          if (isNaN(amount)) amount = 0;

          const type = amount < 0 ? 'expense' : 'income';
          const absAmount = Math.abs(amount);

          return {
            _index: idx,
            date: dateStr,
            description: fullDescription,
            amount: absAmount,
            type: type,
            nature: type === 'expense' ? 'variable' : 'fixed', // default
            status: 'paid',
            categoryId: type === 'expense' ? classifyTransaction(fullDescription) : '',
            accountId: accountId,
            periodId: data.settings.activePeriodId,
          };
        });

        setInbox(parsedTx);
        setIsProcessing(false);
      } catch (err) {
        console.error(err);
        setErrorMsg(err.message || 'Errore durante la lettura del file Excel.');
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Errore di lettura file dal filesystem.');
      setIsProcessing(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processExcel(file);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleCategoryChange = (index, newCategoryId) => {
    const updated = [...inbox];
    updated[index].categoryId = newCategoryId;
    setInbox(updated);
  };

  const handleNatureChange = (index, newNature) => {
    const updated = [...inbox];
    updated[index].nature = newNature;
    setInbox(updated);
  };

  const handleImport = () => {
    if (!data.settings.activePeriodId) {
      alert('❌ Nessun periodo attivo! Vai su Admin → Registra Stipendio per crearne uno. Le transazioni verranno salvate ma non appariranno senza un periodo.');
      return;
    }

    const invalid = inbox.filter(t => t.type === 'expense' && !t.categoryId);
    if (invalid.length > 0) {
      alert(`Hai ${invalid.length} uscite non categorizzate. Assegna una categoria a tutte prima di importare.`);
      return;
    }

    // Teach the engine the new rules for manually assigned categories
    inbox.forEach(tx => {
      if (tx.type === 'expense' && tx.categoryId) {
        // Find if it was auto-classified. If not, we learn it.
        const autoCat = classifyTransaction(tx.description);
        if (autoCat !== tx.categoryId) {
          // Extract a sensible keyword (e.g. first 2 words)
          const words = tx.description.split(' ').filter(w => w.length > 3);
          const keyword = words.slice(0, 2).join(' ').replace(/[^\w\s]/g, '');
          if (keyword) {
            learnCategorizationRule(keyword, tx.categoryId);
          }
        }
      }
    });

    const cleanTx = inbox.map(t => {
      const { _index, ...rest } = t;
      return rest;
    });

    console.log('[ImportBanca] Transazioni da importare:', cleanTx);
    console.log('[ImportBanca] Periodo attivo:', data.settings.activePeriodId);
    console.log('[ImportBanca] Variabili:', cleanTx.filter(t => t.nature === 'variable').length);
    console.log('[ImportBanca] Fisse:', cleanTx.filter(t => t.nature === 'fixed').length);

    importTransactions(cleanTx);
    setInbox([]);
    setImportedSuccess(true);
    setTimeout(() => setImportedSuccess(false), 3000);
  };

  const variableCategories = data.categories.filter(c => c.group === 'variable');
  const fixedCategories = data.categories.filter(c => c.group === 'fixed');

  return (
    <div className="animate-fade-in flex flex-col gap-6" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="flex items-center justify-between">
        <div>
          <h2>Importa Banca (Intesa Sanpaolo)</h2>
          <p className="kpi-sub">Carica il file Excel per auto-categorizzare i movimenti</p>
        </div>
      </div>

      {importedSuccess && (
        <div className="p-4 bg-green rounded flex items-center gap-2 mb-4" style={{ color: 'var(--status-green)' }}>
          <CheckCircle size={20} />
          <span className="font-bold">Importazione completata con successo!</span> Le transazioni sono state aggiunte e deduplicate.
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red rounded flex items-center gap-2 mb-4" style={{ color: 'var(--status-red)' }}>
          <AlertCircle size={20} />
          <span className="font-bold">{errorMsg}</span>
        </div>
      )}

      {inbox.length === 0 && !importedSuccess ? (
        <div 
          className="card text-center" 
          style={{ 
            padding: '4rem 2rem', 
            border: isDragging ? '2px dashed var(--chart-primary)' : '2px dashed var(--border-color)',
            backgroundColor: isDragging ? 'var(--bg-tertiary)' : 'transparent',
            transition: 'all 0.2s ease',
            cursor: 'pointer'
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => document.getElementById('fileUpload').click()}
        >
          <input 
            type="file" 
            id="fileUpload" 
            className="hidden" 
            style={{ display: 'none' }}
            accept=".xlsx, .xls, .csv" 
            onChange={(e) => {
              if (e.target.files[0]) processExcel(e.target.files[0]);
            }}
          />
          <FileSpreadsheet size={48} className="mx-auto mb-4 text-muted" />
          <h3 className="mb-2">Trascina qui il file .xlsx di Intesa Sanpaolo</h3>
          <p className="text-sm text-secondary">Oppure clicca per selezionare dal tuo computer.</p>
          <div className="mt-6 text-xs text-muted">I dati non lasciano mai il tuo dispositivo. Parsing 100% in locale.</div>
        </div>
      ) : null}

      {inbox.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="p-4 border-b flex justify-between items-center" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            <div>
              <h3>Inbox Movimenti ({inbox.length})</h3>
              <p className="text-xs text-secondary mt-1">Controlla e assegna le categorie mancanti. Il sistema imparerà dalle tue scelte.</p>
            </div>
            <button className="btn btn-primary" onClick={handleImport}>
              <UploadCloud size={16} /> Conferma e Importa
            </button>
          </div>
          
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrizione Originale</th>
                  <th>Tipo</th>
                  <th style={{ textAlign: 'right' }}>Importo</th>
                  <th>Categoria</th>
                  <th>Natura</th>
                </tr>
              </thead>
              <tbody>
                {inbox.map((tx, idx) => {
                  const isIncome = tx.type === 'income';
                  const isAutoCat = tx.categoryId && tx.type === 'expense';
                  return (
                    <tr key={idx} style={{ backgroundColor: isIncome ? 'var(--bg-primary)' : 'transparent' }}>
                      <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{tx.date}</td>
                      <td style={{ fontSize: '0.8rem', maxWidth: '300px', whiteSpace: 'normal', lineHeight: '1.2' }}>{tx.description}</td>
                      <td>
                        <span className="badge" style={{ backgroundColor: isIncome ? 'var(--status-green-bg)' : 'var(--status-red-bg)', color: isIncome ? 'var(--status-green)' : 'var(--status-red)' }}>
                          {isIncome ? 'ENTRATA' : 'USCITA'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: isIncome ? 'var(--status-green)' : 'var(--text-primary)' }}>
                        {isIncome ? '+' : '-'}{new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(tx.amount)}
                      </td>
                      <td>
                        {isIncome ? (
                          <span className="text-xs text-muted">Non richiesta</span>
                        ) : (
                          <select 
                            value={tx.categoryId} 
                            onChange={(e) => handleCategoryChange(idx, e.target.value)}
                            style={{ 
                              padding: '0.3rem', 
                              fontSize: '0.8rem', 
                              borderColor: tx.categoryId ? (isAutoCat ? 'var(--status-green)' : 'var(--border-color)') : 'var(--status-red)',
                              borderWidth: tx.categoryId && isAutoCat ? '2px' : '1px'
                            }}
                          >
                            <option value="">-- Seleziona --</option>
                            <optgroup label="Spese Fisse">
                              {fixedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </optgroup>
                            <optgroup label="Spese Variabili">
                              {variableCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </optgroup>
                          </select>
                        )}
                        {isAutoCat && classifyTransaction(tx.description) === tx.categoryId && (
                          <span className="text-xs text-green ml-2" title="Auto-categorizzato via RegEx">✨ Auto</span>
                        )}
                      </td>
                      <td>
                        {isIncome ? (
                          <span className="text-xs text-muted">—</span>
                        ) : (
                          <select 
                            value={tx.nature} 
                            onChange={(e) => handleNatureChange(idx, e.target.value)}
                            style={{ 
                              padding: '0.3rem', 
                              fontSize: '0.8rem', 
                              borderColor: 'var(--border-color)',
                              borderWidth: '1px'
                            }}
                          >
                            <option value="variable">Variabile</option>
                            <option value="fixed">Fissa</option>
                            <option value="extraordinary">Straordinaria</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
