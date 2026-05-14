// POST /api/slack/commands
//
// Handles Slack slash commands (/task).
// Trust boundary: Slack HMAC-SHA256 signature replaces user session auth.
// All DB access uses the admin client (service-role, server-only).
//
// Timing budget: Slack drops commands that don't respond within ~3 seconds.
// To stay within that window:
//   - Independent DB queries run in parallel (Promise.all).
//   - activity_log insert is fire-and-forget (never blocks the response).
//   - maxDuration gives Vercel's function a 10-second ceiling as buffer.

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 10; // seconds — Slack side timeout is ~3s, this is server ceiling

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

// ── Command text parser ───────────────────────────────────────────────────

function parseCommandText(text: string): {
  title: string;
  mentionedName: string | null;
  slackUserId: string | null;
  dueDate: string | null;
} {
  let remaining = text.trim();
  let mentionedName: string | null = null;
  let slackUserId: string | null = null;
  let dueDate: string | null = null;

  // Slack autocomplete mention: <@USERID> or <@USERID|displayname>
  const slackMention = remaining.match(/^<@([A-Z0-9]+)(?:\|([^>]+))?>\s*([\s\S]*)/);
  if (slackMention) {
    slackUserId = slackMention[1];
    mentionedName = slackMention[2] ?? null;
    remaining = slackMention[3].trim();
  } else {
    // Plain-text @name
    const plainMention = remaining.match(/^@(\S+)\s+([\s\S]+)/);
    if (plainMention) {
      mentionedName = plainMention[1];
      remaining = plainMention[2].trim();
    }
  }

  const bisMatch = remaining.match(/^([\s\S]+?)\s+bis\s+(\S+)\s*$/i);
  if (bisMatch) {
    const parsed = parseGermanDate(bisMatch[2]);
    if (parsed) {
      dueDate = parsed;
      remaining = bisMatch[1].trim();
    }
  }

  return { title: remaining, mentionedName, slackUserId, dueDate };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function slackText(text: string, status = 200) {
  return NextResponse.json({ text }, { status });
}

// ── Route handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  // 0. Env check — fail fast before any I/O
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error('[slack/commands] SLACK_SIGNING_SECRET not set');
    return slackText('⚠️ Server misconfiguration. Contact your admin.', 500);
  }

  // 1. Read raw body (needed for HMAC — must be before any other parsing)
  const rawBody = await req.text();
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? '';
  const signature = req.headers.get('x-slack-signature') ?? '';

  if (!verifySlackSignature(signingSecret, timestamp, rawBody, signature)) {
    console.warn('[slack/commands] signature rejected');
    return slackText('Unauthorized.', 401);
  }

  // 2. Parse form body
  const params = new URLSearchParams(rawBody);
  const teamId    = params.get('team_id')   ?? '';
  const text      = params.get('text')      ?? '';
  const slackUser = params.get('user_name') ?? 'unknown';
  const command   = params.get('command')   ?? '/task';

  if (!text.trim()) {
    return slackText(
      `Bitte einen Task-Titel angeben.\nBeispiel: \`${command} @tim Thumbnail für Ep. 048 bis Freitag\``,
    );
  }

  // 3. Admin client
  const admin = createAdminClient();
  if (!admin) {
    console.error('[slack/commands] admin client not configured');
    return slackText('⚠️ Datenbankverbindung nicht konfiguriert.', 500);
  }

  // 4. Look up workspace — must be first since workspaceUuid gates everything else
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
    return slackText(
      `⚠️ Slack-Workspace nicht verbunden. Team ID: \`${teamId}\``,
    );
  }
  const workspaceUuid = integration.workspace_id as string;

  // 5. Parse command text (synchronous — no I/O)
  const { title, mentionedName, slackUserId, dueDate } = parseCommandText(text);
  if (!title) {
    return slackText(
      `Bitte einen Task-Titel angeben.\nBeispiel: \`${command} @tim Thumbnail für Ep. 048 bis Freitag\``,
    );
  }

  // 6. PARALLEL: members (only if needed) + projects
  //    Running these concurrently halves the I/O wait vs sequential calls.
  const needsMembers = !!(mentionedName || slackUserId);
  const [membersResult, projectsResult] = await Promise.all([
    needsMembers
      ? admin
          .from('workspace_members')
          .select('user_id, profiles!inner(id, full_name, email)')
          .eq('workspace_id', workspaceUuid)
      : Promise.resolve({ data: [] as any[], error: null }),
    admin
      .from('projects')
      .select('id, name')
      .eq('workspace_id', workspaceUuid)
      .neq('status', 'Done')
      .order('created_at', { ascending: true })
      .limit(1),
  ]);

  if (projectsResult.error) {
    console.error('[slack/commands] project lookup failed:', projectsResult.error.message);
    return slackText('⚠️ Datenbankfehler beim Projekt-Lookup.', 500);
  }
  if (!projectsResult.data?.length) {
    return slackText('⚠️ Kein aktives Projekt gefunden. Bitte erst ein Projekt anlegen.');
  }
  const projectId   = projectsResult.data[0].id   as string;
  const projectName = projectsResult.data[0].name as string;

  // 7. Resolve @mention → assignee_id
  let assigneeId: string | null = null;
  let assigneeName: string | null = null;
  if (needsMembers && mentionedName) {
    const needle = mentionedName.toLowerCase();
    const match = (membersResult.data ?? []).find((m: any) => {
      const name = ((m.profiles?.full_name ?? m.profiles?.email) as string | null)?.toLowerCase() ?? '';
      return name.includes(needle) || name.split(/\s+/).some((part: string) => part.startsWith(needle));
    });
    if (match) {
      assigneeId = match.user_id as string;
      assigneeName = ((match.profiles as any)?.full_name ?? (match.profiles as any)?.email) as string;
    }
  }

  // 8. Insert task
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
    console.error('[slack/commands] task insert failed:', taskErr?.message);
    return slackText('⚠️ Task konnte nicht erstellt werden. Bitte erneut versuchen.', 500);
  }

  // 9. Activity log — fire-and-forget, never blocks the Slack response
  admin
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
      if (error) console.error('[slack/commands] activity_log insert failed:', error.message);
    });

  const elapsed = Date.now() - t0;
  console.log(`[slack/commands] task created in ${elapsed}ms — title="${title}" user=${slackUser}`);

  // 10. Respond to Slack
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
