// GET /api/cron/event-reminder
//
// Vercel Cron — daily at 08:00 UTC (10:00 CEST).
// For every workspace with active Slack integration, checks if any event
// projects have their eventDate in the next 24–48 hours and sends a
// reminder to the workspace Slack channel.
//
// Security: same CRON_SECRET guard as other cron routes.

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { postSlackNotification } from '@/lib/integrations/slack';

export const dynamic = 'force-dynamic';
export const runtime  = 'nodejs';

const SITE_URL = 'https://team.unicornbakery.de';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

function hoursUntil(isoDateTime: string): number {
  return (new Date(isoDateTime).getTime() - Date.now()) / 3_600_000;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'admin client not configured' }, { status: 500 });
  }

  // Fetch all workspaces with active Slack integration
  const { data: integrations } = await admin
    .from('slack_integrations')
    .select('workspace_id')
    .eq('is_active', true);

  if (!integrations?.length) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No active Slack integrations' });
  }

  let sent = 0;

  for (const integration of integrations) {
    const wsId = integration.workspace_id as string;

    // Fetch all event projects for this workspace
    const { data: projects } = await admin
      .from('projects')
      .select('id, name, status, event_meta, owner_id')
      .eq('workspace_id', wsId)
      .eq('division', 'events')
      .neq('status', 'Done');

    if (!projects?.length) continue;

    const reminders: string[] = [];

    for (const proj of projects) {
      const meta = proj.event_meta as any;
      if (!meta?.eventDate) continue;

      const hours = hoursUntil(meta.eventDate);

      const loc = meta.location ? ` · 📍 ${meta.location}` : '';
      const partner = meta.partnerSponsor ? ` · 🤝 ${meta.partnerSponsor}` : '';

      // 7-day reminder (between 6.5d and 7.5d)
      if (hours >= 156 && hours <= 180) {
        reminders.push(`📅 *${proj.name}* — in 7 Tagen${loc}${partner}. Alles auf Kurs?`);
      }

      // 3-day reminder (between 68h and 76h)
      if (hours >= 68 && hours <= 76) {
        const dateStr = new Date(meta.eventDate).toLocaleDateString('de-DE', { weekday:'long', day:'2-digit', month:'2-digit', timeZone:'Europe/Berlin' });
        reminders.push(`🔔 *${proj.name}* — in 3 Tagen (${dateStr})${loc}. Finale Checks!`);
      }

      // 24h reminder window (between 20h and 26h ahead)
      if (hours >= 20 && hours <= 26) {
        const time = new Date(meta.eventDate).toLocaleString('de-DE', {
          weekday: 'long', day: '2-digit', month: '2-digit',
          hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin',
        });
        reminders.push(`🎪 *${proj.name}* — morgen um ${time}${loc}${partner}`);
      }

      // 2h reminder
      if (hours >= 1.5 && hours <= 2.5) {
        reminders.push(`⏰ *${proj.name}* beginnt in ~2 Stunden!${loc}`);
      }
    }

    if (!reminders.length) continue;

    const text = [
      `📅 *Event-Reminder*`,
      ...reminders,
      `🔗 <${SITE_URL}|Command Center öffnen>`,
    ].join('\n');

    await postSlackNotification({ workspaceUuid: wsId, text, channelLabel: 'event-reminder' });
    sent++;
    console.log(`[cron/event-reminder] sent reminder for ${reminders.length} event(s) in workspace ${wsId}`);
  }

  return NextResponse.json({ ok: true, sent, ts: new Date().toISOString() });
}
