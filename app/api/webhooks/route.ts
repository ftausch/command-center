// POST /api/webhooks
//
// Inbound webhook for n8n and other automation tools.
// Authenticated via WEBHOOK_SECRET header (Bearer token).
//
// Supported actions:
//   create_task          — create a task in a project
//   create_assistant_item — create an assistant item (follow-up, scheduling, etc.)
//   update_assistant_item — update status/fields of an existing item
//   create_scheduling    — create a confirmed or open scheduling item
//   post_slack           — send a Slack notification to the workspace
//
// n8n example:
//   Method: POST
//   URL: https://team.unicornbakery.de/api/webhooks
//   Headers: Authorization: Bearer <WEBHOOK_SECRET>
//   Body: { "action": "create_task", "workspaceId": "...", "projectId": "...", "title": "..." }

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { postSlackNotification } from '@/lib/integrations/slack';

export const dynamic = 'force-dynamic';
export const runtime  = 'nodejs';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.WEBHOOK_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization') ?? req.headers.get('x-webhook-secret') ?? '';
  return auth === `Bearer ${secret}` || auth === secret;
}

async function resolveWorkspaceUuid(admin: any, workspaceId: string): Promise<string | null> {
  // workspaceId can be a slug (e.g. "unicornbakery") or a UUID
  if (workspaceId.includes('-') && workspaceId.length > 30) return workspaceId;
  const { data } = await admin
    .from('workspaces')
    .select('id')
    .eq('slug', workspaceId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, workspaceId, ...payload } = body as any;
  if (!action) return NextResponse.json({ error: 'action is required' }, { status: 400 });
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

  const wsUuid = await resolveWorkspaceUuid(admin, workspaceId as string);
  if (!wsUuid) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  // ── Actions ──────────────────────────────────────────────────────────────

  if (action === 'create_task') {
    const { projectId, title, assigneeEmail, priority, dueDate, tags } = payload;
    if (!projectId || !title) return NextResponse.json({ error: 'projectId and title required' }, { status: 400 });

    // Resolve assignee by email
    let assigneeId: string | null = null;
    if (assigneeEmail) {
      const { data: profile } = await admin.from('profiles').select('id').eq('email', assigneeEmail).maybeSingle();
      assigneeId = profile?.id ?? null;
    }

    const { data, error } = await admin.from('tasks').insert({
      workspace_id: wsUuid,
      project_id:   projectId,
      title:        String(title).trim(),
      status:       'To Do',
      priority:     priority ?? 'Medium',
      due_date:     dueDate ?? null,
      assignee_id:  assigneeId,
      tags:         tags ?? [],
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data: { id: data.id, title: data.title } });
  }

  if (action === 'create_assistant_item') {
    const { title, type, priority, dueDate, contactName, contactEmail, company, description, metadata } = payload;
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

    const { data, error } = await admin.from('assistant_items').insert({
      workspace_id: wsUuid,
      title:        String(title).trim(),
      type:         type ?? 'follow_up',
      status:       'open',
      priority:     priority ?? null,
      due_date:     dueDate ?? null,
      contact_name: contactName ?? null,
      contact_email: contactEmail ?? null,
      company:      company ?? null,
      description:  description ?? null,
      metadata:     metadata ?? {},
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data: { id: data.id, title: data.title, type: data.type } });
  }

  if (action === 'create_scheduling') {
    const { title, participants, desiredDates, confirmedDate, location, duration, description } = payload;
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

    const meta: Record<string, unknown> = {};
    if (participants)  meta.participants  = participants;
    if (desiredDates)  meta.desiredDates  = desiredDates;
    if (confirmedDate) meta.confirmedDate = confirmedDate;
    if (location)      meta.location      = location;
    if (duration)      meta.duration      = duration;

    const { data, error } = await admin.from('assistant_items').insert({
      workspace_id: wsUuid,
      title:        String(title).trim(),
      type:         'scheduling',
      status:       confirmedDate ? 'waiting' : 'open',
      due_date:     confirmedDate ? String(confirmedDate).split('T')[0] : null,
      description:  description ?? null,
      metadata:     meta,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data: { id: data.id, title: data.title } });
  }

  if (action === 'update_assistant_item') {
    const { itemId, status, title, dueDate, description, metadata } = payload;
    if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status      !== undefined) patch.status      = status;
    if (title       !== undefined) patch.title       = String(title).trim();
    if (dueDate     !== undefined) patch.due_date    = dueDate || null;
    if (description !== undefined) patch.description = description || null;
    if (metadata    !== undefined) patch.metadata    = metadata;

    const { data, error } = await admin.from('assistant_items')
      .update(patch)
      .eq('id', itemId as string)
      .eq('workspace_id', wsUuid)
      .select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data: { id: data.id, status: data.status } });
  }

  if (action === 'post_slack') {
    const { text } = payload;
    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });
    await postSlackNotification({ workspaceUuid: wsUuid, text: String(text) });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}

// GET — returns available actions (useful for n8n to discover the API)
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    version: '1.0',
    actions: [
      { action: 'create_task',           required: ['workspaceId','projectId','title'],  optional: ['assigneeEmail','priority','dueDate','tags'] },
      { action: 'create_assistant_item', required: ['workspaceId','title'],              optional: ['type','priority','dueDate','contactName','contactEmail','company','description','metadata'] },
      { action: 'create_scheduling',     required: ['workspaceId','title'],              optional: ['participants','desiredDates','confirmedDate','location','duration','description'] },
      { action: 'update_assistant_item', required: ['workspaceId','itemId'],             optional: ['status','title','dueDate','description','metadata'] },
      { action: 'post_slack',            required: ['workspaceId','text'],               optional: [] },
    ],
  });
}
