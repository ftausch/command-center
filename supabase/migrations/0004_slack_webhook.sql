-- Add Incoming Webhook URL to slack_integrations.
--
-- Slice A of the Slack integration: each workspace has one Incoming
-- Webhook URL that the server posts to whenever a notable event happens
-- (task created / completed / blocked / moved to Review, comment added,
-- project created). No Slack app, no OAuth, send-only.
--
-- The webhook_url is a secret (anyone with the URL can post to the
-- channel), so we apply the same column-level revoke that was already
-- in place for access_token: only the service-role client can read it.
-- Authenticated users can see the row existence (and is_active), but
-- never the URL itself.

alter table slack_integrations
  add column if not exists webhook_url text;

revoke select (webhook_url) on slack_integrations from authenticated, anon;
