'use server';
// Event Operations — CRUD for Run-of-Show, Attendees, Partners/Sponsors.
// All writes require manager+ role via has_workspace_role RLS.
// Slack notifications fire best-effort on key status changes.

import { createClient } from '@/lib/supabase/server';
import { getWorkspaceContext, canWriteAsRole, currentUser } from '@/lib/auth';
import type {
  ActionResult,
  EventAgendaItem,
  EventAttendee,
  EventPartner,
  EventApproval,
  EventDecision,
  AgendaStatus,
  AttendeeRole,
  AttendeeStatus,
  PartnerStatus,
  InvoiceStatus,
  ApprovalType,
  ApprovalStatus,
  DecisionImpact,
} from '@/lib/types';

const MANAGER_ROLES = ['owner', 'admin', 'manager'] as const;

// ── Slack helper ──────────────────────────────────────────────────────────
// Looks up the Slack channel ID stored in project_resources, then posts
// directly to it via the bot token. Falls back to the webhook if no channel
// ID is found. Always best-effort — never blocks the main action.

async function notifyEventSlack(
  workspaceUuid: string,
  projectId: string,
  text: string,
): Promise<void> {
  try {
    const supabase = createClient();
    if (!supabase) return;

    // Look up Slack channel ID from project_resources
    const { data: res } = await supabase
      .from('project_resources')
      .select('external_id, url')
      .eq('workspace_id', workspaceUuid)
      .eq('project_id', projectId)
      .eq('type', 'slack_channel')
      .maybeSingle();

    const { postMessageToChannel, postSlackNotification } = await import('@/lib/integrations/slack');

    if (res?.external_id) {
      await postMessageToChannel(res.external_id, text);
    } else {
      // Fallback: post via incoming webhook
      await postSlackNotification({ workspaceUuid, text, channelLabel: 'event-ops' });
    }
  } catch (e: any) {
    console.error('[event-ops] Slack notify failed (non-blocking):', e?.message ?? e);
  }
}

const ATTENDEE_MILESTONES = [10, 25, 50, 100, 150, 200, 300, 500];

