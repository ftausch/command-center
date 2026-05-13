'use client';
// Project Detail page

import { useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import {
  Avatar, AvatarStack, Badge, BrandBadge,
  PhaseTracker, PriorityBadge, Progress, StatusBadge,
} from '@/components/ui';
import { dueLabel, formatDateLong, timeAgo } from '@/lib/utils';
import { NewTaskModal } from '@/components/NewTaskModal';
import { TaskDrawer } from '@/components/TaskDrawer';

export function ProjectDetailScreen({ projectId, setRoute }) {
  const { currentWorkspace: brand, data } = useWorkspace();
  const project = data.projects.find((p) => p.id === projectId);
  const [tab, setTab] = useState('tasks');
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [drawerTaskId, setDrawerTaskId] = useState(null);

  if (!project) return <div className="page">Projekt nicht gefunden.</div>;

  const phases = data.phases;
  const tasks = data.tasks.filter((t) => t.projectId === projectId);
  // Project-wide read-only roll-up of comments already in cache. The
  // per-task write surface lives in the TaskDrawer (open a task to add a
  // comment) — anchoring the write to a specific task is the whole
  // reason the drawer exists.
  const projectComments = tasks.flatMap((t) => data.taskComments?.[t.id] ?? []);

  const team = project.team
    .map((id) => data.members.find((u) => u.id === id))
    .filter(Boolean);
  const owner = data.members.find((u) => u.id === project.owner);
  const due = dueLabel(project.due);
  const activity = data.activity
    .filter((a) => a.target === projectId || tasks.some((t) => t.id === a.target))
    .slice(0, 10);

  return (
    <div className="page fade-in">
      <div className="row gap-2 mb-3" style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
        <button className="btn btn-quiet btn-sm" onClick={() => setRoute('projects')} style={{ padding: '0 6px', height: 22 }}>Projects</button>
        <I.chevron size={11} />
        <Badge kind="brand" dot>{brand?.name}</Badge>
        <I.chevron size={11} />
        <span>{project.type}</span>
      </div>

      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div className="row gap-3 mb-2">
            <StatusBadge status={project.status} />
            <PriorityBadge priority={project.priority} />
            <span className={`badge ${due.danger ? 'danger' : 'ghost'}`}><I.calendar size={11} /> Deadline {due.text}</span>
          </div>
          <h1 className="h1" style={{ fontSize: 26 }}>{project.name}</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14.5, margin: '6px 0 0', maxWidth: 720 }}>{project.desc}</p>
        </div>
        <div className="row gap-2">
          {project.slackConnected && project.slackChannel ? (
            <a
              className="btn btn-ghost btn-sm"
              href={`https://slack.com/app_redirect?channel=${encodeURIComponent(project.slackChannel.replace(/^#/, ''))}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <I.slack size={13} /> Open in Slack
            </a>
          ) : (
            <button className="btn btn-ghost btn-sm" disabled title="Kein Slack-Channel verknüpft">
              <I.slack size={13} /> Open in Slack
            </button>
          )}
          <button className="btn btn-ghost btn-sm" disabled title="Noch nicht verfügbar"><I.more size={14} /></button>
          <button className="btn btn-brand btn-sm" onClick={() => setNewTaskOpen(true)}><I.plus size={13} /> New Task</button>
        </div>
      </div>

      <NewTaskModal
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        initialProjectId={projectId}
      />

      <TaskDrawer
        taskId={drawerTaskId}
        projectId={projectId}
        onClose={() => setDrawerTaskId(null)}
      />

      <div className="card card-pad mb-4">
        <div className="row between mb-3">
          <div>
            <div className="label">Episode Phase</div>
            <div className="row gap-2 mt-1">
              <span style={{ fontSize: 16, fontWeight: 600 }}>{phases[project.phaseIdx]}</span>
              <span className="meta">· Schritt {project.phaseIdx + 1} von {phases.length}</span>
            </div>
          </div>
          <div className="row gap-3">
            <div className="col items-end">
              <span className="label">Progress</span>
              <span className="mono mt-1" style={{ fontSize: 16, fontWeight: 600 }}>{project.progress}%</span>
            </div>
            <div style={{ width: 180 }}>
              <Progress value={project.progress} brand />
              <div className="meta mt-1" style={{ textAlign: 'right' }}>{tasks.filter((t) => t.status === 'Done').length}/{tasks.length} Tasks done</div>
            </div>
          </div>
        </div>
        <PhaseTracker phases={phases} currentIdx={project.phaseIdx} />
      </div>

      <div className="tabs mb-4">
        <div className={`tab ${tab === 'tasks' ? 'active' : ''}`} onClick={() => setTab('tasks')}>Tasks <span className="count">{tasks.length}</span></div>
        <div className={`tab ${tab === 'activity' ? 'active' : ''}`} onClick={() => setTab('activity')}>Activity <span className="count">{activity.length}</span></div>
        <div className={`tab ${tab === 'comments' ? 'active' : ''}`} onClick={() => setTab('comments')}>Comments <span className="count">{projectComments.length}</span></div>
        <div className={`tab ${tab === 'files' ? 'active' : ''}`} onClick={() => setTab('files')}>Files <span className="count">{project.links?.length ?? 0}</span></div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1.7fr 1fr' }}>
        <div className="col gap-4">
          {tab === 'tasks' && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table className="table">
                <thead><tr><th>Task</th><th>Status</th><th>Assignee</th><th>Priority</th><th>Due</th></tr></thead>
                <tbody>
                  {tasks.map((t) => {
                    const a = data.members.find((u) => u.id === t.assignee);
                    const waiting = data.members.find((u) => u.id === t.waitingOn);
                    const td = dueLabel(t.due);
                    return (
                      <tr key={t.id} onClick={() => setDrawerTaskId(t.id)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{t.title}</div>
                          {t.blocker && <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 2 }}><I.block size={11} /> {t.blocker}</div>}
                          {waiting && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>Wartet auf {waiting.name}</div>}
                        </td>
                        <td><StatusBadge status={t.status} /></td>
                        <td>
                          {a ? (
                            <div className="row gap-2"><Avatar user={a} /><span style={{ fontSize: 12.5 }}>{a.name.split(' ')[0]}</span></div>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-4)' }}>—</span>
                          )}
                        </td>
                        <td><PriorityBadge priority={t.priority} /></td>
                        <td><span className={`badge ${td.danger ? 'danger' : td.today ? 'warning' : 'ghost'}`}>{td.text}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'activity' && (
            <div className="card">
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
                <div className="h3">Aktivitätsverlauf</div>
              </div>
              <div style={{ padding: 18 }}>
                <ActivityTimeline items={activity} />
              </div>
            </div>
          )}

          {tab === 'comments' && (
            <div className="card card-pad">
              <div className="col gap-4">
                {projectComments.length === 0 ? (
                  <div className="meta" style={{ padding: '8px 0' }}>
                    Noch keine Kommentare zu Tasks dieses Projekts. Öffne einen Task im Tasks-Tab, um zu kommentieren.
                  </div>
                ) : (
                  <>
                    <div className="meta">Antworten direkt im Task öffnen (Tab "Tasks").</div>
                    {projectComments.map((c) => (
                      <CommentItem key={c.id} authorId={c.author} time={timeAgo(c.time)} text={c.text} />
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {tab === 'files' && (
            <div className="card card-pad">
              <div className="col gap-2">
                {(project.links ?? []).length === 0 && (
                  <div className="meta" style={{ padding: '8px 0' }}>
                    Keine Dateien oder Links zu diesem Projekt.
                  </div>
                )}
                {(project.links ?? []).map((l, i) => (
                  <div key={i} className="row gap-3" style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                    <I.link size={14} color="var(--text-3)" />
                    <span style={{ flex: 1, fontSize: 13 }}>{l.label}</span>
                    <button className="btn btn-quiet btn-sm" disabled title="Noch nicht verfügbar">Open <I.arrowRight size={11} /></button>
                  </div>
                ))}
                <button className="btn btn-ghost btn-sm mt-2" style={{ alignSelf: 'flex-start' }} disabled title="Noch nicht verfügbar"><I.plus size={13} /> Link hinzufügen</button>
              </div>
            </div>
          )}
        </div>

        <div className="col gap-4">
          <div className="card card-pad">
            <div className="label mb-3">Project Details</div>
            <Field label="Owner">
              {owner ? (
                <div className="row gap-2"><Avatar user={owner} /><span style={{ fontWeight: 500 }}>{owner.name}</span></div>
              ) : (
                <span style={{ color: 'var(--text-4)' }}>—</span>
              )}
            </Field>
            <Field label="Team">
              <AvatarStack users={team} max={6} />
            </Field>
            <Field label="Deadline">
              <span style={{ fontWeight: 500 }}>{formatDateLong(project.due)}</span>
              <div className={due.danger ? 'badge danger' : 'badge ghost'} style={{ marginTop: 4, fontSize: 11 }}>{due.text}</div>
            </Field>
            <Field label="Type">{project.type}</Field>
            <Field label="Workspace"><BrandBadge brand={brand} /></Field>
          </div>

          <div className="card card-pad">
            <div className="row between mb-3">
              <div className="row gap-2"><I.slack size={16} /><span className="h3">Slack Channel</span></div>
              {project.slackConnected ? <Badge kind="success" dot>Connected</Badge> : <Badge kind="warning" dot>Not connected</Badge>}
            </div>
            {project.slackConnected ? (
              <>
                <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{project.slackChannel}</div>
                <div className="meta mt-1">Automatische Updates: Status-Wechsel, neue Tasks, Deadlines</div>
                <div className="row gap-2 mt-3">
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} disabled title="Direkt-Link kommt mit der nächsten Slack-Slice">Open Channel</button>
                  <button className="btn btn-quiet btn-sm" disabled title="Noch nicht verfügbar"><I.settings size={13} /></button>
                </div>
              </>
            ) : (
              <>
                <p className="meta" style={{ margin: '4px 0 12px' }}>Kein Slack-Channel verknüpft. Aufgaben werden nicht automatisch in Slack gespiegelt.</p>
                <button className="btn btn-ghost btn-sm" style={{ width: '100%' }}><I.slack size={13} /> Slack verbinden</button>
              </>
            )}
          </div>

          {project.links?.length > 0 && (
            <div className="card card-pad">
              <div className="label mb-3">Wichtige Links</div>
              <div className="col gap-2">
                {project.links.map((l, i) => (
                  <a key={i} className="row gap-2" style={{ fontSize: 13, color: 'var(--text-1)', padding: '6px 0' }}>
                    <I.link size={13} color="var(--text-3)" /> {l.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div className="label" style={{ marginBottom: 5 }}>{label}</div>
    <div style={{ fontSize: 13.5 }}>{children}</div>
  </div>
);

function CommentItem({ authorId, time, text }) {
  const { data } = useWorkspace();
  const u = data.members.find((m) => m.id === authorId);
  if (!u) return null;
  return (
    <div className="row gap-3 items-start">
      <Avatar user={u} size="md" />
      <div style={{ flex: 1 }}>
        <div className="row gap-2">
          <span style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</span>
          <span className="meta">{time}</span>
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--text-1)', marginTop: 4, lineHeight: 1.55 }}>{text}</div>
      </div>
    </div>
  );
}

export function ActivityTimeline({ items }) {
  const { data } = useWorkspace();
  return (
    <div className="col gap-3">
      {items.map((a) => {
        const u = data.members.find((m) => m.id === a.user);
        const iconMap = {
          check: <I.check size={12} />,
          message: <I.message size={12} />,
          paperclip: <I.paperclip size={12} />,
          block: <I.block size={12} />,
          plus: <I.plus size={12} />,
          slack: <I.slack size={12} />,
          user: <I.user size={12} />,
          'arrow-right': <I.arrowRight size={12} />,
          calendar: <I.calendar size={12} />,
        };
        return (
          <div key={a.id} className="row gap-3 items-start">
            <div style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--bg-sunk)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', flexShrink: 0 }}>
              {iconMap[a.icon]}
            </div>
            <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 600 }}>{u?.name || a.user}</span>{' '}
              <span style={{ color: 'var(--text-2)' }}>{a.verb}</span>{' '}
              <span style={{ fontWeight: 500 }}>{a.target}</span>
              {a.meta && <span style={{ color: 'var(--text-3)' }}> — {a.meta}</span>}
              <div className="meta mt-1">{timeAgo(a.time)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
