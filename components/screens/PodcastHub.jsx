'use client';
// Podcast Hub — 3 Tabs: Übersicht · Episoden · Pipeline

import { Fragment, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Badge } from '@/components/ui';
import { generateMarketingPackage } from '@/lib/actions/podcast';
import { createEpisode, updateEpisode } from '@/lib/actions/episodes';
import { createTask } from '@/lib/actions/tasks';
import { EpisodePipelineScreen } from '@/components/screens/EpisodePipeline';

// EPISODES is now loaded from Supabase via WorkspaceProvider.

const ANALYTICS = {
  totalDownloads: 284_620,
  uniqueListeners: 41_330,
  avgPerEpisode: 3_980,
  growth30d: 12.4,
  weeklyDownloads: [2840, 3120, 2980, 3450, 3820, 4100, 3760, 4200, 3940, 4820, 5010, 4650],
  geo: [
    { flag: '🇩🇪', country: 'Deutschland', city: 'Berlin, München, Hamburg',  dl: 118_400, pct: 41.6 },
    { flag: '🇦🇹', country: 'Österreich',  city: 'Wien, Graz',               dl: 31_200,  pct: 11.0 },
    { flag: '🇨🇭', country: 'Schweiz',     city: 'Zürich, Basel',            dl: 28_900,  pct: 10.2 },
    { flag: '🇺🇸', country: 'USA',         city: 'New York, SF, Austin',     dl: 24_600,  pct: 8.6  },
    { flag: '🇬🇧', country: 'Großbritannien', city: 'London',                dl: 14_100,  pct: 5.0  },
    { flag: '🌍', country: 'Weitere 47',    city: '—',                        dl: 67_420,  pct: 23.7 },
  ],
  apps: [
    { name: 'Apple Podcasts', pct: 44.2, color: 'var(--info)' },
    { name: 'Spotify',        pct: 28.7, color: '#1DB954'      },
    { name: 'Overcast',       pct: 9.1,  color: 'var(--warning)'},
    { name: 'Pocket Casts',   pct: 7.3,  color: 'var(--danger)' },
    { name: 'Google Podcasts',pct: 4.2,  color: 'var(--text-3)' },
    { name: 'Andere',         pct: 6.5,  color: 'var(--neutral)'},
  ],
  devices: [
    { name: 'iPhone',         pct: 51.3 },
    { name: 'MacBook / iMac', pct: 18.6 },
    { name: 'Android Phone',  pct: 17.4 },
    { name: 'Windows PC',     pct: 8.2  },
    { name: 'iPad',           pct: 3.1  },
    { name: 'Smart Speaker',  pct: 1.4  },
  ],
  os: [
    { name: 'iOS 17+',        pct: 48.9 },
    { name: 'macOS 14',       pct: 16.2 },
    { name: 'Android 13+',    pct: 15.1 },
    { name: 'Android 12',     pct: 8.6  },
    { name: 'Windows 11',     pct: 7.4  },
    { name: 'Andere',         pct: 3.8  },
  ],
};

const PRIVATE_SUBS = [
  { id: 'sub-1', name: 'Fabian Tausch',   email: 'fabian@ub.de',    plan: 'Pro',     feedUrl: 'https://feeds.ub.de/private/a1b2c3', active: true  },
  { id: 'sub-2', name: 'Anna Kirmße',     email: 'anna@example.de', plan: 'Pro',     feedUrl: 'https://feeds.ub.de/private/d4e5f6', active: true  },
  { id: 'sub-3', name: 'Marc Beckmann',   email: 'marc@test.de',    plan: 'Starter', feedUrl: 'https://feeds.ub.de/private/g7h8i9', active: false },
];

