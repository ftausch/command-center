-- Command Center — Row Level Security policies
-- Goals (in order of importance):
--   1. Hard workspace separation: a user can never see rows in a workspace
--      they're not a member of, even by guessing IDs.
--   2. Role-gated writes: viewers read only; members create+edit their own
--      stuff; managers/admins/owners manage everything in the workspace.
--   3. profiles visibility: every authed user can read their own row, plus
--      rows of anyone sharing a workspace with them (needed for assignee
--      avatars, comment authors, etc.).
--   4. Slack secrets: access_token on slack_integrations is never returned
--      to the client — only the service-role admin client reads it.

-- ─── enable RLS on every workspace-scoped table ───────────────────────────
alter table profiles               enable row level security;
alter table workspaces             enable row level security;
alter table workspace_members      enable row level security;
alter table projects               enable row level security;
alter table tasks                  enable row level security;
alter table task_comments          enable row level security;
alter table task_checklist_items   enable row level security;
alter table activity_logs          enable row level security;
alter table slack_integrations     enable row level security;
alter table slack_notifications    enable row level security;

-- ─── helpers ──────────────────────────────────────────────────────────────
-- SECURITY DEFINER so the function can see workspace_members without being
-- subject to the RLS we're about to put on workspace_members itself.
create or replace function is_workspace_member(ws uuid)
returns boolean
language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function has_workspace_role(ws uuid, variadic roles role[])
returns boolean
language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws
      and user_id = auth.uid()
      and role = any (roles)
  );
$$;

-- ─── profiles ─────────────────────────────────────────────────────────────
create policy profiles_self_select on profiles
  for select using (id = auth.uid());
create policy profiles_self_update on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Read other users in shared workspaces (avatars, assignee names, etc.).
create policy profiles_shared_workspace_select on profiles
  for select using (
    exists (
      select 1
      from workspace_members me
      join workspace_members other on other.workspace_id = me.workspace_id
      where me.user_id = auth.uid()
        and other.user_id = profiles.id
    )
  );

-- ─── workspaces ───────────────────────────────────────────────────────────
create policy workspaces_member_select on workspaces
  for select using (is_workspace_member(id));

-- Only owners/admins can rename, recolor, etc.
create policy workspaces_admin_update on workspaces
  for update using (has_workspace_role(id, 'owner', 'admin'))
  with check (has_workspace_role(id, 'owner', 'admin'));

-- ─── workspace_members ────────────────────────────────────────────────────
create policy workspace_members_select on workspace_members
  for select using (is_workspace_member(workspace_id));

-- Only owners/admins can add, remove, or change a member's role.
create policy workspace_members_admin_write on workspace_members
  for all using (has_workspace_role(workspace_id, 'owner', 'admin'))
  with check (has_workspace_role(workspace_id, 'owner', 'admin'));

-- ─── projects ─────────────────────────────────────────────────────────────
create policy projects_select on projects
  for select using (is_workspace_member(workspace_id));

-- Managers / admins / owners can create, update, delete.
create policy projects_manager_write on projects
  for all using (has_workspace_role(workspace_id, 'owner', 'admin', 'manager'))
  with check (has_workspace_role(workspace_id, 'owner', 'admin', 'manager'));

-- ─── tasks ────────────────────────────────────────────────────────────────
create policy tasks_select on tasks
  for select using (is_workspace_member(workspace_id));

-- Members can create tasks (and are validated as workspace members at insert).
create policy tasks_member_insert on tasks
  for insert with check (
    has_workspace_role(workspace_id, 'owner', 'admin', 'manager', 'member')
  );

-- Assignees can update only the task they're assigned to.
create policy tasks_assignee_update on tasks
  for update using (
    is_workspace_member(workspace_id) and assignee_id = auth.uid()
  ) with check (
    is_workspace_member(workspace_id) and assignee_id = auth.uid()
  );

-- Managers+ can update or delete any task in the workspace.
create policy tasks_manager_update on tasks
  for update using (has_workspace_role(workspace_id, 'owner', 'admin', 'manager'))
  with check (has_workspace_role(workspace_id, 'owner', 'admin', 'manager'));
create policy tasks_manager_delete on tasks
  for delete using (has_workspace_role(workspace_id, 'owner', 'admin', 'manager'));

-- Viewers fall through to default-deny on insert/update/delete; they can only
-- select via tasks_select.

-- ─── task_comments ────────────────────────────────────────────────────────
create policy task_comments_select on task_comments
  for select using (is_workspace_member(workspace_id));

-- Anyone in the workspace except viewers can comment.
create policy task_comments_member_insert on task_comments
  for insert with check (
    has_workspace_role(workspace_id, 'owner', 'admin', 'manager', 'member')
    and author_id = auth.uid()
  );

-- Authors can edit/delete their own comments; managers+ can moderate any.
create policy task_comments_author_update on task_comments
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy task_comments_author_delete on task_comments
  for delete using (
    author_id = auth.uid()
    or has_workspace_role(workspace_id, 'owner', 'admin', 'manager')
  );

-- ─── task_checklist_items ─────────────────────────────────────────────────
create policy task_checklist_items_select on task_checklist_items
  for select using (is_workspace_member(workspace_id));
create policy task_checklist_items_member_write on task_checklist_items
  for all using (
    has_workspace_role(workspace_id, 'owner', 'admin', 'manager', 'member')
  ) with check (
    has_workspace_role(workspace_id, 'owner', 'admin', 'manager', 'member')
  );

-- ─── activity_logs ────────────────────────────────────────────────────────
-- Read: any member. Insert: any member writing as themselves. Update/delete
-- intentionally disabled — activity is append-only history.
create policy activity_logs_select on activity_logs
  for select using (is_workspace_member(workspace_id));
create policy activity_logs_insert on activity_logs
  for insert with check (
    is_workspace_member(workspace_id) and actor_id = auth.uid()
  );

-- ─── slack_integrations ───────────────────────────────────────────────────
-- Members can see whether a workspace has Slack connected and the team name,
-- but a column-level revoke below hides the access_token from non-admins.
create policy slack_integrations_select on slack_integrations
  for select using (is_workspace_member(workspace_id));
create policy slack_integrations_admin_write on slack_integrations
  for all using (has_workspace_role(workspace_id, 'owner', 'admin'))
  with check (has_workspace_role(workspace_id, 'owner', 'admin'));

-- Hide the OAuth token from authenticated/anon roles. Server code uses the
-- service-role admin client (which bypasses RLS) when it needs to post.
revoke select (access_token) on slack_integrations from authenticated, anon;

-- ─── slack_notifications ──────────────────────────────────────────────────
create policy slack_notifications_select on slack_notifications
  for select using (is_workspace_member(workspace_id));
create policy slack_notifications_insert on slack_notifications
  for insert with check (
    has_workspace_role(workspace_id, 'owner', 'admin', 'manager')
  );
