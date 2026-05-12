'use client';
// Minimal login page — magic-link email. Inherits the existing visual
// system from globals.css (card, btn, input). When Supabase isn't
// configured (e.g. preview deploys with no env vars) we render a hint
// instead of crashing.
//
// Error display: Supabase's /auth/v1/verify endpoint may redirect here
// (via /auth/callback) with ?error_code=otp_expired etc. on a failed or
// expired magic link. We also fall back to reading window.location.hash
// in case a legacy implicit-flow project still uses fragment errors. The
// existing error slot in the form renders whichever shape arrived — no
// new UI added.

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

function humanizeError(code: string | null, desc: string | null, fallback: string | null): string {
  if (code === 'otp_expired') {
    // Common causes: email scanner/preview consumed the link before the user
    // clicked, link was clicked twice, or > 1h passed. Tell the user the
    // realistic next step rather than just "expired".
    return 'Magic Link bereits verwendet oder abgelaufen. Häufige Ursache: dein Mail-Programm hat den Link beim Anzeigen automatisch geöffnet. Bitte unten neu anfordern und den Link direkt klicken (nicht hovern, nicht in Vorschau öffnen).';
  }
  if (code === 'access_denied') {
    return 'Zugriff verweigert. Bitte erneut anmelden.';
  }
  if (code === 'unauthorized_client' || code === 'invalid_request') {
    return 'Diese Redirect-URL ist nicht in den Supabase Auth-Settings erlaubt. Bitte beim Admin prüfen lassen.';
  }
  if (fallback === 'not_configured') {
    return 'Auth ist in dieser Umgebung nicht konfiguriert (mock mode).';
  }
  if (fallback === 'exchange_failed') {
    return (
      desc ||
      'Verifizierung fehlgeschlagen — möglicherweise wurde der Link in einem anderen Browser oder einer anderen Session geöffnet. Bitte neu anfordern.'
    );
  }
  if (fallback === 'verify_failed') {
    return desc || 'Verifizierung fehlgeschlagen — bitte erneut anfordern.';
  }
  if (fallback === 'missing_code') {
    return desc || 'Auth callback ohne Token. Bitte neuen Magic Link anfordern.';
  }
  return desc || fallback || 'Unbekannter Fehler.';
}

// sessionStorage key for the email between requests. Lets the user click
// "Send magic link" again after an otp_expired error without retyping.
const EMAIL_KEY = 'cc.login.email';

function LoginInner() {
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const configured = isSupabaseConfigured();

  // Restore previously-typed email so clicking "Send magic link" again after
  // an otp_expired error doesn't require retyping. Same input field, just
  // pre-filled — no visual change.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = sessionStorage.getItem(EMAIL_KEY);
      if (saved) setEmail(saved);
    } catch {}
  }, []);

  // Pick up errors forwarded by /auth/callback (query string) AND any
  // fragment errors a legacy flow might leave on the URL (e.g. when the
  // user lands here directly from Supabase rather than via the callback).
  useEffect(() => {
    let errorCode = params.get('error_code');
    let errorDescription = params.get('error_description');
    let error = params.get('error');

    if (!errorCode && !error && typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      errorCode = errorCode || hashParams.get('error_code');
      errorDescription = errorDescription || hashParams.get('error_description');
      error = error || hashParams.get('error');
      // Strip the hash so the message doesn't survive a refresh.
      if (errorCode || error) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }

    if (errorCode || error) {
      setErrorMsg(humanizeError(errorCode, errorDescription, error));
      setStatus('error');
    }
  }, [params]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setStatus('sending');
    const supabase = createClient();
    if (!supabase) {
      setErrorMsg('Auth is not configured in this environment.');
      setStatus('error');
      return;
    }
    // Normalize the redirect target. window.location.origin handles both
    // localhost:3000 and localhost:3002 automatically; we just trim any
    // accidental trailing slash on the path and ensure exactly one '/'.
    const redirectTo = `${window.location.origin.replace(/\/+$/, '')}/auth/callback`;
    try {
      sessionStorage.setItem(EMAIL_KEY, email);
    } catch {}
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      setErrorMsg(error.message);
      setStatus('error');
    } else {
      setStatus('sent');
    }
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

        <h1 className="h2" style={{ margin: '4px 0 4px' }}>Sign in</h1>
        <p className="meta" style={{ margin: '0 0 16px' }}>
          {configured
            ? 'We email you a magic link. No password.'
            : 'Auth is not configured in this environment — preview / mock mode.'}
        </p>

        {status === 'sent' ? (
          <div
            className="card card-pad"
            style={{
              background: 'var(--success-bg)',
              borderColor: 'var(--success-border)',
              color: 'var(--success)',
              fontSize: 13,
            }}
          >
            Check your inbox for a sign-in link.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="col gap-3">
            <input
              type="email"
              className="input"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!configured || status === 'sending'}
              autoFocus
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!configured || !email || status === 'sending'}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
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

export default function LoginPage() {
  // useSearchParams() must be inside <Suspense> when statically prerendered.
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
