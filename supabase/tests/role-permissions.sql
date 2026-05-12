-- Comprehensive role + RLS probe. Covers the 10 Phase 6 verification
-- items. Non-destructive — saves/restores your role(s) and deletes every
-- probe row before exit.
--
-- ── Setup ─────────────────────────────────────────────────────────────
-- Replace <YOUR_AUTH_UID> below. Your auth.users.id is in:
--   select id, email from auth.users where email = '<your-email>';
--
-- The script assumes:
--   - You're a member of `unicornbakery` (primary)
--   - workspace `selbstfrei` exists (secondary; used to test cross-workspace
--     isolation; the script temporarily removes you from it if you're a
--     member, then re-adds you with your original role)
--   - At least one project exists in unicornbakery for the task probes
--     (run supabase/seed-sample-data.sql first if not)
--
-- Each probe prints `allowed` or `denied (<reason>)`. Unexpected values
-- are flagged with "LEAK" or "HOLE".

do $$
declare
  me                  uuid := '<YOUR_AUTH_UID>'::uuid;
  primary_slug        text := 'unicornbakery';
  secondary_slug      text := 'selbstfrei';
  primary_ws          uuid;
  secondary_ws        uuid;
  primary_proj        uuid;
  secondary_proj      uuid;
  probe_task_mine     uuid;
  probe_task_others   uuid;
  original_primary    role;
  original_secondary  role;
  was_in_secondary    boolean := false;
  cur                 role;
  jwt                 text;
  outcome             text;
  visible_count       integer;
