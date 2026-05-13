// Mint a one-shot magic link via the service-role admin client and copy
// it to the macOS clipboard. The URL is never printed — only a "copied"
// confirmation. Used to log into production when the regular magic-link
// flow is rate-limited.
//
// Usage:
//   node --env-file=.env.local scripts/mint-prod-login.mjs
//
// The link is a single-use credential: anyone holding it can sign in as
// fabian@unicornbakery.de. Paste into your browser within a few minutes
// and consume it; don't share it.

import { createClient } from '@supabase/supabase-js';
import { spawn } from 'node:child_process';

const EMAIL = 'fabian@unicornbakery.de';
const REDIRECT_TO =
  'https://command-center-git-main-unicorn-bakery.vercel.app/auth/callback';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(2);
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email: EMAIL,
  options: { redirectTo: REDIRECT_TO },
});
if (error || !data?.properties?.action_link) {
  console.error(`generateLink failed: ${error?.message ?? 'no action_link in response'}`);
  process.exit(3);
}

// Pipe the URL into pbcopy via stdin so it never touches stdout/stderr.
await new Promise((resolve, reject) => {
  const proc = spawn('pbcopy');
  proc.on('error', reject);
  proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`pbcopy exit ${code}`))));
  proc.stdin.end(data.properties.action_link);
});

console.log(`✓ Magic link for ${EMAIL} copied to clipboard.`);
console.log(`  Redirect: ${REDIRECT_TO}`);
console.log('  Paste into your browser within ~5 min. Single-use.');
