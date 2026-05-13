// Slack integration — Slice A: Incoming Webhooks.
//
// Each workspace has one row in `slack_integrations` with a webhook_url
// (set up via supabase/setup-slack-webhook.sql). On notable events,
// server actions call postSlackNotification, which:
//   1. Looks up the workspace's webhook URL via the service-role admin
//      client (the URL is column-level revoked from authenticated/anon).
//   2. POSTs a JSON payload to that URL (Slack accepts `text`, no auth).
//   3. Mirrors the message into our `slack_notifications` table so the
//      Activity screen can render it.
//
// The function is best-effort: never throws, bounds wait to 3 seconds.
// Failures are logged but do not block the user's action from succeeding.
//
// Why server-only: webhook_url is a credential — anyone with the URL can
// post to the channel — so this module must never end up in the browser
// bundle. The `import 'server-only'` line errors at build time if it's
// imported from a client component.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

const SLACK_TIMEOUT_MS = 3_000;

interface PostParams {
  /** Workspace UUID (not slug — caller already resolved it). */
  workspaceUuid: string;
  /** The fallback plain-text message. Slack renders this when blocks aren't supported. */
  text: string;
  /** Channel name to record in slack_notifications. The webhook itself decides the real channel. */
  channelLabel?: string;
}

/**
 * Look up an active webhook URL for the workspace. Returns null when no
 * row exists or `is_active` is false.
 */
async function loadWebhookUrl(workspaceUuid: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from('slack_integrations')
    .select('webhook_url, is_active')
    .eq('workspace_id', workspaceUuid)
    .eq('is_active', true)
    .maybeSingle();
  if (error) {
    console.error('[slack] integration lookup failed', error);
    return null;
  }
  return (data?.webhook_url as string | null) ?? null;
}

/**
 * Send a message to the workspace's configured Slack channel via Incoming
 * Webhook. Never throws — Slack outages must not break the user-facing
 * action. Times out at 3 seconds.
 *
 * In mock mode (no service-role key set), this is a no-op.
 */
export async function postSlackNotification(params: PostParams): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const webhookUrl = await loadWebhookUrl(params.workspaceUuid);
  if (!webhookUrl) return; // workspace hasn't configured Slack — silent skip

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SLACK_TIMEOUT_MS);
  let delivered = false;
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: params.text }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[slack] webhook POST failed', res.status, detail.slice(0, 200));
    } else {
      delivered = true;
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      console.error('[slack] webhook POST timed out');
    } else {
      console.error('[slack] webhook POST error', e?.message ?? e);
    }
  } finally {
    clearTimeout(timer);
  }

  // Mirror into our own table so the Activity screen sees it even if the
  // Slack post failed (still useful as an in-app audit trail).
  await admin
    .from('slack_notifications')
    .insert({
      workspace_id: params.workspaceUuid,
      channel: params.channelLabel ?? '(webhook)',
      user_name: delivered ? 'Command Center' : 'Command Center (delivery failed)',
      message: params.text,
    })
    .then(({ error }) => {
      if (error) console.error('[slack] slack_notifications insert failed', error);
    });
}

/**
 * Look up the actor's display name for use in Slack message bodies.
 * Uses the admin client because it needs to read profiles regardless of
 * the request user's row-level visibility. Falls back to a short version
 * of the UUID so the message is never blank.
 */
export async function actorDisplayName(actorId: string): Promise<string> {
  const admin = createAdminClient();
  if (!admin) return 'Someone';
  const { data } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', actorId)
    .maybeSingle();
  return (data?.full_name as string | null) ?? (data?.email as string | null) ?? 'Someone';
}
