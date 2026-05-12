-- Seed the two initial workspaces. Idempotent — safe to run repeatedly.
-- Workspace member rows are intentionally NOT seeded here; add yourself via:
--
--   insert into workspace_members (workspace_id, user_id, role)
--   select id, '<your-auth-uid>', 'owner'
--   from workspaces where slug in ('unicornbakery', 'selbstfrei');

insert into workspaces (slug, name, color, tagline) values
  ('unicornbakery', 'UnicornBakery', '#1a3d5c',
   'Der Podcast für Founder, CEOs & das Startup-Ökosystem.'),
  ('selbstfrei',    'SelbstFrei',    '#7a3dc4',
   'Gründerstorys, die Reichweite verdienen.')
on conflict (slug) do nothing;
