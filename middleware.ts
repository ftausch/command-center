// Edge middleware. Two jobs:
//
//   1. Refresh the Supabase session on every request so the cookie doesn't
//      expire under the user. Required by @supabase/ssr.
//
//   2. Gate routes when Supabase is configured: unauthenticated users get
//      redirected to /login (except for /login itself and /auth/*).
//
// When Supabase isn't configured (preview deploys with no env vars) we
// no-op so the existing mock-data UX keeps working.

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_PATHS = ['/login', '/auth', '/api/slack'];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  // ── Auth-param rescue ──────────────────────────────────────────────────
  // Supabase appends `?code=` (or `?token_hash=`, or `?error=`) to whatever
  // URL it ended up redirecting to. The intended target is /auth/callback,
  // but when the redirect_to wasn't allowlisted Supabase falls back to the
  // dashboard's Site URL (usually '/'), so the verification ends up on the
  // homepage and the homepage doesn't know what to do with `?code=`.
  //
  // We intercept that case here and forward to /auth/callback with the
  // params preserved, so the auth flow completes regardless of dashboard
  // misconfiguration. The only path we don't rescue is /login carrying
  // ONLY error params — that's a legitimate landing (the login page reads
  // those params to render a human-readable message). A /login URL that
  // also carries `?code=` still gets rescued.
  const params = request.nextUrl.searchParams;
  const hasCode = params.has('code') || params.has('token_hash');
  const hasError = params.has('error') || params.has('error_code');
  const pathname = request.nextUrl.pathname;
  const isCallback = pathname.startsWith('/auth/callback');
  const isLoginErrorTarget =
    pathname.startsWith('/login') && hasError && !hasCode;

  if ((hasCode || hasError) && !isCallback && !isLoginErrorTarget) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = '/auth/callback';
    return NextResponse.redirect(callbackUrl);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      get(name) {
        return request.cookies.get(name)?.value;
      },
      set(name, value, options) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request });
        response.cookies.set({ name, value, ...options });
      },
      remove(name, options) {
        request.cookies.set({ name, value: '', ...options });
        response = NextResponse.next({ request });
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  // getUser() forces a token refresh if needed and writes the new cookies
  // via the set() callback above. Don't skip — relying solely on getSession()
  // can serve stale tokens.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Invited users who never set a password (or recovery-link users who
  // bailed before saving) must go through /auth/set-password before
  // touching the app. The set-password form stamps user_metadata.
  // password_set = true so this check passes on subsequent requests.
  // We let any /auth/* path through so the callback can finish and so
  // the set-password page itself isn't blocked by its own gate.
  if (
    user &&
    user.user_metadata?.password_set !== true &&
    !pathname.startsWith('/auth/')
  ) {
    const setPwdUrl = request.nextUrl.clone();
    setPwdUrl.pathname = '/auth/set-password';
    setPwdUrl.search = '';
    return NextResponse.redirect(setPwdUrl);
  }

  // Already signed in but visiting /login? Send them home. Skip for
  // /auth/callback so the code exchange still runs.
  if (user && pathname === '/login') {
    const home = request.nextUrl.clone();
    home.pathname = '/';
    home.search = '';
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  // Run on everything except static assets, _next internals, and favicon.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
