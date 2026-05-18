-- Task dependencies: a task can declare that it is blocked by another task.
-- ON DELETE SET NULL: if the blocking task is deleted the dependency is cleared.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS blocked_by_task_id uuid
    REFERENCES tasks(id) ON DELETE SET NULL;

-- Index so we can quickly find everything blocked by a given task.
CREATE INDEX IF NOT EXISTS tasks_blocked_by_task_id_idx
  ON tasks (blocked_by_task_id)
  WHERE blocked_by_task_id IS NOT NULL;
