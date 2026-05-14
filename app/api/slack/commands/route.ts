// POST /api/slack/commands
//
// Handles two Slack slash commands routed to the same endpoint:
//   /cc  <subcommand> [args]   — main entry point (Phase 1)
//   /task <text>               — legacy alias, kept for backward compat
//
// Subcommands:
//   /cc help                   — list available commands
//   /cc task <text>            — create a task
//   /cc mytasks                — list caller's open tasks
//   /cc today                  — overdue + due today + in review
//   /cc done [text]            — mark a task done by fuzzy title match
//   /cc review                 — tasks in Review status
//   /cc <unknown>              — return help
//
// Timing: Slack drops commands that don't respond in ~3s.
//   - Independent DB queries run in parallel (Promise.all).
//   - activity_log inserts are fire-and-forget.
//   - maxDuration = 10 gives the server a ceiling as buffer.
//
// Security:
//   - HMAC-SHA256 signature verified on every request.
//   - Timestamps older than 5 min rejected.
//   - No secrets or full payloads logged.

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 10;

// ── Signature verification ────────────────────────────────────────────────

function verifySlackSignature(secret: string, timestamp: string, body: string, sig: string): boolean {
  const ts = parseInt(timestamp, 10);
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const base = `v0:${timestamp}:${body}`;
  const computed = 'v0=' + createHmac('sha256', secret).update(base, 'utf8').digest('hex');
  try {
    return timingSafeEqual(Buffer.from(computed, 'utf8'), Buffer.from(sig, 'utf8'));
  } catch {
    return false;
  }
}

// ── Date parsing (German weekday names + DD.MM.YYYY) ──────────────────────

const GERMAN_DAYS: Record<string, number> = {
  montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4,
  freitag: 5, samstag: 6, sonntag: 0,
};

