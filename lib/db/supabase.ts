// Supabase adapter — returns the same view shapes as lib/db/mock so screens
// don't need to care which backend is on. Each function reads from the
// authenticated browser client (RLS enforces workspace isolation as the
// signed-in user) then maps DB rows (snake_case) to view types (camelCase,
// legacy mock-data shape).
//
// Why the browser client and not the server client: this module is reached
// from client components (WorkspaceProvider). next/headers (used by the
// server client) can't be pulled into the client bundle. Server-side reads
// for route handlers and middleware should bypass this adapter and use
// lib/supabase/server directly.
//
// Several view-only datasets (calendar events, templates, phases) don't have
// dedicated tables yet — Phase 2 schema covered the core write surface only.
// For those, we fall back to the mock adapter so the UI still renders. When
// the relevant tables land in a later phase, we replace the fallback with
// real queries here without touching screens.

import { createClient } from '@/lib/supabase/client';
import * as fallback from './mock';
import type {
  ActivityView,
  BrandView,
  CalendarEventView,
  EpisodeView,
  ProjectMemberView,
  ProjectResource,
  ProjectView,
  SlackNotificationView,
  TaskView,
  TemplateView,
  UserView,
  WorkspaceStats,
} from '@/lib/types';

function client() {
  const c = createClient();
  if (!c) throw new Error('[db/supabase] server client not configured');
  return c;
}

