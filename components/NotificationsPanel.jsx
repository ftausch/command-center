'use client';
// Notifications dropdown — derived entirely from the in-memory cache.
// No extra server calls: tasks + activity already live in WorkspaceProvider.
//
// Three notification types:
//   overdue    — my tasks past their due date (status ≠ Done)
//   due_today  — my tasks due today (status ≠ Done)
//   assigned   — tasks assigned to me in the last 48 h (from activity log)
//
// Read state is persisted in localStorage so the badge clears across reloads.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { timeAgo } from '@/lib/utils';
import { listNotifications, markNotificationsRead } from '@/lib/actions/notifications';

// ── Helpers ───────────────────────────────────────────────────────────────

function berlinToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
}

function daysLate(isoDate) {
  return Math.floor((Date.now() - new Date(isoDate + 'T00:00:00Z').getTime()) / 86_400_000);
}

const SEVERITY_COLOR = {
  danger:  'var(--danger)',
  warning: 'var(--warning)',
  info:    'var(--info)',
};

// ── NotificationsPanel ────────────────────────────────────────────────────

export function NotificationsPanel({ onClose, onOpenTask, setRoute }) {
  const { currentWorkspaceId, data, me } = useWorkspace();
  const panelRef = useRef(null);
  const [dbNotifs, setDbNotifs] = useState([]);

  const storageKey = currentWorkspaceId ? `cc.notifs.read.${currentWorkspaceId}` : null;

  const [readIds, setReadIds] = useState(() => {
    if (typeof window === 'undefined' || !storageKey) return new Set();
    try { return new Set(JSON.parse(localStorage.getItem(storageKey) ?? '[]')); }
    catch { return new Set(); }
  });

  useEffect(() => {
    if (!currentWorkspaceId) return;
    listNotifications(currentWorkspaceId).then(setDbNotifs);
  }, [currentWorkspaceId]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Derive notifications from cache ──────────────────────────────────────
  const notifications = useMemo(() => {
    if (!me?.id) return [];
    const today  = berlinToday();
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const result = [];

    // Overdue: my tasks past due date
    data.tasks
      .filter((t) => t.assignee === me.id && t.due && t.due < today && t.status !== 'Done')
      .forEach((t) => {
        const n = daysLate(t.due);
        result.push({
          id:        `overdue-${t.id}`,
          type:      'overdue',
          icon:      '⏰',
          title:     t.title,
          sub:       `${n === 1 ? '1 Tag' : `${n} Tage`} überfällig`,
          taskId:    t.id,
          projectId: t.projectId,
          sortKey:   0,
          time:      t.due,
          severity:  'danger',
        });
      });

    // Due today: my tasks due today
    data.tasks
      .filter((t) => t.assignee === me.id && t.due === today && t.status !== 'Done')
      .forEach((t) => {
        result.push({
          id:        `today-${t.id}`,
          type:      'due_today',
          icon:      '📅',
          title:     t.title,
          sub:       'Heute fällig',
          taskId:    t.id,
          projectId: t.projectId,
          sortKey:   1,
          time:      today,
          severity:  'warning',
        });
      });

    // Assigned to me recently (from activity log, last 48 h)
    data.activity
      .filter((a) => a.icon === 'user' && new Date(a.time).getTime() > cutoff)
      .forEach((a) => {
        const task = data.tasks.find((t) => t.id === a.target && t.assignee === me.id);
        if (!task) return;
        // Deduplicate: skip if already in overdue/today list
        if (result.some((n) => n.taskId === task.id)) return;
        result.push({
          id:        `assigned-${a.id}`,
          type:      'assigned',
          icon:      '👤',
          title:     task.title,
          sub:       'Dir zugewiesen',
          taskId:    task.id,
          projectId: task.projectId,
          sortKey:   2,
          time:      a.time,
          severity:  'info',
        });
      });

    // Assistant items due today or overdue (assigned to me or created by me)
    // Stored in localStorage from last AssistantHub load — check sessionStorage
    try {
      const cached = sessionStorage.getItem(`cc.assist.${currentWorkspaceId}`);
      if (cached) {
        const items = JSON.parse(cached);
        items
          .filter((i) => i.status !== 'done' && i.status !== 'cancelled' && i.dueDate)
          .filter((i) => i.dueDate <= today)
          .slice(0, 3)
          .forEach((i) => {
            const late = i.dueDate < today;
            result.push({
              id:       `assist-${i.id}`,
              type:     'assist',
              icon:     late ? '⏰' : '🗂',
              title:    i.title,
              sub:      late ? 'Assistant Item überfällig' : 'Assistant Item heute fällig',
              sortKey:  late ? 0 : 1,
              time:     i.dueDate,
              severity: late ? 'danger' : 'warning',
              route:    'assisthub',
            });
          });
      }
    } catch {}

    // DB-backed notifications (mentions, assignments)
    dbNotifs.forEach(n => {
      if (result.some(r => r.id === n.id)) return;
      const iconMap = { mention: '💬', assigned: '👤', deadline: '📅', comment: '💬', blocked: '⛔' };
      result.push({
        id: n.id, type: n.type,
        icon: iconMap[n.type] ?? '🔔',
        title: n.title, sub: n.body ?? '',
        sortKey: n.read ? 3 : 0,
        time: n.createdAt,
        severity: n.type === 'mention' ? 'info' : n.type === 'blocked' ? 'danger' : 'warning',
        route: n.linkRoute,
        dbId: n.id, dbRead: n.read,
      });
    });

    return result.sort((a, b) => a.sortKey - b.sortKey || (b.time < a.time ? -1 : 1));
  }, [me?.id, currentWorkspaceId, data.tasks, data.activity, dbNotifs]);

  const unread = notifications.filter((n) => !readIds.has(n.id));

  const markRead = (id) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      if (storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch {}
      }
      return next;
    });
  };

  const markAllRead = () => {
    const ids = notifications.map((n) => n.id);
    const next = new Set(ids);
    setReadIds(next);
    if (storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify(ids)); } catch {}
    }
    if (currentWorkspaceId) markNotificationsRead(currentWorkspaceId).catch(() => {});
    setDbNotifs(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleClick = (notif) => {
    markRead(notif.id);
    onClose();
    if (notif.taskId && onOpenTask) {
      onOpenTask(notif.taskId, notif.projectId);
    } else if (notif.route) {
      setRoute?.(notif.route);
    } else if (notif.projectId) {
      setRoute?.('project:' + notif.projectId);
    }
  };

  return (
    <div
      ref={panelRef}
      className="fade-in"
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: 340,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        zIndex: 200,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          Benachrichtigungen
          {unread.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, background: 'var(--danger)', color: '#fff', borderRadius: 999, padding: '1px 7px' }}>
              {unread.length}
            </span>
          )}
        </div>
        {unread.length > 0 && (
          <button
            className="btn btn-quiet btn-sm"
            style={{ fontSize: 11.5, color: 'var(--text-3)' }}
            onClick={markAllRead}
          >
            Alle gelesen
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ maxHeight: 380, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
            Keine offenen Benachrichtigungen
          </div>
        ) : (
          notifications.map((n) => {
            const isRead = readIds.has(n.id);
            return (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--border-soft)',
                  cursor: 'pointer',
                  background: isRead ? 'transparent' : 'var(--bg-sunk)',
                  transition: 'background 0.1s',
                  opacity: isRead ? 0.6 : 1,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = isRead ? 'transparent' : 'var(--bg-sunk)'}
              >
                {/* Severity dot */}
                <div style={{
                  width: 28, height: 28, borderRadius: 999, flexShrink: 0,
                  background: 'var(--bg-elev)',
                  border: `1.5px solid ${SEVERITY_COLOR[n.severity]}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, marginTop: 1,
                }}>
                  {n.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-1)' }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: 12, color: SEVERITY_COLOR[n.severity], marginTop: 1 }}>{n.sub}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{timeAgo(n.time)}</div>
                </div>

                {!isRead && (
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--danger)', flexShrink: 0, marginTop: 8 }} />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-soft)' }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', fontSize: 12.5 }}
            onClick={() => { onClose(); setRoute?.('activity'); }}
          >
            <I.activity size={13} /> Alle Aktivitäten ansehen
          </button>
        </div>
      )}
    </div>
  );
}

// ── Exported helper: compute unread count ─────────────────────────────────
// Used by Topbar to show the badge without rendering the full panel.

export function useNotificationCount() {
  const { currentWorkspaceId, data, me } = useWorkspace();

  const storageKey = currentWorkspaceId ? `cc.notifs.read.${currentWorkspaceId}` : null;

  const [readIds, setReadIds] = useState(() => {
    if (typeof window === 'undefined' || !storageKey) return new Set();
    try { return new Set(JSON.parse(localStorage.getItem(storageKey) ?? '[]')); }
    catch { return new Set(); }
  });

  // Re-sync when workspace changes
  useEffect(() => {
    if (!storageKey) { setReadIds(new Set()); return; }
    try { setReadIds(new Set(JSON.parse(localStorage.getItem(storageKey) ?? '[]'))); }
    catch { setReadIds(new Set()); }
  }, [storageKey]);

  return useMemo(() => {
    if (!me?.id) return 0;
    const today = berlinToday();
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    let count = 0;

    data.tasks.forEach((t) => {
      if (t.assignee !== me.id || t.status === 'Done') return;
      if (t.due && t.due < today && !readIds.has(`overdue-${t.id}`)) count++;
      else if (t.due === today && !readIds.has(`today-${t.id}`)) count++;
    });

    data.activity
      .filter((a) => a.icon === 'user' && new Date(a.time).getTime() > cutoff)
      .forEach((a) => {
        const task = data.tasks.find((t) => t.id === a.target && t.assignee === me.id);
        if (!task) return;
        // skip if already counted as overdue/today
        const alreadyCounted =
          (task.due && task.due < today) || task.due === today;
        if (!alreadyCounted && !readIds.has(`assigned-${a.id}`)) count++;
      });

    return count;
  }, [me?.id, data.tasks, data.activity, readIds]);
}
