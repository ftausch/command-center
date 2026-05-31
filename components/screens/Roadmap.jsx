'use client';
// Cross-project roadmap — all active projects + milestones on a single timeline.

import { useMemo, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { DivisionSwitcher, useDivisionFilter } from '@/components/DivisionSwitcher';
import { Badge } from '@/components/ui';
import { getMilestones } from '@/components/screens/ProjectDetail';

const DIV_COLOR = {
  podcast: 'var(--brand)',
  events:  '#e8780a',
  general: 'var(--text-3)',
};

const STATUS_LABEL = {
  Planning:    { bg: 'var(--bg-sunk)',      text: 'var(--text-4)' },
  'In Progress':{ bg: 'var(--info)',         text: 'white' },
  Review:      { bg: 'var(--warning)',       text: 'white' },
  Blocked:     { bg: 'var(--danger)',        text: 'white' },
};

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

export function RoadmapScreen({ setRoute }) {
  const { currentWorkspace: brand, data } = useWorkspace();
  const filterByDivision = useDivisionFilter();
  const [showDone, setShowDone] = useState(false);
  const [weeks, setWeeks] = useState(12); // visible window

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const windowStart = useMemo(() => addDays(today, -7), [today]);
  const windowEnd   = useMemo(() => addDays(today, weeks * 7), [today, weeks]);
  const totalDays   = (windowEnd - windowStart) / 86400000;

  const pct = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    return Math.max(0, Math.min(100, ((d - windowStart) / 86400000 / totalDays) * 100));
  };

  const projects = useMemo(() => {
    let list = filterByDivision(data.projects);
    if (!showDone) list = list.filter(p => p.status !== 'Done');
    return list.sort((a, b) => {
      if (a.due && b.due) return a.due.localeCompare(b.due);
      if (a.due) return -1;
      if (b.due) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [data.projects, filterByDivision, showDone]);

  // Month header ticks
  const monthTicks = useMemo(() => {
    const ticks = [];
    const cur = new Date(windowStart);
    cur.setDate(1);
    while (cur <= windowEnd) {
      const p = pct(isoDate(cur));
      if (p >= 0 && p <= 100) {
        ticks.push({ p, label: cur.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }) });
      }
      cur.setMonth(cur.getMonth() + 1);
    }
    return ticks;
  }, [windowStart, windowEnd]);

  const todayPct = pct(isoDate(today));

  const LABEL_W = 200;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2"><Badge kind="brand" dot>{brand?.name}</Badge></div>
          <div className="row gap-3 items-center" style={{ flexWrap: 'wrap', marginBottom: 4 }}>
            <h1 className="h1" style={{ margin: 0 }}>Roadmap</h1>
            <DivisionSwitcher />
          </div>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Alle Projekte, Deadlines und Meilensteine auf einem Blick.
          </p>
        </div>
        <div className="row gap-2">
          <select
            className="input"
            value={weeks}
            onChange={e => setWeeks(Number(e.target.value))}
            style={{ height: 32, fontSize: 12 }}
          >
            <option value={4}>4 Wochen</option>
            <option value={8}>8 Wochen</option>
            <option value={12}>12 Wochen</option>
            <option value={24}>6 Monate</option>
            <option value={52}>1 Jahr</option>
          </select>
          <button
            className={`btn btn-ghost btn-sm${showDone ? ' active' : ''}`}
            onClick={() => setShowDone(d => !d)}
          >
            {showDone ? '✓ Abgeschlossen' : 'Abgeschlossen'}
          </button>
        </div>
      </div>

      {projects.length === 0 && (
        <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--text-4)', padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🗺️</div>
          Keine aktiven Projekte in dieser Ansicht.
        </div>
      )}

      {projects.length > 0 && (
        <div className="card" style={{ overflow: 'auto' }}>
          <div style={{ minWidth: LABEL_W + 600, padding: '16px 20px' }}>

            {/* Month header */}
            <div style={{ display: 'flex', marginBottom: 12, marginLeft: LABEL_W }}>
              <div style={{ flex: 1, position: 'relative', height: 20 }}>
                {monthTicks.map((t, i) => (
                  <div key={i} style={{
                    position: 'absolute', left: `${t.p}%`,
                    fontSize: 10.5, color: 'var(--text-4)',
                    transform: 'translateX(-50%)', whiteSpace: 'nowrap',
                  }}>
                    {t.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Project rows */}
            <div className="col gap-2">
              {projects.map((p) => {
                const milestones = getMilestones(p.id);
                const divColor   = DIV_COLOR[p.division] ?? 'var(--text-3)';
                const tasks      = data.tasks.filter(t => t.projectId === p.id);
                const done       = tasks.filter(t => t.status === 'Done').length;
                const pct_done   = tasks.length > 0 ? Math.round(done / tasks.length * 100) : 0;

                const barStart  = pct(isoDate(today));
                const barEnd    = p.due ? pct(p.due) : Math.min(todayPct + 5, 95);
                const barWidth  = Math.max(0.5, barEnd - barStart);

                const eventDate = p.division === 'events' && p.eventMeta?.eventDate
                  ? p.eventMeta.eventDate.slice(0, 10)
                  : null;

                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', minHeight: 36 }}>
                    {/* Project label */}
                    <div
                      style={{ width: LABEL_W, flexShrink: 0, paddingRight: 12, cursor: 'pointer' }}
                      onClick={() => setRoute('project:' + p.id)}
                    >
                      <div className="row gap-1 items-center">
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: divColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)', marginLeft: 12 }}>
                        {pct_done}% · {p.status}
                      </div>
                    </div>

                    {/* Timeline bar */}
                    <div style={{ flex: 1, position: 'relative', height: 28, background: 'var(--bg-sunk)', borderRadius: 6 }}>
                      {/* Today line */}
                      <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, width: 2, background: 'var(--danger)', opacity: 0.6, zIndex: 4, borderRadius: 1 }} />

                      {/* Project bar */}
                      {p.due && (
                        <div
                          title={`${p.name} · Deadline: ${p.due}`}
                          style={{
                            position: 'absolute',
                            left: `${Math.min(barStart, barEnd)}%`,
                            width: `${barWidth}%`,
                            top: 6, bottom: 6,
                            background: divColor,
                            opacity: p.status === 'Done' ? 0.35 : 0.6,
                            borderRadius: 4,
                            zIndex: 2,
                          }}
                        />
                      )}

                      {/* Progress fill */}
                      {p.due && pct_done > 0 && (
                        <div style={{
                          position: 'absolute',
                          left: `${Math.min(barStart, barEnd)}%`,
                          width: `${barWidth * pct_done / 100}%`,
                          top: 6, bottom: 6,
                          background: divColor,
                          opacity: 0.9,
                          borderRadius: 4,
                          zIndex: 3,
                        }} />
                      )}

                      {/* Deadline marker */}
                      {p.due && (
                        <div
                          title={`Deadline: ${p.due}`}
                          style={{
                            position: 'absolute',
                            left: `${pct(p.due)}%`,
                            top: '50%', transform: 'translate(-50%, -50%)',
                            width: 10, height: 10,
                            background: 'white',
                            border: `2px solid ${divColor}`,
                            borderRadius: '50%',
                            zIndex: 5,
                          }}
                        />
                      )}

                      {/* Event date flag */}
                      {eventDate && (
                        <div
                          title={`Event: ${eventDate}`}
                          style={{
                            position: 'absolute',
                            left: `${pct(eventDate)}%`,
                            top: 0, bottom: 0,
                            width: 2,
                            background: '#e8780a',
                            zIndex: 5,
                            borderRadius: 1,
                          }}
                        />
                      )}

                      {/* Milestone diamonds */}
                      {milestones.filter(m => !m.done).map((m, j) => (
                        <div
                          key={j}
                          title={`🏁 ${m.title} · ${m.date}`}
                          style={{
                            position: 'absolute',
                            left: `${pct(m.date)}%`,
                            top: '50%', transform: 'translate(-50%, -50%) rotate(45deg)',
                            width: 9, height: 9,
                            background: 'var(--brand)',
                            zIndex: 5,
                          }}
                        />
                      ))}
                    </div>

                    {/* Deadline label */}
                    <div style={{ width: 60, flexShrink: 0, textAlign: 'right', paddingLeft: 8, fontSize: 11, color: 'var(--text-4)' }}>
                      {p.due ? new Date(p.due + 'T00:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }) : ''}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="row gap-4 mt-5" style={{ flexWrap: 'wrap' }}>
              {Object.entries(DIV_COLOR).map(([d, c]) => (
                <span key={d} className="row gap-1" style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block', marginTop: 1 }} />
                  {d === 'podcast' ? 'Podcast' : d === 'events' ? 'Events' : 'General'}
                </span>
              ))}
              <span className="row gap-1" style={{ fontSize: 11, color: 'var(--text-3)' }}>
                <span style={{ width: 7, height: 7, background: 'var(--brand)', transform: 'rotate(45deg)', display: 'inline-block', marginTop: 1 }} />
                Meilenstein
              </span>
              <span className="row gap-1" style={{ fontSize: 11, color: 'var(--text-3)' }}>
                <span style={{ width: 2, height: 10, background: 'var(--danger)', display: 'inline-block', opacity: 0.6 }} />
                Heute
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
