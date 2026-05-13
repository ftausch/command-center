'use client';
// New Project modal. Triggered from the Projects screen "+ New Project"
// button. Captures the minimum fields createProject needs and rolls the
// rest into sensible defaults (status=Planning, owner=current user).
//
// Visual chrome reuses .card.card-pad, same modal pattern as
// InvitePersonModal. On success the new project is merged into the
// provider cache via addProject + pushActivity and the caller is
// notified through onCreated so it can navigate.

import { useEffect, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { createProject } from '@/lib/actions/projects';

const PROJECT_TYPES = ['Episode', 'Newsletter', 'Clips', 'Design', 'Andere'];
const PRIORITIES = ['High', 'Medium', 'Low'];

export function NewProjectModal({ open, onClose, onCreated }) {
  const {
    currentWorkspaceId: workspaceId,
    addProject,
    pushActivity,
  } = useWorkspace();

  const [name, setName] = useState('');
  const [type, setType] = useState('Episode');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [due, setDue] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting | error
  const [errorMsg, setErrorMsg] = useState(null);

  // Reset state every time the modal opens.
  useEffect(() => {
    if (!open) return;
    setName('');
    setType('Episode');
    setDescription('');
    setPriority('Medium');
    setDue('');
    setStatus('idle');
    setErrorMsg(null);
  }, [open]);

  // ESC closes when idle. Same rule as the invite modal — refuse to close
  // mid-submit so the user isn't left wondering whether the project was
  // created.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && status !== 'submitting') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, status, onClose]);

  if (!open) return null;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!workspaceId) {
      setErrorMsg('Kein aktiver Workspace ausgewählt.');
      setStatus('error');
      return;
    }
    setErrorMsg(null);
    setStatus('submitting');
    const result = await createProject({
      workspaceId,
      name: name.trim(),
      type,
      description: description.trim() || undefined,
      priority,
      due: due || undefined,
    });
    if (!result.ok || !result.data) {
      setErrorMsg(result.error ?? 'Projekt konnte nicht angelegt werden');
      setStatus('error');
      return;
    }
    addProject(result.data);
    if (result.activity) pushActivity(result.activity);
    onClose();
    // Hand the new project back so the parent can navigate the user into
    // its detail view (the natural next action after "Create").
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
            <div className="h3">Neues Projekt</div>
            <div className="meta mt-1">Status startet in Planning. Phasen & Tasks legst du danach an.</div>
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

        <form onSubmit={onSubmit} className="col gap-3">
          <input
            type="text"
            className="input"
            placeholder="Projektname — z.B. Ep. 142 — Verena Pausder"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={status === 'submitting'}
            autoFocus
            maxLength={200}
          />

          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <select
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={status === 'submitting'}
              title="Typ"
            >
              {PROJECT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
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
          </div>

          <input
            type="date"
            className="input"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            disabled={status === 'submitting'}
            title="Deadline (optional)"
          />

          <textarea
            className="input"
            placeholder="Beschreibung (optional) — kurz, was das Projekt sein soll."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={status === 'submitting'}
            rows={3}
            style={{ resize: 'vertical', minHeight: 64, padding: '8px 12px', lineHeight: 1.4 }}
          />

          <button
            type="submit"
            className="btn btn-brand"
            disabled={!name.trim() || status === 'submitting'}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {status === 'submitting' ? 'Wird angelegt…' : 'Projekt anlegen'}
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
      </div>
    </div>
  );
}
