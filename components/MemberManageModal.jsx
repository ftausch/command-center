'use client';
// Member management modal — change role or remove. Triggered from the
// ⋮ buttons in Team and Settings → Mitglieder.
//
// Two surfaces in one modal:
//   1. Role select + "Rolle speichern" button.
//   2. "Aus Workspace entfernen" with an inline confirm (no native
//      window.confirm — keeps the visual style consistent).
//
// Server gates are the source of truth: an admin trying to demote an
// owner, or remove the last owner, etc. Those errors come back in the
// existing error slot. The role select still surfaces all five options
// so the failure mode is "server rejects" rather than "UI hides", which
// is friendlier when permissions change underneath you.

import { useEffect, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Avatar } from '@/components/ui';
import { removeMember, updateMemberRole } from '@/lib/actions/members';

const ROLE_OPTIONS = [
  { value: 'owner',   label: 'Owner' },
  { value: 'admin',   label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'member',  label: 'Member' },
  { value: 'viewer',  label: 'Viewer' },
];

export function MemberManageModal({ open, member, onClose }) {
  const { currentWorkspaceId: workspaceId, refresh } = useWorkspace();
  const [role, setRole] = useState(member?.role ?? 'member');
  const [status, setStatus] = useState('idle'); // idle | saving | removing | error
  const [errorMsg, setErrorMsg] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Reset on each open.
  useEffect(() => {
    if (!open) return;
    setRole(member?.role ?? 'member');
    setStatus('idle');
    setErrorMsg(null);
    setConfirmRemove(false);
  }, [open, member]);

  useEffect(() => {
    if (!open) return;
    const busy = status === 'saving' || status === 'removing';
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, status, onClose]);

  if (!open || !member) return null;

  const busy = status === 'saving' || status === 'removing';

  const saveRole = async () => {
    if (role === member.role) {
      onClose();
      return;
    }
    setErrorMsg(null);
    setStatus('saving');
    const r = await updateMemberRole({ workspaceId, userId: member.id, role });
    if (!r.ok) {
      setErrorMsg(r.error ?? 'Rolle konnte nicht geändert werden');
      setStatus('error');
      return;
    }
    refresh();
    onClose();
  };

  const submitRemove = async () => {
    setErrorMsg(null);
    setStatus('removing');
    const r = await removeMember({ workspaceId, userId: member.id });
    if (!r.ok) {
      setErrorMsg(r.error ?? 'Mitglied konnte nicht entfernt werden');
      setStatus('error');
      return;
    }
    refresh();
    onClose();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
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
        style={{ width: '100%', maxWidth: 420 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between mb-3">
          <div className="row gap-3 items-center" style={{ minWidth: 0 }}>
            <Avatar user={member} size="md" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>{member.name}</div>
              <div className="meta">Aktuelle Rolle: {member.role}</div>
            </div>
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

        <div className="col gap-3">
          <div>
            <div className="label mb-2">Rolle</div>
            <select
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={busy}
              style={{ width: '100%' }}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn btn-brand"
            onClick={saveRole}
            disabled={busy || role === member.role}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {status === 'saving' ? 'Wird gespeichert…' : 'Rolle speichern'}
          </button>

          <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 14, marginTop: 4 }}>
            {confirmRemove ? (
              <div className="col gap-2">
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  {member.name} aus diesem Workspace entfernen? Tasks bleiben erhalten, Zuweisungen werden gelöscht.
                </div>
                <div className="row gap-2">
                  <button
                    type="button"
                    className="btn btn-brand btn-sm"
                    style={{ background: 'var(--danger)' }}
                    onClick={submitRemove}
                    disabled={busy}
                  >
                    {status === 'removing' ? 'Wird entfernt…' : 'Ja, entfernen'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setConfirmRemove(false)}
                    disabled={busy}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirmRemove(true)}
                disabled={busy}
                style={{ color: 'var(--danger)' }}
              >
                Aus Workspace entfernen
              </button>
            )}
          </div>

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
        </div>
      </div>
    </div>
  );
}
