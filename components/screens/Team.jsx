'use client';
// Team View

import { useEffect, useState, useMemo } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Avatar, Badge } from '@/components/ui';
import { daysUntil } from '@/lib/utils';
import { KPI } from '@/components/screens/Dashboard';
import { InvitePersonModal } from '@/components/InvitePersonModal';
import { MemberManageModal } from '@/components/MemberManageModal';
import { CAN } from '@/lib/roles';

// ── OOO helpers ──────────────────────────────────────────────────────────

const OOO_KEY = (wsId, userId) => `cc.ooo.${wsId}.${userId}`;

function getOOO(wsId, userId) {
  try { return JSON.parse(localStorage.getItem(OOO_KEY(wsId, userId)) ?? 'null'); }
  catch { return null; }
}
function setOOO(wsId, userId, data) {
  try {
    if (!data) localStorage.removeItem(OOO_KEY(wsId, userId));
    else localStorage.setItem(OOO_KEY(wsId, userId), JSON.stringify(data));
  } catch {}
}
function isCurrentlyOOO(ooo) {
  if (!ooo?.until) return false;
  const today = new Date().toISOString().slice(0, 10);
  return ooo.until >= today;
}

const SPECIALTY_LABEL = {
  host:      { icon: '🎙️', label: 'Host / Moderator' },
  editor:    { icon: '✂️', label: 'Cutter / Editor' },
  thumbnail: { icon: '🎨', label: 'Thumbnail Designer' },
  shownotes: { icon: '📝', label: 'Show Notes' },
  social:    { icon: '📱', label: 'Social Media' },
  audio:     { icon: '🎵', label: 'Audio Engineer' },
  manager:   { icon: '⚙️', label: 'Manager / Producer' },
};

