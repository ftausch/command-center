'use client';
// SavedViews — per-workspace named filter presets stored in localStorage.
// Usage:
//   const { SavedViewsButton, applySavedView } = useSavedViews(workspaceId, currentView);
//   <SavedViewsButton />
//   — applySavedView returns a view object when the user picks one.

import { useEffect, useRef, useState } from 'react';
import { I } from '@/components/icons';

const STORAGE_KEY = (wsId) => `saved-views-${wsId}`;

function load(wsId) {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY(wsId)) ?? '[]'); }
  catch { return []; }
}

function save(wsId, views) {
  localStorage.setItem(STORAGE_KEY(wsId), JSON.stringify(views));
}

export function SavedViewsButton({ workspaceId, currentView, onApply }) {
  const [open, setOpen]   = useState(false);
  const [views, setViews] = useState([]);
  const [name, setName]   = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (open) setViews(load(workspaceId));
  }, [open, workspaceId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const saveView = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = [...views, { id: Date.now(), name: trimmed, view: currentView }];
    save(workspaceId, next);
    setViews(next);
    setName('');
  };

  const deleteView = (id) => {
    const next = views.filter((v) => v.id !== id);
    save(workspaceId, next);
    setViews(next);
  };

  const apply = (v) => {
    onApply(v.view);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="chip"
        onClick={() => setOpen((o) => !o)}
        title="Gespeicherte Ansichten"
        style={{ display: 'flex', alignItems: 'center', gap: 5 }}
      >
        <I.bookmark size={11} /> Views {views.length > 0 && <span className="count">{views.length}</span>}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 300,
          background: 'var(--bg-elev)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.13)',
          minWidth: 240, padding: '8px 0', overflow: 'hidden',
        }}>
          {views.length === 0 && (
            <div style={{ padding: '8px 14px', fontSize: 12.5, color: 'var(--text-3)', fontStyle: 'italic' }}>
              Keine gespeicherten Ansichten.
            </div>
          )}
          {views.map((v) => (
            <div
              key={v.id}
              className="row between items-center"
              style={{ padding: '6px 12px 6px 14px' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-sunk)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <button
                onClick={() => apply(v)}
                style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-1)', padding: 0 }}
              >
                {v.name}
              </button>
              <button
                onClick={() => deleteView(v.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: '2px 4px', borderRadius: 4 }}
                title="Ansicht löschen"
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; e.stopPropagation(); }}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-4)'}
              >
                <I.x size={11} />
              </button>
            </div>
          ))}

          <div style={{ borderTop: '1px solid var(--border-soft)', padding: '8px 10px 6px', marginTop: views.length > 0 ? 4 : 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6, paddingLeft: 4 }}>Aktuelle Ansicht speichern</div>
            <div className="row gap-2">
              <input
                className="input"
                placeholder="Name …"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveView(); }}
                style={{ flex: 1, height: 28, fontSize: 12.5 }}
                autoFocus
              />
              <button
                className="btn btn-brand btn-sm"
                onClick={saveView}
                disabled={!name.trim()}
                style={{ height: 28 }}
              >
                <I.plus size={11} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
