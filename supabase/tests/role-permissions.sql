-- Role permission probe.
--
-- Run in Supabase Dashboard → SQL Editor, signed in as the postgres /
-- service-role role. The script temporarily sets your workspace_members
-- row to each role in turn, then probes a representative operation as
-- that authenticated role (via JWT-claim simulation). All probes are
-- non-destructive — any rows inserted during the probe are deleted by
-- the same block before the next role is tested. Your original role is
-- restored at the end, even on error.
--
-- ── Setup ─────────────────────────────────────────────────────────────
-- Replace the two placeholders below with your values.
-- Your auth.uid:
--   select id, email from auth.users where email = 'you@example.com';
-- A workspace you're already a member of:
--   select slug from workspaces;
-- A workspace must have ≥ 1 project for the create-task probe to run.
-- (You can run supabase/seed-sample-data.sql to bootstrap one.)

do $$
declare
  me        uuid := '<YOUR_AUTH_UID>'::uuid;
  ws_slug   text := 'unicornbakery';
  ws_id     uuid;
  proj_id   uuid;
  original  role;
  cur       role;
  jwt       text;
  log_line  text;
begin
  -- ── resolve workspace + check membership ─────────────────────────────
  select id into ws_id from workspaces where slug = ws_slug;
  if ws_id is null then
    raise exception 'workspace % not found — run supabase/seed.sql first', ws_slug;
  end if;

  select role into original
    from workspace_members
    where user_id = me and workspace_id = ws_id;
  if original is null then
    raise exception 'user % is not a member of % — run supabase/seed-membership.sql first', me, ws_slug;
  end if;

  select id into proj_id from projects where workspace_id = ws_id limit 1;

  raise notice '──────────────────────────────────────────────';
  raise notice ' user        : %', me;
  raise notice ' workspace   : % (%)', ws_slug, ws_id;
  raise notice ' original    : %', original;
  if proj_id is null then
    raise notice ' ! no projects exist — create-task probe will be skipped';
  end if;
  raise notice '──────────────────────────────────────────────';

  -- ── probe loop ───────────────────────────────────────────────────────
  for cur in select unnest(enum_range(null::role)) loop
    -- apply role as superuser (bypasses RLS)
    update workspace_members
      set role = cur
      where user_id = me and workspace_id = ws_id;

    jwt := json_build_object(
      'sub',  me::text,
      'role', 'authenticated',
      'aud',  'authenticated'
    )::text;

    raise notice '';
    raise notice '─── role: % ───', cur;

    -- ── probe 1: select workspace (should ✓ for every role) ───────────
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jwt, true);
    begin
      perform 1 from workspaces where id = ws_id;
      if found then
        log_line := 'select workspace : ✓ allowed';
      else
        log_line := 'select workspace : ✗ no row visible (unexpected)';
      end if;
    exception when others then
      log_line := format('select workspace : ✗ %s (%s)', sqlstate, sqlerrm);
    end;
    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', '', true);
    raise notice '  %', log_line;

    -- ── probe 2: create project (expected ✗ for viewer + member) ──────
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jwt, true);
    begin
      insert into projects (workspace_id, name, status, priority)
        values (ws_id, '__rls_probe_project', 'Planning', 'Medium');
      log_line := 'create project   : ✓ allowed';
    exception when others then
      log_line := format('create project   : ✗ %s', sqlstate);
    end;
    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', '', true);
    delete from projects where workspace_id = ws_id and name = '__rls_probe_project';
    raise notice '  %', log_line;

    -- ── probe 3: create task (expected ✗ for viewer only) ─────────────
    if proj_id is not null then
      perform set_config('role', 'authenticated', true);
      perform set_config('request.jwt.claims', jwt, true);
      begin
        insert into tasks (workspace_id, project_id, title)
          values (ws_id, proj_id, '__rls_probe_task');
        log_line := 'create task      : ✓ allowed';
      exception when others then
        log_line := format('create task      : ✗ %s', sqlstate);
      end;
      perform set_config('role', 'postgres', true);
      perform set_config('request.jwt.claims', '', true);
      delete from tasks where workspace_id = ws_id and title = '__rls_probe_task';
      raise notice '  %', log_line;
    end if;

    -- ── probe 4: read slack access_token (expected ✗ for every role) ──
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jwt, true);
    begin
      perform access_token from slack_integrations where workspace_id = ws_id limit 1;
      log_line := 'read slack token : ⚠ allowed (column revoke missing?)';
    exception when others then
      log_line := format('read slack token : ✓ denied (%s)', sqlstate);
    end;
    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', '', true);
    raise notice '  %', log_line;
  end loop;

  -- ── restore ──────────────────────────────────────────────────────────
  update workspace_members
    set role = original
    where user_id = me and workspace_id = ws_id;

  raise notice '';
  raise notice '──────────────────────────────────────────────';
  raise notice ' restored role to %', original;
  raise notice '──────────────────────────────────────────────';

exception when others then
  -- restore role even if a probe explosion crashes the loop
  begin
    update workspace_members
      set role = original
      where user_id = me and workspace_id = ws_id;
  exception when others then null;
  end;
  raise;
end$$;

-- ── Expected output ─────────────────────────────────────────────────────
-- ─── role: viewer ───
--   select workspace : ✓ allowed
--   create project   : ✗ 42501
--   create task      : ✗ 42501
--   read slack token : ✓ denied (42501)
-- ─── role: member ───
--   select workspace : ✓ allowed
--   create project   : ✗ 42501
--   create task      : ✓ allowed
--   read slack token : ✓ denied (42501)
-- ─── role: manager ───
--   select workspace : ✓ allowed
--   create project   : ✓ allowed
--   create task      : ✓ allowed
--   read slack token : ✓ denied (42501)
-- ─── role: admin ───
--   select workspace : ✓ allowed
--   create project   : ✓ allowed
--   create task      : ✓ allowed
--   read slack token : ✓ denied (42501)   ← admin-only column access goes through service-role,
--                                            not the authenticated JWT
-- ─── role: owner ───
--   select workspace : ✓ allowed
--   create project   : ✓ allowed
--   create task      : ✓ allowed
--   read slack token : ✓ denied (42501)
