'use client';
// Kanban Board — mit Drag & Drop via @dnd-kit/core.
//
// Drag-Mechanik:
//   - PointerSensor mit 8px activation distance: kurze Berührungen = Click
//     (Drawer öffnen), längere Bewegung = Drag (Status wechseln).
//   - DragOverlay rendert eine schwebende Karte; die Quell-Karte wird halbtransparent.
//   - Drop auf eine andere Spalte → changeTaskStatus / markTaskDone.
//   - Blocked-Tasks können per Drag in jede andere Spalte verschoben werden.

import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { DivisionSwitcher, useDivisionFilter } from '@/components/DivisionSwitcher';
import { I } from '@/components/icons';
import { Avatar, Badge, PriorityBadge } from '@/components/ui';
import { dueLabel, kColColor } from '@/lib/utils';
import { changeTaskStatus, markTaskDone } from '@/lib/actions/tasks';
import { NewTaskModal } from '@/components/NewTaskModal';
import { TaskDrawer } from '@/components/TaskDrawer';

const KANBAN_COLS = ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'];

export function KanbanScreen({ setRoute }) {
  const {
    currentWorkspace: brand,
    currentWorkspaceId: workspaceId,
    data,
    me,
    updateTaskInCache,
    pushActivity,
  } = useWorkspace();
  const filterByDivision = useDivisionFilter();

  const [projectFilter, setProjectFilter] = useState('all');
  const [sprintFilter,  setSprintFilter]  = useState('all');
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [drawerTask, setDrawerTask] = useState(null);
  const [activeFilters, setActiveFilters] = useState(new Set());

  // ── DnD state ─────────────────────────────────────────────────────────────
  const [activeTask, setActiveTask] = useState(null);  // task being dragged
  const [overColId, setOverColId] = useState(null);    // column being hovered

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragStart = ({ active }) => {
    const task = data.tasks.find((t) => t.id === active.id);
    setActiveTask(task ?? null);
  };

  const handleDragOver = ({ over }) => {
    setOverColId(over?.id ?? null);
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveTask(null);
    setOverColId(null);
    if (!over) return;

    const task = data.tasks.find((t) => t.id === active.id);
    if (!task) return;

    const fromStatus = task.status;
    const toStatus = over.id;
    if (fromStatus === toStatus) return;

    // Optimistic update so the UI feels instant.
    updateTaskInCache(task.id, { status: toStatus, blocker: toStatus !== 'Blocked' ? null : task.blocker });

    if (toStatus === 'Done') {
      const r = await markTaskDone({ taskId: task.id, workspaceId, from: fromStatus });
      if (!r.ok) { updateTaskInCache(task.id, { status: fromStatus }); return; }
      if (r.activity) pushActivity(r.activity);
    } else {
      const r = await changeTaskStatus({ taskId: task.id, workspaceId, from: fromStatus, to: toStatus });
      if (!r.ok) { updateTaskInCache(task.id, { status: fromStatus }); return; }
      if (r.activity) pushActivity(r.activity);
    }
  };

  // ── Filters ───────────────────────────────────────────────────────────────
  const toggleFilter = (id) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const divisionProjects = useMemo(() =>
    filterByDivision(data.projects),
  [data.projects, filterByDivision]);

  const tasks = useMemo(() => {
    const projectIds = new Set(divisionProjects.map((p) => p.id));
    let r = data.tasks.filter((t) => projectIds.has(t.projectId));
    if (projectFilter !== 'all') r = r.filter((t) => t.projectId === projectFilter);
    if (activeFilters.has('high')) r = r.filter((t) => t.priority === 'High');
    if (activeFilters.has('me'))   r = r.filter((t) => t.assignee === me?.id);
    if (activeFilters.has('slack')) {
      const slackProjects = new Set(data.projects.filter((p) => p.slackConnected).map((p) => p.id));
      r = r.filter((t) => slackProjects.has(t.projectId));
    }
    if (sprintFilter !== 'all') {
      r = sprintFilter === 'none' ? r.filter(t => !t.sprintId) : r.filter(t => t.sprintId === sprintFilter);
    }
    return r;
  }, [data.tasks, data.projects, projectFilter, activeFilters, me, sprintFilter]);

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

  const allFilteredCount = data.tasks.filter(
    (t) => projectFilter === 'all' || t.projectId === projectFilter,
  ).length;

  return (
    <div className="page fade-in" style={{ paddingBottom: 24 }}>
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2"><Badge kind="brand" dot>{brand?.name}</Badge></div>
          <div className="row gap-3 items-center" style={{ flexWrap: 'wrap', marginBottom: 4 }}>
            <h1 className="h1" style={{ margin: 0 }}>Board</h1>
            <DivisionSwitcher />
          </div>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Status-Spalten über alle Projekte. Karte ziehen um Status zu wechseln.
          </p>
        </div>
        <div className="row gap-2">
          <select className="input" style={{ width: 220, height: 32 }} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="all">Alle Projekte ({divisionProjects.length})</option>
            {divisionProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn btn-brand btn-sm" onClick={() => setNewTaskOpen(true)}><I.plus size={13} /> New Task</button>
        </div>
      </div>

      <NewTaskModal
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        initialProjectId={projectFilter !== 'all' ? projectFilter : undefined}
        onNeedProject={() => setRoute('projects')}
      />
      <TaskDrawer
        taskId={drawerTask?.taskId ?? null}
        projectId={drawerTask?.projectId ?? null}
        onClose={() => setDrawerTask(null)}
      />

      {/* Filter chips */}
      <div className="row gap-2 mb-4 wrap">
        <span className="meta">Filter:</span>
        <button className={`chip ${activeFilters.size === 0 ? 'active' : ''}`} onClick={() => setActiveFilters(new Set())}>
          Alle <span className="count">{allFilteredCount}</span>
        </button>
        <button className={`chip ${activeFilters.has('high') ? 'active' : ''}`} onClick={() => toggleFilter('high')}>
          <span className="dot-indicator danger" /> High <span className="count">{data.tasks.filter((t) => (projectFilter === 'all' || t.projectId === projectFilter) && t.priority === 'High').length}</span>
        </button>
        <button className={`chip ${activeFilters.has('me') ? 'active' : ''}`} onClick={() => toggleFilter('me')}>
          Assignee: Me
        </button>
        <button className={`chip ${activeFilters.has('slack') ? 'active' : ''}`} onClick={() => toggleFilter('slack')}>
          Has Slack
        </button>
        {(() => {
          const activeSprints = data.tasks
            .filter(t => t.sprintId)
            .map(t => t.sprintId)
            .filter((v, i, a) => a.indexOf(v) === i);
          if (activeSprints.length === 0) return null;
          return (
            <>
              <div style={{ width: 1, height: 20, background: 'var(--border-soft)' }} />
              <button className={`chip ${sprintFilter === 'all' ? 'active' : ''}`} onClick={() => setSprintFilter('all')}>Alle Sprints</button>
              <button className={`chip ${sprintFilter === 'none' ? 'active' : ''}`} onClick={() => setSprintFilter('none')}>Kein Sprint</button>
              {activeSprints.map(sid => (
                <button key={sid} className={`chip ${sprintFilter === sid ? 'active' : ''}`} onClick={() => setSprintFilter(sid)}>
                  Sprint: {sid.slice(0, 6)}…
                </button>
              ))}
            </>
          );
        })()}
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(260px, 1fr))', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {KANBAN_COLS.map((col) => (
            <KColumn
              key={col}
              title={col}
              tasks={grouped[col] || []}
              blocked={col === 'In Progress' ? grouped['Blocked'] : null}
              isOver={overColId === col}
              onOpenTask={(t) => setDrawerTask({ taskId: t.id, projectId: t.projectId })}
            />
          ))}
        </div>

        {/* Floating card while dragging */}
        <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
          {activeTask && <KCard task={activeTask} onOpen={() => {}} isOverlay />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// ── Droppable column ──────────────────────────────────────────────────────
function KColumn({ title, tasks, blocked, onOpenTask, isOver }) {
  const { setNodeRef } = useDroppable({ id: title });
  const allTasks = blocked ? [...tasks, ...(blocked || [])] : tasks;

  return (
    <div style={{ background: 'transparent', minHeight: 400 }}>
      <div className="row between" style={{ padding: '8px 4px 10px' }}>
        <div className="row gap-2">
          <span className="dot-indicator" style={{ background: kColColor(title) }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.005em' }}>{title}</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{allTasks.length}</span>
        </div>
        <button className="btn btn-icon btn-sm btn-quiet" disabled title="Oben '+ New Task' nutzen">
          <I.plus size={13} />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className="col gap-2"
        style={{
          minHeight: 80,
          borderRadius: 8,
          padding: 4,
          background: isOver ? 'var(--brand-soft)' : 'transparent',
          border: isOver ? '2px dashed var(--brand)' : '2px dashed transparent',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        {allTasks.map((t) => <KCard key={t.id} task={t} onOpen={() => onOpenTask(t)} />)}
        {allTasks.length === 0 && !isOver && (
          <div style={{ padding: 14, borderRadius: 8, border: '1.5px dashed var(--border)', color: 'var(--text-4)', fontSize: 12, textAlign: 'center' }}>
            Leer.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Draggable card ────────────────────────────────────────────────────────
function KCard({ task, onOpen, isOverlay }) {
  const { data } = useWorkspace();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: !!isOverlay,
  });

  const a = data.members.find((u) => u.id === task.assignee);
  const p = data.projects.find((pr) => pr.id === task.projectId);
  const waiting = data.members.find((u) => u.id === task.waitingOn);
  const td = dueLabel(task.due);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={isOverlay ? undefined : onOpen}
      style={{
        background: 'var(--bg-elev)',
        border: `1px solid ${task.status === 'Blocked' ? 'var(--danger-border)' : 'var(--border)'}`,
        borderRadius: 8,
        padding: '10px 12px',
        cursor: isDragging ? 'grabbing' : 'grab',
        boxShadow: isOverlay ? '0 8px 24px rgba(20,22,28,0.18)' : 'var(--shadow-sm)',
        opacity: isDragging ? 0.35 : 1,
        transform: isOverlay ? 'rotate(1.5deg)' : undefined,
        transition: isDragging ? 'none' : 'border-color 0.12s, box-shadow 0.12s',
        userSelect: 'none',
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
