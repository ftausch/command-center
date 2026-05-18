-- 0020_operations: Workspace-wide Approval Center, Decision Center, Risk Board

-- ── Approval Items ────────────────────────────────────────────────────────
CREATE TABLE approval_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  related_project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  related_task_id    uuid REFERENCES tasks(id)    ON DELETE SET NULL,
  created_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewer_id        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title              text NOT NULL,
  description        text,
  type               text NOT NULL DEFAULT 'other'
                     CHECK (type IN ('podcast_title','thumbnail','landingpage',
                                     'sponsor_text','run_of_show','linkedin_post',
                                     'newsletter','recap','partner_report',
                                     'budget','guest_briefing','other')),
  status             text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','ready_for_review',
                                       'changes_requested','approved',
                                       'published','cancelled')),
  priority           text CHECK (priority IN ('low','medium','high','urgent')),
  due_date           date,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX approval_items_workspace_idx ON approval_items (workspace_id, status);
CREATE INDEX approval_items_reviewer_idx  ON approval_items (reviewer_id) WHERE reviewer_id IS NOT NULL;
CREATE INDEX approval_items_due_idx       ON approval_items (due_date)    WHERE due_date IS NOT NULL;
ALTER TABLE approval_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY appr_select ON approval_items FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY appr_write  ON approval_items FOR ALL
  USING  (has_workspace_role(workspace_id,'owner','admin','manager') OR reviewer_id = auth.uid() OR created_by = auth.uid())
  WITH CHECK (has_workspace_role(workspace_id,'owner','admin','manager') OR created_by = auth.uid());
CREATE TRIGGER set_updated_at_approval_items BEFORE UPDATE ON approval_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Decision Items ────────────────────────────────────────────────────────
CREATE TABLE decision_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  related_project_id  uuid REFERENCES projects(id) ON DELETE SET NULL,
  created_by          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  decision_owner_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title               text NOT NULL,
  context             text,
  option_a            text,
  option_b            text,
  option_c            text,
  recommendation      text,
  status              text NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','ready','decided','blocked','cancelled')),
  needed_by           date,
  decision_result     text,
  impact              text CHECK (impact IN ('low','medium','high','critical')),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX decision_items_workspace_idx ON decision_items (workspace_id, status);
CREATE INDEX decision_items_owner_idx     ON decision_items (decision_owner_id) WHERE decision_owner_id IS NOT NULL;
CREATE INDEX decision_items_needed_idx    ON decision_items (needed_by) WHERE needed_by IS NOT NULL;
ALTER TABLE decision_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY dec_select ON decision_items FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY dec_write  ON decision_items FOR ALL
  USING  (has_workspace_role(workspace_id,'owner','admin','manager') OR decision_owner_id = auth.uid() OR created_by = auth.uid())
  WITH CHECK (has_workspace_role(workspace_id,'owner','admin','manager') OR created_by = auth.uid());
CREATE TRIGGER set_updated_at_decision_items BEFORE UPDATE ON decision_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Risk Items ────────────────────────────────────────────────────────────
CREATE TABLE risk_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  related_project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  related_task_id    uuid REFERENCES tasks(id)    ON DELETE SET NULL,
  created_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  owner_id           uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title              text NOT NULL,
  description        text,
  type               text NOT NULL DEFAULT 'risk'
                     CHECK (type IN ('risk','blocker')),
  severity           text NOT NULL DEFAULT 'medium'
                     CHECK (severity IN ('low','medium','high','critical')),
  status             text NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','monitoring','resolved','ignored')),
  impact             text,
  mitigation_plan    text,
  due_date           date,
  resolved_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX risk_items_workspace_idx ON risk_items (workspace_id, status, severity);
CREATE INDEX risk_items_project_idx   ON risk_items (related_project_id) WHERE related_project_id IS NOT NULL;
ALTER TABLE risk_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY risk_select ON risk_items FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY risk_write  ON risk_items FOR ALL
  USING  (has_workspace_role(workspace_id,'owner','admin','manager') OR owner_id = auth.uid() OR created_by = auth.uid())
  WITH CHECK (has_workspace_role(workspace_id,'owner','admin','manager') OR created_by = auth.uid());
CREATE TRIGGER set_updated_at_risk_items BEFORE UPDATE ON risk_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