export function TeamScreen({ setRoute }) {
  const { currentWorkspace: brand, data, myRole, currentWorkspace } = useWorkspace();
  const users = data.members;
  const tasks = data.tasks;

  // Division-aware workload per user
  const workloadByUser = useMemo(() => {
    const m = {};
    for (const u of users) {
      const myTasks = tasks.filter((t) => t.assignee === u.id && t.status !== 'Done');
      const projMap = {};
      data.projects.forEach((p) => { projMap[p.id] = p.division ?? 'general'; });
      m[u.id] = {
        total: myTasks.length,
        podcast: myTasks.filter((t) => projMap[t.projectId] === 'podcast').length,
        events:  myTasks.filter((t) => projMap[t.projectId] === 'events').length,
        general: myTasks.filter((t) => (projMap[t.projectId] ?? 'general') === 'general').length,
      };
    }
    return m;
  }, [users, tasks, data.projects]);

  const hasEvents = currentWorkspace?.capabilities?.events;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [manageMember, setManageMember] = useState(null);

  const { currentWorkspaceId, me } = useWorkspace();
  const [oooState, setOooState] = useState({});

  useEffect(() => {
    const s = {};
    users.forEach(u => { const o = getOOO(currentWorkspaceId, u.id); if (o) s[u.id] = o; });
    setOooState(s);
  }, [currentWorkspaceId, users.length]);

  const updateOOO = (userId, data) => {
    setOOO(currentWorkspaceId, userId, data);
    setOooState(s => { const n = { ...s }; if (!data) delete n[userId]; else n[userId] = data; return n; });
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2"><Badge kind="brand" dot>{brand?.name}</Badge></div>
          <h1 className="h1">Team</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Wer arbeitet gerade woran. Auslastung pro Person. Filter nach Rolle, Status, Workspace.
          </p>
        </div>
        <div className="row gap-2">
          <button className="btn btn-ghost btn-sm" disabled title="Noch nicht verfügbar"><I.filter size={13} /> Filter</button>
          {CAN.inviteMember(myRole) && (
            <button className="btn btn-brand btn-sm" onClick={() => setInviteOpen(true)}><I.plus size={13} /> Person einladen</button>
          )}
        </div>
      </div>

      <InvitePersonModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <MemberManageModal
        open={manageMember !== null}
        member={manageMember}
        onClose={() => setManageMember(null)}
      />

      <div className="grid grid-4 gap-3 mb-4">
        <KPI label="Teammitglieder" value={users.length} trend={`${users.filter((u) => u.online).length} online`} />
        <KPI label="Offene Tasks" value={tasks.filter((t) => t.status !== 'Done').length} trend="Gesamtauslastung" />
        <KPI label="Überfällig" value={tasks.filter((t) => t.status !== 'Done' && daysUntil(t.due) < 0).length} trend="braucht Aufmerksamkeit" tone="bad" />
        <KPI label="Ø Tasks pro Person" value={users.length ? Math.round((tasks.filter((t) => t.status !== 'Done').length / users.length) * 10) / 10 : 0} trend="Verteilung" tone="ok" />
      </div>

      {/* Capacity overview bar */}
      {users.length > 0 && (
        <div className="card card-pad mb-5">
          <div className="h3 mb-3">📊 Team-Kapazität</div>
          <div className="col gap-3">
            {users.map((u) => {
              const w = workloadByUser[u.id] ?? { total: 0, podcast: 0, events: 0, general: 0 };
              const pct = Math.min(100, w.total * 10);
              const color = pct > 80 ? 'var(--danger)' : pct > 60 ? 'var(--warning)' : 'var(--success)';
              return (
                <div key={u.id} className="row gap-3 items-center">
                  <div style={{ width: 120, fontSize: 13, fontWeight: 500, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.name.split(' ')[0]}
                  </div>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--border-soft)', overflow: 'hidden', display: 'flex' }}>
                    {w.podcast > 0 && <div style={{ width: Math.min(100, w.podcast * 10) + '%', background: 'var(--brand)' }} />}
                    {w.events  > 0 && <div style={{ width: Math.min(100, w.events  * 10) + '%', background: '#e8780a' }} />}
                    {w.general > 0 && <div style={{ width: Math.min(100, w.general * 10) + '%', background: 'var(--info)' }} />}
                  </div>
                  <div className="row gap-2 items-center" style={{ minWidth: 90, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color }}>{w.total} Tasks</span>
                    {pct > 80 && <span style={{ fontSize: 10, color: 'var(--danger)' }}>ausgelastet</span>}
                    {w.total === 0 && <span style={{ fontSize: 10, color: 'var(--success)' }}>frei</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="row gap-3 mt-3" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
            <span><span style={{ display:'inline-block',width:10,height:10,borderRadius:2,background:'var(--brand)',marginRight:4 }}/>Podcast</span>
            <span><span style={{ display:'inline-block',width:10,height:10,borderRadius:2,background:'#e8780a',marginRight:4 }}/>Events</span>
            <span><span style={{ display:'inline-block',width:10,height:10,borderRadius:2,background:'var(--info)',marginRight:4 }}/>Allgemein</span>
          </div>
        </div>
      )}

      {users.length === 0 && (
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👤</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Noch keine Teammitglieder</div>
          <div className="meta" style={{ marginBottom: 16 }}>Lade Kolleg:innen ein um gemeinsam Tasks und Projekte zu verwalten.</div>
          {CAN.inviteMember(myRole) && (
            <button className="btn btn-brand btn-sm" onClick={() => setInviteOpen(true)} style={{ margin: '0 auto' }}>
              <I.plus size={13} /> Erste Person einladen
            </button>
          )}
        </div>
      )}

      <div className="grid grid-2 gap-3">
        {users.map((u) => {
          const userTasks = tasks.filter((t) => t.assignee === u.id);
          const open = userTasks.filter((t) => t.status !== 'Done');
          const overdue = open.filter((t) => daysUntil(t.due) < 0);
          const inProgress = open.filter((t) => t.status === 'In Progress');
          const load = Math.min(100, open.length * 14);
          const overLoaded = load > 80;
          return (
            <div key={u.id} className="card card-pad">
              <div className="row between mb-3">
                <div className="row gap-3">
                  <div style={{ position: 'relative' }}>
                    <Avatar user={u} size="lg" />
                    {u.online && <span style={{
                      position: 'absolute', bottom: 0, right: 0,
                      width: 10, height: 10, borderRadius: 999,
                      background: 'var(--success)', border: '2px solid var(--bg-elev)',
                    }} />}
                  </div>
                  <div>
                    <div className="row gap-2 items-center">
                      <span style={{ fontWeight: 600, fontSize: 14.5 }}>{u.name}</span>
                      {isCurrentlyOOO(oooState[u.id]) && (
                        <span style={{ fontSize: 11, fontWeight: 700, background: '#fef3c7', color: '#d97706', padding: '1px 8px', borderRadius: 20 }}>
                          🌴 OOO bis {new Date(oooState[u.id].until + 'T00:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                    <div className="row gap-2 mt-1">
                      <span className="meta">{u.role}</span>
                      {u.specialty && SPECIALTY_LABEL[u.specialty] && (
                        <span style={{ fontSize: 11.5, color: 'var(--brand)', background: 'var(--brand-soft)', borderRadius: 'var(--r-pill)', padding: '1px 8px', fontWeight: 500 }}>
                          {SPECIALTY_LABEL[u.specialty].icon} {SPECIALTY_LABEL[u.specialty].label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="row gap-1">
                  {me?.id === u.id && (
                    <OOOButton userId={u.id} wsId={currentWorkspaceId} ooo={oooState[u.id]} onUpdate={updateOOO} />
                  )}
                  {CAN.manageMember(myRole) && (
                    <button className="btn btn-quiet btn-sm" onClick={() => setManageMember(u)} title="Mitglied verwalten">
                      <I.more size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="row gap-4 mb-3">
                <SmallStat label="Offen" value={open.length} />
                <SmallStat label="In Progress" value={inProgress.length} />
                <SmallStat label="Überfällig" value={overdue.length} tone={overdue.length > 0 ? 'bad' : ''} />
              </div>

              {/* Division workload breakdown — only show when workspace has events */}
              {hasEvents && workloadByUser[u.id] && (workloadByUser[u.id].podcast > 0 || workloadByUser[u.id].events > 0) && (
                <div className="row gap-2 mb-3" style={{ flexWrap: 'wrap' }}>
                  {workloadByUser[u.id].podcast > 0 && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--brand-soft)', color: 'var(--brand)', fontWeight: 600 }}>
                      🎙 {workloadByUser[u.id].podcast} Podcast
                    </span>
                  )}
                  {workloadByUser[u.id].events > 0 && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#fff4e6', color: '#e8780a', fontWeight: 600 }}>
                      🎪 {workloadByUser[u.id].events} Events
                    </span>
                  )}
                </div>
              )}

              <div className="mb-3">
                <div className="row between items-center" style={{ marginBottom: 6 }}>
                  <span className="label">Kapazität</span>
                  <div className="row gap-2 items-center">
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 10,
                      background: overLoaded ? 'var(--danger-bg)' : load > 60 ? '#fffbeb' : '#f0fdf4',
                      color: overLoaded ? 'var(--danger)' : load > 60 ? 'var(--warning)' : 'var(--success)',
                    }}>
                      {overLoaded ? '🔴 Ausgelastet' : load > 60 ? '🟡 Hoch' : '🟢 OK'}
                    </span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>{open.length} Tasks</span>
                  </div>
                </div>
                {/* Stacked workload bar */}
                <div style={{ height: 8, borderRadius: 4, background: 'var(--border-soft)', overflow: 'hidden', display: 'flex' }}>
                  {(() => {
                    const w = workloadByUser[u.id] ?? {};
                    const total = Math.max(w.total || open.length, 1);
                    const maxDisplay = 10; // 10 tasks = 100%
                    const pPod = Math.min(100, (w.podcast / maxDisplay) * 100);
                    const pEvt = Math.min(100, (w.events  / maxDisplay) * 100);
                    const pGen = Math.min(100, (w.general / maxDisplay) * 100);
                    return (
                      <>
                        {pPod > 0 && <div style={{ width: pPod + '%', background: 'var(--brand)', transition: 'width 0.3s' }} />}
                        {pEvt > 0 && <div style={{ width: pEvt + '%', background: '#e8780a', transition: 'width 0.3s' }} />}
                        {pGen > 0 && <div style={{ width: pGen + '%', background: 'var(--info)', transition: 'width 0.3s' }} />}
                      </>
                    );
                  })()}
                </div>
                <div className="row gap-3 mt-1" style={{ fontSize: 10.5, color: 'var(--text-4)' }}>
                  {workloadByUser[u.id]?.podcast > 0 && <span style={{ color: 'var(--brand)' }}>🎙 {workloadByUser[u.id].podcast}</span>}
                  {workloadByUser[u.id]?.events  > 0 && <span style={{ color: '#e8780a' }}>🎪 {workloadByUser[u.id].events}</span>}
                  {workloadByUser[u.id]?.general > 0 && <span style={{ color: 'var(--info)' }}>📋 {workloadByUser[u.id].general}</span>}
                </div>
              </div>

              <div className="col gap-1 mt-2" style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 10 }}>
                <div className="label" style={{ marginBottom: 4 }}>Aktuell</div>
                {open.slice(0, 2).map((t) => {
                  const p = data.projects.find((pr) => pr.id === t.projectId);
                  return (
                    <div key={t.id} className="row gap-2" style={{ padding: '4px 0', fontSize: 12.5, cursor: 'pointer' }} onClick={() => setRoute('project:' + t.projectId)}>
                      <span className="dot-indicator" style={{ background: t.status === 'Blocked' ? 'var(--danger)' : t.status === 'In Progress' ? 'var(--info)' : 'var(--text-3)' }} />
                      <span className="truncate" style={{ flex: 1 }}>{t.title}</span>
                      <span className="meta">{p?.name.split('—')[0]?.trim() || p?.name}</span>
                    </div>
                  );
                })}
                {open.length === 0 && <div className="meta">Keine offenen Tasks</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SmallStat = ({ label, value, tone }) => (
  <div>
    <div className="label" style={{ fontSize: 10 }}>{label}</div>
    <div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: 2, color: tone === 'bad' ? 'var(--danger)' : 'var(--text-1)' }}>{value}</div>
  </div>
);

function OOOButton({ userId, wsId, ooo, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [until, setUntil] = useState('');
  const active = isCurrentlyOOO(ooo);

  const save = () => {
    if (!until) return;
    onUpdate(userId, { until, since: new Date().toISOString().slice(0, 10) });
    setOpen(false);
    setUntil('');
  };
  const clear = () => { onUpdate(userId, null); setOpen(false); };

  return (
    <div style={{ position: 'relative' }}>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11.5, color: active ? '#d97706' : 'var(--text-3)' }}
        onClick={() => setOpen(o => !o)} title="Out of Office markieren">
        🌴 {active ? 'OOO' : 'OOO?'}
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 30,
          background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10,
          padding: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 200,
        }}
          onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>🌴 Out of Office</div>
          {active ? (
            <div className="col gap-2">
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Abwesend bis {new Date(ooo.until + 'T00:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}
              </div>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', fontSize: 12 }} onClick={clear}>
                OOO beenden
              </button>
            </div>
          ) : (
            <div className="col gap-2">
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Abwesend bis:</div>
              <input type="date" className="input" value={until} onChange={e => setUntil(e.target.value)}
                min={new Date().toISOString().slice(0, 10)} style={{ fontSize: 13 }} />
              <div className="row gap-2">
                <button className="btn btn-brand btn-sm" onClick={save} disabled={!until} style={{ flex: 1 }}>Speichern</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>✕</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
