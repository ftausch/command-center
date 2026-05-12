// Slack integration placeholder. The real OAuth handshake, signature
// verification, and webhook delivery land in Phase 3. This file pins the
// surface so callers (server actions, route handlers) compile against a
// stable API today.
//
// Why server-only: any code touching the access_token column must be
// service-role; never reachable from a client component.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SlackIntegration, SlackNotification } from '@/lib/types';

/** Fetch the Slack integration row (including access_token) for a workspace. */
export async function getSlackIntegration(
  workspaceId: string,
): Promise<SlackIntegration | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from('slack_integrations')
    .select('id, workspace_id, team_id, team_name, bot_user_id, installed_by, installed_at, is_active')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error) {
    console.error('[slack] integration lookup failed', error);
    return null;
  }
  return (data as SlackIntegration | null) ?? null;
}

/**
 * Post a message to the Slack channel mapped to this project/task. Stubbed
 * for Phase 2 — does not call the Slack API yet. Logs the intent into the
 * slack_notifications table so the Activity screen has data to render.
 */
export async function postSlackNotification(params: {
  workspaceId: string;
  channel: string;
  userName?: string;
  message: string;
}): Promise<SlackNotification | null> {
  const admin = createAdminClient();
  if (!admin) {
    console.warn('[slack] admin client unavailable; notification dropped');
    return null;
  }
  const { data, error } = await admin
    .from('slack_notifications')
    .insert({
      workspace_id: params.workspaceId,
      channel: params.channel,
      user_name: params.userName ?? null,
      message: params.message,
    })
    .select()
    .single();
  if (error) {
    console.error('[slack] notification insert failed', error);
    return null;
  }
  return data as SlackNotification;
}
