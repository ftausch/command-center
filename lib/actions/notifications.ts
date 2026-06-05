'use server';

import { createClient } from '@/lib/supabase/server';
import { currentUser, getWorkspaceContext } from '@/lib/auth';
import type { ActionResult } from '@/lib/types';

export interface AppNotification {
  id: string; userId: string; workspaceId: string;
  type: string; title: string; body?: string;
  linkRoute?: string; read: boolean; createdAt: string;
}

function row(r: any): AppNotification {
  return { id: r.id, userId: r.user_id, workspaceId: r.workspace_id, type: r.type, title: r.title, body: r.body ?? undefined, linkRoute: r.link_route ?? undefined, read: r.read, createdAt: r.created_at };
}

export async function listNotifications(workspaceId: string): Promise<AppNotification[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const ctx = await getWorkspaceContext(workspaceId);
  if (!ctx) return [];
  const u = await currentUser();
  if (!u) return [];
  const { data } = await supabase.from('notifications').select('*')
    .eq('workspace_id', ctx.uuid).eq('user_id', u.id)
    .order('created_at', { ascending: false }).limit(50);
  return (data ?? []).map(row);
}

export async function markNotificationsRead(workspaceId: string, ids?: string[]): Promise<ActionResult<null>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(workspaceId);
  if (!ctx) return { ok: false, error: 'Kein Zugriff.' };
  const u = await currentUser();
  if (!u) return { ok: false, error: 'Nicht eingeloggt.' };
  let q = supabase.from('notifications').update({ read: true }).eq('workspace_id', ctx.uuid).eq('user_id', u.id);
  if (ids?.length) q = q.in('id', ids);
  await q;
  return { ok: true, data: null };
}

export async function createNotification(input: {
  workspaceId: string; userId: string; type: string;
  title: string; body?: string; linkRoute?: string;
}): Promise<ActionResult<AppNotification>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Kein Zugriff.' };
  const { data, error } = await supabase.from('notifications').insert({
    workspace_id: ctx.uuid, user_id: input.userId, type: input.type,
    title: input.title, body: input.body || null, link_route: input.linkRoute || null,
  }).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: row(data) };
}
