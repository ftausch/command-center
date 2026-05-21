'use client';
// Project Detail page

import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import {
  Avatar, AvatarStack, Badge, BrandBadge,
  PhaseTracker, PriorityBadge, Progress, StatusBadge,
} from '@/components/ui';
import { dueLabel, formatDateLong, projectProgress, timeAgo, eventHealthScore } from '@/lib/utils';
import { updateProject, deleteProject, addProjectMember, removeProjectMember, updateProjectMemberRole, duplicateEventProject, postEventRecapToSlack } from '@/lib/actions/projects';
import { bulkUpdateTasks, bulkDeleteTasks } from '@/lib/actions/tasks';
import { listProjectMembers, listProjectResources } from '@/lib/db/supabase';
import { listEventPartners } from '@/lib/actions/event-ops';
import { CAN } from '@/lib/roles';
import { NewTaskModal } from '@/components/NewTaskModal';
import { TaskDrawer } from '@/components/TaskDrawer';
import { RunOfShow, AttendeeList, PartnerSponsorList, RecapChecklist, ApprovalsPanel, DecisionLog, ResourcesPanel, LumaUrlField, HealthBadge, LumaRsvpBadge } from '@/components/EventOps';
import { EventDayOf } from '@/components/EventDayOf';

const PROJECT_STATUSES = ['Planning', 'In Progress', 'Review', 'Blocked', 'Done'];
const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];

