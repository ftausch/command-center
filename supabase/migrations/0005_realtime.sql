-- Enable Supabase Realtime for core tables.
--
-- Adds tasks, projects, and activity_logs to the supabase_realtime publication
-- so the WorkspaceProvider can subscribe to live row changes and keep the
-- in-memory cache in sync across tabs and users without a full page reload.
--
-- Each ALTER is wrapped in a DO block so re-running the migration is safe
-- (a table already in the publication would otherwise throw an error).

do $$ begin
  alter publication supabase_realtime add table public.tasks;
exception when others then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.projects;
exception when others then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.activity_logs;
exception when others then null;
end $$;
