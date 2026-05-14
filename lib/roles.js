// Role-based permission helpers.
// Single source of truth for what each role may do. Use CAN.* in components
// to conditionally render or disable UI elements. Server actions re-enforce
// the same rules via RLS + canWriteAsRole — client checks are UX only.

const LEVELS = { viewer: 0, member: 1, manager: 2, admin: 3, owner: 4 };

function lvl(role) {
  return LEVELS[role?.toLowerCase()] ?? 0;
}

/** True when `myRole` is at least as privileged as `minRole`. */
export function isAtLeast(myRole, minRole) {
  return lvl(myRole) >= lvl(minRole);
}

/** Pre-built capability checks. Pass `myRole` from useWorkspace(). */
export const CAN = {
  createTask:        (r) => isAtLeast(r, 'member'),
  editTask:          (r) => isAtLeast(r, 'member'),
  deleteTask:        (r) => isAtLeast(r, 'manager'),
  bulkDeleteTasks:   (r) => isAtLeast(r, 'manager'),
  createProject:     (r) => isAtLeast(r, 'manager'),
  editProject:       (r) => isAtLeast(r, 'manager'),
  deleteProject:     (r) => isAtLeast(r, 'manager'),
  inviteMember:      (r) => isAtLeast(r, 'admin'),
  manageMember:      (r) => isAtLeast(r, 'admin'),
  workspaceSettings: (r) => isAtLeast(r, 'admin'),
  createEpisode:     (r) => isAtLeast(r, 'member'),
};
