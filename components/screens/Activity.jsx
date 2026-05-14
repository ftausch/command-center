'use client';
// Activity Feed

import { useMemo, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Badge } from '@/components/ui';
import { ActivityTimeline } from '@/components/screens/ProjectDetail';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const FILTERS = [
  { id: 'all',         label: 'Alle',        match: () => true },
  { id: 'status',      label: 'Status',      match: (a) => a.icon === 'arrow-right' },
  { id: 'comments',    label: 'Comments',    match: (a) => a.icon === 'message' },
  { id: 'slack',       label: 'Slack',       match: (a) => a.icon === 'slack' },
  { id: 'assignments', label: 'Assignments', match: (a) => a.icon === 'user' },
  { id: 'blocked',     label: 'Blocked',     match: (a) => a.icon === 'block' },
];

// Compute Last-7-days counts from the in-memory activity log. No new
// server query needed; the same items the timeline renders are the
// source of truth.
function useRecentStats(items) {
  return useMemo(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const recent = items.filter((a) => {
      const t = new Date(a.time).getTime();
      return Number.isFinite(t) && t >= cutoff;
    });
    let tasksCompleted = 0;
    let tasksCreated = 0;
    let projectsCreated = 0;
    let comments = 0;
    let statusChanges = 0;
    let blockersOpened = 0;
    for (const a of recent) {
      if (a.icon === 'check') tasksCompleted++;
      else if (a.icon === 'plus' && /Task/i.test(a.verb)) tasksCreated++;
      else if (a.icon === 'plus' && /Project/i.test(a.verb)) projectsCreated++;
      else if (a.icon === 'message') comments++;
      else if (a.icon === 'arrow-right') statusChanges++;
      else if (a.icon === 'block') blockersOpened++;
    }
    return {
      tasksCompleted,
      tasksCreated,
      projectsCreated,
      comments,
      statusChanges,
      blockersOpened,
    };
  }, [items]);
}

export function ActivityScreen() {
  const { currentWorkspace: brand, data } = useWorkspace();
  const items = data.activity;
  const stats = useRecentStats(items);
  const [activeFilter, setActiveFilter] = useState('all');

  const filtered = useMemo(() => {
    const f = FILTERS.find((f) => f.id === activeFilter);
    return f ? items.filter(f.match) : items;
  }, [items, activeFilter]);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2"><Badge kind="brand" dot>{brand?.name}</Badge></div>
          <h1 className="h1">Activity</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Chronologischer Verlauf aller wichtigen Änderungen in diesem Workspace.
          </p>
        </div>
      </div>

      <div className="row gap-2 mb-4 wrap">
        {FILTERS.map((f) => {
          const count = f.id === 'all' ? items.length : items.filter(f.match).length;
          return (
            <button
              key={f.id}
              className={`chip ${activeFilter === f.id ? 'active' : ''}`}
              onClick={() => setActiveFilter(f.id)}
            >
              {f.label} <span className="count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1.7fr 1fr' }}>
        <div className="card card-pad">
          {filtered.length === 0 ? (
            <p className="meta" style={{ textAlign: 'center', padding: '32px 0' }}>Keine Einträge für diesen Filter.</p>
          ) : (
            <ActivityTimeline items={filtered} />
          )}
        </div>

        <div className="col gap-4">
          <div className="card card-pad">
            <div className="label mb-3">Stats · Letzte 7 Tage</div>
            <div className="col gap-3">
              <StatRow label="Tasks abgeschlossen" value={stats.tasksCompleted} />
              <StatRow label="Tasks erstellt" value={stats.tasksCreated} />
              <StatRow label="Projekte erstellt" value={stats.projectsCreated} />
              <StatRow label="Kommentare" value={stats.comments} />
              <StatRow label="Status-Wechsel" value={stats.statusChanges} />
              <StatRow label="Blocker geöffnet" value={stats.blockersOpened} />
            </div>
          </div>

          <div className="card card-pad">
            <div className="row gap-2 mb-3"><I.slack size={14} /><span className="label">Slack-Sync</span></div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
              Die folgenden Events werden automatisch in den verknüpften Slack-Channel gepostet.
            </p>
            <div className="col gap-2 mt-3">
              <SlackEventRow label="Task erstellt" />
              <SlackEventRow label="Status → Review" />
              <SlackEventRow label="Task abgeschlossen" />
              <SlackEventRow label="Task blockiert" />
              <SlackEventRow label="Projekt erstellt" />
              <SlackEventRow label="Kommentar zu einem Task" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const StatRow = ({ label, value, tone }) => (
  <div className="row between">
    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{label}</span>
    <span className="row gap-2">
      <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{value}</span>
      {tone && <I.trend size={12} color={tone === 'up' ? 'var(--success)' : 'var(--danger)'} />}
    </span>
  </div>
);

const SlackEventRow = ({ label, off }) => (
  <div className="row between">
    <span style={{ fontSize: 13 }}>{label}</span>
    <span style={{ fontSize: 11, color: off ? 'var(--text-4)' : 'var(--success)', fontWeight: 500 }}>
      {off ? 'Off' : '● Auto'}
    </span>
  </div>
);
