-- Extend episode_status enum with two new production pipeline stages.
-- Applied 2026-05-15.
--
-- Full pipeline order after this migration:
--   idea → draft → review → scheduled → published
--
-- Existing rows are unaffected — 'draft', 'scheduled', 'published' remain valid.

ALTER TYPE episode_status ADD VALUE IF NOT EXISTS 'idea'   BEFORE 'draft';
ALTER TYPE episode_status ADD VALUE IF NOT EXISTS 'review' AFTER  'draft';
