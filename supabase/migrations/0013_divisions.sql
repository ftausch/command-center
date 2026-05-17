-- 0013_divisions: Add division support for Podcast / Events split inside a workspace.
-- Applied 2026-05-17.

-- Add division column to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS division text NOT NULL DEFAULT 'general'
  CHECK (division IN ('podcast', 'events', 'general'));

CREATE INDEX IF NOT EXISTS projects_division_idx ON projects (workspace_id, division);

-- Add capabilities column to workspaces
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS capabilities jsonb NOT NULL DEFAULT '{"podcast": true, "events": false}';

-- UnicornBakery gets both podcast + events
UPDATE workspaces
  SET capabilities = '{"podcast": true, "events": true}'
  WHERE slug = 'unicornbakery';

-- Classify existing projects by type
UPDATE projects SET division = 'podcast'
  WHERE type IN ('Episode', 'Recording', 'Clips', 'Newsletter');

UPDATE projects SET division = 'events'
  WHERE type IN ('Event', 'Workshop', 'Shoot');
