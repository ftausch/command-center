'use client';
// New Task modal. Used from multiple entry points (sidebar "+ New Task",
// topbar "+ New", project detail "+ New Task", Kanban "+ New Task",
// MyTasks "Quick Add"). Each entry point owns its own open-state and
// optionally passes an initialProjectId to pre-select the project.
//
// Visual chrome reuses .card.card-pad, same modal pattern as
// InvitePersonModal / NewProjectModal. On success the new task is
// merged into the provider cache via addTask + pushActivity (no full
// refresh).
//
// Edge case: a freshly-cleaned workspace has no projects. Rather than
// disabling the form silently, the modal renders a "Create a project
// first" empty state with a CTA that routes to Projects.

import { useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { createTask } from '@/lib/actions/tasks';

const PRIORITIES = ['High', 'Medium', 'Low'];

export function NewTaskModal({ open, onClose, initialProjectId, onCreated, onNeedProject }) {
  const {
    currentWorkspaceId: workspaceId,
    data,
    addTask,
    pushActivity,
  } = useWorkspace();

  const projects = data.projects;
  // Default project: caller-provided > first available.
  const defaultProjectId = useMemo(
    () => initialProjectId ?? projects[0]?.id ?? '',
    [initialProjectId, projects],
  );

  const [projectId, setProjectId] = useState(defaultProjectId);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [due, setDue] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting | error
  const [errorMsg, setErrorMsg] = useState(null);

  // Fresh state on each open. Recompute defaultProjectId in case the
  // workspace changed or projects got loaded between opens.
  useEffect(() => {
    if (!open) return;
    setProjectId(defaultProjectId);
    setTitle('');
    setPriority('Medium');
    setDue('');
    setStatus('idle');
    setErrorMsg(null);
  }, [open, defaultProjectId]);

  // ESC closes when idle.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && status !== 'submitting') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, status, onClose]);

  if (!open) return null;

  const hasProjects = projects.length > 0;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!workspaceId) {
      setErrorMsg('Kein aktiver Workspace ausgewählt.');
      setStatus('error');
      return;
    }
    if (!projectId) {
      setErrorMsg('Bitte ein Projekt auswählen.');
      setStatus('error');
      return;
    }
    setErrorMsg(null);
    setStatus('submitting');
    const result = await createTask({
      workspaceId,
      projectId,
      title: title.trim(),
      due: due || undefined,
      priority,
    });
    if (!result.ok || !result.data) {
      setErrorMsg(result.error ?? 'Task konnte nicht angelegt werden');
      setStatus('error');
      return;
    }
    addTask(result.data);
    if (result.activity) pushActivity(result.activity);
    onClose();
    if (onCreated) onCreated(result.data);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && status !== 'submitting') onClose();
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(20,22,28,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
      }}
    >
      <div
        className="card card-pad"
        style={{ width: '100%', maxWidth: 460, position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between mb-3">
          <div>
            <div className="h3">Neuer Task</div>
            <div className="meta mt-1">Status startet in Backlog. Zuweisung defaultet auf dich.</div>
          </div>
          <button
            type="button"
            className="btn btn-quiet btn-icon"
            onClick={onClose}
            disabled={status === 'submitting'}
            title="Schließen"
          >
            <I.x size={14} />
          </button>
        </div>

        {!hasProjects ? (
          <div className="col gap-3">
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-2)',
                padding: '10px 12px',
                background: 'var(--bg)',
                borderRadius: 6,
                border: '1px solid var(--border-soft)',
              }}
            >
              Dieser Workspace hat noch keine Projekte. Lege zuerst ein Projekt an, dann kannst du Tasks erstellen.
            </div>
            <button
              type="button"
              className="btn btn-brand"
              onClick={() => {
                onClose();
                if (onNeedProject) onNeedProject();
              }}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Projekt anlegen
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="col gap-3">
            <select
              className="input"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={status === 'submitting'}
              required
              title="Projekt"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <input
              type="text"
              className="input"
              placeholder="Task-Titel — was muss erledigt werden?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={status === 'submitting'}
              autoFocus
              maxLength={300}
            />

            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <select
                className="input"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={status === 'submitting'}
                title="Priorität"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>Priorität: {p}</option>
                ))}
              </select>
              <input
                type="date"
                className="input"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                disabled={status === 'submitting'}
                title="Deadline (optional)"
              />
            </div>

            <button
              type="submit"
              className="btn btn-brand"
              disabled={!title.trim() || !projectId || status === 'submitting'}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {status === 'submitting' ? 'Wird angelegt…' : 'Task anlegen'}
            </button>

            {errorMsg && (
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--danger)',
                  padding: '6px 8px',
                  background: 'var(--danger-bg)',
                  borderRadius: 6,
                  border: '1px solid var(--danger-border)',
                }}
              >
                {errorMsg}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
