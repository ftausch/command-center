-- In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL,
  type         text        NOT NULL, -- 'mention' | 'assigned' | 'deadline' | 'comment' | 'blocked'
  title        text        NOT NULL,
  body         text,
  link_route   text,       -- e.g. 'project:abc' or 'mytasks'
  read         boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_read"   ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "member_insert" ON notifications FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, read, created_at DESC);

-- Workspace-level custom tags
CREATE TABLE IF NOT EXISTS workspace_tags (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  color        text        NOT NULL DEFAULT '#6366f1',
  UNIQUE(workspace_id, name)
);

ALTER TABLE workspace_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member_read_wt"   ON workspace_tags FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "member_insert_wt" ON workspace_tags FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "member_update_wt" ON workspace_tags FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE POLICY "member_delete_wt" ON workspace_tags FOR DELETE USING (is_workspace_member(workspace_id));
CREATE INDEX IF NOT EXISTS workspace_tags_workspace_idx ON workspace_tags(workspace_id);

-- Episode analytics (manual entry)
ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS downloads    integer;
ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS plays        integer;
ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS rating       numeric(3,1);
ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS review_count integer;
ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS spotify_url  text;
ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS apple_url    text;
