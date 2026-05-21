'use client';
// Event Operations UI — Run-of-Show, Attendees, Partners/Sponsors, Resources, Recap.
// Used as tabs inside ProjectDetailScreen for division=events projects.

import { useEffect, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { Avatar, Badge, StatusBadge } from '@/components/ui';
import { I } from '@/components/icons';
import {
  listAgendaItems, createAgendaItem, updateAgendaItem, deleteAgendaItem,
  listAttendees, createAttendee, updateAttendee, deleteAttendee,
  listEventPartners, createEventPartner, updateEventPartner, deleteEventPartner,
  listApprovals, createApproval, updateApproval, deleteApproval,
  listDecisions, createDecision, deleteDecision,
} from '@/lib/actions/event-ops';
import { syncLumaGuests, getLumaRsvpCount } from '@/lib/actions/luma';
import { updateProject, addProjectResource, deleteProjectResource } from '@/lib/actions/projects';
import { CAN } from '@/lib/roles';

// ── Shared helpers ────────────────────────────────────────────────────────

function EmptyOps({ icon, title, desc, onAdd, canEdit, addLabel }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 24px', color: 'var(--text-3)' }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, marginBottom: canEdit ? 16 : 0 }}>{desc}</div>
      {canEdit && onAdd && (
        <button className="btn btn-brand btn-sm" onClick={onAdd} style={{ margin: '0 auto' }}>
          <I.plus size={13} /> {addLabel}
        </button>
      )}
    </div>
  );
}

const STATUS_COLORS = {
  // agenda
  planned: 'var(--text-3)', active: '#e8780a', done: 'var(--success)', skipped: 'var(--text-4)',
  // attendee
  invited: 'var(--info)', confirmed: 'var(--success)', checked_in: '#10b981',
  no_show: 'var(--danger)', cancelled: 'var(--text-4)',
  // partner
  lead: 'var(--text-3)', contacted: 'var(--info)', call_scheduled: 'var(--info)',
  offer_sent: '#f59e0b', 'confirmed': 'var(--success)', active: 'var(--success)',
  recap_sent: '#712edd', closed: 'var(--text-4)',
};

const STATUS_LABEL = {
  planned: 'Geplant', active: 'Aktiv', done: 'Erledigt', skipped: 'Übersprungen',
  invited: 'Eingeladen', confirmed: 'Bestätigt', checked_in: 'Eingecheckt',
  no_show: 'Nicht erschienen', cancelled: 'Abgesagt',
  lead: 'Lead', contacted: 'Kontaktiert', call_scheduled: 'Call geplant',
  offer_sent: 'Angebot gesendet', active: 'Aktiv', recap_sent: 'Recap gesendet', closed: 'Abgeschlossen',
};

function StatusPill({ status }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      background: 'var(--bg-sunk)', color: STATUS_COLORS[status] ?? 'var(--text-3)',
    }}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ── A) Run-of-Show ─────────────────────────────────────────────────────────

