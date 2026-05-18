-- 0019_assistant_items: PA / Assistant Hub operational items.

CREATE TABLE assistant_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_id            uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  related_project_id  uuid REFERENCES projects(id) ON DELETE SET NULL,
  title               text NOT NULL,
  description         text,
  type                text NOT NULL DEFAULT 'follow_up'
                      CHECK (type IN ('follow_up','scheduling','document_request',
                                      'approval','reminder','other')),
  status              text NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','waiting','done','escalated','cancelled')),
  priority            text CHECK (priority IN ('low','medium','high','urgent')),
  contact_name        text,
  contact_email       text,
  company             text,
  due_date            date,
  next_follow_up_at   timestamptz,
  last_contacted_at   timestamptz,
  snoozed_until       timestamptz,
  metadata            jsonb NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX assistant_items_workspace_idx ON assistant_items (workspace_id, status, due_date);
CREATE INDEX assistant_items_owner_idx     ON assistant_items (owner_id)       WHERE owner_id IS NOT NULL;
CREATE INDEX assistant_items_due_idx       ON assistant_items (due_date)       WHERE due_date IS NOT NULL;
CREATE INDEX assistant_items_snooze_idx    ON assistant_items (snoozed_until)  WHERE snoozed_until IS NOT NULL;

ALTER TABLE assistant_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_select ON assistant_items FOR SELECT USING (
  is_workspace_member(workspace_id) AND (
    has_workspace_role(workspace_id, 'owner', 'admin', 'manager')
    OR owner_id  = auth.uid()
    OR created_by = auth.uid()
  )
);

CREATE POLICY ai_write ON assistant_items FOR ALL
  USING  (has_workspace_role(workspace_id, 'owner', 'admin', 'manager') OR owner_id = auth.uid())
  WITH CHECK (has_workspace_role(workspace_id, 'owner', 'admin', 'manager') OR owner_id = auth.uid());

CREATE TRIGGER set_updated_at_assistant_items
  BEFORE UPDATE ON assistant_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
