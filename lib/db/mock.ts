// Mock adapter — returns the same view shapes the screens have always
// consumed, just filtered by workspace and wrapped in async. The point of
// this file is the *seam*: screens import from lib/db, and lib/db decides
// (at module load) whether to route to here or to lib/db/supabase.

import { D } from '@/lib/data';
import type {
  ActivityView,
  BrandView,
  CalendarEventView,
  ProjectView,
  SlackNotificationView,
  TaskView,
  TemplateView,
  UserView,
  WorkspaceStats,
} from '@/lib/types';

// lib/data.js exports loosely-typed JS objects; cast through `unknown` here
// rather than narrow the source file. The mock shape is verified by the
// screens that consume it — adding `as const` to every literal in data.js
// would be more noise than the type guarantee is worth at this stage.

type AnyD = any;
const Dx = D as AnyD;

export async function listWorkspaces(): Promise<BrandView[]> {
  return Object.values(Dx.brands) as BrandView[];
}

export async function getCurrentUser(): Promise<UserView | null> {
  return (Dx.users[0] as UserView) ?? null;
}

export async function getWorkspace(id: string): Promise<BrandView | null> {
  return (Dx.brands[id] as BrandView) ?? null;
}

export async function listMembers(workspaceId: string): Promise<UserView[]> {
  return Dx.users.filter((u: UserView) =>
    u.workspaces.includes(workspaceId),
  ) as UserView[];
}

export async function listProjects(workspaceId: string): Promise<ProjectView[]> {
  return Dx.projects.filter(
    (p: ProjectView) => p.workspace === workspaceId,
  ) as ProjectView[];
}

export async function getProject(
  workspaceId: string,
  projectId: string,
): Promise<ProjectView | null> {
  const p = Dx.projects.find(
    (pr: ProjectView) => pr.workspace === workspaceId && pr.id === projectId,
  );
  return (p as ProjectView | undefined) ?? null;
}

export async function listTasks(
  workspaceId: string,
  projectId?: string,
): Promise<TaskView[]> {
  return Dx.tasks
    .filter((t: TaskView) => t.workspace === workspaceId)
    .filter((t: TaskView) => !projectId || t.projectId === projectId) as TaskView[];
}

export async function listActivity(
  workspaceId: string,
  limit = 50,
): Promise<ActivityView[]> {
  return Dx.activity
    .filter((a: ActivityView) => a.workspace === workspaceId)
    .slice(0, limit) as ActivityView[];
}

export async function listCalendarEvents(
  workspaceId: string,
): Promise<CalendarEventView[]> {
  return (Dx.calendarEvents[workspaceId] ?? []) as CalendarEventView[];
}

export async function listSlackNotifications(
  workspaceId: string,
): Promise<SlackNotificationView[]> {
  return Dx.slackNotifications.filter(
    (n: SlackNotificationView) => n.workspace === workspaceId,
  ) as SlackNotificationView[];
}

export async function listTemplates(
  workspaceId: string,
): Promise<Record<string, TemplateView>> {
  void workspaceId;
  return Dx.templates as Record<string, TemplateView>;
}

export async function getWorkspacePhases(workspaceId: string): Promise<string[]> {
  return (Dx.phases[workspaceId] ?? []) as string[];
}

export async function getWorkspaceStats(
  workspaceId: string,
): Promise<WorkspaceStats> {
  const projects = Dx.projects.filter(
    (p: ProjectView) => p.workspace === workspaceId,
  ).length;
  const tasks = Dx.tasks.filter(
    (t: TaskView) => t.workspace === workspaceId && t.status !== 'Done',
  ).length;
  const team = Dx.users.filter((u: UserView) =>
    u.workspaces.includes(workspaceId),
  ).length;
  return { projects, tasks, team };
}
