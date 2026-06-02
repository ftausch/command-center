'use server';

import { createClient } from '@/lib/supabase/server';
import { currentUser, getWorkspaceContext, canWriteAsRole } from '@/lib/auth';
import type { ActionResult } from '@/lib/types';

const MEMBER_ROLES = ['owner', 'admin', 'manager', 'member'] as const;

export interface KeyResult {
  id: string; goalId: string; title: string;
  target: number; current: number; unit: string;
}
export interface Goal {
  id: string; workspaceId: string; title: string; description?: string;
  quarter: number; year: number;
  status: 'on_track' | 'at_risk' | 'off_track' | 'done';
  ownerId?: string; projectId?: string; createdAt: string;
  keyResults: KeyResult[];
}

function rowToGoal(r: any, krs: KeyResult[] = []): Goal {
  return {
    id: r.id, workspaceId: r.workspace_id, title: r.title,
    description: r.description ?? undefined, quarter: r.quarter, year: r.year,
    status: r.status, ownerId: r.owner_id ?? undefined, projectId: r.project_id ?? undefined,
    createdAt: r.created_at, keyResults: krs,
  };
}
function rowToKR(r: any): KeyResult {
  return { id: r.id, goalId: r.goal_id, title: r.title, target: r.target, current: r.current, unit: r.unit };
}

export async function listGoals(workspaceId: string, year?: number, quarter?: number): Promise<Goal[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const ctx = await getWorkspaceContext(workspaceId);
  if (!ctx) return [];
  let q = supabase.from('goals').select('*').eq('workspace_id', ctx.uuid);
  if (year)    q = q.eq('year', year);
  if (quarter) q = q.eq('quarter', quarter);
  q = q.order('quarter').order('created_at');
  const { data: goals } = await q;
  if (!goals?.length) return [];
  const goalIds = goals.map((g: any) => g.id);
  const { data: krs } = await supabase.from('key_results').select('*').in('goal_id', goalIds);
  const krsByGoal: Record<string, KeyResult[]> = {};
  (krs ?? []).forEach((r: any) => {
    (krsByGoal[r.goal_id] = krsByGoal[r.goal_id] ?? []).push(rowToKR(r));
  });
  return goals.map((g: any) => rowToGoal(g, krsByGoal[g.id] ?? []));
}

export async function createGoal(input: {
  workspaceId: string; title: string; description?: string;
  quarter: number; year: number; ownerId?: string; projectId?: string;
}): Promise<ActionResult<Goal>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MEMBER_ROLES])) return { ok: false, error: 'Keine Berechtigung.' };
  const { data, error } = await supabase.from('goals').insert({
    workspace_id: ctx.uuid, title: input.title.trim(),
    description: input.description || null, quarter: input.quarter, year: input.year,
    owner_id: input.ownerId || null, project_id: input.projectId || null,
  }).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: rowToGoal(data) };
}

export async function updateGoal(input: {
  workspaceId: string; goalId: string;
  patch: Partial<Pick<Goal, 'title' | 'description' | 'status' | 'ownerId' | 'projectId'>>;
}): Promise<ActionResult<Goal>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MEMBER_ROLES])) return { ok: false, error: 'Keine Berechtigung.' };
  const p = input.patch; const upd: Record<string, unknown> = {};
  if (p.title       !== undefined) upd.title      = p.title;
  if (p.description !== undefined) upd.description = p.description || null;
  if (p.status      !== undefined) upd.status     = p.status;
  if (p.ownerId     !== undefined) upd.owner_id   = p.ownerId || null;
  if (p.projectId   !== undefined) upd.project_id = p.projectId || null;
  const { data, error } = await supabase.from('goals').update(upd)
    .eq('id', input.goalId).eq('workspace_id', ctx.uuid).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  const { data: krs } = await supabase.from('key_results').select('*').eq('goal_id', input.goalId);
  return { ok: true, data: rowToGoal(data, (krs ?? []).map(rowToKR)) };
}

export async function deleteGoal(input: { workspaceId: string; goalId: string }): Promise<ActionResult<null>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MEMBER_ROLES])) return { ok: false, error: 'Keine Berechtigung.' };
  await supabase.from('goals').delete().eq('id', input.goalId).eq('workspace_id', ctx.uuid);
  return { ok: true, data: null };
}

export async function upsertKeyResult(input: {
  workspaceId: string; goalId: string; id?: string;
  title: string; target: number; current: number; unit: string;
}): Promise<ActionResult<KeyResult>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MEMBER_ROLES])) return { ok: false, error: 'Keine Berechtigung.' };
  const row = { goal_id: input.goalId, title: input.title, target: input.target, current: input.current, unit: input.unit };
  const q = input.id
    ? supabase.from('key_results').update(row).eq('id', input.id).select().single()
    : supabase.from('key_results').insert(row).select().single();
  const { data, error } = await q;
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: rowToKR(data) };
}

export async function deleteKeyResult(input: { goalId: string; krId: string }): Promise<ActionResult<null>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  await supabase.from('key_results').delete().eq('id', input.krId).eq('goal_id', input.goalId);
  return { ok: true, data: null };
}
