// Magic-link / OAuth callback.
//
// Three possible shapes Supabase hits this route with:
//
//   1. Success (PKCE):     ?code=<pkce-code>
//   2. Success (token):    ?token_hash=<hash>&type=magiclink|email|recovery|invite|email_change
//   3. Failure:            ?error=...&error_code=otp_expired&error_description=...
//
// We translate all three into a redirect to /login with either a session
// cookie set (success) or readable error params (failure). The login page
// reads the error params and shows them in the existing error slot.
//
// If Supabase isn't configured we just bounce to /login with a hint.

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ensureProfile } from '@/lib/auth';

function forwardError(origin: string, params: URLSearchParams) {
  // Preserve whatever Supabase told us about the failure so the login page
  // can render an actionable message.
  const out = new URLSearchParams();
  for (const k of ['error', 'error_code', 'error_description']) {
    const v = params.get(k);
    if (v) out.set(k, v);
  }
  if ([...out].length === 0) out.set('error', 'unknown');
  return NextResponse.redirect(`${origin}/login?${out.toString()}`);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  // Structured diagnostic log — never prints token values, only shape.
  // Lets you grep `[auth/callback]` in the dev server output to see what
  // Supabase actually sent for each click.
  console.log('[auth/callback]', {
    origin,
    hasCode: !!searchParams.get('code'),
    hasTokenHash: !!searchParams.get('token_hash'),
    type: searchParams.get('type') || null,
    error: searchParams.get('error') || null,
    error_code: searchParams.get('error_code') || null,
  });

  // 3. Supabase forwarded an error from its /verify endpoint.
  if (searchParams.get('error') || searchParams.get('error_code')) {
    return forwardError(origin, searchParams);
  }

  const supabase = createClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/login?error=not_configured`);
  }

  const next = searchParams.get('next') ?? '/';

  // 1. PKCE success: exchange the code for a session.
  const code = searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const params = new URLSearchParams({
        error: 'exchange_failed',
        error_description: error.message,
      });
      return NextResponse.redirect(`${origin}/login?${params.toString()}`);
    }
    await ensureProfile();
    return NextResponse.redirect(`${origin}${next}`);
  }

  // 2. Token-hash success: some email templates use this format.
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as
        | 'magiclink'
        | 'email'
        | 'recovery'
        | 'invite'
        | 'email_change'
        | 'signup',
      token_hash: tokenHash,
    });
    if (error) {
      const params = new URLSearchParams({
        error: 'verify_failed',
        error_code: 'otp_expired',
        error_description: error.message,
      });
      return NextResponse.redirect(`${origin}/login?${params.toString()}`);
    }
    await ensureProfile();
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Neither code nor token_hash nor error — link was probably tampered or
  // truncated. Send the user back to /login with a hint.
  return NextResponse.redirect(
    `${origin}/login?error=missing_code&error_description=${encodeURIComponent(
      'Auth callback did not receive a verification token. Request a new magic link.',
    )}`,
  );
}
