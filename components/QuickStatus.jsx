'use client';
// QuickStatusPicker — inline status dropdown for task rows.
// Click the status badge to open a mini-popover and change status in one click.

import { useEffect, useRef, useState } from 'react';
import { changeTaskStatus, markTaskDone } from '@/lib/actions/tasks';
import { useWorkspace } from '@/components/WorkspaceProvider';

const STATUSES = ['Backlog', 'To Do', 'In Progress', 'Review', 'Blocked', 'Done'];

const STATUS_COLOR = {
  'Backlog':     'var(--text-4)',
  'To Do':       'var(--text-3)',
  'In Progress': 'var(--info)',
  'Review':      'var(--warning)',
  'Blocked':     'var(--danger)',
  'Done':        'var(--success)',
};

export function QuickStatusPicker({ task, onUpdated, disabled }) {
  const { currentWorkspaceId, updateTaskInCache, pushActivity } = useWorkspace();
  const [open, setOpen]       = useState(false);
  const [pending, setPending] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const pick = async (e, toStatus) => {
    e.stopPropagation();
    setOpen(false);
    if (toStatus === task.status || disabled) return;
    setPending(true);
    const from = task.status;

    if (toStatus === 'Done') {
      const r = await markTaskDone({ taskId: task.id, workspaceId: currentWorkspaceId, from });
      if (r.ok) {
        updateTaskInCache(task.id, { status: 'Done' });
        if (r.activity) pushActivity(r.activity);
        onUpdated?.({ ...task, status: 'Done' });
      }
    } else {
      const r = await changeTaskStatus({ taskId: task.id, workspaceId: currentWorkspaceId, from, to: toStatus });
      if (r.ok) {
        updateTaskInCache(task.id, { status: toStatus });
        if (r.activity) pushActivity(r.activity);
        onUpdated?.({ ...task, status: toStatus });
      }
    }
    setPending(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={(e) => { e.stopPropagation(); if (!disabled) setOpen((o) => !o); }}
        disabled={pending}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '2px 8px', borderRadius: 20, border: 'none',
          fontSize: 11.5, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
          background: 'var(--bg-sunk)',
          color: STATUS_COLOR[task.status] ?? 'var(--text-3)',
          opacity: pending ? 0.6 : 1,
          transition: 'opacity 0.1s',
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[task.status] ?? 'var(--text-4)', display: 'inline-block', flexShrink: 0 }} />
        {pending ? '…' : task.status}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200,
          background: 'var(--bg-elev)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          minWidth: 140, overflow: 'hidden',
        }}>
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={(e) => pick(e, s)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '7px 12px', border: 'none',
                background: s === task.status ? 'var(--bg-sunk)' : 'transparent',
                cursor: 'pointer', fontSize: 13, color: 'var(--text-1)',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { if (s !== task.status) e.currentTarget.style.background = 'var(--bg-sunk)'; }}
              onMouseLeave={(e) => { if (s !== task.status) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[s], flexShrink: 0 }} />
              {s}
              {s === task.status && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
