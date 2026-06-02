'use server';
// Task CRUD server actions. Each function:
//   1. validates the caller is a member of the workspace
//   2. enforces a role gate (RLS will re-enforce server-side)
//   3. writes to Supabase + logs activity, OR synthesizes a mock entity
//      when Supabase isn't configured
//   4. returns an ActionResult with the affected entity + activity log so
//      the client can merge into provider state without a refetch
//
// Workspace ID translation: every caller passes the workspace SLUG (the
// UI's stable id, same shape as mock data). `getWorkspaceContext` resolves
// it to the UUID stored in the DB and returns the caller's role in one
// trip. Without that translation, `.eq('workspace_id', slug)` matches zero
// rows (and inserts fail FK validation).

import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { currentUser, getWorkspaceContext, canWriteAsRole } from '@/lib/auth';
import { postSlackNotification, actorDisplayName } from '@/lib/integrations/slack';
import type {
  ActionResult,
  ActivityView,
  TaskPriority,
  TaskStatus,
  TaskView,
  Recurrence,
} from '@/lib/types';

const ASSIGNEE_ROLES = ['owner', 'admin', 'manager', 'member'] as const;
const MANAGER_ROLES = ['owner', 'admin', 'manager'] as const;

function mockActor(): string {
  return 'fabian';
}

async function actor(): Promise<string> {
  const supabase = createClient();
  if (!supabase) return mockActor();
  const u = await currentUser();
  return u?.id ?? mockActor();
}

function synthActivity(params: {
  workspaceId: string; // slug — view shape
  user: string;
  verb: string;
  target: string;
  meta?: string;
  icon: string;
}): ActivityView {
  return {
    id: randomUUID(),
    workspace: params.workspaceId,
    user: params.user,
    verb: params.verb,
    target: params.target,
    meta: params.meta ?? '',
    time: new Date().toISOString(),
    icon: params.icon,
  };
}

function nextDueDate(due: string, rec: Recurrence): string {
  const d = new Date(due + 'T00:00:00');
  const days = rec.type === 'daily'    ? 1
             : rec.type === 'weekly'   ? 7
             : rec.type === 'biweekly' ? 14
             : rec.type === 'monthly'  ? 0
             : 7;
  if (rec.type === 'monthly') {
    d.setMonth(d.getMonth() + 1);
  } else {
    d.setDate(d.getDate() + days);
  }
  return d.toISOString().slice(0, 10);
}

export async function createTask(input: {
  workspaceId: string;
  projectId: string;
  title: string;
  assigneeId?: string;
  due?: string;
  priority?: TaskPriority;
  tags?: string[];
  episodeId?: string;
  recurrence?: Recurrence;
  estimate?: number;
}): Promise<ActionResult<TaskView>> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Title is required' };

  const userId = await actor();
  const supabase = createClient();

  if (!supabase) {
    const task: TaskView = {
      id: randomUUID(),
      workspace: input.workspaceId,
      projectId: input.projectId,
      title,
      assignee: input.assigneeId ?? userId,
      status: 'To Do',
      priority: input.priority ?? 'Medium',
      due: input.due ?? '',
      tags: input.tags ?? [],
    };
    return {
      ok: true,
      data: task,
      activity: synthActivity({
        workspaceId: input.workspaceId,
        user: userId,
        verb: 'hat Task angelegt',
        target: task.id,
        meta: title,
        icon: 'plus',
      }),
    };
  }

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace not found or you are not a member' };
  if (!canWriteAsRole(ctx.role, [...ASSIGNEE_ROLES])) {
    return { ok: false, error: 'You do not have permission to create tasks' };
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      workspace_id: ctx.uuid,
      project_id: input.projectId,
      title,
      assignee_id: input.assigneeId ?? userId,
      due_date: input.due || null,
      priority: input.priority ?? 'Medium',
      tags: input.tags ?? [],
      episode_id: input.episodeId || null,
      recurrence: input.recurrence ?? null,
      estimate:   input.estimate   ?? null,
    })
    .select()
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Insert failed' };

  await supabase.from('activity_logs').insert({
    workspace_id: ctx.uuid,
    actor_id: userId,
    kind: 'task_created',
    target_type: 'task',
    target_id: data.id,
    meta: { title },
  });

  const name = await actorDisplayName(userId);
  await postSlackNotification({
    workspaceUuid: ctx.uuid,
    text: `🆕 ${name} created task: "${title}"`,
  });

  const task: TaskView = {
    id: data.id,
    workspace: input.workspaceId,
    projectId: data.project_id,
    title: data.title,
    assignee: data.assignee_id ?? '',
    status: data.status,
    priority: data.priority,
    due: data.due_date ?? '',
    tags: data.tags ?? [],
    recurrence: data.recurrence ?? undefined,
    estimate:   data.estimate   ?? undefined,
  };
  return {
    ok: true,
    data: task,
    activity: synthActivity({
      workspaceId: input.workspaceId,
      user: userId,
      verb: 'hat Task angelegt',
      target: task.id,
      meta: title,
      icon: 'plus',
    }),
  };
}

