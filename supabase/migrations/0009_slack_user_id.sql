-- Store Slack user ID on profiles for reliable /cc command user mapping.
-- Auto-populated the first time a user successfully runs a /cc command
-- (fuzzy name match succeeds → slack_user_id saved fire-and-forget).
-- Subsequent /cc commands use exact ID match instead of fuzzy name match.

alter table profiles
  add column if not exists slack_user_id text;

create unique index if not exists profiles_slack_user_id_idx
  on profiles(slack_user_id)
  where slack_user_id is not null;
