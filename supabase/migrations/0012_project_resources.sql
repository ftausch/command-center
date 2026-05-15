-- project_resources: external resources linked to projects.
-- Stores Slack channels, Google Drive folders, and other external assets
-- that were created as part of workspace setup for a project.
-- Applied 2026-05-15.

create table project_resources (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id   uuid references projects(id) on delete cascade,
  type         text not null check (type in ('slack_channel','drive_folder','drive_subfolder')),
  provider     text not null check (provider in ('slack','google_drive')),
  external_id  text,
  name         text not null,
  url          text,
  metadata     jsonb not null default '{}',
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index project_resources_workspace_idx on project_resources(workspace_id);
create index project_resources_project_idx   on project_resources(project_id);

alter table project_resources enable row level security;

create policy project_resources_select on project_resources
  for select using (is_workspace_member(workspace_id));

create policy project_resources_manager_write on project_resources
  for all
  using  (has_workspace_role(workspace_id, 'owner', 'admin', 'manager'))
  with check (has_workspace_role(workspace_id, 'owner', 'admin', 'manager'));
