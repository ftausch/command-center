// POST /api/slack/commands
//
// Handles /cc and /task Slack slash commands.
//
// Phase 1 subcommands:
//   help · task · mytasks · today · done · review
//
// Phase 2 subcommands:
//   search · status · assign · comment · project
//
// /task <text> is kept as a backward-compatible alias for /cc task.
//
// Timing: Slack drops commands that don't respond in ~3s.
//   - Independent DB queries run in parallel (Promise.all).
//   - activity_log inserts are fire-and-forget.
//   - maxDuration = 10 gives the server a ceiling.
//
// Security: HMAC-SHA256 signature + 5-min timestamp window on every request.
// No secrets, tokens, or full payloads are logged.

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 10;

// ── Types ─────────────────────────────────────────────────────────────────

interface SlackProfile {
  id: string;
  name: string;
  role: string; // workspace role: viewer|member|manager|admin|owner
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  assignee_id: string | null;
  project_id: string;
}

// ── Signature verification ────────────────────────────────────────────────

function verifySlackSignature(secret: string, timestamp: string, body: string, sig: string): boolean {
  const ts = parseInt(timestamp, 10);
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const base = `v0:${timestamp}:${body}`;
  const computed = 'v0=' + createHmac('sha256', secret).update(base, 'utf8').digest('hex');
  try {
    return timingSafeEqual(Buffer.from(computed, 'utf8'), Buffer.from(sig, 'utf8'));
  } catch { return false; }
}

// ── Role helpers ──────────────────────────────────────────────────────────

const ROLE_LEVELS: Record<string, number> = { viewer: 0, member: 1, manager: 2, admin: 3, owner: 4 };

function roleAtLeast(role: string, min: string): boolean {
  return (ROLE_LEVELS[role?.toLowerCase()] ?? 0) >= (ROLE_LEVELS[min] ?? 0);
}

// ── Date helpers ──────────────────────────────────────────────────────────

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

function todayStr() { return new Date().toISOString().slice(0, 10); }
function tomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }

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

// ── Status aliases ────────────────────────────────────────────────────────

const STATUS_ALIASES: Record<string, string> = {
  'todo': 'To Do', 'to-do': 'To Do', 'to do': 'To Do', 'open': 'To Do', 'offen': 'To Do', 'neu': 'To Do',
  'progress': 'In Progress', 'in-progress': 'In Progress', 'in progress': 'In Progress',
  'doing': 'In Progress', 'wip': 'In Progress', 'aktiv': 'In Progress', 'läuft': 'In Progress',
  'review': 'Review', 'prüfung': 'Review', 'check': 'Review', 'prüfen': 'Review',
  'done': 'Done', 'erledigt': 'Done', 'complete': 'Done', 'fertig': 'Done', 'abgeschlossen': 'Done',
  'backlog': 'Backlog',
  'blocked': 'Blocked', 'blockiert': 'Blocked', 'block': 'Blocked',
};

function resolveStatus(raw: string): string | null {
  return STATUS_ALIASES[raw.toLowerCase().trim()] ?? null;
}

// ── Slack response helper ─────────────────────────────────────────────────

function slackText(text: string, status = 200) {
  return NextResponse.json({ text }, { status });
}

// ── Slack user → workspace profile + role ─────────────────────────────────
// profiles has no slack_user_id. Fuzzy-match user_name against full_name/email.

async function resolveSlackUserWithRole(
  workspaceUuid: string,
  slackUserName: string,
  admin: SupabaseClient,
): Promise<SlackProfile | null> {
  const { data: members } = await admin
    .from('workspace_members')
    .select('user_id, role, profiles!inner(id, full_name, email)')
    .eq('workspace_id', workspaceUuid);

  const needle = slackUserName.toLowerCase();
  const match = (members ?? []).find((m: any) => {
    const full  = ((m.profiles?.full_name ?? '') as string).toLowerCase();
    const email = ((m.profiles?.email ?? '') as string).toLowerCase();
    return full === needle || full.startsWith(needle) || full.includes(needle) ||
           email.startsWith(needle + '@') || email === needle;
  });

  if (!match) return null;
  return {
    id:   match.user_id as string,
    name: ((match.profiles as any)?.full_name ?? (match.profiles as any)?.email ?? slackUserName) as string,
    role: (match.role as string) ?? 'viewer',
  };
}

