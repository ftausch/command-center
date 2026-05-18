'use client';
// New Event Modal — creates an event project with event-specific fields.
// Extends NewProjectModal but scoped to division=events with location,
// partner/sponsor, landing page, optional Slack channel, and template tasks.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { createProject, setupProjectWorkspace } from '@/lib/actions/projects';
import { applyEventTemplate } from '@/lib/actions/templates';
import { fetchLumaEventPreview } from '@/lib/actions/luma';
import { EVENT_TEMPLATE_LIST } from '@/lib/event-templates';
import { safeSlackChannelName } from '@/lib/workspace-utils';

const EVENT_TYPES = ['Networking', 'Founder Dinner', 'Startup Pickleball', 'Workshop', 'Sponsorship Event', 'Andere'];
const PRIORITIES  = ['High', 'Medium', 'Low'];

export function NewEventModal({ open, onClose, onCreated }) {
  const { currentWorkspaceId: workspaceId, addProject, pushActivity } = useWorkspace();

  const submittingRef  = useRef(false);
  const idempotencyId  = useRef(crypto.randomUUID());

  const [name,          setName]          = useState('');
  const [eventType,     setEventType]     = useState('Networking');
  const [location,      setLocation]      = useState('');
  const [eventDate,     setEventDate]     = useState('');
  const [due,           setDue]           = useState('');
  const [partner,       setPartner]       = useState('');
  const [landingPage,   setLandingPage]   = useState('');
  const [signupUrl,     setSignupUrl]     = useState('');
  const [priority,      setPriority]      = useState('Medium');
  const [description,   setDescription]   = useState('');
  const [templateId,    setTemplateId]    = useState('');
  const [setupSlack,    setSetupSlack]    = useState(false);
  const [channelName,   setChannelName]   = useState('');
  const [status,        setStatus]        = useState('idle');
  const [errorMsg,      setErrorMsg]      = useState(null);
  const [lumaUrl,       setLumaUrl]       = useState('');
  const [lumaEventId,   setLumaEventId]   = useState('');
  const [lumaImporting, setLumaImporting] = useState(false);
  const [lumaMsg,       setLumaMsg]       = useState(null);
  const [lumaPreview,   setLumaPreview]   = useState(null); // { name, location, eventDate, guestCount }
  const lumaDebounceRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setName(''); setEventType('Networking'); setLocation('');
    setEventDate(''); setDue(''); setPartner('');
    setLandingPage(''); setSignupUrl(''); setPriority('Medium');
    setDescription(''); setTemplateId(''); setSetupSlack(false);
    setChannelName(''); setStatus('idle'); setErrorMsg(null);
    setLumaUrl(''); setLumaEventId(''); setLumaImporting(false); setLumaMsg(null); setLumaPreview(null);
    clearTimeout(lumaDebounceRef.current);
    submittingRef.current = false;
    idempotencyId.current = crypto.randomUUID();
  }, [open]);

  useEffect(() => {
    if (name.trim()) setChannelName(safeSlackChannelName(name.trim()));
  }, [name]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && status !== 'submitting') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, status, onClose]);

  const doFetchPreview = useCallback(async (url) => {
    if (!url.trim()) return;
    setLumaImporting(true);
    setLumaMsg(null);
    setLumaPreview(null);
    const r = await fetchLumaEventPreview(url.trim());
    setLumaImporting(false);
    if (!r.ok) { setLumaMsg({ type: 'error', text: r.error }); return; }
    setLumaPreview({ ...r.data, sourceUrl: url.trim() });
  }, []);

  // Auto-fetch after 600ms debounce when URL looks valid
  useEffect(() => {
    if (!open) return;
    const url = lumaUrl.trim();
    const looksValid = url.includes('lu.ma') || url.includes('luma.com') || url.startsWith('evt-');
    if (!url || !looksValid) { setLumaPreview(null); setLumaMsg(null); return; }
    clearTimeout(lumaDebounceRef.current);
    lumaDebounceRef.current = setTimeout(() => doFetchPreview(url), 600);
    return () => clearTimeout(lumaDebounceRef.current);
  }, [open, lumaUrl, doFetchPreview]);

  if (!open) return null;

  const onLumaImport = () => doFetchPreview(lumaUrl);

  const applyLumaPreview = () => {
    if (!lumaPreview) return;
    if (lumaPreview.name)       setName(lumaPreview.name);
    if (lumaPreview.location)   setLocation(lumaPreview.location);
    if (lumaPreview.eventDate)  setEventDate(lumaPreview.eventDate.slice(0, 16));
    if (lumaPreview.sourceUrl)  { setLandingPage(lumaPreview.sourceUrl); setSignupUrl(lumaPreview.sourceUrl); }
    if (lumaPreview.lumaEventId) setLumaEventId(lumaPreview.lumaEventId);
    setLumaPreview(null);
    setLumaMsg({ type: 'success', text: `✓ Felder ausgefüllt${lumaPreview.guestCount ? ` · ${lumaPreview.guestCount} Anmeldungen auf Luma` : ''}` });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!workspaceId) { setErrorMsg('Kein Workspace ausgewählt.'); setStatus('error'); return; }
    submittingRef.current = true;
    setStatus('submitting');
    setErrorMsg(null);

    const result = await createProject({
      workspaceId,
      name: name.trim(),
      type: eventType,
      division: 'events',
      description: description.trim() || undefined,
      priority,
      due: due || undefined,
      idempotencyId: idempotencyId.current,
      eventMeta: {
        location:         location.trim() || undefined,
        eventDate:        eventDate || undefined,
        partnerSponsor:   partner.trim() || undefined,
        landingPageUrl:   landingPage.trim() || undefined,
        signupUrl:        signupUrl.trim() || undefined,
        lumaUrl:          lumaUrl.trim() || undefined,
        lumaEventId:      lumaEventId || undefined,
        format:           eventType,
      },
    });

    if (!result.ok || !result.data) {
      setErrorMsg(result.error ?? 'Event konnte nicht angelegt werden');
      setStatus('error');
      submittingRef.current = false;
      return;
    }

    addProject(result.data);
    if (result.activity) pushActivity(result.activity);

    // Apply event template tasks
    if (templateId && result.data.id) {
      applyEventTemplate({
        projectId:   result.data.id,
        workspaceId,
        templateId,
        dueDate:     due || undefined,
      });
    }

    // Slack channel setup
    if (setupSlack && channelName.trim() && result.data.id) {
      setupProjectWorkspace({
        projectId:        result.data.id,
        workspaceId,
        setupSlack:       true,
        slackChannelName: channelName,
        postSetupMessage: true,
        projectName:      name.trim(),
        projectType:      eventType,
      });
    }

    onClose();
    if (onCreated) onCreated(result.data);
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && status !== 'submitting') onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(20,22,28,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
      }}
    >
      <div
        className="card card-pad"
        style={{ width: '100%', maxWidth: 520, position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="row between mb-3">
          <div>
            <div className="row gap-2 items-center">
              <div className="h3">Neues Event</div>
              <span style={{ fontSize: 11, color: '#e8780a', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#fff4e6' }}>Events</span>
            </div>
            <div className="meta mt-1">Event anlegen mit Infos, Template und optionalem Slack-Channel.</div>
          </div>
          <button type="button" className="btn btn-quiet btn-icon" onClick={onClose} disabled={status === 'submitting'}>
            <I.x size={14} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="col gap-3">

          {/* Luma Import */}
          <div style={{ background: 'var(--bg-sunk)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#e8780a', marginBottom: 8 }}>
              Von Luma importieren
            </div>
            <div className="row gap-2">
              <input
                className="input"
                type="text"
                placeholder="https://lu.ma/dein-event"
                value={lumaUrl}
                onChange={(e) => { setLumaUrl(e.target.value); setLumaMsg(null); setLumaPreview(null); }}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onLumaImport())}
                disabled={lumaImporting || status === 'submitting'}
                style={{ flex: 1, fontSize: 13 }}
              />
              {lumaImporting && (
                <span style={{ color: '#e8780a', fontSize: 13, alignSelf: 'center', flexShrink: 0 }}>⟳</span>
              )}
            </div>

            {/* Preview card */}
            {lumaPreview && (
              <div style={{
                marginTop: 10, borderRadius: 8, border: '1px solid #fed7aa',
                background: '#fff9f2', padding: '10px 12px',
              }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>{lumaPreview.name}</div>
                <div className="col gap-1" style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 10 }}>
                  {lumaPreview.eventDate && (
                    <span>📅 {new Date(lumaPreview.eventDate).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  )}
                  {lumaPreview.location && <span>📍 {lumaPreview.location}</span>}
                  {lumaPreview.guestCount != null && <span>🎟 {lumaPreview.guestCount} Anmeldungen</span>}
                </div>
                <div className="row gap-2">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={applyLumaPreview}
                    style={{ background: '#e8780a', color: 'white', border: 'none' }}
                  >
                    ✓ Felder übernehmen
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setLumaPreview(null); setLumaUrl(''); }}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {lumaMsg && (
              <div style={{
                marginTop: 8, fontSize: 12.5, borderRadius: 6, padding: '5px 8px',
                color: lumaMsg.type === 'error' ? 'var(--danger)' : 'var(--success)',
                background: lumaMsg.type === 'error' ? 'var(--danger-bg)' : '#f0fdf4',
              }}>
                {lumaMsg.text}
              </div>
            )}
          </div>

          {/* Name */}
          <input
            className="input" type="text"
            placeholder="Event-Name — z.B. UB Founder Pickleball #3"
            value={name} onChange={(e) => setName(e.target.value)}
            required disabled={status === 'submitting'} autoFocus maxLength={200}
          />

          {/* Type + Priority */}
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <select className="input" value={eventType} onChange={(e) => setEventType(e.target.value)} disabled={status === 'submitting'}>
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)} disabled={status === 'submitting'}>
              {PRIORITIES.map((p) => <option key={p} value={p}>Priorität: {p}</option>)}
            </select>
          </div>

          {/* Location + Event date */}
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <input
              className="input" type="text"
              placeholder="📍 Location (optional)"
              value={location} onChange={(e) => setLocation(e.target.value)}
              disabled={status === 'submitting'}
            />
            <input
              className="input" type="datetime-local"
              value={eventDate} onChange={(e) => setEventDate(e.target.value)}
              disabled={status === 'submitting'}
              title="Event-Datum & Uhrzeit"
            />
          </div>

          {/* Deadline */}
          <input
            className="input" type="date"
            value={due} onChange={(e) => setDue(e.target.value)}
            disabled={status === 'submitting'}
            title="Projektdeadline"
          />

          {/* Partner/Sponsor */}
          <input
            className="input" type="text"
            placeholder="🤝 Partner / Sponsor (optional)"
            value={partner} onChange={(e) => setPartner(e.target.value)}
            disabled={status === 'submitting'}
          />

          {/* URLs */}
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <input
              className="input" type="url"
              placeholder="🔗 Landing Page URL"
              value={landingPage} onChange={(e) => setLandingPage(e.target.value)}
              disabled={status === 'submitting'}
            />
            <input
              className="input" type="url"
              placeholder="📋 Signup URL"
              value={signupUrl} onChange={(e) => setSignupUrl(e.target.value)}
              disabled={status === 'submitting'}
            />
          </div>

          {/* Description */}
          <textarea
            className="input"
            placeholder="Beschreibung (optional)"
            value={description} onChange={(e) => setDescription(e.target.value)}
            disabled={status === 'submitting'}
            rows={2}
            style={{ resize: 'vertical', minHeight: 56, padding: '8px 12px', lineHeight: 1.4 }}
          />

          {/* Event Template */}
          <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
              Event Template
            </div>
            <div className="col gap-2">
              <label className="row gap-2 items-start" style={{ cursor: 'pointer', fontSize: 12.5 }}>
                <input
                  type="radio" name="template" value=""
                  checked={templateId === ''}
                  onChange={() => setTemplateId('')}
                  style={{ accentColor: 'var(--brand)', marginTop: 2, flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontWeight: 500 }}>Kein Template</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Tasks manuell anlegen</div>
                </div>
              </label>
              {EVENT_TEMPLATE_LIST.map((t) => (
                <label key={t.id} className="row gap-2 items-start" style={{ cursor: 'pointer', fontSize: 12.5 }}>
                  <input
                    type="radio" name="template" value={t.id}
                    checked={templateId === t.id}
                    onChange={() => setTemplateId(t.id)}
                    style={{ accentColor: 'var(--brand)', marginTop: 2, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontWeight: 500 }}>{t.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{t.desc} · {t.taskCount} Tasks</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Workspace Setup */}
          <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
              Workspace einrichten
            </div>
            {/* Slack */}
            <label className="row gap-2 items-start mb-3" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox" checked={setupSlack}
                onChange={(e) => setSetupSlack(e.target.checked)}
                disabled={status === 'submitting'}
                style={{ accentColor: 'var(--brand)', marginTop: 3, flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>💬 Slack-Channel erstellen</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
                  Erstellt automatisch einen Channel in Slack. Falls die Erstellung fehlschlägt, wird das Event trotzdem angelegt.
                </div>
              </div>
            </label>
            {setupSlack && (
              <input
                className="input mb-3"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="channel-name"
                disabled={status === 'submitting'}
                style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}
              />
            )}
            {/* Drive — coming soon */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', opacity: 0.5 }}>
              <div style={{ marginTop: 2, width: 16, height: 16, border: '1.5px solid var(--border)', borderRadius: 3, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>📁 Google Drive Ordner erstellen</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
                  Beim Anlegen des Events direkt einen Drive-Ordner erstellen. (Wird über Projekt-Einstellungen eingerichtet)
                </div>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-brand"
            disabled={!name.trim() || status === 'submitting'}
            style={{ width: '100%', justifyContent: 'center', marginTop: 4, background: '#e8780a', borderColor: '#e8780a' }}
          >
            {status === 'submitting' ? 'Wird angelegt…' : '🎪 Event anlegen'}
          </button>

          {errorMsg && (
            <div style={{ fontSize: 12.5, color: 'var(--danger)', padding: '6px 8px', background: 'var(--danger-bg)', borderRadius: 6, border: '1px solid var(--danger-border)' }}>
              {errorMsg}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
