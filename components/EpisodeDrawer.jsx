'use client';
// EpisodeDrawer — right-side slide-in panel for episode details.
// Tabs: Details · Show Notes · Gast-Vorbereitung · Clips · Publish-Checklist

import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { updateEpisode } from '@/lib/actions/episodes';

const STATUS_OPTIONS = ['idea', 'draft', 'review', 'scheduled', 'published'];
const STATUS_LABEL   = { idea: 'Idee', draft: 'In Arbeit', review: 'Review', scheduled: 'Geplant', published: 'Live' };
const STATUS_COLOR   = { idea: 'var(--text-3)', draft: 'var(--info)', review: 'var(--warning)', scheduled: 'var(--brand)', published: 'var(--success)' };

const PLATFORMS = ['LinkedIn', 'Instagram', 'TikTok', 'YouTube Shorts', 'Twitter/X'];

const PUBLISH_ITEMS = [
  { id: 'cut',        label: 'Intro & Outro geschnitten'        },
  { id: 'shownotes',  label: 'Show Notes fertiggestellt'        },
  { id: 'chapters',   label: 'Kapitelmarken gesetzt'            },
  { id: 'thumbnail',  label: 'Thumbnail erstellt'               },
  { id: 'apple',      label: 'Apple Podcasts hochgeladen'       },
  { id: 'spotify',    label: 'Spotify hochgeladen'              },
  { id: 'linkedin',   label: 'LinkedIn-Post vorbereitet'        },
  { id: 'newsletter', label: 'Newsletter-Teaser geschrieben'    },
  { id: 'instagram',  label: 'Instagram Story'                  },
  { id: 'youtube',    label: 'YouTube Upload'                   },
];

