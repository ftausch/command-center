'use server';

import { createClient } from '@/lib/supabase/server';
import { getWorkspaceContext, canWriteAsRole } from '@/lib/auth';
import { currentUser } from '@/lib/auth';
import type { ActionResult } from '@/lib/types';

const MEMBER_ROLES = ['owner', 'admin', 'manager', 'member'] as const;

export interface NewsletterIssue {
  id: string;
  workspaceId: string;
  issueNumber: number | null;
  subject: string;
  status: 'idea' | 'draft' | 'review' | 'scheduled' | 'sent';
  audience?: string;
  sendDate?: string;
  openRate?: number;
  clickRate?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

function rowToIssue(row: any): NewsletterIssue {
  return {
    id:          row.id,
    workspaceId: row.workspace_id,
    issueNumber: row.issue_number ?? null,
    subject:     row.subject,
    status:      row.status,
    audience:    row.audience    ?? undefined,
    sendDate:    row.send_date   ?? undefined,
    openRate:    row.open_rate   ?? undefined,
    clickRate:   row.click_rate  ?? undefined,
    description: row.description ?? undefined,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

export async function listNewsletterIssues(workspaceId: string): Promise<NewsletterIssue[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const ctx = await getWorkspaceContext(workspaceId);
  if (!ctx) return [];
  const { data } = await supabase
    .from('newsletter_issues').select()
    .eq('workspace_id', ctx.uuid)
    .order('send_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  return (data ?? []).map(rowToIssue);
}

export async function createNewsletterIssue(input: {
  workspaceId: string; subject: string;
  issueNumber?: number; audience?: string;
  sendDate?: string; description?: string;
}): Promise<ActionResult<NewsletterIssue>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MEMBER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const { data, error } = await supabase.from('newsletter_issues').insert({
    workspace_id:  ctx.uuid,
    subject:       input.subject,
    issue_number:  input.issueNumber ?? null,
    audience:      input.audience ?? null,
    send_date:     input.sendDate ?? null,
    description:   input.description ?? null,
    status:        'idea',
  }).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: rowToIssue(data) };
}

export async function updateNewsletterIssue(input: {
  workspaceId: string; issueId: string;
  patch: Partial<Pick<NewsletterIssue, 'subject' | 'status' | 'issueNumber' | 'audience' | 'sendDate' | 'openRate' | 'clickRate' | 'description'>>;
}): Promise<ActionResult<NewsletterIssue>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MEMBER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const p = input.patch;
  if (p.subject      !== undefined) row.subject      = p.subject;
  if (p.status       !== undefined) row.status       = p.status;
  if (p.issueNumber  !== undefined) row.issue_number = p.issueNumber ?? null;
  if (p.audience     !== undefined) row.audience     = p.audience || null;
  if (p.sendDate     !== undefined) row.send_date    = p.sendDate || null;
  if (p.openRate     !== undefined) row.open_rate    = p.openRate ?? null;
  if (p.clickRate    !== undefined) row.click_rate   = p.clickRate ?? null;
  if (p.description  !== undefined) row.description  = p.description || null;
  const { data, error } = await supabase.from('newsletter_issues')
    .update(row).eq('id', input.issueId).eq('workspace_id', ctx.uuid).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: rowToIssue(data) };
}

export async function deleteNewsletterIssue(input: { workspaceId: string; issueId: string }): Promise<ActionResult<null>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MEMBER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const { error } = await supabase.from('newsletter_issues')
    .delete().eq('id', input.issueId).eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
