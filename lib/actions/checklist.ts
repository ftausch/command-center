'use server';
// Task checklist server actions. No checklist UI exists yet — these are
// here so the API surface is complete for the next phase.

import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { currentUser, getWorkspaceContext, canWriteAsRole } from '@/lib/auth';
import type {
  ActionResult,
  ActivityView,
  TaskChecklistItemView,
} from '@/lib/types';

const ITEM_ROLES = ['owner', 'admin', 'manager', 'member'] as const;

async function actor(): Promise<string> {
  const supabase = createClient();
  if (!supabase) return 'fabian';
  const u = await currentUser();
  return u?.id ?? 'fabian';
}

export async function addChecklistItem(input: {
  workspaceId: string;
  taskId: string;
  label: string;
  position?: number;
}): Promise<ActionResult<TaskChecklistItemView>> {
  const label = input.label.trim();
  if (!label) return { ok: false, error: 'Label is required' };

  const supabase = createClient();

  if (!supabase) {
    const item: TaskChecklistItemView = {
      id: randomUUID(),
      taskId: input.taskId,
      label,
      done: false,
      position: input.position ?? 0,
    };
    return { ok: true, data: item };
  }

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace not found or you are not a member' };
  if (!canWriteAsRole(ctx.role, [...ITEM_ROLES])) {
    return { ok: false, error: 'You do not have permission to add checklist items' };
  }

  const { data, error } = await supabase
    .from('task_checklist_items')
    .insert({
      workspace_id: ctx.uuid,
      task_id: input.taskId,
      label,
      position: input.position ?? 0,
    })
    .select()
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Insert failed' };
  return {
    ok: true,
    data: {
      id: data.id,
      taskId: data.task_id,
      label: data.label,
      done: data.done,
      position: data.position,
    },
  };
}

export async function toggleChecklistItem(input: {
  workspaceId: string;
  taskId: string;
  itemId: string;
  done: boolean;
}): Promise<ActionResult<{ id: string; done: boolean }>> {
  const supabase = createClient();
  const userId = await actor();

  const activity: ActivityView | undefined = input.done
    ? {
        id: randomUUID(),
        workspace: input.workspaceId,
        user: userId,
        verb: 'completed Checklist Item',
        target: input.taskId,
        meta: '',
        time: new Date().toISOString(),
        icon: 'check',
      }
    : undefined;

  if (!supabase) {
    return { ok: true, data: { id: input.itemId, done: input.done }, activity };
  }

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace not found or you are not a member' };
  if (!canWriteAsRole(ctx.role, [...ITEM_ROLES])) {
    return { ok: false, error: 'You do not have permission to update checklist' };
  }

  const { error } = await supabase
    .from('task_checklist_items')
    .update({ done: input.done })
    .eq('id', input.itemId)
    .eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };

  if (input.done) {
    await supabase.from('activity_logs').insert({
      workspace_id: ctx.uuid,
      actor_id: userId,
      kind: 'checklist_item_done',
      target_type: 'task',
      target_id: input.taskId,
      meta: { item_id: input.itemId },
    });
  }

  return { ok: true, data: { id: input.itemId, done: input.done }, activity };
}

// Load all checklist items for a single task. Same reason as
// listTaskComments — items live per-task and aren't preloaded by the
// workspace fetch; the TaskDrawer calls this on open.
export async function listTaskChecklist(input: {
  workspaceId: string;
  taskId: string;
}): Promise<ActionResult<TaskChecklistItemView[]>> {
  const supabase = createClient();
  if (!supabase) return { ok: true, data: [] };

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace not found or you are not a member' };

  const { data, error } = await supabase
    .from('task_checklist_items')
    .select('id, task_id, label, done, position')
    .eq('workspace_id', ctx.uuid)
    .eq('task_id', input.taskId)
    .order('position', { ascending: true });
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    data: (data ?? []).map((r): TaskChecklistItemView => ({
      id: r.id,
      taskId: r.task_id,
      label: r.label,
      done: r.done,
      position: r.position,
    })),
  };
}
