// GET /api/cron/keepalive
//
// Runs daily at 06:00 UTC — before the overdue-reminder (08:00) and
// daily-digest (07:00) crons. Its only job is to touch the Supabase
// database so the Free Tier project never pauses due to inactivity.
//
// Supabase Free Tier pauses projects after ~1 week with no database
// connections. Our other crons cover Mon–Sat, but this explicit ping
// runs every single day including Sunday as a belt-and-suspenders guard.
//
// Security: same CRON_SECRET guard as the other cron routes.

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime  = 'nodejs';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'admin client not configured' }, { status: 500 });
  }

  // Lightweight HEAD-style count — no rows transferred, just a connection.
  const { count, error } = await admin
    .from('workspaces')
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.error('[cron/keepalive] DB ping failed:', error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  console.log(`[cron/keepalive] ✓ DB alive — ${count} workspace(s)`);
  return NextResponse.json({ ok: true, workspaces: count, ts: new Date().toISOString() });
}
