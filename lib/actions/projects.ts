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
  ProjectResource,
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

function inferDivision(type?: string): import('@/lib/types').Division {
  if (!type) return 'general';
  if (['Episode', 'Recording', 'Clips', 'Newsletter'].includes(type)) return 'podcast';
  if (['Event', 'Workshop', 'Shoot'].includes(type)) return 'events';
  return 'general';
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
  division?: import('@/lib/types').Division;
  eventMeta?: import('@/lib/types').EventMeta;
  /** Client-generated UUID — prevents duplicate inserts on double-submit. */
  idempotencyId?: string;
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
      division: input.division ?? inferDivision(input.type),
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

  const division = input.division ?? inferDivision(input.type);
  const insertRow: Record<string, unknown> = {
    workspace_id: ctx.uuid,
    name,
    type: input.type ?? 'Episode',
    division,
    description: input.description ?? null,
    status: input.status ?? 'Planning',
    priority: input.priority ?? 'Medium',
    due_date: input.due || null,
    owner_id: input.ownerId ?? userId,
    ...(input.eventMeta ? { event_meta: input.eventMeta } : {}),
  };
  if (input.idempotencyId) insertRow.id = input.idempotencyId;

  const { data, error } = await supabase
    .from('projects')
    .insert(insertRow)
    .select()
    .single();
  // Conflict on id = duplicate submit — look up the existing row and return it.
  if (error?.code === '23505') {
    const { data: existing } = await supabase
      .from('projects').select().eq('id', input.idempotencyId!).single();
    if (existing) {
      return {
        ok: true,
        data: {
          id: existing.id, workspace: input.workspaceId, name: existing.name,
          type: existing.type ?? '', desc: existing.description ?? '',
          status: existing.status, priority: existing.priority,
          progress: existing.progress ?? 0, phaseIdx: existing.phase_idx ?? 0,
          due: existing.due_date ?? '', owner: existing.owner_id ?? '',
          team: [], division: (existing.division ?? 'general') as any,
          slackChannel: existing.slack_channel ?? '',
          slackConnected: !!existing.slack_connected,
        },
      };
    }
  }
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
    division: (data.division ?? division) as import('@/lib/types').Division,
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
      | 'eventMeta'
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
  if (input.patch.eventMeta !== undefined) row.event_meta = input.patch.eventMeta;

  // Fetch division + current status + name for event notifications
  const { data: existing } = await supabase
    .from('projects').select('division, status, name').eq('id', input.projectId).single();

  const { error } = await supabase
    .from('projects')
    .update(row)
    .eq('id', input.projectId)
    .eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };

  // Notify event Slack channel on key status transitions
  if (
    existing?.division === 'events' &&
    input.patch.status &&
    input.patch.status !== existing.status
  ) {
    const newStatus  = input.patch.status;
    const eventName  = existing.name as string;
    let text: string | null = null;

    if (newStatus === 'In Progress') {
      text = `🚀 *${eventName}* ist jetzt in Vorbereitung — alle Systeme go!`;
    } else if (newStatus === 'Done') {
      text = `🎉 *${eventName}* ist abgeschlossen. Zeit für den Recap!`;
    } else if (newStatus === 'Blocked') {
      text = `⚠️ *${eventName}* ist blockiert. Bitte prüfen!`;
    }

    if (text) {
      const { postMessageToChannel, postSlackNotification } = await import('@/lib/integrations/slack');
      const { data: res } = await supabase
        .from('project_resources')
        .select('external_id')
        .eq('workspace_id', ctx.uuid)
        .eq('project_id', input.projectId)
        .eq('type', 'slack_channel')
        .maybeSingle();
      if (res?.external_id) {
        postMessageToChannel(res.external_id, text).catch(() => {});
      } else {
        postSlackNotification({ workspaceUuid: ctx.uuid, text }).catch(() => {});
      }
    }
  }

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

// ── Workspace Setup ───────────────────────────────────────────────────────

import { safeSlackChannelName } from '@/lib/workspace-utils';
export { safeSlackChannelName };

