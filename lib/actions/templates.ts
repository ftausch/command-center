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
      division: 'general',
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
    division: (proj.division ?? 'general') as import('@/lib/types').Division,
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

// ── Episode Template ───────────────────────────────────────────────────────
// Standard podcast production tasks, auto-assigned by member specialty.
// daysBeforeDue: how many days before the project due_date each task is due.

const EPISODE_TASKS: {
  title: string;
  specialty: string;
  daysBeforeDue: number;
  priority: 'High' | 'Medium' | 'Low';
  phase: string;
}[] = [
  { title: 'Gast bestätigen & Briefing senden',     specialty: 'manager',   daysBeforeDue: 21, priority: 'High',   phase: 'Booking'      },
  { title: 'Aufnahme durchführen',                   specialty: 'host',      daysBeforeDue: 14, priority: 'High',   phase: 'Aufnahme'     },
  { title: 'Transkript erstellen',                    specialty: 'editor',    daysBeforeDue: 10, priority: 'Medium', phase: 'Produktion'   },
  { title: 'Audio schneiden & produzieren',           specialty: 'editor',    daysBeforeDue: 7,  priority: 'High',   phase: 'Produktion'   },
  { title: 'Thumbnail designen',                      specialty: 'thumbnail', daysBeforeDue: 5,  priority: 'Medium', phase: 'Publishing'   },
  { title: 'Show Notes schreiben',                    specialty: 'shownotes', daysBeforeDue: 4,  priority: 'Medium', phase: 'Publishing'   },
  { title: 'Social Media Posts erstellen',            specialty: 'social',    daysBeforeDue: 2,  priority: 'Medium', phase: 'Publishing'   },
  { title: 'Episode veröffentlichen & distribuieren', specialty: 'manager',   daysBeforeDue: 0,  priority: 'High',   phase: 'Publishing'   },
];

export const EPISODE_TEMPLATE_PREVIEW = EPISODE_TASKS.map((t) => ({
  title: t.title,
  phase: t.phase,
  specialty: t.specialty,
}));

function subtractDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function applyEpisodeTemplate(input: {
  projectId: string;
  workspaceId: string;
  /** Project due date (YYYY-MM-DD). Used to calculate task deadlines. */
  dueDate?: string;
}): Promise<ActionResult<{ count: number }>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace nicht gefunden.' };
  if (!canWriteAsRole(ctx.role, [...MANAGER_ROLES])) {
    return { ok: false, error: 'Nur Manager+ können Tasks erstellen.' };
  }

  const userId = (await currentUser())?.id ?? null;

  // Load workspace members with their specialty to auto-assign tasks.
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, profiles!inner(specialty)')
    .eq('workspace_id', ctx.uuid);

  const specialtyMap: Record<string, string> = {};
  for (const m of members ?? []) {
    const s = (m.profiles as any)?.specialty as string | null;
    if (s && !specialtyMap[s]) specialtyMap[s] = m.user_id as string;
  }

  const today = new Date().toISOString().slice(0, 10);
  const baseDate = input.dueDate ?? today;

  const taskRows = EPISODE_TASKS.map((t) => ({
    workspace_id: ctx.uuid,
    project_id:   input.projectId,
    title:        t.title,
    status:       'To Do',
    priority:     t.priority,
    due_date:     subtractDays(baseDate, t.daysBeforeDue),
    assignee_id:  specialtyMap[t.specialty] ?? null,
    tags:         [t.phase],
  }));

  const { data: inserted, error } = await supabase
    .from('tasks')
    .insert(taskRows)
    .select('id');
  if (error) return { ok: false, error: error.message };

  await supabase.from('activity_logs').insert({
    workspace_id: ctx.uuid,
    actor_id:     userId,
    kind:         'project_created',
    target_type:  'project',
    target_id:    input.projectId,
    meta:         { template: 'episode', tasks_created: inserted?.length ?? 0 },
  });

  console.log(`[template] ✓ episode template applied — ${inserted?.length} tasks created`);
  return { ok: true, data: { count: inserted?.length ?? 0 } };
}
