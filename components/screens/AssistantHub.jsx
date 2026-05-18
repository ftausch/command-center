'use client';
// Assistant Hub — dedicated PA / personal assistant workspace.
// Tabs: Dashboard · Follow-ups · Dokumente · Termine · Wiedervorlagen

import { useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Badge, PriorityBadge } from '@/components/ui';
import { dueLabel, timeAgo } from '@/lib/utils';
import {
  listAssistantItems,
  createAssistantItem,
  updateAssistantItem,
  deleteAssistantItem,
  snoozeItem,
} from '@/lib/actions/assistant';

// ── Constants ─────────────────────────────────────────────────────────────

const TYPE_META = {
  follow_up:        { label: 'Follow-up',      icon: '📩', color: 'var(--info)'    },
  scheduling:       { label: 'Termin',         icon: '📅', color: 'var(--brand)'   },
  document_request: { label: 'Dokument',       icon: '📄', color: 'var(--warning)' },
  approval:         { label: 'Freigabe',       icon: '✅', color: 'var(--success)' },
  reminder:         { label: 'Erinnerung',     icon: '🔔', color: '#e8780a'        },
  other:            { label: 'Sonstiges',      icon: '📌', color: 'var(--text-3)'  },
};

const STATUS_META = {
  open:      { label: 'Offen',          color: 'var(--info)'    },
  waiting:   { label: 'Wartet',         color: 'var(--warning)' },
  done:      { label: 'Erledigt',       color: 'var(--success)' },
  escalated: { label: 'Eskaliert',      color: 'var(--danger)'  },
  cancelled: { label: 'Abgebrochen',    color: 'var(--text-4)'  },
};

const PRIORITY_COLOR = { urgent: 'var(--danger)', high: 'var(--warning)', medium: 'var(--info)', low: 'var(--text-3)' };

const TODAY_STR = new Date().toISOString().slice(0, 10);

function isOverdue(item) {
  return item.dueDate && item.dueDate < TODAY_STR && item.status !== 'done' && item.status !== 'cancelled';
}
function isDueToday(item) {
  return item.dueDate === TODAY_STR && item.status !== 'done' && item.status !== 'cancelled';
}
function isSnoozed(item) {
  return item.snoozedUntil && item.snoozedUntil > new Date().toISOString();
}

// ── Quick Add Form ────────────────────────────────────────────────────────

