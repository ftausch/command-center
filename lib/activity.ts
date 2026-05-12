// Activity-log helpers. One thin wrapper per ActivityKind so callers don't
// have to remember target_type strings or meta shapes. Every helper writes
// using the *server* client (auth.uid() == actor) so RLS validates the row.
// When Supabase isn't configured the helpers no-op so callers don't need to
// branch on env.

import { createClient } from '@/lib/supabase/server';
import type { ActivityKind, TaskStatus } from '@/lib/types';

interface LogParams {
  workspaceId: string;
  actorId: string;
  kind: ActivityKind;
  targetType: 'task' | 'project' | 'comment' | 'checklist_item';
  targetId: string;
  meta?: Record<string, unknown>;
}

async function logActivity(p: LogParams): Promise<void> {
  const supabase = createClient();
  if (!supabase) return; // mock mode — silently skip
  const { error } = await supabase.from('activity_logs').insert({
    workspace_id: p.workspaceId,
    actor_id: p.actorId,
    kind: p.kind,
    target_type: p.targetType,
    target_id: p.targetId,
    meta: p.meta ?? null,
  });
  if (error) {
    // Surface but don't throw — activity logging must never block a user
    // action. Production should pipe these to an error reporter.
    console.error('[activity] insert failed', error);
  }
}

export function logTaskCreated(p: {
  workspaceId: string;
  actorId: string;
  taskId: string;
  title?: string;
}) {
  return logActivity({
    workspaceId: p.workspaceId,
    actorId: p.actorId,
    kind: 'task_created',
    targetType: 'task',
    targetId: p.taskId,
    meta: p.title ? { title: p.title } : undefined,
  });
}

export function logTaskAssigned(p: {
  workspaceId: string;
  actorId: string;
  taskId: string;
  assigneeId: string;
}) {
  return logActivity({
    workspaceId: p.workspaceId,
    actorId: p.actorId,
    kind: 'task_assigned',
    targetType: 'task',
    targetId: p.taskId,
    meta: { assignee_id: p.assigneeId },
  });
}

export function logTaskStatusChanged(p: {
  workspaceId: string;
  actorId: string;
  taskId: string;
  from: TaskStatus;
  to: TaskStatus;
}) {
  return logActivity({
    workspaceId: p.workspaceId,
    actorId: p.actorId,
    kind: 'task_status_changed',
    targetType: 'task',
    targetId: p.taskId,
    meta: { from: p.from, to: p.to },
  });
}

export function logTaskCompleted(p: {
  workspaceId: string;
  actorId: string;
  taskId: string;
}) {
  return logActivity({
    workspaceId: p.workspaceId,
    actorId: p.actorId,
    kind: 'task_completed',
    targetType: 'task',
    targetId: p.taskId,
  });
}

export function logTaskBlocked(p: {
  workspaceId: string;
  actorId: string;
  taskId: string;
  reason?: string;
}) {
  return logActivity({
    workspaceId: p.workspaceId,
    actorId: p.actorId,
    kind: 'task_blocked',
    targetType: 'task',
    targetId: p.taskId,
    meta: p.reason ? { reason: p.reason } : undefined,
  });
}

export function logProjectCreated(p: {
  workspaceId: string;
  actorId: string;
  projectId: string;
  name?: string;
}) {
  return logActivity({
    workspaceId: p.workspaceId,
    actorId: p.actorId,
    kind: 'project_created',
    targetType: 'project',
    targetId: p.projectId,
    meta: p.name ? { name: p.name } : undefined,
  });
}

export function logCommentAdded(p: {
  workspaceId: string;
  actorId: string;
  taskId: string;
  commentId: string;
}) {
  return logActivity({
    workspaceId: p.workspaceId,
    actorId: p.actorId,
    kind: 'comment_added',
    targetType: 'task',
    targetId: p.taskId,
    meta: { comment_id: p.commentId },
  });
}

export function logChecklistItemDone(p: {
  workspaceId: string;
  actorId: string;
  taskId: string;
  itemId: string;
}) {
  return logActivity({
    workspaceId: p.workspaceId,
    actorId: p.actorId,
    kind: 'checklist_item_done',
    targetType: 'task',
    targetId: p.taskId,
    meta: { item_id: p.itemId },
  });
}
