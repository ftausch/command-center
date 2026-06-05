'use server';

import { createClient } from '@/lib/supabase/server';
import { getWorkspaceContext, canWriteAsRole } from '@/lib/auth';
import type { ActionResult } from '@/lib/types';

const MEMBER_ROLES = ['owner', 'admin', 'manager', 'member'] as const;

export interface WorkspaceTag { id: string; workspaceId: string; name: string; color: string; }

function row(r: any): WorkspaceTag {
  return { id: r.id, workspaceId: r.workspace_id, name: r.name, color: r.color };
}

export async function listTags(workspaceId: string): Promise<WorkspaceTag[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const ctx = await getWorkspaceContext(workspaceId);
  if (!ctx) return [];
  const { data } = await supabase.from('workspace_tags').select('*').eq('workspace_id', ctx.uuid).order('name');
  return (data ?? []).map(row);
}

export async function createTag(input: { workspaceId: string; name: string; color: string }): Promise<ActionResult<WorkspaceTag>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MEMBER_ROLES])) return { ok: false, error: 'Keine Berechtigung.' };
  const { data, error } = await supabase.from('workspace_tags').insert({ workspace_id: ctx.uuid, name: input.name.trim(), color: input.color }).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: row(data) };
}

export async function deleteTag(input: { workspaceId: string; tagId: string }): Promise<ActionResult<null>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MEMBER_ROLES])) return { ok: false, error: 'Keine Berechtigung.' };
  await supabase.from('workspace_tags').delete().eq('id', input.tagId).eq('workspace_id', ctx.uuid);
  return { ok: true, data: null };
}
