'use client';
// Projects list screen

import { useState, useMemo } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { DivisionSwitcher, useDivisionFilter } from '@/components/DivisionSwitcher';
import { I } from '@/components/icons';
import { Avatar, AvatarStack, Badge, PriorityBadge, Progress, StatusBadge } from '@/components/ui';
import { dueLabel, projectProgress, projectHealthScore, eventHealthColor, statusColor } from '@/lib/utils';
import { NewProjectModal } from '@/components/NewProjectModal';
import { SavedViewsButton } from '@/components/SavedViews';
import { QuickActions } from '@/components/QuickActions';
import { CAN } from '@/lib/roles';

const DIVISION_DOT = { podcast: 'var(--brand)', events: '#e8780a', general: 'var(--text-4)' };

export function ProjectsScreen({ setRoute }) {
  const { currentWorkspace: brand, currentWorkspaceId, data, myRole } = useWorkspace();
  const filterByDivision = useDivisionFilter();
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const currentView = { statusFilter, search };
  const applyView = (v) => {
    if (v.statusFilter) setStatusFilter(v.statusFilter);
    if (v.search !== undefined) setSearch(v.search);
  };

  const [showArchive, setShowArchive] = useState(false);
  const all = filterByDivision(data.projects).filter(p => showArchive ? p.status === 'Done' : p.status !== 'Done');
  const allTasks = data.tasks;
  const filtered = useMemo(() => {
    let r = all;
    if (statusFilter !== 'All' && !showArchive) r = r.filter((p) => p.status === statusFilter);
    if (search.trim()) r = r.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    return r;
  }, [all, statusFilter, search, showArchive]);

  const counts = {
    All: all.length,
    'In Progress': all.filter((p) => p.status === 'In Progress').length,
    Planning: all.filter((p) => p.status === 'Planning').length,
    Review: all.filter((p) => p.status === 'Review').length,
    Blocked: all.filter((p) => p.status === 'Blocked').length,
    Done: all.filter((p) => p.status === 'Done').length,
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2">
            <Badge kind="brand" dot>{brand?.name}</Badge>
          </div>
          <div className="row gap-3 items-center" style={{ flexWrap: 'wrap', marginBottom: 4 }}>
            <h1 className="h1" style={{ margin: 0 }}>Projects</h1>
            <DivisionSwitcher />
          </div>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Alle Projekte dieses Workspace. Episoden, Newsletter, Events.
          </p>
        </div>
        <div className="row gap-2">
          <input className="input" placeholder="Projekt suchen…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220, height: 32 }} />
          {CAN.createProject(myRole) && (
            <button className="btn btn-brand btn-sm" onClick={() => setCreateOpen(true)}><I.plus size={13} /> New Project</button>
          )}
        </div>
      </div>

      <NewProjectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(p) => setRoute('project:' + p.id)}
      />

      <div className="row gap-2 mb-4 wrap">
        {Object.entries(counts).map(([s, c]) => (
          <button key={s} className={`chip ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
            {s !== 'All' && <span className="dot-indicator" style={{ background: statusColor(s) }} />}
            {s} <span className="count">{c}</span>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          className={`chip${showArchive ? ' active' : ''}`}
          onClick={() => { setShowArchive(a => !a); setStatusFilter('All'); }}
        >
          📦 Archiv {showArchive && <span className="count">{filterByDivision(data.projects).filter(p=>p.status==='Done').length}</span>}
        </button>
        <SavedViewsButton workspaceId={currentWorkspaceId} currentView={currentView} onApply={applyView} />
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Status</th>
              <th>Health</th>
              <th>Phase</th>
              <th>Progress</th>
              <th>Priority</th>
              <th>Owner</th>
              <th>Team</th>
              <th>Deadline</th>
              <th></th>
              <th>Slack</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                  {search.trim()
                    ? 'Keine Projekte gefunden.'
                    : all.length === 0
                      ? CAN.createProject(myRole)
                        ? 'Noch keine Projekte. Klicke "+ New Project" um zu starten.'
                        : 'Du bist noch keinem Projekt zugewiesen. Bitte einen Manager, dich zu einem Projekt hinzuzufügen.'
                      : 'Keine Projekte in dieser Kategorie.'}
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const team = (p.team ?? [])
                .map((id) => data.members.find((u) => u.id === id))
                .filter(Boolean);
              const owner = data.members.find((u) => u.id === p.owner);
              const phases = data.phases;
              const due = dueLabel(p.due);
              const projTasks = allTasks.filter((t) => t.projectId === p.id);
              const pProgress = projectProgress(projTasks);
              const health = p.status !== 'Done' ? projectHealthScore(p, projTasks) : null;
              return (
                <tr key={p.id} onClick={() => setRoute('project:' + p.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ minWidth: 240 }}>
                    <div className="row gap-2 items-center">
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      {p.division && p.division !== 'general' && (
                        <span style={{
                          fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em',
                          textTransform: 'uppercase', padding: '1px 6px', borderRadius: 4,
                          background: p.division === 'events' ? '#fff4e6' : 'var(--brand-soft)',
                          color: p.division === 'events' ? '#e8780a' : 'var(--brand)',
                        }}>{p.division === 'events' ? 'Event' : 'Podcast'}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{p.type}</div>
                  </td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>
                    {health ? (
                      <span
                        title={health.reasons.length > 0 ? health.reasons.join('\n') : 'Alles gut'}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 11.5, fontWeight: 600,
                          color: eventHealthColor(health.score),
                          cursor: health.reasons.length > 0 ? 'help' : 'default',
                        }}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: eventHealthColor(health.score), display: 'inline-block', flexShrink: 0 }} />
                        {health.score === 'green' ? 'Gut' : health.score === 'yellow' ? 'Warnung' : 'Kritisch'}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11.5, color: 'var(--text-4)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
                      {phases[p.phaseIdx]}
                      <span style={{ color: 'var(--text-4)' }}> · {p.phaseIdx + 1}/{phases.length}</span>
                    </span>
                  </td>
                  <td style={{ minWidth: 140 }}>
                    <div className="row gap-2 items-center">
                      <div style={{ flex: 1 }}><Progress value={pProgress} brand /></div>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', minWidth: 30, textAlign: 'right' }}>{pProgress}%</span>
                    </div>
                  </td>
                  <td><PriorityBadge priority={p.priority} /></td>
                  <td>
                    {owner ? (
                      <div className="row gap-2"><Avatar user={owner} /><span style={{ fontSize: 12.5 }}>{owner.name.split(' ')[0]}</span></div>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-4)' }}>—</span>
                    )}
                  </td>
                  <td><AvatarStack users={team} max={3} /></td>
                  <td><span className={`badge ${due.danger ? 'danger' : 'ghost'}`}>{due.text}</span></td>
                  <td onClick={e => e.stopPropagation()}>
                    <QuickActions actions={[
                      { label: 'Öffnen', icon: '↗', onClick: () => setRoute('project:' + p.id) },
                      { label: 'Kanban', icon: '📋', onClick: () => setRoute('kanban') },
                      { label: 'Calendar', icon: '📅', onClick: () => setRoute('calendar') },
                    ]} />
                  </td>
                  <td>
                    {p.slackConnected ? (
                      <span className="row gap-1" style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        <I.slack size={12} /> <span className="mono">{p.slackChannel}</span>
                      </span>
                    ) : (
                      <span className="badge ghost" style={{ fontSize: 10.5 }}>not connected</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
