/** @type {import('next').NextConfig} */

// Security headers applied to every route.
//
// CSP notes:
//   - 'unsafe-inline' for scripts: Next.js 14 injects inline hydration scripts
//     that cannot be removed without a nonce setup. Acceptable given HTTPS +
//     no user-controlled script injection paths exist in this app.
//   - 'unsafe-eval' added only in development for Next.js HMR; stripped in prod.
//   - *.supabase.co covers the REST API (https) and Realtime WebSocket (wss).
//   - Slack webhook calls are server-side only — no browser connect-src needed.
//   - frame-ancestors 'none' + X-Frame-Options: DENY — belt-and-suspenders.

const isDev = process.env.NODE_ENV === 'development';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  // Force HTTPS for 2 years — only meaningful once the custom domain is live.
  // Browsers cache this; do not set on localhost (harmless but confusing).
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Prevent the app from being embedded in iframes (clickjacking).
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // Stop browsers from sniffing Content-Type (MIME confusion attacks).
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Send only the origin (not the full URL) as Referer on cross-origin requests.
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Disable browser features this app never uses.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // Content Security Policy — see notes above.
  {
    key: 'Content-Security-Policy',
    value: csp,
  },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Apply to every route including API routes and _next assets.
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
