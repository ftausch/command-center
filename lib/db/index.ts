// Data layer entry point. One async function per query the UI needs. At
// runtime we delegate to either the mock adapter (works without any
// backend) or the Supabase adapter (real DB, RLS-enforced). The switch is
// the presence of NEXT_PUBLIC_SUPABASE_URL — same flag the supabase client
// uses — so the build & preview deploy never break when env vars are absent.
//
// All functions return *view types* (matching the legacy mock-data shape)
// so screens can consume them without translating field names. The Supabase
// adapter maps DB rows into view types before returning.

import type {
  ActivityView,
  BrandView,
  CalendarEventView,
  EpisodeView,
  ProjectView,
  SlackNotificationView,
  TaskView,
  TemplateView,
  UserView,
  WorkspaceStats,
} from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import * as mock from './mock';
import * as remote from './supabase';

const adapter = isSupabaseConfigured() ? remote : mock;

export const db = {
  getCurrentUser: (): Promise<UserView | null> => adapter.getCurrentUser(),
  listWorkspaces: (): Promise<BrandView[]> => adapter.listWorkspaces(),
  getWorkspace: (id: string): Promise<BrandView | null> => adapter.getWorkspace(id),
  listMembers: (workspaceId: string): Promise<UserView[]> =>
    adapter.listMembers(workspaceId),
  listProjects: (workspaceId: string): Promise<ProjectView[]> =>
    adapter.listProjects(workspaceId),
  getProject: (
    workspaceId: string,
    projectId: string,
  ): Promise<ProjectView | null> => adapter.getProject(workspaceId, projectId),
  listTasks: (
    workspaceId: string,
    projectId?: string,
  ): Promise<TaskView[]> => adapter.listTasks(workspaceId, projectId),
  listActivity: (workspaceId: string, limit?: number): Promise<ActivityView[]> =>
    adapter.listActivity(workspaceId, limit),
  listCalendarEvents: (workspaceId: string): Promise<CalendarEventView[]> =>
    adapter.listCalendarEvents(workspaceId),
  listSlackNotifications: (
    workspaceId: string,
  ): Promise<SlackNotificationView[]> =>
    adapter.listSlackNotifications(workspaceId),
  listTemplates: (
    workspaceId: string,
  ): Promise<Record<string, TemplateView>> => adapter.listTemplates(workspaceId),
  getWorkspacePhases: (workspaceId: string): Promise<string[]> =>
    adapter.getWorkspacePhases(workspaceId),
  getWorkspaceStats: (workspaceId: string): Promise<WorkspaceStats> =>
    adapter.getWorkspaceStats(workspaceId),
  listEpisodes: (workspaceId: string): Promise<EpisodeView[]> =>
    adapter.listEpisodes(workspaceId),
};

/** Exposes which backend is wired up — useful for dev banners / debug. */
export function dataMode(): 'supabase' | 'mock' {
  return isSupabaseConfigured() ? 'supabase' : 'mock';
}

export type {
  ActivityView,
  BrandView,
  CalendarEventView,
  EpisodeView,
  ProjectView,
  SlackNotificationView,
  TaskView,
  TemplateView,
  UserView,
  WorkspaceStats,
};
