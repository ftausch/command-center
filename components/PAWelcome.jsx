'use client';
// PAWelcome — first-time welcome modal for assistant/manager users.
// Shown once per user (localStorage key), explains the Assistant Hub.

import { useEffect, useState } from 'react';
import { I } from '@/components/icons';

const FEATURES = [
  { icon: '📩', title: 'Follow-ups tracken',      desc: 'Kontakte, Fristen und nächste Schritte an einem Ort.' },
  { icon: '📄', title: 'Dokumente einfordern',     desc: 'Logos, Briefings, Rechnungen — wer schuldet was?' },
  { icon: '📅', title: 'Termine koordinieren',     desc: 'Termine die noch nicht bestätigt sind im Blick behalten.' },
  { icon: '⏰', title: 'Wiedervorlage',            desc: 'Items snoosen und später automatisch wieder sehen.' },
  { icon: '✅', title: 'Freigaben verfolgen',      desc: 'Was wartet auf eine Entscheidung von Fabian?' },
  { icon: '👤', title: 'Kontakte verwalten',       desc: 'Alle Ansprechpartner gesammelt und filterbar.' },
];

export function PAWelcome({ userId, onClose }) {
  const key = `cc.pa.welcomed.${userId}`;

  // Auto-skip if already welcomed
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(key)) setVisible(true);
    } catch {}
  }, [key]);

  if (!visible) return null;

  const dismiss = () => {
    try { localStorage.setItem(key, '1'); } catch {}
    setVisible(false);
    onClose?.();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(20,22,28,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div className="card card-pad" style={{ width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🗂</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Willkommen im Assistant Hub!</h2>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
            Dein persönlicher Arbeitsbereich für alle operativen Assistenz-Aufgaben.
            Alles was du brauchst, an einem Ort.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-2 gap-3 mb-6">
          {FEATURES.map((f) => (
            <div key={f.title} style={{
              padding: '12px 14px', borderRadius: 10,
              background: 'var(--bg-sunk)', border: '1px solid var(--border-soft)',
            }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{f.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Quick tip */}
        <div style={{
          padding: '12px 16px', borderRadius: 10,
          background: 'var(--brand-soft)', border: '1px solid var(--brand)',
          marginBottom: 20, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55,
        }}>
          💡 <strong>Tipp:</strong> Drücke <kbd style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px', fontSize: 12 }}>A</kbd> jederzeit um schnell zum Assistant Hub zu springen.
          Drücke <kbd style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px', fontSize: 12 }}>?</kbd> für alle Shortcuts.
        </div>

        <button
          onClick={dismiss}
          className="btn btn-brand"
          style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: '12px' }}
        >
          Los geht's → Assistant Hub öffnen
        </button>
      </div>
    </div>
  );
}
