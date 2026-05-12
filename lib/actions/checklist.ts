'use server';
// Task checklist server actions. No checklist UI exists yet — these are
// here so the API surface is complete for the next phase.

import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { currentUser, getWorkspaceRole, canWriteAsRole } from '@/lib/auth';
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
  const userId = await actor();

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

  const role = await getWorkspaceRole(input.workspaceId);
  if (!canWriteAsRole(role, [...ITEM_ROLES])) {
    return { ok: false, error: 'You do not have permission to add checklist items' };
  }

  const { data, error } = await supabase
    .from('task_checklist_items')
    .insert({
      workspace_id: input.workspaceId,
      task_id: input.taskId,
      label,
      position: input.position ?? 0,
    })
    .select()
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Insert failed' };
  void userId;
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

  const role = await getWorkspaceRole(input.workspaceId);
  if (!canWriteAsRole(role, [...ITEM_ROLES])) {
    return { ok: false, error: 'You do not have permission to update checklist' };
  }

  const { error } = await supabase
    .from('task_checklist_items')
    .update({ done: input.done })
    .eq('id', input.itemId)
    .eq('workspace_id', input.workspaceId);
  if (error) return { ok: false, error: error.message };

  if (input.done) {
    await supabase.from('activity_logs').insert({
      workspace_id: input.workspaceId,
      actor_id: userId,
      kind: 'checklist_item_done',
      target_type: 'task',
      target_id: input.taskId,
      meta: { item_id: input.itemId },
    });
  }

  return { ok: true, data: { id: input.itemId, done: input.done }, activity };
}