// Simpler version without role (for read-only commands)
async function resolveSlackUser(
  workspaceUuid: string,
  slackUserName: string,
  admin: SupabaseClient,
): Promise<{ id: string; name: string } | null> {
  return resolveSlackUserWithRole(workspaceUuid, slackUserName, admin);
}

// ── Resolve a @mention string to a workspace profile ─────────────────────

async function resolveMentionedUser(
  workspaceUuid: string,
  mentionedName: string,
  admin: SupabaseClient,
): Promise<{ id: string; name: string } | null> {
  const { data: members } = await admin
    .from('workspace_members')
    .select('user_id, profiles!inner(id, full_name, email)')
    .eq('workspace_id', workspaceUuid);

  const needle = mentionedName.toLowerCase();
  const match = (members ?? []).find((m: any) => {
    const name = ((m.profiles?.full_name ?? m.profiles?.email) as string | null)?.toLowerCase() ?? '';
    return name.includes(needle) || name.split(/\s+/).some((p: string) => p.startsWith(needle));
  });

  if (!match) return null;
  return {
    id:   match.user_id as string,
    name: ((match.profiles as any)?.full_name ?? (match.profiles as any)?.email) as string,
  };
}

// ── Task matching ─────────────────────────────────────────────────────────
// Returns all workspace open tasks that contain `needle` in their title.
// Fetches from DB, returns typed rows.

async function findMatchingTasks(
  workspaceUuid: string,
  needle: string,
  admin: SupabaseClient,
  includeNonOpen = false,
): Promise<TaskRow[]> {
  let q = admin
    .from('tasks')
    .select('id, title, status, due_date, assignee_id, project_id')
    .eq('workspace_id', workspaceUuid)
    .ilike('title', `%${needle}%`)
    .order('created_at', { ascending: false })
    .limit(10);
  if (!includeNonOpen) q = q.neq('status', 'Done');
  const { data } = await q;
  return (data ?? []) as TaskRow[];
}

// Project matching
async function findMatchingProjects(
  workspaceUuid: string,
  needle: string,
  admin: SupabaseClient,
): Promise<any[]> {
  const { data } = await admin
    .from('projects')
    .select('id, name, status, progress, due_date, owner_id')
    .eq('workspace_id', workspaceUuid)
    .ilike('name', `%${needle}%`)
    .order('created_at', { ascending: false })
    .limit(10);
  return data ?? [];
}

// ── Task text parser ──────────────────────────────────────────────────────

function parseTaskText(text: string): { title: string; mentionedName: string | null; dueDate: string | null } {
  let remaining = text.trim();
  let mentionedName: string | null = null;
  let dueDate: string | null = null;

  const slackMention = remaining.match(/^<@([A-Z0-9]+)(?:\|([^>]+))?>\s*([\s\S]*)/);
  if (slackMention) {
    mentionedName = slackMention[2] ?? null;
    remaining = slackMention[3].trim();
  } else {
    const plainMention = remaining.match(/^@(\S+)\s+([\s\S]+)/);
    if (plainMention) { mentionedName = plainMention[1]; remaining = plainMention[2].trim(); }
  }

  const bisMatch = remaining.match(/^([\s\S]+?)\s+bis\s+(\S+)\s*$/i);
  if (bisMatch) {
    const parsed = parseGermanDate(bisMatch[2]);
    if (parsed) { dueDate = parsed; remaining = bisMatch[1].trim(); }
  }
  return { title: remaining, mentionedName, dueDate };
}

// Extract trailing @mention from end of text.
// "/cc assign Task Title @malik" → { taskText: "Task Title", mentionedName: "malik" }
function extractTrailingMention(text: string): { taskText: string; mentionedName: string | null } {
  const trailing = text.match(/^([\s\S]+?)\s+<@([A-Z0-9]+)(?:\|([^>]+))?>$/);
  if (trailing) return { taskText: trailing[1].trim(), mentionedName: trailing[3] ?? null };
  const plain = text.match(/^([\s\S]+?)\s+@(\S+)$/);
  if (plain) return { taskText: plain[1].trim(), mentionedName: plain[2] };
  return { taskText: text, mentionedName: null };
}

