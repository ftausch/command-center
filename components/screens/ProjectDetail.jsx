'use client';
// Project Detail page

import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import {
  Avatar, AvatarStack, Badge, BrandBadge,
  PhaseTracker, PriorityBadge, Progress, StatusBadge,
} from '@/components/ui';
import { dueLabel, formatDateLong, projectProgress, timeAgo } from '@/lib/utils';
import { updateProject, deleteProject } from '@/lib/actions/projects';
import { NewTaskModal } from '@/components/NewTaskModal';
import { TaskDrawer } from '@/components/TaskDrawer';

const PROJECT_STATUSES = ['Planning', 'In Progress', 'Review', 'Blocked', 'Done'];
const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];

export function ProjectDetailScreen({ projectId, setRoute }) {
  const { currentWorkspace: brand, data, updateProjectInCache, removeProject } = useWorkspace();
  const project = data.projects.find((p) => p.id === projectId);
  const [tab, setTab] = useState('tasks');
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [drawerTaskId, setDrawerTaskId] = useState(null);

  // ── Inline name editing ───────────────────────────────────────────────────
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [namePending, setNamePending] = useState(false);
  const nameInputRef = useRef(null);

  // ── Inline description editing ────────────────────────────────────────────
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [descPending, setDescPending] = useState(false);
  const descInputRef = useRef(null);

  // ── Field edits (status / priority / due / owner / type) ─────────────────
  const [fieldPending, setFieldPending] = useState(null);
  const [fieldError, setFieldError] = useState(null);

  // ── Delete ────────────────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  // ── Slack channel mapping ─────────────────────────────────────────────────
  const [editingSlack, setEditingSlack] = useState(false);
  const [slackChannelDraft, setSlackChannelDraft] = useState('');
  const [slackConnectedDraft, setSlackConnectedDraft] = useState(false);
  const [slackPending, setSlackPending] = useState(false);

  useEffect(() => { if (editingName) nameInputRef.current?.focus(); }, [editingName]);
  useEffect(() => { if (editingDesc) descInputRef.current?.focus(); }, [editingDesc]);

  if (!project) return <div className="page">Projekt nicht gefunden.</div>;

  const workspaceId = brand?.id ?? '';

  const saveName = async () => {
    const name = nameDraft.trim();
    if (!name || name === project.name) { setEditingName(false); return; }
    setNamePending(true);
    const r = await updateProject({ projectId, workspaceId, patch: { name } });
    setNamePending(false);
    if (!r.ok) { setFieldError(r.error ?? 'Name konnte nicht gespeichert werden'); return; }
    updateProjectInCache(projectId, { name });
    setEditingName(false);
  };

  const saveDesc = async () => {
    const desc = descDraft.trim();
    if (desc === project.desc) { setEditingDesc(false); return; }
    setDescPending(true);
    const r = await updateProject({ projectId, workspaceId, patch: { desc } });
    setDescPending(false);
    if (!r.ok) { setFieldError(r.error ?? 'Beschreibung konnte nicht gespeichert werden'); return; }
    updateProjectInCache(projectId, { desc });
    setEditingDesc(false);
  };

  const saveField = async (key, value) => {
    setFieldPending(key);
    setFieldError(null);
    const r = await updateProject({ projectId, workspaceId, patch: { [key]: value } });
    setFieldPending(null);
    if (!r.ok) { setFieldError(r.error ?? 'Feld konnte nicht gespeichert werden'); return; }
    updateProjectInCache(projectId, { [key]: value });
  };

  const startSlackEdit = () => {
    setSlackChannelDraft(project.slackChannel || '');
    setSlackConnectedDraft(project.slackConnected);
    setEditingSlack(true);
  };

  const saveSlack = async () => {
    const channel = slackChannelDraft.trim();
    const connected = slackConnectedDraft && !!channel;
    setSlackPending(true);
    setFieldError(null);
    const r = await updateProject({ projectId, workspaceId, patch: { slackChannel: channel, slackConnected: connected } });
    setSlackPending(false);
    if (!r.ok) { setFieldError(r.error ?? 'Slack konnte nicht gespeichert werden'); return; }
    updateProjectInCache(projectId, { slackChannel: channel, slackConnected: connected });
    setEditingSlack(false);
  };

  const onDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeletePending(true);
    const r = await deleteProject({ projectId, workspaceId });
    setDeletePending(false);
    if (!r.ok) { setFieldError(r.error ?? 'Projekt konnte nicht gelöscht werden'); setConfirmDelete(false); return; }
    removeProject(projectId);
    setRoute('projects');
  };

  const phases = data.phases;
  const tasks = data.tasks.filter((t) => t.projectId === projectId);
  const progress = projectProgress(tasks);
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
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="row gap-3 mb-2">
            <StatusBadge status={project.status} />
            <PriorityBadge priority={project.priority} />
            <span className={`badge ${due.danger ? 'danger' : 'ghost'}`}><I.calendar size={11} /> Deadline {due.text}</span>
          </div>
          {editingName ? (
            <div className="row gap-2 items-center mb-1">
              <input
                ref={nameInputRef}
                className="input"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                disabled={namePending}
                style={{ fontSize: 20, fontWeight: 700, flex: 1 }}
              />
              <button className="btn btn-brand btn-sm" onClick={saveName} disabled={namePending}>{namePending ? '…' : 'OK'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingName(false)} disabled={namePending}><I.x size={12} /></button>
            </div>
          ) : (
            <h1
              className="h1"
              style={{ fontSize: 26, cursor: 'text', padding: '2px 4px', marginLeft: -4, borderRadius: 4, transition: 'background 0.1s' }}
              onClick={() => { setNameDraft(project.name); setEditingName(true); }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-sunk)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              title="Klicken zum Bearbeiten"
            >
              {project.name}
            </h1>
          )}
          {editingDesc ? (
            <div className="col gap-2 mt-2" style={{ maxWidth: 720 }}>
              <textarea
                ref={descInputRef}
                className="input"
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setEditingDesc(false); }}
                disabled={descPending}
                rows={3}
                style={{ fontSize: 14, resize: 'vertical' }}
              />
              <div className="row gap-2">
                <button className="btn btn-brand btn-sm" onClick={saveDesc} disabled={descPending}>{descPending ? 'Wird gespeichert…' : 'Speichern'}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingDesc(false)} disabled={descPending}>Abbrechen</button>
              </div>
            </div>
          ) : (
            <p
              style={{ color: 'var(--text-2)', fontSize: 14.5, margin: '6px 0 0', maxWidth: 720, cursor: 'text', padding: '2px 4px', marginLeft: -4, borderRadius: 4, transition: 'background 0.1s', minHeight: 24 }}
              onClick={() => { setDescDraft(project.desc); setEditingDesc(true); }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-sunk)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              title="Klicken zum Bearbeiten"
            >
              {project.desc || <span style={{ color: 'var(--text-4)', fontStyle: 'italic' }}>Beschreibung hinzufügen…</span>}
            </p>
          )}
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
              <span className="mono mt-1" style={{ fontSize: 16, fontWeight: 600 }}>{progress}%</span>
            </div>
            <div style={{ width: 180 }}>
              <Progress value={progress} brand />
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
            <Field label="Status">
              <select
                className="input"
                value={project.status}
                onChange={(e) => saveField('status', e.target.value)}
                disabled={fieldPending === 'status'}
                style={{ height: 28, fontSize: 12.5 }}
              >
                {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select
                className="input"
                value={project.priority}
                onChange={(e) => saveField('priority', e.target.value)}
                disabled={fieldPending === 'priority'}
                style={{ height: 28, fontSize: 12.5 }}
              >
                {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Deadline">
              <div className="row gap-2 items-center">
                <input
                  type="date"
                  className="input"
                  value={project.due || ''}
                  onChange={(e) => saveField('due', e.target.value)}
                  disabled={fieldPending === 'due'}
                  style={{ height: 28, fontSize: 12.5, width: 160 }}
                />
                {project.due && (
                  <button className="btn btn-quiet btn-sm" onClick={() => saveField('due', '')} disabled={fieldPending === 'due'} title="Datum entfernen"><I.x size={11} /></button>
                )}
              </div>
            </Field>
            <Field label="Owner">
              <select
                className="input"
                value={project.owner || ''}
                onChange={(e) => saveField('owner', e.target.value)}
                disabled={fieldPending === 'owner'}
                style={{ height: 28, fontSize: 12.5 }}
              >
                <option value="">— Niemand —</option>
                {data.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <input
                className="input"
                defaultValue={project.type}
                onBlur={(e) => { if (e.target.value !== project.type) saveField('type', e.target.value); }}
                disabled={fieldPending === 'type'}
                style={{ height: 28, fontSize: 12.5 }}
              />
            </Field>
            <Field label="Team">
              <AvatarStack users={team} max={6} />
            </Field>
            <Field label="Workspace"><BrandBadge brand={brand} /></Field>
            {fieldError && (
              <div style={{ fontSize: 12, color: 'var(--danger)', padding: '6px 8px', background: 'var(--danger-bg)', borderRadius: 6, border: '1px solid var(--danger-border)', marginTop: 8 }}>
                {fieldError}
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 12, marginTop: 8 }}>
              {confirmDelete ? (
                <div className="col gap-2">
                  <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>Alle Tasks werden ebenfalls gelöscht. Wirklich löschen?</p>
                  <div className="row gap-2">
                    <button className="btn btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }} onClick={onDelete} disabled={deletePending}>
                      {deletePending ? 'Wird gelöscht…' : 'Ja, löschen'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)} disabled={deletePending}>Abbrechen</button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--text-3)', fontSize: 12 }} onClick={onDelete}>
                  <I.x size={11} /> Projekt löschen
                </button>
              )}
            </div>
          </div>

          <div className="card card-pad">
            <div className="row between mb-3">
              <div className="row gap-2"><I.slack size={16} /><span className="h3">Slack Channel</span></div>
              {project.slackConnected
                ? <Badge kind="success" dot>Connected</Badge>
                : <Badge kind="warning" dot>Not connected</Badge>}
            </div>
            {editingSlack ? (
              <div className="col gap-2">
                <input
                  className="input mono"
                  value={slackChannelDraft}
                  onChange={(e) => setSlackChannelDraft(e.target.value)}
                  placeholder="#channel-name"
                  disabled={slackPending}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Escape') setEditingSlack(false); if (e.key === 'Enter') saveSlack(); }}
                  style={{ fontSize: 13 }}
                />
                <label className="row gap-2" style={{ cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={slackConnectedDraft}
                    onChange={(e) => setSlackConnectedDraft(e.target.checked)}
                    disabled={slackPending || !slackChannelDraft.trim()}
                  />
                  Verbinden (Auto-Updates aktivieren)
                </label>
                <div className="row gap-2 mt-1">
                  <button className="btn btn-brand btn-sm" onClick={saveSlack} disabled={slackPending}>
                    {slackPending ? 'Wird gespeichert…' : 'Speichern'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingSlack(false)} disabled={slackPending}>Abbrechen</button>
                </div>
              </div>
            ) : project.slackConnected ? (
              <>
                <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{project.slackChannel}</div>
                <div className="meta mt-1">Automatische Updates: Status-Wechsel, neue Tasks, Deadlines</div>
                <div className="row gap-2 mt-3">
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={startSlackEdit}><I.settings size={13} /> Bearbeiten</button>
                </div>
              </>
            ) : (
              <>
                <p className="meta" style={{ margin: '4px 0 12px' }}>Kein Slack-Channel verknüpft. Aufgaben werden nicht automatisch in Slack gespiegelt.</p>
                <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={startSlackEdit}>
                  <I.slack size={13} /> Slack verbinden
                </button>
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
