'use client';

import { useState } from 'react';
import { updateSpecialty } from '@/lib/actions/profile';

const ROLES = [
  { id: 'host',       icon: '🎙️', label: 'Host / Moderator',    desc: 'Aufnahme, Interviews, Konzept' },
  { id: 'editor',     icon: '✂️', label: 'Cutter / Editor',     desc: 'Schnitt, Postproduktion' },
  { id: 'thumbnail',  icon: '🎨', label: 'Thumbnail Designer',  desc: 'Grafiken, Artwork, Branding' },
  { id: 'shownotes',  icon: '📝', label: 'Show Notes',          desc: 'Texte, Beschreibungen, SEO' },
  { id: 'social',     icon: '📱', label: 'Social Media',        desc: 'Distribution, Posts, Clips' },
  { id: 'audio',      icon: '🎵', label: 'Audio Engineer',      desc: 'Mastering, Sound, Mixing' },
  { id: 'manager',    icon: '⚙️', label: 'Manager / Producer',  desc: 'Koordination, Planung, Deadlines' },
];

export function OnboardingScreen({ onDone }) {
  const [selected, setSelected]   = useState(null);
  const [pending,  setPending]    = useState(false);
  const [error,    setError]      = useState(null);

  const handleContinue = async () => {
    if (!selected) return;
    setPending(true);
    setError(null);
    const r = await updateSpecialty(selected);
    setPending(false);
    if (!r.ok) { setError(r.error); return; }
    onDone(selected);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div className="fade-in" style={{ maxWidth: 680, width: '100%' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>👋</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-1)', margin: '0 0 10px' }}>
            Willkommen bei Command Center
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
            Was ist deine Rolle im Team? Das hilft uns die App auf dich anzupassen.
          </p>
        </div>

        {/* Role cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 32,
        }}>
          {ROLES.map((role) => {
            const isSelected = selected === role.id;
            return (
              <button
                key={role.id}
                onClick={() => setSelected(role.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  gap: 8, padding: '16px 18px',
                  background: isSelected ? 'var(--brand-soft)' : '#ffffff',
                  border: `1.5px solid ${isSelected ? 'var(--brand)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-lg)',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'border-color 0.12s, background 0.12s, transform 0.1s, box-shadow 0.1s',
                  transform: isSelected ? 'translateY(-2px)' : 'none',
                  boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <span style={{ fontSize: 28, lineHeight: 1 }}>{role.icon}</span>
                <div>
                  <div style={{
                    fontSize: 13.5, fontWeight: 600,
                    color: isSelected ? 'var(--brand)' : 'var(--text-1)',
                    marginBottom: 3,
                  }}>
                    {role.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>
                    {role.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div style={{ fontSize: 13, color: 'var(--danger)', textAlign: 'center', marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <button
            className="btn btn-brand"
            onClick={handleContinue}
            disabled={!selected || pending}
            style={{ minWidth: 200, height: 44, fontSize: 15, borderRadius: 'var(--r-md)' }}
          >
            {pending ? 'Wird gespeichert…' : 'Weiter →'}
          </button>
          <button
            onClick={() => onDone(null)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, color: 'var(--text-3)',
              padding: '4px 8px', borderRadius: 4,
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-2)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
          >
            Überspringen
          </button>
        </div>
      </div>
    </div>
  );
}
