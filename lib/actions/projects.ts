'use server';
// Project CRUD server actions. Only managers/admins/owners can create or
// update projects (RLS re-enforces). Workspace slug → UUID translation
// handled via getWorkspaceContext, same pattern as tasks.ts.

import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { currentUser, getWorkspaceContext, canWriteAsRole } from '@/lib/auth';
import { postSlackNotification, actorDisplayName } from '@/lib/integrations/slack';
import type {
  ActionResult,
  ActivityView,
  ProjectMemberRole,
  ProjectMemberView,
  ProjectStatus,
  ProjectView,
  TaskPriority,
} from '@/lib/types';

const MANAGER_ROLES = ['owner', 'admin', 'manager'] as const;

async function actor(): Promise<string> {
  const supabase = createClient();
  if (!supabase) return 'fabian';
  const u = await currentUser();
  return u?.id ?? 'fabian';
}

function synthActivity(p: {
  workspaceId: string;
  user: string;
  verb: string;
  target: string;
  meta?: string;
  icon: string;
}): ActivityView {
  return {
    id: randomUUID(),
    workspace: p.workspaceId,
    user: p.user,
    verb: p.verb,
    target: p.target,
    meta: p.meta ?? '',
    time: new Date().toISOString(),
    icon: p.icon,
  };
}

export async function createProject(input: {
  workspaceId: string;
  name: string;
  type?: string;
  description?: string;
  ownerId?: string;
  due?: string;
  priority?: TaskPriority;
  status?: ProjectStatus;
}): Promise<ActionResult<ProjectView>> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Name is required' };

  const supabase = createClient();
  const userId = await actor();

  if (!supabase) {
    const project: ProjectView = {
      id: randomUUID(),
      workspace: input.workspaceId,
      name,
      type: input.type ?? 'Episode',
      desc: input.description ?? '',
      status: input.status ?? 'Planning',
      priority: input.priority ?? 'Medium',
      progress: 0,
      phaseIdx: 0,
      due: input.due ?? '',
      owner: input.ownerId ?? userId,
      team: [userId],
      slackChannel: '',
      slackConnected: false,
    };
    return {
      ok: true,
      data: project,
      activity: synthActivity({
        workspaceId: input.workspaceId,
        user: userId,
        verb: 'hat Projekt angelegt',
        target: project.id,
        meta: name,
        icon: 'plus',
      }),
    };
  }

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace not found or you are not a member' };
  if (!canWriteAsRole(ctx.role, [...MANAGER_ROLES])) {
    return { ok: false, error: 'Only managers+ can create projects' };
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      workspace_id: ctx.uuid,
      name,
      type: input.type ?? 'Episode',
      description: input.description ?? null,
      status: input.status ?? 'Planning',
      priority: input.priority ?? 'Medium',
      due_date: input.due || null,
      owner_id: input.ownerId ?? userId,
    })
    .select()
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Insert failed' };

  // Add creator as project manager so they retain access under project-level RLS.
  await supabase.from('project_members').insert({
    workspace_id: ctx.uuid,
    project_id:   data.id,
    user_id:      userId,
    role:         'manager',
  }).then(({ error: e }) => {
    if (e) console.error('[createProject] project_members insert failed:', e.message);
  });

  await supabase.from('activity_logs').insert({
    workspace_id: ctx.uuid,
    actor_id: userId,
    kind: 'project_created',
    target_type: 'project',
    target_id: data.id,
    meta: { name },
  });

  const actorName = await actorDisplayName(userId);
  await postSlackNotification({
    workspaceUuid: ctx.uuid,
    text: `🆕 ${actorName} created project: "${name}"`,
  });

  const project: ProjectView = {
    id: data.id,
    workspace: input.workspaceId,
    name: data.name,
    type: data.type ?? '',
    desc: data.description ?? '',
    status: data.status,
    priority: data.priority,
    progress: data.progress ?? 0,
    phaseIdx: data.phase_idx ?? 0,
    due: data.due_date ?? '',
    owner: data.owner_id ?? '',
    team: [],
    slackChannel: data.slack_channel ?? '',
    slackConnected: !!data.slack_connected,
  };

  return {
    ok: true,
    data: project,
    activity: synthActivity({
      workspaceId: input.workspaceId,
      user: userId,
      verb: 'hat Projekt angelegt',
      target: project.id,
      meta: name,
      icon: 'plus',
    }),
  };
}

