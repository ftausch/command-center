'use server';
// Create a project seeded from a template. The client passes the full
// task list (title + daysFromStart) so the action doesn't need to import
// mock data — templates live in the frontend data layer.

import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { currentUser, getWorkspaceContext, canWriteAsRole } from '@/lib/auth';
import { postSlackNotification, actorDisplayName } from '@/lib/integrations/slack';
import type { ActionResult, ProjectView, TaskView } from '@/lib/types';

const MANAGER_ROLES = ['owner', 'admin', 'manager'] as const;

interface TemplateTask {
  title: string;
  daysFromStart: number;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function createProjectFromTemplate(input: {
  workspaceId: string;
  name: string;
  startDate: string; // 'YYYY-MM-DD'
  tasks: TemplateTask[];
}): Promise<ActionResult<{ project: ProjectView; tasks: TaskView[] }>> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Projektname darf nicht leer sein.' };
  if (!input.startDate) return { ok: false, error: 'Startdatum erforderlich.' };

  const supabase = createClient();
  const user = await currentUser();
  const userId = user?.id ?? 'fabian';

  // ── Mock mode ──────────────────────────────────────────────────────────────
  if (!supabase) {
    const projectId = randomUUID();
    const project: ProjectView = {
      id: projectId,
      workspace: input.workspaceId,
      name,
      type: 'Template',
      desc: '',
      status: 'Planning',
      priority: 'Medium',
      progress: 0,
      phaseIdx: 0,
      due: addDays(input.startDate, Math.max(...input.tasks.map((t) => t.daysFromStart), 0)),
      owner: userId,
      team: [],
      slackChannel: '',
      slackConnected: false,
    };
    const tasks: TaskView[] = input.tasks.map((t) => ({
      id: randomUUID(),
      workspace: input.workspaceId,
      projectId,
      title: t.title,
      assignee: '',
      status: 'Backlog',
      priority: 'Medium',
      due: addDays(input.startDate, t.daysFromStart),
      tags: [],
    }));
    return { ok: true, data: { project, tasks } };
  }

  // ── Supabase mode ─────────────────────────────────────────────────────────
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace nicht gefunden oder kein Zugriff.' };
  if (!canWriteAsRole(ctx.role, [...MANAGER_ROLES])) {
    return { ok: false, error: 'Nur Manager+ können Projekte aus Templates anlegen.' };
  }

  const maxDay = input.tasks.reduce((m, t) => Math.max(m, t.daysFromStart), 0);

  const { data: proj, error: projErr } = await supabase
    .from('projects')
    .insert({
      workspace_id: ctx.uuid,
      name,
      type: 'Template',
      status: 'Planning',
      priority: 'Medium',
      due_date: addDays(input.startDate, maxDay),
      owner_id: userId,
    })
    .select()
    .single();
  if (projErr || !proj) return { ok: false, error: projErr?.message ?? 'Projekt konnte nicht angelegt werden.' };

  const taskRows = input.tasks.map((t) => ({
    workspace_id: ctx.uuid,
    project_id: proj.id,
    title: t.title,
    status: 'Backlog',
    priority: 'Medium',
    due_date: addDays(input.startDate, t.daysFromStart),
    tags: [],
  }));

  const { data: insertedTasks, error: tasksErr } = await supabase
    .from('tasks')
    .insert(taskRows)
    .select();
  if (tasksErr) return { ok: false, error: tasksErr.message };

  await supabase.from('activity_logs').insert({
    workspace_id: ctx.uuid,
    actor_id: userId,
    kind: 'project_created',
    target_type: 'project',
    target_id: proj.id,
    meta: { name, from_template: true },
  });

  const actorName = await actorDisplayName(userId);
  await postSlackNotification({
    workspaceUuid: ctx.uuid,
    text: `🆕 ${actorName} hat Projekt "${name}" aus einem Template angelegt (${input.tasks.length} Tasks).`,
  });

  const project: ProjectView = {
    id: proj.id,
    workspace: input.workspaceId,
    name: proj.name,
    type: proj.type ?? '',
    desc: proj.description ?? '',
    status: proj.status,
    priority: proj.priority,
    progress: 0,
    phaseIdx: proj.phase_idx ?? 0,
    due: proj.due_date ?? '',
    owner: proj.owner_id ?? '',
    team: [],
    slackChannel: proj.slack_channel ?? '',
    slackConnected: !!proj.slack_connected,
  };

  const tasks: TaskView[] = (insertedTasks ?? []).map((t: any) => ({
    id: t.id,
    workspace: input.workspaceId,
    projectId: t.project_id,
    title: t.title,
    assignee: t.assignee_id ?? '',
    status: t.status,
    priority: t.priority,
    due: t.due_date ?? '',
    tags: t.tags ?? [],
  }));

  console.log(`[template] ✓ "${name}" created with ${tasks.length} tasks`);
  return { ok: true, data: { project, tasks } };
}
