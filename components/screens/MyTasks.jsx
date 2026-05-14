'use client';
// My Tasks screen

import { useState, useMemo } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Badge, EmptyState, PriorityBadge, StatusBadge } from '@/components/ui';
import { daysUntil, dueLabel } from '@/lib/utils';
import {
  createTask,
  markTaskDone,
  changeTaskStatus,
  bulkUpdateTasks,
  bulkDeleteTasks,
} from '@/lib/actions/tasks';
import { NewTaskModal } from '@/components/NewTaskModal';
import { TaskDrawer } from '@/components/TaskDrawer';

export function MyTasksScreen({ setRoute }) {
  const {
    currentWorkspace: brand,
    currentWorkspaceId,
    data,
    me,
    addTask,
    updateTaskInCache,
    removeTask,
    pushActivity,
  } = useWorkspace();
  const [tab, setTab] = useState('all');
  const [groupBy, setGroupBy] = useState('project');
  const [filterPrio, setFilterPrio] = useState(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [quickAddPending, setQuickAddPending] = useState(false);
  const [quickAddError, setQuickAddError] = useState(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [drawerTask, setDrawerTask] = useState(null); // { taskId, projectId } | null
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkError, setBulkError] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Quick-add defaults the project to the first project of this workspace.
  // No project picker exists in the current UI, so we pick a sensible
  // default rather than introduce new markup.
  const defaultProjectId = data.projects[0]?.id;

  const submitQuickAdd = async () => {
    const title = quickAddTitle.trim();
    if (!title || !defaultProjectId) return;
    setQuickAddPending(true);
    setQuickAddError(null);
    const result = await createTask({
      workspaceId: currentWorkspaceId,
      projectId: defaultProjectId,
      title,
    });
    setQuickAddPending(false);
    if (result.ok && result.data) {
      addTask(result.data);
      if (result.activity) pushActivity(result.activity);
      setQuickAddTitle('');
    } else {
      setQuickAddError(result.error ?? 'Could not create task');
    }
  };

  const myTasks = useMemo(
    () => (me ? data.tasks.filter((t) => t.assignee === me.id) : []),
    [data.tasks, me],
  );

  const filtered = useMemo(() => {
    let r = myTasks;
    if (tab === 'today')   r = r.filter((t) => daysUntil(t.due) === 0 && t.status !== 'Done');
    if (tab === 'week')    r = r.filter((t) => daysUntil(t.due) >= 0 && daysUntil(t.due) <= 7 && t.status !== 'Done');
    if (tab === 'overdue') r = r.filter((t) => daysUntil(t.due) < 0 && t.status !== 'Done');
    if (tab === 'blocked') r = r.filter((t) => t.status === 'Blocked');
    if (tab === 'waiting') r = r.filter((t) => t.status === 'Review' || t.waitingOn);
    if (filterPrio) r = r.filter((t) => t.priority === filterPrio);
    return r;
  }, [myTasks, tab, filterPrio]);

  const counts = {
    all: myTasks.filter((t) => t.status !== 'Done').length,
    today: myTasks.filter((t) => daysUntil(t.due) === 0 && t.status !== 'Done').length,
    week: myTasks.filter((t) => daysUntil(t.due) >= 0 && daysUntil(t.due) <= 7 && t.status !== 'Done').length,
    overdue: myTasks.filter((t) => daysUntil(t.due) < 0 && t.status !== 'Done').length,
    blocked: myTasks.filter((t) => t.status === 'Blocked').length,
    waiting: myTasks.filter((t) => t.status === 'Review' || t.waitingOn).length,
  };

  const grouped = useMemo(() => {
    if (groupBy === 'project') {
      const groups = {};
      filtered.forEach((t) => {
        const p = data.projects.find((pr) => pr.id === t.projectId);
        const key = p?.name || 'Ohne Projekt';
        (groups[key] = groups[key] || []).push(t);
      });
      return groups;
    }
    if (groupBy === 'priority') {
      const groups = { High: [], Medium: [], Low: [] };
      filtered.forEach((t) => groups[t.priority]?.push(t));
      return groups;
    }
    return { Alle: filtered };
  }, [filtered, groupBy, data.projects]);

  const toggleSelect = (id) => setSelectedIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = (tasks) => {
    const ids = tasks.map((t) => t.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    setSelectedIds((s) => { const n = new Set(s); allSelected ? ids.forEach((id) => n.delete(id)) : ids.forEach((id) => n.add(id)); return n; });
  };

  const applyBulk = async (patch) => {
    setBulkPending(true); setBulkError(null);
    const r = await bulkUpdateTasks({ workspaceId: currentWorkspaceId, taskIds: [...selectedIds], patch });
    setBulkPending(false);
    if (!r.ok) { setBulkError(r.error); return; }
    [...selectedIds].forEach((id) => updateTaskInCache(id, patch));
    setSelectedIds(new Set());
  };

  const applyBulkDelete = async () => {
    if (!confirmBulkDelete) { setConfirmBulkDelete(true); return; }
    setBulkPending(true); setBulkError(null);
    const ids = [...selectedIds];
    const r = await bulkDeleteTasks({ workspaceId: currentWorkspaceId, taskIds: ids });
    setBulkPending(false);
    if (!r.ok) { setBulkError(r.error); setConfirmBulkDelete(false); return; }
    ids.forEach((id) => removeTask(id));
    setSelectedIds(new Set()); setConfirmBulkDelete(false);
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2">
            <Badge kind="brand" dot>{brand?.name}</Badge>
            <span style={{ color: 'var(--text-3)', fontSize: 12.5 }}>Deine persönliche Ansicht</span>
          </div>
          <h1 className="h1">My Tasks</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Alles, was dir zugewiesen ist — geordnet nach dem, was als Nächstes zählt.
          </p>
        </div>
        <div className="row gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setGroupBy(groupBy === 'project' ? 'priority' : groupBy === 'priority' ? 'flat' : 'project')}>Group: {groupBy === 'project' ? 'Project' : groupBy === 'priority' ? 'Priority' : 'Flat'} <I.chevronDown size={12} /></button>
          <button className="btn btn-brand btn-sm" onClick={() => setNewTaskOpen(true)}><I.plus size={13} /> Quick Add</button>
        </div>
      </div>

      <NewTaskModal
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        onNeedProject={() => setRoute('projects')}
      />

      <TaskDrawer
        taskId={drawerTask?.taskId ?? null}
        projectId={drawerTask?.projectId ?? null}
        onClose={() => setDrawerTask(null)}
      />

      <div className="tabs mb-4">
        {[
          { id: 'all', label: 'All', c: counts.all },
          { id: 'today', label: 'Today', c: counts.today },
          { id: 'week', label: 'This Week', c: counts.week },
          { id: 'overdue', label: 'Overdue', c: counts.overdue },
          { id: 'blocked', label: 'Blocked', c: counts.blocked },
          { id: 'waiting', label: 'Waiting on Feedback', c: counts.waiting },
        ].map((t) => (
          <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label} <span className="count">{t.c}</span>
          </div>
        ))}
      </div>

      <div className="row gap-2 mb-4 wrap">
        <span className="meta" style={{ marginRight: 4 }}>Filter:</span>
        {['High', 'Medium', 'Low'].map((p) => (
          <button key={p} className={`chip ${filterPrio === p ? 'active' : ''}`} onClick={() => setFilterPrio(filterPrio === p ? null : p)}>
            <span className="dot-indicator" style={{ background: p === 'High' ? 'var(--danger)' : p === 'Medium' ? 'var(--warning)' : 'var(--neutral)' }} />
            {p} <span className="count">{myTasks.filter((t) => t.priority === p && t.status !== 'Done').length}</span>
          </button>
        ))}
        <button className="chip" onClick={() => setGroupBy(groupBy === 'project' ? 'priority' : groupBy === 'priority' ? 'flat' : 'project')}>
          Group: {groupBy}
        </button>
        <button className="chip" disabled title="Noch nicht verfügbar">
          <I.filter size={12} /> Mehr Filter
        </button>
      </div>

      <div className="card mb-4" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <I.plus size={14} color="var(--text-3)" />
        <input
          className="input"
          placeholder="Quick add — Task-Titel eingeben…"
          style={{ border: 'none', height: 32 }}
          value={quickAddTitle}
          onChange={(e) => setQuickAddTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !quickAddPending) submitQuickAdd();
          }}
          disabled={quickAddPending || !defaultProjectId}
          title={defaultProjectId ? '' : 'Erst ein Projekt anlegen'}
        />
        <Badge kind="ghost">in {brand?.name}</Badge>
        <button
          className="btn btn-quiet btn-sm"
          onClick={submitQuickAdd}
          disabled={quickAddPending || !quickAddTitle.trim() || !defaultProjectId}
        >
          Detail öffnen <I.arrowRight size={12} />
        </button>
      </div>
      {quickAddError && (
        <div className="meta" style={{ color: 'var(--danger)', marginTop: -8, marginBottom: 12 }}>
          {quickAddError}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="card row gap-2 mb-3" style={{ padding: '8px 14px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{selectedIds.size} ausgewählt</span>
          <select className="input" style={{ height: 28, fontSize: 12.5, width: 140 }} disabled={bulkPending} onChange={(e) => e.target.value && applyBulk({ status: e.target.value }) && (e.target.value = '')}>
            <option value="">Status setzen…</option>
            {['Backlog','To Do','In Progress','Review','Blocked','Done'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input" style={{ height: 28, fontSize: 12.5, width: 130 }} disabled={bulkPending} onChange={(e) => e.target.value && applyBulk({ priority: e.target.value }) && (e.target.value = '')}>
            <option value="">Priority setzen…</option>
            {['High','Medium','Low'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          {confirmBulkDelete ? (
            <div className="row gap-2">
              <button className="btn btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }} onClick={applyBulkDelete} disabled={bulkPending}>{bulkPending ? '…' : 'Ja, löschen'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmBulkDelete(false)} disabled={bulkPending}>Abbrechen</button>
            </div>
          ) : (
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={applyBulkDelete} disabled={bulkPending}><I.x size={12} /> Löschen</button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedIds(new Set()); setConfirmBulkDelete(false); setBulkError(null); }} disabled={bulkPending}><I.x size={12} /></button>
          {bulkError && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{bulkError}</span>}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<I.check size={22} />} title="Nichts zu tun." body="Keine Tasks in dieser Ansicht. Wechsle den Tab oder lade die nächste Welle ein." />
        </div>
      ) : (
        Object.entries(grouped).filter(([_, ts]) => ts.length > 0).map(([group, tasks]) => {
          const allGroupSelected = tasks.every((t) => selectedIds.has(t.id));
          const someGroupSelected = tasks.some((t) => selectedIds.has(t.id));
          return (
            <section key={group} className="mb-4">
              <div className="row gap-2 mb-2" style={{ paddingLeft: 4 }}>
                <span className="label">{group}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{tasks.length}</span>
              </div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 24 }}>
                        <input type="checkbox" checked={allGroupSelected} ref={(el) => { if (el) el.indeterminate = someGroupSelected && !allGroupSelected; }} onChange={() => toggleSelectAll(tasks)} />
                      </th>
                      <th style={{ width: 30 }}></th>
                      <th>Task</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Project</th>
                      <th>Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        selected={selectedIds.has(t.id)}
                        onSelect={() => toggleSelect(t.id)}
                        onOpen={() => setDrawerTask({ taskId: t.id, projectId: t.projectId })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function TaskRow({ task, onOpen, selected, onSelect }) {
  const { data, currentWorkspaceId, updateTaskInCache, pushActivity } = useWorkspace();
  const p = data.projects.find((pr) => pr.id === task.projectId);
  const waiting = data.members.find((u) => u.id === task.waitingOn);
  const due = dueLabel(task.due);
  const [pending, setPending] = useState(false);

  // Toggle Done ↔ In Progress via the existing circle. Visual is unchanged
  // — the circle was already filled with brand color for Done.
  const toggleDone = async (e) => {
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    if (task.status === 'Done') {
      const result = await changeTaskStatus({
        taskId: task.id,
        workspaceId: currentWorkspaceId,
        from: 'Done',
        to: 'In Progress',
      });
      if (result.ok) {
        updateTaskInCache(task.id, { status: 'In Progress' });
        if (result.activity) pushActivity(result.activity);
      }
    } else {
      const result = await markTaskDone({
        taskId: task.id,
        workspaceId: currentWorkspaceId,
        from: task.status,
      });
      if (result.ok) {
        updateTaskInCache(task.id, { status: 'Done' });
        if (result.activity) pushActivity(result.activity);
      }
    }
    setPending(false);
  };

  return (
    <tr style={{ cursor: 'pointer', background: selected ? 'var(--bg-sunk)' : undefined }} onClick={onOpen}>
      <td onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={!!selected} onChange={onSelect} />
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        <span
          role="button"
          tabIndex={0}
          aria-pressed={task.status === 'Done'}
          onClick={toggleDone}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleDone(e); }}
          style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 999, border: '1.5px solid var(--border-strong)', background: task.status === 'Done' ? 'var(--brand)' : 'transparent', verticalAlign: 'middle', cursor: 'pointer' }}
        />
      </td>
      <td>
        <div style={{ fontWeight: 500 }}>{task.title}</div>
        {waiting && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>Wartet auf {waiting.name}</div>}
        {task.blocker && <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 2 }}><I.block size={11} /> {task.blocker}</div>}
      </td>
      <td><StatusBadge status={task.status} /></td>
      <td><PriorityBadge priority={task.priority} /></td>
      <td><span style={{ color: 'var(--text-2)' }}>{p?.name}</span></td>
      <td><span className={`badge ${due.danger ? 'danger' : due.today ? 'warning' : 'ghost'}`}>{due.text}</span></td>
    </tr>
  );
}
