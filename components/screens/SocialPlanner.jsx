'use client';
// Social Media Planner — plan, approve and track social posts across platforms.

import { useEffect, useState, useMemo } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { Badge } from '@/components/ui';
import { I } from '@/components/icons';
import {
  listSocialPosts, createSocialPost, updateSocialPost, deleteSocialPost,
} from '@/lib/actions/social';

const PLATFORMS = [
  { id: 'linkedin',  label: 'LinkedIn',  emoji: '💼' },
  { id: 'instagram', label: 'Instagram', emoji: '📸' },
  { id: 'twitter',   label: 'Twitter/X', emoji: '🐦' },
  { id: 'tiktok',    label: 'TikTok',    emoji: '🎵' },
  { id: 'youtube',   label: 'YouTube',   emoji: '▶️' },
];

const STATUSES = [
  { id: 'draft',     label: 'Draft',     color: 'var(--text-3)' },
  { id: 'approved',  label: 'Freigegeben', color: 'var(--info)' },
  { id: 'scheduled', label: 'Geplant',   color: 'var(--brand)' },
  { id: 'posted',    label: 'Gepostet',  color: 'var(--success)' },
];

function platEmoji(id) { return PLATFORMS.find(p => p.id === id)?.emoji ?? '📱'; }
function platLabel(id) { return PLATFORMS.find(p => p.id === id)?.label ?? id; }
function statusColor(id) { return STATUSES.find(s => s.id === id)?.color ?? 'var(--text-4)'; }
function statusLabel(id) { return STATUSES.find(s => s.id === id)?.label ?? id; }

const CHAR_LIMITS = { twitter: 280, linkedin: 3000, instagram: 2200, tiktok: 2200, youtube: 5000 };

function PostForm({ initial, episodes, projects, onSave, onCancel }) {
  const [platform, setPlatform]  = useState(initial?.platform   ?? 'linkedin');
  const [content,  setContent]   = useState(initial?.content    ?? '');
  const [schedAt,  setSchedAt]   = useState(initial?.scheduledAt ? initial.scheduledAt.slice(0, 16) : '');
  const [epId,     setEpId]      = useState(initial?.episodeId  ?? '');
  const [projId,   setProjId]    = useState(initial?.projectId  ?? '');
  const [notes,    setNotes]     = useState(initial?.notes      ?? '');
  const [saving, setSaving]      = useState(false);
  const limit = CHAR_LIMITS[platform] ?? 3000;

  const submit = async () => {
    if (!content.trim()) return;
    setSaving(true);
    await onSave({
      platform, content: content.trim(),
      scheduledAt: schedAt ? new Date(schedAt).toISOString() : undefined,
      episodeId: epId || undefined,
      projectId: projId || undefined,
      notes: notes || undefined,
    });
    setSaving(false);
  };

  return (
    <div className="card card-pad col gap-3 mb-4">
      <div className="h3">{initial ? 'Post bearbeiten' : 'Neuer Post'}</div>
      <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
        <select className="input" value={platform} onChange={e => setPlatform(e.target.value)} style={{ flex: 1, minWidth: 130 }}>
          {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.label}</option>)}
        </select>
        <input type="datetime-local" className="input" value={schedAt} onChange={e => setSchedAt(e.target.value)} style={{ flex: 1, minWidth: 180 }} title="Geplanter Zeitpunkt (optional)" />
      </div>
      <div>
        <textarea
          autoFocus
          className="input"
          placeholder={`Post-Text für ${platLabel(platform)}…`}
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={5}
          style={{ resize: 'vertical', fontSize: 13 }}
        />
        <div style={{ fontSize: 11, color: content.length > limit ? 'var(--danger)' : 'var(--text-4)', textAlign: 'right', marginTop: 2 }}>
          {content.length}/{limit}
        </div>
      </div>
      <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
        {episodes.length > 0 && (
          <select className="input" value={epId} onChange={e => setEpId(e.target.value)} style={{ flex: 1, minWidth: 160 }}>
            <option value="">— Keine Episode —</option>
            {episodes.map(e => <option key={e.id} value={e.id}>{e.num ? `Ep. ${e.num} · ` : ''}{e.title}</option>)}
          </select>
        )}
        {projects.length > 0 && (
          <select className="input" value={projId} onChange={e => setProjId(e.target.value)} style={{ flex: 1, minWidth: 160 }}>
            <option value="">— Kein Projekt —</option>
            {projects.filter(p => p.status !== 'Done').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>
      <input className="input" placeholder="Interne Notizen (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
      <div className="row gap-2">
        <button className="btn btn-brand btn-sm" onClick={submit} disabled={saving || !content.trim() || content.length > limit}>
          {saving ? '…' : initial ? 'Speichern' : 'Post erstellen'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>Abbrechen</button>
      </div>
    </div>
  );
}

function PostCard({ post, episodes, projects, onStatusChange, onEdit, onDelete }) {
  const ep   = episodes.find(e => e.id === post.episodeId);
  const proj = projects.find(p => p.id === post.projectId);
  const next = STATUSES[STATUSES.findIndex(s => s.id === post.status) + 1];
  const [moving, setMoving] = useState(false);

  const handleMove = async () => {
    if (!next || moving) return;
    setMoving(true);
    await onStatusChange(post.id, next.id);
    setMoving(false);
  };

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '12px 14px' }}>
      <div className="row gap-2 items-start mb-2">
        <span style={{ fontSize: 18, flexShrink: 0 }}>{platEmoji(post.platform)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: statusColor(post.status), marginBottom: 3 }}>
            {statusLabel(post.status)}
            {post.scheduledAt && <span style={{ color: 'var(--text-4)', fontWeight: 400, marginLeft: 6 }}>
              · {new Date(post.scheduledAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text-1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {post.content.length > 140 ? post.content.slice(0, 140) + '…' : post.content}
          </div>
        </div>
        <div className="row gap-1">
          <button className="btn btn-ghost btn-sm" style={{ padding: '2px 5px', fontSize: 11 }} onClick={() => onEdit(post)}>✎</button>
          <button className="btn btn-ghost btn-sm" style={{ padding: '2px 5px', fontSize: 11, color: 'var(--danger)' }} onClick={() => onDelete(post.id)}>✕</button>
        </div>
      </div>
      {(ep || proj || post.notes) && (
        <div className="row gap-2 mt-2" style={{ flexWrap: 'wrap' }}>
          {ep && <span className="meta">🎙 {ep.title}</span>}
          {proj && <span className="meta">📁 {proj.name}</span>}
          {post.notes && <span className="meta" style={{ fontStyle: 'italic' }}>{post.notes}</span>}
        </div>
      )}
      {next && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 8, width: '100%', justifyContent: 'center', fontSize: 11, color: next.color }}
          onClick={handleMove} disabled={moving}
        >
          {moving ? '…' : `→ ${next.label}`}
        </button>
      )}
    </div>
  );
}

