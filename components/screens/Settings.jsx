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

export function SettingsScreen() {
  const { currentWorkspaceId: workspace, currentWorkspace: brand } = useWorkspace();
  const [section, setSection] = useState('slack');

  const sections = [
    { id: 'workspace', label: 'Workspace', icon: <I.folder size={14} /> },
    { id: 'members',   label: 'Team & Roles', icon: <I.team size={14} /> },
    { id: 'slack',     label: 'Slack Integration', icon: <I.slack size={14} /> },
    { id: 'notifs',    label: 'Notifications', icon: <I.bell size={14} /> },
    { id: 'brand',     label: 'Brand Colors', icon: <I.flag size={14} /> },
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
          {section === 'slack' && <SlackSection />}
          {section === 'workspace' && <WorkspaceSection brand={brand} workspace={workspace} />}
          {section === 'members' && <MembersSection />}
          {section === 'notifs' && <NotifsSection />}
          {section === 'brand' && <BrandSection brand={brand} workspace={workspace} />}
        </div>
      </div>
    </div>
  );
}

function SlackSection() {
  const { currentWorkspace: brand, data } = useWorkspace();
  const projects = data.projects;
  const notifs = data.slackNotifications;
  // "Posts heute" + "Letzter Sync" — derived from the slack_notifications
  // mirror table. Both are best-effort: an admin who hasn't opened the
  // settings screen sees a slightly stale count, which is fine.
  const startOfDay = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const postsToday = notifs.filter((n) => {
    const t = new Date(n.time).getTime();
    return Number.isFinite(t) && t >= startOfDay;
  }).length;
  const mostRecentNotif = notifs[0];
  const lastSyncText = mostRecentNotif ? timeAgo(mostRecentNotif.time) : '—';
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
          <div className="meta mt-1">Pro Projekt ein Slack-Channel. Updates werden automatisch synchronisiert.</div>
        </div>
        <table className="table">
          <thead><tr><th>Projekt</th><th>Slack Channel</th><th>Auto-Updates</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td><div style={{ fontWeight: 500 }}>{p.name}</div></td>
                <td><span className="mono" style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{p.slackChannel}</span></td>
                <td>
                  <div className="row gap-1">
                    <Badge kind="ghost">Status</Badge>
                    <Badge kind="ghost">Blocked</Badge>
                    <Badge kind="ghost">Review</Badge>
                  </div>
                </td>
                <td>{p.slackConnected ? <Badge kind="success" dot>Connected</Badge> : <Badge kind="warning" dot>Not connected</Badge>}</td>
                <td><button className="btn btn-quiet btn-sm" disabled title="Per-Projekt Channel-Mapping kommt mit der nächsten Slack-Slice">Edit</button></td>
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

function WorkspaceSection({ brand, workspace }) {
  const { updateWorkspaceInCache } = useWorkspace();
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
      <div className="row gap-2 mt-3" style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 16 }}>
        <button
          className="btn btn-brand btn-sm"
          onClick={save}
          disabled={!dirty || status === 'saving'}
        >
          {status === 'saving' ? 'Wird gespeichert…' : 'Änderungen speichern'}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={discard}
          disabled={!dirty || status === 'saving'}
        >
          Verwerfen
        </button>
      </div>
    </div>
  );
}

function MembersSection() {
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
        <button className="btn btn-brand btn-sm" onClick={() => setInviteOpen(true)}><I.plus size={13} /> Einladen</button>
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

function BrandSection({ brand, workspace }) {
  const { updateWorkspaceInCache } = useWorkspace();
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
      <div className="row gap-2 mt-3" style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 16 }}>
        <button
          className="btn btn-brand btn-sm"
          onClick={save}
          disabled={!dirty || status === 'saving'}
        >
          {status === 'saving' ? 'Wird gespeichert…' : 'Farbe speichern'}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { setColor(brand.color); setStatus('idle'); setErrorMsg(null); }}
          disabled={!dirty || status === 'saving'}
        >
          Verwerfen
        </button>
      </div>
      <div className="meta" style={{ background: 'var(--bg)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: 12, marginTop: 16 }}>
        💡 <strong style={{ color: 'var(--text-2)' }}>Designregel:</strong> Brand-Farben sind absichtlich gedeckt. Status (rot/gelb/grün) muss immer stärker stechen als die Brand-Farbe — sonst sieht der Nutzer Brand-Akzente an, wo er Warnungen sehen sollte.
      </div>
    </div>
  );
}
