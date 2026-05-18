'use client';
// Assistant Hub — PA / personal assistant workspace.
// Tabs: Dashboard · Follow-ups · Dokumente · Termine · Freigaben · Kontakte · Alle
// v2: full item editing, contacts tab, Kontaktiert-button, notes, filters, bulk actions

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Badge } from '@/components/ui';
import { dueLabel, timeAgo } from '@/lib/utils';
import {
  listAssistantItems, createAssistantItem,
  updateAssistantItem, deleteAssistantItem, snoozeItem,
} from '@/lib/actions/assistant';

// ── Constants ─────────────────────────────────────────────────────────────

const TYPE_META = {
  follow_up:        { label: 'Follow-up',  icon: '📩', color: 'var(--info)'    },
  scheduling:       { label: 'Termin',     icon: '📅', color: 'var(--brand)'   },
  document_request: { label: 'Dokument',   icon: '📄', color: 'var(--warning)' },
  approval:         { label: 'Freigabe',   icon: '✅', color: 'var(--success)' },
  reminder:         { label: 'Erinnerung', icon: '🔔', color: '#e8780a'        },
  other:            { label: 'Sonstiges',  icon: '📌', color: 'var(--text-3)'  },
};
const STATUS_META = {
  open:      { label: 'Offen',       color: 'var(--info)'    },
  waiting:   { label: 'Wartet',      color: 'var(--warning)' },
  done:      { label: 'Erledigt',    color: 'var(--success)' },
  escalated: { label: 'Eskaliert',   color: 'var(--danger)'  },
  cancelled: { label: 'Abgebrochen', color: 'var(--text-4)'  },
};
const PRIO_META = {
  urgent: { label: 'Urgent', color: 'var(--danger)'  },
  high:   { label: 'High',   color: 'var(--warning)' },
  medium: { label: 'Medium', color: 'var(--info)'    },
  low:    { label: 'Low',    color: 'var(--text-3)'  },
};

const TODAY_STR = new Date().toISOString().slice(0, 10);

const isOverdue  = (i) => i.dueDate && i.dueDate < TODAY_STR && i.status !== 'done' && i.status !== 'cancelled';
const isDueToday = (i) => i.dueDate === TODAY_STR && i.status !== 'done' && i.status !== 'cancelled';
const isSnoozed  = (i) => i.snoozedUntil && i.snoozedUntil > new Date().toISOString();
const isActive   = (i) => i.status === 'open' || i.status === 'waiting' || i.status === 'escalated';

// ── Helpers ───────────────────────────────────────────────────────────────

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ── Edit Item Modal ───────────────────────────────────────────────────────

