'use server';

import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { currentUser, getWorkspaceContext, canWriteAsRole } from '@/lib/auth';
import type { ActionResult, EpisodeStatus, EpisodeView } from '@/lib/types';

const MEMBER_ROLES = ['owner', 'admin', 'manager', 'member'] as const;

async function actor(): Promise<string> {
  const u = await currentUser();
  return u?.id ?? 'unknown';
}

export async function createEpisode(input: {
  workspaceId: string;
  title: string;
  episodeNumber?: number | null;
  guest?: string;
  publishDate?: string;
  duration?: string;
  status?: EpisodeStatus;
  hasVideo?: boolean;
  description?: string;
}): Promise<ActionResult<EpisodeView>> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Titel ist erforderlich' };

  const supabase = createClient();
  const userId = await actor();

  if (!supabase) {
    const ep: EpisodeView = {
      id: randomUUID(),
      workspace: input.workspaceId,
      num: input.episodeNumber ?? null,
      title,
      guest: input.guest ?? '',
      date: input.publishDate ?? '',
      duration: input.duration ?? '—',
      downloads: 0,
      status: input.status ?? 'draft',
      hasVideo: input.hasVideo ?? false,
      description: input.description,
    };
    return { ok: true, data: ep };
  }

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace nicht gefunden oder kein Zugriff' };
  if (!canWriteAsRole(ctx.role, [...MEMBER_ROLES])) {
    return { ok: false, error: 'Keine Berechtigung zum Erstellen von Episoden' };
  }

  const { data, error } = await supabase
    .from('podcast_episodes')
    .insert({
      workspace_id: ctx.uuid,
      title,
      episode_number: input.episodeNumber ?? null,
      guest: input.guest || null,
      publish_date: input.publishDate || null,
      duration: input.duration || null,
      status: input.status ?? 'draft',
      has_video: input.hasVideo ?? false,
      description: input.description || null,
    })
    .select()
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'Insert fehlgeschlagen' };

  return {
    ok: true,
    data: {
      id: data.id,
      workspace: input.workspaceId,
      num: data.episode_number ?? null,
      title: data.title,
      guest: data.guest ?? '',
      date: data.publish_date ?? '',
      duration: data.duration ?? '—',
      downloads: data.downloads ?? 0,
      status: data.status,
      hasVideo: !!data.has_video,
      description: data.description ?? undefined,
    },
  };
}

export async function updateEpisode(input: {
  episodeId: string;
  workspaceId: string;
  patch: Partial<Pick<EpisodeView, 'title' | 'guest' | 'date' | 'duration' | 'status' | 'hasVideo' | 'num' | 'description' | 'showNotes' | 'episodeMeta'>>;
}): Promise<ActionResult<{ id: string }>> {
  const supabase = createClient();
  if (!supabase) return { ok: true, data: { id: input.episodeId } };

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace nicht gefunden oder kein Zugriff' };
  if (!canWriteAsRole(ctx.role, [...MEMBER_ROLES])) {
    return { ok: false, error: 'Keine Berechtigung zum Bearbeiten von Episoden' };
  }

  const row: Record<string, unknown> = {};
  if (input.patch.title     !== undefined) row.title          = input.patch.title;
  if (input.patch.guest     !== undefined) row.guest          = input.patch.guest || null;
  if (input.patch.date      !== undefined) row.publish_date   = input.patch.date || null;
  if (input.patch.duration  !== undefined) row.duration       = input.patch.duration || null;
  if (input.patch.status    !== undefined) row.status         = input.patch.status;
  if (input.patch.hasVideo  !== undefined) row.has_video      = input.patch.hasVideo;
  if (input.patch.num       !== undefined) row.episode_number = input.patch.num;
  if (input.patch.description  !== undefined) row.description   = input.patch.description || null;
  if (input.patch.showNotes    !== undefined) row.show_notes    = input.patch.showNotes || null;
  if (input.patch.episodeMeta  !== undefined) row.episode_meta  = input.patch.episodeMeta ?? null;

  const { error } = await supabase
    .from('podcast_episodes')
    .update(row)
    .eq('id', input.episodeId)
    .eq('workspace_id', ctx.uuid);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { id: input.episodeId } };
}
