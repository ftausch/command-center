'use server';
// Operations: Approval Center, Decision Center, Risk Board — workspace-wide.

import { createClient } from '@/lib/supabase/server';
import { getWorkspaceContext, canWriteAsRole, currentUser } from '@/lib/auth';
import type { ActionResult } from '@/lib/types';

const MANAGER_ROLES = ['owner', 'admin', 'manager'] as const;
const MEMBER_ROLES  = ['owner', 'admin', 'manager', 'member'] as const;

async function actor() {
  const u = await currentUser();
  return u?.id ?? null;
}

// ── Shared row mapper helpers ──────────────────────────────────────────────

function rowToApproval(row: any) {
  return {
    id: row.id, workspaceId: row.workspace_id,
    relatedProjectId: row.related_project_id ?? undefined,
    relatedTaskId:    row.related_task_id    ?? undefined,
    createdBy:        row.created_by         ?? undefined,
    reviewerId:       row.reviewer_id        ?? undefined,
    title: row.title, description: row.description ?? undefined,
    type: row.type, status: row.status,
    priority: row.priority ?? undefined,
    dueDate:  row.due_date ?? undefined,
    notes:    row.notes    ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function rowToDecision(row: any) {
  return {
    id: row.id, workspaceId: row.workspace_id,
    relatedProjectId:  row.related_project_id  ?? undefined,
    createdBy:         row.created_by           ?? undefined,
    decisionOwnerId:   row.decision_owner_id    ?? undefined,
    title: row.title, context: row.context ?? undefined,
    optionA: row.option_a ?? undefined, optionB: row.option_b ?? undefined,
    optionC: row.option_c ?? undefined,
    recommendation: row.recommendation ?? undefined,
    status: row.status,
    neededBy:       row.needed_by        ?? undefined,
    decisionResult: row.decision_result  ?? undefined,
    impact:         row.impact           ?? undefined,
    notes:          row.notes            ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function rowToRisk(row: any) {
  return {
    id: row.id, workspaceId: row.workspace_id,
    relatedProjectId: row.related_project_id ?? undefined,
    relatedTaskId:    row.related_task_id    ?? undefined,
    createdBy:        row.created_by         ?? undefined,
    ownerId:          row.owner_id           ?? undefined,
    title: row.title, description: row.description ?? undefined,
    type: row.type, severity: row.severity, status: row.status,
    impact:          row.impact           ?? undefined,
    mitigationPlan:  row.mitigation_plan  ?? undefined,
    dueDate:         row.due_date         ?? undefined,
    resolvedAt:      row.resolved_at      ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

// ── Approvals ─────────────────────────────────────────────────────────────

export async function listApprovalItems(workspaceId: string) {
  const supabase = createClient();
  if (!supabase) return [];
  const ctx = await getWorkspaceContext(workspaceId);
  if (!ctx) return [];
  const { data } = await supabase
    .from('approval_items').select()
    .eq('workspace_id', ctx.uuid)
    .neq('status', 'cancelled')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  return (data ?? []).map(rowToApproval);
}

export async function createApprovalItem(input: {
  workspaceId: string; title: string; type?: string; priority?: string;
  reviewerId?: string; dueDate?: string; description?: string;
  relatedProjectId?: string; notes?: string;
}): Promise<ActionResult<any>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const userId = await actor();
  const { data, error } = await supabase.from('approval_items').insert({
    workspace_id: ctx.uuid, created_by: userId,
    title: input.title, type: input.type ?? 'other',
    priority: input.priority ?? null, status: 'draft',
    reviewer_id: input.reviewerId ?? null,
    due_date: input.dueDate ?? null,
    description: input.description ?? null,
    related_project_id: input.relatedProjectId ?? null,
    notes: input.notes ?? null,
  }).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: rowToApproval(data) };
}

export async function updateApprovalItem(input: {
  workspaceId: string; itemId: string; patch: Record<string, unknown>;
}): Promise<ActionResult<any>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Nicht gefunden.' };
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const p = input.patch;
  if (p.title       !== undefined) row.title        = p.title;
  if (p.status      !== undefined) row.status       = p.status;
  if (p.priority    !== undefined) row.priority     = p.priority || null;
  if (p.reviewerId  !== undefined) row.reviewer_id  = p.reviewerId || null;
  if (p.dueDate     !== undefined) row.due_date     = p.dueDate || null;
  if (p.notes       !== undefined) row.notes        = p.notes || null;
  if (p.description !== undefined) row.description  = p.description || null;
  if (p.type        !== undefined) row.type         = p.type;
  if (p.relatedProjectId !== undefined) row.related_project_id = p.relatedProjectId || null;
  const { data, error } = await supabase.from('approval_items')
    .update(row).eq('id', input.itemId).eq('workspace_id', ctx.uuid).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: rowToApproval(data) };
}

export async function deleteApprovalItem(input: { workspaceId: string; itemId: string }): Promise<ActionResult<null>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const { error } = await supabase.from('approval_items')
    .delete().eq('id', input.itemId).eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// ── Decisions ─────────────────────────────────────────────────────────────

export async function listDecisionItems(workspaceId: string) {
  const supabase = createClient();
  if (!supabase) return [];
  const ctx = await getWorkspaceContext(workspaceId);
  if (!ctx) return [];
  const { data } = await supabase
    .from('decision_items').select()
    .eq('workspace_id', ctx.uuid)
    .neq('status', 'cancelled')
    .order('needed_by', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  return (data ?? []).map(rowToDecision);
}

export async function createDecisionItem(input: {
  workspaceId: string; title: string; context?: string;
  optionA?: string; optionB?: string; optionC?: string;
  recommendation?: string; decisionOwnerId?: string;
  neededBy?: string; impact?: string; notes?: string;
  relatedProjectId?: string;
}): Promise<ActionResult<any>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const userId = await actor();
  const { data, error } = await supabase.from('decision_items').insert({
    workspace_id: ctx.uuid, created_by: userId, status: 'open',
    title: input.title, context: input.context ?? null,
    option_a: input.optionA ?? null, option_b: input.optionB ?? null,
    option_c: input.optionC ?? null, recommendation: input.recommendation ?? null,
    decision_owner_id: input.decisionOwnerId ?? null,
    needed_by: input.neededBy ?? null, impact: input.impact ?? null,
    notes: input.notes ?? null,
    related_project_id: input.relatedProjectId ?? null,
  }).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: rowToDecision(data) };
}

export async function updateDecisionItem(input: {
  workspaceId: string; itemId: string; patch: Record<string, unknown>;
}): Promise<ActionResult<any>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Nicht gefunden.' };
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const p = input.patch;
  const fields: Record<string, string> = {
    title: 'title', status: 'status', context: 'context',
    optionA: 'option_a', optionB: 'option_b', optionC: 'option_c',
    recommendation: 'recommendation', decisionOwnerId: 'decision_owner_id',
    neededBy: 'needed_by', decisionResult: 'decision_result',
    impact: 'impact', notes: 'notes', relatedProjectId: 'related_project_id',
  };
  Object.entries(fields).forEach(([k, v]) => {
    if (p[k] !== undefined) row[v] = p[k] || null;
  });
  const { data, error } = await supabase.from('decision_items')
    .update(row).eq('id', input.itemId).eq('workspace_id', ctx.uuid).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: rowToDecision(data) };
}

