'use client';
// Podcast Hub — 3 Tabs: Übersicht · Episoden · Pipeline

import { Fragment, useEffect, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Badge } from '@/components/ui';
import { generateMarketingPackage } from '@/lib/actions/podcast';
import { createEpisode, updateEpisode } from '@/lib/actions/episodes';
import { createTask } from '@/lib/actions/tasks';
import { listGuests, createGuest, updateGuest, deleteGuest } from '@/lib/actions/guests';
import { listNewsletterIssues, createNewsletterIssue, updateNewsletterIssue, deleteNewsletterIssue } from '@/lib/actions/newsletter';
import { EpisodePipelineScreen } from '@/components/screens/EpisodePipeline';
import { EpisodeDrawer } from '@/components/EpisodeDrawer';

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

const PIPELINE_STEPS = [
  { id: 1, label: 'Feed validieren',            status: 'done',     detail: '142 Episoden gefunden' },
  { id: 2, label: 'Metadaten importieren',       status: 'done',     detail: 'Titel, Beschreibung, Gäste' },
  { id: 3, label: 'Artwork herunterladen',       status: 'done',     detail: '142 Cover-Bilder (1400×1400px)' },
  { id: 4, label: 'Audio-Dateien migrieren',     status: 'running',  detail: '87 / 142 abgeschlossen (61%)' },
  { id: 5, label: 'Duplikat-Prüfung',            status: 'pending',  detail: 'Wartet auf Schritt 4' },
  { id: 6, label: 'Statistik-Daten übertragen',  status: 'pending',  detail: 'IAB-Historik (6 Monate)' },
  { id: 7, label: 'Feeds aktivieren',            status: 'pending',  detail: 'Apple + Spotify Redirect' },
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
  const [drawerEpId, setDrawerEpId] = useState(null);

  const tabs = [
    { id: 'overview',     label: 'Übersicht',      icon: <I.home size={12} />   },
    { id: 'episodes',     label: 'Episoden',        icon: <I.mic size={12} />    },
    { id: 'pipeline',     label: 'Pipeline',        icon: <I.kanban size={12} /> },
    { id: 'guests',       label: 'Gäste-CRM',       icon: <I.user size={12} />   },
    { id: 'newsletter',   label: 'Newsletter',      icon: <I.send size={12} />   },
    { id: 'publishing',   label: 'Publishing',      icon: <I.radio size={12} />  },
    { id: 'analytics',    label: 'Analytics',       icon: <I.trend size={12} />  },
    { id: 'transcripts',  label: 'Transkript · KI', icon: <I.doc size={12} />    },
    { id: 'distribution', label: 'Distribution',    icon: <I.radio size={12} />  },
    { id: 'privatefeeds', label: 'Private Feeds',   icon: <I.bell size={12} />   },
    { id: 'migration',    label: 'Migration',       icon: <I.rss size={12} />    },
    { id: 'studio',       label: 'Studio',          icon: <I.zap size={12} />    },
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

      {tab === 'overview'     && <OverviewTab episodes={episodes} onOpenEpisode={setDrawerEpId} />}
      {tab === 'episodes'     && <EpisodenTab episodes={episodes} workspaceId={currentWorkspaceId} addEpisode={addEpisode} setTab={setTab} onOpenEpisode={setDrawerEpId} />}
      {tab === 'pipeline'     && <EpisodePipelineScreen setRoute={setRoute} embedded onOpenEpisode={setDrawerEpId} />}
      {tab === 'guests'       && <GuestCRMTab workspaceId={currentWorkspaceId} />}
      {tab === 'newsletter'   && <NewsletterTab workspaceId={currentWorkspaceId} />}
      {tab === 'publishing'   && <PublishingDashboardTab episodes={episodes} workspaceId={currentWorkspaceId} onOpenEpisode={setDrawerEpId} />}

      <EpisodeDrawer episodeId={drawerEpId} onClose={() => setDrawerEpId(null)} />
      {tab === 'analytics'    && <AnalyticsTab />}
      {tab === 'transcripts'  && <TranskriptKITab episodes={episodes} />}
      {tab === 'distribution' && <DistributionTab />}
      {tab === 'privatefeeds' && <PrivateFeedsTab episodes={episodes} />}
      {tab === 'migration'    && <MigrationTab />}
      {tab === 'studio'       && <StudioTab episodes={episodes} workspaceId={currentWorkspaceId} />}
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
function EpisodenTab({ episodes, workspaceId, addEpisode, setTab, onOpenEpisode }) {
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
  const [withNotesTpl, setWithNotesTpl] = useState(true);
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

    // Pre-fill show notes template
    if (withNotesTpl && newEpisode) {
      const guestName = newGuest.trim() || 'Gast';
      const tpl = `## Über ${guestName}\n\n\n## Kapitel\n00:00 Intro\n\n\n## Links\n- \n\n## Über Unicorn Bakery\nhttps://www.unicornbakery.de`;
      updateEpisode({ episodeId: newEpisode.id, workspaceId, patch: { showNotes: tpl } });
    }

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

          {/* Show Notes template toggle */}
          <label className="row gap-2 items-center" style={{ cursor: 'pointer', padding: '8px 10px', background: withNotesTpl ? 'var(--brand-soft)' : 'var(--bg-sunk)', borderRadius: 6, border: `1px solid ${withNotesTpl ? 'var(--brand)' : 'var(--border)'}`, transition: 'all 0.15s' }}>
            <input type="checkbox" checked={withNotesTpl} onChange={(e) => setWithNotesTpl(e.target.checked)} disabled={saving} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Show Notes Vorlage einfügen</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Kapitel · Links · Gast-Bio Abschnitte vorausfüllen</div>
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
                <tr style={{ cursor: 'pointer' }} onClick={() => onOpenEpisode?.(ep.id)}>
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
                  <td>
                    <div className="row gap-1">
                      <button className="btn btn-quiet btn-icon" style={{ width: 26, height: 26 }}
                        onClick={(e) => { e.stopPropagation(); onOpenEpisode?.(ep.id); }}
                        title="Episode öffnen"
                      ><I.arrowRight size={12} /></button>
                      <button className="btn btn-quiet btn-icon" style={{ width: 26, height: 26 }}
                        onClick={(e) => { e.stopPropagation(); setExpandedEp(expandedEp === ep.id ? null : ep.id); }}
                        title="Schnell-Edit"
                      ><I.edit size={11} /></button>
                    </div>
                  </td>
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
                                <button className="btn btn-quiet btn-sm" onClick={() => setTab('transcripts')}><I.doc size={12} /> Transkript</button>
                                <button className="btn btn-quiet btn-sm" onClick={() => setTab('analytics')}><I.trend size={12} /> Analytics</button>
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
// Tab 3 — Analytics (Geo · Apps · Device · OS)
// ═══════════════════════════════════════════════════════════════════════════
function AnalyticsTab() {
  const maxWeekly = Math.max(...ANALYTICS.weeklyDownloads);
  return (
    <div className="col gap-4">
      <div className="row gap-2 mb-1 items-center">
        <McpTag tool="get_analytics" />
        <span className="meta">IAB Tier 2 Compliance · Letzte 30 Tage</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-4 gap-3">
        <div className="kpi"><div className="kpi-label">Gesamt Downloads</div><div className="kpi-value mono">{fmt(ANALYTICS.totalDownloads)}</div><div className="kpi-trend up">IAB-zertifiziert</div></div>
        <div className="kpi"><div className="kpi-label">Unique Listeners</div><div className="kpi-value mono">{fmt(ANALYTICS.uniqueListeners)}</div><div className="kpi-trend up">Letzte 30 Tage</div></div>
        <div className="kpi"><div className="kpi-label">Ø / Episode</div><div className="kpi-value mono">{fmt(ANALYTICS.avgPerEpisode)}</div><div className="kpi-trend up">Alle Episoden</div></div>
        <div className="kpi"><div className="kpi-label">Wachstum 30d</div><div className="kpi-value mono">+{ANALYTICS.growth30d}%</div><div className="kpi-trend up">vs. Vormonat</div></div>
      </div>

      {/* Downloads + Geo */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
        <div className="card card-pad">
          <div className="h3 mb-1">Downloads · 12 Wochen</div>
          <div className="meta mb-4">Wöchentliche Summe · IAB Tier 2</div>
          <MiniBarChart data={ANALYTICS.weeklyDownloads} showLabels />
        </div>
        <div className="card card-pad">
          <div className="h3 mb-1" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><I.globe size={14} /> Geo-Breakdown</div>
          <div className="meta mb-3">Nach Land · Top-Städte</div>
          <div className="col gap-2">
            {ANALYTICS.geo.map((g) => (
              <div key={g.country}>
                <div className="row between mb-1">
                  <span style={{ fontSize: 12.5 }}>{g.flag} {g.country}</span>
                  <span className="row gap-2">
                    <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{fmt(g.dl)}</span>
                    <span className="meta" style={{ minWidth: 38, textAlign: 'right' }}>{g.pct}%</span>
                  </span>
                </div>
                <div className="progress" style={{ height: 3, marginBottom: g.city !== '—' ? 2 : 6 }}>
                  <div className="progress-bar" style={{ width: g.pct + '%' }} />
                </div>
                {g.city !== '—' && <div className="meta" style={{ fontSize: 10.5, marginBottom: 6 }}>{g.city}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Apps + Devices + OS */}
      <div className="grid grid-3 gap-4">
        <div className="card card-pad">
          <div className="h3 mb-3">Listening-Apps</div>
          <div className="col gap-3">
            {ANALYTICS.apps.map((a) => (
              <div key={a.name}>
                <div className="row between mb-1" style={{ fontSize: 12.5 }}>
                  <span>{a.name}</span>
                  <span className="mono" style={{ fontWeight: 600 }}>{a.pct}%</span>
                </div>
                <div className="progress" style={{ height: 5 }}>
                  <div style={{ width: a.pct + '%', height: '100%', background: a.color, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-pad">
          <div className="h3 mb-3">Gerät</div>
          <div className="col gap-3">
            {ANALYTICS.devices.map((d) => (
              <div key={d.name}>
                <div className="row between mb-1" style={{ fontSize: 12.5 }}>
                  <span>{d.name}</span>
                  <span className="mono" style={{ fontWeight: 600 }}>{d.pct}%</span>
                </div>
                <div className="progress" style={{ height: 5 }}>
                  <div className="progress-bar" style={{ width: d.pct + '%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-pad">
          <div className="h3 mb-3">Betriebssystem</div>
          <div className="col gap-3">
            {ANALYTICS.os.map((o) => (
              <div key={o.name}>
                <div className="row between mb-1" style={{ fontSize: 12.5 }}>
                  <span>{o.name}</span>
                  <span className="mono" style={{ fontWeight: 600 }}>{o.pct}%</span>
                </div>
                <div className="progress" style={{ height: 5 }}>
                  <div className="progress-bar" style={{ width: o.pct + '%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 4 — Transkript · KI-Schaltzentrale
// ═══════════════════════════════════════════════════════════════════════════
function TranskriptKITab({ episodes }) {
  const [selectedEp, setSelectedEp] = useState('');
  const [transcript, setTranscript] = useState('');
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pkg, setPkg] = useState(null);
  const [pkgError, setPkgError] = useState(null);
  const [activeOutput, setActiveOutput] = useState('newsletter');

  const loadTranscript = async () => {
    if (!selectedEp) return;
    setLoadingTranscript(true);
    setTranscript('');
    setPkg(null);
    await new Promise((r) => setTimeout(r, 800));
    const ep = episodes.find((e) => e.id === selectedEp);
    setTranscript(`[MCP: get_transcript · ${ep?.id}]\n\nHost (Fabian Tausch): Herzlich willkommen bei UnicornBakery. Ich bin Fabian Tausch, und heute habe ich ${ep?.guest} zu Gast — einer der faszinierendsten Gründer, die ich in den letzten Jahren getroffen habe.\n\nGast (${ep?.guest}): Danke, Fabian. Es ist eine Ehre, hier zu sein.\n\nHost: Lass uns direkt einsteigen. Dein Weg war alles andere als gradlinig. Magst du uns mitnehmen, wie alles angefangen hat?\n\nGast: Absolut. Ich habe 2019 angefangen, als der Markt gerade anfing, sich zu verändern. Die erste Version unseres Produkts war ehrlich gesagt schrecklich — aber wir haben gehört, was die Kunden wirklich wollten, und das hat alles verändert.\n\nHost: Was war der entscheidende Moment, wo du wusstest: Das funktioniert?\n\nGast: Das war definitiv die erste Enterprise-Referenz. Als ein DAX-Konzern sagte "Wir wollen mehr davon" — da wussten wir, dass wir auf dem richtigen Weg sind.\n\n[... Transkript wird von beehiiv MCP-Server geladen. Dies ist ein Platzhalter für die echte Integration ...]`);
    setLoadingTranscript(false);
  };

  const generatePkg = async () => {
    const ep = episodes.find((e) => e.id === selectedEp);
    if (!ep || !transcript) return;
    setGenerating(true);
    setPkgError(null);
    setPkg(null);
    const result = await generateMarketingPackage({
      episodeTitle: ep.title,
      guest: ep.guest,
      transcript,
    });
    setGenerating(false);
    if (!result.ok) {
      setPkgError(result.error);
    } else {
      setPkg(result.data);
      setActiveOutput('newsletter');
    }
  };

  return (
    <div className="col gap-4">
      {/* Episode selector + load */}
      <div className="card card-pad">
        <div className="row between mb-3">
          <div>
            <div className="h3">Episoden-Transkript</div>
            <div className="meta mt-1">MCP Tool: <code style={{ fontSize: 11 }}>get_transcript</code> · beehiiv Podcast API</div>
          </div>
          <McpTag tool="get_transcript" />
        </div>
        <div className="row gap-3 items-end">
          <div className="col gap-1" style={{ flex: 1 }}>
            <label className="label">Episode auswählen</label>
            <select className="input" value={selectedEp} onChange={(e) => { setSelectedEp(e.target.value); setTranscript(''); setPkg(null); }} style={{ maxWidth: 420 }}>
              <option value="">— Episode wählen —</option>
              {episodes.filter((e) => e.status === 'published').map((ep) => (
                <option key={ep.id} value={ep.id}>Ep. {ep.num ? `${ep.num} · ` : ''}{ep.title}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={loadTranscript} disabled={!selectedEp || loadingTranscript}>
            {loadingTranscript ? 'Lade…' : <><I.download size={13} /> Transkript laden</>}
          </button>
          {transcript && (
            <button
              className="btn btn-brand btn-sm"
              onClick={generatePkg}
              disabled={generating}
              style={{ background: 'linear-gradient(135deg, var(--brand), #7c3aed)', border: 'none' }}
            >
              {generating
                ? <><I.zap size={13} /> Generiere…</>
                : <><I.zap size={13} /> ✨ Marketing-Paket generieren</>}
            </button>
          )}
        </div>

        {transcript && (
          <textarea className="input mt-3" readOnly value={transcript} rows={6}
            style={{ fontSize: 12.5, lineHeight: 1.65, resize: 'vertical', fontFamily: 'inherit', marginTop: 12 }} />
        )}
        {!transcript && !loadingTranscript && (
          <div style={{ marginTop: 12, minHeight: 80, borderRadius: 6, border: '1.5px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)', fontSize: 13 }}>
            {selectedEp ? 'Klicke "Transkript laden"' : 'Wähle eine Episode aus'}
          </div>
        )}
      </div>

      {/* KI Output */}
      {generating && (
        <div className="card card-pad" style={{ background: 'var(--bg-sunk)', textAlign: 'center', padding: '32px 20px' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>✨</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Claude generiert dein Marketing-Paket…</div>
          <div className="meta">Newsletter · LinkedIn-Posts · Show Notes — dauert ca. 5 Sekunden</div>
        </div>
      )}

      {pkgError && (
        <div style={{ padding: '12px 16px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 8, color: 'var(--danger)', fontSize: 13 }}>
          {pkgError}
        </div>
      )}

      {pkg && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg)' }}>
            <div className="row between">
              <div>
                <div className="h3" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  ✨ Marketing-Paket generiert
                </div>
                <div className="meta mt-1">Erstellt von Claude Haiku · beehiiv-kompatibel</div>
              </div>
              <div className="row gap-2">
                <Badge kind="success" dot>Fertig</Badge>
              </div>
            </div>
            {/* Output switcher */}
            <div className="row gap-2 mt-3">
              {[
                { id: 'newsletter', label: '📧 Newsletter' },
                { id: 'linkedin1',  label: '💼 LinkedIn #1' },
                { id: 'linkedin2',  label: '💼 LinkedIn #2' },
                { id: 'linkedin3',  label: '💼 LinkedIn #3' },
                { id: 'shownotes', label: '📝 Show Notes' },
              ].map((o) => (
                <button key={o.id} onClick={() => setActiveOutput(o.id)}
                  className={`btn btn-sm ${activeOutput === o.id ? 'btn-brand' : 'btn-ghost'}`}
                  style={{ fontSize: 12 }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: '16px 18px' }}>
            <textarea
              className="input"
              readOnly
              rows={14}
              value={
                activeOutput === 'newsletter' ? pkg.newsletter :
                activeOutput === 'linkedin1'  ? pkg.linkedin[0] :
                activeOutput === 'linkedin2'  ? pkg.linkedin[1] :
                activeOutput === 'linkedin3'  ? pkg.linkedin[2] :
                pkg.shownotes
              }
              style={{ fontSize: 13, lineHeight: 1.7, resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div className="row gap-2 mt-2" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => {
                const text = activeOutput === 'newsletter' ? pkg.newsletter : activeOutput === 'linkedin1' ? pkg.linkedin[0] : activeOutput === 'linkedin2' ? pkg.linkedin[1] : activeOutput === 'linkedin3' ? pkg.linkedin[2] : pkg.shownotes;
                navigator.clipboard?.writeText(text);
              }}>
                Kopieren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 5 — Distribution / RSS Status Center
// ═══════════════════════════════════════════════════════════════════════════
function DistributionTab() {
  const [spotifySignal, setSpotifySignal] = useState(false);

  return (
    <div className="col gap-4">
      {/* Apple Podcasts */}
      <div className="card card-pad">
        <div className="row between mb-3">
          <div className="row gap-3">
            <span style={{ fontSize: 32 }}>🎵</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Apple Podcasts</div>
              <div className="meta mt-1">RSS-Feed aktiv · 142 Episoden synchronisiert</div>
            </div>
          </div>
          <Badge kind="success" dot large>Aktiv</Badge>
        </div>
        <div className="grid grid-2 gap-3">
          <div>
            <div className="label mb-1">Feed-URL</div>
            <div className="row gap-2 items-center" style={{ background: 'var(--bg)', borderRadius: 6, padding: '7px 10px', border: '1px solid var(--border-soft)' }}>
              <I.rss size={12} color="var(--text-3)" />
              <span className="mono truncate" style={{ fontSize: 11, flex: 1 }}>https://feeds.unicornbakery.de/podcast</span>
            </div>
          </div>
          <div>
            <div className="label mb-1">Letzte Synchronisation</div>
            <div className="row gap-2 items-center" style={{ background: 'var(--bg)', borderRadius: 6, padding: '7px 10px', border: '1px solid var(--border-soft)', fontSize: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--success)', display: 'inline-block' }} />
              vor 12 Minuten · Ep. 142
            </div>
          </div>
        </div>
      </div>

      {/* Spotify — Legal Review mit dynamischem Indikator */}
      <div className="card card-pad" style={{ border: '1px solid var(--warning-border)', background: spotifySignal ? 'var(--success-bg)' : 'var(--warning-bg)' }}>
        <div className="row between mb-3">
          <div className="row gap-3">
            <span style={{ fontSize: 32 }}>🎧</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Spotify</div>
              <div className="meta mt-1">{spotifySignal ? 'Produktionszugriff gewährt' : 'Legal Review · wartet auf manuelles Signal'}</div>
            </div>
          </div>
          {spotifySignal
            ? <Badge kind="success" dot large>Bereit zur Aktivierung</Badge>
            : <Badge kind="warning" dot large>In Prüfung</Badge>}
        </div>

        {/* Timeline */}
        <div className="col gap-0 mb-3">
          {[
            { done: true,  label: 'Spotify for Podcasters Konto erstellt', date: 'Feb 2026' },
            { done: true,  label: 'RSS-Feed eingereicht',                  date: 'März 2026' },
            { done: true,  label: 'Technische Validierung bestanden',      date: 'Apr 2026' },
            { done: false, label: 'Legal Review durch Spotify',            date: 'Läuft…', active: !spotifySignal },
            { done: false, label: 'Produktionszugriff gewährt',            date: 'Ausstehend', signal: true },
            { done: false, label: 'Feed live schalten',                    date: 'Ausstehend' },
          ].map((step, i) => (
            <div key={i} className="row gap-3 items-start" style={{ padding: '8px 0', borderBottom: i < 5 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
              <div style={{ width: 20, height: 20, borderRadius: 999, background: step.done ? 'var(--success)' : step.active ? 'var(--warning)' : 'var(--bg-sunk)', border: `2px solid ${step.done ? 'var(--success)' : step.active ? 'var(--warning)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                {step.done && <span style={{ fontSize: 9, color: 'white' }}>✓</span>}
                {step.active && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--warning)', display: 'inline-block' }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: step.active || step.signal ? 600 : 400 }}>{step.label}</div>
                {step.signal && !spotifySignal && (
                  <div className="meta mt-1" style={{ fontSize: 11 }}>Manuelles Signal erforderlich · Klicke den Button unten</div>
                )}
              </div>
              <span className="meta" style={{ fontSize: 11, flexShrink: 0 }}>{step.date}</span>
            </div>
          ))}
        </div>

        {!spotifySignal ? (
          <div className="col gap-2">
            <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.04)', borderRadius: 6, fontSize: 12.5 }}>
              ⚠️ Sobald Spotify den Produktionszugriff gewährt, klicke den Button unten, um den Feed manuell zu aktivieren.
            </div>
            <button className="btn btn-brand btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setSpotifySignal(true)}>
              ✅ Produktionszugriff gewährt — Feed aktivieren
            </button>
          </div>
        ) : (
          <div style={{ padding: '12px 16px', background: 'var(--success-bg)', borderRadius: 6, border: '1px solid var(--success-border)', fontSize: 13, color: 'var(--success)' }}>
            ✓ Signal empfangen! Spotify-Feed wird in den nächsten 24h live geschalten. RSS-URL wird nach Aktivierung hier angezeigt.
          </div>
        )}
      </div>

      {/* Others */}
      <div className="grid grid-3 gap-3">
        {[
          { icon: '📦', name: 'Amazon Music',    status: 'inactive', note: 'Noch nicht konfiguriert' },
          { icon: '▶️', name: 'YouTube Podcasts', status: 'video',    note: 'Video-Integration · Juli 2026' },
          { icon: '🔊', name: 'Overcast',         status: 'inactive', note: 'Automatisch über Apple RSS' },
        ].map((p) => (
          <div key={p.name} className="card card-pad">
            <div className="row gap-2 mb-2">
              <span style={{ fontSize: 24 }}>{p.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
                <div className="meta">{p.note}</div>
              </div>
            </div>
            <PlatformBadge status={p.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 6 — Private Feeds
// ═══════════════════════════════════════════════════════════════════════════
function PrivateFeedsTab({ episodes }) {
  const [gatedEps, setGatedEps] = useState(new Set(['ep-140']));
  const [showAddSub, setShowAddSub] = useState(false);
  const [newSubEmail, setNewSubEmail] = useState('');

  const toggleGate = (id) => setGatedEps((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="col gap-4">
      <div className="row between">
        <div>
          <div className="h3">Private Podcast Feeds</div>
          <div className="meta mt-1">Episoden hinter einer Subscription-Schranke sperren · Unique Feed-URLs pro Abonnent</div>
        </div>
        <div className="row gap-2">
          <McpTag tool="private_feeds · get_subscribers" />
          <button className="btn btn-brand btn-sm" onClick={() => setShowAddSub(true)}>
            <I.plus size={13} /> Abonnent hinzufügen
          </button>
        </div>
      </div>

      {showAddSub && (
        <div className="card card-pad" style={{ border: '1px solid var(--brand)' }}>
          <div className="h3 mb-3">Neuer Abonnent</div>
          <div className="row gap-2">
            <input className="input" placeholder="name@example.de" value={newSubEmail} onChange={(e) => setNewSubEmail(e.target.value)} style={{ flex: 1, maxWidth: 320 }} />
            <select className="input" style={{ width: 140 }}>
              <option>Pro</option>
              <option>Starter</option>
            </select>
            <button className="btn btn-brand btn-sm" onClick={() => setShowAddSub(false)}>Hinzufügen</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddSub(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      {/* Gating pro Episode */}
      <div className="card">
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
          <div className="h3">Episode Gating</div>
          <div className="meta mt-1">Gesperrte Episoden sind nur für Abonnenten mit gültigem Private Feed zugänglich.</div>
        </div>
        <table className="table">
          <thead><tr><th>#</th><th>Episode</th><th>Status</th><th>Gesperrt</th><th>Abonnenten mit Zugriff</th></tr></thead>
          <tbody>
            {episodes.filter(e => e.status === 'published').map((ep) => (
              <tr key={ep.id}>
                <td className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{ep.num}</td>
                <td style={{ fontWeight: 500, fontSize: 13 }}>{ep.title}</td>
                <td><EpStatusBadge status={ep.status} /></td>
                <td>
                  <label className="row gap-2" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={gatedEps.has(ep.id)} onChange={() => toggleGate(ep.id)} />
                    {gatedEps.has(ep.id)
                      ? <span style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600 }}>🔒 Gesperrt</span>
                      : <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Öffentlich</span>}
                  </label>
                </td>
                <td>
                  {gatedEps.has(ep.id)
                    ? <span className="meta">{PRIVATE_SUBS.filter(s => s.active).length} aktive Abonnenten</span>
                    : <span style={{ fontSize: 12, color: 'var(--text-4)' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Subscriber list mit Feed-URLs */}
      <div className="card">
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }} className="row between">
          <div>
            <div className="h3">Abonnenten · {PRIVATE_SUBS.length}</div>
            <div className="meta mt-1">Unique Feed-URL pro Abonnent</div>
          </div>
        </div>
        <table className="table">
          <thead><tr><th>Name</th><th>E-Mail</th><th>Plan</th><th>Private Feed-URL</th><th>Status</th></tr></thead>
          <tbody>
            {PRIVATE_SUBS.map((s) => (
              <tr key={s.id}>
                <td style={{ fontWeight: 500, fontSize: 13 }}>{s.name}</td>
                <td className="meta">{s.email}</td>
                <td><Badge kind={s.plan === 'Pro' ? 'brand' : 'ghost'}>{s.plan}</Badge></td>
                <td>
                  <div className="row gap-2 items-center">
                    <code style={{ fontSize: 10.5, color: 'var(--text-3)', flex: 1 }}>{s.feedUrl}</code>
                    <button className="btn btn-quiet btn-sm" style={{ flexShrink: 0 }} onClick={() => navigator.clipboard?.writeText(s.feedUrl)} title="URL kopieren">
                      <I.link size={11} />
                    </button>
                  </div>
                </td>
                <td>
                  {s.active
                    ? <span style={{ fontSize: 12, color: 'var(--success)' }}>● Aktiv</span>
                    : <span style={{ fontSize: 12, color: 'var(--text-4)' }}>Inaktiv</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 7 — Migration Wizard
// ═══════════════════════════════════════════════════════════════════════════
function MigrationTab() {
  const [rssUrl, setRssUrl] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | preview | running | done
  const [runningStep, setRunningStep] = useState(0);
  const [steps, setSteps] = useState(PIPELINE_STEPS);

  const startPreview = () => { if (rssUrl.trim()) setPhase('preview'); };

  const startMigration = async () => {
    setPhase('running');
    setRunningStep(0);
    const newSteps = PIPELINE_STEPS.map((s) => ({ ...s, status: 'pending' }));
    setSteps(newSteps);

    for (let i = 0; i < PIPELINE_STEPS.length; i++) {
      await new Promise((r) => setTimeout(r, i === 3 ? 2000 : 700));
      setRunningStep(i);
      setSteps((prev) => prev.map((s, idx) => ({
        ...s,
        status: idx < i ? 'done' : idx === i ? 'running' : 'pending',
      })));
    }
    await new Promise((r) => setTimeout(r, 800));
    setSteps(PIPELINE_STEPS.map((s) => ({ ...s, status: 'done' })));
    setPhase('done');
  };

  const doneCount = steps.filter((s) => s.status === 'done').length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="col gap-4">
      <div className="card card-pad">
        <div className="row between mb-3">
          <div>
            <div className="h3">Durable Import Pipeline</div>
            <div className="meta mt-1">Vollständige Migration inkl. Metadaten · Audio · Artwork · Statistiken</div>
          </div>
          <McpTag tool="migrate_feed" />
        </div>

        {/* RSS Input */}
        {phase === 'idle' && (
          <div className="col gap-3">
            <div className="col gap-1">
              <label className="label">Quell-RSS-Feed</label>
              <div className="row gap-2">
                <div className="row gap-2 items-center" style={{ flex: 1, maxWidth: 480, border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px', background: 'var(--bg-elev)' }}>
                  <I.rss size={14} color="var(--text-4)" />
                  <input className="input" style={{ border: 'none', flex: 1 }} placeholder="https://feeds.example.com/podcast.xml"
                    value={rssUrl} onChange={(e) => setRssUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && startPreview()} />
                </div>
                <button className="btn btn-ghost btn-sm" onClick={startPreview} disabled={!rssUrl.trim()}>Vorschau →</button>
              </div>
              <div className="meta">Unterstützt: RSS 2.0, Atom · Apple, Spotify, Podbean, Buzzsprout, Anchor, Simplecast</div>
            </div>
          </div>
        )}

        {/* Preview */}
        {(phase === 'preview' || phase === 'running' || phase === 'done') && (
          <div className="col gap-4">
            {phase === 'preview' && (
              <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div className="row between">
                  <div style={{ fontWeight: 600, fontSize: 14 }}>UnicornBakery Podcast</div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setPhase('idle')}>Ändern</button>
                </div>
                <div className="meta mt-1">Gründer-Interviews aus dem DACH-Raum</div>
                <div className="row gap-2 mt-3">
                  <span className="badge ghost">142 Episoden</span>
                  <span className="badge ghost">RSS 2.0</span>
                  <span className="badge ghost">6 Mo. Statistik</span>
                  <span className="badge ghost">Artwork vorhanden</span>
                </div>
              </div>
            )}

            {/* Pipeline */}
            <div>
              {(phase === 'running' || phase === 'done') && (
                <div className="mb-3">
                  <div className="row between mb-2">
                    <span className="label">Gesamtfortschritt</span>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{pct}%</span>
                  </div>
                  <div className="progress" style={{ height: 8 }}>
                    <div className="progress-bar" style={{ width: pct + '%', transition: 'width 0.5s' }} />
                  </div>
                </div>
              )}

              <div className="col gap-0">
                {steps.map((step, i) => (
                  <div key={step.id} className="row gap-3 items-start" style={{ padding: '10px 0', borderBottom: i < steps.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                    <div style={{ width: 24, height: 24, borderRadius: 999, flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: step.status === 'done' ? 'var(--success)' : step.status === 'running' ? 'var(--warning)' : 'var(--bg-sunk)',
                      border: `2px solid ${step.status === 'done' ? 'var(--success)' : step.status === 'running' ? 'var(--warning)' : 'var(--border)'}` }}>
                      {step.status === 'done'    && <span style={{ fontSize: 10, color: 'white' }}>✓</span>}
                      {step.status === 'running' && <span style={{ width: 8, height: 8, borderRadius: 999, background: 'white', display: 'inline-block' }} />}
                      {step.status === 'pending' && <span style={{ fontSize: 10, color: 'var(--text-4)' }}>{i + 1}</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: step.status === 'running' ? 600 : 400 }}>{step.label}</div>
                      <div className="meta" style={{ fontSize: 11.5 }}>{step.detail}</div>
                    </div>
                    <span style={{ fontSize: 11, color: step.status === 'done' ? 'var(--success)' : step.status === 'running' ? 'var(--warning)' : 'var(--text-4)' }}>
                      {step.status === 'done' ? 'Fertig' : step.status === 'running' ? 'Läuft…' : 'Ausstehend'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {phase === 'preview' && (
              <button className="btn btn-brand" onClick={startMigration} style={{ alignSelf: 'flex-start' }}>
                Migration starten →
              </button>
            )}

            {phase === 'done' && (
              <div style={{ padding: '14px 16px', background: 'var(--success-bg)', borderRadius: 8, border: '1px solid var(--success-border)', color: 'var(--success)', fontSize: 13 }}>
                ✓ Migration abgeschlossen — 142 Episoden erfolgreich importiert. 0 Duplikate gefunden.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 8 — Studio (Write Tools + Dynamic Pages)
// ═══════════════════════════════════════════════════════════════════════════
const CHECKLIST_ITEMS = [
  { id: 'topic',     label: 'Thema & Gast bestätigt' },
  { id: 'prep',      label: 'Fragen & Outline vorbereitet' },
  { id: 'record',    label: 'Aufnahme durchgeführt' },
  { id: 'edit',      label: 'Schnitt & Mastering fertig' },
  { id: 'thumbnail', label: 'Thumbnail erstellt' },
  { id: 'shownotes', label: 'Show Notes geschrieben' },
  { id: 'upload',    label: 'Episode hochgeladen' },
  { id: 'schedule',  label: 'Veröffentlichung geplant' },
];

function generateLinkedIn(ep) {
  const num  = ep.num != null ? `Ep. ${ep.num}: ` : '';
  const guest = ep.guest ? `\n\nIm Gespräch mit ${ep.guest}.` : '';
  const desc  = ep.description ? `\n\n${ep.description}` : '';
  return `🎙️ Neue Episode: "${num}${ep.title}"${guest}${desc}\n\n📅 Jetzt anhören auf Apple Podcasts, Spotify und überall wo es Podcasts gibt.\n\n#UnicornBakery #Podcast #Entrepreneurship #Startup`;
}

function generateTwitter(ep) {
  const num  = ep.num != null ? `Ep. ${ep.num} · ` : '';
  const guest = ep.guest ? ` mit ${ep.guest}` : '';
  return `🎙️ Neue Episode!\n\n${num}"${ep.title}"${guest}\n\nJetzt reinhören 👇\n#UnicornBakery #Podcast`;
}

function generateNewsletter(ep) {
  const num   = ep.num != null ? `Folge ${ep.num}: ` : '';
  const guest = ep.guest ? `\n\nIn dieser Folge spreche ich mit **${ep.guest}**` : '';
  const desc  = ep.description ? `\n\n${ep.description}` : '';
  return `Hey,\n\neine neue Episode von UnicornBakery ist online!\n\n**${num}${ep.title}**${guest}${desc}\n\n→ [Jetzt anhören](https://unicornbakery.de/podcast)\n\nViel Spaß beim Hören,\nFabian`;
}

function generateEmbed(ep) {
  const num   = ep.num != null ? `Ep. ${ep.num} · ` : '';
  const guest = ep.guest ? ` · ${ep.guest}` : '';
  const dur   = ep.duration && ep.duration !== '—' ? ` · ${ep.duration}` : '';
  return `<!-- UnicornBakery Podcast Embed -->
<div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:16px 18px;max-width:480px;font-family:-apple-system,system-ui,sans-serif">
  <div style="display:flex;gap:12px;align-items:center">
    <div style="width:52px;height:52px;border-radius:8px;background:linear-gradient(135deg,#1a1d24,#3b4a6b);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:22px">🎙️</div>
    <div>
      <div style="font-weight:700;font-size:14px;color:#111;line-height:1.3">${ep.title}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:2px">${num}UnicornBakery${guest}${dur}</div>
    </div>
  </div>${ep.description ? `\n  <p style="font-size:13px;color:#374151;margin:12px 0 0;line-height:1.5">${ep.description.slice(0, 120)}${ep.description.length > 120 ? '…' : ''}</p>` : ''}
  <a href="https://unicornbakery.de/podcast" style="display:inline-block;margin-top:12px;background:#1a1d24;color:white;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:500">Jetzt anhören →</a>
</div>`;
}

function CopyButton({ text, label = 'Kopieren' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button className="btn btn-ghost btn-sm" onClick={copy} style={{ flexShrink: 0 }}>
      {copied ? <><I.check size={12} /> Kopiert!</> : <><I.paperclip size={12} /> {label}</>}
    </button>
  );
}

function StudioTab({ episodes, workspaceId }) {
  const [selectedId, setSelectedId] = useState(episodes[0]?.id ?? '');
  const ep = episodes.find(e => e.id === selectedId) ?? episodes[0] ?? null;

  // ── Show Notes ────────────────────────────────────────────────────────────
  const [notesDraft, setNotesDraft]   = useState(ep?.description ?? '');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved,  setNotesSaved]  = useState(false);

  useEffect(() => { setNotesDraft(ep?.description ?? ''); }, [ep?.id]);

  const saveNotes = async () => {
    if (!ep) return;
    setNotesSaving(true);
    await updateEpisode({ episodeId: ep.id, workspaceId, patch: { description: notesDraft } });
    setNotesSaving(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  // ── Social share ──────────────────────────────────────────────────────────
  const [shareFormat, setShareFormat] = useState('linkedin');
  const shareText = ep
    ? shareFormat === 'linkedin'   ? generateLinkedIn(ep)
    : shareFormat === 'twitter'    ? generateTwitter(ep)
    : generateNewsletter(ep)
    : '';

  // ── Checklist ────────────────────────────────────────────────────────────
  const checkKey = ep ? `cc.studio.checklist.${ep.id}` : null;
  const [checked, setChecked] = useState(() => {
    if (!ep) return new Set();
    try { return new Set(JSON.parse(localStorage.getItem(`cc.studio.checklist.${ep.id}`) ?? '[]')); }
    catch { return new Set(); }
  });

  useEffect(() => {
    if (!ep) return;
    try { setChecked(new Set(JSON.parse(localStorage.getItem(`cc.studio.checklist.${ep.id}`) ?? '[]'))); }
    catch { setChecked(new Set()); }
  }, [ep?.id]);

  const toggleCheck = (id) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      if (checkKey) localStorage.setItem(checkKey, JSON.stringify([...next]));
      return next;
    });
  };

  const doneCount = CHECKLIST_ITEMS.filter(i => checked.has(i.id)).length;

  if (!ep) return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>
      Keine Episoden vorhanden. Erstelle zuerst eine Episode im Tab "Episoden".
    </div>
  );

  return (
    <div className="col gap-5">
      {/* Episode selector */}
      <div className="card card-pad" style={{ padding: '14px 18px' }}>
        <div className="row gap-3 items-center">
          <I.mic size={15} color="var(--brand)" />
          <span style={{ fontWeight: 600, fontSize: 13.5 }}>Episode auswählen</span>
          <select
            className="input"
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            style={{ maxWidth: 400, height: 32, fontSize: 13 }}
          >
            {episodes.map(e => (
              <option key={e.id} value={e.id}>
                {e.num != null ? `Ep. ${e.num} — ` : ''}{e.title}{e.guest ? ` (${e.guest})` : ''}
              </option>
            ))}
          </select>
          <span className="meta">{ep.status} {ep.date ? `· ${ep.date}` : ''}</span>
        </div>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* ── Show Notes ──────────────────────────────────────────────── */}
        <div className="card card-pad col gap-3">
          <div className="row between">
            <div>
              <div className="h3">✍️ Show Notes</div>
              <div className="meta mt-1">Wird in der Episoden-Beschreibung gespeichert</div>
            </div>
            <div className="row gap-2">
              {notesDraft !== (ep.description ?? '') && (
                <button className="btn btn-quiet btn-sm" onClick={() => setNotesDraft(ep.description ?? '')}>
                  Verwerfen
                </button>
              )}
              <button
                className="btn btn-brand btn-sm"
                onClick={saveNotes}
                disabled={notesSaving || notesDraft === (ep.description ?? '')}
              >
                {notesSaved ? <><I.check size={12} /> Gespeichert</> : notesSaving ? '…' : 'Speichern'}
              </button>
            </div>
          </div>
          <textarea
            className="input"
            value={notesDraft}
            onChange={e => setNotesDraft(e.target.value)}
            placeholder="Schreibe hier die Show Notes für diese Episode…&#10;&#10;Was wird besprochen? Welche Links werden erwähnt? Timestamps?"
            rows={10}
            style={{ resize: 'vertical', fontSize: 13.5, lineHeight: 1.6, padding: '10px 12px', height: 'auto' }}
          />
          <div className="row between">
            <span className="meta">{notesDraft.length} Zeichen</span>
            <CopyButton text={notesDraft} label="Kopieren" />
          </div>
        </div>

        {/* ── Produktions-Checkliste ───────────────────────────────────── */}
        <div className="card card-pad col gap-3">
          <div className="row between">
            <div>
              <div className="h3">✅ Produktions-Checkliste</div>
              <div className="meta mt-1">{doneCount} / {CHECKLIST_ITEMS.length} erledigt</div>
            </div>
            {doneCount === CHECKLIST_ITEMS.length && (
              <Badge kind="success" dot>Fertig</Badge>
            )}
          </div>

          {/* Progress */}
          <div style={{ background: 'var(--bg-sunk)', borderRadius: 999, height: 4, overflow: 'hidden' }}>
            <div style={{
              width: `${(doneCount / CHECKLIST_ITEMS.length) * 100}%`,
              height: '100%',
              background: doneCount === CHECKLIST_ITEMS.length ? 'var(--success)' : 'var(--brand)',
              borderRadius: 999,
              transition: 'width 0.3s ease',
            }} />
          </div>

          <div className="col gap-1">
            {CHECKLIST_ITEMS.map(item => (
              <label
                key={item.id}
                className="row gap-3"
                style={{
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  background: checked.has(item.id) ? 'var(--success-bg)' : 'var(--bg-sunk)',
                  transition: 'background 0.12s',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked.has(item.id)}
                  onChange={() => toggleCheck(item.id)}
                  style={{ flexShrink: 0, accentColor: 'var(--brand)', width: 15, height: 15 }}
                />
                <span style={{
                  fontSize: 13.5,
                  color: checked.has(item.id) ? 'var(--success)' : 'var(--text-1)',
                  textDecoration: checked.has(item.id) ? 'line-through' : 'none',
                  transition: 'color 0.12s',
                }}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>

          <button
            className="btn btn-quiet btn-sm"
            style={{ alignSelf: 'flex-start', color: 'var(--text-4)', fontSize: 11.5 }}
            onClick={() => {
              setChecked(new Set());
              if (checkKey) localStorage.removeItem(checkKey);
            }}
          >
            Zurücksetzen
          </button>
        </div>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* ── Social Share ────────────────────────────────────────────── */}
        <div className="card card-pad col gap-3">
          <div>
            <div className="h3">📣 Social Share</div>
            <div className="meta mt-1">Fertige Texte für LinkedIn, Twitter und Newsletter</div>
          </div>

          <div className="row gap-2">
            {[
              { id: 'linkedin',   label: 'LinkedIn',   icon: '💼' },
              { id: 'twitter',    label: 'Twitter / X', icon: '🐦' },
              { id: 'newsletter', label: 'Newsletter',  icon: '📧' },
            ].map(f => (
              <button
                key={f.id}
                className={`btn btn-sm ${shareFormat === f.id ? 'btn-brand' : 'btn-ghost'}`}
                onClick={() => setShareFormat(f.id)}
              >
                {f.icon} {f.label}
              </button>
            ))}
          </div>

          <textarea
            readOnly
            value={shareText}
            rows={9}
            style={{
              width: '100%', fontSize: 13, lineHeight: 1.6,
              border: '1px solid var(--border)', borderRadius: 8,
              padding: '10px 12px', background: 'var(--bg-sunk)',
              color: 'var(--text-1)', resize: 'none', outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <CopyButton text={shareText} label="Text kopieren" />
        </div>

        {/* ── Embed Generator ─────────────────────────────────────────── */}
        <div className="card card-pad col gap-3">
          <div>
            <div className="h3">🔗 Embed Generator</div>
            <div className="meta mt-1">Copy-paste HTML für Newsletter, Website und beehiiv</div>
          </div>

          {/* Live Preview */}
          <div style={{ background: 'white', borderRadius: 12, padding: '16px 18px', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="row gap-3 items-center">
              <div style={{ width: 52, height: 52, borderRadius: 8, background: 'linear-gradient(135deg,#1a1d24,#3b4a6b)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22 }}>🎙️</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#111', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.title}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {ep.num != null ? `Ep. ${ep.num} · ` : ''}UnicornBakery{ep.guest ? ` · ${ep.guest}` : ''}{ep.duration && ep.duration !== '—' ? ` · ${ep.duration}` : ''}
                </div>
              </div>
            </div>
            {ep.description && (
              <p style={{ fontSize: 12.5, color: '#374151', margin: '10px 0 0', lineHeight: 1.5 }}>
                {ep.description.slice(0, 100)}{ep.description.length > 100 ? '…' : ''}
              </p>
            )}
            <a style={{ display: 'inline-block', marginTop: 12, background: '#1a1d24', color: 'white', textDecoration: 'none', padding: '7px 14px', borderRadius: 6, fontSize: 12.5, fontWeight: 500 }}>
              Jetzt anhören →
            </a>
          </div>

          {/* Code */}
          <textarea
            readOnly
            value={generateEmbed(ep)}
            rows={6}
            style={{
              width: '100%', fontSize: 11, lineHeight: 1.5,
              border: '1px solid var(--border)', borderRadius: 8,
              padding: '10px 12px', background: '#0e1014',
              color: '#a6abb6', resize: 'none', outline: 'none',
              fontFamily: 'var(--font-mono)',
            }}
          />
          <CopyButton text={generateEmbed(ep)} label="HTML kopieren" />
        </div>
      </div>
    </div>
  );
}

function StudioCard({ icon, title, desc, tools, eta, badge }) {
  return (
    <div className="card card-pad" style={{ opacity: 0.85 }}>
      <div className="row between mb-2">
        <span style={{ fontSize: 28 }}>{icon}</span>
        <div className="row gap-1">
          {badge && <Badge kind="ghost" style={{ fontSize: 10 }}>{badge}</Badge>}
          <span style={{ fontSize: 11, color: 'var(--text-4)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>{eta}</span>
        </div>
      </div>
      <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>{title}</div>
      <div className="meta" style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: 10 }}>{desc}</div>
      <div className="row gap-1 flex-wrap">
        {tools.map((t) => <code key={t} style={{ fontSize: 10, background: 'var(--bg-sunk)', borderRadius: 3, padding: '1px 5px', color: 'var(--text-3)' }}>{t}</code>)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared helpers
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// Tab — Gäste-CRM
// ═══════════════════════════════════════════════════════════════════════════

const GUEST_STATUSES = ['prospect','contacted','confirmed','recorded','published','recurring'];
const GUEST_STATUS_LABEL = { prospect:'Prospect', contacted:'Kontaktiert', confirmed:'Bestätigt', recorded:'Aufgenommen', published:'Veröffentlicht', recurring:'Stammgast' };
const GUEST_STATUS_COLOR = { prospect:'var(--text-3)', contacted:'var(--info)', confirmed:'var(--success)', recorded:'var(--brand)', published:'var(--success)', recurring:'#712edd' };

function GuestCRMTab({ workspaceId }) {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [draft, setDraft] = useState({ name:'', email:'', company:'', role:'', status:'prospect', notes:'' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    listGuests(workspaceId).then((d) => { setGuests(d); setLoading(false); });
  }, [workspaceId]);

  const onAdd = async () => {
    if (!draft.name.trim()) return;
    setPending('add');
    const r = await createGuest({ workspaceId, ...draft, name: draft.name.trim() });
    setPending(null);
    if (r.ok && r.data) { setGuests((g) => [r.data, ...g]); setDraft({ name:'', email:'', company:'', role:'', status:'prospect', notes:'' }); setAdding(false); }
  };

  const onStatusChange = async (guest, status) => {
    const r = await updateGuest({ workspaceId, guestId: guest.id, patch: { status } });
    if (r.ok && r.data) setGuests((g) => g.map((x) => x.id === guest.id ? r.data : x));
  };

  const onDelete = async (id) => {
    setPending(id);
    const r = await deleteGuest({ workspaceId, guestId: id });
    setPending(null);
    if (r.ok) setGuests((g) => g.filter((x) => x.id !== id));
  };

  const filtered = guests.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    (g.company ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const counts = GUEST_STATUSES.reduce((acc, s) => ({ ...acc, [s]: guests.filter(g => g.status === s).length }), {});

  if (loading) return <div style={{ padding: 24, color: 'var(--text-3)', fontSize: 13 }}>Wird geladen…</div>;

  return (
    <div className="col gap-4">
      {/* Stats row */}
      <div className="row gap-3 wrap">
        {GUEST_STATUSES.filter(s => counts[s] > 0).map(s => (
          <div key={s} className="card card-pad" style={{ flex: '1 1 120px', minWidth: 100 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: GUEST_STATUS_COLOR[s] }}>{counts[s]}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{GUEST_STATUS_LABEL[s]}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="row gap-3 items-center">
        <input className="input" placeholder="Gast suchen…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
        <span className="meta">{filtered.length} Gäste</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-brand btn-sm" onClick={() => setAdding(true)}><I.plus size={13} /> Gast hinzufügen</button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="card card-pad col gap-3" style={{ border: '1px solid var(--brand)' }}>
          <div className="h3">Neuer Gast</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <input className="input" placeholder="Name *" value={draft.name} onChange={(e) => setDraft({...draft, name: e.target.value})} autoFocus style={{ fontSize: 13 }} />
            <input className="input" placeholder="Email" value={draft.email} onChange={(e) => setDraft({...draft, email: e.target.value})} style={{ fontSize: 13 }} />
            <input className="input" placeholder="Unternehmen" value={draft.company} onChange={(e) => setDraft({...draft, company: e.target.value})} style={{ fontSize: 13 }} />
            <input className="input" placeholder="Rolle / Titel" value={draft.role} onChange={(e) => setDraft({...draft, role: e.target.value})} style={{ fontSize: 13 }} />
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: '160px 1fr' }}>
            <select className="input" value={draft.status} onChange={(e) => setDraft({...draft, status: e.target.value})} style={{ fontSize: 13 }}>
              {GUEST_STATUSES.map(s => <option key={s} value={s}>{GUEST_STATUS_LABEL[s]}</option>)}
            </select>
            <input className="input" placeholder="Notizen" value={draft.notes} onChange={(e) => setDraft({...draft, notes: e.target.value})} style={{ fontSize: 13 }} />
          </div>
          <div className="row gap-2">
            <button className="btn btn-brand btn-sm" onClick={onAdd} disabled={!draft.name.trim() || pending === 'add'}>{pending === 'add' ? '…' : 'Hinzufügen'}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      {filtered.length === 0 && !adding && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)', fontSize: 13 }}>
          {guests.length === 0 ? 'Noch keine Gäste. Füge deinen ersten potenziellen Podcast-Gast hinzu.' : 'Keine Treffer.'}
        </div>
      )}

      {/* Guest list */}
      <div className="col gap-2">
        {filtered.map((g) => (
          <div key={g.id} className="card" style={{ overflow: 'hidden' }}>
            <div className="row between items-center" style={{ padding: '12px 14px', cursor: 'pointer' }}
              onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}>
              <div className="row gap-3 items-center">
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--brand-soft)', color: 'var(--brand)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14,
                }}>
                  {g.name.split(' ').map(n => n[0]).slice(0,2).join('')}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{g.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {[g.role, g.company].filter(Boolean).join(' · ')}
                    {g.episodeCount > 0 && <span style={{ marginLeft: 8, color: 'var(--brand)' }}>🎙 {g.episodeCount} Ep.</span>}
                  </div>
                </div>
              </div>
              <div className="row gap-2 items-center">
                <select
                  className="input"
                  value={g.status}
                  onChange={(e) => { e.stopPropagation(); onStatusChange(g, e.target.value); }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ height: 26, fontSize: 12, padding: '0 6px', width: 130, color: GUEST_STATUS_COLOR[g.status] }}
                >
                  {GUEST_STATUSES.map(s => <option key={s} value={s}>{GUEST_STATUS_LABEL[s]}</option>)}
                </select>
                <I.chevronDown size={13} style={{ color: 'var(--text-3)', transform: expandedId === g.id ? 'rotate(180deg)' : '', transition: '0.15s' }} />
              </div>
            </div>
            {expandedId === g.id && (
              <div style={{ borderTop: '1px solid var(--border-soft)', padding: '12px 14px' }}>
                <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  {g.email && <div><div className="label mb-1">Email</div><a href={`mailto:${g.email}`} style={{ fontSize: 13, color: 'var(--brand)' }}>{g.email}</a></div>}
                  {g.linkedinUrl && <div><div className="label mb-1">LinkedIn</div><a href={g.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--brand)' }}>Profil öffnen →</a></div>}
                </div>
                {g.notes && <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>{g.notes}</div>}
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', fontSize: 12 }}
                  onClick={() => onDelete(g.id)} disabled={pending === g.id}>
                  <I.x size={11} /> Entfernen
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab — Publishing Dashboard
// ═══════════════════════════════════════════════════════════════════════════

const PLATFORMS = [
  { id: 'apple',     label: 'Apple',    icon: '🎵' },
  { id: 'spotify',   label: 'Spotify',  icon: '💚' },
  { id: 'youtube',   label: 'YouTube',  icon: '▶️'  },
  { id: 'linkedin',  label: 'LinkedIn', icon: '💼' },
  { id: 'instagram', label: 'Insta',    icon: '📸' },
  { id: 'newsletter',label: 'Newsletter',icon:'📧' },
];

const PUB_STATUS_COLOR = { done: 'var(--success)', pending: 'var(--warning)', skip: 'var(--text-4)' };

function PublishingDashboardTab({ episodes, workspaceId, onOpenEpisode }) {
  const { updateEpisodeInCache } = useWorkspace();
  const [pending, setPending] = useState(null);

  const recent = episodes
    .filter(e => e.status !== 'idea')
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 20);

  const togglePlatform = async (ep, platformId) => {
    const key = `${ep.id}-${platformId}`;
    setPending(key);
    const platforms = ep.episodeMeta?.platforms ?? {};
    const current = platforms[platformId] ?? 'pending';
    const next = current === 'done' ? 'pending' : current === 'pending' ? 'skip' : 'done';
    const newMeta = { ...(ep.episodeMeta ?? {}), platforms: { ...platforms, [platformId]: next } };
    const r = await updateEpisode({ episodeId: ep.id, workspaceId, patch: { episodeMeta: newMeta } });
    setPending(null);
    if (r.ok) updateEpisodeInCache(ep.id, { episodeMeta: newMeta });
  };

  return (
    <div className="col gap-3">
      <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
        Klicke auf einen Plattform-Punkt um den Status zu wechseln: ● Ausstehend → ✓ Erledigt → ✗ Überspringen
      </div>
      <div className="card" style={{ overflow: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ minWidth: 220 }}>Episode</th>
              <th>Status</th>
              {PLATFORMS.map(p => <th key={p.id} style={{ textAlign: 'center', minWidth: 70 }}>{p.icon} {p.label}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recent.map((ep) => {
              const platforms = ep.episodeMeta?.platforms ?? {};
              return (
                <tr key={ep.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{ep.num ? `Ep. ${ep.num} · ` : ''}{ep.title}</div>
                    {ep.date && <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{ep.date}</div>}
                  </td>
                  <td><EpStatusBadge status={ep.status} /></td>
                  {PLATFORMS.map(p => {
                    const s = platforms[p.id] ?? 'pending';
                    const key = `${ep.id}-${p.id}`;
                    return (
                      <td key={p.id} style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => togglePlatform(ep, p.id)}
                          disabled={pending === key}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 16, opacity: pending === key ? 0.4 : 1,
                          }}
                          title={s === 'done' ? 'Erledigt' : s === 'skip' ? 'Übersprungen' : 'Ausstehend'}
                        >
                          {s === 'done' ? '✅' : s === 'skip' ? '⬜' : '⏳'}
                        </button>
                      </td>
                    );
                  })}
                  <td>
                    <button className="btn btn-quiet btn-sm" onClick={() => onOpenEpisode?.(ep.id)} style={{ fontSize: 12 }}>
                      Detail →
                    </button>
                  </td>
                </tr>
              );
            })}
            {recent.length === 0 && (
              <tr><td colSpan={PLATFORMS.length + 3} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Noch keine Episoden.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab — Newsletter
// ═══════════════════════════════════════════════════════════════════════════

const NL_STATUS = {
  idea:      { label:'Idee',       color:'var(--text-3)',  icon:'💡' },
  draft:     { label:'Entwurf',    color:'var(--info)',    icon:'✏️' },
  review:    { label:'Review',     color:'var(--warning)', icon:'👀' },
  scheduled: { label:'Geplant',    color:'var(--brand)',   icon:'📅' },
  sent:      { label:'Versendet',  color:'var(--success)', icon:'✅' },
};

function NewsletterTab({ workspaceId }) {
  const [issues, setIssues]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [pending, setPending] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [draft, setDraft] = useState({ subject:'', issueNumber:'', audience:'', sendDate:'', description:'' });

  useEffect(() => {
    listNewsletterIssues(workspaceId).then(d => { setIssues(d); setLoading(false); });
  }, [workspaceId]);

  const onAdd = async (e) => {
    e.preventDefault();
    if (!draft.subject.trim()) return;
    setPending('add');
    const r = await createNewsletterIssue({
      workspaceId, subject:draft.subject.trim(),
      issueNumber: draft.issueNumber ? parseInt(draft.issueNumber) : undefined,
      audience: draft.audience || undefined,
      sendDate: draft.sendDate || undefined,
      description: draft.description || undefined,
    });
    setPending(null);
    if (r.ok && r.data) {
      setIssues(p => [r.data, ...p]);
      setDraft({ subject:'', issueNumber:'', audience:'', sendDate:'', description:'' });
      setAdding(false);
    }
  };

  const onStatus = async (issue, status) => {
    const r = await updateNewsletterIssue({ workspaceId, issueId: issue.id, patch: { status } });
    if (r.ok && r.data) setIssues(p => p.map(i => i.id === issue.id ? r.data : i));
  };

  const onDelete = async (id) => {
    setPending(id);
    const r = await deleteNewsletterIssue({ workspaceId, issueId: id });
    setPending(null);
    if (r.ok) setIssues(p => p.filter(i => i.id !== id));
  };

  const counts = Object.keys(NL_STATUS).reduce((acc, s) => ({ ...acc, [s]: issues.filter(i=>i.status===s).length }), {});

  if (loading) return <div style={{padding:24,color:'var(--text-3)',fontSize:13}}>Wird geladen…</div>;

  return (
    <div className="col gap-4">
      {/* Stats */}
      <div className="row gap-3 wrap">
        {Object.entries(NL_STATUS).map(([k,v]) => counts[k] > 0 && (
          <div key={k} className="card card-pad" style={{flex:'1 1 100px'}}>
            <div style={{fontSize:22,fontWeight:700,color:v.color}}>{counts[k]}</div>
            <div style={{fontSize:12,color:'var(--text-2)',marginTop:2}}>{v.icon} {v.label}</div>
          </div>
        ))}
      </div>

      <div className="row between items-center">
        <div className="h3">Newsletter-Ausgaben</div>
        <button className="btn btn-brand btn-sm" onClick={()=>setAdding(true)}><I.plus size={13}/> Neue Ausgabe</button>
      </div>

      {adding && (
        <form onSubmit={onAdd} className="card card-pad col gap-3" style={{border:'1px solid var(--brand)'}}>
          <div className="h3">Neue Ausgabe</div>
          <input className="input" placeholder="Betreff *" value={draft.subject}
            onChange={e=>setDraft({...draft,subject:e.target.value})} autoFocus style={{fontSize:13}}/>
          <div className="grid gap-2" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
            <input className="input" type="number" placeholder="Ausgabe Nr." value={draft.issueNumber}
              onChange={e=>setDraft({...draft,issueNumber:e.target.value})} style={{fontSize:13}}/>
            <input className="input" placeholder="Zielgruppe" value={draft.audience}
              onChange={e=>setDraft({...draft,audience:e.target.value})} style={{fontSize:13}}/>
            <input type="date" className="input" value={draft.sendDate}
              onChange={e=>setDraft({...draft,sendDate:e.target.value})} style={{fontSize:13}}/>
          </div>
          <textarea className="input" rows={2} placeholder="Notizen (optional)" value={draft.description}
            onChange={e=>setDraft({...draft,description:e.target.value})} style={{fontSize:13,resize:'vertical'}}/>
          <div className="row gap-2">
            <button type="submit" className="btn btn-brand btn-sm" disabled={!draft.subject.trim()||pending==='add'}>{pending==='add'?'…':'Anlegen'}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setAdding(false)}>Abbrechen</button>
          </div>
        </form>
      )}

      {issues.length === 0 && !adding && (
        <div style={{textAlign:'center',padding:'40px 0',color:'var(--text-4)',fontSize:13}}>
          <div style={{fontSize:32,marginBottom:8}}>📧</div>
          Noch keine Newsletter-Ausgaben. Erstelle die erste Ausgabe um die Produktion zu tracken.
        </div>
      )}

      <div className="col gap-2">
        {issues.map(issue => {
          const s = NL_STATUS[issue.status] ?? NL_STATUS.idea;
          const expanded = expandedId === issue.id;
          return (
            <div key={issue.id} className="card" style={{overflow:'hidden'}}>
              <div className="row between items-center" style={{padding:'12px 14px',cursor:'pointer'}}
                onClick={()=>setExpandedId(expanded?null:issue.id)}>
                <div className="row gap-3 items-center">
                  <span style={{fontSize:16,flexShrink:0}}>{s.icon}</span>
                  <div>
                    <div style={{fontWeight:600,fontSize:13.5}}>
                      {issue.issueNumber ? `#${issue.issueNumber} · ` : ''}{issue.subject}
                    </div>
                    <div className="row gap-3" style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>
                      {issue.audience && <span>{issue.audience}</span>}
                      {issue.sendDate && <span>📅 {issue.sendDate}</span>}
                      {issue.status==='sent' && issue.openRate && <span style={{color:'var(--success)'}}>📊 {issue.openRate}% Open Rate</span>}
                    </div>
                  </div>
                </div>
                <div className="row gap-2 items-center" onClick={e=>e.stopPropagation()}>
                  <select className="input" value={issue.status}
                    onChange={e=>onStatus(issue,e.target.value)}
                    style={{height:26,fontSize:12,padding:'0 4px',width:120,color:s.color}}>
                    {Object.entries(NL_STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <I.chevronDown size={12} style={{color:'var(--text-3)',transform:expanded?'rotate(180deg)':'',transition:'0.15s'}}/>
                </div>
              </div>
              {expanded && (
                <div style={{borderTop:'1px solid var(--border-soft)',padding:'10px 14px'}} onClick={e=>e.stopPropagation()}>
                  {issue.description && <div style={{fontSize:13,color:'var(--text-2)',marginBottom:10}}>{issue.description}</div>}
                  {issue.status === 'sent' && (
                    <div className="grid gap-3 mb-3" style={{gridTemplateColumns:'1fr 1fr'}}>
                      <div>
                        <div className="label mb-1">Open Rate (%)</div>
                        <input type="number" className="input" step="0.1" placeholder="z.B. 42.5"
                          defaultValue={issue.openRate ?? ''}
                          onBlur={e => updateNewsletterIssue({workspaceId, issueId:issue.id, patch:{openRate:parseFloat(e.target.value)||undefined}}).then(r=>r.ok&&r.data&&setIssues(p=>p.map(i=>i.id===issue.id?r.data:i)))}
                          style={{height:28,fontSize:12.5}}/>
                      </div>
                      <div>
                        <div className="label mb-1">Click Rate (%)</div>
                        <input type="number" className="input" step="0.1" placeholder="z.B. 8.3"
                          defaultValue={issue.clickRate ?? ''}
                          onBlur={e => updateNewsletterIssue({workspaceId, issueId:issue.id, patch:{clickRate:parseFloat(e.target.value)||undefined}}).then(r=>r.ok&&r.data&&setIssues(p=>p.map(i=>i.id===issue.id?r.data:i)))}
                          style={{height:28,fontSize:12.5}}/>
                      </div>
                    </div>
                  )}
                  <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)',fontSize:12}}
                    onClick={()=>onDelete(issue.id)} disabled={pending===issue.id}>
                    <I.x size={11}/> Löschen
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