export async function updateTask(input: {
  taskId: string;
  workspaceId: string;
  patch: Partial<
    Pick<TaskView, 'title' | 'assignee' | 'due' | 'priority' | 'description' | 'tags' | 'blocker' | 'waitingOn' | 'episodeId' | 'blockedByTaskId' | 'estimate'>
  >;
}): Promise<ActionResult<Partial<TaskView> & { id: string }>> {
  const supabase = createClient();
  if (!supabase) {
    return { ok: true, data: { id: input.taskId, ...input.patch } };
  }

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace not found or you are not a member' };
  if (!canWriteAsRole(ctx.role, [...ASSIGNEE_ROLES])) {
    return { ok: false, error: 'You do not have permission to edit tasks' };
  }

  const row: Record<string, unknown> = {};
  if (input.patch.title !== undefined) row.title = input.patch.title;
  if (input.patch.assignee !== undefined) row.assignee_id = input.patch.assignee || null;
  if (input.patch.due !== undefined) row.due_date = input.patch.due || null;
  if (input.patch.priority !== undefined) row.priority = input.patch.priority;
  if (input.patch.description !== undefined) row.description = input.patch.description || null;
  if (input.patch.tags !== undefined) row.tags = input.patch.tags;
  if (input.patch.blocker !== undefined) row.blocker = input.patch.blocker || null;
  if (input.patch.waitingOn !== undefined) row.waiting_on_id = input.patch.waitingOn || null;
  if (input.patch.episodeId !== undefined) row.episode_id = input.patch.episodeId || null;
  if (input.patch.blockedByTaskId !== undefined) row.blocked_by_task_id = input.patch.blockedByTaskId || null;
  if (input.patch.estimate        !== undefined) row.estimate           = input.patch.estimate ?? null;

  const { error } = await supabase
    .from('tasks')
    .update(row)
    .eq('id', input.taskId)
    .eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: { id: input.taskId, ...input.patch } };
}

export async function changeTaskStatus(input: {
  taskId: string;
  workspaceId: string;
  from: TaskStatus;
  to: TaskStatus;
}): Promise<ActionResult<{ id: string; status: TaskStatus }>> {
  const supabase = createClient();
  const userId = await actor();

  const activity = synthActivity({
    workspaceId: input.workspaceId,
    user: userId,
    verb: 'hat Status geändert',
    target: input.taskId,
    meta: `→ ${input.to}`,
    icon: 'arrow-right',
  });

  if (!supabase) {
    return { ok: true, data: { id: input.taskId, status: input.to }, activity };
  }

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace not found or you are not a member' };
  if (!canWriteAsRole(ctx.role, [...ASSIGNEE_ROLES])) {
    return { ok: false, error: 'You do not have permission to change status' };
  }

  const { error } = await supabase
    .from('tasks')
    .update({ status: input.to })
    .eq('id', input.taskId)
    .eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };

  await supabase.from('activity_logs').insert({
    workspace_id: ctx.uuid,
    actor_id: userId,
    kind: 'task_status_changed',
    target_type: 'task',
    target_id: input.taskId,
    meta: { from: input.from, to: input.to },
  });

  // Only ping Slack on transitions that the team typically wants to see.
  // "Review" is the canonical "someone please look" signal; the others
  // have dedicated actions (markTaskDone, markTaskBlocked) that ping.
  if (input.to === 'Review') {
    const name = await actorDisplayName(userId);
    const { data: task } = await supabase
      .from('tasks')
      .select('title')
      .eq('id', input.taskId)
      .maybeSingle();
    await postSlackNotification({
      workspaceUuid: ctx.uuid,
      text: `👀 ${name} moved task to Review: "${task?.title ?? input.taskId}"`,
    });
  }

  return { ok: true, data: { id: input.taskId, status: input.to }, activity };
}