const ACTIVITY_FEED = [
  { id: 1,  time: 'vor 8 Min',   icon: 'download', color: 'var(--success)', text: 'Ep. 142 — 47 neue Downloads in den letzten 8 Min.' },
  { id: 2,  time: 'vor 23 Min',  icon: 'mic',      color: 'var(--brand)',   text: 'Ep. 143 "Cold Outbound" für 2026-05-21 geplant' },
  { id: 3,  time: 'vor 1 Std',   icon: 'globe',    color: 'var(--info)',    text: 'Neue Hörer aus 🇺🇸 San Francisco (14 Unique Listeners)' },
  { id: 4,  time: 'vor 2 Std',   icon: 'rss',      color: 'var(--warning)', text: 'Spotify Legal Review: Status unverändert — wartet auf manuelles Signal' },
  { id: 5,  time: 'vor 3 Std',   icon: 'doc',      color: 'var(--text-3)', text: 'Transkript für Ep. 142 wurde generiert (58:24 Min → 12.400 Wörter)' },
  { id: 6,  time: 'gestern',     icon: 'download', color: 'var(--success)', text: 'Ep. 142 veröffentlicht — 1.204 Downloads in ersten 24h' },
  { id: 7,  time: 'gestern',     icon: 'radio',    color: 'var(--text-3)', text: 'Apple Podcasts RSS-Feed synchronisiert (142 Episoden)' },
  { id: 8,  time: 'vor 3 Tagen', icon: 'trend',    color: 'var(--success)', text: 'Monatlicher Meilenstein: 40k Unique Listeners erreicht 🎉' },
];


