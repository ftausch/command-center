'use client';
// Event Day-of Mode — fullscreen mobile-friendly control panel during live events.
// Triggered by "🎪 Live Event" button in Event Detail when event date is today or tomorrow.

import { useEffect, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { listAgendaItems, updateAgendaItem, listAttendees, updateAttendee } from '@/lib/actions/event-ops';

const STATUS_COLORS = { planned:'var(--text-3)', active:'#e8780a', done:'var(--success)', skipped:'var(--text-4)' };

export function EventDayOf({ project, onClose }) {
  const { currentWorkspaceId } = useWorkspace();
  const [agenda,    setAgenda]    = useState([]);
  const [attendees, setAttendees] = useState([]);
  const [notes,     setNotes]     = useState('');
  const [tab,       setTab]       = useState('agenda');
  const [pending,   setPending]   = useState(null);
  const [now,       setNow]       = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!project?.id || !currentWorkspaceId) return;
    Promise.all([
      listAgendaItems(currentWorkspaceId, project.id),
      listAttendees(currentWorkspaceId, project.id),
    ]).then(([a, att]) => { setAgenda(a); setAttendees(att); });
  }, [project?.id, currentWorkspaceId]);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const setAgendaStatus = async (item, status) => {
    setPending(item.id);
    const r = await updateAgendaItem({ workspaceId: currentWorkspaceId, itemId: item.id, patch: { status } });
    setPending(null);
    if (r.ok && r.data) setAgenda(prev => prev.map(i => i.id === item.id ? r.data : i));
  };

  const setAttendeeStatus = async (a, status) => {
    setPending(a.id);
    const r = await updateAttendee({ workspaceId: currentWorkspaceId, attendeeId: a.id, patch: { status } });
    setPending(null);
    if (r.ok && r.data) setAttendees(prev => prev.map(x => x.id === a.id ? r.data : x));
  };

  const checkedIn  = attendees.filter(a => a.status === 'checked_in').length;
  const confirmed  = attendees.filter(a => a.status === 'confirmed' || a.status === 'checked_in').length;
  const doneItems  = agenda.filter(i => i.status === 'done').length;
  const activeItem = agenda.find(i => i.status === 'active');

  const ROLE_LABELS = { attendee:'Teilnehmer', speaker:'Speaker', vip:'VIP', partner_guest:'Partner', team:'Team' };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#0f1117',
      display: 'flex', flexDirection: 'column',
      color: 'white',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1a1d27' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#e8780a', marginBottom: 4 }}>
            🎪 LIVE EVENT
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{project?.name}</div>
          {project?.eventMeta?.location && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>📍 {project.eventMeta.location}</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#e8780a' }} suppressHydrationWarning>{timeStr}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            {doneItems}/{agenda.length} Punkte · {checkedIn} eingecheckt
          </div>
        </div>
      </div>

      {/* Active item banner */}
      {activeItem && (
        <div style={{ background: '#e8780a', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Jetzt aktiv</span>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{activeItem.timeLabel && `${activeItem.timeLabel} — `}{activeItem.title}</div>
          </div>
          <button onClick={() => setAgendaStatus(activeItem, 'done')} disabled={pending === activeItem.id}
            style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, color: 'white', padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            ✓ Erledigt
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#1a1d27', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {[
          { id: 'agenda',    label: `Ablaufplan (${doneItems}/${agenda.length})`   },
          { id: 'checkin',   label: `Check-in (${checkedIn}/${confirmed})`          },
          { id: 'notes',     label: 'Notizen'                                        },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '12px 8px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            color: tab === t.id ? '#e8780a' : 'rgba(255,255,255,0.4)',
            borderBottom: tab === t.id ? '2px solid #e8780a' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>

        {/* Agenda */}
        {tab === 'agenda' && (
          <div className="col gap-2">
            {agenda.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                Noch keine Agenda-Punkte angelegt.
              </div>
            )}
            {agenda.map((item, idx) => (
              <div key={item.id} style={{
                borderRadius: 10, padding: '12px 14px',
                background: item.status === 'active' ? 'rgba(232,120,10,0.15)' : item.status === 'done' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${item.status === 'active' ? '#e8780a' : item.status === 'done' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)'}`,
                opacity: item.status === 'skipped' ? 0.4 : 1,
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: item.status === 'done' ? 'rgba(255,255,255,0.3)' : '#e8780a', minWidth: 48, flexShrink: 0 }}>
                    {item.timeLabel || '—'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, textDecoration: item.status === 'done' ? 'line-through' : 'none', color: item.status === 'done' ? 'rgba(255,255,255,0.35)' : 'white' }}>
                      {item.title}
                    </div>
                    {item.location && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>📍 {item.location}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {item.status !== 'active' && item.status !== 'done' && (
                      <button onClick={() => setAgendaStatus(item, 'active')} disabled={pending === item.id}
                        style={{ background: '#e8780a', border: 'none', borderRadius: 6, color: 'white', padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        ▶ Start
                      </button>
                    )}
                    {item.status === 'active' && (
                      <button onClick={() => setAgendaStatus(item, 'done')} disabled={pending === item.id}
                        style={{ background: 'var(--success)', border: 'none', borderRadius: 6, color: 'white', padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        ✓ Done
                      </button>
                    )}
                    {item.status === 'done' && (
                      <span style={{ fontSize: 18 }}>✅</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Check-in */}
        {tab === 'checkin' && (
          <div className="col gap-2">
            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 8 }}>
              {[
                { l: 'Eingecheckt', v: checkedIn, c: 'var(--success)' },
                { l: 'Bestätigt',   v: attendees.filter(a=>a.status==='confirmed').length, c: '#e8780a' },
                { l: 'Eingeladen',  v: attendees.filter(a=>a.status==='invited').length,   c: 'rgba(255,255,255,0.4)' },
              ].map(({ l, v, c }) => (
                <div key={l} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: c }}>{v}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
            {attendees.filter(a => a.status !== 'cancelled').map(a => (
              <div key={a.id} style={{
                display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', borderRadius: 8,
                background: a.status === 'checked_in' ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${a.status === 'checked_in' ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                    {ROLE_LABELS[a.role] ?? a.role}{a.company ? ` · ${a.company}` : ''}
                  </div>
                </div>
                {a.status === 'checked_in' ? (
                  <span style={{ fontSize: 18 }}>✅</span>
                ) : (
                  <button onClick={() => setAttendeeStatus(a, 'checked_in')} disabled={pending === a.id}
                    style={{ background: '#e8780a', border: 'none', borderRadius: 6, color: 'white', padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    ✓ Check-in
                  </button>
                )}
              </div>
            ))}
            {attendees.filter(a => a.status !== 'cancelled').length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                Noch keine Gäste eingetragen.
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {tab === 'notes' && (
          <div className="col gap-3">
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Schnelle Notizen während des Events:</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notizen hier eingeben…"
              style={{
                width: '100%', minHeight: 300, background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
                color: 'white', padding: '14px', fontSize: 14, lineHeight: 1.6,
                resize: 'vertical', outline: 'none',
              }}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1d27' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
          ESC zum Schließen · Alle Änderungen werden sofort gespeichert
        </div>
        <button onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: 'white', padding: '8px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          Event-Modus beenden
        </button>
      </div>
    </div>
  );
}
