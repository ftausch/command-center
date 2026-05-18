'use server';

import { createClient } from '@/lib/supabase/server';
import { getWorkspaceContext, canWriteAsRole } from '@/lib/auth';
import type { ActionResult, GuestStatus, PodcastGuest } from '@/lib/types';

const MEMBER_ROLES = ['owner', 'admin', 'manager', 'member'] as const;

function rowToGuest(row: any): PodcastGuest {
  return {
    id:             row.id,
    workspaceId:    row.workspace_id,
    name:           row.name,
    email:          row.email          ?? undefined,
    company:        row.company        ?? undefined,
    role:           row.role           ?? undefined,
    linkedinUrl:    row.linkedin_url   ?? undefined,
    twitterHandle:  row.twitter_handle ?? undefined,
    bio:            row.bio            ?? undefined,
    status:         row.status as GuestStatus,
    notes:          row.notes          ?? undefined,
    lastContacted:  row.last_contacted ?? undefined,
    episodeCount:   row.episode_count  ?? 0,
    createdAt:      row.created_at,
  };
}

export async function listGuests(workspaceId: string): Promise<PodcastGuest[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('podcast_guests')
    .select()
    .eq('workspace_id', (await supabase.from('workspaces').select('id').eq('slug', workspaceId).maybeSingle()).data?.id ?? '')
    .order('created_at', { ascending: false });
  return (data ?? []).map(rowToGuest);
}

export async function createGuest(input: {
  workspaceId: string;
  name: string;
  email?: string;
  company?: string;
  role?: string;
  linkedinUrl?: string;
  bio?: string;
  status?: GuestStatus;
  notes?: string;
}): Promise<ActionResult<PodcastGuest>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MEMBER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };

  const { data, error } = await supabase
    .from('podcast_guests')
    .insert({
      workspace_id:  ctx.uuid,
      name:          input.name,
      email:         input.email        ?? null,
      company:       input.company      ?? null,
      role:          input.role         ?? null,
      linkedin_url:  input.linkedinUrl  ?? null,
      bio:           input.bio          ?? null,
      status:        input.status       ?? 'prospect',
      notes:         input.notes        ?? null,
    })
    .select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: rowToGuest(data) };
}

export async function updateGuest(input: {
  workspaceId: string;
  guestId: string;
  patch: Partial<Pick<PodcastGuest, 'name' | 'email' | 'company' | 'role' | 'linkedinUrl' | 'twitterHandle' | 'bio' | 'status' | 'notes' | 'lastContacted' | 'episodeCount'>>;
}): Promise<ActionResult<PodcastGuest>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MEMBER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.patch.name          !== undefined) row.name           = input.patch.name;
  if (input.patch.email         !== undefined) row.email          = input.patch.email || null;
  if (input.patch.company       !== undefined) row.company        = input.patch.company || null;
  if (input.patch.role          !== undefined) row.role           = input.patch.role || null;
  if (input.patch.linkedinUrl   !== undefined) row.linkedin_url   = input.patch.linkedinUrl || null;
  if (input.patch.twitterHandle !== undefined) row.twitter_handle = input.patch.twitterHandle || null;
  if (input.patch.bio           !== undefined) row.bio            = input.patch.bio || null;
  if (input.patch.status        !== undefined) row.status         = input.patch.status;
  if (input.patch.notes         !== undefined) row.notes          = input.patch.notes || null;
  if (input.patch.lastContacted !== undefined) row.last_contacted = input.patch.lastContacted || null;
  if (input.patch.episodeCount  !== undefined) row.episode_count  = input.patch.episodeCount;

  const { data, error } = await supabase
    .from('podcast_guests')
    .update(row)
    .eq('id', input.guestId)
    .eq('workspace_id', ctx.uuid)
    .select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: rowToGuest(data) };
}

export async function deleteGuest(input: {
  workspaceId: string;
  guestId: string;
}): Promise<ActionResult<null>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MEMBER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const { error } = await supabase
    .from('podcast_guests')
    .delete()
    .eq('id', input.guestId)
    .eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