export function SocialPlannerScreen() {
  const { currentWorkspace: brand, currentWorkspaceId, data } = useWorkspace();
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [view,    setView]    = useState('board'); // board | list
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing,  setEditing]  = useState(null);

  useEffect(() => {
    if (!currentWorkspaceId) return;
    listSocialPosts(currentWorkspaceId).then(p => { setPosts(p); setLoading(false); });
  }, [currentWorkspaceId]);

  const episodes = data.episodes ?? [];
  const projects = data.projects;

  const visible = useMemo(() => {
    if (filterPlatform === 'all') return posts;
    return posts.filter(p => p.platform === filterPlatform);
  }, [posts, filterPlatform]);

  const byStatus = useMemo(() => {
    const m = {};
    STATUSES.forEach(s => { m[s.id] = []; });
    visible.forEach(p => { if (m[p.status]) m[p.status].push(p); });
    return m;
  }, [visible]);

  const handleCreate = async (fields) => {
    const r = await createSocialPost({ workspaceId: currentWorkspaceId, ...fields });
    if (r.ok && r.data) { setPosts(prev => [r.data, ...prev]); setFormOpen(false); }
  };

  const handleUpdate = async (fields) => {
    const r = await updateSocialPost({ workspaceId: currentWorkspaceId, postId: editing.id, patch: fields });
    if (r.ok && r.data) { setPosts(prev => prev.map(p => p.id === r.data.id ? r.data : p)); setEditing(null); }
  };

  const handleStatusChange = async (postId, status) => {
    const r = await updateSocialPost({ workspaceId: currentWorkspaceId, postId, patch: { status } });
    if (r.ok && r.data) setPosts(prev => prev.map(p => p.id === r.data.id ? r.data : p));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Post wirklich löschen?')) return;
    const r = await deleteSocialPost({ workspaceId: currentWorkspaceId, postId: id });
    if (r.ok) setPosts(prev => prev.filter(p => p.id !== id));
  };

  const postedCount   = posts.filter(p => p.status === 'posted').length;
  const scheduledCount = posts.filter(p => p.status === 'scheduled').length;
  const draftCount    = posts.filter(p => p.status === 'draft').length;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2"><Badge kind="brand" dot>{brand?.name}</Badge></div>
          <div className="row gap-3 items-center" style={{ flexWrap: 'wrap', marginBottom: 4 }}>
            <h1 className="h1" style={{ margin: 0 }}>Social Media</h1>
          </div>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Posts planen, freigeben und verfolgen — verknüpft mit Episoden und Events.
          </p>
        </div>
        <div className="row gap-2">
          <div style={{ display: 'flex', gap: 4, padding: '2px', background: 'var(--bg-sunk)', borderRadius: 10 }}>
            {[{ id: 'board', label: '📋 Board' }, { id: 'list', label: '📄 Liste' }].map(v => (
              <button key={v.id} onClick={() => setView(v.id)} style={{
                padding: '4px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                background: view === v.id ? 'white' : 'transparent', color: view === v.id ? 'var(--text-1)' : 'var(--text-3)',
                boxShadow: view === v.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>{v.label}</button>
            ))}
          </div>
          <button className="btn btn-brand btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <I.plus size={13} /> Neuer Post
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="row gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
        {[
          { label: 'Gesamt', value: posts.length },
          { label: 'Gepostet', value: postedCount },
          { label: 'Geplant', value: scheduledCount },
          { label: 'Draft', value: draftCount },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '10px 16px', minWidth: 90 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{s.value}</div>
            <div className="meta">{s.label}</div>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        {/* Platform filter */}
        <div className="row gap-1">
          {[{ id: 'all', label: 'Alle' }, ...PLATFORMS].map(p => (
            <button
              key={p.id}
              className={`chip${filterPlatform === p.id ? ' active' : ''}`}
              onClick={() => setFilterPlatform(p.id)}
            >
              {p.emoji ? `${p.emoji} ${p.label}` : p.label}
            </button>
          ))}
        </div>
      </div>

      {(formOpen || editing) && (
        <PostForm
          initial={editing ?? null}
          episodes={episodes}
          projects={projects}
          onSave={editing ? handleUpdate : handleCreate}
          onCancel={() => { setFormOpen(false); setEditing(null); }}
        />
      )}

      {loading && <div className="card card-pad meta" style={{ textAlign: 'center' }}>Laden…</div>}

      {!loading && view === 'board' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {STATUSES.map(col => (
            <div key={col.id}>
              <div className="row gap-2 items-center mb-2">
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{col.label}</span>
                <span className="count">{byStatus[col.id].length}</span>
              </div>
              <div className="col gap-2">
                {byStatus[col.id].length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-4)', fontStyle: 'italic', padding: '4px 0' }}>Leer</div>
                )}
                {byStatus[col.id].map(post => (
                  <PostCard
                    key={post.id} post={post}
                    episodes={episodes} projects={projects}
                    onStatusChange={handleStatusChange}
                    onEdit={p => { setEditing(p); setFormOpen(false); }}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && view === 'list' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Plattform</th>
                <th>Inhalt</th>
                <th>Status</th>
                <th>Zeitpunkt</th>
                <th>Verknüpft</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>
                  Noch keine Posts. Klicke "+ Neuer Post".
                </td></tr>
              )}
              {visible.map(post => {
                const ep   = episodes.find(e => e.id === post.episodeId);
                const proj = projects.find(p => p.id === post.projectId);
                return (
                  <tr key={post.id}>
                    <td style={{ fontSize: 18 }} title={platLabel(post.platform)}>{platEmoji(post.platform)}</td>
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                      {post.content}
                    </td>
                    <td>
                      <select
                        className="input"
                        value={post.status}
                        onChange={e => handleStatusChange(post.id, e.target.value)}
                        style={{ height: 26, fontSize: 11.5, padding: '0 4px', width: 120 }}
                      >
                        {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      {post.scheduledAt ? new Date(post.scheduledAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{ep?.title ?? proj?.name ?? '—'}</td>
                    <td>
                      <div className="row gap-1">
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => { setEditing(post); setFormOpen(false); }}>✎</button>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--danger)' }} onClick={() => handleDelete(post.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
