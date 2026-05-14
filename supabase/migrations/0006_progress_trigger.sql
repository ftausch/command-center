-- Auto-update projects.progress when tasks are inserted, updated, or deleted.
--
-- The UI already computes progress client-side from live task data, so this
-- trigger is belt-and-suspenders: it keeps the stored value accurate for
-- external integrations, REST API consumers, and the Supabase Realtime
-- UPDATE event on projects (which propagates the new value to all tabs).
--
-- Safe to run multiple times — uses CREATE OR REPLACE + DROP IF EXISTS.

create or replace function public.update_project_progress()
returns trigger language plpgsql as $$
declare
  proj_id   uuid;
  total_ct  integer;
  done_ct   integer;
begin
  proj_id := coalesce(new.project_id, old.project_id);
  if proj_id is null then return coalesce(new, old); end if;

  select
    count(*)                              into total_ct
  from tasks where project_id = proj_id;

  select
    count(*) filter (where status = 'Done') into done_ct
  from tasks where project_id = proj_id;

  update projects
     set progress = case when total_ct = 0 then 0
                         else round(done_ct * 100.0 / total_ct)
                    end
   where id = proj_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists task_progress_sync on tasks;

create trigger task_progress_sync
after insert or update of status or delete on tasks
for each row execute function public.update_project_progress();
