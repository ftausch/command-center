'use client';
// Calendar — month view derived from task and project due dates.
//
// Events are synthesised client-side from data.tasks and data.projects
// (any row with a non-empty due date). No separate calendar_events table
// is needed; the existing due-date fields are the source of truth.

import { useState, useMemo } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Badge } from '@/components/ui';
import { TaskDrawer } from '@/components/TaskDrawer';
import { TODAY, dueLabel, eventColor, formatDate, parseDate } from '@/lib/utils';

const TODAY_STR = [
  TODAY.getFullYear(),
  String(TODAY.getMonth() + 1).padStart(2, '0'),
  String(TODAY.getDate()).padStart(2, '0'),
].join('-');

function prevMonth(m) {
  if (m.mo === 0) return { year: m.year - 1, mo: 11 };
  return { year: m.year, mo: m.mo - 1 };
}
function nextMonth(m) {
  if (m.mo === 11) return { year: m.year + 1, mo: 0 };
  return { year: m.year, mo: m.mo + 1 };
}

export function CalendarScreen({ setRoute }) {
  const { currentWorkspace: brand, data } = useWorkspace();
  const [month, setMonth] = useState({ year: TODAY.getFullYear(), mo: TODAY.getMonth() });
  const [drawerTask, setDrawerTask] = useState(null); // { taskId, projectId } | null

  const monthLabel = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'][month.mo];

  // ── Build calendar grid ───────────────────────────────────────────────────
  const firstDay = new Date(month.year, month.mo, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(month.year, month.mo + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  // ── Derive events from tasks + projects + episodes ───────────────────────
  const allEvents = useMemo(() => {
    const evs = [];
    data.tasks.forEach((t) => {
      if (!t.due) return;
      evs.push({
        date: t.due,
        type: t.status === 'Review' ? 'review' : 'deadline',
        title: t.title,
        projectId: t.projectId,
        taskId: t.id,
        episodeId: null,
      });
    });
    data.projects.forEach((p) => {
      if (!p.due) return;
      evs.push({
        date: p.due,
        type: p.status === 'Review' ? 'review' : 'deadline',
        title: p.name,
        projectId: p.id,
        taskId: null,
        episodeId: null,
      });
    });
    (data.episodes ?? []).forEach((ep) => {
      if (!ep.date) return;
      evs.push({
        date: ep.date,
        type: 'publish',
        title: ep.num ? `Ep. ${ep.num} · ${ep.title}` : ep.title,
        projectId: null,
        taskId: null,
        episodeId: ep.id,
      });
    });
    return evs.sort((a, b) => a.date.localeCompare(b.date));
  }, [data.tasks, data.projects, data.episodes]);

  // ── Events bucketed by day-of-month for current month ────────────────────
  const evByDay = useMemo(() => {
    const m = {};
    allEvents.forEach((ev) => {
      const d = parseDate(ev.date);
      if (d.getFullYear() === month.year && d.getMonth() === month.mo) {
        const day = d.getDate();
        (m[day] = m[day] || []).push(ev);
      }
    });
    return m;
  }, [allEvents, month]);

  // ── Upcoming: future events sorted ascending ──────────────────────────────
  const upcoming = useMemo(
    () => allEvents.filter((ev) => ev.date >= TODAY_STR).slice(0, 10),
    [allEvents],
  );

  const todayDay = TODAY.getMonth() === month.mo && TODAY.getFullYear() === month.year
    ? TODAY.getDate()
    : null;

  const onEventClick = (ev, e) => {
    e.stopPropagation();
    if (ev.taskId) {
      setDrawerTask({ taskId: ev.taskId, projectId: ev.projectId });
    } else if (ev.episodeId) {
      setRoute('podcast');
    } else {
      setRoute('project:' + ev.projectId);
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2"><Badge kind="brand" dot>{brand?.name}</Badge></div>
          <h1 className="h1">Calendar</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Task-Deadlines und Projekt-Deadlines — alle in einer Ansicht.
          </p>
        </div>
        <div className="row gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth(prevMonth)}><I.chevron size={12} style={{ transform: 'rotate(180deg)' }} /></button>
          <button className="btn btn-ghost btn-sm" disabled style={{ minWidth: 120 }}>{monthLabel} {month.year}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth(nextMonth)}><I.chevron size={12} /></button>
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth({ year: TODAY.getFullYear(), mo: TODAY.getMonth() })}>Heute</button>
        </div>
      </div>

      <TaskDrawer
        taskId={drawerTask?.taskId ?? null}
        projectId={drawerTask?.projectId ?? null}
        onClose={() => setDrawerTask(null)}
      />

      <div className="row gap-3 mb-4 wrap">
        {[
          { t: 'deadline', label: 'Deadline / Task' },
          { t: 'review',   label: 'Review' },
          { t: 'publish',  label: 'Episode' },
        ].map((l) => (
          <div key={l.t} className="row gap-2" style={{ fontSize: 12, color: 'var(--text-2)' }}>
            <span className="dot-indicator" style={{ background: eventColor(l.t) }} />
            {l.label}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <span className="meta">{allEvents.length} Termine insgesamt</span>
      </div>

      {/* ── Month grid ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
          {['Mo','Di','Mi','Do','Fr','Sa','So'].map((d) => (
            <div key={d} style={{ padding: '10px 12px', fontSize: 11.5, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((d, i) => {
            const evs = (d && evByDay[d]) || [];
            const isToday = d === todayDay;
            const isWeekend = i % 7 >= 5;
            return (
              <div key={i} style={{
                minHeight: 100,
                borderRight: i % 7 !== 6 ? '1px solid var(--border-soft)' : 'none',
                borderBottom: i < cells.length - 7 ? '1px solid var(--border-soft)' : 'none',
                padding: 8,
                background: isToday ? 'var(--brand-soft)' : isWeekend ? 'var(--bg)' : 'var(--bg-elev)',
              }}>
                {d && (
                  <div className="mono" style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--brand)' : 'var(--text-2)', marginBottom: 5 }}>
                    {String(d).padStart(2, '0')}
                  </div>
                )}
                <div className="col gap-1">
                  {evs.slice(0, 3).map((ev, j) => (
                    <div
                      key={j}
                      onClick={(e) => onEventClick(ev, e)}
                      title={ev.title}
                      style={{
                        padding: '2px 5px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                        background: 'var(--bg-elev)',
                        border: `1px solid ${eventColor(ev.type)}`,
                        color: 'var(--text-1)', cursor: 'pointer',
                        display: 'flex', gap: 4, alignItems: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      <span className="dot-indicator" style={{ background: eventColor(ev.type), width: 5, height: 5, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
                    </div>
                  ))}
                  {evs.length > 3 && (
                    <div style={{ fontSize: 11, color: 'var(--text-3)', paddingLeft: 2 }}>+{evs.length - 3} weitere</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Upcoming list ── */}
      <div className="mt-6">
        <div className="label mb-3">Demnächst · {brand?.name}</div>
        <div className="card">
          {upcoming.length === 0 && (
            <div className="meta" style={{ padding: '18px 20px' }}>
              Keine anstehenden Termine. Sobald Tasks oder Projekte mit Deadlines angelegt sind, tauchen sie hier auf.
            </div>
          )}
          {upcoming.map((ev, i) => (
            <div
              key={i}
              className="row gap-4"
              style={{ padding: '14px 18px', borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)', cursor: 'pointer' }}
              onClick={(e) => onEventClick(ev, e)}
            >
              <div style={{ minWidth: 70 }}>
                <div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{formatDate(ev.date)}</div>
                <div className="meta">{dueLabel(ev.date).text}</div>
              </div>
              <div style={{ width: 3, alignSelf: 'stretch', background: eventColor(ev.type), borderRadius: 2, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{ev.title}</div>
                <div className="meta mt-1">
                  {ev.episodeId
                    ? 'Podcast Hub'
                    : data.projects.find((p) => p.id === ev.projectId)?.name}
                  {ev.taskId && <span style={{ marginLeft: 6 }}>· Task</span>}
                </div>
              </div>
              <Badge kind={ev.type === 'publish' ? 'success' : ev.type === 'review' ? 'warning' : 'ghost'}>
                {ev.type === 'publish' ? 'Episode' : ev.type === 'review' ? 'Review' : 'Deadline'}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
