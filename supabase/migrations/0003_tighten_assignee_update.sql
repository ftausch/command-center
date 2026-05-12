-- Tighten tasks_assignee_update to exclude viewers.
--
-- 0002 created an `tasks_assignee_update` policy that allowed any
-- workspace member who was the task's assignee to update the row.
-- That meant a 'viewer' (read-only role) who happened to be set as a
-- task's assignee could still write — defeating the point of the role.
--
-- Phase 6 verification flagged this. This migration replaces the policy
-- with one that ALSO requires the user to have at least 'member' role.
-- Managers/admins/owners still pass via `tasks_manager_update`.

drop policy if exists tasks_assignee_update on tasks;

create policy tasks_assignee_update on tasks
  for update using (
    is_workspace_member(workspace_id)
    and assignee_id = auth.uid()
    and has_workspace_role(workspace_id, 'owner', 'admin', 'manager', 'member')
  ) with check (
    is_workspace_member(workspace_id)
    and assignee_id = auth.uid()
    and has_workspace_role(workspace_id, 'owner', 'admin', 'manager', 'member')
  );