function fmt(n) { if (n == null || isNaN(n)) return '—'; return n >= 1_000_000 ? (n/1_000_000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'k' : String(n); }

// ── Main Screen ───────────────────────────────────────────────────────────
export function PodcastHubScreen({ setRoute }) {
  const { currentWorkspace: brand, currentWorkspaceId, data, addEpisode } = useWorkspace();
  const episodes = data.episodes ?? [];
  const [tab, setTab] = useState('overview');

  const tabs = [
    { id: 'overview',  label: 'Übersicht', icon: <I.home size={12} />   },
    { id: 'episodes',  label: 'Episoden',  icon: <I.mic size={12} />    },
    { id: 'pipeline',  label: 'Pipeline',  icon: <I.kanban size={12} /> },
  ];

  return (
    <div className="page fade-in">
      {/* Header */}
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2">
            <Badge kind="brand" dot>{brand?.name}</Badge>
            <span style={{ color: 'var(--text-3)', fontSize: 12.5 }}>· Podcast Hub v2</span>
          </div>
          <h1 className="h1" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <I.mic size={22} /> Podcast Hub
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            {episodes.length} Episoden · Produktions-Pipeline · Übersicht
          </p>
        </div>
        <div className="row gap-2">
          <div className="row gap-2 items-center" style={{ fontSize: 11.5, border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', background: 'var(--bg-elev)' }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--success)', display: 'inline-block' }} />
            Apple Podcasts live
          </div>
          <div className="row gap-2 items-center" style={{ fontSize: 11.5, border: '1px solid var(--warning-border)', borderRadius: 6, padding: '5px 12px', background: 'var(--warning-bg)', color: 'var(--warning)' }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--warning)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            Spotify · Legal Review
          </div>
          <div className="row gap-1 items-center" style={{ fontSize: 11, color: 'var(--text-4)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px' }}>
            <I.rss size={11} color="var(--text-4)" /> 7 MCP Tools
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs mb-4" style={{ flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="row gap-1" style={{ fontSize: 12.5 }}>{t.icon} {t.label}</span>
          </div>
        ))}
      </div>

      {tab === 'overview'  && <OverviewTab episodes={episodes} />}
      {tab === 'episodes'  && <EpisodenTab episodes={episodes} workspaceId={currentWorkspaceId} addEpisode={addEpisode} setTab={setTab} />}
      {tab === 'pipeline'  && <EpisodePipelineScreen setRoute={setRoute} embedded />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 1 — Übersicht (Unified View)
// ═══════════════════════════════════════════════════════════════════════════
function OverviewTab({ episodes }) {
  const published = episodes.filter((e) => e.status === 'published');
  const scheduled = episodes.filter((e) => e.status === 'scheduled');
  const totalDownloads = episodes.reduce((s, e) => s + (e.downloads ?? 0), 0);
  const avgPerEp = published.length ? Math.round(totalDownloads / published.length) : 0;
  return (
    <div className="col gap-4">
      {/* Top KPIs */}
      <div className="grid grid-4 gap-3">
        <div className="kpi"><div className="kpi-label">Gesamt Downloads</div><div className="kpi-value mono">{fmt(totalDownloads || ANALYTICS.totalDownloads)}</div><div className="kpi-trend up">IAB Tier 2 zertifiziert</div></div>
        <div className="kpi"><div className="kpi-label">Unique Listeners 30d</div><div className="kpi-value mono">{fmt(ANALYTICS.uniqueListeners)}</div><div className="kpi-trend up">+{ANALYTICS.growth30d}% vs. Vormonat</div></div>
        <div className="kpi"><div className="kpi-label">Episoden gesamt</div><div className="kpi-value mono">{episodes.length || '—'}</div><div className="kpi-trend">{scheduled.length > 0 ? `${scheduled.length} geplant` : 'Alle live'}</div></div>
        <div className="kpi"><div className="kpi-label">Ø Downloads / Ep.</div><div className="kpi-value mono">{fmt(avgPerEp || ANALYTICS.avgPerEpisode)}</div><div className="kpi-trend up">Top 5% DACH Podcast</div></div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
        {/* Unified Activity Feed */}
        <div className="card">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
            <div className="h3">Aktivitäts-Feed</div>
            <div className="meta mt-1">Alle Podcast-Aktivitäten · Echtzeit</div>
          </div>
          <div className="col">
            {ACTIVITY_FEED.map((item, i) => (
              <div key={item.id} className="row gap-3 items-start" style={{ padding: '11px 18px', borderBottom: i < ACTIVITY_FEED.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--bg-sunk)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ActivityIcon name={item.icon} color={item.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.45 }}>{item.text}</div>
                  <div className="meta mt-1">{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="col gap-3">
          {/* Mini chart */}
          <div className="card card-pad">
            <div className="label mb-3">Downloads · 12 Wochen</div>
            <MiniBarChart data={ANALYTICS.weeklyDownloads} />
          </div>

          {/* Platform status */}
          <div className="card card-pad">
            <div className="label mb-3">Plattform-Status</div>
            <div className="col gap-2">
              {[
                { name: 'Apple Podcasts', status: 'active'  },
                { name: 'Spotify',        status: 'review'  },
                { name: 'Amazon Music',   status: 'inactive'},
              ].map((p) => (
                <div key={p.name} className="row between" style={{ fontSize: 13 }}>
                  <span>{p.name}</span>
                  <PlatformBadge status={p.status} />
                </div>
              ))}
            </div>
          </div>

          {/* Top geo */}
          <div className="card card-pad">
            <div className="label mb-3">Top-Länder</div>
            <div className="col gap-1">
              {ANALYTICS.geo.slice(0, 4).map((g) => (
                <div key={g.country} className="row between" style={{ fontSize: 12.5 }}>
                  <span>{g.flag} {g.country}</span>
                  <span className="mono" style={{ fontWeight: 600 }}>{fmt(g.dl)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Standard production tasks created for every new episode when
// "Workflow-Tasks anlegen" is checked.
const EPISODE_WORKFLOW = [
  { title: 'Aufnahme',               priority: 'High'   },
  { title: 'Schnitt',                priority: 'High'   },
  { title: 'Thumbnail erstellen',    priority: 'Medium' },
  { title: 'Show Notes schreiben',   priority: 'Medium' },
  { title: 'Distribution',           priority: 'Low'    },
];

// ═══════════════════════════════════════════════════════════════════════════
// Tab 2 — Episoden + Video-Infrastruktur
// ═══════════════════════════════════════════════════════════════════════════
function EpisodenTab({ episodes, workspaceId, addEpisode, setTab }) {
  const { updateEpisodeInCache, data, addTask } = useWorkspace();
  const [search, setSearch] = useState('');
  const [expandedEp, setExpandedEp] = useState(null);
  const [editingEp, setEditingEp] = useState(null); // episode id being edited
  const [editFields, setEditFields] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const [showNew, setShowNew] = useState(false);

  const startEdit = (ep) => {
    setEditingEp(ep.id);
    setEditFields({ title: ep.title, guest: ep.guest ?? '', date: ep.date ?? '', duration: ep.duration === '—' ? '' : (ep.duration ?? ''), status: ep.status, num: ep.num ?? '' });
    setEditError(null);
  };

  const cancelEdit = () => { setEditingEp(null); setEditFields({}); setEditError(null); };

  const saveEdit = async (ep) => {
    if (!editFields.title?.trim()) return;
    setEditSaving(true); setEditError(null);
    const r = await updateEpisode({
      episodeId: ep.id,
      workspaceId,
      patch: {
        title: editFields.title.trim(),
        guest: editFields.guest.trim() || undefined,
        date: editFields.date || undefined,
        duration: editFields.duration.trim() || undefined,
        status: editFields.status,
        num: editFields.num ? parseInt(editFields.num, 10) : null,
      },
    });
    setEditSaving(false);
    if (!r.ok) { setEditError(r.error); return; }
    updateEpisodeInCache(ep.id, {
      title: editFields.title.trim(),
      guest: editFields.guest.trim(),
      date: editFields.date,
      duration: editFields.duration.trim() || '—',
      status: editFields.status,
      num: editFields.num ? parseInt(editFields.num, 10) : null,
    });
    cancelEdit();
  };
  const [newTitle, setNewTitle] = useState('');
  const [newGuest, setNewGuest] = useState('');
  const [newNum, setNewNum] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newStatus, setNewStatus] = useState('draft');
  const [withWorkflow, setWithWorkflow] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [workflowCreated, setWorkflowCreated] = useState(null); // count of created tasks

  const filtered = episodes.filter((e) =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    (e.guest ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const submitNew = async (evt) => {
    evt.preventDefault();
    if (!newTitle.trim()) return;
    setSaving(true); setSaveError(null); setWorkflowCreated(null);

    const epR = await createEpisode({
      workspaceId,
      title: newTitle.trim(),
      episodeNumber: newNum ? parseInt(newNum, 10) : null,
      guest: newGuest.trim() || undefined,
      publishDate: newDate || undefined,
      status: newStatus,
    });
    if (!epR.ok) { setSaving(false); setSaveError(epR.error); return; }
    const newEpisode = epR.data;
    if (newEpisode) addEpisode(newEpisode);

    // Create standard workflow tasks linked to this episode
    if (withWorkflow && newEpisode) {
      const projectId = data.projects.find((p) => p.status !== 'Done')?.id;
      if (projectId) {
        const epLabel = newNum ? `Ep. ${newNum} — ` : '';
        const results = await Promise.all(
          EPISODE_WORKFLOW.map((t) =>
            createTask({
              workspaceId,
              projectId,
              title: `${epLabel}${t.title}`,
              priority: t.priority,
              episodeId: newEpisode.id,
            }),
          ),
        );
        const created = results.filter((r) => r.ok && r.data);
        created.forEach((r) => addTask(r.data));
        setWorkflowCreated(created.length);
      }
    }

    setSaving(false);
    setShowNew(false);
    setNewTitle(''); setNewGuest(''); setNewNum(''); setNewDate('');
    setNewStatus('draft'); setWithWorkflow(true);
  };

  return (
    <div className="col gap-4">
      <div className="row gap-3 items-center">
        <input className="input" placeholder="Episoden suchen…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 300 }} />
        <span className="meta">{filtered.length} Episoden</span>
        <div style={{ flex: 1 }} />
        <McpTag tool="list_episodes · get_episode · create_episode" />
        <button className="btn btn-brand btn-sm" onClick={() => setShowNew((s) => !s)}><I.plus size={13} /> Neue Episode</button>
      </div>

      {showNew && (
        <form onSubmit={submitNew} className="card card-pad col gap-3" style={{ border: '1px solid var(--brand)' }}>
          <div className="h3">Neue Episode</div>
          <div className="grid grid-2 gap-3">
            <div className="col gap-1">
              <label className="label">Titel *</label>
              <input className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Episodentitel…" required autoFocus />
            </div>
            <div className="col gap-1">
              <label className="label">Gast</label>
              <input className="input" value={newGuest} onChange={(e) => setNewGuest(e.target.value)} placeholder="Name des Gastes…" />
            </div>
            <div className="col gap-1">
              <label className="label">Episoden-Nr.</label>
              <input className="input" type="number" value={newNum} onChange={(e) => setNewNum(e.target.value)} placeholder="z.B. 143" min="1" />
            </div>
            <div className="col gap-1">
              <label className="label">Veröffentlichungsdatum</label>
              <input className="input" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div className="col gap-1">
              <label className="label">Status</label>
              <select className="input" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                <option value="draft">Entwurf</option>
                <option value="scheduled">Geplant</option>
                <option value="published">Veröffentlicht</option>
              </select>
            </div>
          </div>
          {/* Workflow toggle */}
          <label className="row gap-2 items-center" style={{ cursor: 'pointer', padding: '8px 10px', background: withWorkflow ? 'var(--brand-soft)' : 'var(--bg-sunk)', borderRadius: 6, border: `1px solid ${withWorkflow ? 'var(--brand)' : 'var(--border)'}`, transition: 'all 0.15s' }}>
            <input type="checkbox" checked={withWorkflow} onChange={(e) => setWithWorkflow(e.target.checked)} disabled={saving} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Workflow-Tasks anlegen</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                {EPISODE_WORKFLOW.map((t) => t.title).join(' · ')}
              </div>
            </div>
          </label>

          {!data.projects.find(p => p.status !== 'Done') && withWorkflow && (
            <div style={{ fontSize: 12, color: 'var(--warning)' }}>
              ⚠️ Kein aktives Projekt gefunden — Tasks können nicht angelegt werden.
            </div>
          )}

          {saveError && <div style={{ fontSize: 12.5, color: 'var(--danger)' }}>{saveError}</div>}
          <div className="row gap-2">
            <button type="submit" className="btn btn-brand btn-sm" disabled={saving || !newTitle.trim()}>
              {saving ? 'Wird angelegt…' : 'Episode anlegen'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowNew(false)} disabled={saving}>Abbrechen</button>
          </div>
        </form>
      )}

      {workflowCreated !== null && (
        <div style={{ padding: '10px 14px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 8, fontSize: 13, color: 'var(--success)' }}>
          ✅ Episode angelegt + {workflowCreated} Workflow-Tasks erstellt und mit der Episode verknüpft.
        </div>
      )}

      {episodes.length === 0 && !showNew && (
        <div className="card" style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
          Noch keine Episoden. Klicke "Neue Episode" um die erste anzulegen.
        </div>
      )}

      {/* Video push notice */}
      <div style={{ padding: '10px 16px', background: 'var(--info-bg)', border: '1px solid var(--info-border)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
        <span style={{ fontSize: 18 }}>🎬</span>
        <div>
          <strong>YouTube + Spotify Video Push</strong> — geplant für Juli 2026.
          Episoden mit <Badge kind="ghost">Video</Badge>-Tag erhalten automatisch einen Video-Container sobald die Integration live geht.
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 44 }}>#</th>
              <th>Titel</th>
              <th>Gast</th>
              <th>Datum</th>
              <th>Dauer</th>
              <th>Downloads</th>
              <th style={{ width: 100 }}>Tasks</th>
              <th>Video</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ep) => {
              const epTasks = (data.tasks ?? []).filter(t => t.episodeId === ep.id);
              const total = epTasks.length;
              const done  = epTasks.filter(t => t.status === 'Done').length;
              const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
              const allDone = total > 0 && done === total;
              return (
              <Fragment key={ep.id}>
                <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedEp(expandedEp === ep.id ? null : ep.id)}>
                  <td><span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{ep.num}</span></td>
                  <td><div style={{ fontWeight: 500, fontSize: 13.5 }}>{ep.title}</div></td>
                  <td><span style={{ color: 'var(--text-2)', fontSize: 13 }}>{ep.guest}</span></td>
                  <td><span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{ep.date}</span></td>
                  <td><span className="mono" style={{ fontSize: 12 }}>{ep.duration}</span></td>
                  <td><span className="mono" style={{ fontWeight: 600, fontSize: 13 }}>{ep.downloads > 0 ? fmt(ep.downloads) : '—'}</span></td>
                  <td>
                    {total === 0 ? (
                      <span style={{ fontSize: 11, color: 'var(--text-4)' }}>—</span>
                    ) : (
                      <div className="col gap-1" style={{ minWidth: 72 }}>
                        <div className="row between" style={{ fontSize: 11 }}>
                          <span style={{ color: allDone ? 'var(--success)' : 'var(--text-2)', fontWeight: allDone ? 600 : 400 }}>
                            {allDone ? '✓ Fertig' : `${done}/${total}`}
                          </span>
                          {!allDone && <span className="mono" style={{ color: 'var(--text-3)', fontSize: 10 }}>{pct}%</span>}
                        </div>
                        <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: pct + '%', background: allDone ? 'var(--success)' : 'var(--brand)', borderRadius: 2, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    )}
                  </td>
                  <td>
                    {ep.hasVideo
                      ? <Badge kind="ghost" style={{ fontSize: 10 }}>🎬 Video</Badge>
                      : <span style={{ fontSize: 11, color: 'var(--text-4)' }}>Audio only</span>}
                  </td>
                  <td><EpStatusBadge status={ep.status} /></td>
                  <td><I.chevron size={12} style={{ transform: expandedEp === ep.id ? 'rotate(90deg)' : 'none', transition: '0.15s' }} /></td>
                </tr>
                {expandedEp === ep.id && (
                  <tr>
                    <td colSpan={10} style={{ padding: 0 }}>
                      <div style={{ padding: '16px 20px', background: 'var(--bg)', borderBottom: '1px solid var(--border-soft)' }}>
                        {editingEp === ep.id ? (
                          /* ── Inline edit form ── */
                          <div className="col gap-3">
                            <div className="label">Episode bearbeiten</div>
                            <div className="grid grid-2 gap-3">
                              <div className="col gap-1">
                                <label className="label">Titel *</label>
                                <input className="input" value={editFields.title ?? ''} onChange={(e) => setEditFields((f) => ({ ...f, title: e.target.value }))} autoFocus />
                              </div>
                              <div className="col gap-1">
                                <label className="label">Gast</label>
                                <input className="input" value={editFields.guest ?? ''} onChange={(e) => setEditFields((f) => ({ ...f, guest: e.target.value }))} />
                              </div>
                              <div className="col gap-1">
                                <label className="label">Episoden-Nr.</label>
                                <input className="input" type="number" value={editFields.num ?? ''} onChange={(e) => setEditFields((f) => ({ ...f, num: e.target.value }))} min="1" />
                              </div>
                              <div className="col gap-1">
                                <label className="label">Datum</label>
                                <input className="input" type="date" value={editFields.date ?? ''} onChange={(e) => setEditFields((f) => ({ ...f, date: e.target.value }))} />
                              </div>
                              <div className="col gap-1">
                                <label className="label">Dauer</label>
                                <input className="input" placeholder="z.B. 58:24" value={editFields.duration ?? ''} onChange={(e) => setEditFields((f) => ({ ...f, duration: e.target.value }))} />
                              </div>
                              <div className="col gap-1">
                                <label className="label">Status</label>
                                <select className="input" value={editFields.status ?? 'draft'} onChange={(e) => setEditFields((f) => ({ ...f, status: e.target.value }))}>
                                  <option value="draft">Entwurf</option>
                                  <option value="scheduled">Geplant</option>
                                  <option value="published">Veröffentlicht</option>
                                </select>
                              </div>
                            </div>
                            {editError && <div style={{ fontSize: 12.5, color: 'var(--danger)' }}>{editError}</div>}
                            <div className="row gap-2">
                              <button className="btn btn-brand btn-sm" onClick={() => saveEdit(ep)} disabled={editSaving || !editFields.title?.trim()}>{editSaving ? 'Speichern…' : 'Speichern'}</button>
                              <button className="btn btn-ghost btn-sm" onClick={cancelEdit} disabled={editSaving}>Abbrechen</button>
                            </div>
                          </div>
                        ) : (
                          /* ── Detail view ── */
                          <div className="grid gap-4" style={{ gridTemplateColumns: ep.hasVideo ? '1fr 1.4fr' : '1fr' }}>
                            <div className="col gap-3">
                              <div className="label">Episode-Details</div>
                              <div className="grid grid-2 gap-2" style={{ fontSize: 12.5 }}>
                                <div><span style={{ color: 'var(--text-3)' }}>MCP ID: </span><code style={{ fontSize: 11 }}>{ep.id}</code></div>
                                <div><span style={{ color: 'var(--text-3)' }}>Downloads: </span><strong>{ep.downloads.toLocaleString('de')}</strong></div>
                              </div>
                              <div className="row gap-2">
                                <button className="btn btn-quiet btn-sm" onClick={(e) => { e.stopPropagation(); startEdit(ep); }}><I.more size={12} /> Bearbeiten</button>
                              </div>

                              {/* Linked tasks */}
                              {(() => {
                                const linked = (data.tasks ?? []).filter(t => t.episodeId === ep.id);
                                return (
                                  <div>
                                    <div className="label mb-2" style={{ fontSize: 11 }}>
                                      Verknüpfte Tasks <span className="mono" style={{ color: 'var(--text-3)' }}>{linked.length}</span>
                                    </div>
                                    {linked.length === 0 ? (
                                      <div style={{ fontSize: 12, color: 'var(--text-4)' }}>
                                        Keine Tasks verknüpft. Im TaskDrawer Episode zuweisen.
                                      </div>
                                    ) : (
                                      <div className="col gap-1">
                                        {linked.map(t => (
                                          <div key={t.id} className="row gap-2" style={{ fontSize: 12.5, padding: '4px 0' }}>
                                            <span className="dot-indicator" style={{
                                              background: t.status === 'Done' ? 'var(--success)' : t.status === 'Blocked' ? 'var(--danger)' : t.status === 'Review' ? 'var(--warning)' : 'var(--text-3)',
                                              flexShrink: 0,
                                            }} />
                                            <span style={{ flex: 1, color: t.status === 'Done' ? 'var(--text-3)' : 'var(--text-1)', textDecoration: t.status === 'Done' ? 'line-through' : 'none' }}>{t.title}</span>
                                            <span className="meta" style={{ fontSize: 11 }}>{t.status}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                            {ep.hasVideo && (
                              <div>
                                <div className="label mb-2">Video-Container <Badge kind="ghost" style={{ fontSize: 10 }}>Juli 2026</Badge></div>
                                <VideoPlayerContainer ep={ep} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VideoPlayerContainer({ ep }) {
  return (
    <div style={{
      width: '100%', aspectRatio: '16/9', background: '#0f0f0f',
      borderRadius: 8, border: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 12, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', opacity: 0.9 }} />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: 999, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', border: '2px solid rgba(255,255,255,0.3)' }}>
          <span style={{ fontSize: 22, color: 'white', marginLeft: 3 }}>▶</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600, maxWidth: 240 }}>Ep. {ep.num} · {ep.guest}</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4 }}>YouTube + Spotify Video · Live Juli 2026</div>
      </div>
      <div style={{ position: 'absolute', bottom: 8, right: 10, display: 'flex', gap: 6, zIndex: 1 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 3, padding: '1px 5px' }}>YouTube</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 3, padding: '1px 5px' }}>Spotify Video</span>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// Shared helpers
// ═══════════════════════════════════════════════════════════════════════════
function MiniBarChart({ data, showLabels }) {
  const max = Math.max(...data);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
      {data.map((val, i) => {
        const h = Math.round((val / max) * 100);
        const isLast = i === data.length - 1;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ width: '100%', height: h + '%', minHeight: 3, background: isLast ? 'var(--brand)' : 'var(--bg-sunk)', borderRadius: '2px 2px 0 0', border: isLast ? '1px solid var(--brand)' : '1px solid var(--border)' }}
              title={`${val.toLocaleString('de')} Downloads`} />
            {showLabels && i % 3 === 0 && <span style={{ fontSize: 9, color: 'var(--text-4)' }}>W{i + 1}</span>}
          </div>
        );
      })}
    </div>
  );
}

function ActivityIcon({ name, color }) {
  const size = 13;
  const map = { download: <I.download size={size} />, mic: <I.mic size={size} />, globe: <I.globe size={size} />, rss: <I.rss size={size} />, doc: <I.doc size={size} />, radio: <I.radio size={size} />, trend: <I.trend size={size} /> };
  return <span style={{ color }}>{map[name] ?? <I.activity size={size} />}</span>;
}

function PlatformBadge({ status }) {
  if (status === 'active')   return <Badge kind="success" dot>Aktiv</Badge>;
  if (status === 'review')   return <Badge kind="warning" dot>In Prüfung</Badge>;
  if (status === 'video')    return <Badge kind="ghost" dot>Video · Juli 2026</Badge>;
  return <span style={{ fontSize: 12, color: 'var(--text-4)' }}>— Nicht konfiguriert</span>;
}

function EpStatusBadge({ status }) {
  const map = { published: ['success', 'Veröffentlicht'], scheduled: ['warning', 'Geplant'], draft: ['ghost', 'Entwurf'] };
  const [kind, label] = map[status] ?? ['ghost', status];
  return <Badge kind={kind} dot>{label}</Badge>;
}

function McpTag({ tool }) {
  return (
    <div className="row gap-1 items-center" style={{ fontSize: 10.5, color: 'var(--text-4)', border: '1px solid var(--border-soft)', borderRadius: 4, padding: '2px 8px', background: 'var(--bg)' }}>
      <I.rss size={10} /> MCP: <code style={{ fontSize: 10 }}>{tool}</code>
    </div>
  );
}
