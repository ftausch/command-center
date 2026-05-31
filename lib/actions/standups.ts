'use server';

import { createClient } from '@/lib/supabase/server';
import { currentUser, getWorkspaceContext } from '@/lib/auth';
import type { ActionResult } from '@/lib/types';

export interface StandupEntry {
  id: string;
  userId: string;
  date: string;
  today?: string;
  blockers?: string;
  yesterday?: string;
  updatedAt: string;
}

function row(r: any): StandupEntry {
  return {
    id:        r.id,
    userId:    r.user_id,
    date:      r.date,
    today:     r.today     ?? undefined,
    blockers:  r.blockers  ?? undefined,
    yesterday: r.yesterday ?? undefined,
    updatedAt: r.updated_at,
  };
}

export async function listStandups(workspaceId: string, date: string): Promise<StandupEntry[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const ctx = await getWorkspaceContext(workspaceId);
  if (!ctx) return [];
  const { data } = await supabase.from('standups').select()
    .eq('workspace_id', ctx.uuid).eq('date', date);
  return (data ?? []).map(row);
}

export async function upsertStandup(input: {
  workspaceId: string;
  date: string;
  today?: string;
  blockers?: string;
  yesterday?: string;
}): Promise<ActionResult<StandupEntry>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Kein Zugriff.' };
  const u = await currentUser();
  if (!u) return { ok: false, error: 'Nicht eingeloggt.' };

  const { data, error } = await supabase.from('standups').upsert({
    workspace_id: ctx.uuid,
    user_id:      u.id,
    date:         input.date,
    today:        input.today     ?? null,
    blockers:     input.blockers  ?? null,
    yesterday:    input.yesterday ?? null,
    updated_at:   new Date().toISOString(),
  }, { onConflict: 'workspace_id,user_id,date' }).select().single();

  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: row(data) };
}
