import React, { useState } from 'react';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import { useToast } from '../components/Toast';

export default function Login({ correctEmail, correctPassword, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const showToast = useToast();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email === correctEmail && password === correctPassword) {
      onLogin();
      showToast('Accesso effettuato con successo', 'success');
    } else {
      showToast('Credenziali non valide', 'error');
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      padding: '1rem'
    }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '60px', height: '60px',
            background: 'var(--bg-tertiary)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            color: 'var(--chart-primary)'
          }}>
            <Lock size={28} />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Area Riservata</h2>
          <p className="kpi-sub">Inserisci le credenziali per accedere al tuo CFO Personale.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="kpi-label mb-2 flex items-center gap-2">
              <Mail size={14} /> Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Inserisci la tua email"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label className="kpi-label mb-2 flex items-center gap-2">
              <Lock size={14} /> Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Inserisci la password"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary flex items-center justify-center gap-2"
            style={{ marginTop: '1rem', padding: '0.75rem' }}
          >
            Accedi <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
