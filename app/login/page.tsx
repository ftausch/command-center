'use client';
// Minimal login page — magic-link email. Inherits the existing visual
// system from globals.css (card, btn, input). When Supabase isn't
// configured (e.g. preview deploys with no env vars) we render a hint
// instead of crashing.

import { useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const configured = isSupabaseConfigured();

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
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
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
