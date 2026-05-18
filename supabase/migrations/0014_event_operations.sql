-- 0014_event_operations: Run-of-Show, Attendees, Partners/Sponsors
-- Applied 2026-05-18

-- ── Run-of-Show ───────────────────────────────────────────────────────────
CREATE TABLE event_agenda_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   uuid NOT NULL REFERENCES projects(id)   ON DELETE CASCADE,
  sort_order   integer NOT NULL DEFAULT 0,
  time_label   text,
  title        text NOT NULL,
  description  text,
  owner_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  location     text,
  status       text NOT NULL DEFAULT 'planned'
               CHECK (status IN ('planned','active','done','skipped')),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_agenda_project_idx ON event_agenda_items (project_id);
ALTER TABLE event_agenda_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY agenda_select ON event_agenda_items
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY agenda_write ON event_agenda_items
  FOR ALL USING  (has_workspace_role(workspace_id,'owner','admin','manager'))
         WITH CHECK (has_workspace_role(workspace_id,'owner','admin','manager'));

-- ── Attendees ─────────────────────────────────────────────────────────────
CREATE TABLE event_attendees (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   uuid NOT NULL REFERENCES projects(id)   ON DELETE CASCADE,
  name         text NOT NULL,
  email        text,
  company      text,
  role         text NOT NULL DEFAULT 'attendee'
               CHECK (role IN ('attendee','speaker','vip','partner_guest','team')),
  status       text NOT NULL DEFAULT 'invited'
               CHECK (status IN ('invited','confirmed','checked_in','no_show','cancelled')),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_attendees_project_idx ON event_attendees (project_id);
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY attendees_select ON event_attendees
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY attendees_write ON event_attendees
  FOR ALL USING  (has_workspace_role(workspace_id,'owner','admin','manager'))
         WITH CHECK (has_workspace_role(workspace_id,'owner','admin','manager'));

-- ── Partners / Sponsors ───────────────────────────────────────────────────
CREATE TABLE event_partners (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id     uuid NOT NULL REFERENCES projects(id)   ON DELETE CASCADE,
  name           text NOT NULL,
  contact_person text,
  email          text,
  status         text NOT NULL DEFAULT 'lead'
                 CHECK (status IN ('lead','contacted','call_scheduled',
                                   'offer_sent','confirmed','active',
                                   'recap_sent','closed')),
  package        text,
  deliverables   text,
  logo_received  boolean NOT NULL DEFAULT false,
  invoice_status text NOT NULL DEFAULT 'pending'
                 CHECK (invoice_status IN ('pending','sent','paid','cancelled')),
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_partners_project_idx ON event_partners (project_id);
ALTER TABLE event_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY partners_select ON event_partners
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY partners_write ON event_partners
  FOR ALL USING  (has_workspace_role(workspace_id,'owner','admin','manager'))
         WITH CHECK (has_workspace_role(workspace_id,'owner','admin','manager'));

-- ── Extend project_resources types ────────────────────────────────────────
ALTER TABLE project_resources DROP CONSTRAINT IF EXISTS project_resources_type_check;
ALTER TABLE project_resources
  ADD CONSTRAINT project_resources_type_check
  CHECK (type IN ('slack_channel','drive_folder','drive_subfolder',
                  'figma','canva','partner_deck','landing_page',
                  'signup','recap'));

-- ── event_meta safety ─────────────────────────────────────────────────────
ALTER TABLE projects ADD COLUMN IF NOT EXISTS event_meta jsonb;