async function actor() {
  const u = await currentUser();
  return u?.id ?? null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function rowToAgenda(row: any): EventAgendaItem {
  return {
    id: row.id,
    projectId: row.project_id,
    workspaceId: row.workspace_id,
    sortOrder: row.sort_order ?? 0,
    timeLabel: row.time_label ?? '',
    title: row.title,
    description: row.description ?? undefined,
    ownerId: row.owner_id ?? undefined,
    location: row.location ?? undefined,
    status: (row.status ?? 'planned') as AgendaStatus,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

function rowToAttendee(row: any): EventAttendee {
  return {
    id: row.id,
    projectId: row.project_id,
    workspaceId: row.workspace_id,
    name: row.name,
    email: row.email ?? undefined,
    company: row.company ?? undefined,
    role: (row.role ?? 'attendee') as AttendeeRole,
    status: (row.status ?? 'invited') as AttendeeStatus,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

function rowToPartner(row: any): EventPartner {
  return {
    id: row.id,
    projectId: row.project_id,
    workspaceId: row.workspace_id,
    name: row.name,
    contactPerson: row.contact_person ?? undefined,
    email: row.email ?? undefined,
    status: (row.status ?? 'lead') as PartnerStatus,
    package: row.package ?? undefined,
    deliverables: row.deliverables ?? undefined,
    logoReceived: !!row.logo_received,
    invoiceStatus: (row.invoice_status ?? 'pending') as InvoiceStatus,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

// ── Agenda ────────────────────────────────────────────────────────────────

export async function listAgendaItems(
  workspaceId: string,
  projectId: string,
): Promise<EventAgendaItem[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('event_agenda_items')
    .select()
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return (data ?? []).map(rowToAgenda);
}

export async function createAgendaItem(input: {
  workspaceId: string;
  projectId: string;
  timeLabel: string;
  title: string;
  description?: string;
  ownerId?: string;
  location?: string;
  sortOrder?: number;
}): Promise<ActionResult<EventAgendaItem>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace nicht gefunden.' };
  if (!canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Nur Manager+ können Agenda-Punkte anlegen.' };

  const { data, error } = await supabase
    .from('event_agenda_items')
    .insert({
      workspace_id: ctx.uuid,
      project_id:   input.projectId,
      time_label:   input.timeLabel,
      title:        input.title,
      description:  input.description ?? null,
      owner_id:     input.ownerId ?? null,
      location:     input.location ?? null,
      sort_order:   input.sortOrder ?? 0,
    })
    .select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: rowToAgenda(data) };
}

export async function updateAgendaItem(input: {
  workspaceId: string;
  itemId: string;
  patch: Partial<Pick<EventAgendaItem, 'timeLabel' | 'title' | 'description' | 'ownerId' | 'location' | 'status' | 'notes' | 'sortOrder'>>;
}): Promise<ActionResult<EventAgendaItem>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };

  const row: Record<string, unknown> = {};
  if (input.patch.timeLabel   !== undefined) row.time_label   = input.patch.timeLabel;
  if (input.patch.title       !== undefined) row.title        = input.patch.title;
  if (input.patch.description !== undefined) row.description  = input.patch.description || null;
  if (input.patch.ownerId     !== undefined) row.owner_id     = input.patch.ownerId || null;
  if (input.patch.location    !== undefined) row.location     = input.patch.location || null;
  if (input.patch.status      !== undefined) row.status       = input.patch.status;
  if (input.patch.notes       !== undefined) row.notes        = input.patch.notes || null;
  if (input.patch.sortOrder   !== undefined) row.sort_order   = input.patch.sortOrder;

  // Fetch before-state to detect done transition
  const { data: before } = await supabase
    .from('event_agenda_items').select('status, title, project_id').eq('id', input.itemId).single();

  const { data, error } = await supabase
    .from('event_agenda_items')
    .update(row)
    .eq('id', input.itemId)
    .eq('workspace_id', ctx.uuid)
    .select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };

  // Notify team when an agenda item goes live or is marked done during the event
  if (input.patch.status && before && input.patch.status !== before.status) {
    const pid       = before.project_id as string;
    const timeStr   = data.time_label ? `${data.time_label} — ` : '';
    if (input.patch.status === 'active') {
      notifyEventSlack(ctx.uuid, pid,
        `▶️ *${timeStr}${data.title}* hat begonnen.`);
    } else if (input.patch.status === 'done') {
      notifyEventSlack(ctx.uuid, pid,
        `✅ *${timeStr}${data.title}* ist abgeschlossen.`);
    }
  }

  return { ok: true, data: rowToAgenda(data) };
}

export async function deleteAgendaItem(input: {
  workspaceId: string;
  itemId: string;
}): Promise<ActionResult<null>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const { error } = await supabase
    .from('event_agenda_items')
    .delete()
    .eq('id', input.itemId)
    .eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// ── Attendees ─────────────────────────────────────────────────────────────

export async function listAttendees(
  workspaceId: string,
  projectId: string,
): Promise<EventAttendee[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('event_attendees')
    .select()
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  return (data ?? []).map(rowToAttendee);
}

export async function createAttendee(input: {
  workspaceId: string;
  projectId: string;
  name: string;
  email?: string;
  company?: string;
  role?: AttendeeRole;
  status?: AttendeeStatus;
  notes?: string;
}): Promise<ActionResult<EventAttendee>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };

  const { data, error } = await supabase
    .from('event_attendees')
    .insert({
      workspace_id: ctx.uuid,
      project_id:   input.projectId,
      name:         input.name,
      email:        input.email ?? null,
      company:      input.company ?? null,
      role:         input.role ?? 'attendee',
      status:       input.status ?? 'invited',
      notes:        input.notes ?? null,
    })
    .select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };

  // Check attendee milestone — fire-and-forget
  const { count } = await supabase
    .from('event_attendees')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', input.projectId)
    .neq('status', 'cancelled');
  const total = count ?? 0;
  if (ATTENDEE_MILESTONES.includes(total)) {
    // Fetch project name for the message
    const { data: proj } = await supabase
      .from('projects').select('name').eq('id', input.projectId).single();
    notifyEventSlack(
      ctx.uuid, input.projectId,
      `🎉 *${proj?.name ?? 'Event'}* hat ${total} Anmeldungen erreicht!`,
    );
  }

  return { ok: true, data: rowToAttendee(data) };
}

export async function updateAttendee(input: {
  workspaceId: string;
  attendeeId: string;
  patch: Partial<Pick<EventAttendee, 'name' | 'email' | 'company' | 'role' | 'status' | 'notes'>>;
}): Promise<ActionResult<EventAttendee>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.patch.name    !== undefined) row.name    = input.patch.name;
  if (input.patch.email   !== undefined) row.email   = input.patch.email || null;
  if (input.patch.company !== undefined) row.company = input.patch.company || null;
  if (input.patch.role    !== undefined) row.role    = input.patch.role;
  if (input.patch.status  !== undefined) row.status  = input.patch.status;
  if (input.patch.notes   !== undefined) row.notes   = input.patch.notes || null;

  const { data, error } = await supabase
    .from('event_attendees')
    .update(row)
    .eq('id', input.attendeeId)
    .eq('workspace_id', ctx.uuid)
    .select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: rowToAttendee(data) };
}

