-- Podcast episodes table.
-- Stores one row per episode per workspace. Analytics, distribution status,
-- and private feed gating are all keyed from this table.

create type episode_status as enum ('draft', 'scheduled', 'published');

create table podcast_episodes (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  episode_number  integer,
  title           text not null,
  guest           text,
  publish_date    date,
  duration        text,                        -- display string e.g. "58:24"
  downloads       integer not null default 0,
  status          episode_status not null default 'draft',
  has_video       boolean not null default false,
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index podcast_episodes_workspace_idx
  on podcast_episodes(workspace_id, created_at desc);

alter table podcast_episodes enable row level security;

create policy episodes_select on podcast_episodes
  for select using (is_workspace_member(workspace_id));

create policy episodes_member_write on podcast_episodes
  for all
  using  (has_workspace_role(workspace_id, 'owner', 'admin', 'manager', 'member'))
  with check (has_workspace_role(workspace_id, 'owner', 'admin', 'manager', 'member'));

create trigger set_updated_at_podcast_episodes
  before update on podcast_episodes
  for each row execute function set_updated_at();
