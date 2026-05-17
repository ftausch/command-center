'use client';
// Sidebar — left nav with brand pill + nav sections; Topbar with breadcrumb + search

import React, { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Avatar, Kbd } from '@/components/ui';
import { NewTaskModal } from '@/components/NewTaskModal';
import { NotificationsPanel, useNotificationCount } from '@/components/NotificationsPanel';

// Returns the number of activity entries newer than the last time the user
// visited the Activity screen. Stored per workspace in localStorage so it
// survives page reloads. Cleared when route === 'activity'.
function useActivityUnread(workspaceId, route) {
  const { data } = useWorkspace();
  const key = workspaceId ? `cc.activity.seen.${workspaceId}` : null;
  const [lastSeen, setLastSeen] = useState(0);

  // Read persisted timestamp on mount / workspace switch
  useEffect(() => {
    if (!key) return;
    try { setLastSeen(parseInt(localStorage.getItem(key) ?? '0', 10)); } catch {}
  }, [key]);

  // Clear when user opens Activity
  useEffect(() => {
    if (route !== 'activity' || !key) return;
    const now = Date.now();
    try { localStorage.setItem(key, String(now)); } catch {}
    setLastSeen(now);
  }, [route, key]);

  return data.activity.filter((a) => {
    const t = new Date(a.time).getTime();
    return Number.isFinite(t) && t > lastSeen;
  }).length;
}

