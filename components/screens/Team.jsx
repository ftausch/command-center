'use client';
// Team View

import { useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Avatar, Badge } from '@/components/ui';
import { daysUntil } from '@/lib/utils';
import { KPI } from '@/components/screens/Dashboard';
import { InvitePersonModal } from '@/components/InvitePersonModal';
import { MemberManageModal } from '@/components/MemberManageModal';
import { CAN } from '@/lib/roles';

export function TeamScreen({ setRoute }) {
  const { currentWorkspace: brand, data, myRole } = useWorkspace();
  const users = data.members;
  const tasks = data.tasks;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [manageMember, setManageMember] = useState(null);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2"><Badge kind="brand" dot>{brand?.name}</Badge></div>
          <h1 className="h1">Team</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Wer arbeitet gerade woran. Auslastung pro Person. Filter nach Rolle, Status, Workspace.
          </p>
        </div>
        <div className="row gap-2">
          <button className="btn btn-ghost btn-sm" disabled title="Noch nicht verfügbar"><I.filter size={13} /> Filter</button>
          {CAN.inviteMember(myRole) && (
            <button className="btn btn-brand btn-sm" onClick={() => setInviteOpen(true)}><I.plus size={13} /> Person einladen</button>
          )}
        </div>
      </div>

      <InvitePersonModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <MemberManageModal
        open={manageMember !== null}
        member={manageMember}
        onClose={() => setManageMember(null)}
      />

      <div className="grid grid-4 gap-3 mb-6">
        <KPI label="Teammitglieder" value={users.length} trend={`${users.filter((u) => u.online).length} online`} />
        <KPI label="Offene Tasks" value={tasks.filter((t) => t.status !== 'Done').length} trend="Gesamtauslastung 78%" />
        <KPI label="Überfällig" value={tasks.filter((t) => t.status !== 'Done' && daysUntil(t.due) < 0).length} trend="auf 2 Personen verteilt" tone="bad" />
        <KPI label="Ø Tasks pro Person" value={users.length ? Math.round((tasks.filter((t) => t.status !== 'Done').length / users.length) * 10) / 10 : 0} trend="Balance gut" tone="ok" />
      </div>

      {users.length === 0 && (
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👤</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Noch keine Teammitglieder</div>
          <div className="meta" style={{ marginBottom: 16 }}>Lade Kolleg:innen ein um gemeinsam Tasks und Projekte zu verwalten.</div>
          {CAN.inviteMember(myRole) && (
            <button className="btn btn-brand btn-sm" onClick={() => setInviteOpen(true)} style={{ margin: '0 auto' }}>
              <I.plus size={13} /> Erste Person einladen
            </button>
          )}
        </div>
      )}

      <div className="grid grid-2 gap-3">
        {users.map((u) => {
          const userTasks = tasks.filter((t) => t.assignee === u.id);
          const open = userTasks.filter((t) => t.status !== 'Done');
          const overdue = open.filter((t) => daysUntil(t.due) < 0);
          const inProgress = open.filter((t) => t.status === 'In Progress');
          const load = Math.min(100, open.length * 14);
          const overLoaded = load > 80;
          return (
            <div key={u.id} className="card card-pad">
              <div className="row between mb-3">
                <div className="row gap-3">
                  <div style={{ position: 'relative' }}>
                    <Avatar user={u} size="lg" />
                    {u.online && <span style={{
                      position: 'absolute', bottom: 0, right: 0,
                      width: 10, height: 10, borderRadius: 999,
                      background: 'var(--success)', border: '2px solid var(--bg-elev)',
                    }} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>{u.name}</div>
                    <div className="meta">{u.role}</div>
                  </div>
                </div>
                {CAN.manageMember(myRole) && (
                  <button
                    className="btn btn-quiet btn-sm"
                    onClick={() => setManageMember(u)}
                    title="Mitglied verwalten"
                  ><I.more size={14} /></button>
                )}
              </div>

              <div className="row gap-4 mb-3">
                <SmallStat label="Offen" value={open.length} />
                <SmallStat label="In Progress" value={inProgress.length} />
                <SmallStat label="Überfällig" value={overdue.length} tone={overdue.length > 0 ? 'bad' : ''} />
              </div>

              <div className="mb-3">
                <div className="row between" style={{ marginBottom: 6 }}>
                  <span className="label">Workload</span>
                  <span className="mono" style={{ fontSize: 11.5, color: overLoaded ? 'var(--danger)' : 'var(--text-3)' }}>{load}%</span>
                </div>
                <div className="progress" style={{ height: 5 }}>
                  <div className="progress-bar" style={{ width: load + '%', background: overLoaded ? 'var(--danger)' : load > 60 ? 'var(--warning)' : 'var(--brand)' }} />
                </div>
              </div>

              <div className="col gap-1 mt-2" style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 10 }}>
                <div className="label" style={{ marginBottom: 4 }}>Aktuell</div>
                {open.slice(0, 2).map((t) => {
                  const p = data.projects.find((pr) => pr.id === t.projectId);
                  return (
                    <div key={t.id} className="row gap-2" style={{ padding: '4px 0', fontSize: 12.5, cursor: 'pointer' }} onClick={() => setRoute('project:' + t.projectId)}>
                      <span className="dot-indicator" style={{ background: t.status === 'Blocked' ? 'var(--danger)' : t.status === 'In Progress' ? 'var(--info)' : 'var(--text-3)' }} />
                      <span className="truncate" style={{ flex: 1 }}>{t.title}</span>
                      <span className="meta">{p?.name.split('—')[0]?.trim() || p?.name}</span>
                    </div>
                  );
                })}
                {open.length === 0 && <div className="meta">Keine offenen Tasks</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SmallStat = ({ label, value, tone }) => (
  <div>
    <div className="label" style={{ fontSize: 10 }}>{label}</div>
    <div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: 2, color: tone === 'bad' ? 'var(--danger)' : 'var(--text-1)' }}>{value}</div>
  </div>
);
