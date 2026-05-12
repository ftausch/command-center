-- Make yourself an OWNER of both workspaces. Run AFTER signing up via
-- /login, AFTER 0001 + 0002 + seed.sql have been applied.
--
-- Replace <YOUR_AUTH_UID> below with your auth user id. Find it via:
--   Supabase Dashboard → Authentication → Users
-- or by running in the SQL editor:
--   select id, email from auth.users;
--
-- Re-running this script is safe; on conflict it just refreshes your role.

insert into workspace_members (workspace_id, user_id, role)
select id, '<YOUR_AUTH_UID>'::uuid, 'owner'
from workspaces
where slug in ('unicornbakery', 'selbstfrei')
on conflict (workspace_id, user_id) do update set role = excluded.role;
