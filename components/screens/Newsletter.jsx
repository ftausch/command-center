'use client';
// Newsletter Hub — manage newsletter issues through their lifecycle.

import { useEffect, useState, useMemo } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { Badge } from '@/components/ui';
import { I } from '@/components/icons';
import {
  listNewsletterIssues,
  createNewsletterIssue,
  updateNewsletterIssue,
  deleteNewsletterIssue,
} from '@/lib/actions/newsletter';

const STATUS_COLS = [
  { id: 'idea',      label: 'Idee',      color: 'var(--text-4)' },
  { id: 'draft',     label: 'Entwurf',   color: 'var(--info)' },
  { id: 'review',    label: 'Review',    color: 'var(--warning)' },
  { id: 'scheduled', label: 'Geplant',   color: 'var(--brand)' },
  { id: 'sent',      label: 'Gesendet',  color: 'var(--success)' },
];

function pct(n) {
  if (n == null || n === '') return null;
  return `${Number(n).toFixed(1)} %`;
}

function IssueCard({ issue, onStatusChange, onEdit, onDelete }) {
  const statusCol = STATUS_COLS.find(c => c.id === issue.status);
  const [moving, setMoving] = useState(false);

  const nextStatus = () => {
    const idx = STATUS_COLS.findIndex(c => c.id === issue.status);
    return idx < STATUS_COLS.length - 1 ? STATUS_COLS[idx + 1].id : null;
  };

  const handleMove = async () => {
    const ns = nextStatus();
    if (!ns || moving) return;
    setMoving(true);
    await onStatusChange(issue.id, ns);
    setMoving(false);
  };

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-soft)',
      borderRadius: 8,
      padding: '12px 14px',
      cursor: 'default',
    }}>
      <div className="row gap-2 items-start">
        <div style={{ flex: 1, minWidth: 0 }}>
          {issue.issueNumber && (
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-4)', marginBottom: 2 }}>
              #{issue.issueNumber}
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>{issue.subject}</div>
          {issue.description && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.4 }}>{issue.description}</div>
          )}
        </div>
        <div className="row gap-1">
          <button className="btn btn-ghost btn-sm" style={{ padding: '2px 5px', fontSize: 11 }} onClick={() => onEdit(issue)}>✎</button>
          <button className="btn btn-ghost btn-sm" style={{ padding: '2px 5px', fontSize: 11, color: 'var(--danger)' }} onClick={() => onDelete(issue.id)}>✕</button>
        </div>
      </div>

      <div className="row gap-2 items-center mt-3" style={{ flexWrap: 'wrap' }}>
        {issue.sendDate && (
          <span className="meta">
            📅 {new Date(issue.sendDate + 'T00:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
        {issue.audience && (
          <span className="meta">👥 {issue.audience}</span>
        )}
        {issue.status === 'sent' && issue.openRate != null && (
          <span className="meta" style={{ color: 'var(--success)' }}>👁 {pct(issue.openRate)}</span>
        )}
        {issue.status === 'sent' && issue.clickRate != null && (
          <span className="meta" style={{ color: 'var(--brand)' }}>🖱 {pct(issue.clickRate)}</span>
        )}
      </div>

      {nextStatus() && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 8, fontSize: 11, width: '100%', justifyContent: 'center', color: statusCol?.color }}
          onClick={handleMove}
          disabled={moving}
        >
          {moving ? '…' : `→ ${STATUS_COLS.find(c => c.id === nextStatus())?.label}`}
        </button>
      )}
    </div>
  );
}

