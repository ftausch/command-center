'use server';

import { createClient } from '@/lib/supabase/server';
import { currentUser, getWorkspaceContext } from '@/lib/auth';
import type { ActionResult } from '@/lib/types';

export interface TimeLog {
  id: string; taskId: string; userId: string;
  minutes: number; loggedDate: string; note?: string; createdAt: string;
}

function row(r: any): TimeLog {
  return { id: r.id, taskId: r.task_id, userId: r.user_id, minutes: r.minutes, loggedDate: r.logged_date, note: r.note ?? undefined, createdAt: r.created_at };
}

export async function listTimeLogs(workspaceId: string, taskId: string): Promise<TimeLog[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const ctx = await getWorkspaceContext(workspaceId);
  if (!ctx) return [];
  const { data } = await supabase.from('time_logs').select('*')
    .eq('workspace_id', ctx.uuid).eq('task_id', taskId).order('logged_date', { ascending: false });
  return (data ?? []).map(row);
}

export async function logTime(input: {
  workspaceId: string; taskId: string; minutes: number; note?: string; loggedDate?: string;
}): Promise<ActionResult<TimeLog>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Kein Zugriff.' };
  const u = await currentUser();
  if (!u) return { ok: false, error: 'Nicht eingeloggt.' };
  const { data, error } = await supabase.from('time_logs').insert({
    workspace_id: ctx.uuid, task_id: input.taskId, user_id: u.id,
    minutes: input.minutes, logged_date: input.loggedDate ?? new Date().toISOString().slice(0, 10),
    note: input.note || null,
  }).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: row(data) };
}

export async function deleteTimeLog(input: { workspaceId: string; logId: string }): Promise<ActionResult<null>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Kein Zugriff.' };
  await supabase.from('time_logs').delete().eq('id', input.logId).eq('workspace_id', ctx.uuid);
  return { ok: true, data: null };
}
