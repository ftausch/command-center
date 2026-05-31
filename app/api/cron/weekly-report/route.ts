// GET /api/cron/weekly-report
//
// Vercel Cron — every Friday at 16:00 UTC (18:00 Berlin).
// Sends a weekly summary to each workspace's Slack channel:
// completed tasks, new projects, upcoming events & episodes.

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

function berlinWeekRange(): { mondayIso: string; sundayIso: string; nextMondayIso: string; nextSundayIso: string } {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const dow = now.getDay(); // 0=Sun, 1=Mon...
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now); monday.setDate(monday.getDate() + diffToMon); monday.setHours(0,0,0,0);
  const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
  const nextMonday = new Date(monday); nextMonday.setDate(nextMonday.getDate() + 7);
  const nextSunday = new Date(nextMonday); nextSunday.setDate(nextSunday.getDate() + 6);
  return {
    mondayIso:    monday.toISOString().slice(0,10),
    sundayIso:    sunday.toISOString().slice(0,10),
    nextMondayIso: nextMonday.toISOString().slice(0,10),
    nextSundayIso: nextSunday.toISOString().slice(0,10),
  };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ skipped: true, reason: 'no-admin-client' });

  const { mondayIso, sundayIso, nextMondayIso, nextSundayIso } = berlinWeekRange();

  const { data: integrations } = await admin
    .from('workspace_slack_integrations')
    .select('workspace_id, workspace_name')
    .not('webhook_url', 'is', null);

  if (!integrations?.length) return NextResponse.json({ ok: true, notified: 0 });

  let notified = 0;

  for (const { workspace_id, workspace_name } of integrations) {
    try {
      // Tasks completed this week
      const { count: completedCount } = await admin
        .from('activity_logs')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspace_id)
        .eq('kind', 'task_completed')
        .gte('created_at', mondayIso)
        .lte('created_at', sundayIso + 'T23:59:59Z');

      // Still open tasks
      const { count: openCount } = await admin
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspace_id)
        .neq('status', 'Done');

      // Events this week
      const { data: thisWeekEvents } = await admin
        .from('projects')
        .select('name, event_meta')
        .eq('workspace_id', workspace_id)
        .eq('division', 'events');
      const doneEvents = (thisWeekEvents ?? []).filter((p: any) => {
        const d = p.event_meta?.eventDate?.slice(0,10);
        return d && d >= mondayIso && d <= sundayIso;
      });

      // Events next week
      const nextWeekEvents = (thisWeekEvents ?? []).filter((p: any) => {
        const d = p.event_meta?.eventDate?.slice(0,10);
        return d && d >= nextMondayIso && d <= nextSundayIso;
      });

      // Episodes going live next week
      const { data: nextEpisodes } = await admin
        .from('podcast_episodes')
        .select('title, episode_number, guest')
        .eq('workspace_id', workspace_id)
        .eq('status', 'scheduled')
        .gte('publish_date', nextMondayIso)
        .lte('publish_date', nextSundayIso)
        .order('publish_date', { ascending: true })
        .limit(5);

      // Open blockers
      const { count: blockerCount } = await admin
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspace_id)
        .eq('status', 'Blocked');

      // Active sprint progress
      const { data: activeSprints } = await admin
        .from('sprints')
        .select('id, name, end_date')
        .eq('workspace_id', workspace_id)
        .eq('status', 'active')
        .limit(1);
      let sprintLine = '';
      if (activeSprints?.length) {
        const sp = activeSprints[0];
        const { count: spTotal } = await admin.from('tasks').select('id', { count: 'exact', head: true }).eq('sprint_id', sp.id);
        const { count: spDone  } = await admin.from('tasks').select('id', { count: 'exact', head: true }).eq('sprint_id', sp.id).eq('status', 'Done');
        sprintLine = `🏃 Sprint *${sp.name}*: ${spDone ?? 0}/${spTotal ?? 0} Tasks erledigt (endet ${sp.end_date})`;
      }

      // Top contributors this week (per-member completions)
      const { data: completions } = await admin
        .from('activity_logs')
        .select('actor_id')
        .eq('workspace_id', workspace_id)
        .eq('kind', 'task_completed')
        .gte('created_at', mondayIso)
        .lte('created_at', sundayIso + 'T23:59:59Z');
      const countByActor: Record<string, number> = {};
      (completions ?? []).forEach((c: any) => { countByActor[c.actor_id] = (countByActor[c.actor_id] ?? 0) + 1; });
      const { data: profiles } = await admin.from('profiles').select('id, display_name').in('id', Object.keys(countByActor));
      const topLines = Object.entries(countByActor)
        .sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([id, n]) => {
          const name = (profiles ?? []).find((p: any) => p.id === id)?.display_name ?? id.slice(0, 8);
          return `   • ${name}: ${n} Tasks`;
        });

      const lines: string[] = [
        `📊 *Wochenbericht — ${workspace_name ?? 'Workspace'}*`,
        `_KW ${mondayIso} – ${sundayIso}_`,
        '',
        `*Diese Woche:*`,
        `✅ ${completedCount ?? 0} Tasks erledigt`,
        openCount ? `📋 ${openCount} Tasks noch offen` : '',
        doneEvents.length ? `🎪 ${doneEvents.map((e: any) => e.name).join(', ')} stattgefunden` : '',
        blockerCount ? `⛔ ${blockerCount} Blocker offen` : '',
        sprintLine,
        topLines.length ? `*Top diese Woche:*\n${topLines.join('\n')}` : '',
        '',
      ].filter(Boolean);

      if (nextWeekEvents.length || (nextEpisodes ?? []).length) {
        lines.push('*Nächste Woche:*');
        nextWeekEvents.forEach((e: any) => lines.push(`🎪 ${e.name} (${e.event_meta?.eventDate?.slice(0,10) ?? ''})`));
        (nextEpisodes ?? []).forEach((ep: any) => {
          const num = ep.episode_number ? `Ep. ${ep.episode_number} — ` : '';
          lines.push(`🎙 ${num}${ep.title}${ep.guest ? ` mit ${ep.guest}` : ''}`);
        });
        lines.push('');
      }

      lines.push(`<${SITE_URL}|Command Center öffnen →>`);

      await postSlackNotification({
        workspaceUuid: workspace_id,
        text: lines.filter(Boolean).join('\n'),
      });

      notified++;
    } catch (e: any) {
      console.error('[weekly-report] error for', workspace_id, e?.message);
    }
  }

  console.log(`[weekly-report] sent to ${notified} workspaces`);
  return NextResponse.json({ ok: true, notified, week: mondayIso });
}
