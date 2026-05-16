import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Info } from 'lucide-react';

/**
 * KpiInfo — bottone ⓘ che apre un popover con la spiegazione del KPI.
 * Uso: <KpiInfo text="Spiegazione semplice del KPI..." />
 * Opzionale: position="below" per aprire sotto invece che sopra.
 */
export default function KpiInfo({ text, position = 'above' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Chiudi cliccando fuori
  const handleOutside = useCallback((e) => {
    if (ref.current && !ref.current.contains(e.target)) setOpen(false);
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('touchstart', handleOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [open, handleOutside]);

  const isAbove = position !== 'below';

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        aria-label="Informazioni sul KPI"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 0 0 0.3rem',
          display: 'inline-flex',
          alignItems: 'center',
          color: open ? 'var(--chart-primary)' : 'var(--text-muted)',
          opacity: open ? 1 : 0.6,
          transition: 'opacity 0.15s, color 0.15s',
          lineHeight: 1,
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = 1; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.opacity = 0.6; }}
      >
        <Info size={12} />
      </button>

      {open && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            ...(isAbove
              ? { bottom: 'calc(100% + 10px)' }
              : { top: 'calc(100% + 10px)' }),
            left: '50%',
            transform: 'translateX(-50%)',
            minWidth: '220px',
            maxWidth: '280px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '0.85rem 1rem',
            fontSize: '0.77rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.65,
            boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
            zIndex: 9999,
            whiteSpace: 'normal',
            textAlign: 'left',
            fontWeight: 400,
          }}
        >
          {/* Freccia */}
          <span style={{
            position: 'absolute',
            ...(isAbove
              ? { bottom: -5, borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }
              : { top: -5, borderLeft: '1px solid var(--border-color)', borderTop: '1px solid var(--border-color)' }),
            left: '50%',
            transform: 'translateX(-50%) rotate(45deg)',
            width: 9, height: 9,
            background: 'var(--bg-secondary)',
          }} />
          {text}
        </div>
      )}
    </span>
  );
}