export async function markTaskDone(input: {
  taskId: string;
  workspaceId: string;
  from: TaskStatus;
}): Promise<ActionResult<{ id: string; status: TaskStatus }>> {
  const supabase = createClient();
  const userId = await actor();

  const activity = synthActivity({
    workspaceId: input.workspaceId,
    user: userId,
    verb: 'hat Task abgeschlossen',
    target: input.taskId,
    icon: 'check',
  });

  if (!supabase) {
    return { ok: true, data: { id: input.taskId, status: 'Done' }, activity };
  }

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace not found or you are not a member' };
  if (!canWriteAsRole(ctx.role, [...ASSIGNEE_ROLES])) {
    return { ok: false, error: 'You do not have permission to complete tasks' };
  }

  const { error } = await supabase
    .from('tasks')
    .update({ status: 'Done' })
    .eq('id', input.taskId)
    .eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };

  await supabase.from('activity_logs').insert({
    workspace_id: ctx.uuid,
    actor_id: userId,
    kind: 'task_completed',
    target_type: 'task',
    target_id: input.taskId,
    meta: { from: input.from },
  });

  const name = await actorDisplayName(userId);
  const { data: task } = await supabase
    .from('tasks')
    .select('title')
    .eq('id', input.taskId)
    .maybeSingle();
  await postSlackNotification({
    workspaceUuid: ctx.uuid,
    text: `✅ ${name} completed task: "${task?.title ?? input.taskId}"`,
  });

  // Fire outbound webhook + auto-archive project if all tasks done
  const { data: fullTask } = await supabase
    .from('tasks')
    .select('project_id, episode_id, assignee_id')
    .eq('id', input.taskId)
    .maybeSingle();

  if (task?.title) {
    const { OutboundEvents } = await import('@/lib/integrations/outbound');
    OutboundEvents.taskDone(ctx.uuid, {
      id:        input.taskId,
      title:     task.title,
      projectId: fullTask?.project_id ?? undefined,
      episodeId: fullTask?.episode_id ?? undefined,
      assignee:  fullTask?.assignee_id ?? undefined,
    }).catch(() => {});
  }

  // Auto-archive: if all project tasks are Done, set project status to Done
  let archivedProjectId: string | null = null;
  if (fullTask?.project_id) {
    const { count } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', fullTask.project_id)
      .neq('status', 'Done');

    if (count === 0) {
      // All tasks done — archive the project
      const { error: archErr } = await supabase
        .from('projects')
        .update({ status: 'Done' })
        .eq('id', fullTask.project_id)
        .eq('workspace_id', ctx.uuid)
        .neq('status', 'Done');

      if (!archErr) {
        archivedProjectId = fullTask.project_id;
        await postSlackNotification({
          workspaceUuid: ctx.uuid,
          text: `📦 Projekt automatisch archiviert — alle Tasks erledigt!`,
        });
      }
    }
  }

  // Auto-spawn next recurrence if task has a recurrence rule
  let spawnedTask: TaskView | null = null;
  const { data: recTask } = await supabase
    .from('tasks')
    .select('title, project_id, assignee_id, priority, due_date, recurrence, episode_id')
    .eq('id', input.taskId).maybeSingle();

  if (recTask?.recurrence && recTask.due_date) {
    const rec: Recurrence = recTask.recurrence as Recurrence;
    const nextDue = nextDueDate(recTask.due_date, rec);
    const { data: newTask } = await supabase.from('tasks').insert({
      workspace_id: ctx.uuid,
      project_id:   recTask.project_id,
      title:        recTask.title,
      assignee_id:  recTask.assignee_id ?? userId,
      due_date:     nextDue,
      priority:     recTask.priority ?? 'Medium',
      recurrence:   rec,
      episode_id:   recTask.episode_id ?? null,
    }).select().single();
    if (newTask) {
      spawnedTask = {
        id: newTask.id, workspace: input.workspaceId,
        projectId: newTask.project_id, title: newTask.title,
        assignee: newTask.assignee_id ?? '', status: newTask.status,
        priority: newTask.priority, due: newTask.due_date ?? '',
        recurrence: rec,
      };
    }
  }

  const result: any = { ok: true, data: { id: input.taskId, status: 'Done' }, activity };
  if (archivedProjectId) result.archivedProjectId = archivedProjectId;
  if (spawnedTask) result.spawnedTask = spawnedTask;
  return result;
}