// Extract status from end of text.
// "/cc status Task Title review" → { taskText: "Task Title", status: "Review" }
function extractTrailingStatus(text: string): { taskText: string; status: string | null } {
  const words = text.trim().split(/\s+/);

  // Try last 2 words as status (e.g. "in progress")
  if (words.length >= 3) {
    const twoWord = words.slice(-2).join(' ');
    const resolved = resolveStatus(twoWord);
    if (resolved) return { taskText: words.slice(0, -2).join(' '), status: resolved };
  }
  // Try last 1 word as status
  if (words.length >= 2) {
    const oneWord = words[words.length - 1];
    const resolved = resolveStatus(oneWord);
    if (resolved) return { taskText: words.slice(0, -1).join(' '), status: resolved };
  }
  return { taskText: text, status: null };
}

// Greedy comment split: find the longest prefix that matches a task title,
// remainder is the comment. Requires tasks to be pre-fetched.
function splitTaskComment(text: string, tasks: TaskRow[]): { task: TaskRow; comment: string } | null {
  const words = text.trim().split(/\s+/);
  // Try decreasing prefix lengths (min 1 word for task, min 1 word for comment)
  for (let n = Math.min(words.length - 1, 8); n >= 1; n--) {
    const prefix = words.slice(0, n).join(' ').toLowerCase();
    const matches = tasks.filter(t => t.title.toLowerCase().includes(prefix));
    if (matches.length === 1) {
      const comment = words.slice(n).join(' ').trim();
      if (comment) return { task: matches[0], comment };
    }
  }
  return null;
}

// ── /cc help ──────────────────────────────────────────────────────────────

function handleHelp(cmd: string): string {
  return [
    `*Command Center — Slash Commands* 🎛️`,
    '',
    `*Tasks erstellen & suchen*`,
    `\`${cmd} task <titel>\` — neuen Task anlegen`,
    `\`${cmd} task @person <titel> bis Freitag\` — mit Zuweisung & Deadline`,
    `\`${cmd} search <suche>\` — Tasks und Projekte durchsuchen`,
    '',
    `*Task-Übersichten*`,
    `\`${cmd} mytasks\` — deine offenen Tasks`,
    `\`${cmd} today\` — überfällig · heute fällig · in Review`,
    `\`${cmd} review\` — Tasks im Review-Status`,
    '',
    `*Tasks bearbeiten*`,
    `\`${cmd} status <titel> <status>\` — Status ändern`,
    `\`${cmd} assign <titel> @person\` — Task zuweisen`,
    `\`${cmd} comment <titel> <kommentar>\` — Kommentar hinzufügen`,
    `\`${cmd} done <titel>\` — Task als erledigt markieren`,
    '',
    `*Projekte*`,
    `\`${cmd} project <name>\` — neues Projekt anlegen`,
    `\`${cmd} project status <name>\` — Projekt-Status ansehen`,
    '',
    `Status-Aliase: \`todo\` · \`progress\` · \`review\` · \`done\` · \`backlog\` · \`blocked\``,
  ].join('\n');
}

// ── /cc task ─────────────────────────────────────────────────────────────

async function handleTask(
  text: string, workspaceUuid: string, slackUser: string, cmd: string, admin: SupabaseClient,
): Promise<string> {
  if (!text.trim()) return `Beispiel: \`${cmd} task @tim Thumbnail bis Freitag\``;

  const { title, mentionedName, dueDate } = parseTaskText(text);
  if (!title) return 'Bitte einen Task-Titel angeben.';

  const needsMembers = !!mentionedName;
  const [membersRes, projectsRes] = await Promise.all([
    needsMembers
      ? admin.from('workspace_members').select('user_id, profiles!inner(id, full_name, email)').eq('workspace_id', workspaceUuid)
      : Promise.resolve({ data: [] as any[] }),
    admin.from('projects').select('id, name').eq('workspace_id', workspaceUuid).neq('status', 'Done').order('created_at', { ascending: true }).limit(1),
  ]);

  if (!projectsRes.data?.length) return '⚠️ Kein aktives Projekt. Bitte zuerst ein Projekt in Command Center anlegen.';
  const { id: projectId, name: projectName } = projectsRes.data[0];

  let assigneeId: string | null = null;
  let assigneeName: string | null = null;
  if (needsMembers && mentionedName) {
    const needle = mentionedName.toLowerCase();
    const match = (membersRes.data ?? []).find((m: any) => {
      const name = ((m.profiles?.full_name ?? m.profiles?.email) as string | null)?.toLowerCase() ?? '';
      return name.includes(needle) || name.split(/\s+/).some((p: string) => p.startsWith(needle));
    });
    if (match) {
      assigneeId = match.user_id as string;
      assigneeName = ((match.profiles as any)?.full_name ?? (match.profiles as any)?.email) as string;
    }
  }

  const { data: task, error } = await admin
    .from('tasks')
    .insert({ workspace_id: workspaceUuid, project_id: projectId, title, assignee_id: assigneeId, due_date: dueDate, status: 'To Do', priority: 'Medium', tags: [] })
    .select('id').single();
  if (error || !task) { console.error('[cc/task] insert:', error?.message); return '⚠️ Task konnte nicht erstellt werden.'; }

  admin.from('activity_logs').insert({ workspace_id: workspaceUuid, actor_id: null, kind: 'task_created', target_type: 'task', target_id: task.id, meta: { title, source: 'slack', slack_user: slackUser } })
    .then(({ error: e }) => { if (e) console.error('[cc/task] activity:', e.message); });

  const lines = [`✅ Task erstellt: *${title}*`];
  if (assigneeName) lines.push(`👤 Zugewiesen an: ${assigneeName}`);
  else if (mentionedName) lines.push(`👤 @${mentionedName} nicht gefunden — nicht zugewiesen`);
  else lines.push('👤 Nicht zugewiesen');
  if (dueDate) lines.push(`📅 Fällig: ${dueDate}`);
  lines.push(`📁 Projekt: ${projectName}`);
  return lines.join('\n');
}