export function RunOfShow({ projectId, workspaceId, canEdit }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [pending, setPending] = useState(null);
  const [draft, setDraft]     = useState({ timeLabel: '', title: '', description: '', location: '' });
  const [editId, setEditId]   = useState(null);
  const [editDraft, setEditDraft] = useState({});

  useEffect(() => {
    listAgendaItems(workspaceId, projectId).then((d) => { setItems(d); setLoading(false); });
  }, [projectId, workspaceId]);

  const onAdd = async () => {
    if (!draft.title.trim()) return;
    setPending('add');
    const r = await createAgendaItem({
      workspaceId, projectId,
      timeLabel: draft.timeLabel,
      title: draft.title.trim(),
      description: draft.description || undefined,
      location: draft.location || undefined,
      sortOrder: items.length,
    });
    setPending(null);
    if (r.ok && r.data) {
      setItems((prev) => [...prev, r.data]);
      setDraft({ timeLabel: '', title: '', description: '', location: '' });
      setAdding(false);
    }
  };

  const onStatusChange = async (item, status) => {
    const r = await updateAgendaItem({ workspaceId, itemId: item.id, patch: { status } });
    if (r.ok && r.data) setItems((prev) => prev.map((i) => i.id === item.id ? r.data : i));
  };

  const onDelete = async (itemId) => {
    setPending(itemId);
    const r = await deleteAgendaItem({ workspaceId, itemId });
    setPending(null);
    if (r.ok) setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const onEditSave = async (item) => {
    setPending(item.id + '-save');
    const r = await updateAgendaItem({ workspaceId, itemId: item.id, patch: editDraft });
    setPending(null);
    if (r.ok && r.data) { setItems((prev) => prev.map((i) => i.id === item.id ? r.data : i)); setEditId(null); }
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--text-3)', fontSize: 13 }}>Wird geladen…</div>;

  return (
    <div>
      <div className="row between mb-3">
        <div className="h3">Ablaufplan</div>
        <div className="row gap-2">
          {items.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => window.print()} title="Drucken">
              🖨️ Drucken
            </button>
          )}
          {canEdit && !adding && (
            <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
              <I.plus size={13} /> Punkt hinzufügen
            </button>
          )}
        </div>
      </div>

      {items.length === 0 && !adding && (
        <EmptyOps
          icon="📋"
          title="Noch kein Ablaufplan"
          desc="Füge Zeitslots und Programmpunkte hinzu — z.B. Einlass, Begrüßung, Panel, Networking."
          onAdd={() => setAdding(true)}
          canEdit={canEdit}
          addLabel="Ersten Punkt hinzufügen"
        />
      )}

      {/* Add form */}
      {adding && (
        <div className="card card-pad mb-3" style={{ background: 'var(--bg-sunk)' }}>
          <div className="grid gap-2" style={{ gridTemplateColumns: '100px 1fr', marginBottom: 8 }}>
            <input className="input" placeholder="18:00" value={draft.timeLabel}
              onChange={(e) => setDraft({ ...draft, timeLabel: e.target.value })}
              style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}
            />
            <input className="input" placeholder="Titel des Programmpunkts *" value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && onAdd()}
              autoFocus style={{ fontSize: 13 }}
            />
          </div>
          <input className="input mb-2" placeholder="Beschreibung (optional)" value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            style={{ fontSize: 12.5 }}
          />
          <input className="input mb-3" placeholder="Ort / Stage (optional)" value={draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            style={{ fontSize: 12.5 }}
          />
          <div className="row gap-2">
            <button className="btn btn-brand btn-sm" onClick={onAdd} disabled={!draft.title.trim() || pending === 'add'}>
              {pending === 'add' ? '…' : 'Hinzufügen'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="col gap-0">
        {items.map((item, idx) => (
          <div key={item.id} style={{
            display: 'flex', gap: 12, alignItems: 'flex-start',
            padding: '10px 0',
            borderBottom: idx < items.length - 1 ? '1px solid var(--border-soft)' : 'none',
          }}>
            {/* Time */}
            <div style={{
              minWidth: 52, fontFamily: 'var(--font-mono)', fontSize: 13,
              fontWeight: 700, color: item.status === 'done' ? 'var(--text-4)' : '#e8780a',
              marginTop: 2,
            }}>
              {item.timeLabel || '—'}
            </div>

            {/* Content */}
            {editId === item.id ? (
              <div style={{ flex: 1 }} className="col gap-2">
                <div className="grid gap-2" style={{ gridTemplateColumns: '100px 1fr' }}>
                  <input className="input" value={editDraft.timeLabel ?? item.timeLabel}
                    onChange={(e) => setEditDraft({ ...editDraft, timeLabel: e.target.value })}
                    style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}
                  />
                  <input className="input" value={editDraft.title ?? item.title}
                    onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                    style={{ fontSize: 13 }}
                  />
                </div>
                <input className="input" placeholder="Beschreibung" value={editDraft.description ?? item.description ?? ''}
                  onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                  style={{ fontSize: 12.5 }}
                />
                <div className="row gap-2">
                  <button className="btn btn-brand btn-sm" onClick={() => onEditSave(item)} disabled={pending === item.id + '-save'}>
                    {pending === item.id + '-save' ? '…' : 'Speichern'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>Abbrechen</button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1 }}>
                <div className="row gap-2 items-center mb-1">
                  <span style={{
                    fontSize: 13.5, fontWeight: 600,
                    textDecoration: item.status === 'done' ? 'line-through' : 'none',
                    color: item.status === 'done' ? 'var(--text-4)' : 'var(--text-1)',
                  }}>
                    {item.title}
                  </span>
                  <StatusPill status={item.status} />
                </div>
                {item.description && <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 2 }}>{item.description}</div>}
                {item.location && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>📍 {item.location}</div>}
              </div>
            )}

            {/* Actions */}
            {canEdit && editId !== item.id && (
              <div className="row gap-1">
                {item.status !== 'done' && (
                  <button className="btn btn-quiet btn-icon" style={{ width: 26, height: 26 }}
                    onClick={() => onStatusChange(item, item.status === 'active' ? 'done' : 'active')}
                    title={item.status === 'active' ? 'Als erledigt markieren' : 'Aktivieren'}
                  >
                    <I.check size={12} />
                  </button>
                )}
                <button className="btn btn-quiet btn-icon" style={{ width: 26, height: 26 }}
                  onClick={() => { setEditId(item.id); setEditDraft({}); }}
                  title="Bearbeiten"
                >
                  <I.edit size={12} />
                </button>
                <button className="btn btn-quiet btn-icon" style={{ width: 26, height: 26, color: 'var(--text-4)' }}
                  onClick={() => onDelete(item.id)}
                  disabled={pending === item.id}
                  title="Löschen"
                >
                  <I.x size={11} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── B) Attendees ──────────────────────────────────────────────────────────

const ATTENDEE_ROLES = ['attendee','speaker','vip','partner_guest','team'];
const ATTENDEE_STATUSES = ['invited','confirmed','checked_in','no_show','cancelled'];
const ROLE_LABELS = { attendee: 'Teilnehmer', speaker: 'Speaker', vip: 'VIP', partner_guest: 'Partner-Gast', team: 'Team' };

export function AttendeeList({ projectId, workspaceId, canEdit, lumaUrl }) {
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);
  const [pending, setPending]     = useState(null);
  const [draft, setDraft]         = useState({ name: '', email: '', company: '', role: 'attendee', status: 'invited' });
  const [lumaInput, setLumaInput] = useState(lumaUrl ?? '');
  const [lumaSyncing, setLumaSyncing] = useState(false);
  const [lumaResult, setLumaResult]   = useState(null);

  useEffect(() => {
    listAttendees(workspaceId, projectId).then((d) => { setAttendees(d); setLoading(false); });
  }, [projectId, workspaceId]);

  const onAdd = async () => {
    if (!draft.name.trim()) return;
    setPending('add');
    const r = await createAttendee({ workspaceId, projectId, ...draft, name: draft.name.trim() });
    setPending(null);
    if (r.ok && r.data) { setAttendees((prev) => [...prev, r.data]); setDraft({ name: '', email: '', company: '', role: 'attendee', status: 'invited' }); setAdding(false); }
  };

  const onStatusChange = async (a, status) => {
    const r = await updateAttendee({ workspaceId, attendeeId: a.id, patch: { status } });
    if (r.ok && r.data) setAttendees((prev) => prev.map((x) => x.id === a.id ? r.data : x));
  };

  const onDelete = async (id) => {
    setPending(id);
    const r = await deleteAttendee({ workspaceId, attendeeId: id });
    setPending(null);
    if (r.ok) setAttendees((prev) => prev.filter((x) => x.id !== id));
  };

  const [lumaSyncMsg, setLumaSyncMsg] = useState('');

  const onLumaSync = async () => {
    const url = lumaInput.trim();
    if (!url) return;
    setLumaSyncing(true);
    setLumaResult(null);
    setLumaSyncMsg('Verbinde mit Luma…');
    // Small delay so the message is visible
    await new Promise((r) => setTimeout(r, 300));
    setLumaSyncMsg('Lade Gästeliste…');
    const r = await syncLumaGuests({ workspaceId, projectId, lumaUrl: url });
    setLumaSyncing(false);
    setLumaSyncMsg('');
    if (!r.ok) { setLumaResult({ ok: false, text: r.error }); return; }
    const { imported, skipped } = r.data;
    setLumaResult({
      ok: true,
      text: imported === 0
        ? `Alle ${skipped} Gäste bereits vorhanden`
        : `${imported} neu importiert${skipped > 0 ? ` · ${skipped} bereits vorhanden` : ''}`,
    });
    listAttendees(workspaceId, projectId).then(setAttendees);
  };

  const counts = {
    invited:    attendees.filter((a) => a.status === 'invited').length,
    confirmed:  attendees.filter((a) => a.status === 'confirmed').length,
    checked_in: attendees.filter((a) => a.status === 'checked_in').length,
    no_show:    attendees.filter((a) => a.status === 'no_show').length,
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--text-3)', fontSize: 13 }}>Wird geladen…</div>;

  return (
    <div>
      <div className="row between mb-3">
        <div>
          <div className="h3">Gästeliste</div>
          {attendees.length > 0 && (
            <div className="row gap-3 mt-1" style={{ fontSize: 12, color: 'var(--text-3)' }}>
              <span>📩 {counts.invited} eingeladen</span>
              <span style={{ color: 'var(--success)' }}>✓ {counts.confirmed} bestätigt</span>
              <span style={{ color: '#10b981' }}>✅ {counts.checked_in} eingecheckt</span>
              {counts.no_show > 0 && <span style={{ color: 'var(--danger)' }}>✗ {counts.no_show} no-show</span>}
            </div>
          )}
        </div>
        <div className="row gap-2">
          {attendees.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => {
              const rows = [['Name','Email','Unternehmen','Rolle','Status'],
                ...attendees.map(a => [a.name, a.email??'', a.company??'', a.role, a.status])];
              const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
              const a = document.createElement('a');
              a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
              a.download = 'gaesteliste.csv'; a.click();
            }}>
              ⬇️ CSV
            </button>
          )}
          {canEdit && !adding && (
            <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
              <I.plus size={13} /> Gast hinzufügen
            </button>
          )}
        </div>
      </div>

      {/* Luma sync */}
      {canEdit && (
        <div style={{ background: 'var(--bg-sunk)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#e8780a', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
            Von Luma importieren
          </div>
          <div className="row gap-2">
            <input
              className="input"
              placeholder="https://lu.ma/dein-event"
              value={lumaInput}
              onChange={(e) => { setLumaInput(e.target.value); setLumaResult(null); }}
              onKeyDown={(e) => e.key === 'Enter' && onLumaSync()}
              disabled={lumaSyncing}
              style={{ flex: 1, fontSize: 12.5 }}
            />
            <button
              className="btn btn-sm"
              type="button"
              onClick={onLumaSync}
              disabled={!lumaInput.trim() || lumaSyncing}
              style={{ background: '#e8780a', color: 'white', border: 'none', whiteSpace: 'nowrap' }}
            >
              {lumaSyncing ? '…' : 'Sync'}
            </button>
          </div>
          {lumaSyncing && lumaSyncMsg && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#e8780a', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
              {lumaSyncMsg}
            </div>
          )}
          {lumaResult && (
            <div style={{
              marginTop: 6, fontSize: 12, padding: '4px 8px', borderRadius: 5,
              color: lumaResult.ok ? 'var(--success)' : 'var(--danger)',
              background: lumaResult.ok ? '#f0fdf4' : 'var(--danger-bg)',
            }}>
              {lumaResult.ok ? '✓ ' : '✗ '}{lumaResult.text}
            </div>
          )}
        </div>
      )}

      {attendees.length === 0 && !adding && (
        <EmptyOps
          icon="👥"
          title="Noch keine Gäste eingetragen"
          desc="Füge Speaker, VIPs, Partner-Gäste und Teilnehmer hinzu um den Überblick zu behalten."
          onAdd={() => setAdding(true)}
          canEdit={canEdit}
          addLabel="Ersten Gast hinzufügen"
        />
      )}

      {adding && (
        <div className="card card-pad mb-3" style={{ background: 'var(--bg-sunk)' }}>
          <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <input className="input" placeholder="Name *" value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              autoFocus style={{ fontSize: 13 }}
            />
            <input className="input" placeholder="Email" value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              style={{ fontSize: 13 }}
            />
          </div>
          <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <input className="input" placeholder="Unternehmen" value={draft.company}
              onChange={(e) => setDraft({ ...draft, company: e.target.value })}
              style={{ fontSize: 13 }}
            />
            <select className="input" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} style={{ fontSize: 13 }}>
              {ATTENDEE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <select className="input" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} style={{ fontSize: 13 }}>
              {ATTENDEE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div className="row gap-2">
            <button className="btn btn-brand btn-sm" onClick={onAdd} disabled={!draft.name.trim() || pending === 'add'}>
              {pending === 'add' ? '…' : 'Hinzufügen'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      {attendees.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Unternehmen</th><th>Rolle</th><th>Status</th>{canEdit && <th />}</tr>
            </thead>
            <tbody>
              {attendees.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{a.name}</div>
                    {a.email && <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{a.email}</div>}
                  </td>
                  <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{a.company || '—'}</td>
                  <td><span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{ROLE_LABELS[a.role] ?? a.role}</span></td>
                  <td>
                    {canEdit ? (
                      <select
                        className="input"
                        value={a.status}
                        onChange={(e) => onStatusChange(a, e.target.value)}
                        style={{ height: 26, fontSize: 12, padding: '0 6px', width: 130 }}
                      >
                        {ATTENDEE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    ) : (
                      <StatusPill status={a.status} />
                    )}
                  </td>
                  {canEdit && (
                    <td>
                      <button className="btn btn-quiet btn-icon" style={{ width: 26, height: 26 }}
                        onClick={() => onDelete(a.id)} disabled={pending === a.id}
                      ><I.x size={11} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── C) Partners / Sponsors ────────────────────────────────────────────────

const PARTNER_STATUSES = ['lead','contacted','call_scheduled','offer_sent','confirmed','active','recap_sent','closed'];
const INVOICE_STATUSES = ['pending','sent','paid','cancelled'];
const PARTNER_STATUS_LABEL = {
  lead: 'Lead', contacted: 'Kontaktiert', call_scheduled: 'Call geplant',
  offer_sent: 'Angebot', confirmed: 'Bestätigt', active: 'Aktiv',
  recap_sent: 'Recap gesendet', closed: 'Abgeschlossen',
};

export function PartnerSponsorList({ projectId, workspaceId, canEdit }) {
  const [partners, setPartners]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);
  const [pending, setPending]     = useState(null);
  const [draft, setDraft]         = useState({ name: '', contactPerson: '', email: '', status: 'lead', package: '' });
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    listEventPartners(workspaceId, projectId).then((d) => { setPartners(d); setLoading(false); });
  }, [projectId, workspaceId]);

  const onAdd = async () => {
    if (!draft.name.trim()) return;
    setPending('add');
    const r = await createEventPartner({ workspaceId, projectId, ...draft, name: draft.name.trim() });
    setPending(null);
    if (r.ok && r.data) { setPartners((prev) => [...prev, r.data]); setDraft({ name: '', contactPerson: '', email: '', status: 'lead', package: '' }); setAdding(false); }
  };

  const onPatch = async (partner, patch) => {
    const r = await updateEventPartner({ workspaceId, partnerId: partner.id, patch });
    if (r.ok && r.data) setPartners((prev) => prev.map((x) => x.id === partner.id ? r.data : x));
  };

  const onDelete = async (id) => {
    setPending(id);
    const r = await deleteEventPartner({ workspaceId, partnerId: id });
    setPending(null);
    if (r.ok) setPartners((prev) => prev.filter((x) => x.id !== id));
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--text-3)', fontSize: 13 }}>Wird geladen…</div>;

  return (
    <div>
      <div className="row between mb-3">
        <div className="h3">Partner & Sponsoren</div>
        {canEdit && !adding && (
          <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
            <I.plus size={13} /> Partner hinzufügen
          </button>
        )}
      </div>

      {partners.length === 0 && !adding && (
        <EmptyOps
          icon="🤝"
          title="Noch keine Partner eingetragen"
          desc="Verfolge Sponsoren, Speaker-Partner und Kooperationspartner — von der ersten Anfrage bis zum Recap-Report."
          onAdd={() => setAdding(true)}
          canEdit={canEdit}
          addLabel="Ersten Partner hinzufügen"
        />
      )}

      {adding && (
        <div className="card card-pad mb-3" style={{ background: 'var(--bg-sunk)' }}>
          <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <input className="input" placeholder="Partner / Sponsor Name *" value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              autoFocus style={{ fontSize: 13 }}
            />
            <input className="input" placeholder="Ansprechpartner" value={draft.contactPerson}
              onChange={(e) => setDraft({ ...draft, contactPerson: e.target.value })}
              style={{ fontSize: 13 }}
            />
          </div>
          <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <input className="input" placeholder="Email" value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              style={{ fontSize: 13 }}
            />
            <select className="input" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} style={{ fontSize: 13 }}>
              {PARTNER_STATUSES.map((s) => <option key={s} value={s}>{PARTNER_STATUS_LABEL[s]}</option>)}
            </select>
            <input className="input" placeholder="Paket (z.B. Gold)" value={draft.package}
              onChange={(e) => setDraft({ ...draft, package: e.target.value })}
              style={{ fontSize: 13 }}
            />
          </div>
          <div className="row gap-2">
            <button className="btn btn-brand btn-sm" onClick={onAdd} disabled={!draft.name.trim() || pending === 'add'}>
              {pending === 'add' ? '…' : 'Hinzufügen'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      <div className="col gap-2">
        {partners.map((p) => (
          <div key={p.id} className="card" style={{ overflow: 'hidden' }}>
            <div
              className="row between"
              style={{ padding: '12px 14px', cursor: 'pointer' }}
              onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
            >
              <div className="row gap-3 items-center">
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: 'linear-gradient(135deg, #e8780a 0%, #f59e0b 100%)',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                }}>
                  {p.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
                  <div className="row gap-2" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {p.contactPerson && <span>{p.contactPerson}</span>}
                    {p.package && <span>· {p.package}</span>}
                  </div>
                </div>
              </div>
              <div className="row gap-2 items-center">
                {canEdit ? (
                  <select
                    className="input"
                    value={p.status}
                    onChange={(e) => { e.stopPropagation(); onPatch(p, { status: e.target.value }); }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ height: 26, fontSize: 12, padding: '0 6px', width: 130 }}
                  >
                    {PARTNER_STATUSES.map((s) => <option key={s} value={s}>{PARTNER_STATUS_LABEL[s]}</option>)}
                  </select>
                ) : (
                  <StatusPill status={p.status} />
                )}
                <I.chevronDown size={14} style={{ color: 'var(--text-3)', transform: expandedId === p.id ? 'rotate(180deg)' : '', transition: '0.15s' }} />
              </div>
            </div>

            {expandedId === p.id && (
              <div style={{ borderTop: '1px solid var(--border-soft)', padding: '12px 14px' }}>
                <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 4 }}>DELIVERABLES</div>
                    {canEdit ? (
                      <textarea className="input" value={p.deliverables ?? ''} rows={2}
                        onChange={(e) => onPatch(p, { deliverables: e.target.value })}
                        style={{ fontSize: 12.5, resize: 'vertical' }}
                        placeholder="z.B. Logo auf Website, Social Media Mention, …"
                      />
                    ) : (
                      <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{p.deliverables || '—'}</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 4 }}>RECHNUNG</div>
                    {canEdit ? (
                      <select className="input" value={p.invoiceStatus}
                        onChange={(e) => onPatch(p, { invoiceStatus: e.target.value })}
                        style={{ fontSize: 13 }}
                      >
                        {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                      </select>
                    ) : (
                      <StatusPill status={p.invoiceStatus} />
                    )}
                  </div>
                </div>

                <div className="row between items-center">
                  {canEdit ? (
                    <label className="row gap-2" style={{ cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={p.logoReceived}
                        onChange={(e) => onPatch(p, { logoReceived: e.target.checked })}
                        style={{ accentColor: 'var(--brand)' }}
                      />
                      Logo erhalten
                    </label>
                  ) : (
                    <span style={{ fontSize: 13, color: p.logoReceived ? 'var(--success)' : 'var(--text-3)' }}>
                      {p.logoReceived ? '✓ Logo erhalten' : '✗ Logo noch ausstehend'}
                    </span>
                  )}
                  {canEdit && (
                    <button className="btn btn-quiet btn-sm" style={{ color: 'var(--text-3)', fontSize: 12 }}
                      onClick={() => onDelete(p.id)} disabled={pending === p.id}
                    >
                      <I.x size={11} /> Entfernen
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── D) Event Recap Checklist ───────────────────────────────────────────────

const RECAP_ITEMS = [
  { id: 'photos',     label: 'Fotos & Videos sichern' },
  { id: 'clips',      label: 'Best-of Clips markieren' },
  { id: 'linkedin',   label: 'LinkedIn Recap erstellen' },
  { id: 'newsletter', label: 'Newsletter Recap schreiben' },
  { id: 'sponsor',    label: 'Sponsor Report erstellen' },
  { id: 'followup',   label: 'Teilnehmer Follow-up senden' },
  { id: 'thanks',     label: 'Danke-Mail an Team & Partner' },
];

export function RecapChecklist({ project, workspaceId, canEdit, onUpdate }) {
  const checklist = project?.eventMeta?.recapChecklist ?? {};
  const done      = RECAP_ITEMS.filter((i) => checklist[i.id]).length;
  const [pending, setPending] = useState(null);

  const toggle = async (id) => {
    if (!canEdit) return;
    setPending(id);
    const newChecklist = { ...checklist, [id]: !checklist[id] };
    const newMeta = { ...(project.eventMeta ?? {}), recapChecklist: newChecklist };
    const r = await updateProject({ projectId: project.id, workspaceId, patch: { eventMeta: newMeta } });
    setPending(null);
    if (r.ok) onUpdate?.({ eventMeta: newMeta });
  };

  return (
    <div>
      <div className="row between mb-3">
        <div>
          <div className="h3">Event Recap</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {done}/{RECAP_ITEMS.length} Punkte abgeschlossen
          </div>
        </div>
      </div>

      <div style={{ height: 4, background: 'var(--border-soft)', borderRadius: 2, marginBottom: 16 }}>
        <div style={{
          width: `${Math.round((done / RECAP_ITEMS.length) * 100)}%`,
          height: '100%', background: done === RECAP_ITEMS.length ? 'var(--success)' : '#e8780a',
          borderRadius: 2, transition: 'width 0.3s',
        }} />
      </div>

      <div className="col gap-2">
        {RECAP_ITEMS.map((item) => {
          const checked = !!checklist[item.id];
          return (
            <label key={item.id} className="row gap-3 items-center"
              style={{ cursor: canEdit ? 'pointer' : 'default', padding: '8px 10px', borderRadius: 8, background: checked ? 'var(--bg-sunk)' : 'transparent' }}
            >
              <input type="checkbox" checked={checked}
                onChange={() => toggle(item.id)}
                disabled={!canEdit || pending === item.id}
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
    </div>
  );
}

// ── E) Approvals ──────────────────────────────────────────────────────────

const APPROVAL_TYPES = [
  { value: 'landingpage',   label: 'Landingpage' },
  { value: 'sponsor_text',  label: 'Sponsor-Text' },
  { value: 'linkedin_post', label: 'LinkedIn Post' },
  { value: 'event_recap',   label: 'Event Recap' },
  { value: 'thumbnail',     label: 'Thumbnail' },
  { value: 'newsletter',    label: 'Newsletter' },
  { value: 'run_of_show',   label: 'Run-of-Show' },
  { value: 'other',         label: 'Sonstiges' },
];

const APPROVAL_STATUSES = ['draft','ready_for_review','changes_requested','approved','published'];
const APPROVAL_STATUS_LABEL = {
  draft:             'Entwurf',
  ready_for_review:  'Zur Review',
  changes_requested: 'Änderungen erbeten',
  approved:          'Freigegeben',
  published:         'Veröffentlicht',
};
const APPROVAL_STATUS_COLOR = {
  draft:             'var(--text-3)',
  ready_for_review:  'var(--info)',
  changes_requested: 'var(--warning)',
  approved:          'var(--success)',
  published:         '#712edd',
};

export function ApprovalsPanel({ projectId, workspaceId, canEdit, members = [] }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [pending, setPending] = useState(null);
  const [draft, setDraft]     = useState({ title: '', type: 'other', reviewerId: '', dueDate: '' });

  useEffect(() => {
    listApprovals(workspaceId, projectId).then((d) => { setItems(d); setLoading(false); });
  }, [projectId, workspaceId]);

  const onAdd = async () => {
    if (!draft.title.trim()) return;
    setPending('add');
    const r = await createApproval({
      workspaceId, projectId,
      title:      draft.title.trim(),
      type:       draft.type || 'other',
      reviewerId: draft.reviewerId || undefined,
      dueDate:    draft.dueDate || undefined,
    });
    setPending(null);
    if (r.ok && r.data) {
      setItems((prev) => [...prev, r.data]);
      setDraft({ title: '', type: 'other', reviewerId: '', dueDate: '' });
      setAdding(false);
    }
  };

  const onStatusChange = async (item, status) => {
    const r = await updateApproval({ workspaceId, approvalId: item.id, patch: { status } });
    if (r.ok && r.data) setItems((prev) => prev.map((x) => x.id === item.id ? r.data : x));
  };

  const onDelete = async (id) => {
    setPending(id);
    const r = await deleteApproval({ workspaceId, approvalId: id });
    setPending(null);
    if (r.ok) setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const openCount    = items.filter((i) => i.status !== 'approved' && i.status !== 'published').length;
  const approvedCount = items.filter((i) => i.status === 'approved' || i.status === 'published').length;

  if (loading) return <div style={{ padding: 24, color: 'var(--text-3)', fontSize: 13 }}>Wird geladen…</div>;

  return (
    <div>
      <div className="row between mb-3">
        <div>
          <div className="h3">Freigaben</div>
          {items.length > 0 && (
            <div className="row gap-3 mt-1" style={{ fontSize: 12, color: 'var(--text-3)' }}>
              <span style={{ color: 'var(--success)' }}>✓ {approvedCount} freigegeben</span>
              {openCount > 0 && <span style={{ color: 'var(--warning)' }}>⏳ {openCount} offen</span>}
            </div>
          )}
        </div>
        {canEdit && !adding && (
          <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
            <I.plus size={13} /> Freigabe anlegen
          </button>
        )}
      </div>

      {items.length === 0 && !adding && (
        <EmptyOps
          icon="✅"
          title="Keine Freigaben"
          desc="Lege Review-Items für Landingpages, Sponsor-Texte, LinkedIn Posts oder Recaps an."
          onAdd={() => setAdding(true)}
          canEdit={canEdit}
          addLabel="Erste Freigabe anlegen"
        />
      )}

      {adding && (
        <div className="card card-pad mb-3" style={{ background: 'var(--bg-sunk)' }}>
          <input
            className="input mb-2"
            placeholder="Titel der Freigabe *"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && onAdd()}
            autoFocus
            style={{ fontSize: 13 }}
          />
          <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <select className="input" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} style={{ fontSize: 13 }}>
              {APPROVAL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select className="input" value={draft.reviewerId} onChange={(e) => setDraft({ ...draft, reviewerId: e.target.value })} style={{ fontSize: 13 }}>
              <option value="">— Reviewer —</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <input
              type="date" className="input"
              value={draft.dueDate}
              onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
              style={{ fontSize: 13 }}
            />
          </div>
          <div className="row gap-2">
            <button className="btn btn-brand btn-sm" onClick={onAdd} disabled={!draft.title.trim() || pending === 'add'}>
              {pending === 'add' ? '…' : 'Anlegen'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      <div className="col gap-2">
        {items.map((item) => {
          const reviewer = members.find((m) => m.id === item.reviewerId);
          const typeLabel = APPROVAL_TYPES.find((t) => t.value === item.type)?.label ?? item.type;
          const color = APPROVAL_STATUS_COLOR[item.status] ?? 'var(--text-3)';
          return (
            <div key={item.id} className="card" style={{ padding: '12px 14px' }}>
              <div className="row between items-start">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row gap-2 items-center mb-1">
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{item.title}</span>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 12,
                      background: 'var(--bg-sunk)', color: 'var(--text-3)',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>{typeLabel}</span>
                  </div>
                  <div className="row gap-3 items-center" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {reviewer && <span>👤 {reviewer.name}</span>}
                    {item.dueDate && <span>📅 {item.dueDate}</span>}
                  </div>
                </div>
                <div className="row gap-2 items-center">
                  {canEdit ? (
                    <select
                      className="input"
                      value={item.status}
                      onChange={(e) => onStatusChange(item, e.target.value)}
                      style={{ height: 26, fontSize: 12, padding: '0 6px', width: 160, color }}
                    >
                      {APPROVAL_STATUSES.map((s) => (
                        <option key={s} value={s}>{APPROVAL_STATUS_LABEL[s]}</option>
                      ))}
                    </select>
                  ) : (
                    <span style={{
                      fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                      background: 'var(--bg-sunk)', color,
                    }}>
                      {APPROVAL_STATUS_LABEL[item.status] ?? item.status}
                    </span>
                  )}
                  {canEdit && (
                    <button
                      className="btn btn-quiet btn-icon"
                      style={{ width: 26, height: 26, color: 'var(--text-4)' }}
                      onClick={() => onDelete(item.id)}
                      disabled={pending === item.id}
                    ><I.x size={11} /></button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── F) Decision Log ────────────────────────────────────────────────────────

const IMPACT_COLOR = { low: 'var(--text-3)', medium: 'var(--warning)', high: 'var(--danger)' };
const IMPACT_LABEL = { low: 'Niedrig', medium: 'Mittel', high: 'Hoch' };

export function DecisionLog({ projectId, workspaceId, canEdit, members = [] }) {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);
  const [pending, setPending]     = useState(null);
  const [draft, setDraft]         = useState({ decision: '', reason: '', impact: 'medium', notes: '' });

  useEffect(() => {
    listDecisions(workspaceId, projectId).then((d) => { setDecisions(d); setLoading(false); });
  }, [projectId, workspaceId]);

  const onAdd = async () => {
    if (!draft.decision.trim()) return;
    setPending('add');
    const r = await createDecision({
      workspaceId, projectId,
      decision: draft.decision.trim(),
      reason:   draft.reason || undefined,
      impact:   draft.impact || undefined,
      notes:    draft.notes || undefined,
    });
    setPending(null);
    if (r.ok && r.data) {
      setDecisions((prev) => [r.data, ...prev]);
      setDraft({ decision: '', reason: '', impact: 'medium', notes: '' });
      setAdding(false);
    }
  };

  const onDelete = async (id) => {
    setPending(id);
    const r = await deleteDecision({ workspaceId, decisionId: id });
    setPending(null);
    if (r.ok) setDecisions((prev) => prev.filter((d) => d.id !== id));
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--text-3)', fontSize: 13 }}>Wird geladen…</div>;

  return (
    <div>
      <div className="row between mb-3">
        <div className="h3">Entscheidungslog</div>
        {canEdit && !adding && (
          <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
            <I.plus size={13} /> Entscheidung eintragen
          </button>
        )}
      </div>

      {decisions.length === 0 && !adding && (
        <EmptyOps
          icon="📋"
          title="Keine Entscheidungen"
          desc="Halte wichtige Entscheidungen fest — Location, Sponsoren, Formatänderungen, Absagen."
          onAdd={() => setAdding(true)}
          canEdit={canEdit}
          addLabel="Erste Entscheidung eintragen"
        />
      )}

      {adding && (
        <div className="card card-pad mb-3" style={{ background: 'var(--bg-sunk)' }}>
          <input
            className="input mb-2"
            placeholder="Entscheidung *  — z.B. Location: PATO bestätigt"
            value={draft.decision}
            onChange={(e) => setDraft({ ...draft, decision: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && onAdd()}
            autoFocus
            style={{ fontSize: 13 }}
          />
          <input
            className="input mb-2"
            placeholder="Begründung (optional)"
            value={draft.reason}
            onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
            style={{ fontSize: 12.5 }}
          />
          <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: '160px 1fr' }}>
            <select className="input" value={draft.impact} onChange={(e) => setDraft({ ...draft, impact: e.target.value })} style={{ fontSize: 13 }}>
              <option value="low">Impact: Niedrig</option>
              <option value="medium">Impact: Mittel</option>
              <option value="high">Impact: Hoch</option>
            </select>
            <input
              className="input"
              placeholder="Notizen (optional)"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              style={{ fontSize: 12.5 }}
            />
          </div>
          <div className="row gap-2">
            <button className="btn btn-brand btn-sm" onClick={onAdd} disabled={!draft.decision.trim() || pending === 'add'}>
              {pending === 'add' ? '…' : 'Eintragen'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      <div className="col gap-0">
        {decisions.map((d, idx) => {
          const decider = members.find((m) => m.id === d.decidedBy);
          const impactColor = IMPACT_COLOR[d.impact] ?? 'var(--text-4)';
          const date = new Date(d.decidedAt);
          const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: '2-digit' });
          return (
            <div key={d.id} style={{
              display: 'flex', gap: 14, alignItems: 'flex-start',
              padding: '12px 0',
              borderBottom: idx < decisions.length - 1 ? '1px solid var(--border-soft)' : 'none',
            }}>
              {/* Timeline dot */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: d.impact ? impactColor : 'var(--text-4)',
                  border: '2px solid var(--bg-base)',
                  outline: `2px solid ${d.impact ? impactColor : 'var(--border-soft)'}`,
                }} />
                {idx < decisions.length - 1 && (
                  <div style={{ width: 1, flex: 1, minHeight: 20, background: 'var(--border-soft)', marginTop: 4 }} />
                )}
              </div>
              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>
                  {d.decision}
                </div>
                {d.reason && (
                  <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 4, lineHeight: 1.5 }}>
                    {d.reason}
                  </div>
                )}
                <div className="row gap-3" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                  <span>{dateStr}</span>
                  {decider && <span>von {decider.name}</span>}
                  {d.impact && (
                    <span style={{ color: impactColor, fontWeight: 600 }}>
                      Impact: {IMPACT_LABEL[d.impact]}
                    </span>
                  )}
                </div>
                {d.notes && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, fontStyle: 'italic' }}>
                    {d.notes}
                  </div>
                )}
              </div>
              {canEdit && (
                <button
                  className="btn btn-quiet btn-icon"
                  style={{ width: 24, height: 24, color: 'var(--text-4)', flexShrink: 0 }}
                  onClick={() => onDelete(d.id)}
                  disabled={pending === d.id}
                  title="Löschen"
                ><I.x size={10} /></button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── G) Resources Panel ────────────────────────────────────────────────────

const RESOURCE_TYPES = [
  { value: 'slack_channel',  label: 'Slack Channel',   icon: '💬', provider: 'slack'        },
  { value: 'drive_folder',   label: 'Drive Ordner',    icon: '📁', provider: 'google_drive' },
  { value: 'landing_page',   label: 'Landing Page',    icon: '🌐', provider: 'web'          },
  { value: 'signup',         label: 'Signup Link',     icon: '📋', provider: 'web'          },
  { value: 'figma',          label: 'Figma',           icon: '🎨', provider: 'figma'        },
  { value: 'canva',          label: 'Canva',           icon: '🖌', provider: 'canva'        },
  { value: 'partner_deck',   label: 'Partner Deck',    icon: '🤝', provider: 'google_drive' },
  { value: 'recap',          label: 'Recap Ordner',    icon: '📸', provider: 'google_drive' },
];

export function ResourcesPanel({ projectId, workspaceId, canEdit, initialResources = [] }) {
  const [resources, setResources] = useState(initialResources);
  const [adding, setAdding]       = useState(false);
  const [pending, setPending]     = useState(null);
  const [draft, setDraft]         = useState({ type: 'landing_page', name: '', url: '' });

  // Sync when parent passes fresh resources
  useEffect(() => { setResources(initialResources); }, [initialResources.length]);

  const typeInfo = (type) => RESOURCE_TYPES.find((r) => r.value === type) ?? { icon: '🔗', label: type, provider: 'web' };

  const onAdd = async () => {
    if (!draft.name.trim() || !draft.url.trim()) return;
    setPending('add');
    const info = typeInfo(draft.type);
    const r = await addProjectResource({
      workspaceId, projectId,
      type:     draft.type,
      provider: info.provider,
      name:     draft.name.trim(),
      url:      draft.url.trim(),
    });
    setPending(null);
    if (r.ok && r.data) {
      setResources((prev) => [...prev, r.data]);
      setDraft({ type: 'landing_page', name: '', url: '' });
      setAdding(false);
    }
  };

  const onDelete = async (id) => {
    setPending(id);
    const r = await deleteProjectResource({ workspaceId, resourceId: id });
    setPending(null);
    if (r.ok) setResources((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <div>
      <div className="row between mb-3">
        <div className="h3">Ressourcen & Links</div>
        {canEdit && !adding && (
          <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
            <I.plus size={13} /> Link hinzufügen
          </button>
        )}
      </div>

      {resources.length === 0 && !adding && (
        <EmptyOps
          icon="🔗"
          title="Keine Ressourcen verknüpft"
          desc="Füge Slack-Channel, Drive-Ordner, Landing Page, Signup-Link, Figma oder Partner-Deck hinzu."
          onAdd={() => setAdding(true)}
          canEdit={canEdit}
          addLabel="Erste Ressource hinzufügen"
        />
      )}

      {adding && (
        <div className="card card-pad mb-3" style={{ background: 'var(--bg-sunk)' }}>
          <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: '160px 1fr' }}>
            <select className="input" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} style={{ fontSize: 13 }}>
              {RESOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
              ))}
            </select>
            <input className="input" placeholder="Name *" value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              autoFocus style={{ fontSize: 13 }}
            />
          </div>
          <input className="input mb-3" placeholder="URL *" value={draft.url}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && onAdd()}
            style={{ fontSize: 13 }}
          />
          <div className="row gap-2">
            <button className="btn btn-brand btn-sm" onClick={onAdd}
              disabled={!draft.name.trim() || !draft.url.trim() || pending === 'add'}>
              {pending === 'add' ? '…' : 'Hinzufügen'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      <div className="col gap-2">
        {resources.map((res) => {
          const info = typeInfo(res.type);
          return (
            <div key={res.id} className="row gap-3 items-center"
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-card)' }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{info.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{res.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>{info.label}</div>
              </div>
              {res.url && (
                <a
                  href={res.url} target="_blank" rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 12, flexShrink: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Öffnen <I.arrowRight size={11} />
                </a>
              )}
              {canEdit && (
                <button className="btn btn-quiet btn-icon"
                  style={{ width: 26, height: 26, color: 'var(--text-4)', flexShrink: 0 }}
                  onClick={() => onDelete(res.id)} disabled={pending === res.id}
                >
                  <I.x size={11} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── H) Luma URL Field (editable inline) ──────────────────────────────────

export function LumaUrlField({ lumaUrl, canEdit, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(lumaUrl ?? '');
  const [saving,  setSaving]  = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave(draft.trim());
    setSaving(false);
    setEditing(false);
  };

  if (!lumaUrl && !canEdit) return null;

  return (
    <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-soft)', marginTop: 4 }}>
      {editing ? (
        <div className="col gap-2">
          <input
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            placeholder="https://lu.ma/dein-event"
            autoFocus
            disabled={saving}
            style={{ fontSize: 12.5 }}
          />
          <div className="row gap-2">
            <button className="btn btn-brand btn-sm" onClick={save} disabled={saving}>
              {saving ? '…' : 'Speichern'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setDraft(lumaUrl ?? ''); }}>
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <div className="row gap-2 items-center">
          {lumaUrl
            ? <LumaRsvpBadge lumaUrl={lumaUrl} />
            : <span style={{ fontSize: 12, color: 'var(--text-4)', fontStyle: 'italic' }}>Kein Luma-Link</span>
          }
          {canEdit && (
            <button
              className="btn btn-quiet btn-sm"
              onClick={() => { setDraft(lumaUrl ?? ''); setEditing(true); }}
              style={{ fontSize: 11.5, color: 'var(--text-3)', marginLeft: 4 }}
              title="Luma-URL bearbeiten"
            >
              <I.edit size={11} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── I) Luma RSVP Badge ────────────────────────────────────────────────────

export function LumaRsvpBadge({ lumaUrl }) {
  const [count,   setCount]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  const fetch = () => {
    if (!lumaUrl) return;
    setLoading(true);
    getLumaRsvpCount(lumaUrl).then((r) => {
      setLoading(false);
      if (r.ok) { setCount(r.data.count); setUpdatedAt(new Date()); }
    });
  };

  useEffect(() => { fetch(); }, [lumaUrl]); // eslint-disable-line

  if (!lumaUrl) return null;

  const timeStr = updatedAt
    ? updatedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <a
        href={lumaUrl} target="_blank" rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 12.5, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
          background: '#fff4e6', color: '#e8780a',
          textDecoration: 'none', border: '1px solid #fed7aa',
        }}
      >
        <span>🎟</span>
        {loading ? '…' : count !== null ? `${count} Anmeldungen` : 'Auf Luma öffnen'}
        <span style={{ fontSize: 10, opacity: 0.7 }}>↗</span>
      </a>
      <button
        onClick={fetch}
        disabled={loading}
        title={timeStr ? `Zuletzt aktualisiert: ${timeStr}` : 'Aktualisieren'}
        style={{
          background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer',
          color: 'var(--text-4)', padding: 2, borderRadius: 4,
          opacity: loading ? 0.4 : 1, transition: 'color 0.1s',
          fontSize: 13,
        }}
        onMouseEnter={(e) => { if (!loading) e.currentTarget.style.color = '#e8780a'; }}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-4)'}
      >
        ↻
      </button>
      {timeStr && !loading && (
        <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{timeStr}</span>
      )}
    </div>
  );
}

// ── H) Event Health Badge ──────────────────────────────────────────────────

export function HealthBadge({ score, reasons = [], size = 'md' }) {
  const [showTip, setShowTip] = useState(false);
  const label = score === 'red' ? 'Kritisch' : score === 'yellow' ? 'Risiko' : 'OK';
  const color = score === 'red' ? 'var(--danger)' : score === 'yellow' ? 'var(--warning)' : 'var(--success)';
  const bg    = score === 'red' ? 'var(--danger-bg)' : score === 'yellow' ? '#fffbeb' : '#f0fdf4';

  if (size === 'sm') {
    return (
      <div style={{ position: 'relative', display: 'inline-block' }}
        onMouseEnter={() => reasons.length && setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
      >
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
          background: color, cursor: reasons.length ? 'help' : 'default',
        }} />
        {showTip && reasons.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
            background: '#1b1b1d', color: 'white', borderRadius: 6, padding: '6px 10px',
            fontSize: 11.5, whiteSpace: 'nowrap', zIndex: 100, maxWidth: 240,
          }}>
            {reasons.map((r, i) => <div key={i}>{r}</div>)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}
      onMouseEnter={() => reasons.length && setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
        background: bg, color, cursor: reasons.length ? 'help' : 'default',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
        {label}
      </span>
      {showTip && reasons.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0,
          background: '#1b1b1d', color: 'white', borderRadius: 8, padding: '8px 12px',
          fontSize: 11.5, zIndex: 100, minWidth: 200, maxWidth: 280,
        }}>
          {reasons.map((r, i) => <div key={i} style={{ marginBottom: i < reasons.length - 1 ? 4 : 0 }}>• {r}</div>)}
        </div>
      )}
    </div>
  );
}

// ── I) Budget Panel ────────────────────────────────────────────────────────

export function BudgetPanel({ project, workspaceId, canEdit, onUpdate }) {
  const meta = project?.eventMeta ?? {};
  const [planned,  setPlanned]  = useState(meta.budgetPlanned  ?? '');
  const [actual,   setActual]   = useState(meta.budgetActual   ?? '');
  const [currency, setCurrency] = useState(meta.budgetCurrency ?? 'EUR');
  const [pending,  setPending]  = useState(false);

  const save = async () => {
    setPending(true);
    const newMeta = { ...meta, budgetPlanned: planned, budgetActual: actual, budgetCurrency: currency };
    const r = await updateProject({ projectId: project.id, workspaceId, patch: { eventMeta: newMeta } });
    setPending(false);
    if (r.ok) onUpdate?.({ eventMeta: newMeta });
  };

  const pNum  = parseFloat(String(planned).replace(/,/g, '.')) || 0;
  const aNum  = parseFloat(String(actual).replace(/,/g, '.')) || 0;
  const pct   = pNum > 0 ? Math.min(100, Math.round((aNum / pNum) * 100)) : 0;
  const over  = aNum > pNum && pNum > 0;
  const fmt   = (n) => n ? `${Number(n).toLocaleString('de-DE', { minimumFractionDigits: 0 })} ${currency}` : '—';

  return (
    <div className="col gap-3">
      {/* Summary bar */}
      {(pNum > 0 || aNum > 0) && (
        <div style={{ background: 'var(--bg-sunk)', borderRadius: 10, padding: '14px 16px' }}>
          <div className="row between mb-2">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Budget-Übersicht</span>
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999,
              background: over ? 'var(--danger-bg)' : '#f0fdf4',
              color: over ? 'var(--danger)' : 'var(--success)',
            }}>{over ? `⛔ ${pct}% ausgegeben` : `✅ ${pct}% ausgegeben`}</span>
          </div>
          <div style={{ background: 'var(--bg-elev)', borderRadius: 999, height: 8, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: over ? 'var(--danger)' : 'var(--success)', borderRadius: 999, transition: 'width 0.4s' }} />
          </div>
          <div className="row gap-4" style={{ fontSize: 13 }}>
            <div><span style={{ color: 'var(--text-3)', fontSize: 12 }}>Geplant</span><br /><strong>{fmt(pNum)}</strong></div>
            <div><span style={{ color: 'var(--text-3)', fontSize: 12 }}>Tatsächlich</span><br /><strong style={{ color: over ? 'var(--danger)' : 'inherit' }}>{fmt(aNum)}</strong></div>
            {pNum > 0 && <div><span style={{ color: 'var(--text-3)', fontSize: 12 }}>Rest</span><br /><strong style={{ color: over ? 'var(--danger)' : 'var(--success)' }}>{fmt(pNum - aNum)}</strong></div>}
          </div>
        </div>
      )}

      {/* Inputs */}
      {canEdit && (
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
          <div>
            <div className="label mb-1">💰 Geplantes Budget</div>
            <input className="input" type="number" min="0" step="100"
              value={planned} onChange={(e) => setPlanned(e.target.value)}
              placeholder="0" style={{ fontSize: 13 }} />
          </div>
          <div>
            <div className="label mb-1">💸 Tatsächliche Kosten</div>
            <input className="input" type="number" min="0" step="10"
              value={actual} onChange={(e) => setActual(e.target.value)}
              placeholder="0" style={{ fontSize: 13 }} />
          </div>
          <div>
            <div className="label mb-1">Währung</div>
            <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ fontSize: 13 }}>
              <option>EUR</option><option>USD</option><option>CHF</option>
            </select>
          </div>
        </div>
      )}

      {!canEdit && pNum === 0 && aNum === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-4)', fontStyle: 'italic' }}>Noch kein Budget erfasst.</div>
      )}

      {canEdit && (
        <button className="btn btn-brand btn-sm" onClick={save} disabled={pending} style={{ alignSelf: 'flex-start' }}>
          {pending ? 'Speichert…' : 'Budget speichern'}
        </button>
      )}
    </div>
  );
}
