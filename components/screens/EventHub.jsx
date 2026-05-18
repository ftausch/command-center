'use client';
// Event Hub — overview screen for Unicorn Bakery events.
// Shows upcoming events, open tasks, pipeline status, partner/sponsor tracking,
// Slack/Drive resource links, and recent activity — all filtered to division=events.

import { useMemo, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { Badge, EmptyState, PriorityBadge, StatusBadge } from '@/components/ui';
import { I } from '@/components/icons';
import { daysUntil, dueLabel, projectProgress, eventHealthScore, eventHealthColor } from '@/lib/utils';
import { NewEventModal } from '@/components/NewEventModal';
import { HealthBadge } from '@/components/EventOps';

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
  const { currentWorkspace: brand, data, addProject } = useWorkspace();
  const [filter,         setFilter]         = useState('all');
  const [newEventOpen,   setNewEventOpen]   = useState(false);

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
              <span style={{ fontSize: 11, color: '#e8780a', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#fff4e6' }}>Events</span>
            </div>
            <h1 className="h1">Event Hub</h1>
          </div>
          <button className="btn btn-sm" style={{ background: '#e8780a', color: 'white', border: 'none' }} onClick={() => setNewEventOpen(true)}>
            <I.plus size={13} /> Neues Event
          </button>
        </div>
        <NewEventModal
          open={newEventOpen}
          onClose={() => setNewEventOpen(false)}
          onCreated={(p) => { setNewEventOpen(false); setRoute('project:' + p.id); }}
        />
        <EmptyState
          icon={<I.calendar size={28} />}
          title="Noch keine Events"
          desc="Erstelle dein erstes Event und wähle ein Template — Tasks werden automatisch angelegt."
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
        <div className="row gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setRoute('eventpipeline')}>
            <I.kanban size={13} /> Pipeline
          </button>
          <button
            className="btn btn-sm"
            style={{ background: '#e8780a', color: 'white', border: 'none' }}
            onClick={() => setNewEventOpen(true)}
          >
            <I.plus size={13} /> Neues Event
          </button>
        </div>
      </div>

      <NewEventModal
        open={newEventOpen}
        onClose={() => setNewEventOpen(false)}
        onCreated={(p) => { setNewEventOpen(false); setRoute('project:' + p.id); }}
      />

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="row gap-3 mb-4 wrap">
        <StatCard label="Aktive Events" value={eventProjects.filter(p => p.status !== 'Done').length} />
        <StatCard label="Offene Tasks" value={openTasks.length} />
        <StatCard label="Partner/Sponsoren" value={[...new Set(eventProjects.map(p => p.eventMeta?.partnerSponsor).filter(Boolean))].length} color="#e8780a" />
        <StatCard label="Überfällig" value={overdue.length} color={overdue.length > 0 ? 'var(--danger)' : undefined} />
        <StatCard label="Blockiert" value={blocked.length} color={blocked.length > 0 ? 'var(--danger)' : undefined} />
      </div>

      {/* ── Event Timeline ───────────────────────────────────────────────── */}
      {(() => {
        const eventsWithDate = eventProjects
          .filter(p => p.eventMeta?.eventDate && p.status !== 'Done')
          .sort((a, b) => a.eventMeta.eventDate > b.eventMeta.eventDate ? 1 : -1)
          .slice(0, 5);
        if (eventsWithDate.length === 0) return null;
        return (
          <div className="card card-pad mb-4">
            <div className="h3 mb-3">📆 Event-Kalender</div>
            <div className="col gap-0">
              {eventsWithDate.map((p, i) => {
                const date = new Date(p.eventMeta.eventDate);
                const isToday = date.toDateString() === new Date().toDateString();
                const isPast  = date < new Date();
                const h = (date.getTime() - Date.now()) / 3_600_000;
                return (
                  <div
                    key={p.id}
                    onClick={() => setRoute('project:' + p.id)}
                    style={{
                      display: 'flex', gap: 14, alignItems: 'flex-start',
                      paddingBottom: i < eventsWithDate.length - 1 ? 16 : 0,
                      marginBottom: i < eventsWithDate.length - 1 ? 16 : 0,
                      borderBottom: i < eventsWithDate.length - 1 ? '1px solid var(--border-soft)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {/* Date column */}
                    <div style={{
                      minWidth: 52, textAlign: 'center', padding: '6px 8px',
                      borderRadius: 8,
                      background: isToday ? '#e8780a' : isPast ? 'var(--bg-sunk)' : '#fff4e6',
                      color: isToday ? 'white' : isPast ? 'var(--text-4)' : '#e8780a',
                    }}>
                      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{date.getDate()}</div>
                      <div style={{ fontSize: 10, fontWeight: 600 }}>
                        {date.toLocaleString('de-DE', { month: 'short' }).toUpperCase()}
                      </div>
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
                      <div className="row gap-3" style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
                        <span>{date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</span>
                        {p.eventMeta?.location && <span>📍 {p.eventMeta.location}</span>}
                        {p.eventMeta?.partnerSponsor && <span>🤝 {p.eventMeta.partnerSponsor}</span>}
                      </div>
                      {h > 0 && h < 48 && (
                        <div style={{ fontSize: 11.5, color: h < 2 ? 'var(--danger)' : '#e8780a', fontWeight: 600, marginTop: 3 }}>
                          {h < 1 ? 'Jetzt!' : h < 24 ? `in ${Math.round(h)}h` : 'Morgen'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

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
                  const projTasks = data.tasks.filter(t => t.projectId === p.id);
                  const progress  = projectProgress(projTasks);
                  const health    = eventHealthScore(p, projTasks);
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
                        <div className="row gap-2">
                          <HealthBadge score={health.score} reasons={health.reasons} size="sm" />
                          <StatusBadge status={p.status} />
                        </div>
                      </div>
                      <div className="row gap-3" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {p.due && (
                          <span style={{ color: d < 0 ? 'var(--danger)' : d <= 7 ? 'var(--warning)' : 'var(--text-3)' }}>
                            📅 {dueLabel(p.due).text}
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
                      {t.due && <span style={{ fontSize: 11, color: daysUntil(t.due) < 0 ? 'var(--danger)' : 'var(--text-3)', flexShrink: 0 }}>{dueLabel(t.due).text}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <div className="col gap-3">

          {/* ── Ops Health Dashboard ─────────────────────────────────────── */}
          {(() => {
            const noOwner    = eventProjects.filter(p => p.status !== 'Done' && !p.owner);
            const noLocation = eventProjects.filter(p => p.status !== 'Done' && p.eventMeta?.eventDate && !p.eventMeta?.location);
            const noSignup   = eventProjects.filter(p => p.status !== 'Done' && p.eventMeta?.eventDate && !p.eventMeta?.signupUrl && !p.eventMeta?.landingPageUrl);
            const unassigned = openTasks.filter(t => !t.assignee);
            const critical   = eventProjects.filter(p => p.status !== 'Done' && eventHealthScore(p, data.tasks.filter(t => t.projectId === p.id)).score === 'red');
            const atRisk     = eventProjects.filter(p => p.status !== 'Done' && eventHealthScore(p, data.tasks.filter(t => t.projectId === p.id)).score === 'yellow');

            const rows = [
              { label: 'Kritische Events',        value: critical.length,   color: critical.length   > 0 ? 'var(--danger)'  : 'var(--success)', icon: '🔴' },
              { label: 'Events mit Risiko',        value: atRisk.length,     color: atRisk.length     > 0 ? 'var(--warning)' : 'var(--success)', icon: '🟡' },
              { label: 'Überfällige Tasks',        value: overdue.length,    color: overdue.length    > 0 ? 'var(--danger)'  : 'var(--success)', icon: '⏰' },
              { label: 'Blockierte Tasks',         value: blocked.length,    color: blocked.length    > 0 ? 'var(--warning)' : 'var(--success)', icon: '🚫' },
              { label: 'Nicht zugewiesene Tasks',  value: unassigned.length, color: unassigned.length > 0 ? 'var(--warning)' : 'var(--success)', icon: '👤' },
              { label: 'Kein Owner',               value: noOwner.length,    color: noOwner.length    > 0 ? 'var(--warning)' : 'var(--success)', icon: '👋' },
              { label: 'Keine Location',           value: noLocation.length, color: noLocation.length > 0 ? 'var(--warning)' : 'var(--success)', icon: '📍' },
              { label: 'Kein Signup-Link',         value: noSignup.length,   color: noSignup.length   > 0 ? 'var(--warning)' : 'var(--success)', icon: '🔗' },
            ].filter(r => r.value > 0);

            if (rows.length === 0) return (
              <div className="card card-pad">
                <div className="h3 mb-2">Ops-Health</div>
                <div style={{ fontSize: 12.5, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
                  Alle Events auf Kurs
                </div>
              </div>
            );

            return (
              <div className="card card-pad">
                <div className="h3 mb-3">Ops-Health</div>
                <div className="col gap-1">
                  {rows.map((r) => (
                    <div key={r.label} className="row between" style={{ padding: '5px 0', borderBottom: '1px solid var(--border-soft)', fontSize: 12.5 }}>
                      <span style={{ color: 'var(--text-2)' }}>{r.icon} {r.label}</span>
                      <span style={{ fontWeight: 700, color: r.color, minWidth: 20, textAlign: 'right' }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

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