// ── /cc mytasks ───────────────────────────────────────────────────────────

async function handleMyTasks(workspaceUuid: string, slackUserName: string, admin: SupabaseClient): Promise<string> {
  const profile = await resolveSlackUser(workspaceUuid, slackUserName, admin);
  if (!profile) return `⚠️ Slack-Name \`${slackUserName}\` konnte keinem Command Center Profil zugeordnet werden.\nName in Slack muss mit dem Namen in Command Center übereinstimmen.`;

  const { data: tasks, error } = await admin
    .from('tasks').select('id, title, status, due_date').eq('workspace_id', workspaceUuid).eq('assignee_id', profile.id)
    .neq('status', 'Done').order('due_date', { ascending: true, nullsFirst: false }).limit(10);
  if (error) { console.error('[cc/mytasks]:', error.message); return '⚠️ Datenbankfehler.'; }
  if (!tasks?.length) return `✅ *${profile.name}* hat keine offenen Tasks.`;

  const lines = [`📋 *Offene Tasks von ${profile.name}* (${tasks.length})`, ''];
  for (const t of tasks) {
    const status = t.status !== 'To Do' ? ` [${t.status}]` : '';
    lines.push(`• ${t.title}${status}${dueLabelShort(t.due_date)}`);
  }
  return lines.join('\n');
}

// ── /cc today ─────────────────────────────────────────────────────────────

async function handleToday(workspaceUuid: string, admin: SupabaseClient): Promise<string> {
  const today = todayStr();
  const [overdueRes, todayRes, reviewRes] = await Promise.all([
    admin.from('tasks').select('id, title, status, due_date, profiles!assignee_id(full_name, email)').eq('workspace_id', workspaceUuid).lt('due_date', today).neq('status', 'Done').order('due_date', { ascending: true }).limit(10),
    admin.from('tasks').select('id, title, status, due_date, profiles!assignee_id(full_name, email)').eq('workspace_id', workspaceUuid).eq('due_date', today).neq('status', 'Done').order('created_at', { ascending: true }).limit(10),
    admin.from('tasks').select('id, title, due_date, profiles!assignee_id(full_name, email)').eq('workspace_id', workspaceUuid).eq('status', 'Review').order('created_at', { ascending: false }).limit(10),
  ]);

  const lines = [`📅 *Heute — ${today}*`, ''];
  const addSection = (label: string, rows: any[]) => {
    lines.push(`*${label} (${rows.length})*`);
    if (!rows.length) lines.push('_Keine_');
    else rows.forEach(t => {
      const who = (t as any).profiles?.full_name ?? (t as any).profiles?.email ?? '';
      const status = (t as any).status && (t as any).status !== 'Review' ? ` [${(t as any).status}]` : '';
      lines.push(`• ${t.title}${status}${dueLabelShort(t.due_date)}${who ? ` — ${who}` : ''}`);
    });
    lines.push('');
  };

  addSection('Überfällig', overdueRes.data ?? []);
  addSection('Heute fällig', todayRes.data ?? []);
  addSection('In Review', reviewRes.data ?? []);
  return lines.join('\n').trimEnd();
}

