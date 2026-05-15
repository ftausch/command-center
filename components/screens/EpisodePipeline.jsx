'use client';
// Episode Pipeline — Kanban board for podcast episode production.
//
// Columns: Idee → In Arbeit → Review → Geplant → Live
// Drag an episode card between columns to change its status.
// Each column has a quick-add button that opens the New Episode form.

import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Badge } from '@/components/ui';
import { updateEpisode, createEpisode } from '@/lib/actions/episodes';

// ── Column definitions ────────────────────────────────────────────────────

const COLS = [
  { id: 'idea',      label: 'Idee',      icon: '💡', accent: 'var(--text-3)'  },
  { id: 'draft',     label: 'In Arbeit', icon: '🎙️', accent: 'var(--info)'    },
  { id: 'review',    label: 'Review',    icon: '👀', accent: 'var(--warning)' },
  { id: 'scheduled', label: 'Geplant',   icon: '📅', accent: 'var(--brand)'   },
  { id: 'published', label: 'Live',      icon: '✅', accent: 'var(--success)' },
];

const STATUS_LABEL = {
  idea:      'Idee',
  draft:     'In Arbeit',
  review:    'Review',
  scheduled: 'Geplant',
  published: 'Live',
};

// ── Droppable column ──────────────────────────────────────────────────────

function Column({ col, episodes, activeId, onAdd, workspaceId, onStatusChange }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: 220,
        maxWidth: 260,
        flex: '1 1 220px',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        background: isOver ? 'var(--bg-sunk)' : 'var(--bg-elev)',
        borderRadius: 10,
        border: `1px solid ${isOver ? col.accent : 'var(--border)'}`,
        transition: 'border-color 0.15s, background 0.15s',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '10px 14px 9px',
        borderBottom: '1px solid var(--border-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div className="row gap-2" style={{ fontWeight: 700, fontSize: 13 }}>
          <span>{col.icon}</span>
          <span>{col.label}</span>
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-4)',
            background: 'var(--bg-sunk)', borderRadius: 999, padding: '1px 7px',
          }}>{episodes.length}</span>
        </div>
        <button
          className="btn btn-icon btn-quiet btn-sm"
          onClick={() => onAdd(col.id)}
          title={`Neue Episode als "${col.label}"`}
        >
          <I.plus size={13} />
        </button>
      </div>

      {/* Cards */}
      <div style={{ padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 80, flex: 1 }}>
        {episodes.map((ep) => (
          <EpisodeCard
            key={ep.id}
            episode={ep}
            isDragging={ep.id === activeId}
            colAccent={col.accent}
          />
        ))}
        {episodes.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-4)', padding: '12px 6px', textAlign: 'center' }}>
            Keine Episoden
          </div>
        )}
      </div>
    </div>
  );
}

// ── Draggable episode card ────────────────────────────────────────────────

function EpisodeCard({ episode: ep, isDragging, colAccent, overlay = false }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: ep.id });

  const style = {
    transform: transform ? `translate(${transform.x}px,${transform.y}px)` : undefined,
    opacity: isDragging && !overlay ? 0.35 : 1,
    cursor: overlay ? 'grabbing' : 'grab',
    background: 'var(--bg)',
    border: `1px solid ${overlay ? colAccent : 'var(--border)'}`,
    borderRadius: 7,
    padding: '9px 11px',
    fontSize: 13,
    boxShadow: overlay ? '0 4px 16px rgba(0,0,0,0.15)' : undefined,
    userSelect: 'none',
  };

  const inner = (
    <>
      <div className="row gap-2 mb-1" style={{ justifyContent: 'space-between' }}>
        {ep.num != null
          ? <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', background: 'var(--bg-sunk)', borderRadius: 4, padding: '1px 6px' }}>Ep. {ep.num}</span>
          : <span style={{ fontSize: 11, color: 'var(--text-4)', fontStyle: 'italic' }}>Kein Nr.</span>
        }
        {ep.date && (
          <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{ep.date}</span>
        )}
      </div>
      <div style={{ fontWeight: 600, lineHeight: 1.35, marginBottom: ep.guest ? 4 : 0 }}>{ep.title}</div>
      {ep.guest && (
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
          <I.user size={11} /> {ep.guest}
        </div>
      )}
    </>
  );

  if (overlay) return <div style={style}>{inner}</div>;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {inner}
    </div>
  );
}

// ── New Episode inline form ───────────────────────────────────────────────

