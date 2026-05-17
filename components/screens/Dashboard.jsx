'use client';
// Dashboard Overview screen

import { useState, useMemo } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { DivisionSwitcher, useDivisionFilter } from '@/components/DivisionSwitcher';
import { I } from '@/components/icons';
import {
  Avatar, AvatarStack, Badge, EmptyState,
  PriorityBadge, Progress, SlackCard, StatusBadge,
} from '@/components/ui';
import { daysUntil, dueLabel, eventColor, formatDate, formatDateLong, parseDate, projectProgress } from '@/lib/utils';
import { markTaskDone, changeTaskStatus } from '@/lib/actions/tasks';

const WEEKDAY_LABEL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const SPECIALTY_LABEL = {
  host:      { icon: '🎙️', label: 'Host / Moderator' },
  editor:    { icon: '✂️', label: 'Cutter / Editor' },
  thumbnail: { icon: '🎨', label: 'Thumbnail Designer' },
  shownotes: { icon: '📝', label: 'Show Notes' },
  social:    { icon: '📱', label: 'Social Media' },
  audio:     { icon: '🎵', label: 'Audio Engineer' },
  manager:   { icon: '⚙️', label: 'Manager / Producer' },
};
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function greeting(name) {
  const h = new Date().getHours();
  const salut = h < 12 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend';
  return `${salut}, ${name}.`;
}

