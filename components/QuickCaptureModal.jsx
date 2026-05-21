'use client';
// QuickCaptureModal — floating modal to quickly add an assistant item from anywhere.
// Triggered by Shift+A keyboard shortcut.
// Minimal form: title + type + optional due date.

import { useEffect, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { createAssistantItem } from '@/lib/actions/assistant';

const TYPES = [
  { id: 'follow_up',        label: 'Follow-up',    icon: '📩' },
  { id: 'scheduling',       label: 'Termin',       icon: '📅' },
  { id: 'document_request', label: 'Dokument',     icon: '📄' },
  { id: 'approval',         label: 'Freigabe',     icon: '✅' },
  { id: 'reminder',         label: 'Erinnerung',   icon: '🔔' },
  { id: 'other',            label: 'Sonstiges',    icon: '📌' },
];

export function QuickCaptureModal({ onClose }) {
  const { currentWorkspaceId } = useWorkspace();
  const [title,    setTitle]    = useState('');
  const [type,     setType]     = useState('follow_up');
  const [due,      setDue]      = useState('');
  const [contact,  setContact]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e?.preventDefault();
    const t = title.trim();
    if (!t) return;
    setSaving(true); setError(null);
    const r = await createAssistantItem({
      workspaceId: currentWorkspaceId,
      title: t,
      type,
      contactName: contact.trim() || undefined,
      dueDate: due || undefined,
    });
    setSaving(false);
    if (!r.ok) { setError(r.error); return; }
    setSaved(true);
    setTimeout(() => {
      setTitle(''); setType('follow_up'); setDue(''); setContact('');
      setSaved(false);
    }, 1200);
  };

  const addAnother = () => {
    setTitle(''); setType('follow_up'); setDue(''); setContact('');
    setSaved(false);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(20,22,28,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{ width: '100%', maxWidth: 480, background: 'var(--bg-elev)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>⚡ Schnell erfassen</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 1 }}>Shift+A · Esc zum Schließen</div>
          </div>
          <button className="btn btn-quiet btn-icon" onClick={onClose}><I.x size={14} /></button>
        </div>

        {saved ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Gespeichert!</div>
            <div className="row gap-2" style={{ justifyContent: 'center' }}>
              <button className="btn btn-brand btn-sm" onClick={addAnother}>+ Noch eines</button>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Fertig</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} style={{ padding: '16px 20px 20px' }}>
            {/* Title */}
            <input
              className="input"
              autoFocus
              placeholder="Was möchtest du festhalten?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
              style={{ fontSize: 15, marginBottom: 12, fontWeight: 500 }}
            />

            {/* Type chips */}
            <div className="row gap-2 mb-3" style={{ flexWrap: 'wrap' }}>
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, border: '1px solid',
                    fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                    borderColor: type === t.id ? 'var(--brand)' : 'var(--border)',
                    background:  type === t.id ? 'var(--brand-soft)' : 'var(--bg-sunk)',
                    color:       type === t.id ? 'var(--brand)' : 'var(--text-3)',
                    transition:  'all 0.1s',
                  }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Optional fields */}
            <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <input className="input" placeholder="👤 Kontakt (optional)"
                value={contact} onChange={(e) => setContact(e.target.value)}
                disabled={saving} style={{ fontSize: 13 }} />
              <input type="date" className="input" value={due}
                onChange={(e) => setDue(e.target.value)}
                disabled={saving} style={{ fontSize: 13 }} />
            </div>

            {error && <div style={{ fontSize: 12.5, color: 'var(--danger)', marginBottom: 8 }}>{error}</div>}

            <div className="row gap-2">
              <button type="submit" className="btn btn-brand"
                style={{ flex: 1, justifyContent: 'center' }}
                disabled={!title.trim() || saving}>
                {saving ? 'Speichert…' : '⚡ Jetzt speichern'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={saving}>
                Abbrechen
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