// ── /cc done ──────────────────────────────────────────────────────────────

async function handleDone(text: string, workspaceUuid: string, slackUserName: string, cmd: string, admin: SupabaseClient): Promise<string> {
  if (!text.trim()) return `Beispiel: \`${cmd} done Thumbnail Ep. 5\``;

  const needle = text.trim().toLowerCase();
  const [profile, tasksRes] = await Promise.all([
    resolveSlackUser(workspaceUuid, slackUserName, admin),
    admin.from('tasks').select('id, title, status, assignee_id').eq('workspace_id', workspaceUuid).neq('status', 'Done').ilike('title', `%${needle}%`).limit(10),
  ]);

  const tasks = tasksRes.data ?? [];
  if (!tasks.length) return `❌ Kein offener Task gefunden der \`${text}\` enthält.`;
  if (tasks.length > 1) {
    const list = tasks.map((t: any) => `• ${t.title} [${t.status}]`).join('\n');
    return `Mehrere Tasks gefunden — bitte spezifischer:\n${list}`;
  }

  const match = tasks[0] as any;
  const { error } = await admin.from('tasks').update({ status: 'Done' }).eq('id', match.id).eq('workspace_id', workspaceUuid);
  if (error) { console.error('[cc/done]:', error.message); return '⚠️ Status konnte nicht geändert werden.'; }

  admin.from('activity_logs').insert({ workspace_id: workspaceUuid, actor_id: null, kind: 'task_completed', target_type: 'task', target_id: match.id, meta: { from: match.status, source: 'slack', slack_user: slackUserName } })
    .then(({ error: e }) => { if (e) console.error('[cc/done] activity:', e.message); });

  return `✅ *${match.title}* als erledigt markiert.`;
}

// ── /cc review ────────────────────────────────────────────────────────────

async function handleReview(workspaceUuid: string, admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin
    .from('tasks').select('id, title, due_date, profiles!assignee_id(full_name, email)').eq('workspace_id', workspaceUuid).eq('status', 'Review').order('created_at', { ascending: false }).limit(15);
  if (error) { console.error('[cc/review]:', error.message); return '⚠️ Datenbankfehler.'; }
  if (!data?.length) return '👀 Keine Tasks aktuell in Review.';

  const lines = [`👀 *Tasks in Review (${data.length})*`, ''];
  for (const t of data as any[]) {
    lines.push(`• ${t.title} — ${t.profiles?.full_name ?? t.profiles?.email ?? 'Unzugewiesen'}${dueLabelShort(t.due_date)}`);
  }
  return lines.join('\n');
}

// ── /cc search ────────────────────────────────────────────────────────────

async function handleSearch(text: string, workspaceUuid: string, admin: SupabaseClient): Promise<string> {
  if (!text.trim()) return 'Bitte einen Suchbegriff angeben. Beispiel: `/cc search Hanno`';

  const [tasksRes, projectsRes] = await Promise.all([
    admin.from('tasks').select('id, title, status, due_date, profiles!assignee_id(full_name, email)').eq('workspace_id', workspaceUuid).ilike('title', `%${text}%`).neq('status', 'Done').order('created_at', { ascending: false }).limit(5),
    admin.from('projects').select('id, name, status, due_date').eq('workspace_id', workspaceUuid).ilike('name', `%${text}%`).order('created_at', { ascending: false }).limit(5),
  ]);

  const tasks    = tasksRes.data ?? [];
  const projects = projectsRes.data ?? [];

  if (!tasks.length && !projects.length) return `🔍 Keine Ergebnisse für \`${text}\`.`;

  const lines = [`🔍 *Suche: "${text}"*`, ''];

  if (tasks.length) {
    lines.push(`*Tasks (${tasks.length})*`);
    for (const t of tasks as any[]) {
      const who = t.profiles?.full_name ?? t.profiles?.email ?? '';
      lines.push(`• *${t.title}* [${t.status}]${dueLabelShort(t.due_date)}${who ? ` — ${who}` : ''}`);
    }
    lines.push('');
  }

  if (projects.length) {
    lines.push(`*Projekte (${projects.length})*`);
    for (const p of projects as any[]) {
      lines.push(`• *${p.name}* [${p.status}]${dueLabelShort(p.due_date)}`);
    }
  }

  return lines.join('\n');
}

// ── /cc status ────────────────────────────────────────────────────────────

