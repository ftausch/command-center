-- 0016_event_approvals_decisions: Approval Center + Decision Log for events.

-- ── Approvals ─────────────────────────────────────────────────────────────
CREATE TABLE event_approvals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id    uuid NOT NULL REFERENCES projects(id)   ON DELETE CASCADE,
  title         text NOT NULL,
  type          text NOT NULL DEFAULT 'other'
                CHECK (type IN ('landingpage','sponsor_text','linkedin_post',
                                'event_recap','thumbnail','newsletter',
                                'run_of_show','other')),
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','ready_for_review',
                                  'changes_requested','approved','published')),
  reviewer_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  requested_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  due_date      date,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_approvals_project_idx ON event_approvals (project_id);
CREATE INDEX event_approvals_status_idx  ON event_approvals (status);
ALTER TABLE event_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY approvals_select ON event_approvals
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY approvals_write  ON event_approvals
  FOR ALL    USING  (has_workspace_role(workspace_id,'owner','admin','manager'))
             WITH CHECK (has_workspace_role(workspace_id,'owner','admin','manager'));

-- ── Decision Log ──────────────────────────────────────────────────────────
CREATE TABLE event_decisions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   uuid NOT NULL REFERENCES projects(id)   ON DELETE CASCADE,
  decision     text NOT NULL,
  reason       text,
  decided_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  decided_at   timestamptz NOT NULL DEFAULT now(),
  impact       text CHECK (impact IN ('low','medium','high')),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_decisions_project_idx ON event_decisions (project_id);
ALTER TABLE event_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY decisions_select ON event_decisions
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY decisions_write  ON event_decisions
  FOR ALL    USING  (has_workspace_role(workspace_id,'owner','admin','manager'))
             WITH CHECK (has_workspace_role(workspace_id,'owner','admin','manager'));
