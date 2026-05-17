'use client';
// Event Hub — overview screen for Unicorn Bakery events.
// Shows upcoming events, open tasks, pipeline status, partner/sponsor tracking,
// Slack/Drive resource links, and recent activity — all filtered to division=events.

import { useMemo, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { Badge, EmptyState, PriorityBadge, StatusBadge } from '@/components/ui';
import { I } from '@/components/icons';
import { daysUntil, dueLabel, projectProgress } from '@/lib/utils';

const EVENT_STATUSES = ['Planning', 'In Progress', 'Review', 'Blocked', 'Done'];

const EVENT_TYPE_LABEL = {
  Event:    { icon: '🎪', label: 'Event' },
  Workshop: { icon: '🎓', label: 'Workshop' },
  Shoot:    { icon: '📷', label: 'Shoot' },
};

function StatCard({ label, value, sub, color }) {
  return (
    <div className="card card-pad" style={{ flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: color ?? 'var(--text-1)', letterSpacing: '-0.03em' }}>{value}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

export function EventHubScreen({ setRoute }) {
  const { currentWorkspace: brand, data } = useWorkspace();
  const [filter, setFilter] = useState('all');

  const eventProjects = useMemo(() =>
    data.projects.filter((p) => p.division === 'events'),
  [data.projects]);

  const eventTasks = useMemo(() =>
    data.tasks.filter((t) => {
      const proj = data.projects.find((p) => p.id === t.projectId);
      return proj?.division === 'events';
    }),
  [data.tasks, data.projects]);

  const upcoming = useMemo(() =>
    eventProjects
      .filter((p) => p.status !== 'Done' && p.due)
      .sort((a, b) => (a.due > b.due ? 1 : -1))
      .slice(0, 5),
  [eventProjects]);

  const openTasks = useMemo(() =>
    eventTasks.filter((t) => t.status !== 'Done'),
  [eventTasks]);

  const overdue = openTasks.filter((t) => daysUntil(t.due) < 0);
  const blocked = openTasks.filter((t) => t.status === 'Blocked');
  const inReview = openTasks.filter((t) => t.status === 'Review');

  const filteredProjects = useMemo(() => {
    if (filter === 'all') return eventProjects.filter((p) => p.status !== 'Done');
    return eventProjects.filter((p) => p.status === filter);
  }, [eventProjects, filter]);

  const recentActivity = useMemo(() =>
    data.activity
      .filter((a) => {
        const proj = data.projects.find((p) => p.id === a.target || a.meta?.includes?.(p.id));
        return proj?.division === 'events';
      })
      .slice(0, 8),
  [data.activity, data.projects]);

  if (eventProjects.length === 0) {
    return (
      <div className="page fade-in">
        <div className="page-head">
          <div>
            <div className="row gap-2 mb-2">
              <Badge kind="brand" dot>{brand?.name}</Badge>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: 'var(--bg-sunk)' }}>Events</span>
            </div>
            <h1 className="h1">Event Hub</h1>
          </div>
        </div>
        <EmptyState
          icon={<I.calendar size={28} />}
          title="Noch keine Events"
          desc='Erstelle dein erstes Event-Projekt über "+ New Project" und wähle den Typ "Event".'
        />
      </div>
    );
  }

  return (
    <div className="page fade-in">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="page-head" style={{ paddingBottom: 20, marginBottom: 24 }}>
        <div>
          <div className="row gap-2 mb-2">
            <Badge kind="brand" dot>{brand?.name}</Badge>
            <span style={{ fontSize: 11, color: '#e8780a', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#fff4e6' }}>Events</span>
          </div>
          <h1 className="h1">Event Hub</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Überblick über alle Events, Tasks und Partner-Status.
          </p>
        </div>
        <button className="btn btn-brand btn-sm" onClick={() => setRoute('eventpipeline')}>
          <I.kanban size={13} /> Event Pipeline
        </button>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="row gap-3 mb-4 wrap">
        <StatCard label="Aktive Events" value={eventProjects.filter(p => p.status !== 'Done').length} />
        <StatCard label="Offene Tasks" value={openTasks.length} />
        <StatCard label="Überfällig" value={overdue.length} color={overdue.length > 0 ? 'var(--danger)' : undefined} />
        <StatCard label="In Review" value={inReview.length} color={inReview.length > 0 ? 'var(--warning)' : undefined} />
        <StatCard label="Blockiert" value={blocked.length} color={blocked.length > 0 ? 'var(--danger)' : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        <div className="col gap-4">

          {/* ── Upcoming Events ──────────────────────────────────────────── */}
          <div className="card card-pad">
            <div className="row between mb-3">
              <div className="h3">Nächste Events</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setRoute('eventpipeline')}>
                Alle <I.arrowRight size={11} />
              </button>
            </div>
            {upcoming.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '8px 0' }}>Keine bevorstehenden Events.</div>
            ) : (
              <div className="col gap-2">
                {upcoming.map((p) => {
                  const progress = projectProgress(data.tasks.filter(t => t.projectId === p.id));
                  const d = daysUntil(p.due);
                  return (
                    <div
                      key={p.id}
                      onClick={() => setRoute('project:' + p.id)}
                      style={{
                        padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                        border: '1px solid var(--border-soft)',
                        background: 'var(--bg-card)',
                        transition: 'border-color 0.12s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-soft)'}
                    >
                      <div className="row between mb-1">
                        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</span>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="row gap-3" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {p.due && (
                          <span style={{ color: d < 0 ? 'var(--danger)' : d <= 7 ? 'var(--warning)' : 'var(--text-3)' }}>
                            📅 {dueLabel(p.due)}
                          </span>
                        )}
                        <span>📋 {data.tasks.filter(t => t.projectId === p.id && t.status !== 'Done').length} offen</span>
                        {p.slackChannel && <span>💬 {p.slackChannel}</span>}
                      </div>
                      {progress > 0 && (
                        <div style={{ marginTop: 8, height: 3, background: 'var(--border-soft)', borderRadius: 2 }}>
                          <div style={{ width: `${progress}%`, height: '100%', background: '#e8780a', borderRadius: 2 }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Open Tasks ───────────────────────────────────────────────── */}
          <div className="card card-pad">
            <div className="row between mb-3">
              <div className="h3">Offene Event-Tasks</div>
              <div className="row gap-2">
                {['all','In Progress','Review','Blocked'].map(f => (
                  <button
                    key={f}
                    className={`chip${filter === f ? ' active' : ''}`}
                    onClick={() => setFilter(f)}
                    style={{ fontSize: 11.5 }}
                  >
                    {f === 'all' ? 'Alle' : f}
                  </button>
                ))}
              </div>
            </div>
            {openTasks.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Keine offenen Tasks.</div>
            ) : (
              <div className="col gap-1">
                {openTasks.slice(0, 10).map((t) => {
                  const proj = data.projects.find(p => p.id === t.projectId);
                  return (
                    <div key={t.id} style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--bg-sunk)', display: 'flex', gap: 10, alignItems: 'center' }}>
                      <PriorityBadge priority={t.priority} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                        {proj && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{proj.name}</div>}
                      </div>
                      <StatusBadge status={t.status} />
                      {t.due && <span style={{ fontSize: 11, color: daysUntil(t.due) < 0 ? 'var(--danger)' : 'var(--text-3)', flexShrink: 0 }}>{dueLabel(t.due)}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <div className="col gap-3">

          {/* Projects with resources */}
          <div className="card card-pad">
            <div className="h3 mb-3">Event-Ressourcen</div>
            {eventProjects.filter(p => p.slackChannel || p.slackConnected).length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Noch keine Ressourcen verknüpft.</div>
            ) : (
              <div className="col gap-2">
                {eventProjects.filter(p => p.slackChannel).map(p => (
                  <div key={p.id} style={{ fontSize: 13 }}>
                    <div style={{ fontWeight: 500, marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>💬 {p.slackChannel}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status overview */}
          <div className="card card-pad">
            <div className="h3 mb-3">Status-Übersicht</div>
            <div className="col gap-2">
              {EVENT_STATUSES.map(s => {
                const count = eventProjects.filter(p => p.status === s).length;
                if (count === 0) return null;
                return (
                  <div key={s} className="row between" style={{ fontSize: 13 }}>
                    <StatusBadge status={s} />
                    <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent activity */}
          {recentActivity.length > 0 && (
            <div className="card card-pad">
              <div className="h3 mb-3">Letzte Aktivität</div>
              <div className="col gap-2">
                {recentActivity.slice(0, 5).map((a) => (
                  <div key={a.id} style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', gap: 8 }}>
                    <span style={{ color: 'var(--text-4)', flexShrink: 0 }}>
                      {new Date(a.time).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.verb} {a.meta}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
