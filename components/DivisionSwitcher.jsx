'use client';
// DivisionSwitcher — pill tabs shown at the top of screens that support
// All / Podcast / Events filtering inside a workspace.

import { useWorkspace } from '@/components/WorkspaceProvider';

export function DivisionSwitcher({ style }) {
  const { division, setDivision, currentWorkspace } = useWorkspace();
  const caps = currentWorkspace?.capabilities ?? { podcast: true, events: false };

  const tabs = [
    { id: 'all', label: 'Alle' },
    ...(caps.podcast ? [{ id: 'podcast', label: 'Podcast' }] : []),
    ...(caps.events  ? [{ id: 'events',  label: 'Events'  }] : []),
  ];

  if (tabs.length <= 1) return null;

  return (
    <div style={{
      display: 'flex', gap: 4, padding: '2px',
      background: 'var(--bg-sunk)', borderRadius: 10,
      width: 'fit-content',
      ...style,
    }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setDivision(t.id)}
          style={{
            padding: '4px 14px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            fontSize: 12.5,
            fontWeight: 500,
            transition: 'all 0.12s',
            background: division === t.id ? 'white' : 'transparent',
            color: division === t.id ? 'var(--text-1)' : 'var(--text-3)',
            boxShadow: division === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Returns a filter function for arrays of projects/tasks based on current division. */
export function useDivisionFilter() {
  const { division } = useWorkspace();
  return (items) => {
    if (division === 'all') return items;
    return items.filter((item) => {
      const div = item.division ?? 'general';
      return div === division || div === 'general';
    });
  };
}
