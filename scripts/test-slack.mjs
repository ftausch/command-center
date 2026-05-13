// Test the Slack incoming webhook integration.
//
// Two modes:
//
//   npm run test:slack -- --url "https://hooks.slack.com/services/..."
//     Direct mode. Posts a test message to the URL. No DB access required.
//     Use this when you have the webhook URL handy and just want to
//     confirm Slack accepts it.
//
//   npm run test:slack -- --workspace unicornbakery
//     DB mode. Reads slack_integrations.webhook_url for the workspace
//     via the service-role admin client, posts a test message. Verifies
//     the URL is correctly stored AND that the workspace row is reachable.
//     Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in
//     .env.local (loaded via --env-file in the npm script).
//
// Both modes mask the webhook URL in output — only the first ~30 chars +
// project ID prefix are printed, never the secret token tail.
//
// Exit codes:
//   0  Slack accepted the POST
//   1  bad CLI args
//   2  env vars missing (DB mode only)
//   3  workspace / integration lookup failed
//   4  Slack rejected the POST (HTTP >= 300)

import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const arg = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
};

const urlArg = arg('--url');
const workspaceArg = arg('--workspace');

if ((!urlArg && !workspaceArg) || args.includes('--help') || args.includes('-h')) {
  console.error('Test the Slack webhook integration.');
  console.error('');
  console.error('Usage:');
  console.error('  npm run test:slack -- --url "<webhook-url>"');
  console.error('  npm run test:slack -- --workspace <slug>');
  console.error('');
  console.error('--url      : POST directly to the given URL (no DB access)');
  console.error('--workspace: look up the webhook URL via service-role for this workspace slug');
  process.exit(urlArg || workspaceArg ? 0 : 1);
}

/** Mask a webhook URL so logs never carry the secret tail. */
function maskWebhookUrl(u) {
  if (!u) return '';
  // Slack: https://hooks.slack.com/services/T123/B456/SECRET
  // Keep the team + bot prefix, hide the rest.
  const parts = u.split('/');
  if (parts.length < 7) return u.slice(0, 24) + '…';
  return [...parts.slice(0, 6), '****'].join('/');
}

async function postToWebhook(url, text) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    const body = await res.text().catch(() => '');
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

const testMessage = `🧪 Command Center webhook test — ${new Date().toISOString()}`;

let webhookUrl;
let modeLabel;

if (urlArg) {
  webhookUrl = urlArg;
  modeLabel = '--url';
  console.log(`[mode] ${modeLabel}`);
  console.log(`  webhook : ${maskWebhookUrl(webhookUrl)}`);
} else {
  modeLabel = `--workspace ${workspaceArg}`;
  console.log(`[mode] ${modeLabel}`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(2);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: ws, error: wsErr } = await admin
    .from('workspaces')
    .select('id, name')
    .eq('slug', workspaceArg)
    .maybeSingle();
  if (wsErr || !ws) {
    console.error(`Workspace lookup failed: ${wsErr?.message ?? 'no row for slug ' + workspaceArg}`);
    process.exit(3);
  }
  console.log(`  workspace: ${ws.name} (${ws.id})`);

  const { data: integ, error: intErr } = await admin
    .from('slack_integrations')
    .select('webhook_url, is_active')
    .eq('workspace_id', ws.id)
    .maybeSingle();
  if (intErr) {
    console.error(`slack_integrations lookup failed: ${intErr.message}`);
    process.exit(3);
  }
  if (!integ) {
    console.error('No slack_integrations row for this workspace — run supabase/setup-slack-webhook.sql first');
    process.exit(3);
  }
  if (!integ.is_active) {
    console.error('Integration row exists but is_active = false');
    process.exit(3);
  }
  if (!integ.webhook_url) {
    console.error('webhook_url is null — re-run supabase/setup-slack-webhook.sql with a real URL');
    process.exit(3);
  }
  webhookUrl = integ.webhook_url;
  console.log(`  webhook  : ${maskWebhookUrl(webhookUrl)}`);
}

console.log('Posting test message…');
try {
  const { status, body } = await postToWebhook(webhookUrl, testMessage);
  if (status < 300) {
    console.log(`✓ Slack accepted (HTTP ${status}, body: ${body.trim() || '(empty)'})`);
    process.exit(0);
  }
  console.error(`✗ Slack rejected (HTTP ${status}): ${body.slice(0, 200)}`);
  process.exit(4);
} catch (e) {
  if (e?.name === 'AbortError') {
    console.error('✗ Request timed out after 5s');
  } else {
    console.error('✗ Network error:', e?.message ?? e);
  }
  process.exit(4);
}