export async function markTaskBlocked(input: {
  taskId: string;
  workspaceId: string;
  reason?: string;
}): Promise<ActionResult<{ id: string; status: TaskStatus; blocker: string | null }>> {
  const supabase = createClient();
  const userId = await actor();

  const reason = input.reason?.trim() || null;
  const activity = synthActivity({
    workspaceId: input.workspaceId,
    user: userId,
    verb: 'hat Task blockiert',
    target: input.taskId,
    meta: reason ?? 'Blocker gemeldet',
    icon: 'block',
  });

  if (!supabase) {
    return {
      ok: true,
      data: { id: input.taskId, status: 'Blocked', blocker: reason },
      activity,
    };
  }

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace not found or you are not a member' };
  if (!canWriteAsRole(ctx.role, [...ASSIGNEE_ROLES])) {
    return { ok: false, error: 'You do not have permission to block tasks' };
  }

  const { error } = await supabase
    .from('tasks')
    .update({ status: 'Blocked', blocker: reason })
    .eq('id', input.taskId)
    .eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };

  await supabase.from('activity_logs').insert({
    workspace_id: ctx.uuid,
    actor_id: userId,
    kind: 'task_blocked',
    target_type: 'task',
    target_id: input.taskId,
    meta: { reason },
  });

  const name = await actorDisplayName(userId);
  const { data: task } = await supabase
    .from('tasks')
    .select('title')
    .eq('id', input.taskId)
    .maybeSingle();
  await postSlackNotification({
    workspaceUuid: ctx.uuid,
    text: `🚫 ${name} blocked task: "${task?.title ?? input.taskId}"${reason ? ` — ${reason}` : ''}`,
  });

  return {
    ok: true,
    data: { id: input.taskId, status: 'Blocked', blocker: reason },
    activity,
  };
}

export async function bulkUpdateTasks(input: {
  workspaceId: string;
  taskIds: string[];
  patch: Partial<Pick<TaskView, 'status' | 'priority' | 'assignee'>>;
}): Promise<ActionResult<{ updated: number }>> {
  if (!input.taskIds.length) return { ok: true, data: { updated: 0 } };
  const supabase = createClient();
  if (!supabase) return { ok: true, data: { updated: input.taskIds.length } };

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace not found or you are not a member' };
  if (!canWriteAsRole(ctx.role, [...ASSIGNEE_ROLES])) {
    return { ok: false, error: 'You do not have permission to edit tasks' };
  }

  const row: Record<string, unknown> = {};
  if (input.patch.status !== undefined) row.status = input.patch.status;
  if (input.patch.priority !== undefined) row.priority = input.patch.priority;
  if (input.patch.assignee !== undefined) row.assignee_id = input.patch.assignee || null;

  const { error, count } = await supabase
    .from('tasks')
    .update(row)
    .in('id', input.taskIds)
    .eq('workspace_id', ctx.uuid)
    .select('id');
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { updated: input.taskIds.length } };
}

export async function bulkDeleteTasks(input: {
  workspaceId: string;
  taskIds: string[];
}): Promise<ActionResult<{ deleted: number }>> {
  if (!input.taskIds.length) return { ok: true, data: { deleted: 0 } };
  const supabase = createClient();
  if (!supabase) return { ok: true, data: { deleted: input.taskIds.length } };

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace not found or you are not a member' };
  if (!canWriteAsRole(ctx.role, [...MANAGER_ROLES])) {
    return { ok: false, error: 'Only managers+ can delete tasks' };
  }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .in('id', input.taskIds)
    .eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { deleted: input.taskIds.length } };
}

export async function deleteTask(input: {
  taskId: string;
  workspaceId: string;
}): Promise<ActionResult<{ id: string }>> {
  const supabase = createClient();
  if (!supabase) return { ok: true, data: { id: input.taskId } };

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace not found or you are not a member' };
  if (!canWriteAsRole(ctx.role, [...MANAGER_ROLES])) {
    return { ok: false, error: 'Only managers+ can delete tasks' };
  }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', input.taskId)
    .eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { id: input.taskId } };
}
