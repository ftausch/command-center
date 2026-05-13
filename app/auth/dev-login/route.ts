// Dev-only login fallback. Mints a real Supabase session for the hard-coded
// test user without sending email — useful when the magic-link flow is
// rate-limited (Supabase free-tier caps OTP emails per hour).
//
// DISABLED IN PRODUCTION. The first line of POST bails on NODE_ENV !==
// 'development'. `next build` and Vercel both set NODE_ENV=production, so
// this route returns 404 in deployed environments — there is no path through.
//
// How it works:
//   1. Admin client (service-role) generates a magiclink hashed_token for
//      fabian@unicornbakery.de via generateLink({ type: 'magiclink' }).
//      That uses the same internal code path as a real magic link but
//      returns the token directly instead of emailing it, so the rate-
//      limited /auth/v1/otp endpoint is not hit.
//   2. Server (cookie-bound) client verifyOtp's that token, setting the
//      session cookies on the outgoing response.
//   3. ensureProfile() runs the same upsert as /auth/callback.
//   4. 303 → /.
//
// Method allowlist: POST only. GET is 404 so link prefetchers / curl
// pokes can't accidentally mint sessions.

import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { ensureProfile } from '@/lib/auth';

const DEV_USER_EMAIL = 'fabian@unicornbakery.de';

function notFound() {
  return new NextResponse('Not Found', { status: 404 });
}

export async function GET() {
  return notFound();
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') return notFound();

  const admin = createAdminClient();
  if (!admin) {
    return new NextResponse(
      'Dev login requires SUPABASE_SERVICE_ROLE_KEY in .env.local',
      { status: 500 },
    );
  }

  const supabase = createClient();
  if (!supabase) {
    return new NextResponse('Supabase not configured', { status: 500 });
  }

  const { origin } = new URL(request.url);

  const { data, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: DEV_USER_EMAIL,
  });
  if (linkError || !data?.properties?.hashed_token) {
    console.error('[dev-login] generateLink failed', linkError?.message);
    return new NextResponse(
      `Dev login failed: ${linkError?.message ?? 'no token in response'}`,
      { status: 500 },
    );
  }

  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: data.properties.hashed_token,
  });
  if (verifyError) {
    console.error('[dev-login] verifyOtp failed', verifyError.message);
    return new NextResponse(`Dev login failed: ${verifyError.message}`, {
      status: 500,
    });
  }

  await ensureProfile();
  console.log('[dev-login] success', { userId: data.user?.id ?? null });
  return NextResponse.redirect(`${origin}/`, { status: 303 });
}
