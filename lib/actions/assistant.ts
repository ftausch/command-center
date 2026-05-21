'use server';

import { createClient } from '@/lib/supabase/server';
import { currentUser, getWorkspaceContext, canWriteAsRole } from '@/lib/auth';
import { postSlackNotification } from '@/lib/integrations/slack';
import type { ActionResult, AssistantItem, AssistantItemStatus, AssistantItemType, AssistantPriority } from '@/lib/types';

const MANAGER_ROLES = ['owner', 'admin', 'manager'] as const;
const MEMBER_ROLES  = ['owner', 'admin', 'manager', 'member'] as const;

async function actor() {
  const u = await currentUser();
  return u?.id ?? null;
}

function rowToItem(row: any): AssistantItem {
  return {
    id:               row.id,
    workspaceId:      row.workspace_id,
    ownerId:          row.owner_id          ?? undefined,
    createdBy:        row.created_by        ?? undefined,
    relatedProjectId: row.related_project_id?? undefined,
    title:            row.title,
    description:      row.description       ?? undefined,
    type:             row.type              as AssistantItemType,
    status:           row.status            as AssistantItemStatus,
    priority:         row.priority          ?? undefined,
    contactName:      row.contact_name      ?? undefined,
    contactEmail:     row.contact_email     ?? undefined,
    company:          row.company           ?? undefined,
    dueDate:          row.due_date          ?? undefined,
    nextFollowUpAt:   row.next_follow_up_at ?? undefined,
    lastContactedAt:  row.last_contacted_at ?? undefined,
    snoozedUntil:     row.snoozed_until     ?? undefined,
    metadata:         row.metadata          ?? {},
    sensitivity:      row.sensitivity       ?? 'normal',
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  };
}

export async function listAssistantItems(workspaceId: string): Promise<AssistantItem[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const ctx = await getWorkspaceContext(workspaceId);
  if (!ctx) return [];
  const { data } = await supabase
    .from('assistant_items')
    .select()
    .eq('workspace_id', ctx.uuid)
    .neq('status', 'cancelled')
    .order('due_date',   { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  return (data ?? []).map(rowToItem);
}

export async function createAssistantItem(input: {
  workspaceId: string;
  title: string;
  type?: AssistantItemType;
  priority?: AssistantPriority;
  contactName?: string;
  contactEmail?: string;
  company?: string;
  dueDate?: string;
  description?: string;
  relatedProjectId?: string;
  ownerId?: string;
  sensitivity?: string;
  metadata?: Record<string, unknown>;
}): Promise<ActionResult<AssistantItem>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MEMBER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const userId = await actor();

  const { data, error } = await supabase
    .from('assistant_items')
    .insert({
      workspace_id:        ctx.uuid,
      owner_id:            input.ownerId ?? userId,
      created_by:          userId,
      related_project_id:  input.relatedProjectId ?? null,
      title:               input.title,
      description:         input.description ?? null,
      type:                input.type ?? 'follow_up',
      status:              'open',
      priority:            input.priority ?? null,
      contact_name:        input.contactName ?? null,
      contact_email:       input.contactEmail ?? null,
      company:             input.company ?? null,
      due_date:            input.dueDate ?? null,
      sensitivity:         input.sensitivity ?? 'normal',
      metadata:            input.metadata ?? {},
    })
    .select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: rowToItem(data) };
}

export async function updateAssistantItem(input: {
  workspaceId: string;
  itemId: string;
  patch: Partial<Pick<AssistantItem,
    'title' | 'description' | 'type' | 'status' | 'priority' |
    'contactName' | 'contactEmail' | 'company' | 'dueDate' |
    'nextFollowUpAt' | 'lastContactedAt' | 'snoozedUntil' |
    'ownerId' | 'relatedProjectId'>>;
}): Promise<ActionResult<AssistantItem>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MEMBER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.patch.title          !== undefined) row.title              = input.patch.title;
  if (input.patch.description    !== undefined) row.description        = input.patch.description || null;
  if (input.patch.type           !== undefined) row.type               = input.patch.type;
  if (input.patch.status         !== undefined) row.status             = input.patch.status;
  if (input.patch.priority       !== undefined) row.priority           = input.patch.priority || null;
  if (input.patch.contactName    !== undefined) row.contact_name       = input.patch.contactName || null;
  if (input.patch.contactEmail   !== undefined) row.contact_email      = input.patch.contactEmail || null;
  if (input.patch.company        !== undefined) row.company            = input.patch.company || null;
  if (input.patch.dueDate        !== undefined) row.due_date           = input.patch.dueDate || null;
  if (input.patch.nextFollowUpAt !== undefined) row.next_follow_up_at  = input.patch.nextFollowUpAt || null;
  if (input.patch.lastContactedAt!== undefined) row.last_contacted_at  = input.patch.lastContactedAt || null;
  if (input.patch.snoozedUntil   !== undefined) row.snoozed_until      = input.patch.snoozedUntil || null;
  if (input.patch.ownerId        !== undefined) row.owner_id           = input.patch.ownerId || null;
  if (input.patch.relatedProjectId!==undefined) row.related_project_id = input.patch.relatedProjectId || null;
  if ((input.patch as any).sensitivity !== undefined) row.sensitivity  = (input.patch as any).sensitivity;
  if ((input.patch as any).metadata    !== undefined) row.metadata     = (input.patch as any).metadata;

  const { data, error } = await supabase
    .from('assistant_items')
    .update(row)
    .eq('id', input.itemId)
    .eq('workspace_id', ctx.uuid)
    .select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: rowToItem(data) };
}

export async function deleteAssistantItem(input: {
  workspaceId: string;
  itemId: string;
}): Promise<ActionResult<null>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const { error } = await supabase
    .from('assistant_items')
    .delete()
    .eq('id', input.itemId)
    .eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// Snooze helpers
export async function snoozeItem(input: {
  workspaceId: string;
  itemId: string;
  days: number;
}): Promise<ActionResult<AssistantItem>> {
  const until = new Date();
  until.setDate(until.getDate() + input.days);
  return updateAssistantItem({
    workspaceId: input.workspaceId,
    itemId: input.itemId,
    patch: { status: 'waiting', snoozedUntil: until.toISOString() },
  });
}

// Slack notification when a meeting is confirmed in the Scheduling tab
export async function notifyMeetingConfirmed(input: {
  workspaceId: string;
  title: string;
  participants?: string;
  confirmedDate: string;
}): Promise<void> {
  try {
    const ctx = await getWorkspaceContext(input.workspaceId);
    if (!ctx) return;

    const d = new Date(input.confirmedDate);
    const dateStr = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeStr = input.confirmedDate.includes('T')
      ? d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      : '';

    const who = input.participants ? ` mit ${input.participants}` : '';
    const when = timeStr ? `${dateStr} um ${timeStr} Uhr` : dateStr;

    await postSlackNotification({
      workspaceUuid: ctx.uuid,
      text: `📅 Termin bestätigt: *${input.title}*${who} — ${when}`,
    });
  } catch (e) {
    console.error('[assistant] notifyMeetingConfirmed failed:', e);
  }
}