export function Sidebar({ route, setRoute, onSwitchWorkspace, counts, mobileOpen, onMobileClose }) {
  const { currentWorkspace: brand, currentWorkspaceId, data, myRole, division, setDivision } = useWorkspace();
  const canCreateTask = myRole === 'owner' || myRole === 'admin' || myRole === 'manager' || myRole === 'member';
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const unreadActivity = useActivityUnread(currentWorkspaceId, route);

  if (!brand) return (
    <>
      {mobileOpen && <div className="sidebar-backdrop" onClick={onMobileClose} />}
      <aside className={`sidebar${mobileOpen ? ' mobile-open' : ''}`} />
    </>
  );

  const closeAndNav = (id) => { setRoute(id); onMobileClose?.(); };

  const navMain = [
    { id: 'dashboard', label: 'Dashboard', icon: <I.home size={16} /> },
    { id: 'mytasks',   label: 'My Tasks',  icon: <I.task size={16} />, count: counts.myTasks },
    { id: 'projects',  label: 'Projects',  icon: <I.folder size={16} />, count: counts.projects },
    { id: 'kanban',    label: 'Board',     icon: <I.kanban size={16} /> },
    { id: 'calendar',  label: 'Calendar',  icon: <I.calendar size={16} /> },
  ];
  const navWork = [
    { id: 'team',      label: 'Team',       icon: <I.team size={16} /> },
    { id: 'templates', label: 'Templates',  icon: <I.template size={16} /> },
    { id: 'activity',  label: 'Activity',   icon: <I.activity size={16} /> },
  ];

  const me = data.members[0];

  return (
    <>
    {mobileOpen && <div className="sidebar-backdrop" onClick={onMobileClose} />}
    <aside className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}>
      {/* App mark */}
      <div style={{ padding: '14px 18px 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 22, height: 22, borderRadius: 5, background: '#1a1d24', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 10.5, letterSpacing: '-0.02em' }}>CC</div>
        <span style={{ fontWeight: 600, letterSpacing: '-0.01em', fontSize: 13.5 }}>Command Center</span>
      </div>

      {/* Workspace brand pill */}
      <button className="brand-pill" onClick={onSwitchWorkspace} title="Workspace wechseln">
        <div className="brand-mark">{brand.initials}</div>
        <div>
          <div className="brand-name">{brand.name}</div>
          <div className="brand-sub">{(brand.sub || '').split('·')[1]?.trim() || 'Workspace'}</div>
        </div>
        <span className="caret"><I.caret size={14} /></span>
      </button>

      {/* Quick add — member+ only */}
      {canCreateTask && (
        <div style={{ padding: '0 12px 8px' }}>
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setNewTaskOpen(true)}>
            <span className="row gap-2"><I.plus size={14} /> New Task</span>
            <span style={{ display: 'flex', gap: 2 }}><Kbd>⌘</Kbd><Kbd>N</Kbd></span>
          </button>
        </div>
      )}
      <NewTaskModal
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        onNeedProject={() => setRoute('projects')}
      />

      {/* Main nav */}
      <nav style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── Work ─────────────────────────────────────────────── */}
        <div className="nav-section">Work</div>
        {navMain.map(n => (
          <div key={n.id} className={`nav-item ${route === n.id ? 'active' : ''}`} onClick={() => closeAndNav(n.id)}>
            {n.icon}
            <span>{n.label}</span>
            {n.count != null && <span className="nav-count">{n.count}</span>}
          </div>
        ))}

        {/* ── Podcast ───────────────────────────────────────────── */}
        {brand.capabilities?.podcast !== false && (
          <>
            <div className="nav-section">Podcast</div>
            <div className={`nav-item ${route === 'podcast' ? 'active' : ''}`} onClick={() => closeAndNav('podcast')}>
              <I.mic size={16} />
              <span>Podcast Hub</span>
            </div>
            <div className={`nav-item ${route === 'pipeline' ? 'active' : ''}`} onClick={() => closeAndNav('pipeline')}>
              <I.kanban size={16} />
              <span>Episode Pipeline</span>
            </div>
          </>
        )}

        {/* ── Events ────────────────────────────────────────────── */}
        {brand.capabilities?.events && (
          <>
            <div className="nav-section">Events</div>
            <div className={`nav-item ${route === 'eventhub' ? 'active' : ''}`} onClick={() => closeAndNav('eventhub')}>
              <I.calendar size={16} />
              <span>Event Hub</span>
            </div>
            <div className={`nav-item ${route === 'eventpipeline' ? 'active' : ''}`} onClick={() => closeAndNav('eventpipeline')}>
              <I.kanban size={16} />
              <span>Event Pipeline</span>
            </div>
          </>
        )}

        {/* ── Team ──────────────────────────────────────────────── */}
        <div className="nav-section">Team</div>
        {navWork.map(n => (
          <div key={n.id} className={`nav-item ${route === n.id ? 'active' : ''}`} onClick={() => closeAndNav(n.id)}>
            {n.icon}
            <span>{n.label}</span>
            {n.id === 'activity' && unreadActivity > 0 && (
              <span className="nav-count" style={{ background: 'var(--danger)', color: 'white', minWidth: 18, textAlign: 'center' }}>
                {unreadActivity > 9 ? '9+' : unreadActivity}
              </span>
            )}
          </div>
        ))}

        {/* ── Pinned Projects ───────────────────────────────────── */}
        {data.projects.filter(p => p.status !== 'Done').slice(0, 3).length > 0 && (
          <>
            <div className="nav-section">Pinned</div>
            {data.projects.filter(p => p.status !== 'Done').slice(0, 3).map(p => (
              <div key={p.id} className={`nav-item ${route === 'project:'+p.id ? 'active' : ''}`} onClick={() => closeAndNav('project:'+p.id)} style={{ paddingLeft: 12 }}>
                <span className="dot-indicator" style={{
                  background: p.division === 'events' ? '#e8780a' : p.division === 'podcast' ? 'var(--brand)' : 'var(--text-3)',
                  opacity: 0.7,
                }} />
                <span className="truncate" style={{ fontSize: 13 }}>{p.name}</span>
                {p.division !== 'general' && (
                  <span style={{ fontSize: 9.5, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
                    {p.division === 'podcast' ? 'POD' : 'EVT'}
                  </span>
                )}
              </div>
            ))}
          </>
        )}
      </nav>

      <div style={{ padding: 8, borderTop: '1px solid var(--border)' }}>
        <div className={`nav-item ${route === 'settings' ? 'active' : ''}`} onClick={() => setRoute('settings')}>
          <I.settings size={16} />
          <span>Settings</span>
        </div>
        <div className={`nav-item ${route === 'concept' ? 'active' : ''}`} onClick={() => setRoute('concept')}>
          <I.doc size={16} />
          <span>Concept Doc</span>
          <span className="nav-count" style={{ background: 'var(--bg-sunk)', color: 'var(--text-3)' }}>read</span>
        </div>
        {/* Sign-out: <form> POST works without JS so it survives even if the
            client bundle fails to hydrate. Reuses .nav-item styling so it
            sits naturally with the other bottom items, no new chrome. */}
        <form method="POST" action="/auth/logout" style={{ margin: 0 }}>
          <button
            type="submit"
            title="Sign out"
            className="nav-item"
            style={{
              width: '100%',
              textAlign: 'left',
              background: 'none',
              border: 0,
              cursor: 'pointer',
              font: 'inherit',
              color: 'inherit',
            }}
          >
            <I.x size={16} />
            <span>Sign out</span>
          </button>
        </form>
        {me && (
          <div className="nav-item" style={{ marginTop: 4 }}>
            <Avatar user={me} />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{me.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{me.role}</span>
            </div>
          </div>
        )}
      </div>
    </aside>
    </>
  );
}

export function Topbar({ openCmdK, breadcrumb, setRoute, onOpenSidebar, onOpenTask }) {
  const { currentWorkspace: brand, currentWorkspaceId, myRole, realtimeStatus } = useWorkspace();
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [notifOpen, setNotifOpen]     = useState(false);
  const bellRef = useRef(null);
  const notifCount = useNotificationCount();

  return (
    <div className="topbar">
      <NewTaskModal
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        onNeedProject={() => setRoute && setRoute('projects')}
      />
      {/* Hamburger — mobile only */}
      <button className="btn btn-icon btn-quiet topbar-hamburger" onClick={onOpenSidebar} title="Navigation öffnen">
        <I.menu size={18} />
      </button>

      {/* Logotype + Breadcrumb */}
      <div className="row gap-2" style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)', letterSpacing: '-0.02em', flexShrink: 0 }}>
          Command Center
        </span>
        {breadcrumb && (
          <React.Fragment>
            <span style={{ color: 'var(--border-strong)', fontSize: 16, fontWeight: 300 }}>/</span>
            <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-3)' }} className="truncate">{breadcrumb}</span>
          </React.Fragment>
        )}
      </div>

      {/* Search trigger */}
      <button
        onClick={openCmdK}
        className="row gap-2 topbar-search"
        style={{
          height: 34, padding: '0 12px', minWidth: 260,
          border: '1px solid var(--border-strong)', borderRadius: 8,
          background: '#ffffff', color: 'var(--text-3)', fontSize: 13,
          justifyContent: 'space-between',
        }}
      >
        <span className="row gap-2">
          <I.search size={14} />
          Suche Tasks, Projekte, Episoden…
        </span>
        <span className="row gap-2">
          {realtimeStatus === 'live' && (
            <span
              title="Live-Sync aktiv"
              style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--success)', flexShrink: 0, display: 'inline-block' }}
            />
          )}
          {realtimeStatus === 'error' && (
            <span
              title="Verbindung unterbrochen — Änderungen werden nicht live übertragen"
              style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--danger)', flexShrink: 0, display: 'inline-block' }}
            />
          )}
          <span className="topbar-search-hint" style={{ display: 'flex', gap: 2 }}><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
        </span>
      </button>

      <div ref={bellRef} style={{ position: 'relative' }}>
        <button
          className="btn btn-icon btn-quiet"
          title="Benachrichtigungen"
          onClick={() => setNotifOpen((o) => !o)}
          style={{ position: 'relative' }}
        >
          <I.bell size={16} />
          {notifCount > 0 && (
            <span style={{
              position: 'absolute', top: 3, right: 3,
              minWidth: notifCount > 9 ? 14 : 10,
              height: notifCount > 9 ? 14 : 10,
              borderRadius: 999,
              background: 'var(--danger)',
              border: '1.5px solid var(--bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 700, color: '#fff',
              lineHeight: 1,
            }}>
              {notifCount > 9 ? '9+' : notifCount > 1 ? notifCount : ''}
            </span>
          )}
        </button>
        {notifOpen && (
          <NotificationsPanel
            onClose={() => setNotifOpen(false)}
            onOpenTask={(taskId, projectId) => {
              setNotifOpen(false);
              onOpenTask?.(taskId, projectId);
            }}
            setRoute={(r) => { setNotifOpen(false); setRoute?.(r); }}
          />
        )}
      </div>
      {(myRole !== 'viewer') && (
        <button className="btn btn-brand btn-sm" onClick={() => setNewTaskOpen(true)}>
          <I.plus size={14} /> New
        </button>
      )}
    </div>
  );
}
