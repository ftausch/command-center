// POST /auth/logout — clear the Supabase session and bounce to /login.
//
// Method allowlist: POST only. GET → 405 so a stray link prefetcher,
// a browser address-bar visit, or a misclicked email link can't log
// the user out unintentionally.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = createClient();
  // signOut handles the missing-config case gracefully (no-op). The cookie
  // adapter wired into the server client writes the cleared cookies onto
  // the response automatically.
  if (supabase) {
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(`${origin}/login`, { status: 303 });
}

export function GET() {
  return new NextResponse('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  });
}
