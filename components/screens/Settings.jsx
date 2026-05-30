'use client';
// Settings — with Slack integration prominent

import { useState, useEffect } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Avatar, Badge, SlackCard } from '@/components/ui';
import { Field } from '@/components/screens/ProjectDetail';
import { Stat2, ToggleRow } from '@/components/screens/Templates';
import { InvitePersonModal } from '@/components/InvitePersonModal';
import { MemberManageModal } from '@/components/MemberManageModal';
import { timeAgo } from '@/lib/utils';
import { updateWorkspace } from '@/lib/actions/workspaces';
import { updateProject } from '@/lib/actions/projects';
import { updateMyProfile } from '@/lib/actions/profile';
import { CAN } from '@/lib/roles';
import { getFocusPreference, setFocusPreference, FocusOnboarding, FOCUS_KEY } from '@/components/FocusOnboarding';

export function SettingsScreen() {
  const { currentWorkspaceId: workspace, currentWorkspace: brand, myRole, me } = useWorkspace();
  const [section, setSection] = useState('profile');

  const [showFocusChange, setShowFocusChange] = useState(false);

  const sections = [
    { id: 'profile',    label: 'Mein Profil',   icon: <I.user size={14} /> },
    { id: 'appearance', label: 'Darstellung',   icon: <I.zap size={14} /> },
    { id: 'focus',      label: 'Mein Fokus',    icon: <span style={{ fontSize: 14 }}>🎯</span> },
    { id: 'workspace',  label: 'Workspace',     icon: <I.folder size={14} /> },
    { id: 'members',    label: 'Team & Roles',  icon: <I.team size={14} /> },
    { id: 'slack',      label: 'Slack',         icon: <I.slack size={14} /> },
    { id: 'notifs',     label: 'Notifications', icon: <I.bell size={14} /> },
    { id: 'brand',      label: 'Brand Colors',  icon: <I.flag size={14} /> },
  ];

  if (!brand) return null;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2"><Badge kind="brand" dot>{brand.name}</Badge></div>
          <h1 className="h1">Settings</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Workspace-spezifische Konfiguration. Brand-Settings sind getrennt von SelbstFrei.
          </p>
        </div>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: '220px 1fr' }}>
        <nav>
          {sections.map((s) => (
            <div key={s.id} className={`nav-item ${section === s.id ? 'active' : ''}`} onClick={() => setSection(s.id)} style={{ margin: '1px 0' }}>
              {s.icon} <span>{s.label}</span>
            </div>
          ))}
        </nav>

        <div>
          {section === 'profile'    && <ProfileSection me={me} />}
          {section === 'appearance' && <AppearanceSection />}
          {section === 'focus' && (
            <div className="col gap-4">
              <div>
                <div className="h3 mb-1">🎯 Mein Fokus</div>
                <div className="meta">Legt fest welche Bereiche du in der Sidebar siehst.</div>
              </div>
              <FocusOnboarding onDone={(focus) => {
                setFocusPreference(workspace, me?.id, focus);
                window.location.reload();
              }} />
            </div>
          )}
          {section === 'slack'      && <SlackSection />}
          {section === 'workspace' && <WorkspaceSection brand={brand} workspace={workspace} myRole={myRole} />}
          {section === 'members'   && <MembersSection myRole={myRole} />}
          {section === 'notifs'    && <NotifsSection />}
          {section === 'brand'     && <BrandSection brand={brand} workspace={workspace} myRole={myRole} />}
        </div>
      </div>
    </div>
  );
}

