'use client';
// Invite Person modal. Triggered from the Team and Settings "Einladen"
// buttons. Captures email + role, calls inviteWorkspaceMember, renders
// loading / success / error states inline.
//
// Visual chrome: matches the login + set-password cards (.card.card-pad,
// same width). Backdrop is a fixed overlay; ESC / outside-click close it
// when idle. We refuse to close mid-submit so the action either finishes
// or surfaces an error.

import { useEffect, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { inviteWorkspaceMember } from '@/lib/actions/members';

const ROLE_OPTIONS = [
  { value: 'owner',   label: 'Owner — voller Zugriff inkl. Workspace-Einstellungen' },
  { value: 'admin',   label: 'Admin — kann einladen und alles bearbeiten' },
  { value: 'manager', label: 'Manager — kann Projekte und Tasks anlegen' },
  { value: 'member',  label: 'Member — kann Tasks bearbeiten' },
  { value: 'viewer',  label: 'Viewer — nur lesen' },
];

export function InvitePersonModal({ open, onClose }) {
  const { currentWorkspaceId: workspaceId, refresh } = useWorkspace();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [status, setStatus] = useState('idle'); // idle | submitting | success | warning | error
  const [errorMsg, setErrorMsg] = useState(null);
  const [warningMsg, setWarningMsg] = useState(null);
  const [success, setSuccess] = useState(null); // { email, mode }

  // Fresh state every time the modal opens.
  useEffect(() => {
    if (!open) return;
    setEmail('');
    setRole('member');
    setStatus('idle');
    setErrorMsg(null);
    setWarningMsg(null);
    setSuccess(null);
  }, [open]);

  // ESC closes — but only when we're not mid-submit; we don't want to
  // abandon a server request and leave the user wondering what happened.
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
    const result = await inviteWorkspaceMember({
      workspaceId,
      email: email.trim(),
      role,
    });
    if (!result.ok) {
      setErrorMsg(result.error ?? 'Einladung fehlgeschlagen');
      setStatus('error');
      return;
    }
    // Partial success: member was added to workspace_members but the email
    // could not be sent (rate limit). Show a warning instead of a success.
    if (result.warning) {
      setWarningMsg(result.warning);
      setStatus('warning');
      refresh();
      // Don't auto-close so the admin can read the warning.
      return;
    }
    setSuccess({ email: result.data.email, mode: result.data.mode });
    setStatus('success');
    // Reload the workspace so the new workspace_members row is visible in
    // the Team / Settings → Members list immediately. The membership is
    // already effective in the DB; this just brings the UI in sync.
    refresh();
    // Auto-close shortly after the confirmation so admins can move on.
    setTimeout(() => onClose(), 2200);
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
        style={{ width: '100%', maxWidth: 420, position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between mb-3">
          <div>
            <div className="h3">Person einladen</div>
            <div className="meta mt-1">Per E-Mail. Empfänger setzt eigenes Passwort.</div>
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

        {status === 'success' && success ? (
          <div
            style={{
              fontSize: 13,
              color: 'var(--success)',
              padding: '10px 12px',
              background: 'var(--success-bg)',
              borderRadius: 6,
              border: '1px solid var(--success-border)',
            }}
          >
            {success.mode === 'invite' ? 'Einladungs-Mail' : 'Recovery-Mail'} gesendet an{' '}
            <span className="mono">{success.email}</span>.
          </div>
        ) : status === 'warning' && warningMsg ? (
          <div className="col gap-3">
            <div
              style={{
                fontSize: 13,
                color: 'var(--warning)',
                padding: '10px 12px',
                background: 'var(--warning-bg)',
                borderRadius: 6,
                border: '1px solid var(--warning-border)',
                lineHeight: 1.55,
              }}
            >
              ⚠️ {warningMsg}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              style={{ alignSelf: 'flex-end' }}
            >
              Schließen
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="col gap-3">
            <input
              type="email"
              className="input"
              placeholder="alice@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={status === 'submitting'}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
            <select
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={status === 'submitting'}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <button
              type="submit"
              className="btn btn-brand"
              disabled={!email.trim() || status === 'submitting'}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {status === 'submitting' ? 'Wird gesendet…' : 'Einladung senden'}
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
