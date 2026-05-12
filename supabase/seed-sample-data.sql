-- Optional. Sample projects + tasks for both workspaces so the UI has
-- something to render after first login. Replace <YOUR_AUTH_UID> below.
-- Idempotent: a project name is the natural key in this script, so
-- re-running won't create duplicates.
--
-- Apply order: 0001 → 0002 → seed.sql → seed-membership.sql → THIS file.

do $$
declare
  me uuid := '<YOUR_AUTH_UID>'::uuid;
  ub uuid;
  sf uuid;
  proj uuid;
begin
  select id into ub from workspaces where slug = 'unicornbakery';
  select id into sf from workspaces where slug = 'selbstfrei';
  if ub is null or sf is null then
    raise exception 'Workspaces not seeded yet — run supabase/seed.sql first';
  end if;

  -- ── UnicornBakery: Ep. 142 ─────────────────────────────────────────
  if not exists (
    select 1 from projects where workspace_id = ub and name = 'Ep. 142 — Verena Pausder'
  ) then
    insert into projects (
      workspace_id, name, type, description,
      status, priority, progress, phase_idx, due_date,
      owner_id, slack_channel, slack_connected
    ) values (
      ub, 'Ep. 142 — Verena Pausder', 'Episode',
      'Founder-Politik & Bildungswandel. 60-Min-Episode mit drei LinkedIn-Cuts und Newsletter-Recap.',
      'In Progress', 'High', 62, 3, '2026-05-18',
      me, '#ub-ep142-pausder', true
    ) returning id into proj;

    insert into tasks (workspace_id, project_id, title, status, priority, assignee_id, due_date) values
      (ub, proj, 'Rough Cut Ep. 142 fertigstellen', 'In Progress', 'High', me, '2026-05-11'),
      (ub, proj, 'LinkedIn-Header A + B',           'In Progress', 'Medium', me, '2026-05-12'),
      (ub, proj, 'Episode-Beschreibung schreiben',  'To Do',       'Medium', me, '2026-05-14'),
      (ub, proj, 'Fabian Review Rough Cut',         'Review',      'High',   me, '2026-05-13');
  end if;

  -- ── UnicornBakery: Newsletter Mai ──────────────────────────────────
  if not exists (
    select 1 from projects where workspace_id = ub and name = 'Newsletter Mai · Vol. 21'
  ) then
    insert into projects (
      workspace_id, name, type, description,
      status, priority, progress, phase_idx, due_date,
      owner_id, slack_channel, slack_connected
    ) values (
      ub, 'Newsletter Mai · Vol. 21', 'Newsletter',
      'Founder-Spotlight, drei Reads, Best of Episodes.',
      'Review', 'Medium', 80, 4, '2026-05-14',
      me, '#ub-newsletter', true
    ) returning id into proj;

    insert into tasks (workspace_id, project_id, title, status, priority, assignee_id, due_date) values
      (ub, proj, 'Founder-Spotlight final freigeben', 'Review', 'High',   me, '2026-05-12'),
      (ub, proj, 'Mailchimp Vorschau testen',         'To Do',  'Medium', me, '2026-05-13');
  end if;

  -- ── SelbstFrei: Ep. 048 ────────────────────────────────────────────
  if not exists (
    select 1 from projects where workspace_id = sf and name = 'Ep. 048 — Verena Hubertz'
  ) then
    insert into projects (
      workspace_id, name, type, description,
      status, priority, progress, phase_idx, due_date,
      owner_id, slack_channel, slack_connected
    ) values (
      sf, 'Ep. 048 — Verena Hubertz', 'Episode',
      'Politik trifft Gründertum. Hochfrequenter Clip-Cut für TikTok geplant.',
      'In Progress', 'High', 75, 4, '2026-05-13',
      me, '#sf-ep048-hubertz', true
    ) returning id into proj;

    insert into tasks (workspace_id, project_id, title, status, priority, assignee_id, due_date) values
      (sf, proj, 'Final Cut Ep. 048 abnehmen', 'Review',      'High', me, '2026-05-11'),
      (sf, proj, 'TikTok-Cuts (5×)',           'In Progress', 'High', me, '2026-05-12'),
      (sf, proj, 'Thumbnail Hubertz',          'In Progress', 'High', me, '2026-05-12');
  end if;

  -- ── SelbstFrei: Viral Clip Batch ───────────────────────────────────
  if not exists (
    select 1 from projects where workspace_id = sf and name = 'Viral Clip Batch · KW20'
  ) then
    insert into projects (
      workspace_id, name, type, description,
      status, priority, progress, phase_idx, due_date,
      owner_id, slack_channel, slack_connected
    ) values (
      sf, 'Viral Clip Batch · KW20', 'Clips',
      '12 Shortform-Cuts aus den letzten 4 Episoden für TikTok, Reels, Shorts.',
      'Review', 'High', 70, 4, '2026-05-12',
      me, '#sf-clips', true
    ) returning id into proj;

    insert into tasks (workspace_id, project_id, title, status, priority, assignee_id, due_date) values
      (sf, proj, 'Clip-Set #2 (Ep. 047)',      'Review',      'High',   me, '2026-05-11'),
      (sf, proj, 'Captions-Pass alle Clips',   'In Progress', 'Medium', me, '2026-05-12');
  end if;
end$$;
