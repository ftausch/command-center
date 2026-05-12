'use client';
// Sidebar — left nav with brand pill + nav sections; Topbar with breadcrumb + search

import React from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Avatar, Kbd } from '@/components/ui';

export function Sidebar({ route, setRoute, onSwitchWorkspace, counts }) {
  const { currentWorkspace: brand, data } = useWorkspace();

  if (!brand) return <aside className="sidebar" />;

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
    <aside className="sidebar">
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

      {/* Quick add */}
      <div style={{ padding: '0 12px 8px' }}>
        <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setRoute('quickadd')}>
          <span className="row gap-2"><I.plus size={14} /> New Task</span>
          <span style={{ display: 'flex', gap: 2 }}><Kbd>⌘</Kbd><Kbd>N</Kbd></span>
        </button>
      </div>

      {/* Main nav */}
      <nav style={{ flex: 1 }}>
        {navMain.map(n => (
          <div key={n.id} className={`nav-item ${route === n.id ? 'active' : ''}`} onClick={() => setRoute(n.id)}>
            {n.icon}
            <span>{n.label}</span>
            {n.count != null && <span className="nav-count">{n.count}</span>}
          </div>
        ))}

        <div className="nav-section">Workspace</div>
        {navWork.map(n => (
          <div key={n.id} className={`nav-item ${route === n.id ? 'active' : ''}`} onClick={() => setRoute(n.id)}>
            {n.icon}
            <span>{n.label}</span>
          </div>
        ))}

        <div className="nav-section">Pinned Projects</div>
        {data.projects.slice(0, 3).map(p => (
          <div key={p.id} className={`nav-item ${route === 'project:'+p.id ? 'active' : ''}`} onClick={() => setRoute('project:'+p.id)} style={{ paddingLeft: 12 }}>
            <span className="dot-indicator" style={{ background: 'var(--brand)', opacity: 0.6 }} />
            <span className="truncate" style={{ fontSize: 13 }}>{p.name}</span>
          </div>
        ))}
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
  );
}

export function Topbar({ openCmdK, breadcrumb }) {
  const { currentWorkspace: brand } = useWorkspace();

  return (
    <div className="topbar">
      {/* Breadcrumb */}
      <div className="row gap-2" style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: 'var(--text-3)', fontSize: 13 }}>{brand?.name}</span>
        {breadcrumb && (
          <React.Fragment>
            <span style={{ color: 'var(--text-4)' }}><I.chevron size={12} /></span>
            <span style={{ fontWeight: 500, fontSize: 13.5 }} className="truncate">{breadcrumb}</span>
          </React.Fragment>
        )}
      </div>

      {/* Search trigger */}
      <button
        onClick={openCmdK}
        className="row gap-2"
        style={{
          height: 32, padding: '0 10px', minWidth: 280,
          border: '1px solid var(--border)', borderRadius: 6,
          background: 'var(--bg-elev)', color: 'var(--text-3)', fontSize: 13,
          justifyContent: 'space-between',
        }}
      >
        <span className="row gap-2"><I.search size={14} /> Suche Tasks, Projekte, Personen…</span>
        <span style={{ display: 'flex', gap: 2 }}><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
      </button>

      <button className="btn btn-icon btn-quiet" title="Notifications">
        <I.bell size={16} />
      </button>
      <button className="btn btn-brand btn-sm">
        <I.plus size={14} /> New
      </button>
    </div>
  );
}