export async function setupProjectWorkspace(input: {
  projectId: string;
  workspaceId: string;
  setupSlack: boolean;
  slackChannelName: string;
  postSetupMessage: boolean;
  projectName: string;
  projectType?: string;
  setupDrive?: boolean;
}): Promise<ActionResult<{ resources: ProjectResource[] }>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace nicht gefunden.' };
  if (!canWriteAsRole(ctx.role, [...MANAGER_ROLES])) {
    return { ok: false, error: 'Nur Manager+ können Workspace-Ressourcen anlegen.' };
  }

  const userId = await actor();
  const resources: ProjectResource[] = [];
  const warnings: string[] = [];

  if (input.setupSlack && input.slackChannelName.trim()) {
    const channelName = safeSlackChannelName(input.slackChannelName);

    // Phase 1B: attempt real channel creation via Bot Token.
    const { createSlackChannel, postMessageToChannel } = await import('@/lib/integrations/slack');
    const created = await createSlackChannel(channelName);

    const slackUrl = created?.url
      ?? `https://slack.com/app_redirect?channel=${encodeURIComponent(channelName)}`;
    const channelId = created?.channelId ?? null;

    if (!created) {
      // SLACK_BOT_TOKEN not set — log and continue (Phase 1A behaviour).
      warnings.push('Slack-Channel wurde nicht erstellt (kein Bot Token konfiguriert). Channel-Name wurde gespeichert.');
    } else if (created.alreadyExisted) {
      warnings.push(`Slack-Channel #${channelName} existiert bereits — Projekt wurde damit verknüpft.`);
    }

    // Save to project_resources
    const { data: resRow, error: resErr } = await supabase
      .from('project_resources')
      .insert({
        workspace_id: ctx.uuid,
        project_id:   input.projectId,
        type:         'slack_channel',
        provider:     'slack',
        name:         `#${channelName}`,
        url:          slackUrl,
        external_id:  channelId,
        metadata:     {
          channel_name: channelName,
          channel_id:   channelId,
          project_type: input.projectType ?? '',
          created_via_api: !!created && !created.alreadyExisted,
        },
        created_by:   userId,
      })
      .select()
      .single();

    if (resErr) {
      console.error('[setupWorkspace] project_resources insert failed', resErr.message);
      warnings.push('Slack-Ressource konnte nicht gespeichert werden.');
    } else {
      resources.push({
        id:         resRow.id,
        projectId:  input.projectId,
        type:       'slack_channel',
        provider:   'slack',
        externalId: channelId,
        name:       `#${channelName}`,
        url:        slackUrl,
        createdAt:  resRow.created_at,
      });

      // Update projects.slack_channel
      await supabase
        .from('projects')
        .update({ slack_channel: `#${channelName}`, slack_connected: true })
        .eq('id', input.projectId)
        .eq('workspace_id', ctx.uuid);
    }

    // Post setup message: prefer direct channel post (Bot), fall back to webhook.
    if (input.postSetupMessage) {
      const typeLabel = input.projectType ? ` (${input.projectType})` : '';
      const setupText = [
        `🚀 *Workspace bereit: ${input.projectName}*${typeLabel}`,
        `📋 Projekt angelegt in Command Center`,
        `💬 Slack-Channel: *#${channelName}*`,
        `🔗 <https://team.unicornbakery.de|Command Center öffnen>`,
      ].join('\n');

      if (channelId) {
        // Post directly to the new channel via Bot Token.
        await postMessageToChannel(channelId, setupText);
      } else {
        // Fallback: use incoming webhook (goes to its fixed channel).
        const { postSlackNotification } = await import('@/lib/integrations/slack');
        await postSlackNotification({
          workspaceUuid: ctx.uuid,
          text: setupText,
          channelLabel: 'workspace-setup',
        });
      }
    }
  }

  // ── Google Drive folder ───────────────────────────────────────────────────
  if (input.setupDrive) {
    const { createProjectFolder } = await import('@/lib/integrations/drive');
    const folder = await createProjectFolder(input.projectName);

    if (!folder) {
      warnings.push('Google Drive Ordner konnte nicht erstellt werden (Drive nicht konfiguriert oder Fehler).');
    } else {
      const { data: driveRow, error: driveErr } = await supabase
        .from('project_resources')
        .insert({
          workspace_id: ctx.uuid,
          project_id:   input.projectId,
          type:         'drive_folder',
          provider:     'google_drive',
          external_id:  folder.folderId,
          name:         folder.folderName,
          url:          folder.url,
          metadata:     { subfolders: folder.subfolders },
          created_by:   userId,
        })
        .select()
        .single();

      if (driveErr) {
        console.error('[setupWorkspace] drive insert failed:', driveErr.message);
        warnings.push('Drive-Ressource konnte nicht gespeichert werden.');
      } else {
        resources.push({
          id:         driveRow.id,
          projectId:  input.projectId,
          type:       'drive_folder',
          provider:   'google_drive',
          externalId: folder.folderId,
          name:       folder.folderName,
          url:        folder.url,
          createdAt:  driveRow.created_at,
        });
      }
    }
  }

  // Activity log
  await supabase.from('activity_logs').insert({
    workspace_id: ctx.uuid,
    actor_id:     userId,
    kind:         'project_created',
    target_type:  'project',
    target_id:    input.projectId,
    meta:         { setup: true, slack: input.setupSlack, drive: !!input.setupDrive, resources: resources.length },
  });

  const result: ActionResult<{ resources: ProjectResource[] }> = {
    ok:   true,
    data: { resources },
  };
  if (warnings.length) result.warning = warnings.join(' ');
  return result;
}

