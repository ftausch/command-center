'use client';
// Projects list screen

import { useState, useMemo } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Avatar, AvatarStack, Badge, PriorityBadge, Progress, StatusBadge } from '@/components/ui';
import { dueLabel, statusColor } from '@/lib/utils';
import { NewProjectModal } from '@/components/NewProjectModal';

export function ProjectsScreen({ setRoute }) {
  const { currentWorkspace: brand, data } = useWorkspace();
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const all = data.projects;
  const filtered = useMemo(() => {
    let r = all;
    if (statusFilter !== 'All') r = r.filter((p) => p.status === statusFilter);
    if (search.trim()) r = r.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    return r;
  }, [all, statusFilter, search]);

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
          <h1 className="h1">Projects</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Alle Projekte dieses Workspace. Episoden, Newsletter, Design, Clips.
          </p>
        </div>
        <div className="row gap-2">
          <input className="input" placeholder="Projekt suchen…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220, height: 32 }} />
          <button className="btn btn-brand btn-sm" onClick={() => setCreateOpen(true)}><I.plus size={13} /> New Project</button>
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
        <button className="chip" disabled title="Noch nicht verfügbar">View: List <I.chevronDown size={11} /></button>
        <button className="chip" disabled title="Noch nicht verfügbar">Sort: Deadline <I.chevronDown size={11} /></button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Status</th>
              <th>Phase</th>
              <th>Progress</th>
              <th>Priority</th>
              <th>Owner</th>
              <th>Team</th>
              <th>Deadline</th>
              <th>Slack</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const team = p.team
                .map((id) => data.members.find((u) => u.id === id))
                .filter(Boolean);
              const owner = data.members.find((u) => u.id === p.owner);
              const phases = data.phases;
              const due = dueLabel(p.due);
              return (
                <tr key={p.id} onClick={() => setRoute('project:' + p.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ minWidth: 240 }}>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{p.type}</div>
                  </td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
                      {phases[p.phaseIdx]}
                      <span style={{ color: 'var(--text-4)' }}> · {p.phaseIdx + 1}/{phases.length}</span>
                    </span>
                  </td>
                  <td style={{ minWidth: 140 }}>
                    <div className="row gap-2 items-center">
                      <div style={{ flex: 1 }}><Progress value={p.progress} brand /></div>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', minWidth: 30, textAlign: 'right' }}>{p.progress}%</span>
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