export function DashboardScreen({ setRoute, onOpenTask }) {
  const { currentWorkspace: brand, data, me } = useWorkspace();
  const filterByDivision = useDivisionFilter();

  const allTasks  = filterByDivision(data.tasks.map(t => ({
    ...t,
    division: data.projects.find(p => p.id === t.projectId)?.division ?? 'general',
  })));
  const projects  = data.projects;
  const open      = allTasks.filter((t) => t.status !== 'Done');
  const dueToday  = open.filter((t) => daysUntil(t.due) === 0);
  const overdue   = open.filter((t) => daysUntil(t.due) < 0);
  const blocked   = open.filter((t) => t.status === 'Blocked');
  const inReview  = open.filter((t) => t.status === 'Review');
  const myOpen    = me ? open.filter((t) => t.assignee === me.id) : [];
  const slackNotifs = data.slackNotifications;
  const activeProjects = projects.filter((p) => p.status !== 'Done');

  const now = new Date();
  const todayIso    = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayLabel  = `${WEEKDAY_LABEL[now.getDay()]}, ${formatDateLong(todayIso)}`;
  const firstName   = me?.name?.split(' ')[0] ?? 'Fabian';

  const completedThisWeek = useMemo(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    return data.activity.filter((a) => {
      const t = new Date(a.time).getTime();
      return a.icon === 'check' && Number.isFinite(t) && t >= cutoff;
    }).length;
  }, [data.activity]);

  // Critical tasks: overdue first, then due today, then high-priority — deduped
  const criticalTasks = useMemo(() => {
    const seen = new Set();
    const add = (t) => { if (!seen.has(t.id)) { seen.add(t.id); return true; } return false; };
    return [
      ...overdue.filter(add),
      ...dueToday.filter(add),
      ...open.filter((t) => t.priority === 'High' && add(t)),
    ].slice(0, 6);
  }, [overdue, dueToday, open]);

  const upcomingEvents = useMemo(() => {
    const nowMs = Date.now();
    const end   = nowMs + SEVEN_DAYS_MS;
    const evs   = [];
    allTasks.forEach((t) => {
      if (!t.due) return;
      const d = parseDate(t.due).getTime();
      if (d >= nowMs && d <= end) evs.push({ date: t.due, type: t.status === 'Review' ? 'review' : 'deadline', title: t.title, projectId: t.projectId });
    });
    projects.forEach((p) => {
      if (!p.due) return;
      const d = parseDate(p.due).getTime();
      if (d >= nowMs && d <= end) evs.push({ date: p.due, type: 'deadline', title: p.name, projectId: p.id });
    });
    return evs.sort((a, b) => a.date.localeCompare(b.date));
  }, [allTasks, projects]);

  return (
    <div className="page fade-in">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="page-head" style={{ paddingBottom: 20, marginBottom: 24 }}>
        <div>
          <div className="meta mb-2" suppressHydrationWarning>{todayLabel}</div>
          <div className="row gap-3 items-center" style={{ flexWrap: 'wrap', marginBottom: 4 }}>
            <h1 className="h1" style={{ fontSize: 28, margin: 0 }} suppressHydrationWarning>{greeting(firstName)}</h1>
            <DivisionSwitcher />
          </div>
          <div className="row gap-2 mt-2" style={{ flexWrap: 'wrap' }}>
            <p style={{ color: 'var(--text-2)', fontSize: 14, margin: 0 }}>
              Das ist dein Überblick für heute.
            </p>
            {me?.specialty && SPECIALTY_LABEL[me.specialty] && (
              <span style={{
                fontSize: 12.5, fontWeight: 500,
                color: 'var(--brand)',
                background: 'var(--brand-soft)',
                border: '1px solid transparent',
                borderRadius: 'var(--r-pill)',
                padding: '2px 10px',
              }}>
                {SPECIALTY_LABEL[me.specialty].icon} {SPECIALTY_LABEL[me.specialty].label}
              </span>
            )}
          </div>
        </div>
        <button className="btn btn-brand btn-sm" onClick={() => setRoute('projects')} style={{ alignSelf: 'flex-start' }}>
          <I.plus size={13} /> Neues Projekt
        </button>
      </div>

      {/* ── KPI row — 4 coloured stat cards ─────────────────────────────── */}
      <div className="grid grid-4 gap-3 mb-6">
        <StatCard
          icon={<I.alert size={18} />}
          label="Überfällig"
          value={overdue.length}
          color="var(--danger)"
          bg="var(--danger-bg)"
          onClick={() => setRoute('mytasks')}
        />
        <StatCard
          icon={<I.calendar size={18} />}
          label="Heute fällig"
          value={dueToday.length}
          color="var(--warning)"
          bg="var(--warning-bg)"
          onClick={() => setRoute('mytasks')}
        />
        <StatCard
          icon={<I.check size={18} />}
          label="Im Review"
          value={inReview.length}
          color="var(--info)"
          bg="var(--info-bg)"
          onClick={() => setRoute('kanban')}
        />
        <StatCard
          icon={<I.block size={18} />}
          label="Blockiert"
          value={blocked.length}
          color={blocked.length > 0 ? 'var(--danger)' : 'var(--success)'}
          bg={blocked.length > 0 ? 'var(--danger-bg)' : 'var(--success-bg)'}
          onClick={() => setRoute('kanban')}
        />
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: '1.55fr 1fr' }}>
        {/* ── Left column ─────────────────────────────────────────────── */}
        <div className="col gap-5">

          {/* Kritische Aufgaben */}
          <section className="card">
            <div className="row between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
              <div>
                <div className="h3">Kritische Aufgaben</div>
                <div className="meta mt-1">Überfällig · Heute fällig · Hohe Priorität</div>
              </div>
              <button className="btn btn-quiet btn-sm" onClick={() => setRoute('mytasks')}>Alle ansehen <I.arrowRight size={13} /></button>
            </div>
            <div>
              {criticalTasks.length === 0 ? (
                <EmptyState icon={<I.check size={20} />} title="Keine kritischen Tasks." body="Alles im Griff. Gute Arbeit!" />
              ) : criticalTasks.map((t) => (
                <FocusRow key={t.id} task={t} setRoute={setRoute} onOpenTask={onOpenTask} showTag />
              ))}
            </div>
          </section>

          {/* Aktive Projekte — card grid */}
          <section>
            <div className="row between mb-3">
              <div className="h3">Aktive Projekte</div>
              <button className="btn btn-quiet btn-sm" onClick={() => setRoute('projects')}>Alle Projekte <I.arrowRight size={13} /></button>
            </div>
            {activeProjects.length === 0 ? (
              <div className="card card-pad">
                <EmptyState icon={<I.folder size={20} />} title="Keine aktiven Projekte." body="Erstelle ein Projekt um loszulegen." />
              </div>
            ) : (
              <div className="grid grid-2 gap-3">
                {activeProjects.slice(0, 4).map((p) => (
                  <ProjectCard key={p.id} project={p} setRoute={setRoute} />
                ))}
                {activeProjects.length < 4 && (
                  <div
                    className="card"
                    onClick={() => setRoute('projects')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 100, cursor: 'pointer', border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--text-3)' }}
                  >
                    <div className="col items-center gap-2">
                      <I.plus size={20} />
                      <span style={{ fontSize: 13 }}>+ Neues Projekt</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* ── Right column ────────────────────────────────────────────── */}
        <div className="col gap-5">

          {/* Meine Tasks */}
          <section className="card">
            <div className="row between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
              <div>
                <div className="h3">Meine offenen Tasks</div>
                <div className="meta mt-1">{myOpen.length} Tasks · {firstName}</div>
              </div>
              <button className="btn btn-quiet btn-sm" onClick={() => setRoute('mytasks')}><I.arrowRight size={13} /></button>
            </div>
            <div>
              {myOpen.length === 0 ? (
                <div className="meta" style={{ padding: '16px 18px' }}>Keine Tasks zugewiesen.</div>
              ) : myOpen.slice(0, 5).map((t) => (
                <FocusRow key={t.id} task={t} setRoute={setRoute} onOpenTask={onOpenTask} />
              ))}
            </div>
          </section>

          {/* Team workload */}
          <section className="card">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
              <div className="h3">Team-Auslastung</div>
              <div className="meta mt-1">Offene Tasks pro Person</div>
            </div>
            <div style={{ padding: '4px 18px 12px' }}>
              {data.members.slice(0, 5).map((u) => {
                const userTasks = open.filter((t) => t.assignee === u.id);
                const pct = Math.min(100, (userTasks.length / Math.max(1, open.length / data.members.length)) * 50);
                const isHigh = userTasks.length > 6;
                return (
                  <div key={u.id} className="row gap-3" style={{ padding: '9px 0', borderBottom: '1px solid var(--border-soft)' }}>
                    <Avatar user={u} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row between mb-1">
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{u.name.split(' ')[0]}</span>
                        <span className="mono" style={{ fontSize: 11.5, color: isHigh ? 'var(--danger)' : 'var(--text-3)', fontWeight: isHigh ? 600 : 400 }}>{userTasks.length}</span>
                      </div>
                      <div style={{ background: 'var(--bg-sunk)', borderRadius: 999, height: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: isHigh ? 'var(--danger)' : 'var(--brand)', borderRadius: 999, transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Diese Woche */}
          <section className="card">
            <div className="row between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
              <div>
                <div className="h3">Diese Woche</div>
                <div className="meta mt-1">Nächste 7 Tage · {upcomingEvents.length} Deadlines</div>
              </div>
              <button className="btn btn-quiet btn-sm" onClick={() => setRoute('calendar')}><I.arrowRight size={13} /></button>
            </div>
            <div>
              {upcomingEvents.length === 0 ? (
                <div className="meta" style={{ padding: '16px 18px' }}>Keine Deadlines diese Woche.</div>
              ) : upcomingEvents.slice(0, 5).map((ev, i) => (
                <div
                  key={i}
                  className="row gap-3"
                  style={{ padding: '10px 18px', borderTop: '1px solid var(--border-soft)', cursor: 'pointer' }}
                  onClick={() => setRoute('project:' + ev.projectId)}
                >
                  <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-3)', minWidth: 40 }}>{formatDate(ev.date)}</div>
                  <span className="dot-indicator" style={{ background: eventColor(ev.type), flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 13 }} className="truncate">{ev.title}</div>
                  <span className={`badge ${daysUntil(ev.date) === 0 ? 'warning' : daysUntil(ev.date) < 0 ? 'danger' : 'ghost'}`} style={{ fontSize: 10.5 }}>
                    {dueLabel(ev.date).text}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Slack Digest */}
          {slackNotifs.length > 0 && (
            <section className="card">
              <div className="row between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
                <div className="h3 row gap-2"><I.slack size={15} /> Slack Digest</div>
                <Badge kind="success" dot>Live</Badge>
              </div>
              <div className="col gap-2" style={{ padding: '10px 14px 14px' }}>
                {slackNotifs.slice(0, 3).map((n, i) => <SlackCard key={i} notif={n} />)}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// Legacy export kept for any screens that still import it
export const KPI = ({ label, value, trend, tone }) => (
  <div className="kpi">
    <div className="kpi-label">{label}</div>
    <div className="kpi-value mono">{value}</div>
    <div className={`kpi-trend ${tone === 'ok' ? 'up' : tone === 'bad' ? 'down' : ''}`}>{trend}</div>
  </div>
);

function StatCard({ icon, label, value, color, bg, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: bg,
        border: `1px solid ${color}22`,
        borderRadius: 'var(--r-lg)',
        padding: '18px 20px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.12s, box-shadow 0.12s',
      }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      <div className="row between mb-2">
        <span style={{ color, opacity: 0.8 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12.5, color, opacity: 0.7, marginTop: 6, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function FocusRow({ task, setRoute, onOpenTask, showTag = false }) {
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
      onClick={() => onOpenTask ? onOpenTask(task.id, task.projectId) : setRoute('project:' + task.projectId)}
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
      {showTag ? (
        <span className={`badge ${due.danger ? 'danger' : due.today ? 'warning' : task.priority === 'High' ? 'info' : 'ghost'}`} style={{ fontSize: 10.5 }}>
          {due.danger ? 'Überfällig' : due.today ? 'Heute' : 'High'}
        </span>
      ) : (
        <>
          <PriorityBadge priority={task.priority} />
          <span className={`badge ${due.danger ? 'danger' : due.today ? 'warning' : 'ghost'}`} style={{ minWidth: 68, justifyContent: 'center', fontSize: 11 }}>{due.text}</span>
        </>
      )}
    </div>
  );
}

function ProjectCard({ project, setRoute }) {
  const { data } = useWorkspace();
  const team     = project.team.map((id) => data.members.find((u) => u.id === id)).filter(Boolean);
  const due      = dueLabel(project.due);
  const progress = projectProgress(data.tasks.filter((t) => t.projectId === project.id));
  const openCount = data.tasks.filter((t) => t.projectId === project.id && t.status !== 'Done').length;

  return (
    <div
      className="card card-pad"
      onClick={() => setRoute('project:' + project.id)}
      style={{ cursor: 'pointer', transition: 'box-shadow 0.12s, transform 0.12s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}
    >
      <div className="row between mb-3">
        <StatusBadge status={project.status} />
        <span className={`badge ${due.danger ? 'danger' : 'ghost'}`} style={{ fontSize: 10.5 }}>{due.text}</span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3, marginBottom: 8 }} className="truncate">{project.name}</div>
      <div className="row between mb-2">
        <span className="meta">{openCount} offene Tasks</span>
        <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{progress}%</span>
      </div>
      <Progress value={progress} brand />
      <div className="row between mt-3">
        <AvatarStack users={team} />
        {project.slackConnected && <I.slack size={13} color="var(--text-4)" />}
      </div>
    </div>
  );
}