export async function deleteAttendee(input: {
  workspaceId: string;
  attendeeId: string;
}): Promise<ActionResult<null>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const { error } = await supabase
    .from('event_attendees')
    .delete()
    .eq('id', input.attendeeId)
    .eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// ── Partners ──────────────────────────────────────────────────────────────

export async function listEventPartners(
  workspaceId: string,
  projectId: string,
): Promise<EventPartner[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('event_partners')
    .select()
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  return (data ?? []).map(rowToPartner);
}

export async function createEventPartner(input: {
  workspaceId: string;
  projectId: string;
  name: string;
  contactPerson?: string;
  email?: string;
  status?: PartnerStatus;
  package?: string;
  deliverables?: string;
  notes?: string;
}): Promise<ActionResult<EventPartner>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };

  const { data, error } = await supabase
    .from('event_partners')
    .insert({
      workspace_id:   ctx.uuid,
      project_id:     input.projectId,
      name:           input.name,
      contact_person: input.contactPerson ?? null,
      email:          input.email ?? null,
      status:         input.status ?? 'lead',
      package:        input.package ?? null,
      deliverables:   input.deliverables ?? null,
      notes:          input.notes ?? null,
    })
    .select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: rowToPartner(data) };
}

export async function updateEventPartner(input: {
  workspaceId: string;
  partnerId: string;
  patch: Partial<Pick<EventPartner,
    'name' | 'contactPerson' | 'email' | 'status' | 'package' |
    'deliverables' | 'logoReceived' | 'invoiceStatus' | 'notes'>>;
}): Promise<ActionResult<EventPartner>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.patch.name           !== undefined) row.name           = input.patch.name;
  if (input.patch.contactPerson  !== undefined) row.contact_person = input.patch.contactPerson || null;
  if (input.patch.email          !== undefined) row.email          = input.patch.email || null;
  if (input.patch.status         !== undefined) row.status         = input.patch.status;
  if (input.patch.package        !== undefined) row.package        = input.patch.package || null;
  if (input.patch.deliverables   !== undefined) row.deliverables   = input.patch.deliverables || null;
  if (input.patch.logoReceived   !== undefined) row.logo_received  = input.patch.logoReceived;
  if (input.patch.invoiceStatus  !== undefined) row.invoice_status = input.patch.invoiceStatus;
  if (input.patch.notes          !== undefined) row.notes          = input.patch.notes || null;

  // Fetch current status to detect transition
  const { data: before } = await supabase
    .from('event_partners').select('status, name, project_id').eq('id', input.partnerId).single();

  const { data, error } = await supabase
    .from('event_partners')
    .update(row)
    .eq('id', input.partnerId)
    .eq('workspace_id', ctx.uuid)
    .select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };

  // Notify on partner status transitions
  if (input.patch.status && before && input.patch.status !== before.status) {
    const newStatus = input.patch.status;
    const pid       = before.project_id as string;
    const pname     = before.name as string;
    const { data: proj } = await supabase.from('projects').select('name').eq('id', pid).single();
    const eventName = proj?.name ?? 'Event';

    if (newStatus === 'confirmed') {
      notifyEventSlack(ctx.uuid, pid,
        `🤝 *${pname}* ist jetzt bestätigter Sponsor/Partner bei *${eventName}*!`);
    } else if (newStatus === 'active') {
      notifyEventSlack(ctx.uuid, pid,
        `✅ Partner *${pname}* ist aktiv bei *${eventName}*.`);
    } else if (newStatus === 'recap_sent') {
      notifyEventSlack(ctx.uuid, pid,
        `📊 Sponsor Report an *${pname}* versendet. *${eventName}* ist abgeschlossen.`);
    }
  }

  // Notify when logo is received
  if (input.patch.logoReceived === true && before && !before.status) {
    const pid = before.project_id as string;
    notifyEventSlack(ctx.uuid, pid,
      `🖼️ Logo von *${before.name}* erhalten.`);
  }

  return { ok: true, data: rowToPartner(data) };
}

export async function deleteEventPartner(input: {
  workspaceId: string;
  partnerId: string;
}): Promise<ActionResult<null>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const { error } = await supabase
    .from('event_partners')
    .delete()
    .eq('id', input.partnerId)
    .eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// ── Approvals ─────────────────────────────────────────────────────────────

