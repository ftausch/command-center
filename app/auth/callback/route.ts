// Magic-link / OAuth callback. Supabase appends ?code=... when the user
// clicks the link in their email. We exchange the code for a session
// (which sets auth cookies) then send them home.
//
// If Supabase isn't configured at all, we just redirect to /login with an
// error flag — there's nothing to exchange.

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ensureProfile } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  const supabase = createClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/login?error=not_configured`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Trigger usually does this; safety net for edge cases.
  await ensureProfile();

  return NextResponse.redirect(`${origin}${next}`);
}
