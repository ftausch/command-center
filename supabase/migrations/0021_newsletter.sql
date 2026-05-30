-- Newsletter issues tracker
CREATE TABLE IF NOT EXISTS newsletter_issues (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  issue_number  integer,
  subject       text        NOT NULL,
  status        text        NOT NULL DEFAULT 'idea'
                            CHECK (status IN ('idea','draft','review','scheduled','sent')),
  audience      text,
  send_date     date,
  open_rate     numeric,
  click_rate    numeric,
  description   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE newsletter_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_read"   ON newsletter_issues FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "member_insert" ON newsletter_issues FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "member_update" ON newsletter_issues FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE POLICY "member_delete" ON newsletter_issues FOR DELETE USING (is_workspace_member(workspace_id));

CREATE INDEX IF NOT EXISTS newsletter_issues_workspace_id_idx ON newsletter_issues(workspace_id);
