'use client';
// Email + password sign-in page. Magic-link was removed in favor of an
// invite-only flow: an admin invites users via scripts/invite-user.mjs,
// they receive a one-shot link, set a password on /auth/set-password,
// then always sign in here with email + password.
//
// Error display: Supabase's signInWithPassword returns "Invalid login
// credentials" for both wrong password AND unknown email (intentional —
// don't leak which addresses exist). We surface one humanized message
// for both cases. The error slot also renders any error_code params
// forwarded by /auth/callback (expired invite, denied access, etc).

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { sendPasswordReset } from '@/lib/actions/auth';

function humanizeError(
  code: string | null,
  desc: string | null,
  fallback: string | null,
  raw: string | null,
): string {
  if (raw) {
    // Match Supabase's response text. "Invalid login credentials" is the
    // unified "wrong password or unknown user" response; do NOT split
    // these into separate messages.
    if (raw === 'Invalid login credentials') {
      return 'Falsche E-Mail oder falsches Passwort.';
    }
    if (raw === 'Email not confirmed') {
      return 'Bitte aktiviere dein Konto über den Einladungs-Link in deiner Mail.';
    }
  }
  if (code === 'access_denied') {
    return 'Zugriff verweigert. Bitte erneut anmelden.';
  }
  if (code === 'otp_expired') {
    return 'Einladungs-Link bereits verwendet oder abgelaufen. Bitte beim Admin einen neuen Link anfordern.';
  }
  if (code === 'unauthorized_client' || code === 'invalid_request') {
    return 'Diese Redirect-URL ist nicht in den Supabase Auth-Settings erlaubt. Bitte beim Admin prüfen lassen.';
  }
  if (fallback === 'not_configured') {
    return 'Auth ist in dieser Umgebung nicht konfiguriert (mock mode).';
  }
  if (fallback === 'exchange_failed' || fallback === 'verify_failed') {
    return (
      desc ||
      'Verifizierung fehlgeschlagen. Bitte einen neuen Einladungs-Link anfordern.'
    );
  }
  if (fallback === 'missing_code') {
    return desc || 'Auth callback ohne Token. Bitte neuen Link anfordern.';
  }
  return desc || raw || fallback || 'Unbekannter Fehler.';
}

// sessionStorage key for the email between requests. Lets a user who got
// the password wrong correct it without retyping the address.
const EMAIL_KEY = 'cc.login.email';

function LoginInner() {
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // 'signin' = email + password form. 'forgot' = email-only recovery
  // form. The forgot mode is a sibling form on the same card, not a
  // new route — keeps the auth surface in one place.
  const [mode, setMode] = useState<'signin' | 'forgot'>('signin');

  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = sessionStorage.getItem(EMAIL_KEY);
      if (saved) setEmail(saved);
    } catch {}
  }, []);

  // Pick up errors forwarded by /auth/callback (query string) — the
  // callback uses these to communicate failures from a click on an
  // expired invite or recovery link.
  useEffect(() => {
    const errorCode = params.get('error_code');
    const errorDescription = params.get('error_description');
    const error = params.get('error');
    if (errorCode || error) {
      setErrorMsg(humanizeError(errorCode, errorDescription, error, null));
      setStatus('error');
    }
  }, [params]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setStatus('submitting');
    const supabase = createClient();
    if (!supabase) {
      setErrorMsg('Auth is not configured in this environment.');
      setStatus('error');
      return;
    }
    try {
      sessionStorage.setItem(EMAIL_KEY, email);
    } catch {}
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErrorMsg(humanizeError(null, null, null, error.message));
      setStatus('error');
      return;
    }
    // Hard navigation so server components re-render with the new auth
    // cookie. SPA navigation would render against the pre-login session.
    const next = params.get('next') || '/';
    window.location.href = next;
  }

  async function onForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setStatus('submitting');
    try {
      sessionStorage.setItem(EMAIL_KEY, email);
    } catch {}
    // Use Resend via server action — bypasses Supabase SMTP entirely.
    // Never reveals if the email exists (server action always returns ok: true).
    await sendPasswordReset(email);
    setStatus('sent');
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

        <h1 className="h2" style={{ margin: '4px 0 4px' }}>
          {mode === 'forgot' ? 'Reset password' : 'Sign in'}
        </h1>
        <p className="meta" style={{ margin: '0 0 16px' }}>
          {!configured
            ? 'Auth is not configured in this environment — preview / mock mode.'
            : mode === 'forgot'
              ? 'Enter your email. If an account exists, we send a recovery link.'
              : 'Sign in with email and password.'}
        </p>

        {mode === 'signin' ? (
          <form onSubmit={onSubmit} className="col gap-3">
            <input
              type="email"
              className="input"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!configured || status === 'submitting'}
              autoFocus
              autoComplete="email"
            />
            <input
              type="password"
              className="input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={!configured || status === 'submitting'}
              autoComplete="current-password"
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!configured || !email || !password || status === 'submitting'}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {status === 'submitting' ? 'Signing in…' : 'Sign in'}
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
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setErrorMsg(null);
                setStatus('idle');
              }}
              disabled={!configured}
              style={{
                background: 'none',
                border: 0,
                padding: '4px 0 0',
                color: 'var(--text-3)',
                fontSize: 12.5,
                cursor: 'pointer',
                alignSelf: 'flex-start',
                textDecoration: 'underline',
              }}
            >
              Passwort vergessen?
            </button>
          </form>
        ) : status === 'sent' ? (
          <div className="col gap-3">
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
              Falls ein Konto mit dieser E-Mail existiert, wurde eine Recovery-Mail gesendet. Bitte Posteingang prüfen.
            </div>
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
                setStatus('idle');
              }}
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Zurück zur Anmeldung
            </button>
          </div>
        ) : (
          <form onSubmit={onForgotSubmit} className="col gap-3">
            <input
              type="email"
              className="input"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!configured || status === 'submitting'}
              autoFocus
              autoComplete="email"
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!configured || !email || status === 'submitting'}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {status === 'submitting' ? 'Wird gesendet…' : 'Recovery-Mail senden'}
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
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
                setStatus('idle');
              }}
              disabled={status === 'submitting'}
              style={{
                background: 'none',
                border: 0,
                padding: '4px 0 0',
                color: 'var(--text-3)',
                fontSize: 12.5,
                cursor: 'pointer',
                alignSelf: 'flex-start',
                textDecoration: 'underline',
              }}
            >
              Zurück zur Anmeldung
            </button>
          </form>
        )}

        {/* Dev-only shortcut. process.env.NODE_ENV is inlined at build time,
            so in production this entire branch is dead-code-eliminated and
            no button reaches the browser. The /auth/dev-login route also
            self-gates on NODE_ENV — belt-and-suspenders. */}
        {process.env.NODE_ENV === 'development' && (
          <form
            method="POST"
            action="/auth/dev-login"
            style={{ marginTop: 12 }}
          >
            <button
              type="submit"
              className="btn"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Dev login (fabian)
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams() must be inside <Suspense> when statically prerendered.
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
