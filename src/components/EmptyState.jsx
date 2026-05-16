import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// FIX 4.3: rimossa data hardcoded "12 maggio"
export default function EmptyState() {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: 400,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1.25rem',
      textAlign: 'center',
      padding: '3rem 2rem',
    }}>
      <div style={{
        width: 64, height: 64,
        borderRadius: '50%',
        backgroundColor: 'var(--bg-tertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <ShieldCheck size={36} color="var(--text-muted)" />
      </div>

      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Nessun Ciclo Attivo
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: 360, lineHeight: 1.6 }}>
          Il sistema è inattivo. Registra il tuo stipendio in <strong>Admin / Setup</strong> per
          inizializzare il primo ciclo fiscale e attivare tutti i KPI.
        </p>
      </div>

      <button
        className="btn btn-primary"
        onClick={() => navigate('/admin')}
        style={{ padding: '0.75rem 1.75rem' }}
      >
        Vai ad Admin / Setup →
      </button>
    </div>
  );
}
