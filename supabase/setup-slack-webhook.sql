-- Configure an Incoming Webhook URL for a workspace.
--
-- Slack side:
--   1. https://api.slack.com/messaging/webhooks → "Create your Slack app"
--   2. Pick the Slack workspace, give the app a name (e.g. "Command Center")
--   3. Features → Incoming Webhooks → toggle on
--   4. "Add New Webhook to Workspace" → pick a channel → Allow
--   5. Copy the generated URL (starts with https://hooks.slack.com/services/…)
--   6. (Optional) repeat for the SelbstFrei channel — Slack lets one app
--      have multiple webhooks
--
-- DB side: replace the placeholders below and run in Supabase SQL Editor.
-- The webhook_url column is column-level revoked from authenticated/anon,
-- so this only works as the service-role / postgres role (which the SQL
-- editor uses by default).
--
-- After this runs, the app will post notifications on task created /
-- moved-to-review / completed / blocked, on project created, and on
-- comments — all best-effort, never blocks the user's action.

insert into slack_integrations (
  workspace_id, webhook_url, is_active, installed_by, team_name
)
select
  w.id,
  '<PASTE_INCOMING_WEBHOOK_URL>',
  true,
  '<YOUR_AUTH_UID>'::uuid,
  'Slack via Incoming Webhook'
from workspaces w
where w.slug = '<WORKSPACE_SLUG>' -- 'unicornbakery' or 'selbstfrei'
on conflict (workspace_id) do update set
  webhook_url = excluded.webhook_url,
  is_active   = excluded.is_active,
  installed_by = excluded.installed_by,
  team_name   = excluded.team_name;

-- Verify (won't show webhook_url because of the column revoke, but is_active
-- and team_name will appear):
-- select workspace_id, team_name, is_active from slack_integrations;