function NewEpisodeForm({ defaultStatus, workspaceId, onDone, onCancel }) {
  const { addEpisode } = useWorkspace();
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    const t = title.trim();
    if (!t) return;
    setPending(true);
    setError(null);
    const r = await createEpisode({ workspaceId, title: t, status: defaultStatus });
    setPending(false);
    if (!r.ok) { setError(r.error ?? 'Fehler'); return; }
    addEpisode(r.data);
    onDone();
  };

  return (
    <div style={{ padding: '8px 8px 0' }}>
      <input
        className="input"
        autoFocus
        placeholder="Titel der Episode…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
        disabled={pending}
        style={{ fontSize: 13, marginBottom: 6 }}
      />
      {error && <div style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 4 }}>{error}</div>}
      <div className="row gap-2" style={{ marginBottom: 8 }}>
        <button className="btn btn-brand btn-sm" onClick={submit} disabled={pending || !title.trim()}>
          {pending ? '…' : 'Anlegen'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={pending}>Abbrechen</button>
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────

export function EpisodePipelineScreen({ setRoute, embedded = false }) {
  const {
    currentWorkspace: brand,
    currentWorkspaceId: workspaceId,
    data,
    updateEpisodeInCache,
  } = useWorkspace();

  const [activeEp, setActiveEp] = useState(null);   // episode being dragged
  const [addingTo, setAddingTo] = useState(null);    // column id for new episode form

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Group episodes by status
  const grouped = useMemo(() => {
    const g = {};
    COLS.forEach((c) => (g[c.id] = []));
    (data.episodes ?? []).forEach((ep) => {
      const col = COLS.find((c) => c.id === ep.status);
      if (col) g[col.id].push(ep);
      else g['draft'].push(ep); // fallback for unknown statuses
    });
    return g;
  }, [data.episodes]);

  const handleDragStart = ({ active }) => {
    const ep = (data.episodes ?? []).find((e) => e.id === active.id);
    setActiveEp(ep ?? null);
  };

  const handleDragEnd = async ({ active, over }) => {
    const ep = activeEp;
    setActiveEp(null);
    if (!over || !ep) return;

    const toStatus = over.id;
    if (ep.status === toStatus) return;

    // Optimistic update
    updateEpisodeInCache(ep.id, { status: toStatus });

    const r = await updateEpisode({ episodeId: ep.id, workspaceId, patch: { status: toStatus } });
    if (!r.ok) updateEpisodeInCache(ep.id, { status: ep.status }); // rollback
  };

  const activeColAccent = activeEp
    ? (COLS.find((c) => c.id === activeEp.status)?.accent ?? 'var(--border)')
    : 'var(--border)';

  const boardContent = (
    <>
      {!embedded && (
        <div className="page-head mb-4">
          <div>
            <div className="row gap-2 mb-1" style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
              <button className="btn btn-quiet btn-sm" onClick={() => setRoute('podcast')} style={{ padding: '0 6px', height: 22 }}>
                Podcast Hub
              </button>
              <I.chevron size={11} />
              <span>Pipeline</span>
            </div>
            <h1 className="h1">Episode Pipeline</h1>
            <p className="meta mt-1">{(data.episodes ?? []).length} Episoden · Ziehe Karten um den Status zu ändern</p>
          </div>
          <button className="btn btn-brand btn-sm" onClick={() => setAddingTo('idea')}>
            <I.plus size={13} /> Neue Episode
          </button>
        </div>
      )}
      {embedded && (
        <div className="row between mb-4" style={{ alignItems: 'center' }}>
          <p className="meta">{(data.episodes ?? []).length} Episoden · Ziehe Karten um den Status zu ändern</p>
          <button className="btn btn-brand btn-sm" onClick={() => setAddingTo('idea')}>
            <I.plus size={13} /> Neue Episode
          </button>
        </div>
      )}

      {/* Board */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
          {COLS.map((col) => (
            <div key={col.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220, flex: '1 1 220px' }}>
              <Column
                col={col}
                episodes={grouped[col.id] ?? []}
                activeId={activeEp?.id}
                onAdd={(colId) => setAddingTo(colId)}
                workspaceId={workspaceId}
                onStatusChange={() => {}}
              />
              {addingTo === col.id && (
                <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  <NewEpisodeForm
                    defaultStatus={col.id}
                    workspaceId={workspaceId}
                    onDone={() => setAddingTo(null)}
                    onCancel={() => setAddingTo(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Floating drag preview */}
        <DragOverlay>
          {activeEp && (
            <EpisodeCard episode={activeEp} colAccent={activeColAccent} overlay />
          )}
        </DragOverlay>
      </DndContext>

      {/* Legend */}
      <div className="row gap-4 mt-2" style={{ flexWrap: 'wrap' }}>
        {COLS.map((c) => (
          <span key={c.id} className="row gap-1" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: c.accent, display: 'inline-block', marginTop: 3 }} />
            {c.icon} {c.label} ({(grouped[c.id] ?? []).length})
          </span>
        ))}
      </div>
    </>
  );

  if (embedded) return boardContent;

  return (
    <div className="page fade-in">
      {boardContent}
    </div>
  );
}
