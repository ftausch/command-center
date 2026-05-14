// GET /api/cron/overdue-reminder
//
// Vercel Cron Job — runs daily at 08:00 UTC (≈ 10:00 CEST / 09:00 CET).
// Configured in vercel.json.
//
// For every workspace with an active Slack integration, sends one message
// listing all overdue tasks (due_date < today, status ≠ Done), grouped by
// project and sorted by how late they are.
//
// Security:
//   Vercel automatically adds `Authorization: Bearer <CRON_SECRET>` to every
//   cron invocation. We verify this so the route can't be triggered from
//   outside Vercel. Without CRON_SECRET the route is disabled entirely.
//
// All DB access uses the admin client (no user session in a cron context).

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { postSlackNotification } from '@/lib/integrations/slack';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── Auth ──────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/overdue] CRON_SECRET not set — route disabled');
    return false;
  }
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

// ── Date helpers ──────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysOverdue(dueDateIso: string, todayIso: string): number {
  return Math.floor(
    (new Date(todayIso).getTime() - new Date(dueDateIso).getTime()) / 86_400_000,
  );
}

function formatDateDE(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ── Slack message builder ─────────────────────────────────────────────────

interface TaskRow {
  id: string;
  title: string;
  due_date: string;
  project_id: string;
  assignee_id: string | null;
}

function buildMessage(
  tasks: TaskRow[],
  projectMap: Record<string, string>,
  profileMap: Record<string, string>,
  today: string,
): string {
  // Group tasks by project name, sorted most-overdue first within each group.
  const byProject: Record<string, TaskRow[]> = {};
  for (const task of tasks) {
    const key = projectMap[task.project_id] ?? 'Ohne Projekt';
    (byProject[key] = byProject[key] ?? []).push(task);
  }

  const lines: string[] = [
    `⏰ *Überfällige Tasks — ${formatDateDE(today)}*\n`,
  ];

  for (const [project, ptasks] of Object.entries(byProject)) {
    lines.push(`📁 *${project}*`);
    for (const task of ptasks) {
      const assignee = task.assignee_id
        ? (profileMap[task.assignee_id] ?? 'Unbekannt')
        : 'Nicht zugewiesen';
      const n = daysOverdue(task.due_date, today);
      const late = n === 1 ? '1 Tag überfällig' : `${n} Tage überfällig`;
      lines.push(`• *${assignee}* — ${task.title} _(${late})_`);
    }
    lines.push('');
  }

  const count = tasks.length;
  lines.push(
    `_Gesamt: ${count} überfällige ${count === 1 ? 'Task' : 'Tasks'}_`,
  );

  return lines.join('\n');
}

// ── Handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    console.error('[cron/overdue] admin client not configured');
    return NextResponse.json({ error: 'admin client not configured' }, { status: 500 });
  }

  const today = todayIso();

  // 1. Find all workspaces with an active Slack integration.
  const { data: integrations, error: intErr } = await admin
    .from('slack_integrations')
    .select('workspace_id')
    .eq('is_active', true);

  if (intErr) {
    console.error('[cron/overdue] integration lookup failed', intErr.message);
    return NextResponse.json({ error: intErr.message }, { status: 500 });
  }

  if (!integrations?.length) {
    console.log('[cron/overdue] no active Slack integrations — nothing to do');
    return NextResponse.json({ ok: true, workspaces: 0, notified: 0 });
  }

  let notified = 0;

  for (const { workspace_id } of integrations) {
    // 2. Fetch overdue tasks for this workspace.
    const { data: tasks, error: taskErr } = await admin
      .from('tasks')
      .select('id, title, due_date, project_id, assignee_id')
      .eq('workspace_id', workspace_id)
      .lt('due_date', today)
      .neq('status', 'Done')
      .order('due_date', { ascending: true });

    if (taskErr) {
      console.error('[cron/overdue] task query failed', workspace_id, taskErr.message);
      continue;
    }
    if (!tasks?.length) {
      console.log('[cron/overdue] no overdue tasks for workspace', workspace_id);
      continue;
    }

    // 3. Batch-fetch project names.
    const projectIds = [...new Set(tasks.map((t) => t.project_id))];
    const { data: projects } = await admin
      .from('projects')
      .select('id, name')
      .in('id', projectIds);
    const projectMap: Record<string, string> = {};
    for (const p of projects ?? []) projectMap[p.id] = p.name;

    // 4. Batch-fetch assignee display names.
    const assigneeIds = [
      ...new Set(tasks.map((t) => t.assignee_id).filter(Boolean) as string[]),
    ];
    const profileMap: Record<string, string> = {};
    if (assigneeIds.length) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', assigneeIds);
      for (const p of profiles ?? []) {
        profileMap[p.id] = (p.full_name ?? p.email ?? p.id) as string;
      }
    }

    // 5. Send Slack message.
    const text = buildMessage(tasks as TaskRow[], projectMap, profileMap, today);
    await postSlackNotification({
      workspaceUuid: workspace_id,
      text,
      channelLabel: 'overdue-reminder',
    });

    console.log(`[cron/overdue] sent reminder for workspace ${workspace_id}: ${tasks.length} tasks`);
    notified++;
  }

  return NextResponse.json({
    ok: true,
    workspaces: integrations.length,
    notified,
  });
}