export async function deleteProject(input: {
  projectId: string;
  workspaceId: string;
}): Promise<ActionResult<{ id: string }>> {
  const supabase = createClient();
  if (!supabase) return { ok: true, data: { id: input.projectId } };

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace not found or you are not a member' };
  if (!canWriteAsRole(ctx.role, [...MANAGER_ROLES])) {
    return { ok: false, error: 'Only managers+ can delete projects' };
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', input.projectId)
    .eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };

  console.log(`[deleteProject] ✓ ${input.projectId} deleted`);
  return { ok: true, data: { id: input.projectId } };
}

export async function updateProject(input: {
  projectId: string;
  workspaceId: string;
  patch: Partial<
    Pick<
      ProjectView,
      | 'name'
      | 'type'
      | 'desc'
      | 'status'
      | 'priority'
      | 'progress'
      | 'phaseIdx'
      | 'due'
      | 'owner'
      | 'slackChannel'
      | 'slackConnected'
    >
  >;
}): Promise<ActionResult<Partial<ProjectView> & { id: string }>> {
  const supabase = createClient();
  if (!supabase) return { ok: true, data: { id: input.projectId, ...input.patch } };

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace not found or you are not a member' };
  if (!canWriteAsRole(ctx.role, [...MANAGER_ROLES])) {
    return { ok: false, error: 'Only managers+ can edit projects' };
  }

  const row: Record<string, unknown> = {};
  if (input.patch.name !== undefined) row.name = input.patch.name;
  if (input.patch.type !== undefined) row.type = input.patch.type;
  if (input.patch.desc !== undefined) row.description = input.patch.desc;
  if (input.patch.status !== undefined) row.status = input.patch.status;
  if (input.patch.priority !== undefined) row.priority = input.patch.priority;
  if (input.patch.progress !== undefined) row.progress = input.patch.progress;
  if (input.patch.phaseIdx !== undefined) row.phase_idx = input.patch.phaseIdx;
  if (input.patch.due !== undefined) row.due_date = input.patch.due || null;
  if (input.patch.owner !== undefined) row.owner_id = input.patch.owner || null;
  if (input.patch.slackChannel !== undefined) row.slack_channel = input.patch.slackChannel || null;
  if (input.patch.slackConnected !== undefined) row.slack_connected = input.patch.slackConnected;

  const { error } = await supabase
    .from('projects')
    .update(row)
    .eq('id', input.projectId)
    .eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: { id: input.projectId, ...input.patch } };
}

// ── Project member management ─────────────────────────────────────────────

export async function addProjectMember(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  role: ProjectMemberRole;
}): Promise<ActionResult<ProjectMemberView>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Not configured' };

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace nicht gefunden oder kein Zugriff.' };
  if (!canWriteAsRole(ctx.role, [...MANAGER_ROLES])) {
    return { ok: false, error: 'Nur Manager+ können Projektmitglieder hinzufügen.' };
  }

  const { data, error } = await supabase
    .from('project_members')
    .insert({ workspace_id: ctx.uuid, project_id: input.projectId, user_id: input.userId, role: input.role })
    .select('id, project_id, user_id, role, profiles!inner(full_name, email)')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Insert failed' };

  return {
    ok: true,
    data: {
      id:        data.id,
      projectId: data.project_id,
      userId:    data.user_id,
      role:      data.role as ProjectMemberRole,
      name:      ((data as any).profiles?.full_name ?? (data as any).profiles?.email ?? data.user_id) as string,
      email:     ((data as any).profiles?.email ?? '') as string,
    },
  };
}

export async function removeProjectMember(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
}): Promise<ActionResult<{ userId: string }>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Not configured' };

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace nicht gefunden oder kein Zugriff.' };
  if (!canWriteAsRole(ctx.role, [...MANAGER_ROLES])) {
    return { ok: false, error: 'Nur Manager+ können Projektmitglieder entfernen.' };
  }

  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', input.projectId)
    .eq('user_id', input.userId)
    .eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: { userId: input.userId } };
}

export async function updateProjectMemberRole(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  role: ProjectMemberRole;
}): Promise<ActionResult<{ userId: string; role: ProjectMemberRole }>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Not configured' };

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace nicht gefunden oder kein Zugriff.' };
  if (!canWriteAsRole(ctx.role, [...MANAGER_ROLES])) {
    return { ok: false, error: 'Nur Manager+ können Projektrollen ändern.' };
  }

  const { error } = await supabase
    .from('project_members')
    .update({ role: input.role })
    .eq('project_id', input.projectId)
    .eq('user_id', input.userId)
    .eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: { userId: input.userId, role: input.role } };
}