export async function deleteDecisionItem(input: { workspaceId: string; itemId: string }): Promise<ActionResult<null>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const { error } = await supabase.from('decision_items')
    .delete().eq('id', input.itemId).eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// ── Risks ─────────────────────────────────────────────────────────────────

export async function listRiskItems(workspaceId: string) {
  const supabase = createClient();
  if (!supabase) return [];
  const ctx = await getWorkspaceContext(workspaceId);
  if (!ctx) return [];
  const { data } = await supabase
    .from('risk_items').select()
    .eq('workspace_id', ctx.uuid)
    .neq('status', 'ignored')
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false });
  return (data ?? []).map(rowToRisk);
}

export async function createRiskItem(input: {
  workspaceId: string; title: string; type?: string; severity?: string;
  description?: string; impact?: string; mitigationPlan?: string;
  ownerId?: string; dueDate?: string; relatedProjectId?: string;
}): Promise<ActionResult<any>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const userId = await actor();
  const { data, error } = await supabase.from('risk_items').insert({
    workspace_id: ctx.uuid, created_by: userId, status: 'open',
    title: input.title, type: input.type ?? 'risk',
    severity: input.severity ?? 'medium',
    description: input.description ?? null,
    impact: input.impact ?? null,
    mitigation_plan: input.mitigationPlan ?? null,
    owner_id: input.ownerId ?? null,
    due_date: input.dueDate ?? null,
    related_project_id: input.relatedProjectId ?? null,
  }).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: rowToRisk(data) };
}

export async function updateRiskItem(input: {
  workspaceId: string; itemId: string; patch: Record<string, unknown>;
}): Promise<ActionResult<any>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Nicht gefunden.' };
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const p = input.patch;
  const fields: Record<string, string> = {
    title: 'title', status: 'status', type: 'type', severity: 'severity',
    description: 'description', impact: 'impact', mitigationPlan: 'mitigation_plan',
    ownerId: 'owner_id', dueDate: 'due_date', resolvedAt: 'resolved_at',
    relatedProjectId: 'related_project_id',
  };
  Object.entries(fields).forEach(([k, v]) => {
    if (p[k] !== undefined) row[v] = p[k] || null;
  });
  const { data, error } = await supabase.from('risk_items')
    .update(row).eq('id', input.itemId).eq('workspace_id', ctx.uuid).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };
  return { ok: true, data: rowToRisk(data) };
}

export async function deleteRiskItem(input: { workspaceId: string; itemId: string }): Promise<ActionResult<null>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const { error } = await supabase.from('risk_items')
    .delete().eq('id', input.itemId).eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
