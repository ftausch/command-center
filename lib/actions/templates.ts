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

// ── Event Templates ────────────────────────────────────────────────────────

export type EventTemplateId =
  | 'networking'
  | 'founder_dinner'
  | 'pickleball'
  | 'sponsorship';

interface EventTemplateTask {
  title: string;
  phase: string;
  daysBeforeDue: number;
  priority: 'High' | 'Medium' | 'Low';
}

const EVENT_TEMPLATES: Record<EventTemplateId, { name: string; desc: string; tasks: EventTemplateTask[] }> = {
  networking: {
    name: 'Networking Event',
    desc: 'Klassisches Networking-Format: Location, Kommunikation, Ablauf.',
    tasks: [
      { title: 'Konzept & Zielgruppe definieren',        phase: 'Konzept',           daysBeforeDue: 42, priority: 'High'   },
      { title: 'Location scouten & buchen',              phase: 'Location',          daysBeforeDue: 35, priority: 'High'   },
      { title: 'Partner / Sponsor ansprechen',           phase: 'Partner/Sponsor',   daysBeforeDue: 28, priority: 'Medium' },
      { title: 'Landingpage erstellen',                  phase: 'Landingpage',       daysBeforeDue: 21, priority: 'High'   },
      { title: 'Email-Kampagne & Social Posts',          phase: 'Kommunikation',     daysBeforeDue: 14, priority: 'Medium' },
      { title: 'Anmeldungen verwalten & bestätigen',    phase: 'Teilnehmer',        daysBeforeDue: 7,  priority: 'Medium' },
      { title: 'Ablaufplan & Briefing erstellen',        phase: 'Ablaufplan',        daysBeforeDue: 5,  priority: 'High'   },
      { title: 'Aufbau & Produktion vor Ort',            phase: 'Produktion vor Ort',daysBeforeDue: 0,  priority: 'High'   },
      { title: 'Nachbericht & Fotos zusammenstellen',   phase: 'Nachbereitung',     daysBeforeDue: -3, priority: 'Medium' },
      { title: 'Content Recap veröffentlichen',          phase: 'Content Recap',     daysBeforeDue: -7, priority: 'Medium' },
    ],
  },
  founder_dinner: {
    name: 'Founder Dinner',
    desc: 'Exklusives Dinner-Format für Gründer & Investoren.',
    tasks: [
      { title: 'Gästeliste & Kuratierung',               phase: 'Konzept',           daysBeforeDue: 28, priority: 'High'   },
      { title: 'Restaurant / Location buchen',           phase: 'Location',          daysBeforeDue: 21, priority: 'High'   },
      { title: 'Sponsor für Dinner gewinnen',            phase: 'Partner/Sponsor',   daysBeforeDue: 14, priority: 'Medium' },
      { title: 'Einladungen verschicken',                phase: 'Kommunikation',     daysBeforeDue: 14, priority: 'High'   },
      { title: 'Bestätigungen & Sitzplan',               phase: 'Teilnehmer',        daysBeforeDue: 5,  priority: 'High'   },
      { title: 'Ablauf & Moderationsnotizen',            phase: 'Ablaufplan',        daysBeforeDue: 2,  priority: 'Medium' },
      { title: 'Dinner durchführen',                     phase: 'Produktion vor Ort',daysBeforeDue: 0,  priority: 'High'   },
      { title: 'Danke-Nachricht & Follow-up',            phase: 'Nachbereitung',     daysBeforeDue: -2, priority: 'Medium' },
      { title: 'Sponsor Report',                         phase: 'Sponsor Report',    daysBeforeDue: -7, priority: 'Medium' },
    ],
  },
  pickleball: {
    name: 'Startup Pickleball',
    desc: 'Sportliches Networking-Event mit Pickleball-Format.',
    tasks: [
      { title: 'Konzept & Format festlegen',             phase: 'Konzept',           daysBeforeDue: 35, priority: 'High'   },
      { title: 'Pickleball-Court buchen',                phase: 'Location',          daysBeforeDue: 28, priority: 'High'   },
      { title: 'Sponsor für Equipment / Drinks',         phase: 'Partner/Sponsor',   daysBeforeDue: 21, priority: 'Medium' },
      { title: 'Landingpage mit Signup erstellen',       phase: 'Landingpage',       daysBeforeDue: 21, priority: 'High'   },
      { title: 'Social Media Ankündigung',               phase: 'Kommunikation',     daysBeforeDue: 14, priority: 'Medium' },
      { title: 'Teams & Spielplan erstellen',            phase: 'Teilnehmer',        daysBeforeDue: 7,  priority: 'High'   },
      { title: 'Ablaufplan & Regeln',                    phase: 'Ablaufplan',        daysBeforeDue: 3,  priority: 'Medium' },
      { title: 'Event-Produktion vor Ort',               phase: 'Produktion vor Ort',daysBeforeDue: 0,  priority: 'High'   },
      { title: 'Content & Fotos posten',                 phase: 'Content Recap',     daysBeforeDue: -2, priority: 'Medium' },
      { title: 'Sponsor-Bericht & Feedback',             phase: 'Sponsor Report',    daysBeforeDue: -5, priority: 'Low'    },
    ],
  },
  sponsorship: {
    name: 'Sponsorship Event',
    desc: 'Event mit Hauptsponsor — inklusive Sponsor-Deliverables und Reporting.',
    tasks: [
      { title: 'Sponsoring-Konzept & Pakete erstellen',  phase: 'Konzept',           daysBeforeDue: 56, priority: 'High'   },
      { title: 'Sponsor akquirieren & Vertrag',          phase: 'Partner/Sponsor',   daysBeforeDue: 42, priority: 'High'   },
      { title: 'Location buchen',                        phase: 'Location',          daysBeforeDue: 35, priority: 'High'   },
      { title: 'Landingpage mit Sponsor-Branding',       phase: 'Landingpage',       daysBeforeDue: 28, priority: 'High'   },
      { title: 'PR & Kommunikations-Plan',               phase: 'Kommunikation',     daysBeforeDue: 21, priority: 'Medium' },
      { title: 'Anmeldungen & Gästeliste',               phase: 'Teilnehmer',        daysBeforeDue: 10, priority: 'Medium' },
      { title: 'Ablaufplan & Sponsor-Briefing',          phase: 'Ablaufplan',        daysBeforeDue: 5,  priority: 'High'   },
      { title: 'Event durchführen',                      phase: 'Produktion vor Ort',daysBeforeDue: 0,  priority: 'High'   },
      { title: 'Nachbereitung & Danke',                  phase: 'Nachbereitung',     daysBeforeDue: -3, priority: 'Medium' },
      { title: 'Content Recap veröffentlichen',          phase: 'Content Recap',     daysBeforeDue: -7, priority: 'Medium' },
      { title: 'Sponsor Report & KPI-Auswertung',        phase: 'Sponsor Report',    daysBeforeDue: -14, priority: 'High'  },
    ],
  },
};

