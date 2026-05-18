'use client';
// QuickActions — a floating context menu triggered by a "..." button.
// Usage: <QuickActions actions={[{ label, icon, onClick, danger }]} />

import { useEffect, useRef, useState } from 'react';
import { I } from '@/components/icons';

export function QuickActions({ actions, size = 'sm' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className={`btn btn-quiet btn-icon`}
        style={{ width: size === 'sm' ? 24 : 28, height: size === 'sm' ? 24 : 28, opacity: 0.6 }}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        title="Aktionen"
      >
        <I.more size={13} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 300,
          background: 'var(--bg-elev)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          minWidth: 180, overflow: 'hidden',
        }}>
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setOpen(false); a.onClick(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 14px', border: 'none',
                background: 'transparent', cursor: 'pointer', fontSize: 13,
                color: a.danger ? 'var(--danger)' : 'var(--text-1)',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-sunk)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {a.icon && <span style={{ flexShrink: 0, opacity: 0.7 }}>{a.icon}</span>}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
