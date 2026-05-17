'use client';
// New Project modal. Triggered from the Projects screen "+ New Project"
// button. Captures the minimum fields createProject needs and rolls the
// rest into sensible defaults (status=Planning, owner=current user).
//
// Visual chrome reuses .card.card-pad, same modal pattern as
// InvitePersonModal. On success the new project is merged into the
// provider cache via addProject + pushActivity and the caller is
// notified through onCreated so it can navigate.

import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { createProject, setupProjectWorkspace } from '@/lib/actions/projects';
import { applyEpisodeTemplate, EPISODE_TEMPLATE_PREVIEW } from '@/lib/actions/templates';
import { safeSlackChannelName } from '@/lib/workspace-utils';
import { isDriveConfigured } from '@/lib/actions/workspace';

const PROJECT_TYPES = ['Episode', 'Recording', 'Event', 'Shoot', 'Client', 'Production', 'Workshop', 'Newsletter', 'Clips', 'Design', 'Andere'];

// Event types that benefit from workspace setup
const SETUP_TYPES = new Set(['Episode', 'Recording', 'Event', 'Shoot', 'Client', 'Production', 'Workshop']);
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

  const submittingRef = useRef(false);
  const idempotencyId = useRef(crypto.randomUUID());

  const [driveEnabled, setDriveEnabled] = useState(false);
  const [setupDrive,   setSetupDrive]   = useState(false);
  const [applyTemplate, setApplyTemplate] = useState(false);

  useEffect(() => {
    isDriveConfigured().then(setDriveEnabled).catch(() => setDriveEnabled(false));
  }, []);

  // Workspace setup
  const [setupSlack,         setSetupSlack]         = useState(false);
  const [slackChannelName,   setSlackChannelName]   = useState('');
  const [postSetupMsg,       setPostSetupMsg]       = useState(true);
  const [setupWarning,       setSetupWarning]       = useState(null);

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
    setSetupSlack(false);
    setSlackChannelName('');
    setPostSetupMsg(true);
    setSetupWarning(null);
    submittingRef.current = false;
    idempotencyId.current = crypto.randomUUID();
    setApplyTemplate(false);
  }, [open]);

  // Auto-generate channel name from project name
  useEffect(() => {
    if (name.trim()) setSlackChannelName(safeSlackChannelName(name.trim()));
  }, [name]);

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
    if (submittingRef.current) return;
    if (!workspaceId) {
      setErrorMsg('Kein aktiver Workspace ausgewählt.');
      setStatus('error');
      return;
    }
    submittingRef.current = true;
    setErrorMsg(null);
    setStatus('submitting');
    const result = await createProject({
      workspaceId,
      name: name.trim(),
      type,
      description: description.trim() || undefined,
      priority,
      due: due || undefined,
      idempotencyId: idempotencyId.current,
    });
    if (!result.ok || !result.data) {
      setErrorMsg(result.error ?? 'Projekt konnte nicht angelegt werden');
      setStatus('error');
      submittingRef.current = false;
      return;
    }
    addProject(result.data);
    if (result.activity) pushActivity(result.activity);

    // Workspace setup (best-effort, non-blocking)
    if ((setupSlack || setupDrive) && result.data?.id) {
      const setupResult = await setupProjectWorkspace({
        projectId:        result.data.id,
        workspaceId,
        setupSlack,
        slackChannelName,
        postSetupMessage: postSetupMsg,
        projectName:      name.trim(),
        projectType:      type,
        setupDrive,
      });
      if (setupResult.warning) setSetupWarning(setupResult.warning);
    }

    // Apply episode template tasks (best-effort, non-blocking for UX)
    if (applyTemplate && result.data?.id) {
      applyEpisodeTemplate({
        projectId:   result.data.id,
        workspaceId,
        dueDate:     due || undefined,
      }).then((r) => {
        if (r.ok) console.log(`[template] ${r.data?.count} tasks created`);
      });
    }

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

          {/* ── Episode Template ───────────────────────────────────── */}
          {(type === 'Episode' || type === 'Recording') && (
            <div style={{
              borderTop: '1px solid var(--border-soft)',
              paddingTop: 14, marginTop: 2,
            }}>
              <label className="row gap-2" style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={applyTemplate}
                  onChange={e => setApplyTemplate(e.target.checked)}
                  disabled={status === 'submitting'}
                  style={{ accentColor: 'var(--brand)', marginTop: 2 }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>📋 Episode-Tasks automatisch erstellen</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                    {EPISODE_TEMPLATE_PREVIEW.length} Standard-Tasks werden angelegt und dem Team zugewiesen
                  </div>
                </div>
              </label>
              {applyTemplate && (
                <div style={{
                  marginTop: 10, padding: '8px 10px', background: 'var(--bg-sunk)',
                  borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  {EPISODE_TEMPLATE_PREVIEW.map((t, i) => (
                    <div key={i} className="row gap-2" style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      <span style={{ color: 'var(--text-4)', minWidth: 16 }}>{i + 1}.</span>
                      <span style={{ flex: 1 }}>{t.title}</span>
                      <span style={{
                        fontSize: 10.5, color: 'var(--brand)', fontWeight: 500,
                        background: 'var(--brand-soft)', borderRadius: 4, padding: '1px 6px',
                      }}>{t.specialty}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Workspace vorbereiten ──────────────────────────────── */}
          <div style={{
            borderTop: '1px solid var(--border-soft)',
            paddingTop: 14, marginTop: 2,
          }}>
            <button
              type="button"
              onClick={() => setSetupSlack(s => !s)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 0, width: '100%', textAlign: 'left',
              }}
            >
              <span style={{
                fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
                textTransform: 'uppercase', color: 'var(--text-3)',
              }}>
                Workspace vorbereiten
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-4)', marginLeft: 'auto' }}>
                {setupSlack ? '▾' : '▸'}
              </span>
            </button>

            {setupSlack && (
              <div className="col gap-3 mt-3 fade-in">
                {/* Slack */}
                <div style={{ background: 'var(--bg-sunk)', borderRadius: 8, padding: '12px 14px' }}>
                  <div className="row between mb-2">
                    <div className="row gap-2">
                      <I.slack size={14} />
                      <span style={{ fontSize: 13, fontWeight: 500 }}>Slack-Channel</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 500 }}>● Verbunden</span>
                  </div>
                  <input
                    className="input"
                    value={slackChannelName}
                    onChange={e => setSlackChannelName(e.target.value)}
                    placeholder="channel-name"
                    disabled={status === 'submitting'}
                    style={{ fontSize: 13, fontFamily: 'var(--font-mono)', marginBottom: 8 }}
                  />
                  <label className="row gap-2" style={{ cursor: 'pointer', fontSize: 12.5 }}>
                    <input
                      type="checkbox"
                      checked={postSetupMsg}
                      onChange={e => setPostSetupMsg(e.target.checked)}
                      disabled={status === 'submitting'}
                      style={{ accentColor: 'var(--brand)' }}
                    />
                    Setup-Nachricht in Slack posten
                  </label>
                </div>

                {/* Google Drive */}
                <div style={{
                  background: 'var(--bg-sunk)', borderRadius: 8, padding: '12px 14px',
                  opacity: driveEnabled ? 1 : 0.5,
                }}>
                  <div className="row between mb-2">
                    <div className="row gap-2">
                      <span style={{ fontSize: 14 }}>📁</span>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>Google Drive Ordner</span>
                    </div>
                    <span style={{ fontSize: 11, color: driveEnabled ? 'var(--success)' : 'var(--text-3)', fontWeight: 500 }}>
                      {driveEnabled ? '● Verbunden' : 'Nicht verbunden'}
                    </span>
                  </div>
                  {driveEnabled ? (
                    <>
                      <label className="row gap-2" style={{ cursor: 'pointer', fontSize: 12.5 }}>
                        <input
                          type="checkbox"
                          checked={setupDrive}
                          onChange={e => setSetupDrive(e.target.checked)}
                          disabled={status === 'submitting'}
                          style={{ accentColor: 'var(--brand)' }}
                        />
                        Ordner in Google Drive erstellen
                      </label>
                      {setupDrive && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6 }}>
                          Erstellt: Aufnahme · Schnitt · Thumbnail · Show Notes · Distribution
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                      Google Drive Integration noch nicht eingerichtet.
                    </div>
                  )}
                </div>

                {setupWarning && (
                  <div style={{ fontSize: 12, color: 'var(--warning)', padding: '6px 10px', background: 'var(--warning-bg)', borderRadius: 6 }}>
                    ⚠️ {setupWarning}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-brand"
            disabled={!name.trim() || status === 'submitting'}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {status === 'submitting' ? 'Wird angelegt…' : setupSlack ? 'Projekt anlegen & Workspace vorbereiten' : 'Projekt anlegen'}
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