function SlackSection() {
  const { currentWorkspace: brand, currentWorkspaceId: workspaceId, data, updateProjectInCache } = useWorkspace();
  const projects = data.projects;
  const notifs = data.slackNotifications;
  const [editingId, setEditingId] = useState(null);
  const [channelDraft, setChannelDraft] = useState('');
  const [connectedDraft, setConnectedDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const startEdit = (p) => {
    setEditingId(p.id);
    setChannelDraft(p.slackChannel || '');
    setConnectedDraft(p.slackConnected);
    setSaveError(null);
  };

  const cancelEdit = () => { setEditingId(null); setSaveError(null); };

  const saveMapping = async (projectId) => {
    setSaving(true);
    setSaveError(null);
    const channel = channelDraft.trim();
    const r = await updateProject({
      projectId,
      workspaceId,
      patch: { slackChannel: channel, slackConnected: connectedDraft && !!channel },
    });
    setSaving(false);
    if (!r.ok) { setSaveError(r.error ?? 'Speichern fehlgeschlagen'); return; }
    updateProjectInCache(projectId, {
      slackChannel: channel,
      slackConnected: connectedDraft && !!channel,
    });
    setEditingId(null);
  };

  const startOfDay = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
  const postsToday = notifs.filter((n) => { const t = new Date(n.time).getTime(); return Number.isFinite(t) && t >= startOfDay; }).length;
  const lastSyncText = notifs[0] ? timeAgo(notifs[0].time) : '—';

  return (
    <>
      <div className="card card-pad mb-4">
        <div className="row between mb-3">
          <div className="row gap-3">
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg-sunk)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><I.slack size={24} /></div>
            <div>
              <div className="h2">Slack Workspace</div>
              <div className="meta mt-1">Verbunden mit <span className="mono">unicornbakery-team.slack.com</span></div>
            </div>
          </div>
          <Badge kind="success" dot large>Connected</Badge>
        </div>
        <div className="grid grid-3 gap-4 mt-4">
          <Stat2 label="Channels gemappt" value={projects.filter((p) => p.slackConnected).length} />
          <Stat2 label="Posts heute" value={postsToday} />
          <Stat2 label="Letzter Sync" value={lastSyncText} />
        </div>
      </div>

      <div className="card mb-4">
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
          <div className="h3">Channel-Mapping</div>
          <div className="meta mt-1">Pro Projekt ein Slack-Channel. Channel-Name eintragen, dann verbinden.</div>
        </div>
        <table className="table">
          <thead><tr><th>Projekt</th><th>Slack Channel</th><th>Auto-Updates</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {projects.map((p) => editingId === p.id ? (
              <tr key={p.id} style={{ background: 'var(--bg-sunk)' }}>
                <td style={{ fontWeight: 500 }}>{p.name}</td>
                <td>
                  <input
                    className="input mono"
                    value={channelDraft}
                    onChange={(e) => setChannelDraft(e.target.value)}
                    placeholder="#channel-name"
                    disabled={saving}
                    style={{ height: 28, fontSize: 12.5, width: 180 }}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit(); if (e.key === 'Enter') saveMapping(p.id); }}
                  />
                </td>
                <td>
                  <div className="row gap-1">
                    <Badge kind="ghost">Status</Badge>
                    <Badge kind="ghost">Blocked</Badge>
                    <Badge kind="ghost">Review</Badge>
                  </div>
                </td>
                <td>
                  <label className="row gap-2" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={connectedDraft} onChange={(e) => setConnectedDraft(e.target.checked)} disabled={saving || !channelDraft.trim()} />
                    {connectedDraft && channelDraft.trim()
                      ? <Badge kind="success" dot>Connected</Badge>
                      : <Badge kind="warning" dot>Not connected</Badge>}
                  </label>
                </td>
                <td>
                  <div className="col gap-1">
                    <div className="row gap-2">
                      <button className="btn btn-brand btn-sm" onClick={() => saveMapping(p.id)} disabled={saving}>
                        {saving ? '…' : 'Speichern'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={cancelEdit} disabled={saving}>Abbrechen</button>
                    </div>
                    {saveError && <div style={{ fontSize: 11.5, color: 'var(--danger)' }}>{saveError}</div>}
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={p.id}>
                <td><div style={{ fontWeight: 500 }}>{p.name}</div></td>
                <td>
                  {p.slackChannel
                    ? <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{p.slackChannel}</span>
                    : <span style={{ fontSize: 12, color: 'var(--text-4)' }}>—</span>}
                </td>
                <td>
                  <div className="row gap-1">
                    <Badge kind="ghost">Status</Badge>
                    <Badge kind="ghost">Blocked</Badge>
                    <Badge kind="ghost">Review</Badge>
                  </div>
                </td>
                <td>{p.slackConnected ? <Badge kind="success" dot>Connected</Badge> : <Badge kind="warning" dot>Not connected</Badge>}</td>
                <td><button className="btn btn-quiet btn-sm" onClick={() => startEdit(p)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card card-pad mb-4">
        <div className="h3 mb-3">Notification Rules · {brand?.name}</div>
        <p className="meta mb-3">Welche Events sollen automatisch nach Slack gehen? Settings gelten nur für diesen Workspace.</p>
        <div className="col gap-3">
          <ToggleRow on label="Neue Tasks → Slack" />
          <ToggleRow on label="Status-Wechsel (Backlog → To Do → In Progress)" />
          <ToggleRow on label="Status → Review (ping Reviewer)" />
          <ToggleRow on label="Status → Blocked (ping Owner)" />
          <ToggleRow label="Task abgeschlossen (still)" />
          <ToggleRow on label="Deadline-Änderungen" />
          <ToggleRow label="Kommentare unter Tasks" />
        </div>
      </div>

      <div className="card card-pad" style={{ background: 'var(--info-bg)', borderColor: 'var(--info-border)' }}>
        <div className="row gap-2 mb-2"><I.message size={14} color="var(--info)" /><span style={{ fontWeight: 600 }}>Slack-Notification Preview</span></div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 12px' }}>So sieht ein automatischer Post aus, wenn jemand eine Task in Review schiebt.</p>
        <div style={{ background: 'var(--bg-elev)', borderRadius: 8, padding: 14, border: '1px solid var(--border)' }}>
          <SlackCard notif={{ channel: '#ub-ep142-pausder', user: 'Command Center · App', text: '@channel Mara hat „Rough Cut Ep. 142" auf Review gesetzt — Fabian, du bist als Reviewer markiert.', time: 'gerade eben' }} />
        </div>
      </div>
    </>
  );
}

function WorkspaceSection({ brand, workspace, myRole }) {
  const { updateWorkspaceInCache } = useWorkspace();
  const canEdit = CAN.workspaceSettings(myRole);
  const [name, setName] = useState(brand.name);
  const [tagline, setTagline] = useState(brand.tagline);
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const [errorMsg, setErrorMsg] = useState(null);

  const dirty = name !== brand.name || tagline !== brand.tagline;

  const save = async () => {
    if (!dirty) return;
    setStatus('saving');
    setErrorMsg(null);
    const result = await updateWorkspace({ workspaceId: workspace, name, tagline });
    if (!result.ok) {
      setStatus('error');
      setErrorMsg(result.error);
      return;
    }
    updateWorkspaceInCache(workspace, {
      name: result.data.name,
      tagline: result.data.tagline,
      sub: result.data.tagline,
    });
    setStatus('saved');
    setTimeout(() => setStatus('idle'), 2000);
  };

  const discard = () => {
    setName(brand.name);
    setTagline(brand.tagline);
    setStatus('idle');
    setErrorMsg(null);
  };

  return (
    <div className="card card-pad">
      <Field label="Workspace Name">
        <input
          className="input"
          value={name}
          onChange={(e) => { setName(e.target.value); setStatus('idle'); }}
          disabled={status === 'saving'}
        />
      </Field>
      <Field label="Slug"><span className="mono">{workspace}</span></Field>
      <Field label="Beschreibung">
        <input
          className="input"
          value={tagline}
          onChange={(e) => { setTagline(e.target.value); setStatus('idle'); }}
          disabled={status === 'saving'}
        />
      </Field>
      {errorMsg && (
        <div style={{ fontSize: 12.5, color: 'var(--danger)', padding: '6px 8px', background: 'var(--danger-bg)', borderRadius: 6, border: '1px solid var(--danger-border)', marginBottom: 8 }}>
          {errorMsg}
        </div>
      )}
      {status === 'saved' && (
        <div style={{ fontSize: 12.5, color: 'var(--success)', marginBottom: 8 }}>Gespeichert.</div>
      )}
      {canEdit ? (
        <div className="row gap-2 mt-3" style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 16 }}>
          <button className="btn btn-brand btn-sm" onClick={save} disabled={!dirty || status === 'saving'}>
            {status === 'saving' ? 'Wird gespeichert…' : 'Änderungen speichern'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={discard} disabled={!dirty || status === 'saving'}>
            Verwerfen
          </button>
        </div>
      ) : (
        <p className="meta" style={{ marginTop: 12 }}>Nur Admins und Owner können Workspace-Einstellungen ändern.</p>
      )}
    </div>
  );
}

function MembersSection({ myRole }) {
  const { data, workspaces } = useWorkspace();
  const users = data.members;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [manageMember, setManageMember] = useState(null);
  return (
    <div className="card">
      <InvitePersonModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <MemberManageModal
        open={manageMember !== null}
        member={manageMember}
        onClose={() => setManageMember(null)}
      />
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }} className="row between">
        <div>
          <div className="h3">Mitglieder · {users.length}</div>
          <div className="meta mt-1">Rollen: Owner · Admin · Manager · Member · Viewer</div>
        </div>
        {CAN.inviteMember(myRole) && (
          <button className="btn btn-brand btn-sm" onClick={() => setInviteOpen(true)}><I.plus size={13} /> Einladen</button>
        )}
      </div>
      <table className="table">
        <thead><tr><th>Person</th><th>Rolle</th><th>Workspaces</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td><div className="row gap-2"><Avatar user={u} /><div><div style={{ fontWeight: 500 }}>{u.name}</div><div className="meta">{u.role}</div></div></div></td>
              <td><Badge kind="ghost">{u.role === 'Owner' ? 'Owner' : u.role?.includes('Manager') ? 'Manager' : 'Member'}</Badge></td>
              <td>{u.workspaces?.map((w) => {
                const ws = workspaces.find((x) => x.id === w);
                return ws ? (
                  <Badge key={w} kind="ghost">
                    <span className="dot-indicator" style={{ background: ws.color }} />
                    {ws.name}
                  </Badge>
                ) : null;
              })}</td>
              <td>{u.online ? <span style={{ fontSize: 12, color: 'var(--success)' }}>● Online</span> : <span className="meta">Offline</span>}</td>
              <td><button
                className="btn btn-quiet btn-sm"
                onClick={() => setManageMember(u)}
                title="Mitglied verwalten"
              ><I.more size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const NOTIF_KEY = 'cc.notif_prefs';
const NOTIF_DEFAULTS = {
  mentions: true,
  assigned_tasks: true,
  deadline_reminders: true,
  blocker_owned: true,
  all_status_changes: false,
  weekly_report: false,
  channel_in_app: true,
  channel_slack: true,
  channel_email: false,
};

function NotifsSection() {
  const [prefs, setPrefs] = useState(NOTIF_DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTIF_KEY);
      if (raw) setPrefs({ ...NOTIF_DEFAULTS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  const toggle = (key) => {
    setPrefs((p) => {
      const next = { ...p, [key]: !p[key] };
      try { localStorage.setItem(NOTIF_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return (
    <div className="card card-pad">
      <div className="h3 mb-3">Benachrichtigungen</div>
      <p className="meta mb-4">Wann wirst du gepingt? Diese Settings gelten nur für dich.</p>
      <div className="col gap-3">
        <ToggleRow on={prefs.mentions}            onChange={() => toggle('mentions')}            label="Erwähnungen (@me)" />
        <ToggleRow on={prefs.assigned_tasks}       onChange={() => toggle('assigned_tasks')}       label="Mir zugewiesene Tasks" />
        <ToggleRow on={prefs.deadline_reminders}   onChange={() => toggle('deadline_reminders')}   label="Deadline-Erinnerungen (24h vorher)" />
        <ToggleRow on={prefs.blocker_owned}        onChange={() => toggle('blocker_owned')}        label="Blocker auf Projekten, die ich besitze" />
        <ToggleRow on={prefs.all_status_changes}   onChange={() => toggle('all_status_changes')}   label="Alle Status-Wechsel" />
        <ToggleRow on={prefs.weekly_report}        onChange={() => toggle('weekly_report')}        label="Wöchentlicher Auslastungs-Report (Mo 9:00)" />
      </div>
      <div className="divider" />
      <div className="h3 mb-3">Channels</div>
      <div className="col gap-3">
        <ToggleRow on={prefs.channel_in_app}  onChange={() => toggle('channel_in_app')}  label="In-App" />
        <ToggleRow on={prefs.channel_slack}   onChange={() => toggle('channel_slack')}   label="Slack" />
        <ToggleRow on={prefs.channel_email}   onChange={() => toggle('channel_email')}   label="E-Mail" />
      </div>
    </div>
  );
}

function BrandSection({ brand, workspace, myRole }) {
  const { updateWorkspaceInCache } = useWorkspace();
  const canEdit = CAN.workspaceSettings(myRole);
  const [color, setColor] = useState(brand.color);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState(null);

  const dirty = color !== brand.color;

  const save = async () => {
    if (!dirty) return;
    setStatus('saving');
    setErrorMsg(null);
    const result = await updateWorkspace({ workspaceId: workspace, color });
    if (!result.ok) {
      setStatus('error');
      setErrorMsg(result.error);
      return;
    }
    updateWorkspaceInCache(workspace, { color: result.data.color });
    setStatus('saved');
    setTimeout(() => setStatus('idle'), 2000);
  };

  return (
    <div className="card card-pad">
      <div className="row gap-3 mb-4">
        <div style={{ width: 56, height: 56, borderRadius: 12, background: color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em' }}>{brand.initials}</div>
        <div>
          <div className="h2">{brand.name}</div>
          <div className="meta mt-1">Akzentfarbe & Brand Marker. Wirkt sich nur auf diesen Workspace aus.</div>
        </div>
      </div>
      <Field label="Akzentfarbe">
        <div className="row gap-2" style={{ alignItems: 'center' }}>
          <input
            type="color"
            value={color}
            onChange={(e) => { setColor(e.target.value); setStatus('idle'); }}
            disabled={status === 'saving'}
            style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border)', padding: 2, cursor: 'pointer', background: 'none' }}
          />
          <input
            className="input mono"
            value={color}
            onChange={(e) => { setColor(e.target.value); setStatus('idle'); }}
            disabled={status === 'saving'}
            style={{ width: 120 }}
          />
          <span className="meta">Wird nur sparsam als Akzent eingesetzt — nie als Fläche.</span>
        </div>
      </Field>
      <Field label="Brand Initials">
        <span className="mono" style={{ color: 'var(--text-2)' }}>{brand.initials}</span>
        <span className="meta" style={{ marginLeft: 8 }}>(aus Workspace-Name abgeleitet)</span>
      </Field>
      {errorMsg && (
        <div style={{ fontSize: 12.5, color: 'var(--danger)', padding: '6px 8px', background: 'var(--danger-bg)', borderRadius: 6, border: '1px solid var(--danger-border)', marginBottom: 8 }}>
          {errorMsg}
        </div>
      )}
      {status === 'saved' && (
        <div style={{ fontSize: 12.5, color: 'var(--success)', marginBottom: 8 }}>Gespeichert.</div>
      )}
      {canEdit ? (
        <div className="row gap-2 mt-3" style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 16 }}>
          <button className="btn btn-brand btn-sm" onClick={save} disabled={!dirty || status === 'saving'}>
            {status === 'saving' ? 'Wird gespeichert…' : 'Farbe speichern'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setColor(brand.color); setStatus('idle'); setErrorMsg(null); }} disabled={!dirty || status === 'saving'}>
            Verwerfen
          </button>
        </div>
      ) : (
        <p className="meta" style={{ marginTop: 12 }}>Nur Admins und Owner können Brand-Einstellungen ändern.</p>
      )}
      <div className="meta" style={{ background: 'var(--bg)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: 12, marginTop: 16 }}>
        💡 <strong style={{ color: 'var(--text-2)' }}>Designregel:</strong> Brand-Farben sind absichtlich gedeckt. Status (rot/gelb/grün) muss immer stärker stechen als die Brand-Farbe — sonst sieht der Nutzer Brand-Akzente an, wo er Warnungen sehen sollte.
      </div>
    </div>
  );
}

// ── Mein Profil ───────────────────────────────────────────────────────────

const SPECIALTIES = [
  { value: '',          label: '— Keine Spezialisierung —' },
  { value: 'host',      label: '🎙️ Host / Moderator' },
  { value: 'editor',    label: '✂️ Cutter / Editor' },
  { value: 'thumbnail', label: '🎨 Thumbnail Designer' },
  { value: 'shownotes', label: '📝 Show Notes' },
  { value: 'social',    label: '📱 Social Media' },
  { value: 'audio',     label: '🎵 Audio Engineer' },
  { value: 'manager',   label: '⚙️ Manager / Producer' },
];

function ProfileSection({ me }) {
  const [name,      setName]      = useState(me?.name === me?.id ? '' : (me?.name ?? ''));
  const [specialty, setSpecialty] = useState(me?.specialty ?? '');
  const [status,    setStatus]    = useState('idle');
  const [error,     setError]     = useState(null);

  // Re-sync when me loads
  useEffect(() => {
    if (me) {
      // If name looks like an email, clear it so user can set a real name
      const isEmail = me.name?.includes('@');
      setName(isEmail ? '' : (me.name ?? ''));
      setSpecialty(me.specialty ?? '');
    }
  }, [me?.id]);

  const save = async () => {
    setStatus('saving'); setError(null);
    const r = await updateMyProfile({ fullName: name.trim() || undefined, specialty: specialty || undefined });
    setStatus(r.ok ? 'saved' : 'error');
    if (!r.ok) setError(r.error);
    else setTimeout(() => setStatus('idle'), 2000);
  };

  if (!me) return <div className="meta">Profil wird geladen…</div>;

  return (
    <div className="col gap-5">
      <div>
        <div className="h3 mb-1">Mein Profil</div>
        <div className="meta">Name und Rolle die andere sehen wenn du Tasks bearbeitest oder Kommentare schreibst.</div>
      </div>

      {/* Avatar preview */}
      <div className="row gap-4 items-center">
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'var(--brand)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700,
        }}>
          {(name || me.name || '?').split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{name || me.name || '—'}</div>
          <div className="meta">{me.role} · {me.id}</div>
        </div>
      </div>

      <div className="col gap-3" style={{ maxWidth: 420 }}>
        <div className="col gap-1">
          <label className="label">Name *</label>
          <input
            className="input"
            placeholder="Vor- und Nachname"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ fontSize: 14 }}
          />
          <div className="meta">Wird in der Sidebar und in Grüßen angezeigt.</div>
        </div>

        <div className="col gap-1">
          <label className="label">Spezialisierung</label>
          <select
            className="input"
            value={specialty}
            onChange={e => setSpecialty(e.target.value)}
            style={{ fontSize: 14 }}
          >
            {SPECIALTIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <div className="meta">Erscheint als Badge auf deinem Dashboard.</div>
        </div>

        {error && <div style={{ fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>}
        {status === 'saved' && <div style={{ fontSize: 12.5, color: 'var(--success)' }}>✓ Gespeichert — beim nächsten Login aktiv.</div>}

        <button
          className="btn btn-brand btn-sm"
          onClick={save}
          disabled={status === 'saving' || (!name.trim() && !specialty)}
          style={{ alignSelf: 'flex-start' }}
        >
          {status === 'saving' ? 'Wird gespeichert…' : 'Profil speichern'}
        </button>
      </div>
    </div>
  );
}

// ── Darstellung ───────────────────────────────────────────────────────────

const SURFACES = [
  { value: '',       label: 'Light',  desc: 'Helles, klassisches Interface', preview: '#f5f5f0' },
  { value: 'carbon', label: 'Dark',   desc: 'Dunkles Interface für Low-Light', preview: '#0e1014' },
];

const DENSITIES = [
  { value: '',        label: 'Normal',   desc: 'Standard-Abstände' },
  { value: 'compact', label: 'Kompakt',  desc: 'Dichtere Ansicht für mehr Inhalt' },
];

function AppearanceSection() {
  const [surface,  setSurface]  = useState(() => { try { return localStorage.getItem('cc.surface') ?? ''; } catch { return ''; } });
  const [density,  setDensity]  = useState(() => { try { return localStorage.getItem('cc.density') ?? ''; } catch { return ''; } });

  const applySurface = (val) => {
    setSurface(val);
    try { localStorage.setItem('cc.surface', val); } catch {}
    if (val) document.body.dataset.ccSurface = val;
    else delete document.body.dataset.ccSurface;
  };

  const applyDensity = (val) => {
    setDensity(val);
    try { localStorage.setItem('cc.density', val); } catch {}
    if (val) document.body.dataset.ccDensity = val;
    else delete document.body.dataset.ccDensity;
  };

  return (
    <div className="col gap-6">
      <div>
        <div className="h3 mb-1">Darstellung</div>
        <div className="meta">Persönliche Präferenzen — nur für dich, nicht workspace-weit.</div>
      </div>

      {/* Theme */}
      <div>
        <div className="label mb-3">Farbschema</div>
        <div className="row gap-3">
          {SURFACES.map(s => (
            <div key={s.value}
              onClick={() => applySurface(s.value)}
              style={{
                flex: 1, padding: '14px', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${surface === s.value ? 'var(--brand)' : 'var(--border-soft)'}`,
                background: surface === s.value ? 'var(--brand-soft)' : 'var(--bg-sunk)',
                transition: 'border-color 0.1s',
              }}>
              <div style={{ width: '100%', height: 48, borderRadius: 8, background: s.preview, marginBottom: 10, border: '1px solid var(--border-soft)' }} />
              <div style={{ fontWeight: 600, fontSize: 13 }}>{s.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Density */}
      <div>
        <div className="label mb-3">Dichte</div>
        <div className="row gap-3">
          {DENSITIES.map(d => (
            <div key={d.value}
              onClick={() => applyDensity(d.value)}
              style={{
                flex: 1, padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${density === d.value ? 'var(--brand)' : 'var(--border-soft)'}`,
                background: density === d.value ? 'var(--brand-soft)' : 'var(--bg-sunk)',
              }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{d.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{d.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="meta" style={{ background: 'var(--bg)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: 12 }}>
        💡 Änderungen werden sofort übernommen und beim nächsten Öffnen wiederhergestellt.
      </div>
    </div>
  );
}
