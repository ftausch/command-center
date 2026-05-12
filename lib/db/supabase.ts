// Supabase adapter. Same shape as the mock adapter so lib/db/index.ts can
// swap them transparently. All reads go through the server client so RLS is
// enforced as the current user — never the service role.

import { createClient } from '@/lib/supabase/server';
import type {
  ActivityLog,
  Profile,
  Project,
  Task,
  TaskChecklistItem,
  TaskComment,
  Workspace,
} from '@/lib/types';

function client() {
  const c = createClient();
  if (!c) throw new Error('[db/supabase] supabase server client not configured');
  return c;
}

export async function listWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await client()
    .from('workspaces')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data ?? []) as Workspace[];
}

export async function listMembers(workspaceId: string): Promise<Profile[]> {
  // workspace_members → profiles via foreign key embedding.
  const { data, error } = await client()
    .from('workspace_members')
    .select('user_id, profiles!inner(*)')
    .eq('workspace_id', workspaceId);
  if (error) throw error;
  return (data ?? []).map((row: any) => row.profiles as Profile);
}

export async function listProjects(workspaceId: string): Promise<Project[]> {
  const { data, error } = await client()
    .from('projects')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function getProject(
  workspaceId: string,
  projectId: string,
): Promise<Project | null> {
  const { data, error } = await client()
    .from('projects')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', projectId)
    .maybeSingle();
  if (error) throw error;
  return (data as Project | null) ?? null;
}

export async function listTasks(
  workspaceId: string,
  projectId?: string,
): Promise<Task[]> {
  let q = client()
    .from('tasks')
    .select('*')
    .eq('workspace_id', workspaceId);
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q.order('due_date', {
    ascending: true,
    nullsFirst: false,
  });
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function listTaskComments(
  workspaceId: string,
  taskId: string,
): Promise<TaskComment[]> {
  const { data, error } = await client()
    .from('task_comments')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TaskComment[];
}

export async function listTaskChecklistItems(
  workspaceId: string,
  taskId: string,
): Promise<TaskChecklistItem[]> {
  const { data, error } = await client()
    .from('task_checklist_items')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('task_id', taskId)
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TaskChecklistItem[];
}

export async function listActivity(
  workspaceId: string,
  limit = 50,
): Promise<ActivityLog[]> {
  const { data, error } = await client()
    .from('activity_logs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ActivityLog[];
}
