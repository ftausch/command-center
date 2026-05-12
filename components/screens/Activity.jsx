'use client';
// Activity Feed

import { D } from '@/lib/data';
import { I } from '@/components/icons';
import { Badge } from '@/components/ui';
import { ActivityTimeline } from '@/components/screens/ProjectDetail';

export function ActivityScreen({ workspace }) {
  const items = D.activity.filter(a => a.workspace === workspace);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2"><Badge kind="brand" dot>{D.brands[workspace].name}</Badge></div>
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
              <StatRow label="Tasks abgeschlossen" value="12" tone="up" />
              <StatRow label="Tasks erstellt" value="18" />
              <StatRow label="Kommentare" value="34" />
              <StatRow label="Slack-Notifications" value="9" />
              <StatRow label="Status-Wechsel" value="47" />
              <StatRow label="Blocker geöffnet" value="3" tone="down" />
              <StatRow label="Blocker gelöst" value="2" />
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
              <SlackEventRow label="Status → Blocked" />
              <SlackEventRow label="Task abgeschlossen" off />
              <SlackEventRow label="Deadline geändert" />
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
