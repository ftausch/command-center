'use client';
// Event Pipeline — Kanban board for event production workflow.
// Columns: Idea → Planning → Partner/Sponsor → Promotion → Ready → Live → Recap

import { useMemo, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { Badge, PriorityBadge, StatusBadge } from '@/components/ui';
import { I } from '@/components/icons';
import { daysUntil, dueLabel, projectProgress, eventHealthScore } from '@/lib/utils';
import { HealthBadge } from '@/components/EventOps';
import { changeProjectStatus } from '@/lib/actions/projects';

const PIPELINE_COLS = [
  { id: 'Idea',            label: 'Idee',             color: '#94a3b8' },
  { id: 'Planning',        label: 'Planning',          color: '#60a5fa' },
  { id: 'Partner',         label: 'Partner / Sponsor', color: '#a78bfa' },
  { id: 'Promotion',       label: 'Promotion',         color: '#f59e0b' },
  { id: 'Ready',           label: 'Bereit',            color: '#34d399' },
  { id: 'Live',            label: 'Live',              color: '#10b981' },
  { id: 'Recap',           label: 'Recap',             color: '#6b7280' },
];

// Map project status to pipeline column.
// Projects have a custom pipelineStage stored in eventMeta or fall back to status.
function statusToCol(project) {
  // Explicit pipeline stage takes priority
  const stage = project?.eventMeta?.pipelineStage;
  if (stage) return stage;
  // Fall back to status-based mapping
  switch (project?.status) {
    case 'Planning':    return 'Planning';
    case 'In Progress': return 'Promotion';
    case 'Review':      return 'Ready';
    case 'Blocked':     return 'Partner';
    case 'Done':        return 'Recap';
    default:            return 'Idea';
  }
}

function EventCard({ project, tasks, onOpen }) {
  const projTasks  = tasks.filter((t) => t.projectId === project.id);
  const openTasks  = projTasks.filter((t) => t.status !== 'Done');
  const progress   = projectProgress(projTasks);
  const d          = project.due ? daysUntil(project.due) : null;
  const health     = eventHealthScore(project, projTasks);

  return (
    <div
      onClick={onOpen}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-soft)',
        borderRadius: 10,
        padding: '12px 12px 10px',
        cursor: 'pointer',
        transition: 'border-color 0.12s, box-shadow 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Name + health */}
      <div className="row between items-start" style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, flex: 1, marginRight: 6 }}>{project.name}</div>
        <HealthBadge score={health.score} reasons={health.reasons} size="sm" />
      </div>

      {/* Meta row */}
      <div className="row gap-2" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
        <PriorityBadge priority={project.priority} />
        {project.type && (
          <span style={{ fontSize: 10.5, color: '#e8780a', fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: '#fff4e6' }}>
            {project.type}
          </span>
        )}
      </div>

      {/* Event date from eventMeta */}
      {project.eventMeta?.eventDate && (
        <div style={{ fontSize: 12, color: '#e8780a', fontWeight: 600, marginBottom: 4 }}>
          📅 {new Date(project.eventMeta.eventDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
          {' '}
          {new Date(project.eventMeta.eventDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
        </div>
      )}

      {/* Location & partner */}
      <div className="row gap-2" style={{ flexWrap: 'wrap', marginBottom: 6 }}>
        {project.eventMeta?.location && (
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>📍 {project.eventMeta.location}</span>
        )}
        {project.eventMeta?.partnerSponsor && (
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>🤝 {project.eventMeta.partnerSponsor}</span>
        )}
      </div>

      {/* Stats */}
      <div className="row gap-3" style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 6 }}>
        {openTasks.length > 0 && (
          <span>📋 {openTasks.length} offen</span>
        )}
        {project.due && !project.eventMeta?.eventDate && (
          <span style={{ color: d !== null && d < 0 ? 'var(--danger)' : d !== null && d <= 7 ? 'var(--warning)' : 'var(--text-3)' }}>
            ⏰ {dueLabel(project.due).text}
          </span>
        )}
      </div>

      {/* Resources */}
      {(project.slackChannel || project.slackConnected) && (
        <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 6 }}>
          💬 {project.slackChannel || 'Slack verbunden'}
        </div>
      )}

      {/* Progress bar */}
      {progress > 0 && (
        <div style={{ height: 3, background: 'var(--border-soft)', borderRadius: 2 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: '#e8780a', borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
      )}
    </div>
  );
}

export function EventPipelineScreen({ setRoute }) {
  const { currentWorkspace: brand, data, currentWorkspaceId, updateProjectInCache, myRole } = useWorkspace();
  const canEdit = ['owner', 'admin', 'manager'].includes(myRole);

  const eventProjects = useMemo(() =>
    data.projects.filter((p) => p.division === 'events'),
  [data.projects]);

  const columns = useMemo(() =>
    PIPELINE_COLS.map((col) => ({
      ...col,
      projects: eventProjects.filter((p) => statusToCol(p) === col.id),
    })),
  [eventProjects]);

  if (eventProjects.length === 0) {
    return (
      <div className="page fade-in">
        <div className="page-head">
          <div>
            <div className="row gap-2 mb-2">
              <Badge kind="brand" dot>{brand?.name}</Badge>
              <span style={{ fontSize: 11, color: '#e8780a', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#fff4e6' }}>Events</span>
            </div>
            <h1 className="h1">Event Pipeline</h1>
          </div>
        </div>
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-3)' }}>
          <I.calendar size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Noch keine Events</div>
          <div style={{ fontSize: 13 }}>Erstelle ein Event-Projekt um die Pipeline zu befüllen.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page fade-in" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-head" style={{ paddingBottom: 16, marginBottom: 0, flexShrink: 0 }}>
        <div>
          <div className="row gap-2 mb-2">
            <Badge kind="brand" dot>{brand?.name}</Badge>
            <span style={{ fontSize: 11, color: '#e8780a', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#fff4e6' }}>Events</span>
          </div>
          <h1 className="h1">Event Pipeline</h1>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setRoute('eventhub')}>
          <I.home size={13} /> Event Hub
        </button>
      </div>

      {/* Board */}
      <div style={{
        display: 'flex', gap: 14, overflowX: 'auto', padding: '16px 0 24px',
        flex: 1, alignItems: 'flex-start',
      }}>
        {columns.map((col) => (
          <div key={col.id} style={{ minWidth: 240, width: 240, flexShrink: 0 }}>
            {/* Column header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 10, padding: '0 2px',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.02em' }}>
                {col.label}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-4)', marginLeft: 'auto' }}>
                {col.projects.length}
              </span>
            </div>

            {/* Cards */}
            <div className="col gap-2">
              {col.projects.map((p) => (
                <EventCard
                  key={p.id}
                  project={p}
                  tasks={data.tasks}
                  onOpen={() => setRoute('project:' + p.id)}
                />
              ))}
              {col.projects.length === 0 && (
                <div style={{
                  border: '1px dashed var(--border-soft)',
                  borderRadius: 10, padding: '20px 12px',
                  textAlign: 'center', fontSize: 12, color: 'var(--text-4)',
                }}>
                  Leer
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