export const EVENT_TEMPLATE_LIST = Object.entries(EVENT_TEMPLATES).map(([id, t]) => ({
  id: id as EventTemplateId,
  name: t.name,
  desc: t.desc,
  taskCount: t.tasks.length,
}));

export async function applyEventTemplate(input: {
  projectId: string;
  workspaceId: string;
  templateId: EventTemplateId;
  dueDate?: string;
}): Promise<ActionResult<{ count: number }>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace nicht gefunden.' };
  if (!canWriteAsRole(ctx.role, [...MANAGER_ROLES])) {
    return { ok: false, error: 'Nur Manager+ können Tasks erstellen.' };
  }

  const template = EVENT_TEMPLATES[input.templateId];
  if (!template) return { ok: false, error: 'Template nicht gefunden.' };

  const userId = (await currentUser())?.id ?? null;
  const today  = new Date().toISOString().slice(0, 10);
  const baseDate = input.dueDate ?? today;

  const taskRows = template.tasks.map((t) => ({
    workspace_id: ctx.uuid,
    project_id:   input.projectId,
    title:        t.title,
    status:       'To Do',
    priority:     t.priority,
    due_date:     subtractDays(baseDate, t.daysBeforeDue),
    assignee_id:  null,
    tags:         [t.phase],
  }));

  const { data: inserted, error } = await supabase
    .from('tasks')
    .insert(taskRows)
    .select('id');
  if (error) return { ok: false, error: error.message };

  console.log(`[template] ✓ event template "${input.templateId}" — ${inserted?.length} tasks`);
  return { ok: true, data: { count: inserted?.length ?? 0 } };
}
