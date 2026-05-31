'use server';

import { createClient } from '@/lib/supabase/server';
import { getWorkspaceContext, canWriteAsRole } from '@/lib/auth';
import type { ActionResult } from '@/lib/types';

const MEMBER_ROLES = ['owner', 'admin', 'manager', 'member'] as const;

export interface SprintView {
  id: string;
  workspaceId: string;
  name: string;
  goal?: string;
  startDate: string;
  endDate: string;
  status: 'planned' | 'active' | 'completed';
  createdAt: string;
}

function row(r: any): SprintView {
  return {
    id: r.id, workspaceId: r.workspace_id, name: r.name, goal: r.goal ?? undefined,
    startDate: r.start_date, endDate: r.end_date, status: r.status, createdAt: r.created_at,
  };
}

export async function listSprints(workspaceId: string): Promise<SprintView[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const ctx = await getWorkspaceContext(workspaceId);
  if (!ctx) return [];
  const { data } = await supabase.from('sprints').select()
    .eq('workspace_id', ctx.uuid).order('start_date', { ascending: false });
  return (data ?? []).map(row);
}

export async function createSprint(input: {
  workspaceId: string; name: string; goal?: string;
  startDate: string; endDate: string;
}): Promise<ActionResult<SprintView>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MEMBER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const { data, error } = await supabase.from('sprints').insert({
    workspace_id: ctx.uuid, name: input.name.trim(),
    goal: input.goal || null, start_date: input.startDate, end_date: input.endDate,
  }).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: row(data) };
}

export async function updateSprint(input: {
  workspaceId: string; sprintId: string;
  patch: Partial<Pick<SprintView, 'name' | 'goal' | 'startDate' | 'endDate' | 'status'>>;
}): Promise<ActionResult<SprintView>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MEMBER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const p = input.patch;
  const upd: Record<string, unknown> = {};
  if (p.name      !== undefined) upd.name       = p.name;
  if (p.goal      !== undefined) upd.goal       = p.goal || null;
  if (p.startDate !== undefined) upd.start_date = p.startDate;
  if (p.endDate   !== undefined) upd.end_date   = p.endDate;
  if (p.status    !== undefined) upd.status     = p.status;
  const { data, error } = await supabase.from('sprints').update(upd)
    .eq('id', input.sprintId).eq('workspace_id', ctx.uuid).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: row(data) };
}

export async function deleteSprint(input: { workspaceId: string; sprintId: string }): Promise<ActionResult<null>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MEMBER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const { error } = await supabase.from('sprints').delete()
    .eq('id', input.sprintId).eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function assignTaskToSprint(input: {
  workspaceId: string; taskId: string; sprintId: string | null;
}): Promise<ActionResult<null>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MEMBER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const { error } = await supabase.from('tasks').update({ sprint_id: input.sprintId })
    .eq('id', input.taskId).eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
