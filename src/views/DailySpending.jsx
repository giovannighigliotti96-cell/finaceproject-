import React, { useState } from 'react';
import { useFinanceData } from '../context/FinanceContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import TransactionFormModal from '../components/TransactionFormModal';
import { format, parseISO, addDays } from 'date-fns';
import { Plus } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import KpiInfo from '../components/KpiInfo';

export default function VariableCosts({ onNavigate }) {
  const { data, computed } = useFinanceData();
  const deleteTransaction = useFinanceStore(state => state.deleteTransaction);
  const [filterNature, setFilterNature] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const formatEuro = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);
const formatDate = (dateStr) => {
  try { return format(parseISO(dateStr), 'dd/MM/yy'); }
  catch { return '—'; }
};
  if (!computed.activePeriod) return <EmptyState onGoToAdmin={() => onNavigate?.('admin')} />;

  // Solo uscite variabili (esclude fisse e stipendio)
  const variableTx = (computed.periodTx || []).filter(
    t => t.nature === 'variable' || t.nature === 'extraordinary'
  );
  const sortedTx = [...variableTx].sort((a, b) => new Date(b.date) - new Date(a.date));
  const filteredTx = filterNature === 'all' ? sortedTx : sortedTx.filter(t => t.nature === filterNature);

  // Grafico cumulato spesa variabile
  const startDate = parseISO(computed.activePeriod.startDate);
  let cum = 0;
  const daysToRender = Math.max(1, (computed.daysElapsed ?? 0) + 1);
  const chartData = Array.from({ length: daysToRender }, (_, i) => {
    const day = addDays(startDate, i);
    const dateStr = format(day, 'yyyy-MM-dd');
    const daySpend = variableTx
      .filter(t => t.date === dateStr && t.status === 'paid')
      .reduce((s, t) => s + t.amount, 0);
    cum += daySpend;
    return { date: format(day, 'dd/MM'), cumulative: Number(cum.toFixed(2)) };
  });

  const totalVariablePaid = variableTx.filter(t => t.status === 'paid').reduce((s, t) => s + t.amount, 0);
  const totalVariablePlanned = variableTx.filter(t => t.status === 'planned').reduce((s, t) => s + t.amount, 0);

  const statusColors = {
    paid:    { bg: 'rgba(16,185,129,0.12)',  color: 'var(--status-green)'  },
    planned: { bg: 'rgba(245,158,11,0.12)',  color: 'var(--status-yellow)' },
  };
  const natureColors = {
    variable:      { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6'  },
    extraordinary: { bg: 'rgba(249,115,22,0.12)',  color: '#f97316'  },
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2>Costi Variabili</h2>
          <p className="kpi-sub">Spese discrezionali del ciclo fiscale attivo</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> Nuova Spesa
        </button>
      </div>

      {/* KPI */}
      <div className="grid-3col">
        <div className="card">
          <div className="kpi-label" style={{ display: 'flex', alignItems: 'center' }}>Speso (Actual) <KpiInfo text="Totale delle spese variabili già pagate in questo ciclo fiscale. Esclude i costi fissi e i pianificati non ancora pagati." /></div>
          <div className="kpi-value text-xl text-yellow">{formatEuro(totalVariablePaid)}</div>
          <p className="kpi-sub mt-1">Già contabilizzato</p>
        </div>
        <div className="card">
          <div className="kpi-label" style={{ display: 'flex', alignItems: 'center' }}>Spendibile al Giorno <KpiInfo text="Quanto puoi spendere oggi. Calcolato come: stipendio − fissi totali − variabili già spese − buffer, diviso per i giorni rimasti allo stipendio." /></div>
          <div className="kpi-value text-xl" style={{ color: computed.spendibileGiornalieroFinoAlProssimoStipendio >= 0 ? 'var(--status-green)' : 'var(--status-red)' }}>
            {formatEuro(computed.spendibileGiornalieroFinoAlProssimoStipendio)}
          </div>
          <p className="kpi-sub mt-1">Al netto di fissi e buffer</p>
        </div>
        <div className="card">
          <div className="kpi-label" style={{ display: 'flex', alignItems: 'center' }}>Giorni al Prossimo Stipendio <KpiInfo text="Quanti giorni mancano alla fine del ciclo fiscale (data del prossimo accredito). Il burn variabile medio giornaliero è calcolato su questo orizzonte." /></div>
          <div className="kpi-value text-xl">{computed.giorniMancantiAlProssimoAccredito} <span className="text-sm font-medium text-muted">gg</span></div>
          <p className="kpi-sub mt-1">Media: {formatEuro(computed.spesaMediaGiornalieraVariabileAttuale ?? 0)}/gg</p>
        </div>
      </div>

      {/* Chart */}
      <div className="card" style={{ height: 280 }}>
        <h3 className="mb-4">Andamento Cumulato Spesa Variabile</h3>
        <ResponsiveContainer width="100%" height="82%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} minTickGap={20} />
            <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `€${v}`} width={65} />
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '12px' }}
              formatter={v => [formatEuro(v), 'Spesa Cumulata']}
            />
            <Line type="monotone" dataKey="cumulative" stroke="var(--status-yellow)" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3>Registro Movimenti Variabili</h3>
          <select
            value={filterNature}
            onChange={e => setFilterNature(e.target.value)}
            style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
          >
            <option value="all">Tutte</option>
            <option value="variable">Variabili</option>
            <option value="extraordinary">Straordinarie</option>
          </select>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrizione</th>
              <th>Natura</th>
              <th>Stato</th>
              <th style={{ textAlign: 'right' }}>Importo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredTx.map(tx => {
              const sc = statusColors[tx.status] || statusColors.paid;
              const nc = natureColors[tx.nature] || natureColors.variable;
              return (
                <tr key={tx.id}>
                  <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {formatDate(tx.date)}
                  </td>
                  <td style={{ fontWeight: 600 }}>{tx.description}</td>
                  <td>
                    <span className="badge" style={{ backgroundColor: nc.bg, color: nc.color }}>
                      {tx.nature}
                    </span>
                  </td>
                  <td>
                    <span className="badge" style={{ backgroundColor: sc.bg, color: sc.color }}>
                      {tx.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    -{formatEuro(tx.amount)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                  <button
                    onClick={() => {
                  if (window.confirm(`Eliminare "${tx.description}"?`)) {
                  deleteTransaction(tx.id);
      }
    }}
    style={{
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: 'var(--status-red)',
      opacity: 0.6,
      padding: '0.25rem',
    }}
    title="Elimina transazione"
  >
    🗑
  </button>
</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredTx.length === 0 && (
          <div className="p-8 text-center text-muted italic text-sm">
            Nessuna spesa variabile registrata ancora.<br />
            Usa il pulsante "Nuova Spesa" per aggiungere una transazione.
          </div>
        )}
      </div>

      <TransactionFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