function mapWorkspace(row: any): BrandView {
  return {
    id: row.slug, // UI keys by slug — same value as legacy mock workspace id
    name: row.name,
    sub: row.tagline ?? '',
    initials: row.name
      .split(/\s+/)
      .map((w: string) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
    color: row.color ?? '#1a3d5c',
    tagline: row.tagline ?? '',
  };
}

function mapProfile(row: any): UserView {
  const name: string = row.full_name ?? row.email ?? row.id;
  return {
    id: row.id,
    name,
    initials: name
      .split(/\s+/)
      .map((w: string) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
    role: row.role ?? 'Member',
    // The workspaces a user belongs to isn't returned by a profiles SELECT;
    // callers that need it should query workspace_members directly.
    workspaces: [],
    online: false,
  };
}

export function rowToTask(row: any, workspaceSlug: string): TaskView {
  return {
    id: row.id,
    workspace: workspaceSlug,
    projectId: row.project_id,
    title: row.title,
    assignee: row.assignee_id ?? '',
    status: row.status,
    priority: row.priority,
    due: row.due_date ?? '',
    description: row.description ?? undefined,
    tags: row.tags ?? [],
    waitingOn: row.waiting_on_id ?? undefined,
    blocker: row.blocker ?? undefined,
    episodeId: row.episode_id ?? undefined,
  };
}

export function rowToProject(row: any, workspaceSlug: string): ProjectView {
  return {
    id: row.id,
    workspace: workspaceSlug,
    name: row.name,
    type: row.type ?? '',
    desc: row.description ?? '',
    status: row.status,
    priority: row.priority,
    progress: row.progress ?? 0,
    phaseIdx: row.phase_idx ?? 0,
    due: row.due_date ?? '',
    owner: row.owner_id ?? '',
    team: [],
    slackChannel: row.slack_channel ?? '',
    slackConnected: !!row.slack_connected,
  };
}

const ACTIVITY_VERB: Record<string, string> = {
  task_created:       'hat Task angelegt',
  task_completed:     'hat Task abgeschlossen',
  task_blocked:       'hat Task blockiert',
  task_assigned:      'hat Task zugewiesen',
  task_status_changed:'hat Status geändert',
  comment_added:      'hat kommentiert',
  project_created:    'hat Projekt angelegt',
};

export function rowToActivity(row: any, workspaceSlug: string): ActivityView {
  return {
    id: row.id,
    workspace: workspaceSlug,
    user: row.actor_id ?? '',
    verb: ACTIVITY_VERB[row.kind as string] ?? (row.kind as string).replaceAll('_', ' '),
    target: row.target_id,
    meta: row.meta ? JSON.stringify(row.meta) : '',
    time: row.created_at,
    icon:
      row.kind === 'task_completed'     ? 'check' :
      row.kind === 'task_blocked'       ? 'block' :
      row.kind === 'task_created'       ? 'plus' :
      row.kind === 'project_created'    ? 'plus' :
      row.kind === 'task_assigned'      ? 'user' :
      row.kind === 'comment_added'      ? 'message' :
      row.kind === 'task_status_changed'? 'arrow-right' :
      'plus',
  };
}

function mapProject(row: any, workspaceSlug: string): ProjectView {
  return rowToProject(row, workspaceSlug);
}

function mapTask(row: any, workspaceSlug: string): TaskView {
  return rowToTask(row, workspaceSlug);
}

// Look up a workspace's UUID from its slug. Cached per-request would be
// nice; for now we hit the DB each time. Used by every other query.
async function workspaceIdFromSlug(slug: string): Promise<string | null> {
  const { data, error } = await client()
    .from('workspaces')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

// ─── public API ─────────────────────────────────────────────────────────
export async function getCurrentUser(): Promise<UserView | null> {
  const c = client();
  const {
    data: { user },
  } = await c.auth.getUser();
  if (!user) return null;
  const { data, error } = await c
    .from('profiles')
    .select('id, email, full_name, avatar_url, specialty')
    .eq('id', user.id)
    .maybeSingle();
  if (error || !data) return null;
  const view = mapProfile(data);
  view.specialty = (data as any).specialty ?? null;
  return view;
}

export async function listWorkspaces(): Promise<BrandView[]> {
  const { data, error } = await client()
    .from('workspaces')
    .select('id, slug, name, color, tagline')
    .order('name');
  if (error) throw error;
  return (data ?? []).map(mapWorkspace);
}

export async function getWorkspace(slug: string): Promise<BrandView | null> {
  const { data, error } = await client()
    .from('workspaces')
    .select('id, slug, name, color, tagline')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data ? mapWorkspace(data) : null;
}

export async function listMembers(workspaceSlug: string): Promise<UserView[]> {
  const wsId = await workspaceIdFromSlug(workspaceSlug);
  if (!wsId) return [];
  const { data, error } = await client()
    .from('workspace_members')
    .select('role, profiles!inner(id, email, full_name, avatar_url)')
    .eq('workspace_id', wsId);
  if (error) throw error;
  return (data ?? []).map((row: any) =>
    mapProfile({ ...row.profiles, role: row.role }),
  );
}

export async function listProjects(workspaceSlug: string): Promise<ProjectView[]> {
  const wsId = await workspaceIdFromSlug(workspaceSlug);
  if (!wsId) return [];
  const { data, error } = await client()
    .from('projects')
    .select('*')
    .eq('workspace_id', wsId)
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((p: any) => mapProject(p, workspaceSlug));
}

export async function getProject(
  workspaceSlug: string,
  projectId: string,
): Promise<ProjectView | null> {
  const wsId = await workspaceIdFromSlug(workspaceSlug);
  if (!wsId) return null;
  const { data, error } = await client()
    .from('projects')
    .select('*')
    .eq('workspace_id', wsId)
    .eq('id', projectId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProject(data, workspaceSlug) : null;
}

export async function listTasks(
  workspaceSlug: string,
  projectId?: string,
): Promise<TaskView[]> {
  const wsId = await workspaceIdFromSlug(workspaceSlug);
  if (!wsId) return [];
  let q = client().from('tasks').select('*').eq('workspace_id', wsId);
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q.order('due_date', {
    ascending: true,
    nullsFirst: false,
  });
  if (error) throw error;
  return (data ?? []).map((t: any) => mapTask(t, workspaceSlug));
}

export async function listActivity(
  workspaceSlug: string,
  limit = 50,
): Promise<ActivityView[]> {
  const wsId = await workspaceIdFromSlug(workspaceSlug);
  if (!wsId) return [];
  const { data, error } = await client()
    .from('activity_logs')
    .select('id, actor_id, kind, target_type, target_id, meta, created_at')
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((a: any) => rowToActivity(a, workspaceSlug));
}

export async function listSlackNotifications(
  workspaceSlug: string,
): Promise<SlackNotificationView[]> {
  const wsId = await workspaceIdFromSlug(workspaceSlug);
  if (!wsId) return [];
  const { data, error } = await client()
    .from('slack_notifications')
    .select('channel, user_name, message, posted_at')
    .eq('workspace_id', wsId)
    .order('posted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((n: any): SlackNotificationView => ({
    workspace: workspaceSlug,
    channel: n.channel,
    user: n.user_name ?? '',
    text: n.message,
    time: n.posted_at,
  }));
}

export async function listProjectMembers(
  workspaceSlug: string,
  projectId: string,
): Promise<ProjectMemberView[]> {
  const wsId = await workspaceIdFromSlug(workspaceSlug);
  if (!wsId) return [];
  const { data, error } = await client()
    .from('project_members')
    .select('id, project_id, user_id, role, profiles!inner(full_name, email)')
    .eq('workspace_id', wsId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any): ProjectMemberView => ({
    id:        r.id,
    projectId: r.project_id,
    userId:    r.user_id,
    role:      r.role,
    name:      (r.profiles?.full_name ?? r.profiles?.email ?? r.user_id) as string,
    email:     (r.profiles?.email ?? '') as string,
  }));
}

export function rowToEpisode(row: any, workspaceSlug: string): EpisodeView {
  return {
    id: row.id,
    workspace: workspaceSlug,
    num: row.episode_number ?? null,
    title: row.title,
    guest: row.guest ?? '',
    date: row.publish_date ?? '',
    duration: row.duration ?? '—',
    downloads: row.downloads ?? 0,
    status: row.status,
    hasVideo: !!row.has_video,
    description: row.description ?? undefined,
  };
}

export async function listEpisodes(
  workspaceSlug: string,
): Promise<EpisodeView[]> {
  const wsId = await workspaceIdFromSlug(workspaceSlug);
  if (!wsId) return [];
  const { data, error } = await client()
    .from('podcast_episodes')
    .select('*')
    .eq('workspace_id', wsId)
    .order('episode_number', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => rowToEpisode(r, workspaceSlug));
}

// ─── fallbacks (no tables yet) ──────────────────────────────────────────
// These three are read-only view data with no schema in Phase 2. Until they
// get tables, defer to the mock adapter so screens render. Phase 4+ replaces
// these with real queries.

export async function listProjectResources(
  workspaceSlug: string,
  projectId: string,
): Promise<ProjectResource[]> {
  const wsId = await workspaceIdFromSlug(workspaceSlug);
  if (!wsId) return [];
  const { data, error } = await client()
    .from('project_resources')
    .select('id, project_id, type, provider, external_id, name, url, created_at')
    .eq('workspace_id', wsId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any): ProjectResource => ({
    id:         r.id,
    projectId:  r.project_id,
    type:       r.type,
    provider:   r.provider,
    externalId: r.external_id ?? null,
    name:       r.name,
    url:        r.url ?? null,
    createdAt:  r.created_at,
  }));
}

export const listCalendarEvents = fallback.listCalendarEvents;
export const listTemplates = fallback.listTemplates;
export const getWorkspacePhases = fallback.getWorkspacePhases;

export async function getWorkspaceStats(
  workspaceSlug: string,
): Promise<WorkspaceStats> {
  const wsId = await workspaceIdFromSlug(workspaceSlug);
  if (!wsId) return { projects: 0, tasks: 0, team: 0 };
  const [{ count: projects }, { count: tasks }, { count: team }] =
    await Promise.all([
      client()
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId),
      client()
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId)
        .neq('status', 'Done'),
      client()
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId),
    ]);
  return {
    projects: projects ?? 0,
    tasks: tasks ?? 0,
    team: team ?? 0,
  };
}