function rowToApproval(row: any): EventApproval {
  return {
    id:          row.id,
    projectId:   row.project_id,
    workspaceId: row.workspace_id,
    title:       row.title,
    type:        (row.type ?? 'other') as ApprovalType,
    status:      (row.status ?? 'draft') as ApprovalStatus,
    reviewerId:  row.reviewer_id ?? undefined,
    requestedBy: row.requested_by ?? undefined,
    dueDate:     row.due_date ?? undefined,
    notes:       row.notes ?? undefined,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

export async function listApprovals(
  workspaceId: string,
  projectId: string,
): Promise<EventApproval[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('event_approvals')
    .select()
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  return (data ?? []).map(rowToApproval);
}

export async function createApproval(input: {
  workspaceId: string;
  projectId: string;
  title: string;
  type?: ApprovalType;
  reviewerId?: string;
  dueDate?: string;
  notes?: string;
}): Promise<ActionResult<EventApproval>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };

  const userId = await actor();
  const { data, error } = await supabase
    .from('event_approvals')
    .insert({
      workspace_id:  ctx.uuid,
      project_id:    input.projectId,
      title:         input.title,
      type:          input.type ?? 'other',
      reviewer_id:   input.reviewerId ?? null,
      requested_by:  userId,
      due_date:      input.dueDate ?? null,
      notes:         input.notes ?? null,
    })
    .select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: rowToApproval(data) };
}

export async function updateApproval(input: {
  workspaceId: string;
  approvalId: string;
  patch: Partial<Pick<EventApproval, 'title' | 'type' | 'status' | 'reviewerId' | 'dueDate' | 'notes'>>;
}): Promise<ActionResult<EventApproval>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.patch.title      !== undefined) row.title       = input.patch.title;
  if (input.patch.type       !== undefined) row.type        = input.patch.type;
  if (input.patch.status     !== undefined) row.status      = input.patch.status;
  if (input.patch.reviewerId !== undefined) row.reviewer_id = input.patch.reviewerId || null;
  if (input.patch.dueDate    !== undefined) row.due_date    = input.patch.dueDate || null;
  if (input.patch.notes      !== undefined) row.notes       = input.patch.notes || null;

  const { data, error } = await supabase
    .from('event_approvals')
    .update(row)
    .eq('id', input.approvalId)
    .eq('workspace_id', ctx.uuid)
    .select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };

  // Notify on approval/rejection
  if (input.patch.status === 'approved' || input.patch.status === 'changes_requested') {
    const { data: proj } = await supabase.from('projects').select('name, id').eq('id', data.project_id).single();
    const icon = input.patch.status === 'approved' ? '✅' : '🔄';
    const label = input.patch.status === 'approved' ? 'freigegeben' : 'Änderungen angefordert';
    notifyEventSlack(ctx.uuid, data.project_id,
      `${icon} *${data.title}* wurde ${label} bei *${proj?.name ?? 'Event'}*.`);
  }

  return { ok: true, data: rowToApproval(data) };
}

export async function deleteApproval(input: {
  workspaceId: string;
  approvalId: string;
}): Promise<ActionResult<null>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const { error } = await supabase
    .from('event_approvals')
    .delete()
    .eq('id', input.approvalId)
    .eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// ── Decision Log ──────────────────────────────────────────────────────────

function rowToDecision(row: any): EventDecision {
  return {
    id:          row.id,
    projectId:   row.project_id,
    workspaceId: row.workspace_id,
    decision:    row.decision,
    reason:      row.reason ?? undefined,
    decidedBy:   row.decided_by ?? undefined,
    decidedAt:   row.decided_at,
    impact:      (row.impact ?? undefined) as DecisionImpact | undefined,
    notes:       row.notes ?? undefined,
    createdAt:   row.created_at,
  };
}

export async function listDecisions(
  workspaceId: string,
  projectId: string,
): Promise<EventDecision[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('event_decisions')
    .select()
    .eq('project_id', projectId)
    .order('decided_at', { ascending: false });
  return (data ?? []).map(rowToDecision);
}

export async function createDecision(input: {
  workspaceId: string;
  projectId: string;
  decision: string;
  reason?: string;
  impact?: DecisionImpact;
  notes?: string;
}): Promise<ActionResult<EventDecision>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };

  const userId = await actor();
  const { data, error } = await supabase
    .from('event_decisions')
    .insert({
      workspace_id: ctx.uuid,
      project_id:   input.projectId,
      decision:     input.decision,
      reason:       input.reason ?? null,
      decided_by:   userId,
      impact:       input.impact ?? null,
      notes:        input.notes ?? null,
    })
    .select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: rowToDecision(data) };
}

export async function deleteDecision(input: {
  workspaceId: string;
  decisionId: string;
}): Promise<ActionResult<null>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const { error } = await supabase
    .from('event_decisions')
    .delete()
    .eq('id', input.decisionId)
    .eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
