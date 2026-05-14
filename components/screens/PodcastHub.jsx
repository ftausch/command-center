'use client';
// Podcast Hub — zentrale Steuerung für Podcast-Inhalte.
//
// 5 Tabs:
//   Episoden   — Show + Episode Listing (bereit für MCP Podcast-Tools)
//   Analytics  — IAB-konforme Statistiken (Downloads, Listeners, Geo)
//   Transkripte— Episoden-Transkripte via MCP-Server
//   Distribution — Plattform-Status (Apple RSS aktiv, Spotify in Prüfung)
//   Migration  — RSS-URL-Import für Full Migration Support
//
// Daten: Platzhalter-Daten, die die echte MCP-Integration vorbereiten.
// Alles mit [MCP] markierte wird durch den Podcast-MCP-Server befüllt.

import { useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Badge } from '@/components/ui';

// ── Mock-Episoden (werden durch MCP tool: list_episodes ersetzt) ──────────
const MOCK_EPISODES = [
  { id: 'ep-142', num: 142, title: 'Wie Fabian Tausch UnicornBakery aufgebaut hat', guest: 'Fabian Tausch', date: '2026-05-14', duration: '58:24', downloads: 4820, status: 'published' },
  { id: 'ep-141', num: 141, title: 'Die Fundraising-Formel — Series A in 90 Tagen', guest: 'Anna Kirmße', date: '2026-05-07', duration: '51:12', downloads: 3940, status: 'published' },
  { id: 'ep-140', num: 140, title: 'B2B SaaS Exit: Was Käufer wirklich wollen', guest: 'Marc Beckmann', date: '2026-04-30', duration: '62:08', downloads: 5210, status: 'published' },
  { id: 'ep-143', num: 143, title: 'Cold Outbound im KI-Zeitalter', guest: 'Lisa Kirsch', date: '2026-05-21', duration: '—', downloads: 0, status: 'scheduled' },
  { id: 'ep-draft', num: 144, title: 'Neue Episode — Titel ausstehend', guest: '—', date: '—', duration: '—', downloads: 0, status: 'draft' },
];

// ── Mock Analytics (werden durch MCP tool: get_analytics ersetzt) ─────────
const ANALYTICS = {
  totalDownloads: 284_620,
  uniqueListeners: 41_330,
  avgPerEpisode: 3_980,
  growth30d: +12.4,
  weeklyDownloads: [2840, 3120, 2980, 3450, 3820, 4100, 3760, 4200, 3940, 4820, 5010, 4650],
  geo: [
    { flag: '🇩🇪', country: 'Deutschland', city: 'Berlin / München / Hamburg', downloads: 118_400, pct: 41.6 },
    { flag: '🇦🇹', country: 'Österreich',  city: 'Wien / Graz',              downloads: 31_200,  pct: 11.0 },
    { flag: '🇨🇭', country: 'Schweiz',     city: 'Zürich / Basel',           downloads: 28_900,  pct: 10.2 },
    { flag: '🇺🇸', country: 'USA',         city: 'New York / SF / Austin',   downloads: 24_600,  pct: 8.6  },
    { flag: '🇬🇧', country: 'Großbritannien', city: 'London',                downloads: 14_100,  pct: 5.0  },
    { flag: '🌍', country: 'Weitere',      city: '—',                         downloads: 67_420,  pct: 23.7 },
  ],
};

// ── Plattform-Status ──────────────────────────────────────────────────────
const PLATFORMS = [
  { id: 'apple',   name: 'Apple Podcasts',   icon: '🎵', status: 'active',   rss: 'https://feeds.unicornbakery.de/podcast', since: 'Nov 2021' },
  { id: 'spotify', name: 'Spotify',          icon: '🎧', status: 'review',   rss: '—', note: 'In Prüfung · Legal Review läuft' },
  { id: 'amazon',  name: 'Amazon Music',     icon: '📦', status: 'inactive', rss: '—', note: 'Noch nicht konfiguriert' },
  { id: 'google',  name: 'Google Podcasts',  icon: '🔍', status: 'inactive', rss: '—', note: 'Eingestellt — Nutzer migrieren zu YouTube Music' },
  { id: 'youtube', name: 'YouTube Podcasts', icon: '▶️', status: 'inactive', rss: '—', note: 'Ausstehend' },
];

function fmt(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }

