-- Podcast guest CRM — track potential and confirmed podcast guests.

CREATE TABLE podcast_guests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            text NOT NULL,
  email           text,
  company         text,
  role            text,
  linkedin_url    text,
  twitter_handle  text,
  bio             text,
  status          text NOT NULL DEFAULT 'prospect'
                  CHECK (status IN ('prospect','contacted','confirmed','recorded','published','recurring')),
  notes           text,
  last_contacted  date,
  episode_count   integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX podcast_guests_workspace_idx ON podcast_guests (workspace_id, created_at DESC);
CREATE INDEX podcast_guests_status_idx    ON podcast_guests (workspace_id, status);

ALTER TABLE podcast_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY guests_select ON podcast_guests
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY guests_write ON podcast_guests
  FOR ALL
  USING  (has_workspace_role(workspace_id, 'owner', 'admin', 'manager', 'member'))
  WITH CHECK (has_workspace_role(workspace_id, 'owner', 'admin', 'manager', 'member'));

CREATE TRIGGER set_updated_at_podcast_guests
  BEFORE UPDATE ON podcast_guests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
