-- Task effort estimates (story points)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimate smallint;

-- Sprints
CREATE TABLE IF NOT EXISTS sprints (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  goal         text,
  start_date   date        NOT NULL,
  end_date     date        NOT NULL,
  status       text        NOT NULL DEFAULT 'planned'
               CHECK (status IN ('planned','active','completed')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member_read"   ON sprints FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "member_insert" ON sprints FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "member_update" ON sprints FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE POLICY "member_delete" ON sprints FOR DELETE USING (is_workspace_member(workspace_id));
CREATE INDEX IF NOT EXISTS sprints_workspace_idx ON sprints(workspace_id);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sprint_id uuid REFERENCES sprints(id) ON DELETE SET NULL;

-- Social media posts
CREATE TABLE IF NOT EXISTS social_posts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform     text        NOT NULL CHECK (platform IN ('linkedin','instagram','twitter','tiktok','youtube')),
  content      text        NOT NULL,
  status       text        NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','approved','scheduled','posted')),
  scheduled_at timestamptz,
  episode_id   uuid        REFERENCES podcast_episodes(id) ON DELETE SET NULL,
  project_id   uuid        REFERENCES projects(id) ON DELETE SET NULL,
  media_url    text,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member_read"   ON social_posts FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "member_insert" ON social_posts FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "member_update" ON social_posts FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE POLICY "member_delete" ON social_posts FOR DELETE USING (is_workspace_member(workspace_id));
CREATE INDEX IF NOT EXISTS social_posts_workspace_idx ON social_posts(workspace_id);
