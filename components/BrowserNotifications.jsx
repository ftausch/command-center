'use client';
// BrowserNotifications — requests Notification permission and fires
// desktop push notifications for tasks due today.
// Rendered once in App.jsx; runs silently in the background.

import { useEffect } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';

const STORAGE_KEY = (wsId) => `cc.notif.lastFired.${wsId}`;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function BrowserNotifications() {
  const { data, me, currentWorkspaceId } = useWorkspace();

  useEffect(() => {
    if (!currentWorkspaceId || !me) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'denied') return;

    const fire = () => {
      const today = todayIso();
      const key = STORAGE_KEY(currentWorkspaceId);

      // Only fire once per day per workspace
      try {
        const last = localStorage.getItem(key);
        if (last === today) return;
        localStorage.setItem(key, today);
      } catch {}

      const myTasksDueToday = (data.tasks ?? []).filter(
        (t) => t.assignee === me.id && t.due === today && t.status !== 'Done'
      );
      const overdueTasks = (data.tasks ?? []).filter(
        (t) => t.assignee === me.id && t.due && t.due < today && t.status !== 'Done'
      );

      if (myTasksDueToday.length === 0 && overdueTasks.length === 0) return;

      const parts = [];
      if (myTasksDueToday.length > 0) parts.push(`${myTasksDueToday.length} heute fällig`);
      if (overdueTasks.length > 0) parts.push(`${overdueTasks.length} überfällig`);

      new Notification('Command Center — Aufgaben', {
        body: parts.join(' · ') + '\nJetzt öffnen →',
        icon: '/favicon.ico',
        tag: `cc-daily-${today}`,
        requireInteraction: false,
      });
    };

    if (Notification.permission === 'granted') {
      fire();
    } else if (Notification.permission === 'default') {
      // Ask once — only when user is active (after a short delay)
      const timer = setTimeout(() => {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') fire();
        });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [currentWorkspaceId, me?.id, data.tasks?.length]);

  return null;
}
