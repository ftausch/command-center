// POST /api/slack/commands
//
// Handles Slack slash commands, initially /task.
// Trust boundary: Slack HMAC-SHA256 signature replaces user session auth.
// All DB access uses the admin client (service-role, server-only).
// Never called from the browser; no cookie session involved.
//
// Flow:
//   1. Verify Slack request signature + timestamp (reject if >5 min old).
//   2. Parse application/x-www-form-urlencoded body.
//   3. Map Slack team_id → workspace via slack_integrations.
//   4. Parse command text → title, optional @mention, optional "bis <date>".
//   5. Resolve @mention to a workspace_member profile (fuzzy name match).
//   6. Insert task + activity_log using admin client.
//   7. Return immediate JSON confirmation to Slack.

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

// ── Signature verification ────────────────────────────────────────────────

function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  rawBody: string,
  slackSig: string,
): boolean {
  const ts = parseInt(timestamp, 10);
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const computed = 'v0=' + createHmac('sha256', signingSecret).update(base, 'utf8').digest('hex');

  try {
    return timingSafeEqual(Buffer.from(computed, 'utf8'), Buffer.from(slackSig, 'utf8'));
  } catch {
    return false;
  }
}

// ── Date parsing ──────────────────────────────────────────────────────────

const GERMAN_DAYS: Record<string, number> = {
  montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4,
  freitag: 5, samstag: 6, sonntag: 0,
};