export function PodcastHubScreen({ setRoute }) {
  const { currentWorkspace: brand } = useWorkspace();
  const [tab, setTab] = useState('episodes');

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2">
            <Badge kind="brand" dot>{brand?.name}</Badge>
            <span style={{ color: 'var(--text-3)', fontSize: 12.5 }}>· Podcast Hub</span>
          </div>
          <h1 className="h1" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <I.mic size={24} /> Podcast Hub
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Zentrale Steuerung für Episoden, Analytics, Transkripte und Distribution.
          </p>
        </div>
        <div className="row gap-2">
          <div className="row gap-1 items-center" style={{ fontSize: 11.5, color: 'var(--text-4)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px' }}>
            <I.rss size={11} color="var(--warning)" /> MCP bereit · 7 Tools verfügbar
          </div>
        </div>
      </div>

      <div className="tabs mb-4">
        {[
          { id: 'episodes',     label: 'Episoden',     icon: <I.mic size={13} /> },
          { id: 'analytics',    label: 'Analytics',    icon: <I.trend size={13} /> },
          { id: 'transcripts',  label: 'Transkripte',  icon: <I.doc size={13} /> },
          { id: 'distribution', label: 'Distribution', icon: <I.radio size={13} /> },
          { id: 'migration',    label: 'Migration',    icon: <I.rss size={13} /> },
        ].map((t) => (
          <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="row gap-1">{t.icon} {t.label}</span>
          </div>
        ))}
      </div>

      {tab === 'episodes'     && <EpisodenTab />}
      {tab === 'analytics'    && <AnalyticsTab />}
      {tab === 'transcripts'  && <TranskripteTab />}
      {tab === 'distribution' && <DistributionTab />}
      {tab === 'migration'    && <MigrationTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 1 — Episoden
// ═══════════════════════════════════════════════════════════════════════════
function EpisodenTab() {
  const [search, setSearch] = useState('');
  const filtered = MOCK_EPISODES.filter((e) =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.guest.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="col gap-4">
      <div className="row gap-3 items-center">
        <input
          className="input"
          placeholder="Episoden suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        <span className="meta">{filtered.length} Episoden</span>
        <div style={{ flex: 1 }} />
        <div className="row gap-1 items-center" style={{ fontSize: 11, color: 'var(--text-4)' }}>
          <I.mic size={11} /> MCP: <code style={{ fontSize: 10 }}>list_episodes</code>
        </div>
        <button className="btn btn-brand btn-sm" disabled title="Neue Episode anlegen (MCP: create_episode)">
          <I.plus size={13} /> Neue Episode
        </button>
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
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ep) => (
              <tr key={ep.id} style={{ cursor: 'pointer' }}>
                <td><span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{ep.num}</span></td>
                <td>
                  <div style={{ fontWeight: 500, fontSize: 13.5 }}>{ep.title}</div>
                </td>
                <td><span style={{ color: 'var(--text-2)', fontSize: 13 }}>{ep.guest}</span></td>
                <td><span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{ep.date}</span></td>
                <td><span className="mono" style={{ fontSize: 12 }}>{ep.duration}</span></td>
                <td>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 13 }}>
                    {ep.downloads > 0 ? fmt(ep.downloads) : '—'}
                  </span>
                </td>
                <td><EpStatusBadge status={ep.status} /></td>
                <td>
                  <button className="btn btn-quiet btn-sm" disabled title="Episode bearbeiten (MCP: update_episode)">
                    <I.more size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <McpHint tools={['list_episodes', 'get_episode', 'create_episode', 'update_episode', 'delete_episode', 'publish_episode', 'get_show']} />
    </div>
  );
}

