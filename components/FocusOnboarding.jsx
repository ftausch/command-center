'use client';
// FocusOnboarding — shown once per user when they join the workspace.
// Asks what they work on so the sidebar can be tailored accordingly.
// Stored in localStorage AND synced to profiles via updateMyProfile.

import { useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';

export const FOCUS_KEY = (wsId, userId) => `cc.focus.${wsId}.${userId}`;

export function getFocusPreference(wsId, userId) {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(FOCUS_KEY(wsId, userId)) ?? null; }
  catch { return null; }
}

export function setFocusPreference(wsId, userId, focus) {
  try { localStorage.setItem(FOCUS_KEY(wsId, userId), focus); } catch {}
}

const OPTIONS = [
  {
    id: 'podcast',
    icon: '🎙',
    label: 'Podcast',
    desc: 'Du arbeitest an Episoden, Produktion und Gästen',
    color: 'var(--brand)',
    bg: 'var(--brand-soft)',
  },
  {
    id: 'events',
    icon: '🎪',
    label: 'Events',
    desc: 'Du planst und organisierst Events',
    color: '#e8780a',
    bg: '#fff4e6',
  },
  {
    id: 'both',
    icon: '🎙🎪',
    label: 'Podcast & Events',
    desc: 'Du arbeitest in beiden Bereichen',
    color: 'var(--brand)',
    bg: 'var(--brand-soft)',
  },
  {
    id: 'assistenz',
    icon: '🗂',
    label: 'Assistenz',
    desc: 'Du koordinierst Termine, Follow-ups und Unterlagen',
    color: '#712edd',
    bg: '#f3e8ff',
  },
  {
    id: 'all',
    icon: '👑',
    label: 'Alles sehen',
    desc: 'Du brauchst vollen Überblick über alles',
    color: 'var(--text-1)',
    bg: 'var(--bg-sunk)',
  },
];

export function FocusOnboarding({ onDone }) {
  const { currentWorkspaceId, me } = useWorkspace();
  const [selected, setSelected] = useState(null);
  const [saving,   setSaving]   = useState(false);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setFocusPreference(currentWorkspaceId, me?.id, selected);
    // Best-effort sync to profile specialty metadata
    try {
      const { updateMyProfile } = await import('@/lib/actions/profile');
      await updateMyProfile({ workspaceId: currentWorkspaceId, focusArea: selected });
    } catch {}
    setSaving(false);
    onDone(selected);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 90,
      background: 'rgba(20,22,28,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 520,
        background: 'var(--bg-elev)',
        borderRadius: 20,
        border: '1px solid var(--border)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '28px 28px 20px', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ fontSize: 13, color: 'var(--brand)', fontWeight: 600, marginBottom: 8 }}>
            🦄 Unicorn Bakery · Einmalige Einrichtung
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
            Was machst du bei uns?
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5 }}>
            Damit wir dir nur das Relevante zeigen. Diese Auswahl kannst du später in den Einstellungen ändern.
          </div>
        </div>

        {/* Options */}
        <div style={{ padding: '16px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSelected(opt.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', borderRadius: 12,
                border: `2px solid ${selected === opt.id ? opt.color : 'var(--border)'}`,
                background: selected === opt.id ? opt.bg : 'var(--bg-card)',
                cursor: 'pointer', textAlign: 'left', width: '100%',
                transition: 'all 0.12s',
              }}
            >
              <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{opt.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: selected === opt.id ? opt.color : 'var(--text-1)' }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>
                  {opt.desc}
                </div>
              </div>
              {selected === opt.id && (
                <span style={{ fontSize: 18, color: opt.color, flexShrink: 0 }}>✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px 24px', borderTop: '1px solid var(--border-soft)', display: 'flex', gap: 10 }}>
          <button
            className="btn btn-brand"
            style={{ flex: 1, justifyContent: 'center', fontSize: 14, height: 44, opacity: !selected ? 0.5 : 1 }}
            disabled={!selected || saving}
            onClick={save}
          >
            {saving ? 'Speichert…' : 'Los geht\'s →'}
          </button>
        </div>
      </div>
    </div>
  );
}
