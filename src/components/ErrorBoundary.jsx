import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Uncaught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          padding: '2rem',
        }}>
          <div style={{
            maxWidth: 480,
            textAlign: 'center',
            padding: '2.5rem',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--status-red)',
          }}>
            <div style={{
              width: 56, height: 56,
              borderRadius: '50%',
              background: 'var(--status-red-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem',
            }}>
              <AlertTriangle size={28} color="var(--status-red)" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              Errore Imprevisto
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Si è verificato un errore nell'interfaccia. I tuoi dati sono al sicuro in IndexedDB.
            </p>
            <code style={{
              display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)',
              background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
              padding: '0.75rem', marginBottom: '1.5rem', textAlign: 'left', wordBreak: 'break-all',
            }}>
              {this.state.error?.message || 'Errore sconosciuto'}
            </code>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: 'var(--text-primary)', color: 'var(--bg-secondary)',
                border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.875rem',
              }}
            >
              <RefreshCw size={15} /> Ricarica Applicazione
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