function EpStatusBadge({ status }) {
  const map = {
    published: { kind: 'success', label: 'Veröffentlicht' },
    scheduled: { kind: 'warning', label: 'Geplant' },
    draft:     { kind: 'ghost',   label: 'Entwurf' },
  };
  const { kind, label } = map[status] ?? { kind: 'ghost', label: status };
  return <Badge kind={kind} dot>{label}</Badge>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 2 — Analytics
// ═══════════════════════════════════════════════════════════════════════════
function AnalyticsTab() {
  const maxWeekly = Math.max(...ANALYTICS.weeklyDownloads);

  return (
    <div className="col gap-4">
      <div className="row gap-1 items-center mb-1" style={{ fontSize: 11, color: 'var(--text-4)' }}>
        <I.trend size={11} /> IAB Compliant · MCP: <code style={{ fontSize: 10 }}>get_analytics</code>
        <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-4)' }}>Letzte 30 Tage</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-4 gap-3">
        <div className="kpi">
          <div className="kpi-label">Gesamt Downloads</div>
          <div className="kpi-value mono">{fmt(ANALYTICS.totalDownloads)}</div>
          <div className="kpi-trend up">IAB-zertifiziert</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Unique Listeners</div>
          <div className="kpi-value mono">{fmt(ANALYTICS.uniqueListeners)}</div>
          <div className="kpi-trend up">Letzte 30 Tage</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Ø Downloads / Ep.</div>
          <div className="kpi-value mono">{fmt(ANALYTICS.avgPerEpisode)}</div>
          <div className="kpi-trend up">Alle Episoden</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Wachstum 30d</div>
          <div className="kpi-value mono">+{ANALYTICS.growth30d}%</div>
          <div className="kpi-trend up">vs. Vormonat</div>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        {/* Downloads Chart */}
        <div className="card card-pad">
          <div className="row between mb-4">
            <div>
              <div className="h3">Downloads · Letzte 12 Wochen</div>
              <div className="meta mt-1">Wöchentliche Summe · IAB Tier 2</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
            {ANALYTICS.weeklyDownloads.map((val, i) => {
              const h = Math.round((val / maxWeekly) * 100);
              const isLast = i === ANALYTICS.weeklyDownloads.length - 1;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div
                    style={{
                      width: '100%',
                      height: h + '%',
                      minHeight: 4,
                      background: isLast ? 'var(--brand)' : 'var(--bg-sunk)',
                      borderRadius: '3px 3px 0 0',
                      border: isLast ? '1px solid var(--brand)' : '1px solid var(--border)',
                      transition: 'height 0.3s',
                    }}
                    title={`KW ${i + 1}: ${val.toLocaleString('de')} Downloads`}
                  />
                  {i % 3 === 0 && (
                    <span style={{ fontSize: 9, color: 'var(--text-4)' }}>KW{i + 1}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Geo Breakdown */}
        <div className="card card-pad">
          <div className="row between mb-3">
            <div>
              <div className="h3" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <I.globe size={14} /> Geo-Breakdown
              </div>
              <div className="meta mt-1">Nach Land · Top-Städte</div>
            </div>
          </div>
          <div className="col gap-1">
            {ANALYTICS.geo.map((g) => (
              <div key={g.country} style={{ padding: '5px 0', borderBottom: '1px solid var(--border-soft)' }}>
                <div className="row between" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{g.flag} {g.country}</span>
                  <span className="row gap-2">
                    <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{fmt(g.downloads)}</span>
                    <span className="meta" style={{ minWidth: 36, textAlign: 'right' }}>{g.pct}%</span>
                  </span>
                </div>
                <div className="progress" style={{ height: 3 }}>
                  <div className="progress-bar" style={{ width: g.pct + '%' }} />
                </div>
                {g.city !== '—' && (
                  <div className="meta" style={{ fontSize: 10.5, marginTop: 2 }}>{g.city}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <McpHint tools={['get_analytics']} note="IAB Tier 2 Compliance · Unique Listener Dedup aktiv" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 3 — Transkripte
// ═══════════════════════════════════════════════════════════════════════════
function TranskripteTab() {
  const [selectedEp, setSelectedEp] = useState('');
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);

  const loadTranscript = async () => {
    if (!selectedEp) return;
    setLoading(true);
    setTranscript('');
    // Simuliert MCP tool: get_transcript
    await new Promise((r) => setTimeout(r, 900));
    const ep = MOCK_EPISODES.find((e) => e.id === selectedEp);
    setTranscript(
      ep?.status === 'published'
        ? `[Transkript für "${ep.title}"]\n\nHost: Herzlich willkommen bei UnicornBakery. Ich bin Fabian Tausch, und heute sprechen wir mit ${ep.guest}.\n\nGast: Vielen Dank für die Einladung, Fabian.\n\nHost: Lass uns direkt einsteigen — wie sah dein erster Tag als Gründer aus?\n\n[…]\n\n⚠️  Dies ist ein Platzhalter-Transkript.\nVerbinde den MCP-Server mit beehiiv, um echte Transkripte zu laden.\nMCP Tool: get_transcript(episode_id: "${ep.id}")`
        : `Kein Transkript verfügbar — Episode hat Status "${ep?.status}".`,
    );
    setLoading(false);
  };

  return (
    <div className="col gap-4">
      <div className="card card-pad">
        <div className="h3 mb-1">Episoden-Transkript</div>
        <div className="meta mb-4">Transkripte werden via MCP-Server von beehiiv abgerufen (Tool: <code>get_transcript</code>).</div>

        <div className="row gap-3 mb-4" style={{ alignItems: 'flex-end' }}>
          <div className="col gap-1" style={{ flex: 1 }}>
            <label className="label">Episode auswählen</label>
            <select
              className="input"
              value={selectedEp}
              onChange={(e) => { setSelectedEp(e.target.value); setTranscript(''); }}
              style={{ maxWidth: 420 }}
            >
              <option value="">— Episode wählen —</option>
              {MOCK_EPISODES.filter((e) => e.status === 'published').map((ep) => (
                <option key={ep.id} value={ep.id}>Ep. {ep.num} · {ep.title}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-brand btn-sm"
            onClick={loadTranscript}
            disabled={!selectedEp || loading}
          >
            {loading ? <><I.mic size={13} /> Lade…</> : <><I.download size={13} /> Transkript laden</>}
          </button>
        </div>

        {!transcript && !loading && (
          <div style={{
            minHeight: 240, borderRadius: 8, border: '1.5px dashed var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-4)', fontSize: 13,
          }}>
            {selectedEp ? 'Klicke "Transkript laden" um den Inhalt abzurufen.' : 'Wähle eine Episode aus.'}
          </div>
        )}

        {loading && (
          <div style={{ minHeight: 240, borderRadius: 8, border: '1px solid var(--border)', padding: 20, color: 'var(--text-3)', fontSize: 13 }}>
            <I.mic size={14} /> MCP Tool wird aufgerufen — get_transcript…
          </div>
        )}

        {transcript && (
          <textarea
            className="input"
            readOnly
            value={transcript}
            rows={14}
            style={{ fontSize: 13, lineHeight: 1.7, resize: 'vertical', fontFamily: 'inherit' }}
          />
        )}
      </div>

      <McpHint tools={['get_transcript']} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 4 — Distribution Status
// ═══════════════════════════════════════════════════════════════════════════
function DistributionTab() {
  return (
    <div className="col gap-4">
      <div className="grid grid-2 gap-3">
        {PLATFORMS.map((p) => (
          <div key={p.id} className="card card-pad">
            <div className="row between mb-3">
              <div className="row gap-3">
                <span style={{ fontSize: 28, lineHeight: 1 }}>{p.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{p.name}</div>
                  {p.since && <div className="meta mt-1">Aktiv seit {p.since}</div>}
                  {p.note && <div className="meta mt-1">{p.note}</div>}
                </div>
              </div>
              <PlatformStatusBadge status={p.status} />
            </div>

            {p.status === 'active' && p.rss && (
              <>
                <div className="label" style={{ marginBottom: 4 }}>RSS Feed</div>
                <div className="row gap-2 items-center" style={{ background: 'var(--bg)', borderRadius: 6, padding: '6px 10px', border: '1px solid var(--border-soft)' }}>
                  <I.rss size={12} color="var(--text-3)" />
                  <span className="mono truncate" style={{ fontSize: 11.5, flex: 1 }}>{p.rss}</span>
                  <button className="btn btn-quiet btn-sm" style={{ fontSize: 11 }}><I.link size={11} /></button>
                </div>
              </>
            )}

            {p.status === 'review' && (
              <div style={{ padding: '10px 12px', background: 'var(--warning-bg)', borderRadius: 6, border: '1px solid var(--warning-border)', fontSize: 12.5, color: 'var(--warning)' }}>
                ⚠️ Spotify führt eine rechtliche Prüfung des Inhalts durch. Keine Aktion erforderlich — wir werden benachrichtigt, sobald die Prüfung abgeschlossen ist.
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card card-pad" style={{ background: 'var(--info-bg)', borderColor: 'var(--info-border)' }}>
        <div className="row gap-2 mb-2">
          <I.radio size={14} color="var(--info)" />
          <span style={{ fontWeight: 600 }}>Distribution-Übersicht</span>
        </div>
        <div className="grid grid-3 gap-4 mt-3">
          <div>
            <div className="label">Aktive Plattformen</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
              {PLATFORMS.filter(p => p.status === 'active').length}
            </div>
          </div>
          <div>
            <div className="label">In Prüfung</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: 'var(--warning)' }}>
              {PLATFORMS.filter(p => p.status === 'review').length}
            </div>
          </div>
          <div>
            <div className="label">Nicht konfiguriert</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: 'var(--text-4)' }}>
              {PLATFORMS.filter(p => p.status === 'inactive').length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlatformStatusBadge({ status }) {
  if (status === 'active')   return <Badge kind="success" dot large>Aktiv</Badge>;
  if (status === 'review')   return <Badge kind="warning" dot large>In Prüfung</Badge>;
  return <span style={{ fontSize: 12, color: 'var(--text-4)' }}>— Nicht konfiguriert</span>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 5 — Migration (RSS-Import)
// ═══════════════════════════════════════════════════════════════════════════
function MigrationTab() {
  const [rssUrl, setRssUrl] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  const loadPreview = async () => {
    if (!rssUrl.trim()) return;
    setLoading(true);
    setPreview(null);
    await new Promise((r) => setTimeout(r, 700));
    // Simulierter Vorschau-Abruf
    setPreview({
      title: 'UnicornBakery Podcast',
      description: 'Interviews mit den erfolgreichsten Gründern aus dem DACH-Raum.',
      episodeCount: 142,
      episodes: [
        { num: 142, title: 'Fabian Tausch — UnicornBakery', date: '2026-05-14' },
        { num: 141, title: 'Anna Kirmße — Series A Fundraising', date: '2026-05-07' },
        { num: 140, title: 'Marc Beckmann — B2B SaaS Exit', date: '2026-04-30' },
      ],
    });
    setLoading(false);
  };

  const startImport = async () => {
    setImporting(true);
    await new Promise((r) => setTimeout(r, 1500));
    setImporting(false);
    setDone(true);
  };

  return (
    <div className="col gap-4">
      <div className="card card-pad">
        <div className="h3 mb-1">Full Migration Support</div>
        <div className="meta mb-4">
          Importiere alle Episoden von einem bestehenden RSS-Feed. Metadaten, Show Notes und Statistiken werden übertragen.
        </div>

        <div className="col gap-3">
          <div className="col gap-1">
            <label className="label">RSS Feed URL</label>
            <div className="row gap-2">
              <div className="row gap-2 items-center" style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px', background: 'var(--bg-elev)' }}>
                <I.rss size={14} color="var(--text-4)" />
                <input
                  className="input"
                  style={{ border: 'none', flex: 1 }}
                  placeholder="https://feeds.example.com/mein-podcast.xml"
                  value={rssUrl}
                  onChange={(e) => { setRssUrl(e.target.value); setPreview(null); setDone(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') loadPreview(); }}
                />
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={loadPreview}
                disabled={!rssUrl.trim() || loading}
              >
                {loading ? 'Lade…' : 'Vorschau'}
              </button>
            </div>
            <div className="meta">Unterstützt: Apple Podcasts, Spotify, Podbean, Anchor, Buzzsprout und alle Standard-RSS 2.0 Feeds.</div>
          </div>

          {preview && !done && (
            <div className="col gap-3 mt-2">
              <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{preview.title}</div>
                <div className="meta mt-1">{preview.description}</div>
                <div className="row gap-3 mt-3">
                  <span className="badge ghost">{preview.episodeCount} Episoden gefunden</span>
                  <span className="badge ghost"><I.rss size={11} /> RSS 2.0</span>
                </div>
              </div>

              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-soft)', fontSize: 12.5, color: 'var(--text-3)' }}>
                  Vorschau — letzte 3 Episoden
                </div>
                {preview.episodes.map((ep) => (
                  <div key={ep.num} className="row gap-3" style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-soft)' }}>
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-4)', minWidth: 32 }}>#{ep.num}</span>
                    <span style={{ flex: 1, fontSize: 13 }}>{ep.title}</span>
                    <span className="meta">{ep.date}</span>
                  </div>
                ))}
              </div>

              <button
                className="btn btn-brand"
                onClick={startImport}
                disabled={importing}
                style={{ alignSelf: 'flex-start' }}
              >
                {importing ? 'Importiere…' : `${preview.episodeCount} Episoden importieren →`}
              </button>
            </div>
          )}

          {done && (
            <div style={{ padding: '14px 16px', background: 'var(--success-bg)', borderRadius: 8, border: '1px solid var(--success-border)', color: 'var(--success)' }}>
              ✓ Migration abgeschlossen — {preview?.episodeCount} Episoden wurden importiert.{' '}
              <span style={{ color: 'var(--text-2)' }}>In einer echten Integration würde dies MCP Tool <code>migrate_feed</code> aufrufen.</span>
            </div>
          )}
        </div>
      </div>

      <McpHint tools={['migrate_feed']} note="Vollständige Migration inkl. Metadaten, Show Notes und historischer Analytics" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared: MCP-Hinweis-Banner
// ═══════════════════════════════════════════════════════════════════════════
function McpHint({ tools, note }) {
  return (
    <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border-soft)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <I.rss size={13} color="var(--text-4)" style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>MCP Tools: </span>
        {tools.map((t) => (
          <code key={t} style={{ fontSize: 10.5, background: 'var(--bg-sunk)', borderRadius: 4, padding: '1px 5px', marginRight: 4 }}>{t}</code>
        ))}
        {note && <div className="meta" style={{ marginTop: 4, fontSize: 11 }}>{note}</div>}
      </div>
    </div>
  );
}