async function handleStatus(
  text: string, workspaceUuid: string, slackUserName: string, cmd: string, admin: SupabaseClient,
): Promise<string> {
  if (!text.trim()) return `Beispiel: \`${cmd} status Trailer review\`\nAliase: todo · progress · review · done · backlog · blocked`;

  const { taskText, status } = extractTrailingStatus(text);
  if (!status) return `Status nicht erkannt. Bekannte Aliase: \`todo\` · \`progress\` · \`review\` · \`done\` · \`backlog\` · \`blocked\``;
  if (!taskText.trim()) return `Bitte einen Task-Titel angeben.`;

  // Parallel: resolve caller + find matching tasks
  const [caller, tasks] = await Promise.all([
    resolveSlackUserWithRole(workspaceUuid, slackUserName, admin),
    findMatchingTasks(workspaceUuid, taskText.trim(), admin),
  ]);

  if (!tasks.length) return `❌ Kein offener Task gefunden der \`${taskText}\` enthält.`;
  if (tasks.length > 1) {
    const list = tasks.map(t => `• ${t.title} [${t.status}]`).join('\n');
    return `Mehrere Tasks gefunden — bitte spezifischer:\n${list}`;
  }

  const task = tasks[0];

  // Role check: member can only change their own tasks; manager+ can change any
  if (caller) {
    const isOwn = task.assignee_id === caller.id;
    if (!isOwn && !roleAtLeast(caller.role, 'manager')) {
      return `⛔ Nur Manager+ können fremde Tasks ändern.\nDieser Task ist nicht dir zugewiesen.`;
    }
  }

  const { error } = await admin.from('tasks').update({ status }).eq('id', task.id).eq('workspace_id', workspaceUuid);
  if (error) { console.error('[cc/status]:', error.message); return '⚠️ Status konnte nicht geändert werden.'; }

  admin.from('activity_logs').insert({ workspace_id: workspaceUuid, actor_id: null, kind: 'task_status_changed', target_type: 'task', target_id: task.id, meta: { from: task.status, to: status, source: 'slack', slack_user: slackUserName } })
    .then(({ error: e }) => { if (e) console.error('[cc/status] activity:', e.message); });

  return `✅ *${task.title}* → Status: *${status}*`;
}

// ── /cc assign ────────────────────────────────────────────────────────────

async function handleAssign(
  text: string, workspaceUuid: string, slackUserName: string, cmd: string, admin: SupabaseClient,
): Promise<string> {
  if (!text.trim()) return `Beispiel: \`${cmd} assign Trailer Hanno @malik\``;

  const { taskText, mentionedName } = extractTrailingMention(text);
  if (!mentionedName) return `Bitte eine Person angeben. Beispiel: \`${cmd} assign Trailer Hanno @malik\``;
  if (!taskText.trim()) return 'Bitte einen Task-Titel angeben.';

  // Parallel: caller role + task match + target user
  const [caller, tasks, targetUser] = await Promise.all([
    resolveSlackUserWithRole(workspaceUuid, slackUserName, admin),
    findMatchingTasks(workspaceUuid, taskText.trim(), admin),
    resolveMentionedUser(workspaceUuid, mentionedName, admin),
  ]);

  // Role check: manager+ required to assign
  if (caller && !roleAtLeast(caller.role, 'manager')) {
    return `⛔ Nur Manager+ können Tasks zuweisen. Deine Rolle: ${caller.role}.`;
  }

  if (!targetUser) return `⚠️ @${mentionedName} konnte keinem Workspace-Mitglied zugeordnet werden.`;
  if (!tasks.length) return `❌ Kein offener Task gefunden der \`${taskText}\` enthält.`;
  if (tasks.length > 1) {
    const list = tasks.map(t => `• ${t.title} [${t.status}]`).join('\n');
    return `Mehrere Tasks gefunden — bitte spezifischer:\n${list}`;
  }

  const task = tasks[0];
  const { error } = await admin.from('tasks').update({ assignee_id: targetUser.id }).eq('id', task.id).eq('workspace_id', workspaceUuid);
  if (error) { console.error('[cc/assign]:', error.message); return '⚠️ Zuweisung fehlgeschlagen.'; }

  admin.from('activity_logs').insert({ workspace_id: workspaceUuid, actor_id: null, kind: 'task_assigned', target_type: 'task', target_id: task.id, meta: { assigned_to: targetUser.id, source: 'slack', slack_user: slackUserName } })
    .then(({ error: e }) => { if (e) console.error('[cc/assign] activity:', e.message); });

  return `✅ *${task.title}* → Zugewiesen an *${targetUser.name}*`;
}

