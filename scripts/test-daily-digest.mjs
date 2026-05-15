#!/usr/bin/env node
// Manually trigger the daily-digest cron endpoint.
//
// Usage (local):
//   npm run test:daily-digest
//
// Usage (production):
//   TEST_URL=https://team.unicornbakery.de npm run test:daily-digest
//
// Requires CRON_SECRET to be set in .env.local (loaded automatically by
// the --env-file flag in the npm script).

const BASE   = process.env.TEST_URL ?? 'http://localhost:3000';
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error('❌  CRON_SECRET is not set in .env.local');
  console.error('    Add CRON_SECRET=<your-secret> to .env.local and retry.');
  process.exit(1);
}

const url = `${BASE}/api/cron/daily-digest`;
console.log(`📤  Triggering daily digest → ${url}`);

let res;
try {
  res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${secret}` },
  });
} catch (err) {
  console.error('❌  Fetch failed:', err.message);
  console.error('    Is the dev server running? (npm run dev)');
  process.exit(1);
}

const raw  = await res.text();
let body;
try { body = JSON.parse(raw); } catch { body = raw; }

console.log(`HTTP ${res.status}`);
console.log(JSON.stringify(body, null, 2));

if (!res.ok) {
  console.error('❌  Request failed.');
  process.exit(1);
}

const { notified, results } = body;
if (notified === 0) {
  console.log('ℹ️   No digests sent (no active Slack integrations, or no workspaces matched).');
} else {
  console.log(`✅  Digest sent for ${notified} workspace(s).`);
  for (const r of results ?? []) {
    const icon = r.status === 'sent' ? '✓' : '✗';
    console.log(`  ${icon}  ${r.workspace_name ?? r.workspace_id} — ${r.status}${r.tasks != null ? ` (${r.tasks} open tasks)` : ''}`);
  }
}
