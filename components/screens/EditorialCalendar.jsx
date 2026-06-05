'use client';
// Editorial Calendar — weekly view: episodes + social posts + events in one grid.

import { useEffect, useState, useMemo } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { Badge } from '@/components/ui';
import { listSocialPosts } from '@/lib/actions/social';

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function weekStart(d) {
  const day = new Date(d);
  const dow = day.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  day.setDate(day.getDate() + diff);
  day.setHours(0, 0, 0, 0);
  return day;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function iso(d) { return d.toISOString().slice(0, 10); }

const PLATFORM_EMOJI = { linkedin: '💼', instagram: '📸', twitter: '🐦', tiktok: '🎵', youtube: '▶️' };

export function EditorialCalendarScreen({ setRoute }) {
  const { currentWorkspace: brand, currentWorkspaceId, data } = useWorkspace();
  const [socialPosts, setSocialPosts] = useState([]);
  const [weekOf, setWeekOf] = useState(() => weekStart(new Date()));
  const [view, setView] = useState('week'); // week | month

  useEffect(() => {
    if (!currentWorkspaceId) return;
    listSocialPosts(currentWorkspaceId).then(setSocialPosts);
  }, [currentWorkspaceId]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekOf, i)), [weekOf]);

  const today = iso(new Date());
  const weekRange = `${days[0].toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  // Build items per day
  const byDay = useMemo(() => {
    const m = {};
    days.forEach(d => { m[iso(d)] = []; });

    // Episodes (publish date)
    (data.episodes ?? []).forEach(ep => {
      const d = ep.date;
      if (m[d]) m[d].push({ type: 'episode', label: ep.num ? `🎙 Ep. ${ep.num} · ${ep.title}` : `🎙 ${ep.title}`, color: 'var(--brand)', id: ep.id });
    });

    // Events
    data.projects.filter(p => p.division === 'events').forEach(p => {
      const d = p.eventMeta?.eventDate?.slice(0, 10);
      if (d && m[d]) m[d].push({ type: 'event', label: `🎪 ${p.name}`, color: '#e8780a', id: p.id, route: 'project:' + p.id });
      if (p.due && m[p.due]) m[p.due].push({ type: 'event-deadline', label: `📍 ${p.name} Deadline`, color: 'var(--danger)', id: p.id + '-due', route: 'project:' + p.id });
    });

    // Social posts
    socialPosts.forEach(post => {
      const d = post.scheduledAt?.slice(0, 10);
      if (d && m[d]) {
        const emoji = PLATFORM_EMOJI[post.platform] ?? '📱';
        const statusIcon = post.status === 'posted' ? '✅' : post.status === 'approved' ? '🟢' : '📝';
        m[d].push({ type: 'social', label: `${emoji} ${statusIcon} ${post.content.slice(0, 40)}${post.content.length > 40 ? '…' : ''}`, color: 'var(--info)', id: post.id, route: 'social' });
      }
    });

    // Newsletter send dates
    // (newsletter_issues are loaded separately, skip for now — show if cached)

    return m;
  }, [days, data.episodes, data.projects, socialPosts]);

  const totalItems = Object.values(byDay).reduce((s, a) => s + a.length, 0);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2"><Badge kind="brand" dot>{brand?.name}</Badge></div>
          <div className="row gap-3 items-center" style={{ flexWrap: 'wrap', marginBottom: 4 }}>
            <h1 className="h1" style={{ margin: 0 }}>Redaktionskalender</h1>
          </div>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Episoden, Social Posts und Events in einer Wochenansicht.
          </p>
        </div>
        <div className="row gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOf(w => addDays(w, -7))}>‹</button>
          <button className="btn btn-ghost btn-sm" style={{ minWidth: 180 }} disabled>{weekRange}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOf(w => addDays(w, 7))}>›</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOf(weekStart(new Date()))}>Heute</button>
        </div>
      </div>

      {/* Legend */}
      <div className="row gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
        {[
          { color: 'var(--brand)', label: 'Episode' },
          { color: '#e8780a',      label: 'Event' },
          { color: 'var(--danger)', label: 'Deadline' },
          { color: 'var(--info)',  label: 'Social Post' },
        ].map(l => (
          <div key={l.label} className="row gap-2" style={{ fontSize: 12, color: 'var(--text-2)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: l.color, flexShrink: 0, marginTop: 3 }} />
            {l.label}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <span className="meta">{totalItems} Einträge diese Woche</span>
      </div>

      {/* Week grid */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
          {days.map((d, i) => {
            const isToday = iso(d) === today;
            return (
              <div key={i} style={{ padding: '10px 12px', borderRight: i < 6 ? '1px solid var(--border-soft)' : 'none' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{DAYS[i]}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: isToday ? 'var(--brand)' : 'var(--text-1)', marginTop: 2 }}>
                  {d.getDate()}
                </div>
                {isToday && <div style={{ width: 20, height: 3, background: 'var(--brand)', borderRadius: 2, marginTop: 2 }} />}
              </div>
            );
          })}
        </div>

        {/* Content rows */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 200 }}>
          {days.map((d, i) => {
            const dayIso = iso(d);
            const items = byDay[dayIso] ?? [];
            const isToday = dayIso === today;
            return (
              <div key={i} style={{
                borderRight: i < 6 ? '1px solid var(--border-soft)' : 'none',
                padding: '8px 10px',
                background: isToday ? 'var(--brand-soft)' : 'transparent',
                minHeight: 120,
              }}>
                <div className="col gap-1">
                  {items.map((item, j) => (
                    <div
                      key={j}
                      onClick={() => item.route && setRoute(item.route)}
                      title={item.label}
                      style={{
                        padding: '3px 6px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                        border: `1px solid ${item.color}`,
                        color: 'var(--text-1)', cursor: item.route ? 'pointer' : 'default',
                        display: 'flex', gap: 4, alignItems: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-4)', fontStyle: 'italic', marginTop: 4 }}>—</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick links */}
      <div className="row gap-2 mt-4" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setRoute('pipeline')}>+ Episode planen</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setRoute('social')}>+ Social Post erstellen</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setRoute('newsletter')}>+ Newsletter Ausgabe</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setRoute('eventhub')}>+ Event erstellen</button>
      </div>
    </div>
  );
}