function EditModal({ item, workspaceId, members, onSave, onClose }) {
  const [draft, setDraft] = useState({
    title:        item.title,
    type:         item.type,
    status:       item.status,
    priority:     item.priority ?? 'medium',
    contactName:  item.contactName ?? '',
    contactEmail: item.contactEmail ?? '',
    company:      item.company ?? '',
    dueDate:      item.dueDate ?? '',
    description:  item.description ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  const save = async () => {
    if (!draft.title.trim()) return;
    setSaving(true);
    const r = await updateAssistantItem({
      workspaceId, itemId: item.id,
      patch: {
        title:        draft.title.trim(),
        type:         draft.type,
        status:       draft.status,
        priority:     draft.priority || undefined,
        contactName:  draft.contactName.trim() || undefined,
        contactEmail: draft.contactEmail.trim() || undefined,
        company:      draft.company.trim() || undefined,
        dueDate:      draft.dueDate || undefined,
        description:  draft.description.trim() || undefined,
      },
    });
    setSaving(false);
    if (!r.ok) { setError(r.error); return; }
    onSave(r.data);
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,22,28,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card card-pad col gap-3" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <div className="h3">Item bearbeiten</div>
          <button className="btn btn-quiet btn-icon" onClick={onClose}><I.x size={14} /></button>
        </div>

        <input className="input" value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Titel *" autoFocus style={{ fontSize: 13 }} />

        <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <select className="input" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} style={{ fontSize: 13 }}>
            {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
          <select className="input" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} style={{ fontSize: 13 }}>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="input" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })} style={{ fontSize: 13 }}>
            <option value="urgent">🔴 Urgent</option>
            <option value="high">🟠 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">⚪ Low</option>
          </select>
        </div>

        <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <input className="input" placeholder="Kontakt" value={draft.contactName}
            onChange={(e) => setDraft({ ...draft, contactName: e.target.value })} style={{ fontSize: 13 }} />
          <input className="input" placeholder="Email" type="email" value={draft.contactEmail}
            onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })} style={{ fontSize: 13 }} />
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <input className="input" placeholder="Unternehmen" value={draft.company}
            onChange={(e) => setDraft({ ...draft, company: e.target.value })} style={{ fontSize: 13 }} />
          <input type="date" className="input" value={draft.dueDate}
            onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} style={{ fontSize: 13 }} />
        </div>
        <textarea className="input" rows={3} placeholder="Notizen / Beschreibung…"
          value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          style={{ fontSize: 13, resize: 'vertical' }} />

        {error && <div style={{ fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>}
        <div className="row gap-2">
          <button className="btn btn-brand btn-sm" onClick={save} disabled={!draft.title.trim() || saving}>
            {saving ? 'Speichert…' : 'Speichern'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

// ── Item Row ──────────────────────────────────────────────────────────────

function ItemRow({ item, workspaceId, onUpdate, onDelete, selected, onSelect }) {
  const [pending,    setPending]    = useState(null);
  const [expanded,   setExpanded]   = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);
  const [editing,    setEditing]    = useState(false);

  const typeMeta = TYPE_META[item.type] ?? TYPE_META.other;
  const due      = item.dueDate ? dueLabel(item.dueDate) : null;
  const overdue  = isOverdue(item);
  const snoozed  = isSnoozed(item);

  const patch = async (p) => {
    setPending('patch');
    const r = await updateAssistantItem({ workspaceId, itemId: item.id, patch: p });
    setPending(null);
    if (r.ok && r.data) onUpdate(r.data);
  };

  // Feature 3: "Kontaktiert" — sets last_contacted_at + next_follow_up_at +7d
  const markContacted = async () => {
    setPending('contact');
    const r = await updateAssistantItem({
      workspaceId, itemId: item.id,
      patch: {
        status:          'waiting',
        lastContactedAt: new Date().toISOString(),
        nextFollowUpAt:  addDays(7),
      },
    });
    setPending(null);
    if (r.ok && r.data) onUpdate(r.data);
  };

  const snooze = async (days) => {
    setPending('snooze');
    const r = await snoozeItem({ workspaceId, itemId: item.id, days });
    setPending(null);
    setShowSnooze(false);
    if (r.ok && r.data) onUpdate(r.data);
  };

  const remove = async () => {
    setPending('delete');
    const r = await deleteAssistantItem({ workspaceId, itemId: item.id });
    setPending(null);
    if (r.ok) onDelete(item.id);
  };

  return (
    <>
      {editing && (
        <EditModal item={item} workspaceId={workspaceId} members={[]}
          onSave={(updated) => { onUpdate(updated); setEditing(false); }}
          onClose={() => setEditing(false)} />
      )}

      <div style={{
        borderRadius: 8,
        border: `1px solid ${overdue ? 'var(--danger-border)' : selected ? 'var(--brand)' : 'var(--border-soft)'}`,
        background: overdue ? 'var(--danger-bg)' : selected ? 'var(--brand-soft)' : snoozed ? 'var(--bg-sunk)' : 'var(--bg-card)',
        opacity: item.status === 'done' ? 0.55 : pending ? 0.75 : 1,
        transition: 'opacity 0.15s, border-color 0.1s',
      }}>
        <div className="row gap-2 items-start" style={{ padding: '10px 12px' }}>
          {/* Checkbox for bulk */}
          <input type="checkbox" checked={selected} onChange={() => onSelect(item.id)}
            style={{ accentColor: 'var(--brand)', marginTop: 3, flexShrink: 0 }} />

          {/* Type icon — click to expand */}
          <span style={{ fontSize: 15, flexShrink: 0, marginTop: 2, cursor: 'pointer' }}
            onClick={() => setExpanded(!expanded)}>{typeMeta.icon}</span>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
            <div className="row gap-2 items-center mb-1">
              <span style={{
                fontSize: 13.5, fontWeight: 600,
                textDecoration: item.status === 'done' ? 'line-through' : 'none',
                color: item.status === 'done' ? 'var(--text-3)' : 'var(--text-1)',
              }}>{item.title}</span>
              {item.priority === 'urgent' && (
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '1px 6px', borderRadius: 10 }}>URGENT</span>
              )}
              {item.priority === 'high' && (
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warning)' }}>High</span>
              )}
              {snoozed && <span style={{ fontSize: 10.5, color: 'var(--text-4)' }}>💤</span>}
            </div>
            <div className="row gap-3" style={{ fontSize: 12, color: 'var(--text-3)', flexWrap: 'wrap' }}>
              {item.contactName && <span>👤 {item.contactName}{item.company ? ` · ${item.company}` : ''}</span>}
              {due && (
                <span style={{ color: due.danger ? 'var(--danger)' : due.today ? 'var(--warning)' : 'var(--text-3)', fontWeight: due.danger || due.today ? 600 : 400 }}>
                  📅 {due.text}
                </span>
              )}
              {item.lastContactedAt && (
                <span style={{ color: 'var(--text-4)' }}>Letzter Kontakt: {timeAgo(item.lastContactedAt)}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="row gap-1 items-center" style={{ flexShrink: 0 }}>
            <select
              className="input"
              value={item.status}
              onChange={(e) => patch({ status: e.target.value })}
              disabled={!!pending}
              style={{ height: 26, fontSize: 11.5, padding: '0 4px', width: 100,
                color: STATUS_META[item.status]?.color ?? 'var(--text-3)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {Object.entries(STATUS_META).filter(([k]) => k !== 'cancelled').map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>

            {/* Kontaktiert button for follow-ups */}
            {item.type === 'follow_up' && item.status !== 'done' && (
              <button className="btn btn-quiet btn-sm"
                onClick={(e) => { e.stopPropagation(); markContacted(); }}
                disabled={!!pending}
                title="Als kontaktiert markieren — setzt nächsten Follow-up in 7 Tagen"
                style={{ fontSize: 11, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                ✉️ Kontaktiert
              </button>
            )}

            {item.status !== 'done' && (
              <button className="btn btn-quiet btn-icon" style={{ width: 26, height: 26 }}
                onClick={(e) => { e.stopPropagation(); patch({ status: 'done' }); }}
                disabled={!!pending} title="Erledigt">
                <I.check size={12} />
              </button>
            )}
            <button className="btn btn-quiet btn-icon" style={{ width: 26, height: 26 }}
              onClick={(e) => { e.stopPropagation(); setEditing(true); }}
              title="Bearbeiten">
              <I.edit size={11} />
            </button>
            <button className="btn btn-quiet btn-icon" style={{ width: 26, height: 26, fontSize: 13 }}
              onClick={(e) => { e.stopPropagation(); setShowSnooze(!showSnooze); }}
              title="Wiedervorlage">⏰</button>
          </div>
        </div>

        {/* Snooze panel */}
        {showSnooze && (
          <div className="row gap-2" style={{ padding: '0 12px 10px 40px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-3)', alignSelf: 'center' }}>Wiedervorlage:</span>
            {[{ l: 'Morgen', d: 1 }, { l: '3 Tage', d: 3 }, { l: 'Nächste Woche', d: 7 }, { l: '2 Wochen', d: 14 }].map(({ l, d }) => (
              <button key={d} className="btn btn-ghost btn-sm"
                onClick={() => snooze(d)} disabled={!!pending} style={{ fontSize: 12 }}>{l}</button>
            ))}
          </div>
        )}

        {/* Expanded detail */}
        {expanded && (
          <div style={{ borderTop: '1px solid var(--border-soft)', padding: '10px 12px 12px 40px' }}>
            {item.description && (
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {item.description}
              </div>
            )}
            <div className="row gap-4 mb-2" style={{ fontSize: 12, color: 'var(--text-3)', flexWrap: 'wrap' }}>
              {item.contactEmail && (
                <a href={`mailto:${item.contactEmail}`} style={{ color: 'var(--brand)' }}>✉️ {item.contactEmail}</a>
              )}
              {item.nextFollowUpAt && (
                <span>🔔 Nächster Follow-up: {new Date(item.nextFollowUpAt).toLocaleDateString('de-DE')}</span>
              )}
              <span>Angelegt {timeAgo(item.createdAt)}</span>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', fontSize: 12 }}
              onClick={remove} disabled={!!pending}><I.x size={11} /> Löschen</button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Bulk Action Bar ───────────────────────────────────────────────────────

function BulkBar({ count, workspaceId, selectedIds, items, onUpdate, onClear }) {
  const [pending, setPending] = useState(false);

  const bulkPatch = async (patch) => {
    setPending(true);
    await Promise.all([...selectedIds].map((id) =>
      updateAssistantItem({ workspaceId, itemId: id, patch })
    ));
    setPending(false);
    const updated = items.map((i) => selectedIds.has(i.id) ? { ...i, ...patch } : i);
    updated.filter(i => selectedIds.has(i.id)).forEach(onUpdate);
    onClear();
  };

  const bulkSnooze = async (days) => {
    setPending(true);
    await Promise.all([...selectedIds].map((id) =>
      snoozeItem({ workspaceId, itemId: id, days })
    ));
    setPending(false);
    onClear();
    // Refresh — trigger parent to reload
    window.location.reload();
  };

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--bg-elev)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '10px 16px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      display: 'flex', alignItems: 'center', gap: 12, zIndex: 200,
    }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{count} ausgewählt</span>
      <button className="btn btn-brand btn-sm" onClick={() => bulkPatch({ status: 'done' })} disabled={pending}>
        <I.check size={12} /> Alle erledigen
      </button>
      <button className="btn btn-ghost btn-sm" onClick={() => bulkSnooze(1)} disabled={pending}>
        💤 Morgen
      </button>
      <button className="btn btn-ghost btn-sm" onClick={() => bulkSnooze(7)} disabled={pending}>
        💤 Nächste Woche
      </button>
      <button className="btn btn-ghost btn-sm" onClick={onClear}><I.x size={11} /></button>
    </div>
  );
}

// ── Quick Add Form ────────────────────────────────────────────────────────

function QuickAdd({ workspaceId, onAdd, onCancel }) {
  const [f, setF] = useState({ title:'', type:'follow_up', priority:'medium', contactName:'', contactEmail:'', company:'', dueDate:'', description:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.title.trim()) return;
    setSaving(true); setError(null);
    const r = await createAssistantItem({
      workspaceId, title: f.title.trim(), type: f.type, priority: f.priority,
      contactName:  f.contactName.trim()  || undefined,
      contactEmail: f.contactEmail.trim() || undefined,
      company:      f.company.trim()      || undefined,
      dueDate:      f.dueDate             || undefined,
      description:  f.description.trim()  || undefined,
    });
    setSaving(false);
    if (!r.ok) { setError(r.error); return; }
    onAdd(r.data);
  };

  return (
    <form onSubmit={submit} className="card card-pad col gap-3" style={{ border: '1px solid var(--brand)' }}>
      <div className="h3">Neues Item</div>
      <input className="input" placeholder="Titel *" value={f.title}
        onChange={(e) => set('title', e.target.value)} autoFocus style={{ fontSize: 13 }} />
      <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <select className="input" value={f.type} onChange={(e) => set('type', e.target.value)} style={{ fontSize: 13 }}>
          {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <select className="input" value={f.priority} onChange={(e) => set('priority', e.target.value)} style={{ fontSize: 13 }}>
          <option value="urgent">🔴 Urgent</option>
          <option value="high">🟠 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">⚪ Low</option>
        </select>
        <input type="date" className="input" value={f.dueDate}
          onChange={(e) => set('dueDate', e.target.value)} style={{ fontSize: 13 }} />
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <input className="input" placeholder="Kontakt" value={f.contactName}
          onChange={(e) => set('contactName', e.target.value)} style={{ fontSize: 13 }} />
        <input className="input" placeholder="Email" value={f.contactEmail}
          onChange={(e) => set('contactEmail', e.target.value)} style={{ fontSize: 13 }} />
        <input className="input" placeholder="Unternehmen" value={f.company}
          onChange={(e) => set('company', e.target.value)} style={{ fontSize: 13 }} />
      </div>
      <textarea className="input" rows={2} placeholder="Notizen (optional)"
        value={f.description} onChange={(e) => set('description', e.target.value)}
        style={{ fontSize: 13, resize: 'vertical' }} />
      {error && <div style={{ fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>}
      <div className="row gap-2">
        <button type="submit" className="btn btn-brand btn-sm" disabled={!f.title.trim() || saving}>
          {saving ? '…' : 'Hinzufügen'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Abbrechen</button>
      </div>
    </form>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────

function DashboardTab({ items, workspaceId, onUpdate, onDelete, onAddNew, selectedIds, onSelect }) {
  // Feature 5: filters
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy,     setSortBy]     = useState('due');

  const filtered = useMemo(() => {
    let r = typeFilter === 'all' ? items : items.filter(i => i.type === typeFilter);
    if (sortBy === 'due')      r = [...r].sort((a, b) => (a.dueDate || 'z') < (b.dueDate || 'z') ? -1 : 1);
    if (sortBy === 'priority') r = [...r].sort((a, b) => { const o = { urgent:0, high:1, medium:2, low:3 }; return (o[a.priority??'low']??3) - (o[b.priority??'low']??3); });
    if (sortBy === 'created')  r = [...r].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return r;
  }, [items, typeFilter, sortBy]);

  const today      = filtered.filter(isDueToday);
  const overdue    = filtered.filter(isOverdue);
  const waiting    = filtered.filter(i => i.status === 'waiting' && !isSnoozed(i));
  const upcoming   = filtered.filter(i => i.status === 'open' && i.dueDate && i.dueDate > TODAY_STR && !isSnoozed(i)).slice(0, 6);
  const snoozed    = filtered.filter(isSnoozed);
  const fabian     = items.filter(i => i.type === 'approval' && isActive(i));
  const missingDoc = items.filter(i => i.type === 'document_request' && isActive(i));
  const appts      = items.filter(i => i.type === 'scheduling' && isActive(i));
  const urgentAll  = items.filter(i => (isOverdue(i) || isDueToday(i)));

  const Section = ({ title, list, empty }) => (
    <div>
      <div className="row between mb-2">
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
        <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{list.length}</span>
      </div>
      {list.length === 0
        ? <div style={{ fontSize: 13, color: 'var(--text-4)', padding: '6px 0', fontStyle: 'italic' }}>{empty}</div>
        : <div className="col gap-2">{list.map(i => <ItemRow key={i.id} item={i} workspaceId={workspaceId} onUpdate={onUpdate} onDelete={onDelete} selected={selectedIds.has(i.id)} onSelect={onSelect} />)}</div>
      }
    </div>
  );

  return (
    <div className="col gap-5">
      {/* KPI cards */}
      <div className="row gap-3 wrap">
        {[
          { l: 'Heute / Überfällig', v: urgentAll.length,   c: urgentAll.length > 0 ? 'var(--danger)' : 'var(--success)', i: '🔴' },
          { l: 'Wartet auf Antwort', v: waiting.length,      c: waiting.length > 0 ? 'var(--warning)' : undefined,         i: '⏳' },
          { l: 'Fehlende Unterlagen',v: missingDoc.length,   c: missingDoc.length > 0 ? 'var(--warning)' : undefined,      i: '📄' },
          { l: 'Termine offen',      v: appts.length,        c: appts.length > 0 ? 'var(--info)' : undefined,              i: '📅' },
          { l: 'Wartet auf Chef',    v: fabian.length,       c: fabian.length > 0 ? '#e8780a' : undefined,                 i: '👔' },
          { l: 'Wiedervorlagen',     v: snoozed.length,      c: undefined,                                                 i: '💤' },
        ].map(({ l, v, c, i }) => (
          <div key={l} className="card card-pad" style={{ flex: '1 1 120px' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: c ?? 'var(--text-1)', letterSpacing: '-0.03em' }}>{v}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{i} {l}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="row gap-2 items-center wrap">
        <div className="row gap-1">
          {[{ id:'all', l:'Alle' }, ...Object.entries(TYPE_META).map(([k,v]) => ({ id:k, l:`${v.icon} ${v.label}` }))].map(({ id, l }) => (
            <button key={id} className={`chip${typeFilter === id ? ' active' : ''}`}
              onClick={() => setTypeFilter(id)} style={{ fontSize: 11.5 }}>{l}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}
          style={{ height: 28, fontSize: 12.5, width: 160 }}>
          <option value="due">Sortierung: Fälligkeit</option>
          <option value="priority">Sortierung: Priorität</option>
          <option value="created">Sortierung: Erstellt</option>
        </select>
      </div>

      {/* Today + overdue */}
      {(today.length > 0 || overdue.length > 0) && (
        <div className="card card-pad">
          <Section title="🔴 Heute + Überfällig"
            list={[...overdue, ...today].filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i)}
            empty="Nichts fällig heute." />
        </div>
      )}

      {/* Waiting on Fabian */}
      {fabian.length > 0 && (
        <div className="card card-pad">
          <Section title="👔 Wartet auf Entscheidung" list={fabian} empty="" />
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card card-pad">
          <Section title="📄 Fehlende Unterlagen" list={missingDoc} empty="Alle Unterlagen vollständig." />
        </div>
        <div className="card card-pad">
          <Section title="📅 Termine koordinieren" list={appts} empty="Keine offenen Termine." />
        </div>
      </div>

      {waiting.length > 0 && (
        <div className="card card-pad">
          <Section title="⏳ Wartet auf Antwort" list={waiting} empty="" />
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="card card-pad">
          <Section title="📋 Demnächst" list={upcoming} empty="" />
        </div>
      )}

      {snoozed.length > 0 && (
        <div className="card card-pad">
          <Section title="💤 Wiedervorlagen" list={snoozed} empty="" />
        </div>
      )}

      {items.filter(isActive).length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-4)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>Alles erledigt!</div>
          <button className="btn btn-brand btn-sm mt-4" onClick={onAddNew}><I.plus size={13} /> Neues Item</button>
        </div>
      )}
    </div>
  );
}

// ── List Tab ──────────────────────────────────────────────────────────────

function ListTab({ items, workspaceId, onUpdate, onDelete, typeFilter, title, emptyMsg, icon, selectedIds, onSelect }) {
  const [statusFilter, setStatusFilter] = useState('active');
  const [search,  setSearch]  = useState('');
  const [sortBy,  setSortBy]  = useState('due');

  const filtered = useMemo(() => {
    let r = typeFilter ? items.filter(i => i.type === typeFilter) : items;
    if (statusFilter === 'active')  r = r.filter(isActive).filter(i => !isSnoozed(i));
    if (statusFilter === 'done')    r = r.filter(i => i.status === 'done');
    if (statusFilter === 'snoozed') r = r.filter(isSnoozed);
    if (statusFilter === 'overdue') r = r.filter(isOverdue);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(i =>
        i.title.toLowerCase().includes(q) ||
        (i.contactName ?? '').toLowerCase().includes(q) ||
        (i.company ?? '').toLowerCase().includes(q) ||
        (i.description ?? '').toLowerCase().includes(q)
      );
    }
    if (sortBy === 'due')      r = [...r].sort((a,b) => (a.dueDate||'z') < (b.dueDate||'z') ? -1 : 1);
    if (sortBy === 'priority') r = [...r].sort((a,b) => { const o={urgent:0,high:1,medium:2,low:3}; return (o[a.priority??'low']??3)-(o[b.priority??'low']??3); });
    if (sortBy === 'created')  r = [...r].sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    return r;
  }, [items, typeFilter, statusFilter, search, sortBy]);

  const base = typeFilter ? items.filter(i => i.type === typeFilter) : items;
  const counts = {
    active:  base.filter(i => isActive(i) && !isSnoozed(i)).length,
    overdue: base.filter(isOverdue).length,
    snoozed: base.filter(isSnoozed).length,
    done:    base.filter(i => i.status === 'done').length,
  };

  return (
    <div className="col gap-4">
      <div className="row gap-2 items-center wrap">
        <input className="input" placeholder="Suchen…" value={search}
          onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 240 }} />
        <div className="row gap-1">
          {[
            { id:'active',  l:`Aktiv ${counts.active}`   },
            { id:'overdue', l:`Überfällig ${counts.overdue}`, c: counts.overdue > 0 ? 'var(--danger)' : undefined },
            { id:'snoozed', l:`Snoozed ${counts.snoozed}` },
            { id:'done',    l:`Erledigt ${counts.done}`   },
          ].map(({ id, l, c }) => (
            <button key={id} className={`chip${statusFilter===id?' active':''}`}
              onClick={() => setStatusFilter(id)}
              style={{ fontSize: 12, color: statusFilter===id ? undefined : c }}>{l}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}
          style={{ height: 28, fontSize: 12, width: 150 }}>
          <option value="due">Fälligkeit</option>
          <option value="priority">Priorität</option>
          <option value="created">Erstellt</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-4)', fontSize:13 }}>
          <div style={{ fontSize:28, marginBottom:8 }}>{icon}</div>
          {emptyMsg}
        </div>
      ) : (
        <div className="col gap-2">
          {filtered.map(i => (
            <ItemRow key={i.id} item={i} workspaceId={workspaceId}
              onUpdate={onUpdate} onDelete={onDelete}
              selected={selectedIds.has(i.id)} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Contacts Tab ──────────────────────────────────────────────────────────

function ContactsTab({ items, workspaceId, onUpdate, onDelete, selectedIds, onSelect }) {
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState(null); // contactKey

  // Derive unique contacts from items
  const contacts = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      if (!item.contactName) return;
      const key = `${item.contactName}||${item.company ?? ''}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          name:    item.contactName,
          email:   item.contactEmail,
          company: item.company,
          items:   [],
        });
      }
      map.get(key).items.push(item);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filtered = search.trim()
    ? contacts.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.company ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : contacts;

  const selectedContact = selected ? contacts.find(c => c.key === selected) : null;

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: '320px 1fr', alignItems: 'start' }}>
      {/* Contact list */}
      <div className="col gap-3">
        <input className="input" placeholder="Kontakt suchen…" value={search}
          onChange={(e) => setSearch(e.target.value)} />
        {filtered.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-4)', padding: '16px 0', fontStyle: 'italic' }}>
            {contacts.length === 0 ? 'Noch keine Kontakte. Füge Kontaktinfos zu Assistant Items hinzu.' : 'Keine Treffer.'}
          </div>
        ) : (
          <div className="col gap-2">
            {filtered.map((c) => {
              const openCount = c.items.filter(isActive).length;
              return (
                <div key={c.key}
                  onClick={() => setSelected(selected === c.key ? null : c.key)}
                  style={{
                    padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${selected === c.key ? 'var(--brand)' : 'var(--border-soft)'}`,
                    background: selected === c.key ? 'var(--brand-soft)' : 'var(--bg-card)',
                  }}>
                  <div className="row between items-center">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name}</div>
                      {c.company && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{c.company}</div>}
                    </div>
                    <div className="row gap-2 items-center">
                      {openCount > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', background: 'var(--brand-soft)', padding: '2px 7px', borderRadius: 10 }}>
                          {openCount} offen
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{c.items.length} gesamt</span>
                    </div>
                  </div>
                  {c.email && (
                    <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()}
                      style={{ fontSize: 12, color: 'var(--brand)', marginTop: 4, display: 'block' }}>
                      ✉️ {c.email}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Contact detail */}
      <div>
        {selectedContact ? (
          <div className="col gap-3">
            <div className="card card-pad">
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selectedContact.name}</div>
              {selectedContact.company && <div style={{ fontSize: 13.5, color: 'var(--text-2)', marginBottom: 8 }}>{selectedContact.company}</div>}
              {selectedContact.email && (
                <a href={`mailto:${selectedContact.email}`} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
                  ✉️ Email schreiben
                </a>
              )}
            </div>
            <div className="h3">Verknüpfte Items ({selectedContact.items.length})</div>
            <div className="col gap-2">
              {selectedContact.items.map(i => (
                <ItemRow key={i.id} item={i} workspaceId={workspaceId}
                  onUpdate={onUpdate} onDelete={onDelete}
                  selected={selectedIds.has(i.id)} onSelect={onSelect} />
              ))}
            </div>
          </div>
        ) : (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>👤</div>
            Kontakt auswählen um alle verknüpften Items zu sehen.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────

export function AssistantHubScreen({ setRoute }) {
  const { currentWorkspace: brand, currentWorkspaceId, data, myRole } = useWorkspace();
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('dashboard');
  const [adding,  setAdding]  = useState(false);

  // Feature 6: bulk selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  const onSelect = (id) => setSelectedIds((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  useEffect(() => {
    if (!currentWorkspaceId) return;
    listAssistantItems(currentWorkspaceId).then((d) => { setItems(d); setLoading(false); });
  }, [currentWorkspaceId]);

  const onAdd    = (item)    => { setItems((p) => [item, ...p]); setAdding(false); };
  const onUpdate = (updated) => setItems((p) => p.map((i) => i.id === updated.id ? updated : i));
  const onDelete = (id)      => { setItems((p) => p.filter((i) => i.id !== id)); setSelectedIds((s) => { const n=new Set(s); n.delete(id); return n; }); };

  const openCount   = items.filter(i => isActive(i) && !isSnoozed(i)).length;
  const urgentCount = items.filter(i => isOverdue(i) || isDueToday(i)).length;

  const tabs = [
    { id: 'dashboard', label: 'Übersicht',   icon: '🏠' },
    { id: 'followups', label: 'Follow-ups',  icon: '📩', count: items.filter(i=>i.type==='follow_up'&&isActive(i)).length },
    { id: 'documents', label: 'Unterlagen',  icon: '📄', count: items.filter(i=>i.type==='document_request'&&isActive(i)).length },
    { id: 'scheduling',label: 'Termine',     icon: '📅', count: items.filter(i=>i.type==='scheduling'&&isActive(i)).length },
    { id: 'approvals', label: 'Freigaben',   icon: '✅', count: items.filter(i=>i.type==='approval'&&isActive(i)).length },
    { id: 'contacts',  label: 'Kontakte',    icon: '👤', count: [...new Set(items.filter(i=>i.contactName).map(i=>i.contactName))].length },
    { id: 'all',       label: 'Alle',        icon: '📋' },
  ];

  const sharedProps = { workspaceId: currentWorkspaceId, onUpdate, onDelete, selectedIds, onSelect };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2">
            <Badge kind="brand" dot>{brand?.name}</Badge>
            <span style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--brand-soft)' }}>Assistenz</span>
          </div>
          <h1 className="h1" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>🗂 Assistant Hub</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            {urgentCount > 0
              ? <span style={{ color: 'var(--danger)', fontWeight: 600 }}>⚠️ {urgentCount} dringend heute</span>
              : `${openCount} offene Items`}
            {' · '}Follow-ups · Termine · Unterlagen
          </p>
        </div>
        <button className="btn btn-brand btn-sm" onClick={() => setAdding(true)}>
          <I.plus size={13} /> Neues Item
        </button>
      </div>

      {adding && (
        <div className="mb-4">
          <QuickAdd workspaceId={currentWorkspaceId} onAdd={onAdd} onCancel={() => setAdding(false)} />
        </div>
      )}

      <div className="tabs mb-4" style={{ flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="row gap-1">{t.icon} {t.label}{t.count > 0 && <span className="count">{t.count}</span>}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Wird geladen…</div>
      ) : (
        <>
          {tab === 'dashboard'  && <DashboardTab  items={items} {...sharedProps} onAddNew={() => setAdding(true)} />}
          {tab === 'followups'  && <ListTab items={items} {...sharedProps} typeFilter="follow_up"        title="Follow-ups"  emptyMsg="Keine offenen Follow-ups."        icon="📩" />}
          {tab === 'documents'  && <ListTab items={items} {...sharedProps} typeFilter="document_request" title="Unterlagen"  emptyMsg="Keine fehlenden Unterlagen."      icon="📄" />}
          {tab === 'scheduling' && <ListTab items={items} {...sharedProps} typeFilter="scheduling"       title="Termine"     emptyMsg="Keine Termine zu koordinieren."   icon="📅" />}
          {tab === 'approvals'  && <ListTab items={items} {...sharedProps} typeFilter="approval"         title="Freigaben"   emptyMsg="Keine offenen Freigaben."         icon="✅" />}
          {tab === 'contacts'   && <ContactsTab items={items} {...sharedProps} />}
          {tab === 'all'        && <ListTab items={items} {...sharedProps} typeFilter={null}             title="Alle Items"  emptyMsg="Noch keine Assistant-Items."      icon="📋" />}
        </>
      )}

      {selectedIds.size > 0 && (
        <BulkBar count={selectedIds.size} workspaceId={currentWorkspaceId}
          selectedIds={selectedIds} items={items} onUpdate={onUpdate}
          onClear={() => setSelectedIds(new Set())} />
      )}
    </div>
  );
}