// ── /cc comment ───────────────────────────────────────────────────────────

async function handleComment(
  text: string, workspaceUuid: string, slackUserName: string, cmd: string, admin: SupabaseClient,
): Promise<string> {
  if (!text.trim()) return `Beispiel: \`${cmd} comment Trailer Bitte Outro kürzen\``;

  // Requires user mapping — author_id is NOT NULL in task_comments
  const [caller, allTasks] = await Promise.all([
    resolveSlackUserWithRole(workspaceUuid, slackUserName, admin),
    admin.from('tasks').select('id, title, status, assignee_id, project_id').eq('workspace_id', workspaceUuid).neq('status', 'Done').limit(100).then(r => (r.data ?? []) as TaskRow[]),
  ]);

  if (!caller) return `⚠️ Slack-Name \`${slackUserName}\` konnte keinem Workspace-Mitglied zugeordnet werden.\nKommentare erfordern ein verknüpftes Profil.`;

  // member+ can comment
  if (!roleAtLeast(caller.role, 'member')) return `⛔ Viewer können keine Kommentare hinzufügen.`;

  // Greedy split: find task from beginning, rest is comment
  const split = splitTaskComment(text, allTasks);
  if (!split) {
    // Fallback: first word(s) as task search
    const words = text.split(/\s+/);
    const needle = words[0];
    const matches = allTasks.filter(t => t.title.toLowerCase().includes(needle.toLowerCase()));
    if (!matches.length) return `❌ Kein offener Task gefunden der \`${words[0]}\` enthält.\nBeispiel: \`${cmd} comment Trailer Bitte Outro kürzen\``;
    if (matches.length > 1) {
      const list = matches.slice(0, 5).map(t => `• ${t.title}`).join('\n');
      return `Mehrere Tasks gefunden — bitte spezifischer:\n${list}`;
    }
    return `Kein Kommentartext gefunden. Beispiel: \`${cmd} comment ${matches[0].title} Dein Kommentar hier\``;
  }

  const { task, comment } = split;

  const { error } = await admin.from('task_comments').insert({
    workspace_id: workspaceUuid,
    task_id: task.id,
    author_id: caller.id,
    body: comment,
  });
  if (error) { console.error('[cc/comment]:', error.message); return '⚠️ Kommentar konnte nicht gespeichert werden.'; }

  admin.from('activity_logs').insert({ workspace_id: workspaceUuid, actor_id: null, kind: 'comment_added', target_type: 'task', target_id: task.id, meta: { source: 'slack', slack_user: slackUserName } })
    .then(({ error: e }) => { if (e) console.error('[cc/comment] activity:', e.message); });

  return `💬 Kommentar zu *${task.title}* hinzugefügt:\n_${comment}_`;
}

// ── /cc project ───────────────────────────────────────────────────────────