begin
  -- Resolve workspaces
  select id into primary_ws from workspaces where slug = primary_slug;
  select id into secondary_ws from workspaces where slug = secondary_slug;
  if primary_ws is null then raise exception 'workspace % not found', primary_slug; end if;
  if secondary_ws is null then raise exception 'workspace % not found', secondary_slug; end if;

  -- Save current membership state
  select role into original_primary
    from workspace_members where user_id = me and workspace_id = primary_ws;
  if original_primary is null then
    raise exception 'user % is not a member of %; run seed-membership.sql first', me, primary_slug;
  end if;

  select role into original_secondary
    from workspace_members where user_id = me and workspace_id = secondary_ws;
  was_in_secondary := original_secondary is not null;

  select id into primary_proj from projects where workspace_id = primary_ws limit 1;
  select id into secondary_proj from projects where workspace_id = secondary_ws limit 1;

  raise notice '═══════════════════════════════════════════════';
  raise notice ' user           : %', me;
  raise notice ' primary ws     : % (% / role=%)', primary_slug, primary_ws, original_primary;
  raise notice ' secondary ws   : % (% / member=%)', secondary_slug, secondary_ws, was_in_secondary;
  raise notice ' primary proj   : %', primary_proj;
  raise notice '═══════════════════════════════════════════════';

  ----------------------------------------------------------------
  -- Part 1: For each role, probe representative operations
  ----------------------------------------------------------------
  for cur in select unnest(enum_range(null::role)) loop
    update workspace_members set role = cur
      where user_id = me and workspace_id = primary_ws;
    jwt := json_build_object('sub', me::text, 'role', 'authenticated', 'aud', 'authenticated')::text;
    raise notice '';
    raise notice '─── role: % ───', cur;

    -- 1.1 select workspace
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jwt, true);
    begin
      perform 1 from workspaces where id = primary_ws;
      outcome := case when found then 'allowed' else 'denied (no row)' end;
    exception when others then outcome := 'denied (' || sqlstate || ')'; end;
    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', '', true);
    raise notice '  select workspace             : %', outcome;

    -- 1.2 update workspace (admin+ only)
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jwt, true);
    begin
      update workspaces set tagline = tagline where id = primary_ws;
      outcome := case when found then 'allowed' else 'denied (RLS hid row)' end;
    exception when others then outcome := 'denied (' || sqlstate || ')'; end;
    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', '', true);
    raise notice '  update workspace settings    : %', outcome;

    -- 1.3 create project (manager+)
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jwt, true);
    begin
      insert into projects (workspace_id, name, status, priority)
        values (primary_ws, '__probe_proj', 'Planning', 'Medium');
      outcome := 'allowed';
    exception when others then outcome := 'denied (' || sqlstate || ')'; end;
    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', '', true);
    delete from projects where workspace_id = primary_ws and name = '__probe_proj';
    raise notice '  create project               : %', outcome;

    -- 1.4 create task (member+)
    if primary_proj is not null then
      perform set_config('role', 'authenticated', true);
      perform set_config('request.jwt.claims', jwt, true);
      begin
        insert into tasks (workspace_id, project_id, title)
          values (primary_ws, primary_proj, '__probe_task');
        outcome := 'allowed';
      exception when others then outcome := 'denied (' || sqlstate || ')'; end;
      perform set_config('role', 'postgres', true);
      perform set_config('request.jwt.claims', '', true);
      delete from tasks where workspace_id = primary_ws and title = '__probe_task';
      raise notice '  create task                  : %', outcome;
    end if;

    -- 1.5 add workspace member (admin+)
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jwt, true);
    begin
      -- self-insert: harmless duplicate, but the policy gate fires first
      insert into workspace_members (workspace_id, user_id, role)
        values (primary_ws, me, cur);
      outcome := 'allowed (duplicate ignored)';
    exception when unique_violation then
      outcome := 'allowed (would insert if new)';
    when others then
      outcome := 'denied (' || sqlstate || ')';
    end;
    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', '', true);
    raise notice '  add workspace member         : %', outcome;
  end loop;

  ----------------------------------------------------------------
  -- Part 2: Workspace isolation (items 6 + 7)
  ----------------------------------------------------------------
  raise notice '';
  raise notice '═══════════════════════════════════════════════';
  raise notice ' Part 2: cross-workspace isolation';
  raise notice '═══════════════════════════════════════════════';

  -- Bump primary to owner so denial isn't masked by under-privilege
  update workspace_members set role = 'owner' where user_id = me and workspace_id = primary_ws;

  -- Remove from secondary (will re-add)
  if was_in_secondary then
    delete from workspace_members where user_id = me and workspace_id = secondary_ws;
  end if;

  jwt := json_build_object('sub', me::text, 'role', 'authenticated', 'aud', 'authenticated')::text;

  -- 2.1 read tasks from a workspace I'm not a member of
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jwt, true);
  select count(*) into visible_count from tasks where workspace_id = secondary_ws;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  if visible_count = 0 then
    outcome := '0 rows visible (correct)';
  else
    outcome := visible_count || ' rows visible (LEAK!)';
  end if;
  raise notice '  read foreign workspace tasks : %', outcome;

  -- 2.2 read workspaces I'm not a member of (should not include secondary)
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jwt, true);
  select count(*) into visible_count from workspaces where id = secondary_ws;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  if visible_count = 0 then
    outcome := 'hidden (correct)';
  else
    outcome := 'visible (LEAK!)';
  end if;
  raise notice '  read foreign workspace row   : %', outcome;

  -- 2.3 try to insert task into foreign workspace
  if secondary_proj is not null then
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jwt, true);
    begin
      insert into tasks (workspace_id, project_id, title)
        values (secondary_ws, secondary_proj, '__probe_cross');
      outcome := 'allowed (LEAK!)';
    exception when others then outcome := 'denied (' || sqlstate || ')'; end;
    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', '', true);
    delete from tasks where workspace_id = secondary_ws and title = '__probe_cross';
    raise notice '  insert into foreign ws       : %', outcome;
  end if;

  -- Re-add membership in secondary
  if was_in_secondary then
    insert into workspace_members (workspace_id, user_id, role)
      values (secondary_ws, me, original_secondary)
      on conflict (workspace_id, user_id) do update set role = excluded.role;
  end if;

  ----------------------------------------------------------------
  -- Part 3: Assignee-only scope for members (item 8)
  ----------------------------------------------------------------
  raise notice '';
  raise notice '═══════════════════════════════════════════════';
  raise notice ' Part 3: assignee-only scope (member role)';
  raise notice '═══════════════════════════════════════════════';

  if primary_proj is not null then
    insert into tasks (workspace_id, project_id, title, assignee_id)
      values (primary_ws, primary_proj, '__probe_mine', me)
      returning id into probe_task_mine;
    insert into tasks (workspace_id, project_id, title, assignee_id)
      values (primary_ws, primary_proj, '__probe_others', null)
      returning id into probe_task_others;

    update workspace_members set role = 'member' where user_id = me and workspace_id = primary_ws;
    jwt := json_build_object('sub', me::text, 'role', 'authenticated', 'aud', 'authenticated')::text;

    -- 3.1 member updates own assigned task
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jwt, true);
    begin
      update tasks set title = '__probe_mine_v2' where id = probe_task_mine;
      outcome := case when found then 'allowed (correct)' else 'denied (no row)' end;
    exception when others then outcome := 'denied (' || sqlstate || ')'; end;
    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', '', true);
    raise notice '  member updates OWN task      : %', outcome;

    -- 3.2 member tries to update someone else's task
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jwt, true);
    begin
      update tasks set title = '__probe_others_v2' where id = probe_task_others;
      if found then
        outcome := 'allowed (LEAK!)';
      else
        outcome := 'denied (RLS blocked update — correct)';
      end if;
    exception when others then outcome := 'denied (' || sqlstate || ')'; end;
    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', '', true);
    raise notice '  member updates OTHER task    : %', outcome;

    delete from tasks where id in (probe_task_mine, probe_task_others);
  end if;

  ----------------------------------------------------------------
  -- Part 4: Viewer-as-assignee write (item 9; flags 0003 status)
  ----------------------------------------------------------------
  raise notice '';
  raise notice '═══════════════════════════════════════════════';
  raise notice ' Part 4: viewer-as-assignee write (RLS hole)';
  raise notice '═══════════════════════════════════════════════';

  if primary_proj is not null then
    update workspace_members set role = 'viewer' where user_id = me and workspace_id = primary_ws;

    insert into tasks (workspace_id, project_id, title, assignee_id)
      values (primary_ws, primary_proj, '__probe_viewer_assigned', me)
      returning id into probe_task_mine;

    jwt := json_build_object('sub', me::text, 'role', 'authenticated', 'aud', 'authenticated')::text;

    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jwt, true);
    begin
      update tasks set title = '__probe_viewer_v2' where id = probe_task_mine;
      if found then
        outcome := 'allowed (HOLE — apply migration 0003)';
      else
        outcome := 'denied (correct — 0003 is applied)';
      end if;
    exception when others then outcome := 'denied (' || sqlstate || ')'; end;
    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', '', true);
    delete from tasks where id = probe_task_mine;
    raise notice '  viewer updates ASSIGNED task : %', outcome;
  end if;

  ----------------------------------------------------------------
  -- Restore + summary
  ----------------------------------------------------------------
  update workspace_members set role = original_primary
    where user_id = me and workspace_id = primary_ws;

  raise notice '';
  raise notice '═══════════════════════════════════════════════';
  raise notice ' restored: primary=%, secondary=%', original_primary, original_secondary;
  raise notice '═══════════════════════════════════════════════';

