'use client';
// Dashboard Overview screen

import { useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import {
  Avatar, AvatarStack, Badge, EmptyState,
  PriorityBadge, Progress, SlackCard, StatusBadge,
} from '@/components/ui';
import { daysUntil, dueLabel, eventColor, formatDate, formatDateLong } from '@/lib/utils';
import { markTaskDone, changeTaskStatus } from '@/lib/actions/tasks';

export function DashboardScreen({ setRoute }) {
  const { currentWorkspace: brand, data, me } = useWorkspace();

  const allTasks = data.tasks;
  const projects = data.projects;
  const events = data.calendarEvents;

  const open = allTasks.filter((t) => t.status !== 'Done');
  const dueToday = open.filter((t) => daysUntil(t.due) === 0);
  const overdue = open.filter((t) => daysUntil(t.due) < 0);
  const blocked = open.filter((t) => t.status === 'Blocked');
  const inReview = open.filter((t) => t.status === 'Review');
  const myOpen = me ? open.filter((t) => t.assignee === me.id) : [];
  const slackNotifs = data.slackNotifications;

  const activeProjects = projects.filter((p) => p.status !== 'Done' && p.status !== 'Planning');

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2">
            <Badge kind="brand" dot>{brand?.name}</Badge>
            <span style={{ color: 'var(--text-3)', fontSize: 12.5 }}>·</span>
            <span style={{ color: 'var(--text-3)', fontSize: 12.5 }}>Montag · {formatDateLong('2026-05-11')}</span>
          </div>
          <h1 className="h1">Guten Morgen, {me?.name?.split(' ')[0] ?? 'Fabian'}.</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14.5, margin: '6px 0 0' }}>
            {dueToday.length} Aufgaben heute fällig, {blocked.length} blockiert, {inReview.length} warten auf Review.
          </p>
        </div>
        <div className="row gap-2">
          <button className="btn btn-ghost btn-sm"><I.filter size={13} /> Filter</button>
          <button className="btn btn-ghost btn-sm">Diese Woche <I.chevronDown size={12} /></button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-4 gap-3 mb-6">
        <KPI label="Offene Aufgaben" value={open.length} trend="+4 ggü. letzter Woche" />
        <KPI label="Heute fällig" value={dueToday.length} trend={dueToday.length ? `${dueToday.length} unassigned: 0` : 'Alles im Plan'} tone={dueToday.length > 0 ? 'warn' : 'ok'} />
        <KPI label="Blockiert" value={blocked.length} trend={blocked.length ? 'Aufmerksamkeit nötig' : 'Keine Blocker'} tone={blocked.length > 0 ? 'bad' : 'ok'} />
        <KPI label="In Review" value={inReview.length} trend="3 davon ⩾ 24h" />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        {/* Left column */}
        <div className="col gap-4">
          {/* My focus today */}
          <section className="card">
            <div className="row between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
              <div>
                <div className="h3">Was du heute tun musst</div>
                <div className="meta mt-1">Priorisiert nach Deadline & Priorität</div>
              </div>
              <button className="btn btn-quiet btn-sm" onClick={() => setRoute('mytasks')}>Alle ansehen <I.arrowRight size={13} /></button>
            </div>
            <div>
              {myOpen.slice(0, 5).map((t) => (
                <FocusRow key={t.id} task={t} setRoute={setRoute} />
              ))}
              {myOpen.length === 0 && (
                <EmptyState icon={<I.check size={20} />} title="Inbox leer." body="Keine Tasks für dich heute. Genieß den Kaffee." />
              )}
            </div>
          </section>

          {/* Active Projects */}
          <section className="card">
            <div className="row between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
              <div className="h3">Aktive Projekte</div>
              <button className="btn btn-quiet btn-sm" onClick={() => setRoute('projects')}>Alle <I.arrowRight size={13} /></button>
            </div>
            <div>
              {activeProjects.slice(0, 4).map((p) => (
                <ProjectRow key={p.id} project={p} setRoute={setRoute} />
              ))}
            </div>
          </section>

          {/* Blocked / Needs attention */}
          <section className="card">
            <div className="row between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
              <div>
                <div className="h3 row gap-2"><I.alert size={15} color="var(--danger)" /> Braucht Aufmerksamkeit</div>
                <div className="meta mt-1">Blockiert oder überfällig</div>
              </div>
              <Badge kind="danger" dot>{blocked.length + overdue.length}</Badge>
            </div>
            <div>
              {[...blocked, ...overdue].slice(0, 4).map((t) => {
                const p = data.projects.find((pr) => pr.id === t.projectId);
                const u = data.members.find((m) => m.id === t.assignee);
                return (
                  <div key={t.id} style={{ padding: '12px 18px', borderTop: '1px solid var(--border-soft)' }} className="row gap-3">
                    <I.block size={14} color="var(--danger)" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }} className="truncate">{t.title}</div>
                      <div className="row gap-2 mt-1" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        <span>{p?.name}</span>
                        <span>·</span>
                        <span>{t.blocker || p?.blockedReason || 'Überfällig seit ' + Math.abs(daysUntil(t.due)) + 'd'}</span>
                      </div>
                    </div>
                    {u && <Avatar user={u} />}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="col gap-4">
          {/* Team workload */}
          <section className="card">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
              <div className="h3">Team-Auslastung</div>
              <div className="meta mt-1">Diese Woche · {brand?.name}</div>
            </div>
            <div style={{ padding: '8px 18px 16px' }}>
              {data.members.slice(0, 6).map((u) => {
                const userTasks = open.filter((t) => t.assignee === u.id);
                const load = Math.min(10, userTasks.length);
                const cells = Array.from({ length: 8 }).map((_, i) => i < load ? (load > 6 ? 'over' : 'filled') : '');
                return (
                  <div key={u.id} className="row gap-3" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-soft)' }}>
                    <Avatar user={u} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row between">
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</span>
                        <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{userTasks.length}</span>
                      </div>
                      <div className="workload mt-2">
                        {cells.map((c, i) => <span key={i} className={`workload-cell ${c}`} />)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Slack feed */}
          <section className="card">
            <div className="row between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
              <div>
                <div className="h3 row gap-2"><I.slack size={15} /> Slack Updates</div>
                <div className="meta mt-1">Aus #{brand?.id}-* Channels</div>
              </div>
              <Badge kind="success" dot>Connected</Badge>
            </div>
            <div className="col gap-2" style={{ padding: '12px 14px 16px' }}>
              {slackNotifs.length === 0 && (
                <EmptyState icon={<I.slack size={20} />} title="Keine neuen Slack-Updates" body="Sobald jemand in einem Workspace-Channel schreibt, taucht es hier auf." />
              )}
              {slackNotifs.map((n, i) => <SlackCard key={i} notif={n} />)}
            </div>
          </section>

          {/* Upcoming */}
          <section className="card">
            <div className="row between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
              <div className="h3">Diese Woche im Kalender</div>
              <button className="btn btn-quiet btn-sm" onClick={() => setRoute('calendar')}>Kalender <I.arrowRight size={13} /></button>
            </div>
            <div>
              {events.slice(0, 5).map((ev, i) => (
                <div key={i} className="row gap-3" style={{ padding: '10px 18px', borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)' }}>
                  <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-3)', minWidth: 50 }}>{formatDate(ev.date)}</div>
                  <span className="dot-indicator" style={{ background: eventColor(ev.type) }} />
                  <div style={{ flex: 1, fontSize: 13 }}>{ev.title}</div>
                  <span className="badge ghost" style={{ fontSize: 10.5 }}>{ev.type}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export const KPI = ({ label, value, trend, tone }) => (
  <div className="kpi">
    <div className="kpi-label">{label}</div>
    <div className="kpi-value mono">{value}</div>
    <div className={`kpi-trend ${tone === 'ok' ? 'up' : tone === 'bad' ? 'down' : ''}`}>{trend}</div>
  </div>
);

function FocusRow({ task, setRoute }) {
  const { data, currentWorkspaceId, updateTaskInCache, pushActivity } = useWorkspace();
  const p = data.projects.find((pr) => pr.id === task.projectId);
  const due = dueLabel(task.due);
  const [pending, setPending] = useState(false);

  // Wire the existing round button to toggle Done ↔ previous status. The
  // visual stays identical — we just attach an onClick.
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
    <div
      className="row gap-3"
      onClick={() => setRoute('project:' + task.projectId)}
      style={{ padding: '11px 18px', borderTop: '1px solid var(--border-soft)', cursor: 'pointer' }}
    >
      <button
        className="btn btn-icon btn-sm"
        onClick={toggleDone}
        disabled={pending}
        style={{ border: '1.5px solid var(--border-strong)', borderRadius: 999, width: 18, height: 18, padding: 0, background: 'transparent' }}
      >
        {task.status === 'Done' && <I.check size={11} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500 }} className="truncate">{task.title}</div>
        <div className="row gap-2 mt-1" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
          <span>{p?.name}</span>
          {task.tags?.length > 0 && <><span>·</span><span>{task.tags.join(', ')}</span></>}
        </div>
      </div>
      <PriorityBadge priority={task.priority} />
      <span className={`badge ${due.danger ? 'danger' : due.today ? 'warning' : 'ghost'}`} style={{ minWidth: 70, justifyContent: 'center' }}>{due.text}</span>
    </div>
  );
}

function ProjectRow({ project, setRoute }) {
  const { data } = useWorkspace();
  const team = project.team.map((id) => data.members.find((u) => u.id === id)).filter(Boolean);
  const due = dueLabel(project.due);
  return (
    <div
      className="row gap-3"
      onClick={() => setRoute('project:' + project.id)}
      style={{ padding: '13px 18px', borderTop: '1px solid var(--border-soft)', cursor: 'pointer' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row gap-2">
          <span style={{ fontSize: 14, fontWeight: 600 }} className="truncate">{project.name}</span>
          <StatusBadge status={project.status} />
        </div>
        <div className="row gap-3 mt-2" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
          <span>{project.type}</span>
          <span>·</span>
          <span>{project.slackChannel}</span>
        </div>
        <div className="row gap-3 mt-2 items-end">
          <div style={{ flex: 1, maxWidth: 220 }}>
            <Progress value={project.progress} brand />
          </div>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{project.progress}%</span>
        </div>
      </div>
      <div className="col gap-2 items-end">
        <span className={`badge ${due.danger ? 'danger' : 'ghost'}`}>{due.text}</span>
        <AvatarStack users={team} />
      </div>
    </div>
  );
}
