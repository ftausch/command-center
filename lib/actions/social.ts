'use server';

import { createClient } from '@/lib/supabase/server';
import { getWorkspaceContext, canWriteAsRole } from '@/lib/auth';
import type { ActionResult } from '@/lib/types';

const MEMBER_ROLES = ['owner', 'admin', 'manager', 'member'] as const;

export type SocialPlatform = 'linkedin' | 'instagram' | 'twitter' | 'tiktok' | 'youtube';
export type SocialStatus   = 'draft' | 'approved' | 'scheduled' | 'posted';

export interface SocialPost {
  id: string;
  workspaceId: string;
  platform: SocialPlatform;
  content: string;
  status: SocialStatus;
  scheduledAt?: string;
  episodeId?: string;
  projectId?: string;
  mediaUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

function row(r: any): SocialPost {
  return {
    id: r.id, workspaceId: r.workspace_id, platform: r.platform, content: r.content,
    status: r.status, scheduledAt: r.scheduled_at ?? undefined,
    episodeId: r.episode_id ?? undefined, projectId: r.project_id ?? undefined,
    mediaUrl: r.media_url ?? undefined, notes: r.notes ?? undefined,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export async function listSocialPosts(workspaceId: string): Promise<SocialPost[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const ctx = await getWorkspaceContext(workspaceId);
  if (!ctx) return [];
  const { data } = await supabase.from('social_posts').select()
    .eq('workspace_id', ctx.uuid).order('scheduled_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  return (data ?? []).map(row);
}

export async function createSocialPost(input: {
  workspaceId: string; platform: SocialPlatform; content: string;
  scheduledAt?: string; episodeId?: string; projectId?: string;
  mediaUrl?: string; notes?: string;
}): Promise<ActionResult<SocialPost>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MEMBER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const { data, error } = await supabase.from('social_posts').insert({
    workspace_id: ctx.uuid, platform: input.platform, content: input.content,
    scheduled_at: input.scheduledAt || null, episode_id: input.episodeId || null,
    project_id: input.projectId || null, media_url: input.mediaUrl || null,
    notes: input.notes || null,
  }).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: row(data) };
}

export async function updateSocialPost(input: {
  workspaceId: string; postId: string;
  patch: Partial<Pick<SocialPost, 'platform' | 'content' | 'status' | 'scheduledAt' | 'episodeId' | 'projectId' | 'mediaUrl' | 'notes'>>;
}): Promise<ActionResult<SocialPost>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MEMBER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const p = input.patch;
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (p.platform    !== undefined) upd.platform    = p.platform;
  if (p.content     !== undefined) upd.content     = p.content;
  if (p.status      !== undefined) upd.status      = p.status;
  if (p.scheduledAt !== undefined) upd.scheduled_at = p.scheduledAt || null;
  if (p.episodeId   !== undefined) upd.episode_id  = p.episodeId || null;
  if (p.projectId   !== undefined) upd.project_id  = p.projectId || null;
  if (p.mediaUrl    !== undefined) upd.media_url   = p.mediaUrl || null;
  if (p.notes       !== undefined) upd.notes       = p.notes || null;
  const { data, error } = await supabase.from('social_posts').update(upd)
    .eq('id', input.postId).eq('workspace_id', ctx.uuid).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: row(data) };
}

export async function deleteSocialPost(input: { workspaceId: string; postId: string }): Promise<ActionResult<null>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MEMBER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const { error } = await supabase.from('social_posts').delete()
    .eq('id', input.postId).eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