function parseGermanDate(raw: string): string | null {
  const s = raw.toLowerCase().trim();

  // DD.MM.YYYY or DD.MM.
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})?$/);
  if (m) {
    const year = m[3] ?? String(new Date().getFullYear());
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  // German weekday — always returns the *next* occurrence
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

// ── Command text parser ───────────────────────────────────────────────────
// Supports:
//   /task <title>
//   /task @user <title>
//   /task <title> bis <date>
//   /task @user <title> bis <date>

function parseCommandText(text: string): {
  title: string;
  mentionedName: string | null;
  dueDate: string | null;
} {
  let remaining = text.trim();
  let mentionedName: string | null = null;
  let dueDate: string | null = null;

  // Strip leading @mention
  const mentionMatch = remaining.match(/^@(\S+)\s+([\s\S]+)/);
  if (mentionMatch) {
    mentionedName = mentionMatch[1];
    remaining = mentionMatch[2].trim();
  }

  // Strip "bis <word>" from end (case-insensitive)
  const bisMatch = remaining.match(/^([\s\S]+?)\s+bis\s+(\S+)\s*$/i);
  if (bisMatch) {
    const parsed = parseGermanDate(bisMatch[2]);
    if (parsed) {
      dueDate = parsed;
      remaining = bisMatch[1].trim();
    }
  }

  return { title: remaining, mentionedName, dueDate };
}

// ── Route handler ─────────────────────────────────────────────────────────

function slackText(text: string, status = 200) {
  return NextResponse.json({ text }, { status });
}

export async function POST(req: NextRequest) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error('[slack/commands] SLACK_SIGNING_SECRET not configured');
    return slackText('⚠️ Server misconfiguration. Contact your admin.', 500);
  }

  // Must read the raw body before any other parsing — HMAC requires exact bytes.
  const rawBody = await req.text();
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? '';
  const signature = req.headers.get('x-slack-signature') ?? '';

  if (!verifySlackSignature(signingSecret, timestamp, rawBody, signature)) {
    return slackText('Unauthorized.', 401);
  }

  const params = new URLSearchParams(rawBody);
  const teamId    = params.get('team_id')   ?? '';
  const text      = params.get('text')      ?? '';
  const slackUser = params.get('user_name') ?? 'unknown';
  const command   = params.get('command')   ?? '/task';

  if (!text.trim()) {
    return slackText(
      `Bitte einen Task-Titel angeben.\nBeispiel: \`${command} @tim Thumbnail-Auswahl für Ep. 048 bis Freitag\``,
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    console.error('[slack/commands] admin client not configured');
    return slackText('⚠️ Datenbankverbindung nicht konfiguriert.', 500);
  }

  // 1. Map Slack team → workspace
  const { data: integration, error: intErr } = await admin
    .from('slack_integrations')
    .select('workspace_id')
    .eq('team_id', teamId)
    .eq('is_active', true)
    .maybeSingle();

  if (intErr) {
    console.error('[slack/commands] integration lookup failed', intErr.message);
    return slackText('⚠️ Datenbankfehler beim Workspace-Lookup.', 500);
  }
  if (!integration?.workspace_id) {
    return slackText(
      `⚠️ Dieses Slack-Workspace ist nicht mit Command Center verbunden.\nSlack team ID: \`${teamId}\``,
    );
  }
  const workspaceUuid = integration.workspace_id as string;

  // 2. Parse command text
  const { title, mentionedName, dueDate } = parseCommandText(text);
  if (!title) {
    return slackText(
      `Bitte einen Task-Titel angeben.\nBeispiel: \`${command} @tim Thumbnail für Ep. 048 bis Freitag\``,
    );
  }

  // 3. Resolve @mention → assignee_id (fuzzy full_name/email match within workspace)
  let assigneeId: string | null = null;
  let assigneeName: string | null = null;
  if (mentionedName) {
    const { data: members } = await admin
      .from('workspace_members')
      .select('user_id, profiles!inner(id, full_name, email)')
      .eq('workspace_id', workspaceUuid);

    const needle = mentionedName.toLowerCase();
    const match = (members ?? []).find((m: any) => {
      const name = ((m.profiles?.full_name ?? m.profiles?.email) as string | null)?.toLowerCase() ?? '';
      return name.includes(needle);
    });
    if (match) {
      assigneeId = match.user_id as string;
      assigneeName = ((match.profiles as any)?.full_name ?? (match.profiles as any)?.email) as string;
    }
  }

  // 4. Find first non-Done project in workspace (default attachment point)
  const { data: projects, error: projErr } = await admin
    .from('projects')
    .select('id, name')
    .eq('workspace_id', workspaceUuid)
    .neq('status', 'Done')
    .order('created_at', { ascending: true })
    .limit(1);

  if (projErr) {
    console.error('[slack/commands] project lookup failed', projErr.message);
    return slackText('⚠️ Datenbankfehler beim Projekt-Lookup.', 500);
  }
  if (!projects?.length) {
    return slackText(
      '⚠️ Kein aktives Projekt im Workspace gefunden. Bitte erst ein Projekt in Command Center anlegen.',
    );
  }
  const projectId   = projects[0].id   as string;
  const projectName = projects[0].name as string;

  // 5. Insert task
  const { data: task, error: taskErr } = await admin
    .from('tasks')
    .insert({
      workspace_id: workspaceUuid,
      project_id:   projectId,
      title,
      assignee_id:  assigneeId,
      due_date:     dueDate,
      status:       'To Do',
      priority:     'Medium',
      tags:         [],
    })
    .select('id')
    .single();

  if (taskErr || !task) {
    console.error('[slack/commands] task insert failed', taskErr?.message);
    return slackText('⚠️ Task konnte nicht erstellt werden. Bitte erneut versuchen.', 500);
  }

  // 6. Log activity (actor_id null — action originated from Slack, not a session user)
  await admin
    .from('activity_logs')
    .insert({
      workspace_id: workspaceUuid,
      actor_id:     null,
      kind:         'task_created',
      target_type:  'task',
      target_id:    task.id,
      meta:         { title, source: 'slack_slash_command', slack_user: slackUser },
    })
    .then(({ error }) => {
      if (error) console.error('[slack/commands] activity_log insert failed', error.message);
    });

  // 7. Confirmation reply to Slack
  const lines: string[] = [`✅ Task erstellt: *${title}*`];
  if (assigneeName) {
    lines.push(`👤 Zugewiesen an: ${assigneeName}`);
  } else if (mentionedName) {
    lines.push(`👤 @${mentionedName} nicht gefunden — Task nicht zugewiesen`);
  } else {
    lines.push('👤 Nicht zugewiesen');
  }
  if (dueDate) lines.push(`📅 Fällig: ${dueDate}`);
  lines.push(`📁 Projekt: ${projectName}`);

  return slackText(lines.join('\n'));
}
