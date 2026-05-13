'use server';
// Task comment server actions.

import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { currentUser, getWorkspaceContext, canWriteAsRole } from '@/lib/auth';
import { postSlackNotification, actorDisplayName } from '@/lib/integrations/slack';
import type { ActionResult, ActivityView, TaskCommentView } from '@/lib/types';

const COMMENT_ROLES = ['owner', 'admin', 'manager', 'member'] as const;

async function actor(): Promise<string> {
  const supabase = createClient();
  if (!supabase) return 'fabian';
  const u = await currentUser();
  return u?.id ?? 'fabian';
}

export async function addTaskComment(input: {
  workspaceId: string;
  taskId: string;
  body: string;
}): Promise<ActionResult<TaskCommentView>> {
  const body = input.body.trim();
  if (!body) return { ok: false, error: 'Comment cannot be empty' };

  const supabase = createClient();
  const userId = await actor();
  const now = new Date().toISOString();

  const activity: ActivityView = {
    id: randomUUID(),
    workspace: input.workspaceId,
    user: userId,
    verb: 'commented on',
    target: input.taskId,
    meta: body.length > 80 ? body.slice(0, 77) + '…' : body,
    time: now,
    icon: 'message',
  };

  if (!supabase) {
    const comment: TaskCommentView = {
      id: randomUUID(),
      taskId: input.taskId,
      author: userId,
      time: now,
      text: body,
    };
    return { ok: true, data: comment, activity };
  }

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace not found or you are not a member' };
  if (!canWriteAsRole(ctx.role, [...COMMENT_ROLES])) {
    return { ok: false, error: 'You do not have permission to comment' };
  }

  const { data, error } = await supabase
    .from('task_comments')
    .insert({
      workspace_id: ctx.uuid,
      task_id: input.taskId,
      author_id: userId,
      body,
    })
    .select()
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Insert failed' };

  await supabase.from('activity_logs').insert({
    workspace_id: ctx.uuid,
    actor_id: userId,
    kind: 'comment_added',
    target_type: 'task',
    target_id: input.taskId,
    meta: { comment_id: data.id },
  });

  const name = await actorDisplayName(userId);
  const { data: task } = await supabase
    .from('tasks')
    .select('title')
    .eq('id', input.taskId)
    .maybeSingle();
  const preview = body.length > 120 ? body.slice(0, 117) + '…' : body;
  await postSlackNotification({
    workspaceUuid: ctx.uuid,
    text: `💬 ${name} commented on "${task?.title ?? input.taskId}": ${preview}`,
  });

  return {
    ok: true,
    data: {
      id: data.id,
      taskId: data.task_id,
      author: data.author_id,
      time: data.created_at,
      text: data.body,
    },
    activity,
  };
}
