'use server';
// Event Operations — CRUD for Run-of-Show, Attendees, Partners/Sponsors.
// All writes require manager+ role via has_workspace_role RLS.

import { createClient } from '@/lib/supabase/server';
import { getWorkspaceContext, canWriteAsRole, currentUser } from '@/lib/auth';
import type {
  ActionResult,
  EventAgendaItem,
  EventAttendee,
  EventPartner,
  AgendaStatus,
  AttendeeRole,
  AttendeeStatus,
  PartnerStatus,
  InvoiceStatus,
} from '@/lib/types';

const MANAGER_ROLES = ['owner', 'admin', 'manager'] as const;

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

  const { data, error } = await supabase
    .from('event_agenda_items')
    .update(row)
    .eq('id', input.itemId)
    .eq('workspace_id', ctx.uuid)
    .select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
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

  const { data, error } = await supabase
    .from('event_partners')
    .update(row)
    .eq('id', input.partnerId)
    .eq('workspace_id', ctx.uuid)
    .select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
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