async function handleProject(
  text: string, workspaceUuid: string, slackUserName: string, cmd: string, admin: SupabaseClient,
): Promise<string> {
  if (!text.trim()) return [
    `Verfügbare Subcommands:`,
    `\`${cmd} project <name>\` — neues Projekt anlegen (Manager+)`,
    `\`${cmd} project status <name>\` — Projekt-Status ansehen`,
  ].join('\n');

  // /cc project status <name>
  if (text.toLowerCase().startsWith('status ')) {
    const query = text.slice(7).trim();
    if (!query) return `Bitte einen Projektnamen angeben.\nBeispiel: \`${cmd} project status Hanno\``;

    const projects = await findMatchingProjects(workspaceUuid, query, admin);
    if (!projects.length) return `❌ Kein Projekt gefunden der \`${query}\` enthält.`;
    if (projects.length > 1) {
      const list = projects.map((p: any) => `• ${p.name} [${p.status}]`).join('\n');
      return `Mehrere Projekte gefunden — bitte spezifischer:\n${list}`;
    }

    const proj = projects[0];
    const [openRes, doneRes, overdueRes] = await Promise.all([
      admin.from('tasks').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceUuid).eq('project_id', proj.id).neq('status', 'Done'),
      admin.from('tasks').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceUuid).eq('project_id', proj.id).eq('status', 'Done'),
      admin.from('tasks').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceUuid).eq('project_id', proj.id).lt('due_date', todayStr()).neq('status', 'Done'),
    ]);

    const lines = [
      `📁 *${proj.name}*`,
      `Status: ${proj.status}${proj.progress ? ` · ${proj.progress}% abgeschlossen` : ''}`,
      dueLabelShort(proj.due_date) ? `Deadline: ${proj.due_date}${dueLabelShort(proj.due_date)}` : '',
      '',
      `✅ Erledigt: ${doneRes.count ?? 0}`,
      `📋 Offen: ${openRes.count ?? 0}`,
      `⚠️ Überfällig: ${overdueRes.count ?? 0}`,
    ].filter(Boolean);
    return lines.join('\n');
  }

  // /cc project <name> — create new project
  const name = text.trim();

  const [caller] = await Promise.all([
    resolveSlackUserWithRole(workspaceUuid, slackUserName, admin),
  ]);

  if (caller && !roleAtLeast(caller.role, 'manager')) {
    return `⛔ Nur Manager+ können Projekte anlegen. Deine Rolle: ${caller.role}.`;
  }

  const { data: proj, error } = await admin
    .from('projects')
    .insert({ workspace_id: workspaceUuid, name, status: 'Planning', priority: 'Medium', owner_id: caller?.id ?? null })
    .select('id, name').single();
  if (error || !proj) { console.error('[cc/project]:', error?.message); return '⚠️ Projekt konnte nicht angelegt werden.'; }

  admin.from('activity_logs').insert({ workspace_id: workspaceUuid, actor_id: null, kind: 'project_created', target_type: 'project', target_id: proj.id, meta: { name, source: 'slack', slack_user: slackUserName } })
    .then(({ error: e }) => { if (e) console.error('[cc/project] activity:', e.message); });

  return `✅ Projekt angelegt: *${proj.name}*\nStatus: Planning · Öffne Command Center um Tasks hinzuzufügen.`;
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
  const command  = params.get('command')   ?? '/cc';
  const text     = (params.get('text')     ?? '').trim();
  const teamId   = params.get('team_id')   ?? '';
  const userName = params.get('user_name') ?? 'unknown';

  const admin = createAdminClient();
  if (!admin) {
    console.error('[slack/commands] admin client not configured');
    return slackText('⚠️ Datenbankverbindung nicht konfiguriert.', 500);
  }

  // Map Slack team → workspace
  const { data: integration, error: intErr } = await admin
    .from('slack_integrations')
    .select('workspace_id')
    .eq('team_id', teamId)
    .eq('is_active', true)
    .maybeSingle();

  if (intErr) { console.error('[slack/commands] integration lookup:', intErr.message); return slackText('⚠️ Datenbankfehler.', 500); }
  if (!integration?.workspace_id) return slackText(`⚠️ Slack-Workspace nicht verbunden. Team ID: \`${teamId}\``);
  const workspaceUuid = integration.workspace_id as string;

  const isLegacyTask = command === '/task';
  const [subRaw, ...restParts] = text.split(/\s+/);
  const sub  = isLegacyTask ? 'task' : (subRaw ?? '').toLowerCase();
  const rest = isLegacyTask ? text : restParts.join(' ').trim();
  const cmd  = command === '/task' ? '/task' : '/cc';

  let responseText: string;

  switch (sub) {
    case 'task':    responseText = await handleTask(rest, workspaceUuid, userName, cmd, admin); break;
    case 'mytasks': responseText = await handleMyTasks(workspaceUuid, userName, admin); break;
    case 'today':   responseText = await handleToday(workspaceUuid, admin); break;
    case 'done':    responseText = await handleDone(rest, workspaceUuid, userName, cmd, admin); break;
    case 'review':  responseText = await handleReview(workspaceUuid, admin); break;
    case 'search':  responseText = await handleSearch(rest, workspaceUuid, admin); break;
    case 'status':  responseText = await handleStatus(rest, workspaceUuid, userName, cmd, admin); break;
    case 'assign':  responseText = await handleAssign(rest, workspaceUuid, userName, cmd, admin); break;
    case 'comment': responseText = await handleComment(rest, workspaceUuid, userName, cmd, admin); break;
    case 'project': responseText = await handleProject(rest, workspaceUuid, userName, cmd, admin); break;
    case 'help':
    default:        responseText = handleHelp(cmd);
  }

  console.log(`[slack/commands] ${command} ${sub} — ${Date.now() - t0}ms — user=${userName}`);
  return slackText(responseText);
}
