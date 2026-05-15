// GET /api/cron/daily-digest
//
// Vercel Cron — Mon–Fri at 07:00 UTC.
//   07:00 UTC = 09:00 CEST (summer, UTC+2) — exact target
//   07:00 UTC = 08:00 CET  (winter, UTC+1) — 1 h early, acceptable
// Configured in vercel.json: schedule "0 7 * * 1-5"
//
// For every workspace with an active Slack integration, sends one morning
// digest: overdue tasks, due today, high priority, in review, active
// projects, upcoming podcast episodes.
//
// Security: Vercel adds `Authorization: Bearer <CRON_SECRET>` automatically.
// Without CRON_SECRET set the route returns 401 for every caller.
// Manual test: npm run test:daily-digest (see scripts/test-daily-digest.mjs)

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { postSlackNotification } from '@/lib/integrations/slack';

export const dynamic = 'force-dynamic';
export const runtime  = 'nodejs';

const SITE_URL = 'https://team.unicornbakery.de';
const TOP_N    = 5;

// ── Auth ──────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/digest] CRON_SECRET not set — route disabled');
    return false;
  }
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

// ── Timezone helpers ──────────────────────────────────────────────────────

/** Today's date in Europe/Berlin as YYYY-MM-DD. */
function berlinToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${m.year}-${m.month}-${m.day}`;
}

/** Long German date for the digest headline. */
function berlinDateLong(isoDate: string): string {
  // Use noon UTC to avoid any date-shift at Berlin midnight boundaries.
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

function daysOverdue(dueDateIso: string, todayIso: string): number {
  return Math.floor(
    (new Date(`${todayIso}T00:00:00Z`).getTime() -
     new Date(`${dueDateIso}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

// ── Types ─────────────────────────────────────────────────────────────────

interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  project_id: string;
  assigneeName: string;
}

interface ProjectRow {
  id: string;
  name: string;
  status: string;
  openTaskCount: number;
}

interface EpisodeRow {
  title: string;
  episodeNumber: number | null;
  publishDate: string | null;
  guest: string | null;
}

// ── Message builder ───────────────────────────────────────────────────────

function cap<T>(arr: T[]): { items: T[]; more: number } {
  return { items: arr.slice(0, TOP_N), more: Math.max(0, arr.length - TOP_N) };
}

function moreLine(n: number): string {
  return `  _…und ${n} weitere_`;
}

function buildDigest(
  workspaceName: string,
  today: string,
  tasks: TaskRow[],
  projects: ProjectRow[],
  episodes: EpisodeRow[],
): string {
  const overdue  = tasks.filter((t) => t.due_date && t.due_date < today);
  const dueToday = tasks.filter((t) => t.due_date === today);
  const highPrio = tasks.filter(
    (t) => t.priority === 'High' && t.due_date !== today && !(t.due_date && t.due_date < today),
  );
  const inReview = tasks.filter((t) => t.status === 'Review');

  const hasCritical = overdue.length || dueToday.length || highPrio.length || inReview.length;

  const lines: string[] = [
    `<!here> 🌅 *Daily Digest — ${berlinDateLong(today)}*`,
    `*${workspaceName}*`,
    '',
  ];

  if (!hasCritical) {
    lines.push('✅ *Keine kritischen Tasks heute.* Keep the momentum! 🚀');
    lines.push('');
  } else {
    // Due today
    if (dueToday.length) {
      const { items, more } = cap(dueToday);
      lines.push(`📅 *Heute fällig* (${dueToday.length})`);
      for (const t of items) lines.push(`• ${t.title} [${t.priority}] — ${t.assigneeName}`);
      if (more) lines.push(moreLine(more));
      lines.push('');
    }

    // Overdue
    if (overdue.length) {
      const { items, more } = cap(overdue);
      lines.push(`⏰ *Überfällig* (${overdue.length})`);
      for (const t of items) {
        const n    = daysOverdue(t.due_date!, today);
        const late = n === 1 ? '1 Tag' : `${n} Tage`;
        lines.push(`• ${t.title} _(${late})_ — ${t.assigneeName}`);
      }
      if (more) lines.push(moreLine(more));
      lines.push('');
    }

    // High priority (not already in overdue / due today)
    if (highPrio.length) {
      const { items, more } = cap(highPrio);
      lines.push(`🔴 *Hohe Priorität* (${highPrio.length})`);
      for (const t of items) lines.push(`• ${t.title} [${t.status}] — ${t.assigneeName}`);
      if (more) lines.push(moreLine(more));
      lines.push('');
    }

    // In Review
    if (inReview.length) {
      const { items, more } = cap(inReview);
      lines.push(`👀 *In Review* (${inReview.length})`);
      for (const t of items) lines.push(`• ${t.title} — ${t.assigneeName}`);
      if (more) lines.push(moreLine(more));
      lines.push('');
    }
  }

  // Active projects with open tasks
  const activeProjects = projects.filter((p) => p.status !== 'Done' && p.openTaskCount > 0);
  if (activeProjects.length) {
    const { items, more } = cap(activeProjects);
    lines.push(`📁 *Aktive Projekte* (${activeProjects.length})`);
    for (const p of items) lines.push(`• ${p.name}: ${p.openTaskCount} offene ${p.openTaskCount === 1 ? 'Task' : 'Tasks'}`);
    if (more) lines.push(moreLine(more));
    lines.push('');
  }

  // Upcoming podcast episodes (scheduled, within 14 days)
  if (episodes.length) {
    const { items, more } = cap(episodes);
    lines.push(`🎙️ *Nächste Episoden*`);
    for (const e of items) {
      const num  = e.episodeNumber != null ? `Ep. ${e.episodeNumber} — ` : '';
      const guest = e.guest ? ` mit ${e.guest}` : '';
      const date  = e.publishDate ? ` _(${e.publishDate})_` : '';
      lines.push(`• ${num}${e.title}${guest}${date}`);
    }
    if (more) lines.push(moreLine(more));
    lines.push('');
  }

  lines.push(`🔗 <${SITE_URL}|Command Center öffnen>`);

  return lines.join('\n');
}

// ── Handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    console.error('[cron/digest] admin client not configured');
    return NextResponse.json({ error: 'admin client not configured' }, { status: 500 });
  }

  const today = berlinToday();

  // Diagnostic: log which Supabase project this function is connecting to.
  // NEXT_PUBLIC_SUPABASE_URL is already public (embedded in the client bundle).
  const supabaseRef = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    .replace('https://', '').split('.')[0];
  console.log(`[cron/digest] supabase project ref: ${supabaseRef}`);

  // 1. Active Slack integrations
  // Diagnostic: count ALL rows (ignoring is_active) to detect RLS filtering.
  const { count: totalRows } = await admin
    .from('slack_integrations')
    .select('*', { count: 'exact', head: true });
  console.log(`[cron/digest] slack_integrations total rows visible: ${totalRows}`);

  const { data: integrations, error: intErr } = await admin
    .from('slack_integrations')
    .select('workspace_id')
    .eq('is_active', true);

  if (intErr) {
    console.error('[cron/digest] integration lookup failed:', intErr.message);
    return NextResponse.json({ error: intErr.message }, { status: 500 });
  }

  if (!integrations?.length) {
    console.log('[cron/digest] no active Slack integrations — nothing to do');
    return NextResponse.json({ ok: true, today, workspaces: 0, notified: 0 });
  }

  let notified = 0;
  const results: { workspace_id: string; workspace_name: string; status: string; tasks?: number }[] = [];

  for (const { workspace_id } of integrations) {
    try {
      // 2. Workspace name
      const { data: ws } = await admin
        .from('workspaces')
        .select('name')
        .eq('id', workspace_id)
        .maybeSingle();
      const workspaceName = (ws?.name as string | null) ?? workspace_id;

      // 3. All open tasks with assignee profile (single query, filter in memory)
      const { data: rawTasks, error: taskErr } = await admin
        .from('tasks')
        .select('id, title, status, priority, due_date, project_id, assignee_id, profiles!assignee_id(full_name, email)')
        .eq('workspace_id', workspace_id)
        .neq('status', 'Done')
        .order('due_date', { ascending: true, nullsFirst: false });

      if (taskErr) {
        console.error('[cron/digest] task query failed', workspace_id, taskErr.message);
        results.push({ workspace_id, workspace_name: workspaceName, status: 'task_query_failed' });
        continue;
      }

      const tasks: TaskRow[] = (rawTasks ?? []).map((t: any) => ({
        id:           t.id,
        title:        t.title,
        status:       t.status,
        priority:     t.priority,
        due_date:     t.due_date ?? null,
        project_id:   t.project_id,
        assigneeName: t.profiles
          ? ((t.profiles.full_name ?? t.profiles.email) as string | null) ?? 'Unbekannt'
          : 'Nicht zugewiesen',
      }));

      // 4. Active projects (open task counts derived from task list above)
      const { data: rawProjects } = await admin
        .from('projects')
        .select('id, name, status')
        .eq('workspace_id', workspace_id)
        .neq('status', 'Done');

      const tasksByProject: Record<string, number> = {};
      for (const t of tasks) tasksByProject[t.project_id] = (tasksByProject[t.project_id] ?? 0) + 1;

      const projects: ProjectRow[] = (rawProjects ?? [])
        .map((p: any) => ({
          id:            p.id,
          name:          p.name,
          status:        p.status,
          openTaskCount: tasksByProject[p.id] ?? 0,
        }))
        .sort((a, b) => b.openTaskCount - a.openTaskCount);

      // 5. Upcoming podcast episodes (scheduled, within 14 days)
      const inTwoWeeksIso = (() => {
        const d = new Date();
        d.setDate(d.getDate() + 14);
        return d.toISOString().slice(0, 10);
      })();

      const { data: rawEpisodes } = await admin
        .from('podcast_episodes')
        .select('title, episode_number, publish_date, guest')
        .eq('workspace_id', workspace_id)
        .eq('status', 'scheduled')
        .gte('publish_date', today)
        .lte('publish_date', inTwoWeeksIso)
        .order('publish_date', { ascending: true })
        .limit(TOP_N);

      const episodes: EpisodeRow[] = (rawEpisodes ?? []).map((e: any) => ({
        title:         e.title,
        episodeNumber: e.episode_number ?? null,
        publishDate:   e.publish_date ?? null,
        guest:         e.guest ?? null,
      }));

      // 6. Build message and send
      const text = buildDigest(workspaceName, today, tasks, projects, episodes);
      await postSlackNotification({ workspaceUuid: workspace_id, text, channelLabel: 'daily-digest' });

      console.log(`[cron/digest] sent for workspace "${workspaceName}": ${tasks.length} open tasks`);
      notified++;
      results.push({ workspace_id, workspace_name: workspaceName, status: 'sent', tasks: tasks.length });
    } catch (err: any) {
      console.error('[cron/digest] unexpected error for workspace', workspace_id, err?.message ?? err);
      results.push({ workspace_id, workspace_name: workspace_id, status: 'error' });
    }
  }

  return NextResponse.json({ ok: true, today, supabaseRef, slackIntegrationsTotal: totalRows, workspaces: integrations.length, notified, results });
}
