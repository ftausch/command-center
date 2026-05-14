'use client';
// Task detail drawer — right-side slide-in panel.
//
// Phase 2 additions over Phase 1:
//   - Inline title editing (click title to edit)
//   - Editable detail fields: priority, due date, assignee (save on change)
//   - Delete task (manager+ only; two-click confirm)

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Avatar, StatusBadge } from '@/components/ui';
import { dueLabel, timeAgo } from '@/lib/utils';
import {
  changeTaskStatus,
  deleteTask,
  markTaskBlocked,
  markTaskDone,
  updateTask,
} from '@/lib/actions/tasks';
import { addTaskComment, listTaskComments } from '@/lib/actions/comments';
import {
  addChecklistItem,
  listTaskChecklist,
  toggleChecklistItem,
} from '@/lib/actions/checklist';

const STATUS_OPTIONS = ['Backlog', 'To Do', 'In Progress', 'Review', 'Blocked', 'Done'];
const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];

export function TaskDrawer({ taskId, projectId, onClose }) {
  const {
    currentWorkspaceId: workspaceId,
    data,
    me,
    updateTaskInCache,
    removeTask,
    addTaskComment: addTaskCommentToCache,
    addChecklistItem: addChecklistItemToCache,
    updateChecklistItemInCache,
    pushActivity,
  } = useWorkspace();

  const task = useMemo(
    () => data.tasks.find((t) => t.id === taskId) ?? null,
    [data.tasks, taskId],
  );
  const project = useMemo(
    () => data.projects.find((p) => p.id === projectId) ?? null,
    [data.projects, projectId],
  );
  const assignee = useMemo(
    () => (task ? data.members.find((m) => m.id === task.assignee) : null),
    [data.members, task],
  );

  // ── Comments ──────────────────────────────────────────────────────────────
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentPending, setCommentPending] = useState(false);
  const [commentError, setCommentError] = useState(null);

  // ── Checklist ─────────────────────────────────────────────────────────────
  const [checklist, setChecklist] = useState([]);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemPending, setNewItemPending] = useState(false);

  // ── Status / blocker ──────────────────────────────────────────────────────
  const [statusPending, setStatusPending] = useState(false);
  const [blockerPending, setBlockerPending] = useState(false);
  const [showBlocker, setShowBlocker] = useState(false);
  const [blockerReason, setBlockerReason] = useState('');
  const [actionError, setActionError] = useState(null);

  // ── Title inline edit ─────────────────────────────────────────────────────
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [titlePending, setTitlePending] = useState(false);
  const titleInputRef = useRef(null);

  // ── Description inline edit ───────────────────────────────────────────────
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [descPending, setDescPending] = useState(false);
  const descRef = useRef(null);

  // ── Field edits (priority / due / assignee) ───────────────────────────────
  const [fieldPending, setFieldPending] = useState(null);

  // ── Delete ────────────────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  const taskIdRef = useRef(taskId);
  taskIdRef.current = taskId;

  useEffect(() => {
    if (!taskId || !workspaceId) {
      setComments([]);
      setChecklist([]);
      return;
    }
    setCommentsLoading(true);
    setCommentError(null);
    let cancelled = false;
    (async () => {
      const [c, cl] = await Promise.all([
        listTaskComments({ workspaceId, taskId }),
        listTaskChecklist({ workspaceId, taskId }),
      ]);
      if (cancelled || taskIdRef.current !== taskId) return;
      setComments(c.ok && c.data ? c.data : []);
      setChecklist(cl.ok && cl.data ? cl.data : []);
      setCommentsLoading(false);
      if (!c.ok) setCommentError(c.error ?? 'Kommentare konnten nicht geladen werden');
    })();
    return () => { cancelled = true; };
  }, [taskId, workspaceId]);

  // Reset per-task UI state when task switches.
  useEffect(() => {
    setEditingTitle(false);
    setEditingDesc(false);
    setConfirmDelete(false);
    setActionError(null);
  }, [taskId]);

  // Focus title input when editing starts.
  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  // Focus description textarea when editing starts.
  useEffect(() => {
    if (editingDesc) descRef.current?.focus();
  }, [editingDesc]);

  const busy = commentPending || statusPending || blockerPending || newItemPending || titlePending || descPending || deletePending;

  useEffect(() => {
    if (!taskId) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) {
        if (editingTitle) { setEditingTitle(false); return; }
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [taskId, busy, editingTitle, onClose]);

  if (!taskId || !task) return null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const saveDesc = async () => {
    const description = descDraft.trim();
    if (description === (task.description ?? '')) { setEditingDesc(false); return; }
    setDescPending(true);
    setActionError(null);
    const r = await updateTask({ taskId, workspaceId, patch: { description } });
    setDescPending(false);
    if (!r.ok) { setActionError(r.error ?? 'Beschreibung konnte nicht gespeichert werden'); return; }
    updateTaskInCache(taskId, { description });
    setEditingDesc(false);
  };

  const saveTitle = async () => {
    const title = titleDraft.trim();
    if (!title || title === task.title) { setEditingTitle(false); return; }
    setTitlePending(true);
    setActionError(null);
    const r = await updateTask({ taskId, workspaceId, patch: { title } });
    setTitlePending(false);
    if (!r.ok) { setActionError(r.error ?? 'Titel konnte nicht gespeichert werden'); return; }
    updateTaskInCache(taskId, { title });
    setEditingTitle(false);
  };

  const saveField = async (key, value) => {
    setFieldPending(key);
    setActionError(null);
    const r = await updateTask({ taskId, workspaceId, patch: { [key]: value } });
    setFieldPending(null);
    if (!r.ok) { setActionError(r.error ?? 'Feld konnte nicht gespeichert werden'); return; }
    updateTaskInCache(taskId, { [key]: value });
  };

  const submitComment = async () => {
    const body = commentText.trim();
    if (!body) return;
    setCommentPending(true);
    setCommentError(null);
    const result = await addTaskComment({ workspaceId, taskId, body });
    setCommentPending(false);
    if (!result.ok || !result.data) {
      setCommentError(result.error ?? 'Kommentar konnte nicht gesendet werden');
      return;
    }
    setComments((prev) => [...prev, result.data]);
    addTaskCommentToCache(result.data);
    if (result.activity) pushActivity(result.activity);
    setCommentText('');
  };

  const onStatusChange = async (next) => {
    if (!task || next === task.status || statusPending) return;
    setActionError(null);
    setStatusPending(true);
    if (next === 'Done') {
      const r = await markTaskDone({ taskId, workspaceId, from: task.status });
      setStatusPending(false);
      if (!r.ok) return setActionError(r.error ?? 'Status konnte nicht geändert werden');
      updateTaskInCache(taskId, { status: 'Done' });
      if (r.activity) pushActivity(r.activity);
      return;
    }
    if (next === 'Blocked') {
      setShowBlocker(true);
      setStatusPending(false);
      return;
    }
    const r = await changeTaskStatus({ taskId, workspaceId, from: task.status, to: next });
    setStatusPending(false);
    if (!r.ok) return setActionError(r.error ?? 'Status konnte nicht geändert werden');
    updateTaskInCache(taskId, { status: next });
    if (r.activity) pushActivity(r.activity);
  };

  const submitBlocker = async () => {
    const reason = blockerReason.trim();
    setActionError(null);
    setBlockerPending(true);
    const r = await markTaskBlocked({ taskId, workspaceId, reason: reason || undefined });
    setBlockerPending(false);
    if (!r.ok) return setActionError(r.error ?? 'Blocker konnte nicht gesetzt werden');
    updateTaskInCache(taskId, { status: 'Blocked', blocker: reason || null });
    if (r.activity) pushActivity(r.activity);
    setShowBlocker(false);
    setBlockerReason('');
  };

  const submitChecklistItem = async () => {
    const label = newItemLabel.trim();
    if (!label) return;
    setNewItemPending(true);
    const r = await addChecklistItem({ workspaceId, taskId, label, position: checklist.length });
    setNewItemPending(false);
    if (!r.ok || !r.data) { setActionError(r.error ?? 'Checklist-Item konnte nicht angelegt werden'); return; }
    setChecklist((prev) => [...prev, r.data]);
    addChecklistItemToCache(r.data);
    setNewItemLabel('');
  };

  const onToggleChecklistItem = async (item) => {
    const next = !item.done;
    setChecklist((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: next } : i)));
    const r = await toggleChecklistItem({ workspaceId, taskId, itemId: item.id, done: next });
    if (!r.ok) {
      setChecklist((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: item.done } : i)));
      setActionError(r.error ?? 'Checklist-Item konnte nicht aktualisiert werden');
      return;
    }
    updateChecklistItemInCache(taskId, item.id, { done: next });
    if (r.activity) pushActivity(r.activity);
  };

  const onDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeletePending(true);
    const r = await deleteTask({ taskId, workspaceId });
    setDeletePending(false);
    if (!r.ok) { setActionError(r.error ?? 'Task konnte nicht gelöscht werden'); setConfirmDelete(false); return; }
    removeTask(taskId);
    onClose();
  };

  const due = task.due ? dueLabel(task.due) : null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(20,22,28,0.45)', display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          background: 'var(--bg-elev)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-12px 0 32px rgba(20,22,28,0.08)',
          overflowY: 'auto',
          padding: '20px 22px 28px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        {/* ── Header ── */}
        <div className="row between items-start">
          <div style={{ minWidth: 0, flex: 1 }}>
            {project && (
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 6 }}>{project.name}</div>
            )}
            {editingTitle ? (
              <div className="row gap-2 items-center">
                <input
                  ref={titleInputRef}
                  className="input"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveTitle();
                    if (e.key === 'Escape') setEditingTitle(false);
                  }}
                  disabled={titlePending}
                  style={{ fontSize: 16, fontWeight: 600, flex: 1 }}
                />
                <button className="btn btn-brand btn-sm" onClick={saveTitle} disabled={titlePending}>
                  {titlePending ? '…' : 'OK'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingTitle(false)} disabled={titlePending}>
                  <I.x size={12} />
                </button>
              </div>
            ) : (
              <div
                onClick={() => { setTitleDraft(task.title); setEditingTitle(true); }}
                title="Klicken zum Bearbeiten"
                style={{
                  fontSize: 18, fontWeight: 600, lineHeight: 1.3,
                  cursor: 'text',
                  padding: '2px 4px', marginLeft: -4, borderRadius: 4,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-sunk)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {task.title}
              </div>
            )}
          </div>
          <button type="button" className="btn btn-quiet btn-icon" onClick={onClose} disabled={busy} title="Schließen">
            <I.x size={14} />
          </button>
        </div>

        {/* ── Status badge row ── */}
        <div className="row gap-2 wrap">
          <StatusBadge status={task.status} />
          {due && <span className={`badge ${due.danger ? 'danger' : due.today ? 'warning' : 'ghost'}`}>{due.text}</span>}
        </div>

        {/* ── Editable detail fields ── */}
        <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 12 }}>
          <DetailRow label="Priority">
            <select
              className="input"
              value={task.priority}
              onChange={(e) => saveField('priority', e.target.value)}
              disabled={fieldPending === 'priority'}
              style={{ height: 28, fontSize: 12.5, minWidth: 0 }}
            >
              {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </DetailRow>
          <DetailRow label="Fällig am">
            <input
              type="date"
              className="input"
              value={task.due || ''}
              onChange={(e) => saveField('due', e.target.value)}
              disabled={fieldPending === 'due'}
              style={{ height: 28, fontSize: 12.5, width: 160 }}
            />
            {task.due && (
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => saveField('due', '')}
                disabled={fieldPending === 'due'}
                title="Datum entfernen"
              ><I.x size={11} /></button>
            )}
          </DetailRow>
          <DetailRow label="Assignee">
            <select
              className="input"
              value={task.assignee || ''}
              onChange={(e) => saveField('assignee', e.target.value)}
              disabled={fieldPending === 'assignee'}
              style={{ height: 28, fontSize: 12.5, flex: 1 }}
            >
              <option value="">— Niemand —</option>
              {data.members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            {assignee && <Avatar user={assignee} />}
          </DetailRow>
          <DetailRow label="Wartet auf">
            <select
              className="input"
              value={task.waitingOn || ''}
              onChange={(e) => saveField('waitingOn', e.target.value)}
              disabled={fieldPending === 'waitingOn'}
              style={{ height: 28, fontSize: 12.5, flex: 1 }}
            >
              <option value="">— Niemand —</option>
              {data.members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </DetailRow>
          {(data.episodes ?? []).length > 0 && (
            <DetailRow label="Episode">
              <select
                className="input"
                value={task.episodeId || ''}
                onChange={(e) => saveField('episodeId', e.target.value)}
                disabled={fieldPending === 'episodeId'}
                style={{ height: 28, fontSize: 12.5, flex: 1 }}
              >
                <option value="">— Keine Episode —</option>
                {(data.episodes ?? []).map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.num ? `Ep. ${ep.num} · ` : ''}{ep.title}
                  </option>
                ))}
              </select>
            </DetailRow>
          )}
        </div>

        {/* ── Description ── */}
        <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 12 }}>
          {editingDesc ? (
            <div className="col gap-2">
              <textarea
                ref={descRef}
                className="input"
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setEditingDesc(false); }}
                disabled={descPending}
                rows={4}
                placeholder="Beschreibung…"
                style={{ fontSize: 13.5, resize: 'vertical', lineHeight: 1.55 }}
              />
              <div className="row gap-2">
                <button type="button" className="btn btn-brand btn-sm" onClick={saveDesc} disabled={descPending}>
                  {descPending ? 'Wird gespeichert…' : 'Speichern'}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingDesc(false)} disabled={descPending}>Abbrechen</button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => { setDescDraft(task.description ?? ''); setEditingDesc(true); }}
              title="Klicken zum Bearbeiten"
              style={{
                fontSize: 13.5, color: task.description ? 'var(--text-1)' : 'var(--text-4)',
                fontStyle: task.description ? 'normal' : 'italic',
                lineHeight: 1.6, cursor: 'text',
                padding: '6px 8px', marginLeft: -8, borderRadius: 6,
                minHeight: 36, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-sunk)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {task.description || 'Beschreibung hinzufügen…'}
            </div>
          )}
        </div>

        {/* ── Blocker banner ── */}
        {task.blocker && (
          <div style={{ fontSize: 12.5, color: 'var(--danger)', padding: '8px 10px', background: 'var(--danger-bg)', borderRadius: 6, border: '1px solid var(--danger-border)' }}>
            <I.block size={12} /> {task.blocker}
          </div>
        )}

        {/* ── Status change ── */}
        <div className="col gap-2" style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 14 }}>
          <div className="label">Status ändern</div>
          <div className="row gap-2 wrap">
            <select
              className="input"
              value={task.status}
              onChange={(e) => onStatusChange(e.target.value)}
              disabled={statusPending || blockerPending}
              style={{ flex: 1, minWidth: 160 }}
            >
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {task.status !== 'Done' && (
              <button type="button" className="btn btn-brand btn-sm" onClick={() => onStatusChange('Done')} disabled={statusPending}>
                <I.check size={12} /> Mark Done
              </button>
            )}
          </div>
          {showBlocker && (
            <div className="col gap-2 mt-2">
              <input
                className="input"
                placeholder="Grund (optional) — was blockiert die Task?"
                value={blockerReason}
                onChange={(e) => setBlockerReason(e.target.value)}
                disabled={blockerPending}
                autoFocus
              />
              <div className="row gap-2">
                <button type="button" className="btn btn-brand btn-sm" onClick={submitBlocker} disabled={blockerPending}>
                  {blockerPending ? 'Wird gespeichert…' : 'Als blockiert markieren'}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowBlocker(false); setBlockerReason(''); }} disabled={blockerPending}>
                  Abbrechen
                </button>
              </div>
            </div>
          )}
          {actionError && (
            <div style={{ fontSize: 12.5, color: 'var(--danger)', padding: '6px 8px', background: 'var(--danger-bg)', borderRadius: 6, border: '1px solid var(--danger-border)' }}>
              {actionError}
            </div>
          )}
        </div>

        {/* ── Checklist ── */}
        <div className="col gap-2" style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 14 }}>
          <div className="row between">
            <div className="label">Checkliste</div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {checklist.filter((i) => i.done).length}/{checklist.length}
            </span>
          </div>
          <div className="col gap-1">
            {checklist.map((item) => (
              <label key={item.id} className="row gap-2 items-center" style={{ padding: '4px 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={item.done} onChange={() => onToggleChecklistItem(item)} />
                <span style={{ fontSize: 13.5, color: item.done ? 'var(--text-3)' : 'var(--text-1)', textDecoration: item.done ? 'line-through' : 'none' }}>
                  {item.label}
                </span>
              </label>
            ))}
            {checklist.length === 0 && <div className="meta">Noch keine Checklist-Items.</div>}
          </div>
          <div className="row gap-2 mt-1">
            <input
              className="input"
              placeholder="Neues Checklist-Item …"
              value={newItemLabel}
              onChange={(e) => setNewItemLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !newItemPending) submitChecklistItem(); }}
              disabled={newItemPending}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn-quiet btn-sm" onClick={submitChecklistItem} disabled={newItemPending || !newItemLabel.trim()}>
              <I.plus size={12} /> Add
            </button>
          </div>
        </div>

        {/* ── Comments ── */}
        <div className="col gap-3" style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 14 }}>
          <div className="row between">
            <div className="label">Kommentare</div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{comments.length}</span>
          </div>
          {commentsLoading ? (
            <div className="meta">Lade Kommentare …</div>
          ) : (
            <div className="col gap-3">
              {comments.length === 0 && <div className="meta">Noch keine Kommentare zu diesem Task.</div>}
              {comments.map((c) => {
                const author = data.members.find((m) => m.id === c.author);
                return (
                  <div key={c.id} className="row gap-3 items-start">
                    {author && <Avatar user={author} />}
                    <div style={{ flex: 1 }}>
                      <div className="row gap-2">
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{author?.name ?? c.author}</span>
                        <span className="meta">{timeAgo(c.time)}</span>
                      </div>
                      <div style={{ fontSize: 13.5, color: 'var(--text-1)', marginTop: 4, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {c.text}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="col gap-2 mt-1">
            <input
              className="input"
              placeholder="Kommentar schreiben …"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !commentPending) submitComment(); }}
              disabled={commentPending}
            />
            <div className="row gap-2">
              <button type="button" className="btn btn-brand btn-sm" onClick={submitComment} disabled={commentPending || !commentText.trim()}>
                {commentPending ? 'Wird gesendet…' : 'Kommentieren'}
              </button>
            </div>
            {commentError && (
              <div style={{ fontSize: 12.5, color: 'var(--danger)', padding: '6px 8px', background: 'var(--danger-bg)', borderRadius: 6, border: '1px solid var(--danger-border)' }}>
                {commentError}
              </div>
            )}
          </div>
        </div>

        {/* ── Delete ── */}
        <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 14 }}>
          {confirmDelete ? (
            <div className="row gap-2">
              <button type="button" className="btn btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }} onClick={onDelete} disabled={deletePending}>
                {deletePending ? 'Wird gelöscht…' : 'Ja, löschen'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)} disabled={deletePending}>
                Abbrechen
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--text-3)', fontSize: 12 }} onClick={onDelete}>
              <I.x size={11} /> Task löschen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const DetailRow = ({ label, children }) => (
  <div className="row gap-3 items-center" style={{ padding: '5px 0', minHeight: 34 }}>
    <span style={{ fontSize: 11.5, color: 'var(--text-3)', width: 72, flexShrink: 0 }}>{label}</span>
    <div className="row gap-2 items-center" style={{ flex: 1, minWidth: 0 }}>{children}</div>
  </div>
);
