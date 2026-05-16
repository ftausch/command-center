// Slack integration — Slice A: Incoming Webhooks + Slice B: Bot API.
//
// Slice A (webhook): each workspace has one row in `slack_integrations` with
// a webhook_url. postSlackNotification posts there and mirrors to our DB.
//
// Slice B (Bot API): uses SLACK_BOT_TOKEN (xoxb-...) to actually create
// channels via conversations.create. Requires the Slack App to have the
// channels:manage + chat:write scopes installed to the workspace.
//
// Why server-only: both the webhook URL and the bot token are credentials.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

const SLACK_API_TIMEOUT_MS = 6_000;

// ── Slice B: Bot API ───────────────────────────────────────────────────────

export interface CreateChannelResult {
  channelId: string;
  channelName: string;
  /** Deep-link URL using the channel ID — more stable than name-based links. */
  url: string;
  /** True when the channel already existed (name_taken). */
  alreadyExisted: boolean;
}

/**
 * Create a Slack channel via the Bot Token (conversations.create).
 * Returns null when SLACK_BOT_TOKEN is not configured — callers fall back
 * to storing only the name without creating anything in Slack.
 *
 * Handles name_taken gracefully: tries to look up the existing channel ID
 * so we still get a real deep-link URL.
 */
export async function createSlackChannel(
  channelName: string,
  isPrivate = false,
): Promise<CreateChannelResult | null> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SLACK_API_TIMEOUT_MS);

  try {
    const res = await fetch('https://slack.com/api/conversations.create', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: channelName, is_private: isPrivate }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const json = (await res.json()) as any;

    if (json.ok) {
      const id = json.channel.id as string;
      return {
        channelId: id,
        channelName: (json.channel.name as string) ?? channelName,
        url: `https://slack.com/app_redirect?channel=${id}`,
        alreadyExisted: false,
      };
    }

    if (json.error === 'name_taken') {
      // Channel already exists — look up its ID so we can link to it properly.
      const existing = await findChannelByName(channelName, token);
      if (existing) return { ...existing, alreadyExisted: true };
      // Fallback: name-based redirect (no channel ID).
      return {
        channelId: '',
        channelName,
        url: `https://slack.com/app_redirect?channel=${encodeURIComponent(channelName)}`,
        alreadyExisted: true,
      };
    }

    console.error('[slack] conversations.create error:', json.error);
    return null;
  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name !== 'AbortError') console.error('[slack] createSlackChannel:', e?.message ?? e);
    else console.error('[slack] createSlackChannel timed out');
    return null;
  }
}

/**
 * Post a message directly to a channel using the Bot Token (chat.postMessage).
 * Requires chat:write scope. Best-effort — never throws.
 */
export async function postMessageToChannel(
  channelId: string,
  text: string,
): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token || !channelId) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SLACK_API_TIMEOUT_MS);
  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel: channelId, text }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const json = (await res.json()) as any;
    if (!json.ok) console.error('[slack] chat.postMessage error:', json.error);
  } catch (e: any) {
    clearTimeout(timer);
    console.error('[slack] postMessageToChannel error:', e?.message ?? e);
  }
}

async function findChannelByName(
  name: string,
  token: string,
): Promise<{ channelId: string; channelName: string; url: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SLACK_API_TIMEOUT_MS);
  try {
    const res = await fetch(
      'https://slack.com/api/conversations.list?exclude_archived=true&limit=1000&types=public_channel,private_channel',
      { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal },
    );
    clearTimeout(timer);
    const json = (await res.json()) as any;
    if (!json.ok) return null;
    const found = (json.channels as any[])?.find((c) => c.name === name);
    if (!found) return null;
    return {
      channelId: found.id,
      channelName: found.name,
      url: `https://slack.com/app_redirect?channel=${found.id}`,
    };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

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
