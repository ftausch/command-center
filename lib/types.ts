// Shared domain types — the Supabase schema is the source of truth; these are
// the shapes the app code passes around. Snake_case fields match DB columns;
// adapters in lib/db convert between mock data and these shapes.

export type Role = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

export type TaskStatus = 'Backlog' | 'To Do' | 'In Progress' | 'Review' | 'Blocked' | 'Done';
export type TaskPriority = 'High' | 'Medium' | 'Low';
export type ProjectStatus = 'Planning' | 'In Progress' | 'Review' | 'Blocked' | 'Done';

export type ActivityKind =
  | 'task_created'
  | 'task_assigned'
  | 'task_status_changed'
  | 'task_completed'
  | 'task_blocked'
  | 'project_created'
  | 'comment_added'
  | 'checklist_item_done';

export interface Profile {
  id: string; // matches auth.users.id
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  color: string | null;
  tagline: string | null;
  created_at: string;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: Role;
  created_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  type: string | null;
  status: ProjectStatus;
  priority: TaskPriority;
  progress: number; // 0-100
  phase_idx: number;
  due_date: string | null; // ISO date
  owner_id: string | null;
  slack_channel: string | null;
  slack_connected: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  due_date: string | null;
  blocker: string | null;
  waiting_on_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  workspace_id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface TaskChecklistItem {
  id: string;
  workspace_id: string;
  task_id: string;
  label: string;
  done: boolean;
  position: number;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  kind: ActivityKind;
  target_type: string;
  target_id: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface SlackIntegration {
  id: string;
  workspace_id: string;
  team_id: string | null;
  team_name: string | null;
  // access_token is never returned to the client; column exists but server-only.
  bot_user_id: string | null;
  installed_by: string | null;
  installed_at: string;
  is_active: boolean;
}

export interface SlackNotification {
  id: string;
  workspace_id: string;
  channel: string;
  user_name: string | null;
  message: string;
  posted_at: string;
}

// ─── View types ─────────────────────────────────────────────────────────────
// Shapes the screens consume. These match the legacy mock-data field names so
// the UI doesn't have to translate. The data-layer (lib/db) returns these.
// The mock adapter passes mock objects through as-is; the Supabase adapter
// transforms DB rows (snake_case, above) into these before returning to UI.
// This keeps the wire/storage format independent from the UI shape and lets
// future schema changes happen without churning every screen.

export interface BrandView {
  id: string;
  name: string;
  sub: string;
  initials: string;
  color: string;
  tagline: string;
}

export interface UserView {
  id: string;
  name: string;
  initials: string;
  role: string;
  workspaces: string[];
  online: boolean;
}

export interface ProjectView {
  id: string;
  workspace: string;
  name: string;
  type: string;
  desc: string;
  status: ProjectStatus;
  priority: TaskPriority;
  progress: number;
  phaseIdx: number;
  due: string;
  owner: string;
  team: string[];
  slackChannel: string;
  slackConnected: boolean;
  links?: { label: string; url: string }[];
  blockedReason?: string;
}

export interface TaskView {
  id: string;
  workspace: string;
  projectId: string;
  title: string;
  assignee: string;
  status: TaskStatus;
  priority: TaskPriority;
  due: string;
  tags?: string[];
  waitingOn?: string;
  blocker?: string;
}

export interface ActivityView {
  id: string;
  workspace: string;
  user: string;
  verb: string;
  target: string;
  meta: string;
  time: string;
  icon: string;
}

export interface TemplateView {
  name: string;
  desc: string;
  avgDuration: string;
  tasks: { phase: string; title: string; owner: string; daysFromStart: number }[];
}

export interface CalendarEventView {
  date: string;
  type: string;
  title: string;
  projectId: string;
}

export interface SlackNotificationView {
  workspace: string;
  channel: string;
  user: string;
  text: string;
  time: string;
}

export interface WorkspaceStats {
  projects: number;
  tasks: number; // open tasks
  team: number;
}

export interface TaskCommentView {
  id: string;
  taskId: string;
  author: string; // user id
  time: string;   // ISO 8601
  text: string;
}

export interface TaskChecklistItemView {
  id: string;
  taskId: string;
  label: string;
  done: boolean;
  position: number;
}

// Standardised return shape for every server action. Lets callers update
// optimistic state with `data` (and merge `activity` into the activity log)
// or surface `error` in the UI.
export type ActionResult<T> = {
  ok: boolean;
  data?: T;
  activity?: ActivityView;
  error?: string;
};
