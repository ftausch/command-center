'use server';
// Luma server actions — all Luma API calls are server-side only.

import { extractLumaSlug, getLumaEvent, getLumaGuests } from '@/lib/integrations/luma';
import { getWorkspaceContext, canWriteAsRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';

const MANAGER_ROLES = ['owner', 'admin', 'manager'] as const;

// ── Preview: fill NewEventModal from Luma URL ─────────────────────────────

export async function fetchLumaEventPreview(lumaUrl: string): Promise<ActionResult<{
  name: string;
  location?: string;
  eventDate?: string;
  guestCount?: number;
  lumaEventId?: string;
}>> {
  const slug = extractLumaSlug(lumaUrl);
  if (!slug) return { ok: false, error: 'Ungültige Luma-URL. Erwartet: lu.ma/event-slug' };

  try {
    const ev = await getLumaEvent(slug);
    return {
      ok: true,
      data: {
        name:        ev.name,
        location:    ev.location,
        eventDate:   ev.startAt,
        guestCount:  ev.guestCount,
        lumaEventId: ev.apiId,
      },
    };
  } catch (e: any) {
    return { ok: false, error: e.message ?? 'Luma-Event konnte nicht geladen werden.' };
  }
}

// ── RSVP counter ──────────────────────────────────────────────────────────

export async function getLumaRsvpCount(
  lumaUrl: string,
): Promise<ActionResult<{ count: number }>> {
  const slug = extractLumaSlug(lumaUrl);
  if (!slug) return { ok: false, error: 'Ungültige Luma-URL' };

  try {
    const ev = await getLumaEvent(slug);
    return { ok: true, data: { count: ev.guestCount ?? 0 } };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ── Guest list sync ───────────────────────────────────────────────────────

export async function syncLumaGuests(input: {
  workspaceId: string;
  projectId: string;
  lumaUrl: string;
}): Promise<ActionResult<{ imported: number; skipped: number }>> {
  const slug = extractLumaSlug(input.lumaUrl);
  if (!slug) return { ok: false, error: 'Ungültige Luma-URL' };

  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };

  try {
    const ev     = await getLumaEvent(slug);
    const guests = await getLumaGuests(ev.apiId);

    // Load existing to skip duplicates
    const { data: existing } = await supabase
      .from('event_attendees')
      .select('email, name')
      .eq('project_id', input.projectId);

    const existingEmails = new Set(
      (existing ?? []).map((a: any) => a.email?.toLowerCase()).filter(Boolean),
    );
    const existingNames = new Set(
      (existing ?? []).map((a: any) => a.name?.toLowerCase()).filter(Boolean),
    );

    const toImport = guests.filter((g) => {
      if (g.approvalStatus === 'declined') return false;
      if (g.email && existingEmails.has(g.email.toLowerCase())) return false;
      if (!g.email && existingNames.has(g.name.toLowerCase())) return false;
      return true;
    });

    if (toImport.length === 0)
      return { ok: true, data: { imported: 0, skipped: guests.length } };

    const rows = toImport.map((g) => ({
      workspace_id: ctx.uuid,
      project_id:   input.projectId,
      name:         g.name,
      email:        g.email ?? null,
      role:         'attendee',
      status:       g.approvalStatus === 'approved' ? 'confirmed' : 'invited',
    }));

    const { error } = await supabase.from('event_attendees').insert(rows);
    if (error) return { ok: false, error: error.message };

    return { ok: true, data: { imported: toImport.length, skipped: guests.length - toImport.length } };
  } catch (e: any) {
    return { ok: false, error: e.message ?? 'Sync fehlgeschlagen.' };
  }
}
