// Mock adapter — shapes the existing `D` object into the typed domain
// returned by lib/db. All functions are async to match the Supabase adapter
// signatures; the UI can swap one for the other without changing call sites.
//
// Caveat: the mock data file doesn't carry workspace_id, created_at,
// updated_at, etc. We synthesize placeholders that are stable per ID so
// referential integrity holds (same task always reports the same created_at,
// etc.) without making the mock data file grow.

import { D } from '@/lib/data';
import type {
  ActivityLog,
  ActivityKind,
  Profile,
  Project,
  ProjectStatus,
  Task,
  TaskChecklistItem,
  TaskComment,
  TaskPriority,
  TaskStatus,
  Workspace,
} from '@/lib/types';

// Stable synthetic timestamp — keyed by ID so repeated reads agree.
function fakeIso(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const offsetDays = Math.abs(h) % 60; // last ~60 days
  const d = new Date('2026-05-11T10:00:00Z');
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString();
}

function brandToWorkspace(b: { id: string; name: string; color?: string; tagline?: string }): Workspace {
  return {
    id: b.id,
    slug: b.id,
    name: b.name,
    color: b.color ?? null,
    tagline: b.tagline ?? null,
    created_at: fakeIso(b.id),
  };
}

function userToProfile(u: {
  id: string;
  name: string;
  initials?: string;
}): Profile {
  return {
    id: u.id,
    email: `${u.id}@example.com`,
    full_name: u.name,
    avatar_url: null,
    created_at: fakeIso('u:' + u.id),
    updated_at: fakeIso('u:' + u.id),
  };
}

function mockToProject(p: any): Project {
  return {
    id: p.id,
    workspace_id: p.workspace,
    name: p.name,
    description: p.desc ?? null,
    type: p.type ?? null,
    status: p.status as ProjectStatus,
    priority: p.priority as TaskPriority,
    progress: p.progress ?? 0,
    phase_idx: p.phaseIdx ?? 0,
    due_date: p.due ?? null,
    owner_id: p.owner ?? null,
    slack_channel: p.slackChannel ?? null,
    slack_connected: !!p.slackConnected,
    created_at: fakeIso('p:' + p.id),
    updated_at: fakeIso('p:' + p.id),
  };
}

function mockToTask(t: any): Task {
  return {
    id: t.id,
    workspace_id: t.workspace,
    project_id: t.projectId,
    title: t.title,
    description: null,
    status: t.status as TaskStatus,
    priority: t.priority as TaskPriority,
    assignee_id: t.assignee ?? null,
    due_date: t.due ?? null,
    blocker: t.blocker ?? null,
    waiting_on_id: t.waitingOn ?? null,
    tags: t.tags ?? [],
    created_at: fakeIso('t:' + t.id),
    updated_at: fakeIso('t:' + t.id),
  };
}

// ─── public API ──────────────────────────────────────────────────────────
export async function listWorkspaces(): Promise<Workspace[]> {
  return Object.values(D.brands).map(brandToWorkspace as (b: any) => Workspace);
}

export async function listMembers(workspaceId: string): Promise<Profile[]> {
  return D.users
    .filter((u: any) => u.workspaces.includes(workspaceId))
    .map(userToProfile as (u: any) => Profile);
}

export async function listProjects(workspaceId: string): Promise<Project[]> {
  return D.projects
    .filter((p: any) => p.workspace === workspaceId)
    .map(mockToProject);
}

export async function getProject(
  workspaceId: string,
  projectId: string,
): Promise<Project | null> {
  const p = D.projects.find(
    (pr: any) => pr.workspace === workspaceId && pr.id === projectId,
  );
  return p ? mockToProject(p) : null;
}

export async function listTasks(
  workspaceId: string,
  projectId?: string,
): Promise<Task[]> {
  return D.tasks
    .filter((t: any) => t.workspace === workspaceId)
    .filter((t: any) => !projectId || t.projectId === projectId)
    .map(mockToTask);
}

// Comments and checklist items have no mock data — return empty arrays
// rather than throw so screens that already use them keep rendering.
export async function listTaskComments(
  _workspaceId: string,
  _taskId: string,
): Promise<TaskComment[]> {
  return [];
}

export async function listTaskChecklistItems(
  _workspaceId: string,
  _taskId: string,
): Promise<TaskChecklistItem[]> {
  return [];
}

export async function listActivity(
  workspaceId: string,
  limit = 50,
): Promise<ActivityLog[]> {
  // The mock data shape is roughly compatible but uses an `icon` field for
  // kind. Coerce to the closest ActivityKind where possible.
  const iconToKind: Record<string, ActivityKind> = {
    'arrow-right': 'task_status_changed',
    check: 'task_completed',
    block: 'task_blocked',
    plus: 'task_created',
    message: 'comment_added',
    user: 'task_assigned',
  };
  return D.activity
    .filter((a: any) => a.workspace === workspaceId)
    .slice(0, limit)
    .map(
      (a: any): ActivityLog => ({
        id: a.id,
        workspace_id: a.workspace,
        actor_id: a.user,
        kind: iconToKind[a.icon] ?? 'task_created',
        target_type: a.target?.startsWith('t-') ? 'task' : 'project',
        target_id: a.target,
        meta: a.meta ? { meta: a.meta } : null,
        created_at: a.time ? new Date(a.time).toISOString() : fakeIso(a.id),
      }),
    );
}