exception when others then
  -- Best-effort restore on error
  begin
    update workspace_members set role = original_primary
      where user_id = me and workspace_id = primary_ws;
    if was_in_secondary then
      insert into workspace_members (workspace_id, user_id, role)
        values (secondary_ws, me, original_secondary)
        on conflict (workspace_id, user_id) do update set role = excluded.role;
    end if;
  exception when others then null;
  end;
  raise;
end$$;

-- ── Expected output (with migration 0003 applied) ──────────────────────
-- ─── role: viewer ───
--   select workspace             : allowed
--   update workspace settings    : denied (RLS hid row)
--   create project               : denied (42501)
--   create task                  : denied (42501)
--   add workspace member         : denied (42501)
-- ─── role: member ───
--   select workspace             : allowed
--   update workspace settings    : denied (RLS hid row)
--   create project               : denied (42501)
--   create task                  : allowed
--   add workspace member         : denied (42501)
-- ─── role: manager ───
--   select workspace             : allowed
--   update workspace settings    : denied (RLS hid row)
--   create project               : allowed
--   create task                  : allowed
--   add workspace member         : denied (42501)
-- ─── role: admin ───
--   select workspace             : allowed
--   update workspace settings    : allowed
--   create project               : allowed
--   create task                  : allowed
--   add workspace member         : allowed (duplicate ignored)
-- ─── role: owner ───
--   (same as admin)
--
-- Part 2 (workspace isolation):
--   read foreign workspace tasks : 0 rows visible (correct)
--   read foreign workspace row   : hidden (correct)
--   insert into foreign ws       : denied (42501)
--
-- Part 3 (assignee-only):
--   member updates OWN task      : allowed (correct)
--   member updates OTHER task    : denied (RLS blocked update — correct)
--
-- Part 4 (viewer-as-assignee):
--   viewer updates ASSIGNED task : denied (correct — 0003 is applied)
--                                  ↑ before 0003 this would say "HOLE"
