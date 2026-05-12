// Data layer entry point. One async function per query the UI needs. At
// runtime we delegate to either the mock adapter (works without any
// backend) or the Supabase adapter (real DB, RLS-enforced). The switch is
// the presence of NEXT_PUBLIC_SUPABASE_URL — same flag the supabase client
// uses — so the build & preview deploy never break when env vars are absent.
//
// Screens still read the legacy `D` object synchronously today. This module
// is the seam they'll migrate to one screen at a time, without touching
// every component at once.

import type {
  Project,
  Task,
  TaskComment,
  TaskChecklistItem,
  Workspace,
  ActivityLog,
  Profile,
} from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import * as mock from './mock';
import * as remote from './supabase';

const adapter = isSupabaseConfigured() ? remote : mock;

export const db = {
  listWorkspaces: (): Promise<Workspace[]> => adapter.listWorkspaces(),
  listMembers: (workspaceId: string): Promise<Profile[]> =>
    adapter.listMembers(workspaceId),
  listProjects: (workspaceId: string): Promise<Project[]> =>
    adapter.listProjects(workspaceId),
  getProject: (workspaceId: string, projectId: string): Promise<Project | null> =>
    adapter.getProject(workspaceId, projectId),
  listTasks: (workspaceId: string, projectId?: string): Promise<Task[]> =>
    adapter.listTasks(workspaceId, projectId),
  listTaskComments: (workspaceId: string, taskId: string): Promise<TaskComment[]> =>
    adapter.listTaskComments(workspaceId, taskId),
  listTaskChecklistItems: (
    workspaceId: string,
    taskId: string,
  ): Promise<TaskChecklistItem[]> =>
    adapter.listTaskChecklistItems(workspaceId, taskId),
  listActivity: (workspaceId: string, limit?: number): Promise<ActivityLog[]> =>
    adapter.listActivity(workspaceId, limit),
};

/** Exposes which backend is wired up — useful for dev banners / debug. */
export function dataMode(): 'supabase' | 'mock' {
  return isSupabaseConfigured() ? 'supabase' : 'mock';
}

export type { Project, Task, Workspace, ActivityLog, Profile };
