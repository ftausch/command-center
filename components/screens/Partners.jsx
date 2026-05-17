'use client';
// Partners / Sponsors — workspace-wide view of all partners across event projects.
// Derived from event projects' eventMeta.partnerSponsor field.
// Shows partner name, linked events, open tasks, status.

import { useMemo, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { Badge, StatusBadge, PriorityBadge } from '@/components/ui';
import { I } from '@/components/icons';
import { dueLabel, daysUntil } from '@/lib/utils';

function PartnerCard({ name, events, tasks, setRoute }) {
  const [open, setOpen] = useState(false);
  const openTasks   = tasks.filter((t) => t.status !== 'Done');
  const nextEvent   = events.sort((a, b) => (a.due > b.due ? 1 : -1))[0];
  const d           = nextEvent?.due ? daysUntil(nextEvent.due) : null;

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div
        style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
        onClick={() => setOpen((o) => !o)}
      >
        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #e8780a 0%, #f59e0b 100%)',
          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, flexShrink: 0,
        }}>
          {name.slice(0, 2).toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{name}</div>
          <div className="row gap-3" style={{ fontSize: 12, color: 'var(--text-3)' }}>
            <span>🎪 {events.length} Event{events.length !== 1 ? 's' : ''}</span>
            {openTasks.length > 0 && <span>📋 {openTasks.length} offene Tasks</span>}
            {nextEvent?.due && (
              <span style={{ color: d !== null && d < 0 ? 'var(--danger)' : d !== null && d <= 7 ? 'var(--warning)' : 'var(--text-3)' }}>
                📅 nächstes Event: {dueLabel(nextEvent.due)}
              </span>
            )}
          </div>
        </div>

        <div className="row gap-2 items-center">
          {events.some((e) => e.status === 'In Progress') && <StatusBadge status="In Progress" />}
          {events.some((e) => e.status === 'Blocked')     && <StatusBadge status="Blocked" />}
          <I.chevronDown size={14} style={{ color: 'var(--text-3)', transform: open ? 'rotate(180deg)' : '', transition: '0.15s' }} />
        </div>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid var(--border-soft)', padding: '12px 16px' }}>
          {/* Linked Events */}
          <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
            Verknüpfte Events
          </div>
          <div className="col gap-2 mb-3">
            {events.map((e) => (
              <div
                key={e.id}
                onClick={() => setRoute('project:' + e.id)}
                className="row between items-center"
                style={{ padding: '8px 10px', background: 'var(--bg-sunk)', borderRadius: 8, cursor: 'pointer' }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{e.name}</div>
                  {e.eventMeta?.location && <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>📍 {e.eventMeta.location}</div>}
                </div>
                <div className="row gap-2 items-center">
                  <StatusBadge status={e.status} />
                  {e.due && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{dueLabel(e.due)}</span>}
                  <I.arrowRight size={11} style={{ color: 'var(--text-4)' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Open Tasks */}
          {openTasks.length > 0 && (
            <>
              <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
                Offene Tasks
              </div>
              <div className="col gap-1">
                {openTasks.slice(0, 6).map((t) => (
                  <div key={t.id} className="row gap-2 items-center" style={{ fontSize: 12.5, padding: '4px 0' }}>
                    <PriorityBadge priority={t.priority} />
                    <span style={{ flex: 1, color: 'var(--text-2)' }}>{t.title}</span>
                    <StatusBadge status={t.status} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function PartnersScreen({ setRoute }) {
  const { currentWorkspace: brand, data } = useWorkspace();
  const [search, setSearch] = useState('');

  const eventProjects = useMemo(() =>
    data.projects.filter((p) => p.division === 'events'),
  [data.projects]);

  // Collect all unique partners across event projects
  const partners = useMemo(() => {
    const map = new Map();
    for (const p of eventProjects) {
      const partner = p.eventMeta?.partnerSponsor?.trim();
      if (!partner) continue;
      if (!map.has(partner)) map.set(partner, { name: partner, events: [], tasks: [] });
      map.get(partner).events.push(p);
      const projTasks = data.tasks.filter((t) => t.projectId === p.id);
      map.get(partner).tasks.push(...projTasks);
    }
    return Array.from(map.values());
  }, [eventProjects, data.tasks]);

  const filtered = useMemo(() => {
    if (!search.trim()) return partners;
    return partners.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [partners, search]);

  return (
    <div className="page fade-in">
      {/* Header */}
      <div className="page-head" style={{ paddingBottom: 20, marginBottom: 24 }}>
        <div>
          <div className="row gap-2 mb-2">
            <Badge kind="brand" dot>{brand?.name}</Badge>
            <span style={{ fontSize: 11, color: '#e8780a', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#fff4e6' }}>Events</span>
          </div>
          <h1 className="h1">Partner & Sponsoren</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Alle Partner und Sponsoren über alle Events hinweg.
          </p>
        </div>
        <input
          className="input"
          placeholder="Partner suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 220, height: 32 }}
        />
      </div>

      {/* Stats */}
      <div className="row gap-3 mb-4 wrap">
        <div className="card card-pad" style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>{partners.length}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }}>Partner total</div>
        </div>
        <div className="card card-pad" style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>{eventProjects.filter(p => p.eventMeta?.partnerSponsor).length}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }}>Events mit Partner</div>
        </div>
        <div className="card card-pad" style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', color: '#e8780a' }}>
            {partners.reduce((sum, p) => sum + p.tasks.filter(t => t.status !== 'Done').length, 0)}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }}>Offene Tasks</div>
        </div>
      </div>

      {/* Partner list */}
      {filtered.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🤝</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
            {search ? 'Kein Partner gefunden' : 'Noch keine Partner eingetragen'}
          </div>
          <div style={{ fontSize: 13 }}>
            Partner/Sponsor im Event-Modal beim Anlegen eines Events eintragen.
          </div>
        </div>
      ) : (
        <div className="col gap-3">
          {filtered.map((p) => (
            <PartnerCard key={p.name} {...p} setRoute={setRoute} />
          ))}
        </div>
      )}
    </div>
  );
}
