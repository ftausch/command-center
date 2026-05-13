'use client';
// Activity Feed

import { useMemo } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Badge } from '@/components/ui';
import { ActivityTimeline } from '@/components/screens/ProjectDetail';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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
        <div className="row gap-2">
          <button className="btn btn-ghost btn-sm"><I.filter size={13} /> Filter</button>
        </div>
      </div>

      <div className="row gap-2 mb-4 wrap">
        <button className="chip active">Alle <span className="count">{items.length}</span></button>
        <button className="chip">Status</button>
        <button className="chip">Comments</button>
        <button className="chip">Slack</button>
        <button className="chip">Assignments</button>
        <button className="chip">Blocked</button>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1.7fr 1fr' }}>
        <div className="card card-pad">
          <ActivityTimeline items={items} />
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