export function ProjectDetailScreen({ projectId, setRoute }) {
  const { currentWorkspace: brand, data, myRole, updateProjectInCache, updateTaskInCache, removeProject, removeTask, addProject, currentWorkspaceId } = useWorkspace();
  const project = data.projects.find((p) => p.id === projectId);
  const [tab, setTab] = useState('tasks');
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [drawerTaskId, setDrawerTaskId] = useState(null);

  // ── Inline name editing ───────────────────────────────────────────────────
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [namePending, setNamePending] = useState(false);
  const nameInputRef = useRef(null);

  // ── Inline description editing ────────────────────────────────────────────
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [descPending, setDescPending] = useState(false);
  const descInputRef = useRef(null);

  // ── Field edits (status / priority / due / owner / type) ─────────────────
  const [fieldPending, setFieldPending] = useState(null);
  const [fieldError, setFieldError] = useState(null);

  // ── Delete ────────────────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  // ── Project Members ───────────────────────────────────────────────────────
  const [projectMembers, setProjectMembers] = useState([]);
  const [pmLoading, setPmLoading] = useState(false);
  const [pmError, setPmError] = useState(null);
  const [addingMember, setAddingMember] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('member');
  const [pmPending, setPmPending] = useState(false);

  // ── Project Resources ─────────────────────────────────────────────────────
  const [projectResources, setProjectResources] = useState([]);

  // ── Event operations ──────────────────────────────────────────────────────
  const [eventPartners, setEventPartners] = useState([]);
  const health = project?.division === 'events'
    ? eventHealthScore(project, data.tasks.filter((t) => t.projectId === projectId), eventPartners)
    : null;

  // ── Bulk task selection ───────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkError, setBulkError] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // ── Budget tracker ────────────────────────────────────────────────────────
  const [budgetItems, setBudgetItems] = useState([]);
  const [budgetPending, setBudgetPending] = useState(false);

  // ── Day-of Mode ───────────────────────────────────────────────────────────
  const [dayOfMode, setDayOfMode] = useState(false);

  // ── Duplicate ─────────────────────────────────────────────────────────────
  const [duplicating, setDuplicating] = useState(false);

  // ── Slack channel mapping ─────────────────────────────────────────────────
  const [editingSlack, setEditingSlack] = useState(false);
  const [slackChannelDraft, setSlackChannelDraft] = useState('');
  const [slackConnectedDraft, setSlackConnectedDraft] = useState(false);
  const [slackPending, setSlackPending] = useState(false);

  useEffect(() => { if (editingName) nameInputRef.current?.focus(); }, [editingName]);
  useEffect(() => { if (editingDesc) descInputRef.current?.focus(); }, [editingDesc]);

  // Sync budget from eventMeta
  useEffect(() => {
    setBudgetItems(project?.eventMeta?.budget ?? []);
  }, [project?.id]);

  // Load project members + resources whenever this project is opened
  useEffect(() => {
    const wsId = brand?.id ?? '';
    if (!projectId || !wsId) return;
    let cancelled = false;
    setPmLoading(true);
    setPmError(null);
    const isEvent = project?.division === 'events';
    Promise.all([
      listProjectMembers(wsId, projectId),
      listProjectResources(wsId, projectId),
      isEvent ? listEventPartners(wsId, projectId) : Promise.resolve([]),
    ])
      .then(([members, resources, partners]) => {
        if (!cancelled) {
          setProjectMembers(members);
          setProjectResources(resources);
          setEventPartners(partners);
          setPmLoading(false);
        }
      })
      .catch((e) => { if (!cancelled) { setPmError(e.message); setPmLoading(false); } });
    return () => { cancelled = true; };
  }, [projectId, brand?.id]);

  if (!project) return <div className="page">Projekt nicht gefunden.</div>;

  const workspaceId = brand?.id ?? '';

  const saveName = async () => {
    const name = nameDraft.trim();
    if (!name || name === project.name) { setEditingName(false); return; }
    setNamePending(true);
    const r = await updateProject({ projectId, workspaceId, patch: { name } });
    setNamePending(false);
    if (!r.ok) { setFieldError(r.error ?? 'Name konnte nicht gespeichert werden'); return; }
    updateProjectInCache(projectId, { name });
    setEditingName(false);
  };

  const saveDesc = async () => {
    const desc = descDraft.trim();
    if (desc === project.desc) { setEditingDesc(false); return; }
    setDescPending(true);
    const r = await updateProject({ projectId, workspaceId, patch: { desc } });
    setDescPending(false);
    if (!r.ok) { setFieldError(r.error ?? 'Beschreibung konnte nicht gespeichert werden'); return; }
    updateProjectInCache(projectId, { desc });
    setEditingDesc(false);
  };

  const [showRecapPrompt, setShowRecapPrompt] = useState(false);
  const [recapSlackPending, setRecapSlackPending] = useState(false);
  const [recapSlackSent,    setRecapSlackSent]    = useState(false);

  const saveField = async (key, value) => {
    setFieldPending(key);
    setFieldError(null);
    const r = await updateProject({ projectId, workspaceId, patch: { [key]: value } });
    setFieldPending(null);
    if (!r.ok) { setFieldError(r.error ?? 'Feld konnte nicht gespeichert werden'); return; }
    updateProjectInCache(projectId, { [key]: value });
    // Show recap prompt when event is marked Done
    if (key === 'status' && value === 'Done' && project.division === 'events') {
      setShowRecapPrompt(true);
    }
  };

  const startSlackEdit = () => {
    setSlackChannelDraft(project.slackChannel || '');
    setSlackConnectedDraft(project.slackConnected);
    setEditingSlack(true);
  };

  const saveSlack = async () => {
    const channel = slackChannelDraft.trim();
    const connected = slackConnectedDraft && !!channel;
    setSlackPending(true);
    setFieldError(null);
    const r = await updateProject({ projectId, workspaceId, patch: { slackChannel: channel, slackConnected: connected } });
    setSlackPending(false);
    if (!r.ok) { setFieldError(r.error ?? 'Slack konnte nicht gespeichert werden'); return; }
    updateProjectInCache(projectId, { slackChannel: channel, slackConnected: connected });
    setEditingSlack(false);
  };

  const handleAddMember = async () => {
    if (!newMemberId) return;
    setPmPending(true);
    setPmError(null);
    const r = await addProjectMember({ workspaceId, projectId, userId: newMemberId, role: newMemberRole });
    setPmPending(false);
    if (!r.ok) { setPmError(r.error ?? 'Fehler beim Hinzufügen'); return; }
    setProjectMembers((prev) => [...prev, r.data]);
    setNewMemberId('');
    setNewMemberRole('member');
    setAddingMember(false);
  };

  const handleRemoveMember = async (userId) => {
    setPmPending(true);
    setPmError(null);
    const r = await removeProjectMember({ workspaceId, projectId, userId });
    setPmPending(false);
    if (!r.ok) { setPmError(r.error ?? 'Fehler beim Entfernen'); return; }
    setProjectMembers((prev) => prev.filter((m) => m.userId !== userId));
  };

  const handleRoleMember = async (userId, role) => {
    setPmPending(true);
    setPmError(null);
    const r = await updateProjectMemberRole({ workspaceId, projectId, userId, role });
    setPmPending(false);
    if (!r.ok) { setPmError(r.error ?? 'Fehler beim Rollenändern'); return; }
    setProjectMembers((prev) => prev.map((m) => m.userId === userId ? { ...m, role } : m));
  };

  const onDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeletePending(true);
    const r = await deleteProject({ projectId, workspaceId });
    setDeletePending(false);
    if (!r.ok) { setFieldError(r.error ?? 'Projekt konnte nicht gelöscht werden'); setConfirmDelete(false); return; }
    removeProject(projectId);
    setRoute('projects');
  };

  const saveBudget = async (items) => {
    setBudgetPending(true);
    const newMeta = { ...(project.eventMeta ?? {}), budget: items };
    const r = await updateProject({ projectId, workspaceId, patch: { eventMeta: newMeta } });
    setBudgetPending(false);
    if (r.ok) {
      updateProjectInCache(projectId, { eventMeta: newMeta });
      setBudgetItems(items);
    }
  };

  const onDuplicate = async () => {
    setDuplicating(true);
    const r = await duplicateEventProject({ projectId, workspaceId });
    setDuplicating(false);
    if (!r.ok) { setFieldError(r.error ?? 'Duplizieren fehlgeschlagen'); return; }
    addProject(r.data);
    setRoute('project:' + r.data.id);
  };

  const phases = data.phases;
  const tasks = data.tasks.filter((t) => t.projectId === projectId);
  const progress = projectProgress(tasks);

  const toggleSelect = (id) => setSelectedIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => {
    const allSelected = tasks.every((t) => selectedIds.has(t.id));
    setSelectedIds(allSelected ? new Set() : new Set(tasks.map((t) => t.id)));
  };
  const applyBulk = async (patch) => {
    setBulkPending(true); setBulkError(null);
    const r = await bulkUpdateTasks({ workspaceId: currentWorkspaceId, taskIds: [...selectedIds], patch });
    setBulkPending(false);
    if (!r.ok) { setBulkError(r.error); return; }
    [...selectedIds].forEach((id) => updateTaskInCache(id, patch));
    setSelectedIds(new Set());
  };
  const applyBulkDelete = async () => {
    if (!confirmBulkDelete) { setConfirmBulkDelete(true); return; }
    setBulkPending(true); setBulkError(null);
    const ids = [...selectedIds];
    const r = await bulkDeleteTasks({ workspaceId: currentWorkspaceId, taskIds: ids });
    setBulkPending(false);
    if (!r.ok) { setBulkError(r.error); setConfirmBulkDelete(false); return; }
    ids.forEach((id) => removeTask(id));
    setSelectedIds(new Set()); setConfirmBulkDelete(false);
  };
  // Project-wide read-only roll-up of comments already in cache. The
  // per-task write surface lives in the TaskDrawer (open a task to add a
  // comment) — anchoring the write to a specific task is the whole
  // reason the drawer exists.
  const projectComments = tasks.flatMap((t) => data.taskComments?.[t.id] ?? []);

  const team = project.team
    .map((id) => data.members.find((u) => u.id === id))
    .filter(Boolean);
  const owner = data.members.find((u) => u.id === project.owner);
  const due = dueLabel(project.due);
  const activity = data.activity
    .filter((a) => a.target === projectId || tasks.some((t) => t.id === a.target))
    .slice(0, 10);

  return (
    <div className="page fade-in">
      <div className="row gap-2 mb-3" style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
        <button className="btn btn-quiet btn-sm" onClick={() => setRoute('projects')} style={{ padding: '0 6px', height: 22 }}>Projects</button>
        <I.chevron size={11} />
        <Badge kind="brand" dot>{brand?.name}</Badge>
        <I.chevron size={11} />
        <span>{project.type}</span>
      </div>

      <div className="page-head">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="row gap-3 mb-2" style={{ flexWrap: 'wrap' }}>
            <StatusBadge status={project.status} />
            <PriorityBadge priority={project.priority} />
            <span className={`badge ${due.danger ? 'danger' : 'ghost'}`}><I.calendar size={11} /> Deadline {due.text}</span>
            {project.division === 'events' && health && (
              <HealthBadge score={health.score} reasons={health.reasons} />
            )}
          </div>
          {editingName ? (
            <div className="row gap-2 items-center mb-1">
              <input
                ref={nameInputRef}
                className="input"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                disabled={namePending}
                style={{ fontSize: 20, fontWeight: 700, flex: 1 }}
              />
              <button className="btn btn-brand btn-sm" onClick={saveName} disabled={namePending}>{namePending ? '…' : 'OK'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingName(false)} disabled={namePending}><I.x size={12} /></button>
            </div>
          ) : (
            <h1
              className="h1"
              style={{ fontSize: 26, cursor: 'text', padding: '2px 4px', marginLeft: -4, borderRadius: 4, transition: 'background 0.1s' }}
              onClick={() => { setNameDraft(project.name); setEditingName(true); }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-sunk)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              title="Klicken zum Bearbeiten"
            >
              {project.name}
            </h1>
          )}
          {editingDesc ? (
            <div className="col gap-2 mt-2" style={{ maxWidth: 720 }}>
              <textarea
                ref={descInputRef}
                className="input"
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setEditingDesc(false); }}
                disabled={descPending}
                rows={3}
                style={{ fontSize: 14, resize: 'vertical' }}
              />
              <div className="row gap-2">
                <button className="btn btn-brand btn-sm" onClick={saveDesc} disabled={descPending}>{descPending ? 'Wird gespeichert…' : 'Speichern'}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingDesc(false)} disabled={descPending}>Abbrechen</button>
              </div>
            </div>
          ) : (
            <p
              style={{ color: 'var(--text-2)', fontSize: 14.5, margin: '6px 0 0', maxWidth: 720, cursor: 'text', padding: '2px 4px', marginLeft: -4, borderRadius: 4, transition: 'background 0.1s', minHeight: 24 }}
              onClick={() => { setDescDraft(project.desc); setEditingDesc(true); }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-sunk)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              title="Klicken zum Bearbeiten"
            >
              {project.desc || <span style={{ color: 'var(--text-4)', fontStyle: 'italic' }}>Beschreibung hinzufügen…</span>}
            </p>
          )}
        </div>
        <div className="row gap-2">
          {project.slackConnected && project.slackChannel ? (
            <a
              className="btn btn-ghost btn-sm"
              href={`https://slack.com/app_redirect?channel=${encodeURIComponent(project.slackChannel.replace(/^#/, ''))}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <I.slack size={13} /> Open in Slack
            </a>
          ) : (
            <button className="btn btn-ghost btn-sm" disabled title="Kein Slack-Channel verknüpft">
              <I.slack size={13} /> Open in Slack
            </button>
          )}
          {project.division === 'events' && (() => {
            const ed = project.eventMeta?.eventDate;
            if (!ed) return null;
            const daysAway = Math.round((new Date(ed).getTime() - Date.now()) / 86400000);
            if (daysAway > 1 || daysAway < -1) return null;
            return (
              <button className="btn btn-sm" onClick={() => setDayOfMode(true)}
                style={{ background: '#e8780a', border: 'none', color: 'white', fontWeight: 700 }}>
                🎪 Live Event
              </button>
            );
          })()}
          <button className="btn btn-brand btn-sm" onClick={() => setNewTaskOpen(true)}><I.plus size={13} /> New Task</button>
        </div>
      </div>

      {dayOfMode && <EventDayOf project={project} onClose={() => setDayOfMode(false)} />}

      <NewTaskModal
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        initialProjectId={projectId}
      />

      <TaskDrawer
        taskId={drawerTaskId}
        projectId={projectId}
        onClose={() => setDrawerTaskId(null)}
      />

      <div className="card card-pad mb-4">
        <div className="row between mb-3">
          <div>
            <div className="label">Episode Phase</div>
            <div className="row gap-2 mt-1 items-center">
              <button
                className="btn btn-icon btn-quiet btn-sm"
                onClick={() => saveField('phaseIdx', project.phaseIdx - 1)}
                disabled={project.phaseIdx <= 0 || fieldPending === 'phaseIdx'}
                title="Vorherige Phase"
              >
                <I.chevron size={13} style={{ transform: 'rotate(180deg)' }} />
              </button>
              <span style={{ fontSize: 16, fontWeight: 600 }}>
                {fieldPending === 'phaseIdx' ? '…' : (phases[project.phaseIdx] ?? '—')}
              </span>
              <button
                className="btn btn-icon btn-quiet btn-sm"
                onClick={() => saveField('phaseIdx', project.phaseIdx + 1)}
                disabled={project.phaseIdx >= phases.length - 1 || fieldPending === 'phaseIdx'}
                title="Nächste Phase"
              >
                <I.chevron size={13} />
              </button>
              <span className="meta">Schritt {project.phaseIdx + 1} von {phases.length}</span>
            </div>
          </div>
          <div className="row gap-3">
            <div className="col items-end">
              <span className="label">Progress</span>
              <span className="mono mt-1" style={{ fontSize: 16, fontWeight: 600 }}>{progress}%</span>
            </div>
            <div style={{ width: 180 }}>
              <Progress value={progress} brand />
              <div className="meta mt-1" style={{ textAlign: 'right' }}>{tasks.filter((t) => t.status === 'Done').length}/{tasks.length} Tasks done</div>
            </div>
          </div>
        </div>
        <PhaseTracker
          phases={phases}
          currentIdx={project.phaseIdx}
          onSelect={(i) => { if (i !== project.phaseIdx) saveField('phaseIdx', i); }}
        />
      </div>

      {/* ── Recap Automation Prompt ─────────────────────────────────── */}
      {showRecapPrompt && (
        <div style={{
          marginBottom: 16, padding: '14px 18px', borderRadius: 10,
          background: '#fff4e6', border: '1px solid #fed7aa',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#e8780a', marginBottom: 2 }}>
              🎉 Event abgeschlossen — Zeit für den Recap!
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
              Fotos, Clips, LinkedIn-Post, Sponsor Report — öffne die Recap-Checkliste um nichts zu vergessen.
            </div>
          </div>
          <div className="row gap-2" style={{ flexShrink: 0, flexWrap: 'wrap' }}>
            <button className="btn btn-sm"
              style={{ background: '#e8780a', color: 'white', border: 'none', fontWeight: 600 }}
              onClick={() => { setTab('recap'); setShowRecapPrompt(false); }}>
              Recap öffnen →
            </button>
            {project.slackConnected && !recapSlackSent && (
              <button className="btn btn-ghost btn-sm"
                disabled={recapSlackPending}
                onClick={async () => {
                  setRecapSlackPending(true);
                  const done  = tasks.filter(t => t.status === 'Done').length;
                  await postEventRecapToSlack({
                    workspaceId:  workspaceId,
                    projectId:    projectId,
                    projectName:  project.name,
                    tasksTotal:   tasks.length,
                    tasksDone:    done,
                  });
                  setRecapSlackPending(false);
                  setRecapSlackSent(true);
                }}>
                <I.slack size={12} /> {recapSlackPending ? 'Sendet…' : 'Auf Slack posten'}
              </button>
            )}
            {recapSlackSent && (
              <span style={{ fontSize: 12, color: 'var(--success)', alignSelf: 'center' }}>✓ Auf Slack gepostet</span>
            )}
            <button className="btn btn-quiet btn-icon" onClick={() => setShowRecapPrompt(false)}>
              <I.x size={12} />
            </button>
          </div>
        </div>
      )}

      <div className="tabs mb-4">
        <div className={`tab ${tab === 'tasks' ? 'active' : ''}`} onClick={() => setTab('tasks')}>Tasks <span className="count">{tasks.length}</span></div>
        <div className={`tab ${tab === 'activity' ? 'active' : ''}`} onClick={() => setTab('activity')}>Activity <span className="count">{activity.length}</span></div>
        <div className={`tab ${tab === 'comments' ? 'active' : ''}`} onClick={() => setTab('comments')}>Comments <span className="count">{projectComments.length}</span></div>
        <div className={`tab ${tab === 'files' ? 'active' : ''}`} onClick={() => setTab('files')}>Files <span className="count">{project.links?.length ?? 0}</span></div>
        {project.division === 'events' && (<>
          <div className={`tab ${tab === 'agenda' ? 'active' : ''}`} onClick={() => setTab('agenda')}>Ablaufplan</div>
          <div className={`tab ${tab === 'attendees' ? 'active' : ''}`} onClick={() => setTab('attendees')}>Gäste</div>
          <div className={`tab ${tab === 'partners' ? 'active' : ''}`} onClick={() => setTab('partners')}>Partner</div>
          <div className={`tab ${tab === 'approvals' ? 'active' : ''}`} onClick={() => setTab('approvals')}>Freigaben</div>
          <div className={`tab ${tab === 'decisions' ? 'active' : ''}`} onClick={() => setTab('decisions')}>Entscheidungen</div>
          <div className={`tab ${tab === 'resources' ? 'active' : ''}`} onClick={() => setTab('resources')}>Ressourcen <span className="count">{projectResources.length}</span></div>
          <div className={`tab ${tab === 'recap' ? 'active' : ''}`} onClick={() => setTab('recap')}>Recap</div>
        </>)}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1.7fr 1fr' }}>
        <div className="col gap-4">
          {tab === 'tasks' && (
            <div className="col gap-2">
              {/* Bulk action bar */}
              {selectedIds.size > 0 && (
                <div className="card row gap-2" style={{ padding: '8px 14px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{selectedIds.size} ausgewählt</span>
                  <select className="input" style={{ height: 28, fontSize: 12.5, width: 140 }} disabled={bulkPending} onChange={(e) => e.target.value && applyBulk({ status: e.target.value }) && (e.target.value = '')}>
                    <option value="">Status setzen…</option>
                    {['Backlog','To Do','In Progress','Review','Blocked','Done'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select className="input" style={{ height: 28, fontSize: 12.5, width: 130 }} disabled={bulkPending} onChange={(e) => e.target.value && applyBulk({ priority: e.target.value }) && (e.target.value = '')}>
                    <option value="">Priority setzen…</option>
                    {['High','Medium','Low'].map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {CAN.bulkDeleteTasks(myRole) && (confirmBulkDelete ? (
                    <div className="row gap-2">
                      <button className="btn btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }} onClick={applyBulkDelete} disabled={bulkPending}>{bulkPending ? '…' : 'Ja, löschen'}</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirmBulkDelete(false)} disabled={bulkPending}>Abbrechen</button>
                    </div>
                  ) : (
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={applyBulkDelete} disabled={bulkPending}><I.x size={12} /> Löschen</button>
                  ))}
                  <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedIds(new Set()); setConfirmBulkDelete(false); setBulkError(null); }} disabled={bulkPending}><I.x size={12} /></button>
                  {bulkError && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{bulkError}</span>}
                </div>
              )}
              {/* Phase-grouped view for event projects */}
              {project.division === 'events' && tasks.some((t) => t.tags?.length) ? (() => {
                const phases = [...new Set(tasks.map((t) => t.tags?.[0] ?? 'Allgemein'))];
                return (
                  <div className="col gap-3">
                    {phases.map((phase) => {
                      const phaseTasks = tasks.filter((t) => (t.tags?.[0] ?? 'Allgemein') === phase);
                      const done = phaseTasks.filter((t) => t.status === 'Done').length;
                      const pct  = Math.round((done / phaseTasks.length) * 100);
                      return (
                        <div key={phase} className="card" style={{ overflow: 'hidden' }}>
                          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#e8780a' }}>{phase}</span>
                            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{done}/{phaseTasks.length}</span>
                            <div style={{ flex: 1, height: 4, background: 'var(--border-soft)', borderRadius: 2, maxWidth: 80 }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--success)' : '#e8780a', borderRadius: 2 }} />
                            </div>
                          </div>
                          <table className="table">
                            <tbody>
                              {phaseTasks.map((t) => {
                                const a  = data.members.find((u) => u.id === t.assignee);
                                const td = dueLabel(t.due);
                                return (
                                  <tr key={t.id} onClick={() => setDrawerTaskId(t.id)} style={{ cursor: 'pointer', opacity: t.status === 'Done' ? 0.5 : 1 }}>
                                    <td style={{ width: 24 }}><input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} onClick={(e) => e.stopPropagation()} /></td>
                                    <td>
                                      <div style={{ fontWeight: 500, textDecoration: t.status === 'Done' ? 'line-through' : 'none' }}>{t.title}</div>
                                    </td>
                                    <td><StatusBadge status={t.status} /></td>
                                    <td>{a ? <div className="row gap-2"><Avatar user={a} /><span style={{ fontSize: 12.5 }}>{a.name.split(' ')[0]}</span></div> : <span style={{ fontSize: 12, color: 'var(--text-4)' }}>—</span>}</td>
                                    <td><PriorityBadge priority={t.priority} /></td>
                                    <td><span className={`badge ${td.danger ? 'danger' : td.today ? 'warning' : 'ghost'}`}>{td.text}</span></td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                );
              })() : (
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 24 }}>
                        <input type="checkbox"
                          checked={tasks.length > 0 && tasks.every((t) => selectedIds.has(t.id))}
                          ref={(el) => { if (el) el.indeterminate = tasks.some((t) => selectedIds.has(t.id)) && !tasks.every((t) => selectedIds.has(t.id)); }}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th>Task</th><th>Status</th><th>Assignee</th><th>Priority</th><th>Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => {
                      const a = data.members.find((u) => u.id === t.assignee);
                      const waiting = data.members.find((u) => u.id === t.waitingOn);
                      const td = dueLabel(t.due);
                      return (
                        <tr key={t.id} onClick={() => setDrawerTaskId(t.id)} style={{ cursor: 'pointer', background: selectedIds.has(t.id) ? 'var(--bg-sunk)' : undefined }}>
                          <td onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} />
                          </td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{t.title}</div>
                            {t.blocker && <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 2 }}><I.block size={11} /> {t.blocker}</div>}
                            {waiting && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>Wartet auf {waiting.name}</div>}
                          </td>
                          <td><StatusBadge status={t.status} /></td>
                          <td>
                            {a ? <div className="row gap-2"><Avatar user={a} /><span style={{ fontSize: 12.5 }}>{a.name.split(' ')[0]}</span></div>
                              : <span style={{ fontSize: 12, color: 'var(--text-4)' }}>—</span>}
                          </td>
                          <td><PriorityBadge priority={t.priority} /></td>
                          <td><span className={`badge ${td.danger ? 'danger' : td.today ? 'warning' : 'ghost'}`}>{td.text}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          )}

          {tab === 'activity' && (
            <div className="card">
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
                <div className="h3">Aktivitätsverlauf</div>
              </div>
              <div style={{ padding: 18 }}>
                <ActivityTimeline items={activity} />
              </div>
            </div>
          )}

          {tab === 'comments' && (
            <div className="card card-pad">
              <div className="col gap-4">
                {projectComments.length === 0 ? (
                  <div className="meta" style={{ padding: '8px 0' }}>
                    Noch keine Kommentare zu Tasks dieses Projekts. Öffne einen Task im Tasks-Tab, um zu kommentieren.
                  </div>
                ) : (
                  <>
                    <div className="meta">Antworten direkt im Task öffnen (Tab "Tasks").</div>
                    {projectComments.map((c) => (
                      <CommentItem key={c.id} authorId={c.author} time={timeAgo(c.time)} text={c.text} />
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {tab === 'files' && (
            <div className="card card-pad">
              <div className="col gap-2">
                {(project.links ?? []).length === 0 && (
                  <div className="meta" style={{ padding: '8px 0' }}>
                    Keine Dateien oder Links zu diesem Projekt.
                  </div>
                )}
                {(project.links ?? []).map((l, i) => (
                  <div key={i} className="row gap-3" style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                    <I.link size={14} color="var(--text-3)" />
                    <span style={{ flex: 1, fontSize: 13 }}>{l.label}</span>
                    <button className="btn btn-quiet btn-sm" disabled title="Noch nicht verfügbar">Open <I.arrowRight size={11} /></button>
                  </div>
                ))}
                <button className="btn btn-ghost btn-sm mt-2" style={{ alignSelf: 'flex-start' }} disabled title="Noch nicht verfügbar"><I.plus size={13} /> Link hinzufügen</button>
              </div>
            </div>
          )}

          {/* ── Event Operation Tabs ─────────────────────────────────── */}
          {tab === 'agenda' && project.division === 'events' && (
            <div className="card card-pad">
              <RunOfShow
                projectId={projectId}
                workspaceId={workspaceId}
                canEdit={CAN.editProject(myRole)}
              />
            </div>
          )}

          {tab === 'attendees' && project.division === 'events' && (
            <div className="card card-pad">
              <AttendeeList
                projectId={projectId}
                workspaceId={workspaceId}
                canEdit={CAN.editProject(myRole)}
                lumaUrl={project.eventMeta?.lumaUrl ?? project.eventMeta?.signupUrl ?? ''}
              />
            </div>
          )}

          {tab === 'partners' && project.division === 'events' && (
            <div className="card card-pad">
              <PartnerSponsorList
                projectId={projectId}
                workspaceId={workspaceId}
                canEdit={CAN.editProject(myRole)}
              />
            </div>
          )}

          {tab === 'approvals' && project.division === 'events' && (
            <div className="card card-pad">
              <ApprovalsPanel
                projectId={projectId}
                workspaceId={workspaceId}
                canEdit={CAN.editProject(myRole)}
                members={data.members}
              />
            </div>
          )}

          {tab === 'decisions' && project.division === 'events' && (
            <div className="card card-pad">
              <DecisionLog
                projectId={projectId}
                workspaceId={workspaceId}
                canEdit={CAN.editProject(myRole)}
                members={data.members}
              />
            </div>
          )}

          {tab === 'resources' && project.division === 'events' && (
            <div className="card card-pad">
              <ResourcesPanel
                projectId={projectId}
                workspaceId={workspaceId}
                canEdit={CAN.editProject(myRole)}
                initialResources={projectResources}
              />
            </div>
          )}

          {tab === 'recap' && project.division === 'events' && (
            <div className="card card-pad">
              <RecapChecklist
                project={project}
                workspaceId={workspaceId}
                canEdit={CAN.editProject(myRole)}
                onUpdate={(patch) => updateProjectInCache(projectId, patch)}
              />
            </div>
          )}
        </div>

        <div className="col gap-4">
          <div className="card card-pad">
            <div className="label mb-3">Project Details</div>
            <Field label="Status">
              <select
                className="input"
                value={project.status}
                onChange={(e) => saveField('status', e.target.value)}
                disabled={fieldPending === 'status'}
                style={{ height: 28, fontSize: 12.5 }}
              >
                {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select
                className="input"
                value={project.priority}
                onChange={(e) => saveField('priority', e.target.value)}
                disabled={fieldPending === 'priority'}
                style={{ height: 28, fontSize: 12.5 }}
              >
                {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Deadline">
              <div className="row gap-2 items-center">
                <input
                  type="date"
                  className="input"
                  value={project.due || ''}
                  onChange={(e) => saveField('due', e.target.value)}
                  disabled={fieldPending === 'due'}
                  style={{ height: 28, fontSize: 12.5, width: 160 }}
                />
                {project.due && (
                  <button className="btn btn-quiet btn-sm" onClick={() => saveField('due', '')} disabled={fieldPending === 'due'} title="Datum entfernen"><I.x size={11} /></button>
                )}
              </div>
            </Field>
            <Field label="Owner">
              <select
                className="input"
                value={project.owner || ''}
                onChange={(e) => saveField('owner', e.target.value)}
                disabled={fieldPending === 'owner'}
                style={{ height: 28, fontSize: 12.5 }}
              >
                <option value="">— Niemand —</option>
                {data.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <input
                className="input"
                defaultValue={project.type}
                onBlur={(e) => { if (e.target.value !== project.type) saveField('type', e.target.value); }}
                disabled={fieldPending === 'type'}
                style={{ height: 28, fontSize: 12.5 }}
              />
            </Field>
            <Field label="Team">
              <AvatarStack users={team} max={6} />
            </Field>
            <Field label="Workspace"><BrandBadge brand={brand} /></Field>
            {fieldError && (
              <div style={{ fontSize: 12, color: 'var(--danger)', padding: '6px 8px', background: 'var(--danger-bg)', borderRadius: 6, border: '1px solid var(--danger-border)', marginTop: 8 }}>
                {fieldError}
              </div>
            )}
            {CAN.deleteProject(myRole) && (
              <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 12, marginTop: 8 }}>
                {confirmDelete ? (
                  <div className="col gap-2">
                    <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>Alle Tasks werden ebenfalls gelöscht. Wirklich löschen?</p>
                    <div className="row gap-2">
                      <button className="btn btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }} onClick={onDelete} disabled={deletePending}>
                        {deletePending ? 'Wird gelöscht…' : 'Ja, löschen'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)} disabled={deletePending}>Abbrechen</button>
                    </div>
                  </div>
                ) : (
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--text-3)', fontSize: 12 }} onClick={onDelete}>
                    <I.x size={11} /> Projekt löschen
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Event Details ────────────────────────────────────────────── */}
          {project.division === 'events' && (
            <>
              <div className="card card-pad">
                <div className="row between mb-3">
                  <div className="row gap-2">
                    <span style={{ fontSize: 16 }}>🎪</span>
                    <span className="h3">Event Details</span>
                  </div>
                  {CAN.editProject(myRole) && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={onDuplicate}
                      disabled={duplicating}
                      title="Event als Vorlage duplizieren"
                    >
                      {duplicating ? '…' : '⧉ Duplizieren'}
                    </button>
                  )}
                </div>
                <div className="col gap-2" style={{ fontSize: 13 }}>
                  {project.eventMeta?.eventDate && (
                    <div className="row between">
                      <span style={{ color: 'var(--text-3)' }}>📅 Datum</span>
                      <span style={{ fontWeight: 500 }}>
                        {new Date(project.eventMeta.eventDate).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                  )}
                  {project.eventMeta?.location && (
                    <div className="row between">
                      <span style={{ color: 'var(--text-3)' }}>📍 Location</span>
                      <span style={{ fontWeight: 500 }}>{project.eventMeta.location}</span>
                    </div>
                  )}
                  {project.eventMeta?.partnerSponsor && (
                    <div className="row between">
                      <span style={{ color: 'var(--text-3)' }}>🤝 Partner</span>
                      <span style={{ fontWeight: 500 }}>{project.eventMeta.partnerSponsor}</span>
                    </div>
                  )}
                  {project.eventMeta?.landingPageUrl && (
                    <div className="row between">
                      <span style={{ color: 'var(--text-3)' }}>🔗 Landing Page</span>
                      <a href={project.eventMeta.landingPageUrl} target="_blank" rel="noopener noreferrer"
                         style={{ color: 'var(--brand)', fontSize: 12.5 }}>Öffnen →</a>
                    </div>
                  )}
                  {project.eventMeta?.signupUrl && (
                    <div className="row between">
                      <span style={{ color: 'var(--text-3)' }}>📋 Signup</span>
                      <a href={project.eventMeta.signupUrl} target="_blank" rel="noopener noreferrer"
                         style={{ color: 'var(--brand)', fontSize: 12.5 }}>Öffnen →</a>
                    </div>
                  )}
                  {!project.eventMeta?.eventDate && !project.eventMeta?.location && (
                    <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Noch keine Event-Details eingetragen.</div>
                  )}
                  {/* Luma URL — editable inline */}
                  {(() => {
                    const currentLumaUrl = project.eventMeta?.lumaUrl ?? (project.eventMeta?.signupUrl?.includes('lu.ma') ? project.eventMeta.signupUrl : '');
                    return (
                      <LumaUrlField
                        lumaUrl={currentLumaUrl}
                        canEdit={CAN.editProject(myRole)}
                        onSave={async (url) => {
                          const newMeta = { ...(project.eventMeta ?? {}), lumaUrl: url || undefined };
                          const r = await updateProject({ projectId, workspaceId, patch: { eventMeta: newMeta } });
                          if (r.ok) updateProjectInCache(projectId, { eventMeta: newMeta });
                        }}
                      />
                    );
                  })()}
                </div>
              </div>

              {/* ── Budget Tracker ──────────────────────────────────────── */}
              <div className="card card-pad">
                <div className="row between mb-3">
                  <div className="row gap-2">
                    <span style={{ fontSize: 15 }}>💰</span>
                    <span className="h3">Budget</span>
                  </div>
                  {CAN.editProject(myRole) && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        const newItems = [...budgetItems, { label: '', planned: 0, actual: 0 }];
                        setBudgetItems(newItems);
                      }}
                    >
                      <I.plus size={12} /> Position
                    </button>
                  )}
                </div>
                {budgetItems.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'var(--text-4)' }}>
                    Noch kein Budget eingetragen. Klick "+ Position" um zu starten.
                  </div>
                ) : (
                  <div className="col gap-0">
                    <div className="row gap-2" style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, padding: '0 0 6px', borderBottom: '1px solid var(--border-soft)', marginBottom: 6 }}>
                      <span style={{ flex: 1 }}>Position</span>
                      <span style={{ width: 80, textAlign: 'right' }}>Geplant</span>
                      <span style={{ width: 80, textAlign: 'right' }}>Tatsächlich</span>
                      <span style={{ width: 24 }} />
                    </div>
                    {budgetItems.map((item, i) => (
                      <div key={i} className="row gap-2 items-center" style={{ marginBottom: 4 }}>
                        <input
                          className="input"
                          style={{ flex: 1, height: 28, fontSize: 12.5 }}
                          placeholder="z.B. Location-Miete"
                          value={item.label}
                          onChange={(e) => {
                            const n = [...budgetItems]; n[i] = { ...n[i], label: e.target.value }; setBudgetItems(n);
                          }}
                          onBlur={() => saveBudget(budgetItems)}
                        />
                        <input
                          className="input"
                          type="number"
                          style={{ width: 80, height: 28, fontSize: 12.5, textAlign: 'right' }}
                          value={item.planned}
                          onChange={(e) => {
                            const n = [...budgetItems]; n[i] = { ...n[i], planned: +e.target.value }; setBudgetItems(n);
                          }}
                          onBlur={() => saveBudget(budgetItems)}
                        />
                        <input
                          className="input"
                          type="number"
                          style={{ width: 80, height: 28, fontSize: 12.5, textAlign: 'right' }}
                          value={item.actual ?? ''}
                          placeholder="–"
                          onChange={(e) => {
                            const n = [...budgetItems]; n[i] = { ...n[i], actual: +e.target.value }; setBudgetItems(n);
                          }}
                          onBlur={() => saveBudget(budgetItems)}
                        />
                        <button
                          className="btn btn-quiet btn-icon"
                          style={{ width: 24, height: 24 }}
                          onClick={() => { const n = budgetItems.filter((_, j) => j !== i); saveBudget(n); }}
                        ><I.x size={11} /></button>
                      </div>
                    ))}
                    <div className="row gap-2" style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 8, marginTop: 4, fontSize: 12.5, fontWeight: 600 }}>
                      <span style={{ flex: 1, color: 'var(--text-2)' }}>Gesamt</span>
                      <span style={{ width: 80, textAlign: 'right', color: 'var(--text-1)' }}>
                        {budgetItems.reduce((s, i) => s + (i.planned || 0), 0).toLocaleString('de-DE')} €
                      </span>
                      <span style={{ width: 80, textAlign: 'right', color: budgetItems.reduce((s, i) => s + (i.actual || 0), 0) > budgetItems.reduce((s, i) => s + (i.planned || 0), 0) ? 'var(--danger)' : 'var(--success)' }}>
                        {budgetItems.reduce((s, i) => s + (i.actual || 0), 0).toLocaleString('de-DE')} €
                      </span>
                      <span style={{ width: 24 }} />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="card card-pad">
            <div className="row between mb-3">
              <div className="row gap-2"><I.slack size={16} /><span className="h3">Slack Channel</span></div>
              {project.slackConnected
                ? <Badge kind="success" dot>Connected</Badge>
                : <Badge kind="warning" dot>Not connected</Badge>}
            </div>
            {editingSlack ? (
              <div className="col gap-2">
                <input
                  className="input mono"
                  value={slackChannelDraft}
                  onChange={(e) => setSlackChannelDraft(e.target.value)}
                  placeholder="#channel-name"
                  disabled={slackPending}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Escape') setEditingSlack(false); if (e.key === 'Enter') saveSlack(); }}
                  style={{ fontSize: 13 }}
                />
                <label className="row gap-2" style={{ cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={slackConnectedDraft}
                    onChange={(e) => setSlackConnectedDraft(e.target.checked)}
                    disabled={slackPending || !slackChannelDraft.trim()}
                  />
                  Verbinden (Auto-Updates aktivieren)
                </label>
                <div className="row gap-2 mt-1">
                  <button className="btn btn-brand btn-sm" onClick={saveSlack} disabled={slackPending}>
                    {slackPending ? 'Wird gespeichert…' : 'Speichern'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingSlack(false)} disabled={slackPending}>Abbrechen</button>
                </div>
              </div>
            ) : project.slackConnected ? (
              <>
                <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{project.slackChannel}</div>
                <div className="meta mt-1">Automatische Updates: Status-Wechsel, neue Tasks, Deadlines</div>
                <div className="row gap-2 mt-3">
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={startSlackEdit}><I.settings size={13} /> Bearbeiten</button>
                </div>
              </>
            ) : (
              <>
                <p className="meta" style={{ margin: '4px 0 12px' }}>Kein Slack-Channel verknüpft. Aufgaben werden nicht automatisch in Slack gespiegelt.</p>
                <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={startSlackEdit}>
                  <I.slack size={13} /> Slack verbinden
                </button>
              </>
            )}
          </div>

          {/* ── External Resources ──────────────────────────────────────── */}
          {projectResources.length > 0 && (
            <div className="card card-pad">
              <div className="label mb-3">Workspace</div>
              <div className="col gap-2">
                {projectResources.map((r) => {
                  const isSlack = r.provider === 'slack';
                  const isDrive = r.provider === 'google_drive';
                  return (
                    <div key={r.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', borderRadius: 8,
                      background: isDrive ? '#f0f7ff' : isSlack ? '#f5f0ff' : 'var(--bg-sunk)',
                      border: `1px solid ${isDrive ? '#c8ddf5' : isSlack ? '#d9ccf5' : 'transparent'}`,
                    }}>
                      <div className="row gap-2 items-center">
                        <span style={{ fontSize: 18 }}>{isDrive ? '📂' : isSlack ? '💬' : '🔗'}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            {isDrive ? 'Google Drive' : isSlack ? 'Slack' : r.provider}
                          </div>
                        </div>
                      </div>
                      {r.url && (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11.5, flexShrink: 0 }}
                          onClick={e => e.stopPropagation()}
                        >
                          Öffnen <I.arrowRight size={11} />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Project Members ─────────────────────────────────────────── */}
          {(() => {
            const canManage = CAN.editProject(myRole);
            const memberIds = new Set(projectMembers.map((m) => m.userId));
            const eligible = data.members.filter((u) => !memberIds.has(u.id));
            return (
              <div className="card card-pad">
                <div className="row between mb-3">
                  <div className="h3">Team</div>
                  {canManage && !addingMember && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => { setAddingMember(true); setNewMemberId(eligible[0]?.id ?? ''); setNewMemberRole('member'); setPmError(null); }}
                      disabled={pmPending || eligible.length === 0}
                      title={eligible.length === 0 ? 'Alle Workspace-Mitglieder sind bereits im Projekt' : undefined}
                    >
                      <I.plus size={12} /> Hinzufügen
                    </button>
                  )}
                </div>

                {pmLoading && <div className="meta">Wird geladen…</div>}
                {pmError && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{pmError}</div>}

                {!pmLoading && projectMembers.length === 0 && (
                  <div className="meta">Noch keine Projektmitglieder.</div>
                )}

                <div className="col gap-2">
                  {projectMembers.map((m) => (
                    <div key={m.userId} className="row between items-center" style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--bg-sunk)' }}>
                      <div className="row gap-2 items-center" style={{ minWidth: 0 }}>
                        <Avatar user={data.members.find((u) => u.id === m.userId) ?? { name: m.name, initials: m.name.slice(0, 2).toUpperCase() }} />
                        <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                      </div>
                      <div className="row gap-2 items-center">
                        {canManage ? (
                          <select
                            className="input"
                            value={m.role}
                            onChange={(e) => handleRoleMember(m.userId, e.target.value)}
                            disabled={pmPending}
                            style={{ height: 26, fontSize: 12, width: 90, padding: '0 4px' }}
                          >
                            <option value="manager">Manager</option>
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'capitalize' }}>{m.role}</span>
                        )}
                        {canManage && (
                          <button
                            className="btn btn-icon btn-quiet btn-sm"
                            onClick={() => handleRemoveMember(m.userId)}
                            disabled={pmPending}
                            title="Entfernen"
                          >
                            <I.x size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {addingMember && (
                  <div className="col gap-2 mt-3" style={{ paddingTop: 12, borderTop: '1px solid var(--border-soft)' }}>
                    <div className="row gap-2">
                      <select
                        className="input"
                        value={newMemberId}
                        onChange={(e) => setNewMemberId(e.target.value)}
                        disabled={pmPending}
                        style={{ height: 28, fontSize: 12.5, flex: 1 }}
                      >
                        {eligible.length === 0
                          ? <option value="">Alle hinzugefügt</option>
                          : eligible.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)
                        }
                      </select>
                      <select
                        className="input"
                        value={newMemberRole}
                        onChange={(e) => setNewMemberRole(e.target.value)}
                        disabled={pmPending}
                        style={{ height: 28, fontSize: 12.5, width: 90 }}
                      >
                        <option value="manager">Manager</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                    <div className="row gap-2">
                      <button className="btn btn-brand btn-sm" onClick={handleAddMember} disabled={pmPending || !newMemberId}>
                        {pmPending ? '…' : 'Hinzufügen'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setAddingMember(false); setPmError(null); }} disabled={pmPending}>Abbrechen</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {project.links?.length > 0 && (
            <div className="card card-pad">
              <div className="label mb-3">Wichtige Links</div>
              <div className="col gap-2">
                {project.links.map((l, i) => (
                  <a key={i} className="row gap-2" style={{ fontSize: 13, color: 'var(--text-1)', padding: '6px 0' }}>
                    <I.link size={13} color="var(--text-3)" /> {l.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div className="label" style={{ marginBottom: 5 }}>{label}</div>
    <div style={{ fontSize: 13.5 }}>{children}</div>
  </div>
);

function CommentItem({ authorId, time, text }) {
  const { data } = useWorkspace();
  const u = data.members.find((m) => m.id === authorId);
  if (!u) return null;
  return (
    <div className="row gap-3 items-start">
      <Avatar user={u} size="md" />
      <div style={{ flex: 1 }}>
        <div className="row gap-2">
          <span style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</span>
          <span className="meta">{time}</span>
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--text-1)', marginTop: 4, lineHeight: 1.55 }}>{text}</div>
      </div>
    </div>
  );
}

const ACTIVITY_ICON_MAP = {
  check:       (s) => <I.check size={s} />,
  message:     (s) => <I.message size={s} />,
  paperclip:   (s) => <I.paperclip size={s} />,
  block:       (s) => <I.block size={s} />,
  plus:        (s) => <I.plus size={s} />,
  slack:       (s) => <I.slack size={s} />,
  user:        (s) => <I.user size={s} />,
  'arrow-right':(s) => <I.arrowRight size={s} />,
  calendar:    (s) => <I.calendar size={s} />,
};

function parseActivityMeta(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function formatMeta(meta, icon) {
  if (!meta) return null;
  if (typeof meta === 'string') return meta;
  // Status change: { from, to }
  if (meta.from && meta.to) return `${meta.from} → ${meta.to}`;
  // Slack source
  if (meta.source === 'slack_slash_command')
    return `via Slack${meta.slack_user ? ` (@${meta.slack_user})` : ''}`;
  // Blocker reason
  if (meta.reason) return meta.reason;
  return null;
}

export function ActivityTimeline({ items, onOpenTask }) {
  const { data } = useWorkspace();

  return (
    <div className="col gap-0">
      {items.map((a, idx) => {
        const member  = a.user ? data.members.find((m) => m.id === a.user) : null;
        const isSlack = !a.user;
        const meta    = parseActivityMeta(a.meta);

        // Resolve actor display name
        const actorName = isSlack
          ? `Slack${meta?.slack_user ? ` (@${meta.slack_user})` : ''}`
          : (member?.name ?? a.user.slice(0, 8) + '…');

        // Resolve target name (task title or project name)
        const task    = data.tasks.find((t) => t.id === a.target);
        const project = data.projects.find((p) => p.id === a.target);
        const targetName = task?.title ?? project?.name ?? meta?.title ?? meta?.name ?? null;
        const isTask  = !!task;
        const canClick = isTask && !!onOpenTask;

        const metaLine = formatMeta(meta, a.icon);

        const iconEl = ACTIVITY_ICON_MAP[a.icon]?.(11) ?? <I.activity size={11} />;
        const iconColor =
          a.icon === 'check'       ? 'var(--success)' :
          a.icon === 'block'       ? 'var(--danger)'  :
          a.icon === 'arrow-right' ? 'var(--info)'    :
          a.icon === 'message'     ? 'var(--brand)'   :
          'var(--text-3)';

        return (
          <div
            key={a.id}
            className="row gap-3 items-start"
            style={{
              padding: '10px 0',
              borderBottom: idx < items.length - 1 ? '1px solid var(--border-soft)' : 'none',
            }}
          >
            {/* Icon dot */}
            <div style={{
              width: 24, height: 24, borderRadius: 999,
              background: 'var(--bg-sunk)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: iconColor, flexShrink: 0, marginTop: 1,
            }}>
              {iconEl}
            </div>

            {/* Text */}
            <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5, minWidth: 0 }}>
              <span>
                <span style={{ fontWeight: 600 }}>{actorName}</span>
                {' '}
                <span style={{ color: 'var(--text-2)' }}>{a.verb}</span>
                {targetName && (
                  <>
                    {' '}
                    <span
                      style={{
                        fontWeight: 500,
                        cursor: canClick ? 'pointer' : 'default',
                        color: canClick ? 'var(--brand)' : 'inherit',
                        textDecoration: canClick ? 'underline' : 'none',
                      }}
                      onClick={canClick ? () => onOpenTask(task.id, task.projectId) : undefined}
                    >
                      „{targetName}"
                    </span>
                  </>
                )}
              </span>
              {metaLine && (
                <span style={{ color: 'var(--text-3)', fontSize: 12 }}> — {metaLine}</span>
              )}
              <div className="meta" style={{ marginTop: 2 }}>{timeAgo(a.time)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
