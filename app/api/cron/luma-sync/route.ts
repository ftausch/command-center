// GET /api/cron/luma-sync
//
// Vercel Cron — every hour. Syncs RSVP counts from Luma for all
// upcoming event projects that have a lumaUrl stored in event_meta.
// Updates event_meta.rsvpCount + rsvpSyncedAt in place.

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLumaEvent, extractLumaSlug } from '@/lib/integrations/luma';

export const dynamic = 'force-dynamic';
export const runtime  = 'nodejs';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ skipped: true, reason: 'no-admin-client' });

  const today = new Date().toISOString().slice(0, 10);

  // Find upcoming event projects with a lumaUrl in event_meta
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, event_meta')
    .not('event_meta', 'is', null)
    .gte('due_date', today);

  if (error) {
    console.error('[luma-sync] query failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const lumaProjects = (projects ?? []).filter((p: any) => p.event_meta?.lumaUrl);

  if (!lumaProjects.length) {
    return NextResponse.json({ updated: 0, total: 0 });
  }

  let updated = 0;
  let failed  = 0;

  for (const project of lumaProjects) {
    const meta     = project.event_meta as Record<string, unknown>;
    const lumaUrl  = meta.lumaUrl as string;
    const slug     = extractLumaSlug(lumaUrl);
    if (!slug) continue;

    try {
      const ev       = await getLumaEvent(slug);
      const newCount = ev.guestCount ?? 0;

      if (meta.rsvpCount === newCount) continue;

      await supabase
        .from('projects')
        .update({
          event_meta: {
            ...meta,
            rsvpCount:    newCount,
            rsvpSyncedAt: new Date().toISOString(),
          },
        })
        .eq('id', project.id);

      updated++;
    } catch (e: any) {
      console.error(`[luma-sync] failed for project ${project.id}:`, e.message);
      failed++;
    }
  }

  console.log(`[luma-sync] ✓ ${updated} updated, ${failed} failed, ${lumaProjects.length} total`);
  return NextResponse.json({ updated, failed, total: lumaProjects.length });
}
