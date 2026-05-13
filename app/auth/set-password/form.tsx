'use client';
// Password-setup form. Used after an invite or recovery link click, AND
// reached by the middleware redirect for any signed-in user whose
// user_metadata.password_set is not true (one-time gate per account).
//
// updateUser({ password, data: { password_set: true } }) does two things
// atomically: writes the password hash, and stamps a metadata flag so the
// middleware lets the user through to the app on the next request.
//
// Visual style mirrors the login card (.card.card-pad, 380px, same
// header) so the flow looks like a continuation of sign-in.

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const MIN_LENGTH = 8;

export function SetPasswordForm({ email }: { email: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (password.length < MIN_LENGTH) {
      setErrorMsg(`Passwort muss mindestens ${MIN_LENGTH} Zeichen lang sein.`);
      setStatus('error');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Passwörter stimmen nicht überein.');
      setStatus('error');
      return;
    }
    setStatus('submitting');
    const supabase = createClient();
    if (!supabase) {
      setErrorMsg('Auth is not configured in this environment.');
      setStatus('error');
      return;
    }
    const { error } = await supabase.auth.updateUser({
      password,
      data: { password_set: true },
    });
    if (error) {
      setErrorMsg(error.message);
      setStatus('error');
      return;
    }
    // Hard navigation so middleware re-evaluates the now-set metadata
    // and the server components re-render with the updated session.
    window.location.href = '/';
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        background: 'var(--bg)',
      }}
    >
      <div className="card card-pad" style={{ width: '100%', maxWidth: 380 }}>
        <div className="row gap-2 mb-3">
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: '#1a1d24',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '-0.02em',
            }}
          >
            CC
          </div>
          <span style={{ fontWeight: 600 }}>Command Center</span>
        </div>

        <h1 className="h2" style={{ margin: '4px 0 4px' }}>Set password</h1>
        <p className="meta" style={{ margin: '0 0 16px' }}>
          {email ? `For ${email}.` : ''} At least {MIN_LENGTH} characters.
        </p>

        <form onSubmit={onSubmit} className="col gap-3">
          <input
            type="password"
            className="input"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={MIN_LENGTH}
            disabled={status === 'submitting'}
            autoFocus
            autoComplete="new-password"
          />
          <input
            type="password"
            className="input"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={MIN_LENGTH}
            disabled={status === 'submitting'}
            autoComplete="new-password"
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!password || !confirm || status === 'submitting'}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {status === 'submitting' ? 'Saving…' : 'Save password'}
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
