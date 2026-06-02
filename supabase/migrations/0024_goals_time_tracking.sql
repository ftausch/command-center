-- OKR / Goals
CREATE TABLE IF NOT EXISTS goals (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title        text        NOT NULL,
  description  text,
  quarter      smallint    NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  year         smallint    NOT NULL,
  status       text        NOT NULL DEFAULT 'on_track'
               CHECK (status IN ('on_track','at_risk','off_track','done')),
  owner_id     uuid,
  project_id   uuid        REFERENCES projects(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS key_results (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id   uuid        NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title     text        NOT NULL,
  target    numeric     NOT NULL DEFAULT 100,
  current   numeric     NOT NULL DEFAULT 0,
  unit      text        NOT NULL DEFAULT '%',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE goals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_read_g"   ON goals       FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "member_insert_g" ON goals       FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "member_update_g" ON goals       FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE POLICY "member_delete_g" ON goals       FOR DELETE USING (is_workspace_member(workspace_id));

CREATE POLICY "member_read_kr"   ON key_results FOR SELECT USING (
  EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_id AND is_workspace_member(g.workspace_id))
);
CREATE POLICY "member_insert_kr" ON key_results FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_id AND is_workspace_member(g.workspace_id))
);
CREATE POLICY "member_update_kr" ON key_results FOR UPDATE USING (
  EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_id AND is_workspace_member(g.workspace_id))
);
CREATE POLICY "member_delete_kr" ON key_results FOR DELETE USING (
  EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_id AND is_workspace_member(g.workspace_id))
);

CREATE INDEX IF NOT EXISTS goals_workspace_idx ON goals(workspace_id);

-- Time tracking
CREATE TABLE IF NOT EXISTS time_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id      uuid        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL,
  minutes      integer     NOT NULL CHECK (minutes > 0),
  logged_date  date        NOT NULL DEFAULT CURRENT_DATE,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE time_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member_read_tl"   ON time_logs FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "member_insert_tl" ON time_logs FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "member_delete_tl" ON time_logs FOR DELETE USING (is_workspace_member(workspace_id));
CREATE INDEX IF NOT EXISTS time_logs_task_idx      ON time_logs(task_id);
CREATE INDEX IF NOT EXISTS time_logs_workspace_idx ON time_logs(workspace_id);