function IssueForm({ initial, onSave, onCancel }) {
  const [subject,     setSubject]     = useState(initial?.subject     ?? '');
  const [issueNumber, setIssueNumber] = useState(initial?.issueNumber ?? '');
  const [audience,    setAudience]    = useState(initial?.audience    ?? '');
  const [sendDate,    setSendDate]    = useState(initial?.sendDate    ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [openRate,    setOpenRate]    = useState(initial?.openRate    ?? '');
  const [clickRate,   setClickRate]   = useState(initial?.clickRate   ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!subject.trim()) return;
    setSaving(true);
    await onSave({
      subject:     subject.trim(),
      issueNumber: issueNumber !== '' ? Number(issueNumber) : undefined,
      audience:    audience || undefined,
      sendDate:    sendDate || undefined,
      description: description || undefined,
      openRate:    openRate !== '' ? Number(openRate) : undefined,
      clickRate:   clickRate !== '' ? Number(clickRate) : undefined,
    });
    setSaving(false);
  };

  return (
    <div className="card card-pad col gap-3">
      <div className="h3">{initial ? 'Ausgabe bearbeiten' : 'Neue Ausgabe'}</div>
      <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
        <input
          autoFocus
          className="input"
          placeholder="Betreff / Titel *"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          style={{ flex: 2, minWidth: 200 }}
        />
        <input
          type="number"
          className="input"
          placeholder="Ausgabe #"
          value={issueNumber}
          onChange={e => setIssueNumber(e.target.value)}
          style={{ flex: 0, minWidth: 100 }}
        />
      </div>
      <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
        <input
          type="date"
          className="input"
          placeholder="Versanddatum"
          value={sendDate}
          onChange={e => setSendDate(e.target.value)}
          style={{ flex: 1 }}
        />
        <input
          className="input"
          placeholder="Zielgruppe (z.B. Alle Abonnenten)"
          value={audience}
          onChange={e => setAudience(e.target.value)}
          style={{ flex: 2, minWidth: 180 }}
        />
      </div>
      <textarea
        className="input"
        placeholder="Kurze Beschreibung / Thema…"
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={2}
        style={{ resize: 'vertical' }}
      />
      <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
        <div className="col gap-1" style={{ flex: 1, minWidth: 100 }}>
          <div className="label">Open Rate (%)</div>
          <input type="number" step="0.1" min="0" max="100" className="input" value={openRate} onChange={e => setOpenRate(e.target.value)} placeholder="z.B. 42.5" />
        </div>
        <div className="col gap-1" style={{ flex: 1, minWidth: 100 }}>
          <div className="label">Click Rate (%)</div>
          <input type="number" step="0.1" min="0" max="100" className="input" value={clickRate} onChange={e => setClickRate(e.target.value)} placeholder="z.B. 8.2" />
        </div>
      </div>
      <div className="row gap-2">
        <button className="btn btn-brand btn-sm" onClick={submit} disabled={saving || !subject.trim()}>
          {saving ? '…' : initial ? 'Speichern' : 'Erstellen'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>Abbrechen</button>
      </div>
    </div>
  );
}

export function NewsletterScreen() {
  const { currentWorkspace: brand, currentWorkspaceId } = useWorkspace();
  const [issues, setIssues]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView]       = useState('pipeline'); // pipeline | list
  const [formOpen, setFormOpen]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [deleting, setDeleting]   = useState(null);

  useEffect(() => {
    if (!currentWorkspaceId) return;
    listNewsletterIssues(currentWorkspaceId).then(data => {
      setIssues(data);
      setLoading(false);
    });
  }, [currentWorkspaceId]);

  const sent     = issues.filter(i => i.status === 'sent');
  const avgOpen  = sent.filter(i => i.openRate  != null).reduce((s, i, _, a) => s + i.openRate  / a.length, 0) || null;
  const avgClick = sent.filter(i => i.clickRate != null).reduce((s, i, _, a) => s + i.clickRate / a.length, 0) || null;

  const byStatus = useMemo(() => {
    const m = {};
    STATUS_COLS.forEach(c => { m[c.id] = []; });
    issues.forEach(i => { if (m[i.status]) m[i.status].push(i); });
    return m;
  }, [issues]);

  const handleCreate = async (fields) => {
    const r = await createNewsletterIssue({ workspaceId: currentWorkspaceId, ...fields });
    if (r.ok && r.data) { setIssues(prev => [r.data, ...prev]); setFormOpen(false); }
  };

  const handleUpdate = async (fields) => {
    const r = await updateNewsletterIssue({ workspaceId: currentWorkspaceId, issueId: editing.id, patch: fields });
    if (r.ok && r.data) {
      setIssues(prev => prev.map(i => i.id === r.data.id ? r.data : i));
      setEditing(null);
    }
  };

  const handleStatusChange = async (issueId, status) => {
    const r = await updateNewsletterIssue({ workspaceId: currentWorkspaceId, issueId, patch: { status } });
    if (r.ok && r.data) setIssues(prev => prev.map(i => i.id === r.data.id ? r.data : i));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Ausgabe wirklich löschen?')) return;
    const r = await deleteNewsletterIssue({ workspaceId: currentWorkspaceId, issueId: id });
    if (r.ok) setIssues(prev => prev.filter(i => i.id !== id));
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2"><Badge kind="brand" dot>{brand?.name}</Badge></div>
          <div className="row gap-3 items-center" style={{ flexWrap: 'wrap', marginBottom: 4 }}>
            <h1 className="h1" style={{ margin: 0 }}>Newsletter</h1>
          </div>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Ausgaben planen, tracken und auswerten.
          </p>
        </div>
        <div className="row gap-2">
          <div style={{ display: 'flex', gap: 4, padding: '2px', background: 'var(--bg-sunk)', borderRadius: 10 }}>
            {[{ id: 'pipeline', label: '📋 Pipeline' }, { id: 'list', label: '📄 Liste' }].map(v => (
              <button key={v.id} onClick={() => setView(v.id)} style={{
                padding: '4px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                background: view === v.id ? 'white' : 'transparent',
                color: view === v.id ? 'var(--text-1)' : 'var(--text-3)',
                boxShadow: view === v.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>{v.label}</button>
            ))}
          </div>
          <button className="btn btn-brand btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <I.plus size={13} /> Neue Ausgabe
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="row gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
        {[
          { label: 'Ausgaben gesamt', value: issues.length },
          { label: 'Gesendet', value: sent.length },
          { label: 'Ø Open Rate', value: avgOpen != null ? pct(avgOpen.toFixed(1)) : '—' },
          { label: 'Ø Click Rate', value: avgClick != null ? pct(avgClick.toFixed(1)) : '—' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '10px 16px', minWidth: 120 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{s.value}</div>
            <div className="meta">{s.label}</div>
          </div>
        ))}
      </div>

      {(formOpen || editing) && (
        <div className="mb-4">
          <IssueForm
            initial={editing ?? null}
            onSave={editing ? handleUpdate : handleCreate}
            onCancel={() => { setFormOpen(false); setEditing(null); }}
          />
        </div>
      )}

      {loading && (
        <div className="card card-pad meta" style={{ textAlign: 'center' }}>Laden…</div>
      )}

      {!loading && view === 'pipeline' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, overflowX: 'auto', minWidth: 0 }}>
          {STATUS_COLS.map(col => (
            <div key={col.id} style={{ minWidth: 180 }}>
              <div className="row gap-2 items-center mb-2" style={{ padding: '2px 0' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{col.label}</span>
                <span className="count">{byStatus[col.id].length}</span>
              </div>
              <div className="col gap-2">
                {byStatus[col.id].length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-4)', fontStyle: 'italic', padding: '8px 0' }}>Leer</div>
                )}
                {byStatus[col.id].map(issue => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    onStatusChange={handleStatusChange}
                    onEdit={(i) => { setEditing(i); setFormOpen(false); }}
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
                <th>#</th>
                <th>Betreff</th>
                <th>Status</th>
                <th>Versanddatum</th>
                <th>Zielgruppe</th>
                <th>Open Rate</th>
                <th>Click Rate</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {issues.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>
                  Noch keine Ausgaben. Klicke "+ Neue Ausgabe" um zu starten.
                </td></tr>
              )}
              {issues.map(issue => {
                const col = STATUS_COLS.find(c => c.id === issue.status);
                return (
                  <tr key={issue.id}>
                    <td className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>
                      {issue.issueNumber ? `#${issue.issueNumber}` : '—'}
                    </td>
                    <td style={{ fontWeight: 500 }}>{issue.subject}</td>
                    <td>
                      <select
                        className="input"
                        value={issue.status}
                        onChange={e => handleStatusChange(issue.id, e.target.value)}
                        style={{ height: 26, fontSize: 11.5, padding: '0 4px', width: 110 }}
                      >
                        {STATUS_COLS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                      {issue.sendDate ? new Date(issue.sendDate + 'T00:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{issue.audience ?? '—'}</td>
                    <td style={{ fontSize: 12.5, color: 'var(--success)' }}>{pct(issue.openRate) ?? '—'}</td>
                    <td style={{ fontSize: 12.5, color: 'var(--brand)' }}>{pct(issue.clickRate) ?? '—'}</td>
                    <td>
                      <div className="row gap-1">
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => { setEditing(issue); setFormOpen(false); }}>✎</button>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--danger)' }} onClick={() => handleDelete(issue.id)}>✕</button>
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
