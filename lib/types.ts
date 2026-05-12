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
