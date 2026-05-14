'use client';
// Cmd+K — Command palette overlay.
//
// Results are grouped: Actions → Projects → Tasks → People.
// Search uses multi-word matching: every whitespace-separated token must
// appear somewhere in the item's label or sub-text (case-insensitive).
// Task results open the TaskDrawer via the onOpenTask prop (passed from
// App.jsx which owns the global drawer) rather than navigating to the
// project page.

import { useEffect, useState, useMemo, useRef } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { NewTaskModal } from '@/components/NewTaskModal';
import { I } from '@/components/icons';
import { Kbd } from '@/components/ui';

// ── Multi-word match ──────────────────────────────────────────────────────
function matches(item, query) {
  if (!query.trim()) return true;
  const haystack = (item.label + ' ' + item.sub).toLowerCase();
  return query.trim().toLowerCase().split(/\s+/).every((token) => haystack.includes(token));
}

// ── Kind icon ─────────────────────────────────────────────────────────────
function KindIcon({ kind }) {
  const s = 13;
  if (kind === 'Task')    return <I.check size={s} />;
  if (kind === 'Project') return <I.folder size={s} />;
  if (kind === 'Person')  return <I.user size={s} />;
  return <I.arrowRight size={s} />;
}

// ── Section header ────────────────────────────────────────────────────────
function SectionHeader({ label }) {
  return (
    <div style={{ padding: '8px 12px 4px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-4)' }}>
      {label}
    </div>
  );
}

export function CmdK({ open, onClose, setRoute, onOpenTask }) {
  const { currentWorkspace: brand, data } = useWorkspace();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const inputRef = useRef(null);
  const activeRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      setNewTaskOpen(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // ── Build flat item list grouped by kind ─────────────────────────────────
  const { groups, flat } = useMemo(() => {
    if (!open || !brand) return { groups: [], flat: [] };

    const actionItems = [
      {
        kind: 'Action', id: 'new-task', label: 'Neue Task anlegen', sub: 'Öffnet Quick-Add',
        action: () => setNewTaskOpen(true),
      },
      {
        kind: 'Action', id: 'go-board', label: 'Board öffnen', sub: 'Kanban',
        action: () => setRoute('kanban'),
      },
      {
        kind: 'Action', id: 'go-mytasks', label: 'My Tasks öffnen', sub: 'My Tasks',
        action: () => setRoute('mytasks'),
      },
      {
        kind: 'Action', id: 'go-dash', label: 'Dashboard öffnen', sub: 'Dashboard',
        action: () => setRoute('dashboard'),
      },
      {
        kind: 'Action', id: 'go-calendar', label: 'Kalender öffnen', sub: 'Calendar',
        action: () => setRoute('calendar'),
      },
    ];

    const projectItems = data.projects.map((p) => ({
      kind: 'Project', id: p.id,
      label: p.name,
      sub: p.status + (p.priority ? ' · ' + p.priority : ''),
      action: () => setRoute('project:' + p.id),
    }));

    const taskItems = data.tasks.map((t) => ({
      kind: 'Task', id: t.id,
      label: t.title,
      sub: (data.projects.find((p) => p.id === t.projectId)?.name ?? '') + ' · ' + t.status,
      meta2: t.priority,
      action: () => onOpenTask?.(t.id, t.projectId),
    }));

    const personItems = data.members.map((u) => ({
      kind: 'Person', id: u.id,
      label: u.name,
      sub: u.role,
      action: () => setRoute('team'),
    }));

    const filtering = q.trim() !== '';
    const filtered = (items) => filtering ? items.filter((it) => matches(it, q)) : items;

    const groups = [
      { label: 'Actions',  items: filtered(actionItems).slice(0, filtering ? 5 : 4) },
      { label: 'Projekte', items: filtered(projectItems).slice(0, filtering ? 10 : 3) },
      { label: 'Tasks',    items: filtered(taskItems).slice(0, filtering ? 12 : 4) },
      { label: 'Personen', items: filtered(personItems).slice(0, 5) },
    ].filter((g) => g.items.length > 0);

    const flat = groups.flatMap((g) => g.items);
    return { groups, flat };
  }, [q, open, brand, data, setRoute, onOpenTask]);

  // Clamp idx when results change
  useEffect(() => {
    setIdx((i) => Math.min(i, Math.max(0, flat.length - 1)));
  }, [flat.length]);

  // Scroll active item into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  useEffect(() => {
    const onKey = (e) => {
      if (!open || newTaskOpen) return;
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(flat.length - 1, i + 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = flat[idx];
        if (item) { item.action(); if (item.kind !== 'Action' || item.id !== 'new-task') onClose(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, newTaskOpen, flat, idx, onClose]);

  if (!open) return null;

  // Flat index counter for matching idx across groups
  let flatIdx = 0;

  return (
    <>
      <div className="overlay" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: 80 }}>
        <div
          className="modal fade-in"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: 600, width: '100%' }}
        >
          {/* Search input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
            <I.search size={16} color="var(--text-3)" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => { setQ(e.target.value); setIdx(0); }}
              placeholder="Suche Tasks, Projekte, Personen…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: 'var(--text-1)' }}
            />
            {q && (
              <button
                onClick={() => { setQ(''); setIdx(0); inputRef.current?.focus(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 2 }}
              >
                <I.x size={13} />
              </button>
            )}
            <Kbd>esc</Kbd>
          </div>

          {/* Results */}
          <div style={{ maxHeight: 420, overflowY: 'auto', padding: '4px 6px 6px' }}>
            {flat.length === 0 && (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                Keine Treffer in {brand?.name ?? 'Workspace'}.
              </div>
            )}
            {groups.map((group) => (
              <div key={group.label}>
                <SectionHeader label={group.label} />
                {group.items.map((it) => {
                  const i = flatIdx++;
                  const isActive = i === idx;
                  return (
                    <div
                      key={it.kind + it.id}
                      ref={isActive ? activeRef : null}
                      onMouseEnter={() => setIdx(i)}
                      onClick={() => { it.action(); if (it.id !== 'new-task') onClose(); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                        background: isActive ? 'var(--bg-hover)' : 'transparent',
                        transition: 'background 0.08s',
                      }}
                    >
                      <span style={{ color: isActive ? 'var(--text-2)' : 'var(--text-4)', flexShrink: 0 }}>
                        <KindIcon kind={it.kind} />
                      </span>
                      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {it.label}
                      </span>
                      {it.meta2 && (
                        <span style={{ fontSize: 11, color: it.meta2 === 'High' ? 'var(--danger)' : it.meta2 === 'Medium' ? 'var(--warning)' : 'var(--text-4)', fontWeight: 600 }}>
                          {it.meta2}
                        </span>
                      )}
                      <span style={{ fontSize: 11.5, color: 'var(--text-3)', flexShrink: 0, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {it.sub}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)' }}>
            <span className="row gap-3">
              <span className="row gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> Navigate</span>
              <span className="row gap-1"><Kbd>↵</Kbd> Open</span>
              <span className="row gap-1"><Kbd>⌘K</Kbd> Toggle</span>
            </span>
            <span>{flat.length > 0 ? `${flat.length} Treffer` : brand?.name}</span>
          </div>
        </div>
      </div>

      {/* New Task modal — rendered outside the palette overlay so it can be
          dismissed independently without closing the palette backdrop */}
      <NewTaskModal
        open={newTaskOpen}
        onClose={() => { setNewTaskOpen(false); onClose(); }}
        onNeedProject={() => { setNewTaskOpen(false); onClose(); setRoute('projects'); }}
      />
    </>
  );
}
