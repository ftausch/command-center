'use client';
// Kanban Board

import { useState, useMemo } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Avatar, Badge, PriorityBadge } from '@/components/ui';
import { dueLabel, kColColor } from '@/lib/utils';
import { NewTaskModal } from '@/components/NewTaskModal';

const KANBAN_COLS = ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'];

export function KanbanScreen({ setRoute }) {
  const { currentWorkspace: brand, data } = useWorkspace();
  const [projectFilter, setProjectFilter] = useState('all');
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  const tasks = useMemo(() => {
    let r = data.tasks;
    if (projectFilter !== 'all') r = r.filter((t) => t.projectId === projectFilter);
    return r;
  }, [data.tasks, projectFilter]);

  const grouped = useMemo(() => {
    const g = {};
    KANBAN_COLS.forEach((c) => (g[c] = []));
    g['Blocked'] = [];
    tasks.forEach((t) => {
      if (t.status === 'Blocked') g['Blocked'].push(t);
      else (g[t.status] = g[t.status] || []).push(t);
    });
    return g;
  }, [tasks]);

  return (
    <div className="page fade-in" style={{ paddingBottom: 24 }}>
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2"><Badge kind="brand" dot>{brand?.name}</Badge></div>
          <h1 className="h1">Board</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Status-Spalten über alle Projekte.
          </p>
        </div>
        <div className="row gap-2">
          <select className="input" style={{ width: 220, height: 32 }} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="all">Alle Projekte ({data.projects.length})</option>
            {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" disabled title="Noch nicht verfügbar">Group: Status <I.chevronDown size={12} /></button>
          <button className="btn btn-brand btn-sm" onClick={() => setNewTaskOpen(true)}><I.plus size={13} /> New Task</button>
        </div>
      </div>

      <NewTaskModal
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        initialProjectId={projectFilter !== 'all' ? projectFilter : undefined}
        onNeedProject={() => setRoute('projects')}
      />

      <div className="row gap-2 mb-4 wrap">
        <span className="meta">Filter:</span>
        <button className="chip active" disabled title="Filter kommen bald">Alle <span className="count">{tasks.length}</span></button>
        <button className="chip" disabled title="Filter kommen bald"><span className="dot-indicator danger" /> High <span className="count">{tasks.filter((t) => t.priority === 'High').length}</span></button>
        <button className="chip" disabled title="Filter kommen bald">Assignee: Me</button>
        <button className="chip" disabled title="Filter kommen bald">Has Slack</button>
        <button className="chip" disabled title="Filter kommen bald"><I.filter size={11} /> Mehr</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(260px, 1fr))', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
        {KANBAN_COLS.map((col) => (
          <KColumn key={col} title={col} tasks={grouped[col] || []} blocked={col === 'In Progress' ? grouped['Blocked'] : null} setRoute={setRoute} />
        ))}
      </div>
    </div>
  );
}

function KColumn({ title, tasks, blocked, setRoute }) {
  const allTasks = blocked ? [...tasks, ...(blocked || [])] : tasks;
  return (
    <div style={{ background: 'transparent', minHeight: 400 }}>
      <div className="row between" style={{ padding: '8px 4px 10px' }}>
        <div className="row gap-2">
          <span className="dot-indicator" style={{ background: kColColor(title) }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.005em' }}>{title}</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{allTasks.length}</span>
        </div>
        <button
          className="btn btn-icon btn-sm btn-quiet"
          disabled
          title="Per-Spalten-Anlage kommt bald — bis dahin oben '+ New Task' nutzen"
        ><I.plus size={13} /></button>
      </div>

      <div className="col gap-2">
        {allTasks.map((t) => <KCard key={t.id} task={t} setRoute={setRoute} />)}
        {allTasks.length === 0 && (
          <div style={{
            padding: 14, borderRadius: 8, border: '1.5px dashed var(--border)',
            color: 'var(--text-4)', fontSize: 12, textAlign: 'center',
          }}>
            Leer.
          </div>
        )}
      </div>
    </div>
  );
}

function KCard({ task, setRoute }) {
  const { data } = useWorkspace();
  const a = data.members.find((u) => u.id === task.assignee);
  const p = data.projects.find((pr) => pr.id === task.projectId);
  const waiting = data.members.find((u) => u.id === task.waitingOn);
  const td = dueLabel(task.due);
  return (
    <div
      onClick={() => setRoute('project:' + task.projectId)}
      style={{
        background: 'var(--bg-elev)',
        border: `1px solid ${task.status === 'Blocked' ? 'var(--danger-border)' : 'var(--border)'}`,
        borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
        boxShadow: 'var(--shadow-sm)',
        transition: 'border-color 0.12s, transform 0.12s',
      }}
    >
      {task.status === 'Blocked' && (
        <div className="row gap-1 mb-2" style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 500 }}>
          <I.block size={11} /> Blocked
        </div>
      )}
      <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.35, marginBottom: 6 }}>{task.title}</div>
      {(task.blocker || waiting) && (
        <div className="meta mb-2" style={{ fontSize: 11.5 }}>
          {task.blocker || 'Wartet auf ' + waiting?.name}
        </div>
      )}
      <div className="row gap-2" style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>
        <span className="truncate" style={{ flex: 1 }}>{p?.name}</span>
      </div>
      <div className="row between">
        <div className="row gap-2">
          {a && <Avatar user={a} />}
          <PriorityBadge priority={task.priority} />
        </div>
        <span className={`badge ${td.danger ? 'danger' : td.today ? 'warning' : 'ghost'}`}>{td.text}</span>
      </div>
    </div>
  );
}
