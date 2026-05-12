'use client';
// Workspace Switcher — Entry screen.
// Lists every workspace the user can access (from the provider) plus a
// per-workspace stats footer fetched in parallel from the data layer.

import { useEffect, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { db } from '@/lib/db';
import { I } from '@/components/icons';
import { Avatar, Kbd } from '@/components/ui';

export function WorkspaceSwitcher({ onPick }) {
  const { workspaces, me } = useWorkspace();
  const [hover, setHover] = useState(null);
  const [stats, setStats] = useState({}); // { [workspaceId]: { projects, tasks, team } }

  // Load stats for each visible workspace in parallel. Mock returns
  // synchronously; Supabase fires one COUNT(*) query per workspace.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        workspaces.map(async (w) => [w.id, await db.getWorkspaceStats(w.id)]),
      );
      if (cancelled) return;
      setStats(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaces]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <header style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="row gap-2">
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#1a1d24', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, letterSpacing: '-0.02em' }}>CC</div>
          <span style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>Command Center</span>
        </div>
        <div className="row gap-3" style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
          <span>Eingeloggt als</span>
          <div className="row gap-2">
            {me && <Avatar user={me} />}
            <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{me?.name ?? 'Fabian Tausch'}</span>
          </div>
          <span style={{ color: 'var(--text-4)' }}>·</span>
          <button className="btn btn-quiet btn-sm">Log out</button>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 880 }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div className="label" style={{ marginBottom: 12 }}>Choose your workspace</div>
            <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.15 }}>
              Wo arbeitest du heute, {me?.name?.split(' ')[0] ?? 'Fabian'}?
            </h1>
            <p style={{ color: 'var(--text-3)', fontSize: 15, marginTop: 10 }}>
              UnicornBakery und SelbstFrei bleiben getrennt — Aufgaben, Deadlines, Slack und Team.
            </p>
          </div>

          <div className="grid grid-2 gap-4">
            {workspaces.map((b) => {
              const s = stats[b.id] ?? { projects: '—', tasks: '—', team: '—' };
              const isHover = hover === b.id;
              return (
                <button
                  key={b.id}
                  onMouseEnter={() => setHover(b.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onPick(b.id)}
                  data-brand={b.id}
                  style={{
                    textAlign: 'left',
                    background: 'var(--bg-elev)',
                    border: `1px solid ${isHover ? b.color : 'var(--border)'}`,
                    borderRadius: 16,
                    padding: 24,
                    boxShadow: isHover ? '0 12px 32px rgba(20,22,28,0.08), 0 2px 6px rgba(20,22,28,0.04)' : 'var(--shadow-sm)',
                    transition: 'all 0.18s ease',
                    transform: isHover ? 'translateY(-2px)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 20,
                    minHeight: 280,
                  }}
                >
                  <div className="row between items-start">
                    <div className="row gap-3 items-start">
                      <div style={{
                        width: 48, height: 48, borderRadius: 12,
                        background: b.color, color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em',
                      }}>{b.initials}</div>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>{b.name}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>{b.sub}</div>
                      </div>
                    </div>
                    <span style={{ color: isHover ? b.color : 'var(--text-3)', transition: 'all 0.18s', transform: isHover ? 'translateX(4px)' : 'none' }}>
                      <I.arrowRight size={20} />
                    </span>
                  </div>

                  <p style={{ color: 'var(--text-2)', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                    {b.tagline}
                  </p>

                  <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, paddingTop: 16, borderTop: '1px solid var(--border-soft)' }}>
                    <Stat label="Projects" value={s.projects} />
                    <Stat label="Open Tasks" value={s.tasks} />
                    <Stat label="Team" value={s.team} />
                  </div>

                  <div className="row gap-2" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    <I.slack size={14} />
                    <span>Slack verbunden</span>
                    <span style={{ marginLeft: 'auto' }}>Last opened: heute</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="row center gap-2 mt-8" style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
            <I.zap size={13} />
            <span>Tipp:</span>
            <span>Du wechselst jederzeit über den Workspace-Switcher oben links —</span>
            <Kbd>⌘</Kbd><Kbd>K</Kbd>
            <span>öffnet das Command Menu.</span>
          </div>
        </div>
      </div>

      <footer style={{ padding: '16px 24px', borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-4)' }}>
        <span>Command Center · v0.1 · Internal</span>
        <span>Help · Status · Privacy</span>
      </footer>
    </div>
  );
}

const Stat = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
    <div className="mono" style={{ fontSize: 20, fontWeight: 600, marginTop: 4, letterSpacing: '-0.01em' }}>{value}</div>
  </div>
);
