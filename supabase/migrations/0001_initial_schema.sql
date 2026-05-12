-- Command Center — initial schema
-- Tables, enums, indexes, triggers. RLS policies are in 0002_rls_policies.sql.

-- ─── enums ────────────────────────────────────────────────────────────────
create type role as enum ('owner', 'admin', 'manager', 'member', 'viewer');
create type task_status as enum ('Backlog', 'To Do', 'In Progress', 'Review', 'Blocked', 'Done');
create type task_priority as enum ('High', 'Medium', 'Low');
create type project_status as enum ('Planning', 'In Progress', 'Review', 'Blocked', 'Done');
create type activity_kind as enum (
  'task_created',
  'task_assigned',
  'task_status_changed',
  'task_completed',
  'task_blocked',
  'project_created',
  'comment_added',
  'checklist_item_done'
);

-- ─── profiles ─────────────────────────────────────────────────────────────
-- 1:1 with auth.users; populated by trigger below.
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── workspaces ───────────────────────────────────────────────────────────
create table workspaces (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  color       text,
  tagline     text,
  created_at  timestamptz not null default now()
);

-- ─── workspace_members ────────────────────────────────────────────────────
create table workspace_members (
  workspace_id uuid not null references workspaces (id) on delete cascade,
  user_id      uuid not null references profiles (id) on delete cascade,
  role         role not null default 'member',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on workspace_members (user_id);

-- ─── projects ─────────────────────────────────────────────────────────────
create table projects (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces (id) on delete cascade,
  name            text not null,
  description     text,
  type            text,
  status          project_status not null default 'Planning',
  priority        task_priority not null default 'Medium',
  progress        integer not null default 0 check (progress between 0 and 100),
  phase_idx       integer not null default 0,
  due_date        date,
  owner_id        uuid references profiles (id) on delete set null,
  slack_channel   text,
  slack_connected boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index projects_workspace_idx on projects (workspace_id);
create index projects_owner_idx on projects (owner_id);

-- ─── tasks ────────────────────────────────────────────────────────────────
create table tasks (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces (id) on delete cascade,
  project_id      uuid not null references projects (id) on delete cascade,
  title           text not null,
  description     text,
  status          task_status not null default 'Backlog',
  priority        task_priority not null default 'Medium',
  assignee_id     uuid references profiles (id) on delete set null,
  due_date        date,
  blocker         text,
  waiting_on_id   uuid references profiles (id) on delete set null,
  tags            text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index tasks_workspace_idx on tasks (workspace_id);
create index tasks_project_idx on tasks (project_id);
create index tasks_assignee_idx on tasks (assignee_id);

-- Ensure a task's workspace_id always matches its project's workspace_id.
-- Cross-workspace data leakage is otherwise possible at the row level.
create or replace function tasks_check_workspace_match()
returns trigger language plpgsql as $$
declare
  proj_ws uuid;
begin
  select workspace_id into proj_ws from projects where id = new.project_id;
  if proj_ws is null then
    raise exception 'project % not found', new.project_id;
  end if;
  if new.workspace_id is null then
    new.workspace_id = proj_ws;
  elsif new.workspace_id <> proj_ws then
    raise exception 'task workspace_id (%) must match project workspace_id (%)', new.workspace_id, proj_ws;
  end if;
  return new;
end;
$$;
create trigger tasks_workspace_match
  before insert or update on tasks
  for each row execute function tasks_check_workspace_match();

-- ─── task_comments ────────────────────────────────────────────────────────
create table task_comments (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  task_id      uuid not null references tasks (id) on delete cascade,
  author_id    uuid not null references profiles (id) on delete cascade,
  body         text not null,
  created_at   timestamptz not null default now()
);
create index task_comments_task_idx on task_comments (task_id);

-- ─── task_checklist_items ─────────────────────────────────────────────────
create table task_checklist_items (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  task_id      uuid not null references tasks (id) on delete cascade,
  label        text not null,
  done         boolean not null default false,
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);
create index task_checklist_items_task_idx on task_checklist_items (task_id, position);

-- ─── activity_logs ────────────────────────────────────────────────────────
create table activity_logs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  actor_id     uuid references profiles (id) on delete set null,
  kind         activity_kind not null,
  target_type  text not null,
  target_id    uuid not null,
  meta         jsonb,
  created_at   timestamptz not null default now()
);
create index activity_logs_workspace_idx on activity_logs (workspace_id, created_at desc);

-- ─── slack_integrations ───────────────────────────────────────────────────
create table slack_integrations (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces (id) on delete cascade,
  team_id        text,
  team_name      text,
  access_token   text,  -- NEVER expose via select policies; admin/service-role only
  bot_user_id    text,
  installed_by   uuid references profiles (id) on delete set null,
  installed_at   timestamptz not null default now(),
  is_active      boolean not null default false,
  unique (workspace_id)
);

-- ─── slack_notifications ──────────────────────────────────────────────────
create table slack_notifications (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  channel      text not null,
  user_name    text,
  message      text not null,
  posted_at    timestamptz not null default now()
);
create index slack_notifications_workspace_idx on slack_notifications (workspace_id, posted_at desc);

-- ─── updated_at triggers ──────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_profiles before update on profiles
  for each row execute function set_updated_at();
create trigger set_updated_at_projects before update on projects
  for each row execute function set_updated_at();
create trigger set_updated_at_tasks before update on tasks
  for each row execute function set_updated_at();

-- ─── profile creation on signup ───────────────────────────────────────────
-- Trigger on auth.users insert. SECURITY DEFINER lets it write to the
-- public.profiles table even though the new user has no rows yet.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
