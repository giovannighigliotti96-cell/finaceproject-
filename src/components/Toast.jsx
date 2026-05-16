import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: { icon: CheckCircle, color: 'var(--status-green)', bg: 'var(--status-green-bg)' },
  error:   { icon: XCircle,     color: 'var(--status-red)',   bg: 'var(--status-red-bg)'   },
  warning: { icon: AlertTriangle, color: 'var(--status-yellow)', bg: 'var(--status-yellow-bg)' },
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', duration = 3500) => {
    const id = `toast_${Date.now()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const dismiss = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 380 }}>
        {toasts.map(toast => {
          const cfg = ICONS[toast.type] || ICONS.success;
          const Icon = cfg.icon;
          return (
            <div
              key={toast.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.875rem 1rem',
                background: 'var(--bg-secondary)',
                border: `1px solid ${cfg.color}`,
                borderLeft: `4px solid ${cfg.color}`,
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                animation: 'toastIn 0.25s ease forwards',
                minWidth: 280,
              }}
            >
              <Icon size={18} color={cfg.color} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                {toast.message}
              </span>
              <button
                onClick={() => dismiss(toast.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.15rem', display: 'flex', alignItems: 'center' }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.showToast;
};