function QuickAdd({ workspaceId, members, onAdd, onCancel }) {
  const [title,   setTitle]   = useState('');
  const [type,    setType]    = useState('follow_up');
  const [contact, setContact] = useState('');
  const [company, setCompany] = useState('');
  const [due,     setDue]     = useState('');
  const [prio,    setPrio]    = useState('medium');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true); setError(null);
    const r = await createAssistantItem({
      workspaceId, title: title.trim(), type, priority: prio,
      contactName: contact.trim() || undefined,
      company: company.trim() || undefined,
      dueDate: due || undefined,
    });
    setSaving(false);
    if (!r.ok) { setError(r.error); return; }
    onAdd(r.data);
  };

  return (
    <form onSubmit={submit} className="card card-pad col gap-3" style={{ border: '1px solid var(--brand)' }}>
      <div className="h3">Neues Item</div>
      <input className="input" placeholder="Titel *" value={title}
        onChange={(e) => setTitle(e.target.value)} autoFocus style={{ fontSize: 13 }} />
      <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)} style={{ fontSize: 13 }}>
          {Object.entries(TYPE_META).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
        <select className="input" value={prio} onChange={(e) => setPrio(e.target.value)} style={{ fontSize: 13 }}>
          <option value="urgent">🔴 Urgent</option>
          <option value="high">🟠 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">⚪ Low</option>
        </select>
        <input type="date" className="input" value={due}
          onChange={(e) => setDue(e.target.value)} style={{ fontSize: 13 }} />
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <input className="input" placeholder="Kontakt / Ansprechpartner" value={contact}
          onChange={(e) => setContact(e.target.value)} style={{ fontSize: 13 }} />
        <input className="input" placeholder="Unternehmen" value={company}
          onChange={(e) => setCompany(e.target.value)} style={{ fontSize: 13 }} />
      </div>
      {error && <div style={{ fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>}
      <div className="row gap-2">
        <button type="submit" className="btn btn-brand btn-sm" disabled={!title.trim() || saving}>
          {saving ? '…' : 'Hinzufügen'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Abbrechen</button>
      </div>
    </form>
  );
}

// ── Item Row ──────────────────────────────────────────────────────────────

function ItemRow({ item, workspaceId, onUpdate, onDelete, members }) {
  const [pending, setPending] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);

  const typeMeta = TYPE_META[item.type] ?? TYPE_META.other;
  const due = item.dueDate ? dueLabel(item.dueDate) : null;
  const overdue = isOverdue(item);
  const snoozed = isSnoozed(item);

  const patch = async (p) => {
    setPending('patch');
    const r = await updateAssistantItem({ workspaceId, itemId: item.id, patch: p });
    setPending(null);
    if (r.ok && r.data) onUpdate(r.data);
  };

  const markDone = () => patch({ status: 'done' });

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
    <div style={{
      borderRadius: 8, border: `1px solid ${overdue ? 'var(--danger-border)' : 'var(--border-soft)'}`,
      background: overdue ? 'var(--danger-bg)' : snoozed ? 'var(--bg-sunk)' : 'var(--bg-card)',
      opacity: item.status === 'done' ? 0.55 : pending ? 0.7 : 1,
      transition: 'opacity 0.15s',
    }}>
      <div className="row gap-3 items-start" style={{ padding: '10px 12px', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}>
        {/* Type icon */}
        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{typeMeta.icon}</span>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row gap-2 items-center mb-1">
            <span style={{
              fontSize: 13.5, fontWeight: 600,
              textDecoration: item.status === 'done' ? 'line-through' : 'none',
              color: item.status === 'done' ? 'var(--text-3)' : 'var(--text-1)',
            }}>{item.title}</span>
            {item.priority === 'urgent' && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '1px 6px', borderRadius: 10 }}>URGENT</span>}
            {snoozed && <span style={{ fontSize: 10.5, color: 'var(--text-4)' }}>💤 Snoozed</span>}
          </div>
          <div className="row gap-3" style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {item.contactName && <span>👤 {item.contactName}{item.company ? ` · ${item.company}` : ''}</span>}
            {due && (
              <span style={{ color: due.danger ? 'var(--danger)' : due.today ? 'var(--warning)' : 'var(--text-3)', fontWeight: due.danger || due.today ? 600 : 400 }}>
                📅 {due.text}
              </span>
            )}
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 10,
              background: 'var(--bg-sunk)', color: typeMeta.color,
            }}>{typeMeta.label}</span>
          </div>
        </div>

        {/* Status + actions */}
        <div className="row gap-2 items-center" onClick={(e) => e.stopPropagation()}>
          <select
            className="input"
            value={item.status}
            onChange={(e) => patch({ status: e.target.value })}
            disabled={!!pending}
            style={{ height: 26, fontSize: 12, padding: '0 6px', width: 110,
              color: STATUS_META[item.status]?.color ?? 'var(--text-3)' }}
          >
            {Object.entries(STATUS_META).filter(([k]) => k !== 'cancelled').map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          {item.status !== 'done' && (
            <button className="btn btn-quiet btn-icon" style={{ width: 28, height: 28 }}
              onClick={markDone} disabled={!!pending} title="Erledigt">
              <I.check size={13} />
            </button>
          )}
          <button className="btn btn-quiet btn-icon" style={{ width: 28, height: 28 }}
            onClick={() => setShowSnooze(!showSnooze)} disabled={!!pending} title="Snoosen">
            ⏰
          </button>
          <I.chevronDown size={12} style={{ color: 'var(--text-3)', transform: expanded ? 'rotate(180deg)' : '', transition: '0.15s', flexShrink: 0 }} />
        </div>
      </div>

      {/* Snooze panel */}
      {showSnooze && (
        <div className="row gap-2" style={{ padding: '0 12px 10px', flexWrap: 'wrap' }}
          onClick={(e) => e.stopPropagation()}>
          <span style={{ fontSize: 12, color: 'var(--text-3)', alignSelf: 'center' }}>Wiedervorlage:</span>
          {[
            { label: 'Morgen',       days: 1  },
            { label: '3 Tage',       days: 3  },
            { label: 'Nächste Woche',days: 7  },
            { label: '2 Wochen',     days: 14 },
          ].map(({ label, days }) => (
            <button key={days} className="btn btn-ghost btn-sm"
              onClick={() => snooze(days)} disabled={!!pending} style={{ fontSize: 12 }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-soft)', padding: '10px 12px' }}
          onClick={(e) => e.stopPropagation()}>
          {item.description && (
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10, lineHeight: 1.5 }}>
              {item.description}
            </div>
          )}
          {item.contactEmail && (
            <div style={{ fontSize: 12.5, marginBottom: 8 }}>
              <a href={`mailto:${item.contactEmail}`} style={{ color: 'var(--brand)' }}>
                ✉️ {item.contactEmail}
              </a>
            </div>
          )}
          <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>
            Angelegt {timeAgo(item.createdAt)}
          </div>
          <button className="btn btn-ghost btn-sm mt-2" style={{ color: 'var(--danger)', fontSize: 12 }}
            onClick={remove} disabled={!!pending}>
            <I.x size={11} /> Löschen
          </button>
        </div>
      )}
    </div>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────

function DashboardTab({ items, workspaceId, members, onUpdate, onDelete, onAddNew }) {
  const today    = items.filter(isDueToday);
  const overdue  = items.filter(isOverdue);
  const waiting  = items.filter((i) => i.status === 'waiting' && !isSnoozed(i));
  const upcoming = items.filter((i) =>
    i.status === 'open' && i.dueDate && i.dueDate > TODAY_STR && !isSnoozed(i)
  ).slice(0, 5);
  const snoozed  = items.filter(isSnoozed);

  // "Waiting on Fabian" = approval items open/waiting
  const waitingFabian = items.filter((i) => i.type === 'approval' && i.status !== 'done' && i.status !== 'cancelled');
  const missingDocs   = items.filter((i) => i.type === 'document_request' && i.status !== 'done' && i.status !== 'cancelled');
  const appointments  = items.filter((i) => i.type === 'scheduling' && i.status !== 'done' && i.status !== 'cancelled');

  const StatCard = ({ label, value, color, icon, onClick }) => (
    <div className="card card-pad" style={{ flex: '1 1 140px', cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div style={{ fontSize: 26, fontWeight: 700, color: color ?? 'var(--text-1)', letterSpacing: '-0.03em' }}>{value}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>{icon} {label}</div>
    </div>
  );

  const Section = ({ title, items: list, emptyMsg }) => (
    <div>
      <div className="row between mb-2">
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 11 }}>{title}</div>
        <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{list.length}</span>
      </div>
      {list.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-4)', padding: '10px 0', fontStyle: 'italic' }}>{emptyMsg}</div>
      ) : (
        <div className="col gap-2">
          {list.map((item) => (
            <ItemRow key={item.id} item={item} workspaceId={workspaceId} members={members}
              onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="col gap-5">
      {/* KPI cards */}
      <div className="row gap-3 wrap">
        <StatCard label="Fällig heute"     value={today.length}        color={today.length > 0 ? 'var(--danger)' : 'var(--success)'} icon="🔴" />
        <StatCard label="Überfällig"       value={overdue.length}      color={overdue.length > 0 ? 'var(--danger)' : undefined}      icon="⚠️" />
        <StatCard label="Wartet auf Antwort" value={waiting.length}    color={waiting.length > 0 ? 'var(--warning)' : undefined}     icon="⏳" />
        <StatCard label="Fehlende Docs"    value={missingDocs.length}  color={missingDocs.length > 0 ? 'var(--warning)' : undefined}  icon="📄" />
        <StatCard label="Termine offen"    value={appointments.length} color={appointments.length > 0 ? 'var(--info)' : undefined}    icon="📅" />
        <StatCard label="Wartet auf Chef"  value={waitingFabian.length} color={waitingFabian.length > 0 ? '#e8780a' : undefined}     icon="👔" />
      </div>

      {/* Today */}
      {(today.length > 0 || overdue.length > 0) && (
        <div className="card card-pad">
          <Section title="🔴 Heute fällig + Überfällig" items={[...overdue, ...today].filter((v,i,a) => a.findIndex(x=>x.id===v.id)===i)}
            emptyMsg="Nichts fällig heute." />
        </div>
      )}

      {/* Waiting for Fabian */}
      {waitingFabian.length > 0 && (
        <div className="card card-pad">
          <Section title="👔 Wartet auf Entscheidung / Chef" items={waitingFabian}
            emptyMsg="Nichts wartet auf eine Entscheidung." />
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Missing docs */}
        <div className="card card-pad">
          <Section title="📄 Fehlende Unterlagen" items={missingDocs}
            emptyMsg="Alle Unterlagen vollständig." />
        </div>
        {/* Appointments */}
        <div className="card card-pad">
          <Section title="📅 Termine zu koordinieren" items={appointments}
            emptyMsg="Keine offenen Terminanfragen." />
        </div>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="card card-pad">
          <Section title="📋 Demnächst" items={upcoming}
            emptyMsg="Keine anstehenden Items." />
        </div>
      )}

      {/* Snoozed */}
      {snoozed.length > 0 && (
        <div className="card card-pad">
          <Section title="💤 Wiedervorlagen" items={snoozed}
            emptyMsg="Keine Wiedervorlagen." />
        </div>
      )}

      {today.length === 0 && overdue.length === 0 && waiting.length === 0 && items.filter(i=>i.status==='open').length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-4)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>Alles erledigt!</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Keine offenen Assistant-Items.</div>
          <button className="btn btn-brand btn-sm mt-4" onClick={onAddNew}>
            <I.plus size={13} /> Neues Item anlegen
          </button>
        </div>
      )}
    </div>
  );
}

// ── List Tab (generic filterable list) ───────────────────────────────────

function ListTab({ items, workspaceId, members, onUpdate, onDelete, typeFilter, title, emptyMsg, icon }) {
  const [statusFilter, setStatusFilter] = useState('active');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let r = typeFilter ? items.filter((i) => i.type === typeFilter) : items;
    if (statusFilter === 'active')   r = r.filter((i) => i.status === 'open' || i.status === 'waiting' || i.status === 'escalated');
    if (statusFilter === 'done')     r = r.filter((i) => i.status === 'done');
    if (statusFilter === 'snoozed')  r = r.filter(isSnoozed);
    if (statusFilter === 'overdue')  r = r.filter(isOverdue);
    if (search.trim()) r = r.filter((i) =>
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      (i.contactName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (i.company ?? '').toLowerCase().includes(search.toLowerCase())
    );
    return r;
  }, [items, typeFilter, statusFilter, search]);

  const counts = {
    active:  (typeFilter ? items.filter(i=>i.type===typeFilter) : items).filter(i=>i.status==='open'||i.status==='waiting'||i.status==='escalated').length,
    overdue: (typeFilter ? items.filter(i=>i.type===typeFilter) : items).filter(isOverdue).length,
    snoozed: (typeFilter ? items.filter(i=>i.type===typeFilter) : items).filter(isSnoozed).length,
    done:    (typeFilter ? items.filter(i=>i.type===typeFilter) : items).filter(i=>i.status==='done').length,
  };

  return (
    <div className="col gap-4">
      <div className="row gap-3 items-center wrap">
        <input className="input" placeholder={`${title} suchen…`} value={search}
          onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
        <div className="row gap-1">
          {[
            { id: 'active',  label: `Aktiv ${counts.active}`   },
            { id: 'overdue', label: `Überfällig ${counts.overdue}`, color: counts.overdue > 0 ? 'var(--danger)' : undefined },
            { id: 'snoozed', label: `Snoozed ${counts.snoozed}` },
            { id: 'done',    label: `Erledigt ${counts.done}`   },
          ].map(({ id, label, color }) => (
            <button key={id} className={`chip${statusFilter === id ? ' active' : ''}`}
              onClick={() => setStatusFilter(id)}
              style={{ fontSize: 12, color: statusFilter === id ? undefined : color }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-4)', fontSize: 13 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
          {emptyMsg}
        </div>
      ) : (
        <div className="col gap-2">
          {filtered.map((item) => (
            <ItemRow key={item.id} item={item} workspaceId={workspaceId}
              members={members} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────

export function AssistantHubScreen({ setRoute }) {
  const { currentWorkspace: brand, currentWorkspaceId, data, myRole } = useWorkspace();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('dashboard');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!currentWorkspaceId) return;
    listAssistantItems(currentWorkspaceId).then((d) => { setItems(d); setLoading(false); });
  }, [currentWorkspaceId]);

  const onAdd = (item) => { setItems((prev) => [item, ...prev]); setAdding(false); };
  const onUpdate = (updated) => setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i));
  const onDelete = (id) => setItems((prev) => prev.filter((i) => i.id !== id));

  const members = data.members ?? [];

  const openCount = items.filter((i) => (i.status === 'open' || i.status === 'waiting') && !isSnoozed(i) && !isOverdue(i)).length;
  const urgentCount = items.filter((i) => (isOverdue(i) || isDueToday(i))).length;

  const tabs = [
    { id: 'dashboard', label: 'Übersicht',    icon: '🏠' },
    { id: 'followups', label: 'Follow-ups',   icon: '📩', count: items.filter(i=>i.type==='follow_up'&&i.status!=='done'&&i.status!=='cancelled').length },
    { id: 'documents', label: 'Unterlagen',   icon: '📄', count: items.filter(i=>i.type==='document_request'&&i.status!=='done'&&i.status!=='cancelled').length },
    { id: 'scheduling',label: 'Termine',      icon: '📅', count: items.filter(i=>i.type==='scheduling'&&i.status!=='done'&&i.status!=='cancelled').length },
    { id: 'approvals', label: 'Freigaben',    icon: '✅', count: items.filter(i=>i.type==='approval'&&i.status!=='done'&&i.status!=='cancelled').length },
    { id: 'all',       label: 'Alle Items',   icon: '📋' },
  ];

  return (
    <div className="page fade-in">
      {/* Header */}
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2">
            <Badge kind="brand" dot>{brand?.name}</Badge>
            <span style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--brand-soft)' }}>Assistenz</span>
          </div>
          <h1 className="h1" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            🗂 Assistant Hub
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            {urgentCount > 0
              ? <span style={{ color: 'var(--danger)', fontWeight: 600 }}>⚠️ {urgentCount} dringend heute</span>
              : `${openCount} offene Items`
            } · Follow-ups · Termine · Unterlagen
          </p>
        </div>
        <button className="btn btn-brand btn-sm" onClick={() => setAdding(true)}>
          <I.plus size={13} /> Neues Item
        </button>
      </div>

      {/* Quick add */}
      {adding && (
        <div className="mb-4">
          <QuickAdd workspaceId={currentWorkspaceId} members={members}
            onAdd={onAdd} onCancel={() => setAdding(false)} />
        </div>
      )}

      {/* Tabs */}
      <div className="tabs mb-4">
        {tabs.map((t) => (
          <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="row gap-1">
              {t.icon} {t.label}
              {t.count > 0 && <span className="count">{t.count}</span>}
            </span>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
          Wird geladen…
        </div>
      ) : (
        <>
          {tab === 'dashboard'  && <DashboardTab items={items} workspaceId={currentWorkspaceId} members={members} onUpdate={onUpdate} onDelete={onDelete} onAddNew={() => setAdding(true)} />}
          {tab === 'followups'  && <ListTab items={items} workspaceId={currentWorkspaceId} members={members} onUpdate={onUpdate} onDelete={onDelete} typeFilter="follow_up"        title="Follow-ups"  emptyMsg="Keine offenen Follow-ups."           icon="📩" />}
          {tab === 'documents'  && <ListTab items={items} workspaceId={currentWorkspaceId} members={members} onUpdate={onUpdate} onDelete={onDelete} typeFilter="document_request" title="Unterlagen"  emptyMsg="Keine fehlenden Unterlagen."         icon="📄" />}
          {tab === 'scheduling' && <ListTab items={items} workspaceId={currentWorkspaceId} members={members} onUpdate={onUpdate} onDelete={onDelete} typeFilter="scheduling"       title="Termine"     emptyMsg="Keine Termine zu koordinieren."      icon="📅" />}
          {tab === 'approvals'  && <ListTab items={items} workspaceId={currentWorkspaceId} members={members} onUpdate={onUpdate} onDelete={onDelete} typeFilter="approval"         title="Freigaben"   emptyMsg="Keine offenen Freigaben."            icon="✅" />}
          {tab === 'all'        && <ListTab items={items} workspaceId={currentWorkspaceId} members={members} onUpdate={onUpdate} onDelete={onDelete} typeFilter={null}             title="Alle Items"  emptyMsg="Noch keine Assistant-Items angelegt." icon="📋" />}
        </>
      )}
    </div>
  );
}
