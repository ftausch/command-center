'use client';
// Task detail drawer. Right-side slide-in panel for one task.
//
// Anchors comments and checklist items to the SPECIFIC task being viewed,
// fixing the pre-Phase-1.x bug where the comment form on ProjectDetail
// always posted to tasks[0] of the project (wrong target).
//
// Loads existing comments + checklist on open via listTaskComments /
// listTaskChecklist — the workspace fetch doesn't preload these, they
// live per-task. After open the drawer keeps its own local state for
// the thread and the checklist; on mutations it also merges into the
// provider cache (addTaskComment, addChecklistItem, etc.) so the
// project-level rollups stay in sync without a full refresh.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Avatar, PriorityBadge, StatusBadge } from '@/components/ui';
import { dueLabel, timeAgo } from '@/lib/utils';
import {
  changeTaskStatus,
  markTaskBlocked,
  markTaskDone,
} from '@/lib/actions/tasks';
import { addTaskComment, listTaskComments } from '@/lib/actions/comments';
import {
  addChecklistItem,
  listTaskChecklist,
  toggleChecklistItem,
} from '@/lib/actions/checklist';

const STATUS_OPTIONS = ['Backlog', 'To Do', 'In Progress', 'Review', 'Blocked', 'Done'];

export function TaskDrawer({ taskId, projectId, onClose }) {
  const {
    currentWorkspaceId: workspaceId,
    data,
    updateTaskInCache,
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

  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentPending, setCommentPending] = useState(false);
  const [commentError, setCommentError] = useState(null);

  const [checklist, setChecklist] = useState([]);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemPending, setNewItemPending] = useState(false);

  const [statusPending, setStatusPending] = useState(false);
  const [blockerPending, setBlockerPending] = useState(false);
  const [showBlocker, setShowBlocker] = useState(false);
  const [blockerReason, setBlockerReason] = useState('');
  const [actionError, setActionError] = useState(null);

  // Track the most recently opened task — we always re-fetch on task
  // change so the thread/checklist match the visible task. Refs prevent
  // a stale fetch from clobbering newer state if the user switches tasks
  // quickly.
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
    return () => {
      cancelled = true;
    };
  }, [taskId, workspaceId]);

  // ESC to close. Refuse to close mid-pending action — same rule as
  // the other modals.
  useEffect(() => {
    if (!taskId) return;
    const busy = commentPending || statusPending || blockerPending || newItemPending;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [taskId, commentPending, statusPending, blockerPending, newItemPending, onClose]);

  if (!taskId || !task) return null;

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
      // For Blocked, prompt for reason instead of changing directly.
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
    const r = await markTaskBlocked({
      taskId,
      workspaceId,
      reason: reason || undefined,
    });
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
    const r = await addChecklistItem({
      workspaceId,
      taskId,
      label,
      position: checklist.length,
    });
    setNewItemPending(false);
    if (!r.ok || !r.data) {
      setActionError(r.error ?? 'Checklist-Item konnte nicht angelegt werden');
      return;
    }
    setChecklist((prev) => [...prev, r.data]);
    addChecklistItemToCache(r.data);
    setNewItemLabel('');
  };

  const onToggleChecklistItem = async (item) => {
    const next = !item.done;
    // Optimistic flip — server will confirm.
    setChecklist((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, done: next } : i)),
    );
    const r = await toggleChecklistItem({
      workspaceId,
      taskId,
      itemId: item.id,
      done: next,
    });
    if (!r.ok) {
      // Rollback on failure.
      setChecklist((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, done: item.done } : i)),
      );
      setActionError(r.error ?? 'Checklist-Item konnte nicht aktualisiert werden');
      return;
    }
    updateChecklistItemInCache(taskId, item.id, { done: next });
    if (r.activity) pushActivity(r.activity);
  };

  const due = task.due ? dueLabel(task.due) : null;
  const busy = commentPending || statusPending || blockerPending || newItemPending;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(20,22,28,0.45)',
        display: 'flex', justifyContent: 'flex-end',
      }}
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
        <div className="row between items-start">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="row gap-2 mb-1" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
              {project && <span>{project.name}</span>}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.3 }}>{task.title}</div>
          </div>
          <button
            type="button"
            className="btn btn-quiet btn-icon"
            onClick={onClose}
            disabled={busy}
            title="Schließen"
          >
            <I.x size={14} />
          </button>
        </div>

        <div className="row gap-2 wrap">
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
          {due && <span className={`badge ${due.danger ? 'danger' : due.today ? 'warning' : 'ghost'}`}>{due.text}</span>}
          {assignee && (
            <span className="row gap-1" style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
              <Avatar user={assignee} /> {assignee.name}
            </span>
          )}
        </div>

        {task.blocker && (
          <div
            style={{
              fontSize: 12.5, color: 'var(--danger)',
              padding: '8px 10px',
              background: 'var(--danger-bg)',
              borderRadius: 6,
              border: '1px solid var(--danger-border)',
            }}
          >
            <I.block size={12} /> {task.blocker}
          </div>
        )}

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
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {task.status !== 'Done' && (
              <button
                type="button"
                className="btn btn-brand btn-sm"
                onClick={() => onStatusChange('Done')}
                disabled={statusPending}
              >
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
                <button
                  type="button"
                  className="btn btn-brand btn-sm"
                  onClick={submitBlocker}
                  disabled={blockerPending}
                >
                  {blockerPending ? 'Wird gespeichert…' : 'Als blockiert markieren'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setShowBlocker(false); setBlockerReason(''); }}
                  disabled={blockerPending}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
          {actionError && (
            <div
              style={{
                fontSize: 12.5, color: 'var(--danger)',
                padding: '6px 8px',
                background: 'var(--danger-bg)',
                borderRadius: 6,
                border: '1px solid var(--danger-border)',
              }}
            >
              {actionError}
            </div>
          )}
        </div>

        <div className="col gap-2" style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 14 }}>
          <div className="row between">
            <div className="label">Checkliste</div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {checklist.filter((i) => i.done).length}/{checklist.length}
            </span>
          </div>
          <div className="col gap-1">
            {checklist.map((item) => (
              <label
                key={item.id}
                className="row gap-2 items-center"
                style={{ padding: '4px 0', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => onToggleChecklistItem(item)}
                />
                <span style={{
                  fontSize: 13.5,
                  color: item.done ? 'var(--text-3)' : 'var(--text-1)',
                  textDecoration: item.done ? 'line-through' : 'none',
                }}>{item.label}</span>
              </label>
            ))}
            {checklist.length === 0 && (
              <div className="meta">Noch keine Checklist-Items.</div>
            )}
          </div>
          <div className="row gap-2 mt-1">
            <input
              className="input"
              placeholder="Neues Checklist-Item …"
              value={newItemLabel}
              onChange={(e) => setNewItemLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !newItemPending) submitChecklistItem();
              }}
              disabled={newItemPending}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={submitChecklistItem}
              disabled={newItemPending || !newItemLabel.trim()}
            >
              <I.plus size={12} /> Add
            </button>
          </div>
        </div>

        <div className="col gap-3" style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 14 }}>
          <div className="row between">
            <div className="label">Kommentare</div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {comments.length}
            </span>
          </div>
          {commentsLoading ? (
            <div className="meta">Lade Kommentare …</div>
          ) : (
            <div className="col gap-3">
              {comments.length === 0 && (
                <div className="meta">Noch keine Kommentare zu diesem Task.</div>
              )}
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
              placeholder="Kommentar schreiben — @ für Mention, # für Task …"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !commentPending) submitComment();
              }}
              disabled={commentPending}
            />
            <div className="row gap-2">
              <button
                type="button"
                className="btn btn-brand btn-sm"
                onClick={submitComment}
                disabled={commentPending || !commentText.trim()}
              >
                {commentPending ? 'Wird gesendet…' : 'Kommentieren'}
              </button>
            </div>
            {commentError && (
              <div
                style={{
                  fontSize: 12.5, color: 'var(--danger)',
                  padding: '6px 8px',
                  background: 'var(--danger-bg)',
                  borderRadius: 6,
                  border: '1px solid var(--danger-border)',
                }}
              >
                {commentError}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
