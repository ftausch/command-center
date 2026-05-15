-- Project-level access control.
-- Workspace owner/admin/manager see all projects.
-- Regular members only see projects where they have a project_members row.
-- Applied 2026-05-15.

create table project_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id   uuid not null references projects(id)   on delete cascade,
  user_id      uuid not null references profiles(id)   on delete cascade,
  role         text not null check (role in ('manager', 'member', 'viewer')),
  created_at   timestamptz not null default now(),
  unique (project_id, user_id)
);

create index project_members_workspace_idx on project_members(workspace_id);
create index project_members_project_idx   on project_members(project_id);
create index project_members_user_idx      on project_members(user_id);

alter table project_members enable row level security;

create policy project_members_select on project_members
  for select using (is_workspace_member(workspace_id));

create policy project_members_admin_write on project_members
  for all
  using  (has_workspace_role(workspace_id, 'owner', 'admin', 'manager'))
  with check (has_workspace_role(workspace_id, 'owner', 'admin', 'manager'));

create or replace function is_project_member(proj uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from project_members where project_id = proj and user_id = auth.uid());
$$;

create or replace function get_project_role(proj uuid)
returns text language sql security definer stable
set search_path = public as $$
  select role from project_members where project_id = proj and user_id = auth.uid() limit 1;
$$;

create or replace function can_access_project(proj uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from projects p where p.id = proj
      and is_workspace_member(p.workspace_id)
      and (has_workspace_role(p.workspace_id, 'owner', 'admin', 'manager') or is_project_member(proj))
  );
$$;

create or replace function can_manage_project(proj uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from projects p where p.id = proj
      and is_workspace_member(p.workspace_id)
      and (has_workspace_role(p.workspace_id, 'owner', 'admin', 'manager') or get_project_role(proj) = 'manager')
  );
$$;

drop policy if exists projects_select on projects;
create policy projects_select on projects
  for select using (
    is_workspace_member(workspace_id) and (
      has_workspace_role(workspace_id, 'owner', 'admin', 'manager') or is_project_member(id)
    )
  );

drop policy if exists tasks_select on tasks;
create policy tasks_select on tasks
  for select using (
    is_workspace_member(workspace_id) and (
      has_workspace_role(workspace_id, 'owner', 'admin', 'manager')
      or is_project_member(project_id)
      or assignee_id = auth.uid()
    )
  );

drop policy if exists tasks_member_insert on tasks;
create policy tasks_member_insert on tasks
  for insert with check (
    is_workspace_member(workspace_id) and (
      has_workspace_role(workspace_id, 'owner', 'admin', 'manager') or is_project_member(project_id)
    )
  );

-- Seed: add existing workspace managers as project managers so no existing
-- project disappears for current users.
insert into project_members (workspace_id, project_id, user_id, role)
select p.workspace_id, p.id, wm.user_id, 'manager'
from   projects p
join   workspace_members wm on wm.workspace_id = p.workspace_id
where  wm.role in ('owner', 'admin', 'manager')
on conflict (project_id, user_id) do nothing;
