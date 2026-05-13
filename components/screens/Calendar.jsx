'use client';
// Calendar

import { useState, useMemo } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Badge } from '@/components/ui';
import { TODAY, dueLabel, eventColor, formatDate, parseDate } from '@/lib/utils';

export function CalendarScreen({ setRoute }) {
  const { currentWorkspace: brand, data } = useWorkspace();
  const events = data.calendarEvents;
  const [month, setMonth] = useState({ year: 2026, mo: 4 }); // May (0-indexed)

  const monthLabel = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'][month.mo];
  const firstDay = new Date(month.year, month.mo, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(month.year, month.mo + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const evByDate = useMemo(() => {
    const m = {};
    events.forEach((ev) => {
      const d = parseDate(ev.date);
      if (d.getFullYear() === month.year && d.getMonth() === month.mo) {
        const day = d.getDate();
        (m[day] = m[day] || []).push(ev);
      }
    });
    return m;
  }, [events, month]);

  const todayDay = TODAY.getMonth() === month.mo && TODAY.getFullYear() === month.year ? TODAY.getDate() : null;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2"><Badge kind="brand" dot>{brand?.name}</Badge></div>
          <h1 className="h1">Calendar</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Recordings, Deadlines, Reviews & Publish-Termine — alles in einer Ansicht.
          </p>
        </div>
        <div className="row gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth({ year: month.year, mo: (month.mo + 11) % 12 })}><I.chevron size={12} style={{ transform: 'rotate(180deg)' }} /></button>
          <button className="btn btn-ghost btn-sm" disabled>{monthLabel} {month.year}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth({ year: month.year, mo: (month.mo + 1) % 12 })}><I.chevron size={12} /></button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setMonth({ year: TODAY.getFullYear(), mo: TODAY.getMonth() })}
          >Heute</button>
          <button className="btn btn-brand btn-sm" disabled title="Kalender-Termine kommen bald — heute werden Events aus Projekten/Tasks gespiegelt"><I.plus size={13} /> Termin</button>
        </div>
      </div>

      <div className="row gap-3 mb-4 wrap">
        {[
          { t: 'recording', label: 'Recording' },
          { t: 'deadline', label: 'Deadline' },
          { t: 'review', label: 'Review' },
          { t: 'publish', label: 'Publish' },
        ].map((l) => (
          <div key={l.t} className="row gap-2" style={{ fontSize: 12, color: 'var(--text-2)' }}>
            <span className="dot-indicator" style={{ background: eventColor(l.t) }} />
            {l.label}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <button className="chip active" disabled>Monat</button>
        <button className="chip" disabled title="Noch nicht verfügbar">Woche</button>
        <button className="chip" disabled title="Noch nicht verfügbar">Tag</button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
          {['Mo','Di','Mi','Do','Fr','Sa','So'].map((d) => (
            <div key={d} style={{ padding: '10px 12px', fontSize: 11.5, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{d}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((d, i) => {
            const evs = (d && evByDate[d]) || [];
            const isToday = d === todayDay;
            const isWeekend = i % 7 >= 5;
            return (
              <div key={i} style={{
                minHeight: 110,
                borderRight: i % 7 !== 6 ? '1px solid var(--border-soft)' : 'none',
                borderBottom: i < cells.length - 7 ? '1px solid var(--border-soft)' : 'none',
                padding: 8,
                background: isToday ? 'var(--brand-soft)' : isWeekend ? 'var(--bg)' : 'var(--bg-elev)',
                position: 'relative',
              }}>
                {d && (
                  <div className="mono" style={{ fontSize: 12, fontWeight: isToday ? 600 : 500, color: isToday ? 'var(--brand)' : 'var(--text-2)', marginBottom: 6 }}>
                    {String(d).padStart(2, '0')}
                  </div>
                )}
                <div className="col gap-1">
                  {evs.slice(0, 3).map((ev, j) => (
                    <div key={j} onClick={() => setRoute('project:' + ev.projectId)}
                      style={{
                        padding: '3px 6px', borderRadius: 4, fontSize: 11.5, fontWeight: 500,
                        background: 'var(--bg-elev)', border: `1px solid ${eventColor(ev.type)}`,
                        color: 'var(--text-1)', cursor: 'pointer',
                        display: 'flex', gap: 5, alignItems: 'center',
                      }}>
                      <span className="dot-indicator" style={{ background: eventColor(ev.type), width: 5, height: 5 }} />
                      <span className="truncate">{ev.title}</span>
                    </div>
                  ))}
                  {evs.length > 3 && (
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>+{evs.length - 3} weitere</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <div className="label mb-3">Demnächst · {brand?.name}</div>
        <div className="card">
          {events.length === 0 && (
            <div className="meta" style={{ padding: '18px 20px' }}>
              Noch keine Termine in diesem Workspace. Sobald Tasks und Projekte mit Deadlines angelegt sind, tauchen sie hier auf.
            </div>
          )}
          {events.slice(0, 8).map((ev, i) => (
            <div key={i} className="row gap-4" style={{ padding: '14px 18px', borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)', cursor: 'pointer' }} onClick={() => setRoute('project:' + ev.projectId)}>
              <div style={{ minWidth: 70 }}>
                <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>{formatDate(ev.date)}</div>
                <div className="meta">{dueLabel(ev.date).text}</div>
              </div>
              <div style={{ width: 4, alignSelf: 'stretch', background: eventColor(ev.type), borderRadius: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{ev.title}</div>
                <div className="meta mt-1">{data.projects.find((p) => p.id === ev.projectId)?.name}</div>
              </div>
              <Badge kind="ghost">{ev.type}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