export function EpisodeDrawer({ episodeId, onClose }) {
  const { currentWorkspaceId: workspaceId, data, updateEpisodeInCache } = useWorkspace();
  const episode = data.episodes?.find((e) => e.id === episodeId) ?? null;

  const [tab, setTab] = useState('details');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  // ── Details fields ────────────────────────────────────────────────────────
  const [fieldPending, setFieldPending] = useState(null);

  // ── Show Notes ────────────────────────────────────────────────────────────
  const [showNotesDraft, setShowNotesDraft] = useState('');
  const [showNotesPending, setShowNotesPending] = useState(false);
  const showNotesRef = useRef(null);

  // ── Gast-Vorbereitung ─────────────────────────────────────────────────────
  const [guestBioDraft,    setGuestBioDraft]    = useState('');
  const [guestNotesDraft,  setGuestNotesDraft]  = useState('');
  const [guestQDraft,      setGuestQDraft]      = useState('');
  const [guestPending,     setGuestPending]     = useState(false);

  // ── Clips ─────────────────────────────────────────────────────────────────
  const [clipTitle,    setClipTitle]    = useState('');
  const [clipPlatform, setClipPlatform] = useState('LinkedIn');
  const [clipPending,  setClipPending]  = useState(false);

  useEffect(() => {
    if (!episode) return;
    setShowNotesDraft(episode.showNotes ?? '');
    setGuestBioDraft(episode.episodeMeta?.guestBio ?? '');
    setGuestNotesDraft(episode.episodeMeta?.guestNotes ?? '');
    setGuestQDraft((episode.episodeMeta?.guestQuestions ?? []).join('\n'));
    setTab('details');
    setError(null);
  }, [episodeId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!episode) return null;

  const meta = episode.episodeMeta ?? {};
  const clips = meta.clips ?? [];
  const publishChecklist = meta.publishChecklist ?? {};
  const doneCount = PUBLISH_ITEMS.filter((i) => publishChecklist[i.id]).length;

  // ── Helpers ───────────────────────────────────────────────────────────────

  const patchMeta = async (patch) => {
    const newMeta = { ...meta, ...patch };
    const r = await updateEpisode({ episodeId, workspaceId, patch: { episodeMeta: newMeta } });
    if (r.ok) updateEpisodeInCache(episodeId, { episodeMeta: newMeta });
    return r;
  };

  const saveField = async (key, value) => {
    setFieldPending(key);
    setError(null);
    const r = await updateEpisode({ episodeId, workspaceId, patch: { [key]: value } });
    setFieldPending(null);
    if (!r.ok) { setError(r.error ?? 'Fehler'); return; }
    updateEpisodeInCache(episodeId, { [key]: value });
  };

  const saveShowNotes = async () => {
    setShowNotesPending(true);
    const r = await updateEpisode({ episodeId, workspaceId, patch: { showNotes: showNotesDraft } });
    setShowNotesPending(false);
    if (r.ok) updateEpisodeInCache(episodeId, { showNotes: showNotesDraft });
    else setError(r.error);
  };

  const saveGuestPrep = async () => {
    setGuestPending(true);
    const questions = guestQDraft.split('\n').map((q) => q.trim()).filter(Boolean);
    const r = await patchMeta({ guestBio: guestBioDraft, guestNotes: guestNotesDraft, guestQuestions: questions });
    setGuestPending(false);
    if (!r.ok) setError(r.error);
  };

  const addClip = async () => {
    if (!clipTitle.trim()) return;
    setClipPending(true);
    const newClip = { id: crypto.randomUUID(), title: clipTitle.trim(), platform: clipPlatform, status: 'todo' };
    await patchMeta({ clips: [...clips, newClip] });
    setClipPending(false);
    setClipTitle('');
  };

  const toggleClip = async (id) => {
    const updated = clips.map((c) => c.id === id ? { ...c, status: c.status === 'done' ? 'todo' : 'done' } : c);
    await patchMeta({ clips: updated });
  };

  const deleteClip = async (id) => {
    await patchMeta({ clips: clips.filter((c) => c.id !== id) });
  };

  const togglePublish = async (id) => {
    await patchMeta({ publishChecklist: { ...publishChecklist, [id]: !publishChecklist[id] } });
  };

  const tabs = [
    { id: 'details',   label: 'Details'        },
    { id: 'shownotes', label: 'Show Notes'      },
    { id: 'guest',     label: 'Gast-Vorbereitung' },
    { id: 'clips',     label: `Clips${clips.length > 0 ? ` (${clips.length})` : ''}` },
    { id: 'publish',   label: `Publish${doneCount > 0 ? ` ${doneCount}/${PUBLISH_ITEMS.length}` : ''}` },
  ];

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(20,22,28,0.45)', display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          background: 'var(--bg-elev)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-12px 0 32px rgba(20,22,28,0.08)',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border-soft)' }}>
          <div className="row between items-start mb-1">
            <div style={{ minWidth: 0, flex: 1 }}>
              {episode.num && (
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 4 }}>Ep. {episode.num}</div>
              )}
              <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>{episode.title}</div>
              {episode.guest && (
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 3 }}>Gast: {episode.guest}</div>
              )}
            </div>
            <button className="btn btn-quiet btn-icon" onClick={onClose} style={{ flexShrink: 0, marginLeft: 8 }}>
              <I.x size={14} />
            </button>
          </div>
          <div className="row gap-2 mt-2">
            <span style={{
              fontSize: 11.5, fontWeight: 600, padding: '2px 10px', borderRadius: 20,
              background: 'var(--bg-sunk)', color: STATUS_COLOR[episode.status] ?? 'var(--text-3)',
            }}>
              {STATUS_LABEL[episode.status] ?? episode.status}
            </span>
            {episode.date && (
              <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>📅 {episode.date}</span>
            )}
            {episode.duration && episode.duration !== '—' && (
              <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>⏱ {episode.duration}</span>
            )}
            {episode.hasVideo && (
              <span style={{ fontSize: 11.5, color: 'var(--info)' }}>🎬 Video</span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-soft)', overflowX: 'auto', flexShrink: 0 }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
                color: tab === t.id ? 'var(--brand)' : 'var(--text-3)',
                borderBottom: tab === t.id ? '2px solid var(--brand)' : '2px solid transparent',
                transition: 'color 0.1s',
              }}
            >{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '20px 22px', overflowY: 'auto' }}>
          {error && (
            <div style={{ fontSize: 12.5, color: 'var(--danger)', padding: '6px 10px', background: 'var(--danger-bg)', borderRadius: 6, marginBottom: 14 }}>
              {error}
            </div>
          )}

          {/* ── Details ── */}
          {tab === 'details' && (
            <div className="col gap-0">
              <Row label="Status">
                <select className="input" value={episode.status}
                  onChange={(e) => saveField('status', e.target.value)}
                  disabled={fieldPending === 'status'}
                  style={{ height: 28, fontSize: 12.5 }}
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </Row>
              <Row label="Ep.-Nr.">
                <input type="number" className="input"
                  defaultValue={episode.num ?? ''}
                  onBlur={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v !== episode.num) saveField('num', v); else if (!e.target.value) saveField('num', null); }}
                  disabled={fieldPending === 'num'}
                  style={{ height: 28, fontSize: 12.5, width: 100 }}
                />
              </Row>
              <Row label="Gast">
                <input className="input"
                  defaultValue={episode.guest ?? ''}
                  onBlur={(e) => { if (e.target.value !== episode.guest) saveField('guest', e.target.value); }}
                  disabled={fieldPending === 'guest'}
                  style={{ height: 28, fontSize: 12.5, flex: 1 }}
                />
              </Row>
              <Row label="Datum">
                <input type="date" className="input"
                  defaultValue={episode.date ?? ''}
                  onBlur={(e) => { if (e.target.value !== episode.date) saveField('date', e.target.value); }}
                  disabled={fieldPending === 'date'}
                  style={{ height: 28, fontSize: 12.5 }}
                />
              </Row>
              <Row label="Dauer">
                <input className="input"
                  defaultValue={episode.duration === '—' ? '' : (episode.duration ?? '')}
                  onBlur={(e) => { if (e.target.value !== episode.duration) saveField('duration', e.target.value); }}
                  disabled={fieldPending === 'duration'}
                  placeholder="58:24"
                  style={{ height: 28, fontSize: 12.5, width: 100, fontFamily: 'var(--font-mono)' }}
                />
              </Row>
              <Row label="Video">
                <label className="row gap-2" style={{ cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox"
                    checked={episode.hasVideo}
                    onChange={(e) => saveField('hasVideo', e.target.checked)}
                    disabled={fieldPending === 'hasVideo'}
                    style={{ accentColor: 'var(--brand)' }}
                  />
                  Hat Video-Version
                </label>
              </Row>
              <div style={{ paddingTop: 14, borderTop: '1px solid var(--border-soft)', marginTop: 8 }}>
                <div className="label mb-2">Beschreibung</div>
                <textarea
                  className="input"
                  defaultValue={episode.description ?? ''}
                  onBlur={(e) => { if (e.target.value !== (episode.description ?? '')) saveField('description', e.target.value); }}
                  disabled={fieldPending === 'description'}
                  rows={4}
                  placeholder="Kurze Episode-Beschreibung…"
                  style={{ fontSize: 13, resize: 'vertical', lineHeight: 1.55 }}
                />
              </div>
              {meta.recordingUrl && (
                <div style={{ marginTop: 12 }}>
                  <a href={meta.recordingUrl} target="_blank" rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                  >
                    🎙 Aufnahme öffnen <I.arrowRight size={11} />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* ── Show Notes ── */}
          {tab === 'shownotes' && (
            <div className="col gap-3">
              <div className="row between items-center">
                <div className="label">Show Notes</div>
                <button className="btn btn-brand btn-sm" onClick={saveShowNotes} disabled={showNotesPending}>
                  {showNotesPending ? 'Speichert…' : 'Speichern'}
                </button>
              </div>
              <textarea
                ref={showNotesRef}
                className="input"
                value={showNotesDraft}
                onChange={(e) => setShowNotesDraft(e.target.value)}
                rows={18}
                placeholder={'Kapitel:\n00:00 Intro\n03:45 Hauptthema\n\nLinks:\n- https://...\n\nÜber den Gast:\n...'}
                style={{ fontSize: 13.5, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit', minHeight: 300 }}
                disabled={showNotesPending}
              />
              <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>
                {showNotesDraft.length} Zeichen · {showNotesDraft.split('\n').length} Zeilen
              </div>
            </div>
          )}

          {/* ── Gast-Vorbereitung ── */}
          {tab === 'guest' && (
            <div className="col gap-4">
              <div>
                <div className="label mb-2">Gast-Bio</div>
                <textarea className="input" value={guestBioDraft}
                  onChange={(e) => setGuestBioDraft(e.target.value)}
                  rows={3} placeholder="Kurze Biografie des Gastes…"
                  style={{ fontSize: 13, resize: 'vertical' }}
                  disabled={guestPending}
                />
              </div>
              <div>
                <div className="label mb-2">Vorbereitung / Notizen</div>
                <textarea className="input" value={guestNotesDraft}
                  onChange={(e) => setGuestNotesDraft(e.target.value)}
                  rows={3} placeholder="Was wissen wir über den Gast? Besondere Themen, No-Gos…"
                  style={{ fontSize: 13, resize: 'vertical' }}
                  disabled={guestPending}
                />
              </div>
              <div>
                <div className="label mb-2">Interview-Fragen</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 6 }}>Eine Frage pro Zeile</div>
                <textarea className="input" value={guestQDraft}
                  onChange={(e) => setGuestQDraft(e.target.value)}
                  rows={8} placeholder={'Was war der Wendepunkt in deiner Gründerreise?\nWie habt ihr euren ersten Kunden gewonnen?\n…'}
                  style={{ fontSize: 13, resize: 'vertical', lineHeight: 1.7 }}
                  disabled={guestPending}
                />
              </div>
              <button className="btn btn-brand btn-sm" onClick={saveGuestPrep} disabled={guestPending}
                style={{ alignSelf: 'flex-start' }}>
                {guestPending ? 'Speichert…' : 'Speichern'}
              </button>
            </div>
          )}

          {/* ── Clips ── */}
          {tab === 'clips' && (
            <div className="col gap-4">
              <div>
                <div className="label mb-3">Clip-Planung</div>
                <div className="row gap-2 mb-4">
                  <input className="input" placeholder="Clip-Titel…" value={clipTitle}
                    onChange={(e) => setClipTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addClip()}
                    disabled={clipPending}
                    style={{ flex: 1, fontSize: 13 }}
                  />
                  <select className="input" value={clipPlatform}
                    onChange={(e) => setClipPlatform(e.target.value)}
                    disabled={clipPending}
                    style={{ width: 140, fontSize: 13 }}
                  >
                    {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button className="btn btn-brand btn-sm" onClick={addClip} disabled={clipPending || !clipTitle.trim()}>
                    <I.plus size={12} />
                  </button>
                </div>
              </div>

              {clips.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-4)', fontSize: 13 }}>
                  Noch keine Clips geplant.
                </div>
              ) : (
                <div className="col gap-2">
                  {clips.map((c) => (
                    <div key={c.id} className="row gap-3 items-center"
                      style={{
                        padding: '9px 12px', borderRadius: 8,
                        border: `1px solid ${c.status === 'done' ? 'var(--border-soft)' : 'var(--border)'}`,
                        background: c.status === 'done' ? 'var(--bg-sunk)' : 'var(--bg-card)',
                        opacity: c.status === 'done' ? 0.7 : 1,
                      }}
                    >
                      <input type="checkbox" checked={c.status === 'done'}
                        onChange={() => toggleClip(c.id)}
                        style={{ accentColor: 'var(--success)', flexShrink: 0 }}
                      />
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, textDecoration: c.status === 'done' ? 'line-through' : 'none' }}>
                        {c.title}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 12,
                        background: 'var(--bg-sunk)', color: 'var(--text-3)',
                      }}>{c.platform}</span>
                      <button className="btn btn-quiet btn-icon" style={{ width: 24, height: 24, color: 'var(--text-4)' }}
                        onClick={() => deleteClip(c.id)}><I.x size={10} /></button>
                    </div>
                  ))}
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                    {clips.filter((c) => c.status === 'done').length}/{clips.length} erledigt
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Publish Checklist ── */}
          {tab === 'publish' && (
            <div className="col gap-2">
              <div className="row between mb-2">
                <div className="label">Publish-Checklist</div>
                <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{doneCount}/{PUBLISH_ITEMS.length}</span>
              </div>

              {/* Progress bar */}
              <div style={{ height: 4, background: 'var(--border-soft)', borderRadius: 2, marginBottom: 12 }}>
                <div style={{
                  width: `${Math.round((doneCount / PUBLISH_ITEMS.length) * 100)}%`,
                  height: '100%',
                  background: doneCount === PUBLISH_ITEMS.length ? 'var(--success)' : 'var(--brand)',
                  borderRadius: 2, transition: 'width 0.3s',
                }} />
              </div>

              {PUBLISH_ITEMS.map((item) => {
                const checked = !!publishChecklist[item.id];
                return (
                  <label key={item.id}
                    className="row gap-3 items-center"
                    style={{
                      cursor: 'pointer', padding: '8px 10px', borderRadius: 8,
                      background: checked ? 'var(--bg-sunk)' : 'transparent',
                    }}
                  >
                    <input type="checkbox" checked={checked}
                      onChange={() => togglePublish(item.id)}
                      style={{ accentColor: 'var(--success)', width: 16, height: 16, flexShrink: 0 }}
                    />
                    <span style={{
                      fontSize: 13.5, fontWeight: 500,
                      textDecoration: checked ? 'line-through' : 'none',
                      color: checked ? 'var(--text-3)' : 'var(--text-1)',
                    }}>
                      {item.label}
                    </span>
                    {checked && <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--success)' }}>✓</span>}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="row gap-3 items-center" style={{ padding: '6px 0', minHeight: 36, borderBottom: '1px solid var(--border-soft)' }}>
      <span style={{ fontSize: 11.5, color: 'var(--text-3)', width: 68, flexShrink: 0 }}>{label}</span>
      <div className="row gap-2 items-center" style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
