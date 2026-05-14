-- Link tasks to podcast episodes.
-- Nullable FK: a task can belong to an episode (e.g. "Thumbnail for Ep. 5"),
-- or it can be episode-agnostic. Cascades to null on episode delete so tasks
-- survive even if the episode is removed.

alter table tasks
  add column if not exists episode_id uuid
  references podcast_episodes(id) on delete set null;

create index if not exists tasks_episode_idx on tasks(episode_id);