function parseGermanDate(raw: string): string | null {
  const s = raw.toLowerCase().trim();
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})?$/);
  if (m) {
    const year = m[3] ?? String(new Date().getFullYear());
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  if (s in GERMAN_DAYS) {
    const target = GERMAN_DAYS[s];
    const now = new Date();
    let diff = target - now.getDay();
    if (diff <= 0) diff += 7;
    const d = new Date(now);
    d.setDate(now.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

// ── Command text parser (for /cc task and /task) ──────────────────────────

function parseTaskText(text: string): {
  title: string;
  mentionedName: string | null;
  dueDate: string | null;
} {
  let remaining = text.trim();
  let mentionedName: string | null = null;
  let dueDate: string | null = null;

  const slackMention = remaining.match(/^<@([A-Z0-9]+)(?:\|([^>]+))?>\s*([\s\S]*)/);
  if (slackMention) {
    mentionedName = slackMention[2] ?? null;
    remaining = slackMention[3].trim();
  } else {
    const plainMention = remaining.match(/^@(\S+)\s+([\s\S]+)/);
    if (plainMention) {
      mentionedName = plainMention[1];
      remaining = plainMention[2].trim();
    }
  }

  const bisMatch = remaining.match(/^([\s\S]+?)\s+bis\s+(\S+)\s*$/i);
  if (bisMatch) {
    const parsed = parseGermanDate(bisMatch[2]);
    if (parsed) { dueDate = parsed; remaining = bisMatch[1].trim(); }
  }

  return { title: remaining, mentionedName, dueDate };
}

// ── Slack user → workspace profile mapping ────────────────────────────────
// profiles has no slack_user_id column. We fuzzy-match the Slack display
// name (user_name) against full_name / email in workspace_members.

async function resolveSlackUser(
  workspaceUuid: string,
  slackUserName: string,
  admin: SupabaseClient,
): Promise<{ id: string; name: string } | null> {
  const { data: members } = await admin
    .from('workspace_members')
    .select('user_id, profiles!inner(id, full_name, email)')
    .eq('workspace_id', workspaceUuid);

  const needle = slackUserName.toLowerCase();
  const match = (members ?? []).find((m: any) => {
    const full = ((m.profiles?.full_name ?? '') as string).toLowerCase();
    const email = ((m.profiles?.email ?? '') as string).toLowerCase();
    return (
      full === needle ||
      full.startsWith(needle) ||
      full.includes(needle) ||
      email.startsWith(needle + '@') ||
      email === needle
    );
  });

  if (!match) return null;
  return {
    id: match.user_id as string,
    name: ((match.profiles as any)?.full_name ?? (match.profiles as any)?.email ?? slackUserName) as string,
  };
}

// ── Date helpers ──────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function dueLabelShort(iso: string | null | undefined): string {
  if (!iso) return '';
  const today = todayStr();
  const tomorrow = tomorrowStr();
  if (iso < today) {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    return days === 1 ? ' _(1 Tag überfällig)_' : ` _(${days} Tage überfällig)_`;
  }
  if (iso === today) return ' _(heute)_';
  if (iso === tomorrow) return ' _(morgen)_';
  const parts = iso.split('-');
  return ` _(${parts[2]}.${parts[1]}.)_`;
}

// ── Response helper ───────────────────────────────────────────────────────

function slackText(text: string, status = 200) {
  return NextResponse.json({ text }, { status });
}

// ── /cc help ──────────────────────────────────────────────────────────────

function handleHelp(command: string): string {
  return [
    `*Command Center — Slash Commands* 🎛️`,
    '',
    `\`${command} task <titel>\` — neuen Task anlegen`,
    `\`${command} task @person <titel> bis Freitag\` — mit Zuweisung & Deadline`,
    `\`${command} mytasks\` — deine offenen Tasks`,
    `\`${command} today\` — überfällig · heute fällig · in Review`,
    `\`${command} done <titel>\` — Task als erledigt markieren`,
    `\`${command} review\` — Tasks im Review-Status`,
    `\`${command} help\` — diese Übersicht`,
  ].join('\n');
}

// ── /cc task (+ /task legacy) ─────────────────────────────────────────────

async function handleTask(
  text: string,
  workspaceUuid: string,
  slackUser: string,
  command: string,
  admin: SupabaseClient,
): Promise<string> {
  if (!text.trim()) {
    return `Bitte einen Task-Titel angeben.\nBeispiel: \`${command} task @tim Thumbnail-Auswahl bis Freitag\``;
  }

  const { title, mentionedName, dueDate } = parseTaskText(text);
  if (!title) return `Bitte einen Task-Titel angeben.`;

  // Parallel: members (only if @mention) + first project
  const needsMembers = !!mentionedName;
  const [membersResult, projectsResult] = await Promise.all([
    needsMembers
      ? admin.from('workspace_members').select('user_id, profiles!inner(id, full_name, email)').eq('workspace_id', workspaceUuid)
      : Promise.resolve({ data: [] as any[], error: null }),
    admin.from('projects').select('id, name').eq('workspace_id', workspaceUuid).neq('status', 'Done').order('created_at', { ascending: true }).limit(1),
  ]);

  if (!projectsResult.data?.length) {
    return '⚠️ Kein aktives Projekt gefunden. Bitte erst ein Projekt in Command Center anlegen.';
  }
  const { id: projectId, name: projectName } = projectsResult.data[0];

  let assigneeId: string | null = null;
  let assigneeName: string | null = null;
  if (needsMembers && mentionedName) {
    const needle = mentionedName.toLowerCase();
    const match = (membersResult.data ?? []).find((m: any) => {
      const name = ((m.profiles?.full_name ?? m.profiles?.email) as string | null)?.toLowerCase() ?? '';
      return name.includes(needle) || name.split(/\s+/).some((p: string) => p.startsWith(needle));
    });
    if (match) {
      assigneeId = match.user_id as string;
      assigneeName = ((match.profiles as any)?.full_name ?? (match.profiles as any)?.email) as string;
    }
  }

  const { data: task, error: taskErr } = await admin
    .from('tasks')
    .insert({ workspace_id: workspaceUuid, project_id: projectId, title, assignee_id: assigneeId, due_date: dueDate, status: 'To Do', priority: 'Medium', tags: [] })
    .select('id').single();

  if (taskErr || !task) {
    console.error('[cc/task] insert failed:', taskErr?.message);
    return '⚠️ Task konnte nicht erstellt werden. Bitte erneut versuchen.';
  }

  // Fire-and-forget activity log
  admin.from('activity_logs').insert({ workspace_id: workspaceUuid, actor_id: null, kind: 'task_created', target_type: 'task', target_id: task.id, meta: { title, source: 'slack_slash_command', slack_user: slackUser } })
    .then(({ error }) => { if (error) console.error('[cc/task] activity log failed:', error.message); });

  const lines = [`✅ Task erstellt: *${title}*`];
  if (assigneeName) lines.push(`👤 Zugewiesen an: ${assigneeName}`);
  else if (mentionedName) lines.push(`👤 @${mentionedName} nicht gefunden — nicht zugewiesen`);
  else lines.push('👤 Nicht zugewiesen');
  if (dueDate) lines.push(`📅 Fällig: ${dueDate}`);
  lines.push(`📁 Projekt: ${projectName}`);
  return lines.join('\n');
}

// ── /cc mytasks ───────────────────────────────────────────────────────────

async function handleMyTasks(
  workspaceUuid: string,
  slackUserName: string,
  admin: SupabaseClient,
): Promise<string> {
  const profile = await resolveSlackUser(workspaceUuid, slackUserName, admin);
  if (!profile) {
    return [
      `⚠️ Dein Slack-Name \`${slackUserName}\` konnte keinem Command Center Profil zugeordnet werden.`,
      `Stell sicher, dass dein Anzeigename in Slack mit deinem Namen in Command Center übereinstimmt.`,
    ].join('\n');
  }

  const { data: tasks, error } = await admin
    .from('tasks')
    .select('id, title, status, due_date')
    .eq('workspace_id', workspaceUuid)
    .eq('assignee_id', profile.id)
    .neq('status', 'Done')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(10);

  if (error) { console.error('[cc/mytasks] query failed:', error.message); return '⚠️ Datenbankfehler.'; }
  if (!tasks?.length) return `✅ *${profile.name}* hat keine offenen Tasks.`;

  const lines = [`📋 *Offene Tasks von ${profile.name}* (${tasks.length})`, ''];
  for (const t of tasks) {
    const due = dueLabelShort(t.due_date);
    const status = t.status !== 'To Do' ? ` [${t.status}]` : '';
    lines.push(`• ${t.title}${status}${due}`);
  }
  return lines.join('\n');
}

// ── /cc today ─────────────────────────────────────────────────────────────

async function handleToday(workspaceUuid: string, admin: SupabaseClient): Promise<string> {
  const today = todayStr();

  const [overdueResult, todayResult, reviewResult] = await Promise.all([
    admin.from('tasks').select('id, title, status, due_date, profiles!assignee_id(full_name, email)')
      .eq('workspace_id', workspaceUuid).lt('due_date', today).neq('status', 'Done')
      .order('due_date', { ascending: true }).limit(10),
    admin.from('tasks').select('id, title, status, due_date, profiles!assignee_id(full_name, email)')
      .eq('workspace_id', workspaceUuid).eq('due_date', today).neq('status', 'Done')
      .order('created_at', { ascending: true }).limit(10),
    admin.from('tasks').select('id, title, status, due_date, profiles!assignee_id(full_name, email)')
      .eq('workspace_id', workspaceUuid).eq('status', 'Review')
      .order('created_at', { ascending: false }).limit(10),
  ]);

  const lines: string[] = [`📅 *Heute — ${today}*`, ''];

  const overdue = overdueResult.data ?? [];
  lines.push(`*Überfällig (${overdue.length})*`);
  if (!overdue.length) lines.push('_Keine_');
  else overdue.forEach(t => {
    const who = (t as any).profiles?.full_name ?? (t as any).profiles?.email ?? '';
    lines.push(`• ${t.title}${dueLabelShort(t.due_date)}${who ? ` — ${who}` : ''}`);
  });
  lines.push('');

  const dueToday = todayResult.data ?? [];
  lines.push(`*Heute fällig (${dueToday.length})*`);
  if (!dueToday.length) lines.push('_Keine_');
  else dueToday.forEach(t => {
    const who = (t as any).profiles?.full_name ?? (t as any).profiles?.email ?? '';
    lines.push(`• ${t.title} [${t.status}]${who ? ` — ${who}` : ''}`);
  });
  lines.push('');

  const review = reviewResult.data ?? [];
  lines.push(`*In Review (${review.length})*`);
  if (!review.length) lines.push('_Keine_');
  else review.forEach(t => {
    const who = (t as any).profiles?.full_name ?? (t as any).profiles?.email ?? '';
    lines.push(`• ${t.title}${who ? ` — ${who}` : ''}`);
  });

  return lines.join('\n');
}

// ── /cc done ──────────────────────────────────────────────────────────────

async function handleDone(
  text: string,
  workspaceUuid: string,
  slackUserName: string,
  command: string,
  admin: SupabaseClient,
): Promise<string> {
  if (!text.trim()) {
    return `Bitte einen Task-Titel angeben.\nBeispiel: \`${command} done Thumbnail Ep. 5\``;
  }

  const needle = text.trim().toLowerCase();

  // Resolve caller — search own tasks first, then all workspace tasks
  const profile = await resolveSlackUser(workspaceUuid, slackUserName, admin);

  const { data: tasks, error } = await admin
    .from('tasks')
    .select('id, title, status, assignee_id')
    .eq('workspace_id', workspaceUuid)
    .neq('status', 'Done')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) { console.error('[cc/done] query failed:', error.message); return '⚠️ Datenbankfehler.'; }
  if (!tasks?.length) return 'Keine offenen Tasks im Workspace.';

  // Prefer tasks assigned to the caller; fall back to workspace-wide match
  const candidates = (tasks as any[]);
  const myTasks = profile ? candidates.filter(t => t.assignee_id === profile.id) : [];

  function bestMatch(list: any[]): any | null {
    return list.find(t => t.title.toLowerCase().includes(needle)) ?? null;
  }

  const match = bestMatch(myTasks) ?? bestMatch(candidates);
  if (!match) return `❌ Kein offener Task gefunden der \`${text}\` enthält.`;

  const { error: updateErr } = await admin
    .from('tasks')
    .update({ status: 'Done' })
    .eq('id', match.id)
    .eq('workspace_id', workspaceUuid);

  if (updateErr) { console.error('[cc/done] update failed:', updateErr.message); return '⚠️ Status konnte nicht geändert werden.'; }

  // Fire-and-forget activity log
  admin.from('activity_logs').insert({ workspace_id: workspaceUuid, actor_id: null, kind: 'task_completed', target_type: 'task', target_id: match.id, meta: { from: match.status, source: 'slack_slash_command', slack_user: slackUserName } })
    .then(({ error: e }) => { if (e) console.error('[cc/done] activity log failed:', e.message); });

  return `✅ *${match.title}* als erledigt markiert.`;
}

// ── /cc review ────────────────────────────────────────────────────────────

async function handleReview(workspaceUuid: string, admin: SupabaseClient): Promise<string> {
  const { data: tasks, error } = await admin
    .from('tasks')
    .select('id, title, due_date, profiles!assignee_id(full_name, email)')
    .eq('workspace_id', workspaceUuid)
    .eq('status', 'Review')
    .order('created_at', { ascending: false })
    .limit(15);

  if (error) { console.error('[cc/review] query failed:', error.message); return '⚠️ Datenbankfehler.'; }
  if (!tasks?.length) return '👀 Keine Tasks aktuell in Review.';

  const lines = [`👀 *Tasks in Review (${tasks.length})*`, ''];
  for (const t of tasks as any[]) {
    const who = t.profiles?.full_name ?? t.profiles?.email ?? 'Unzugewiesen';
    const due = dueLabelShort(t.due_date);
    lines.push(`• ${t.title} — ${who}${due}`);
  }
  return lines.join('\n');
}

// ── Main route handler ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error('[slack/commands] SLACK_SIGNING_SECRET not set');
    return slackText('⚠️ Server misconfiguration.', 500);
  }

  const rawBody = await req.text();
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? '';
  const signature = req.headers.get('x-slack-signature') ?? '';

  if (!verifySlackSignature(signingSecret, timestamp, rawBody, signature)) {
    console.warn('[slack/commands] signature rejected');
    return slackText('Unauthorized.', 401);
  }

  const params   = new URLSearchParams(rawBody);
  const command  = params.get('command')   ?? '/cc';   // '/cc' or '/task'
  const text     = (params.get('text')     ?? '').trim();
  const teamId   = params.get('team_id')   ?? '';
  const userName = params.get('user_name') ?? 'unknown';

  const admin = createAdminClient();
  if (!admin) {
    console.error('[slack/commands] admin client not configured');
    return slackText('⚠️ Datenbankverbindung nicht konfiguriert.', 500);
  }

  // Map Slack team → workspace UUID
  const { data: integration, error: intErr } = await admin
    .from('slack_integrations')
    .select('workspace_id')
    .eq('team_id', teamId)
    .eq('is_active', true)
    .maybeSingle();

  if (intErr) {
    console.error('[slack/commands] integration lookup failed:', intErr.message);
    return slackText('⚠️ Datenbankfehler beim Workspace-Lookup.', 500);
  }
  if (!integration?.workspace_id) {
    return slackText(`⚠️ Slack-Workspace nicht verbunden. Team ID: \`${teamId}\``);
  }
  const workspaceUuid = integration.workspace_id as string;

  // /task <text>  →  treat as /cc task <text>
  const isLegacyTask = command === '/task';

  // Parse subcommand
  const [subRaw, ...restParts] = text.split(/\s+/);
  const sub  = isLegacyTask ? 'task' : (subRaw ?? '').toLowerCase();
  const rest = isLegacyTask ? text : restParts.join(' ').trim();

  let responseText: string;

  switch (sub) {
    case 'task':
      responseText = await handleTask(rest, workspaceUuid, userName, command, admin);
      break;
    case 'mytasks':
      responseText = await handleMyTasks(workspaceUuid, userName, admin);
      break;
    case 'today':
      responseText = await handleToday(workspaceUuid, admin);
      break;
    case 'done':
      responseText = await handleDone(rest, workspaceUuid, userName, command, admin);
      break;
    case 'review':
      responseText = await handleReview(workspaceUuid, admin);
      break;
    case 'help':
    default:
      responseText = handleHelp(command === '/task' ? '/task' : '/cc');
  }

  console.log(`[slack/commands] ${command} ${sub} — ${Date.now() - t0}ms — user=${userName}`);
  return slackText(responseText);
}
