-- Team standups
CREATE TABLE IF NOT EXISTS standups (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL,
  date         date        NOT NULL DEFAULT CURRENT_DATE,
  today        text,
  blockers     text,
  yesterday    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id, date)
);

ALTER TABLE standups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member_read"   ON standups FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "member_upsert" ON standups FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "member_update" ON standups FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE INDEX IF NOT EXISTS standups_workspace_date_idx ON standups(workspace_id, date);

-- Recurring tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence jsonb;
-- recurrence shape: { "type": "daily"|"weekly"|"biweekly"|"monthly", "interval": 1 }