// ── Duplicate event project ────────────────────────────────────────────────
// Creates a copy of an event project with "(Kopie)" suffix and copies all
// its tasks (resetting status to "To Do" and clearing assignees).

export async function duplicateEventProject(input: {
  projectId: string;
  workspaceId: string;
  newName?: string;
}): Promise<ActionResult<ProjectView>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace nicht gefunden.' };
  if (!canWriteAsRole(ctx.role, [...MANAGER_ROLES])) {
    return { ok: false, error: 'Nur Manager+ können Events duplizieren.' };
  }

  const userId = await actor();

  // Fetch source project
  const { data: src, error: srcErr } = await supabase
    .from('projects').select().eq('id', input.projectId).eq('workspace_id', ctx.uuid).single();
  if (srcErr || !src) return { ok: false, error: 'Quell-Projekt nicht gefunden.' };

  const newName = input.newName ?? `${src.name} (Kopie)`;

  const { data: newProj, error: projErr } = await supabase
    .from('projects')
    .insert({
      workspace_id: ctx.uuid,
      name:         newName,
      type:         src.type,
      division:     src.division ?? 'events',
      description:  src.description,
      status:       'Planning',
      priority:     src.priority,
      due_date:     src.due_date,
      owner_id:     userId,
      event_meta:   src.event_meta,
    })
    .select().single();
  if (projErr || !newProj) return { ok: false, error: projErr?.message ?? 'Duplizieren fehlgeschlagen.' };

  // Copy tasks — reset status + assignee
  const { data: srcTasks } = await supabase
    .from('tasks').select().eq('project_id', input.projectId).eq('workspace_id', ctx.uuid);

  if (srcTasks?.length) {
    await supabase.from('tasks').insert(
      srcTasks.map((t: any) => ({
        workspace_id: ctx.uuid,
        project_id:   newProj.id,
        title:        t.title,
        status:       'To Do',
        priority:     t.priority,
        due_date:     t.due_date,
        assignee_id:  null,
        tags:         t.tags ?? [],
      }))
    );
  }

  const project: ProjectView = {
    id: newProj.id, workspace: input.workspaceId, name: newProj.name,
    type: newProj.type ?? '', division: (newProj.division ?? 'events') as import('@/lib/types').Division,
    desc: newProj.description ?? '', status: newProj.status, priority: newProj.priority,
    progress: 0, phaseIdx: 0, due: newProj.due_date ?? '', owner: userId,
    team: [], slackChannel: '', slackConnected: false,
    eventMeta: newProj.event_meta ?? undefined,
  };

  return { ok: true, data: project };
}

// ── Project Resources ─────────────────────────────────────────────────────

export async function addProjectResource(input: {
  workspaceId: string;
  projectId: string;
  type: ProjectResource['type'];
  provider: ProjectResource['provider'];
  name: string;
  url?: string;
  externalId?: string;
}): Promise<ActionResult<ProjectResource>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };

  const { data, error } = await supabase
    .from('project_resources')
    .insert({
      workspace_id: ctx.uuid,
      project_id:   input.projectId,
      type:         input.type,
      provider:     input.provider,
      name:         input.name,
      url:          input.url ?? null,
      external_id:  input.externalId ?? null,
    })
    .select().single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler.' };

  return {
    ok: true,
    data: {
      id:         data.id,
      projectId:  data.project_id,
      type:       data.type,
      provider:   data.provider,
      externalId: data.external_id ?? null,
      name:       data.name,
      url:        data.url ?? null,
      createdAt:  data.created_at,
    },
  };
}

export async function deleteProjectResource(input: {
  workspaceId: string;
  resourceId: string;
}): Promise<ActionResult<null>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx || !canWriteAsRole(ctx.role, [...MANAGER_ROLES]))
    return { ok: false, error: 'Keine Berechtigung.' };
  const { error } = await supabase
    .from('project_resources')
    .delete()
    .eq('id', input.resourceId)
    .eq('workspace_id', ctx.uuid);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function postEventRecapToSlack(input: {
  workspaceId: string;
  projectId:   string;
  projectName: string;
  tasksTotal:  number;
  tasksDone:   number;
  notes?:      string;
}): Promise<ActionResult<null>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace nicht gefunden.' };

  const progress = input.tasksTotal > 0
    ? `${input.tasksDone}/${input.tasksTotal} Tasks erledigt`
    : '';
  const notesLine = input.notes?.trim() ? `\n📝 ${input.notes.trim()}` : '';
  const siteUrl = 'https://team.unicornbakery.de';

  await postSlackNotification({
    workspaceUuid: ctx.uuid,
    text: [
      `🎉 Event abgeschlossen: *${input.projectName}*`,
      progress ? `✅ ${progress}` : '',
      notesLine,
      `<${siteUrl}|Recap im Command Center öffnen →>`,
    ].filter(Boolean).join('\n'),
  });

  return { ok: true, data: null };
}
