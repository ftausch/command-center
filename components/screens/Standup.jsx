'use client';
// Team Standup screen — daily async check-ins visible to the whole team.

import { useEffect, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { Avatar, Badge } from '@/components/ui';
import { listStandups, upsertStandup } from '@/lib/actions/standups';

const TODAY = new Date().toISOString().slice(0, 10);

function formatDay(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function StandupWidget({ compact = false }) {
  const { currentWorkspaceId, data, me } = useWorkspace();
  const [entries, setEntries] = useState([]);
  const [mine, setMine] = useState({ today: '', blockers: '', yesterday: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!currentWorkspaceId) return;
    listStandups(currentWorkspaceId, TODAY).then(setEntries);
  }, [currentWorkspaceId]);

  const myEntry = entries.find(e => e.userId === me?.id);

  useEffect(() => {
    if (myEntry) setMine({ today: myEntry.today ?? '', blockers: myEntry.blockers ?? '', yesterday: myEntry.yesterday ?? '' });
  }, [myEntry?.userId]);

  const save = async () => {
    if (!currentWorkspaceId) return;
    setSaving(true);
    const r = await upsertStandup({ workspaceId: currentWorkspaceId, date: TODAY, ...mine });
    if (r.ok && r.data) {
      setEntries(prev => {
        const filtered = prev.filter(e => e.userId !== r.data.userId);
        return [...filtered, r.data];
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  const others = entries.filter(e => e.userId !== me?.id);

  if (compact) {
    return (
      <div className="card" style={{ overflow: 'hidden' }}>
        <div
          className="row gap-2 items-center"
          style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: open ? '1px solid var(--border-soft)' : 'none' }}
          onClick={() => setOpen(o => !o)}
        >
          <span style={{ fontSize: 16 }}>☀️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Team Standup · {formatDay(TODAY)}</div>
            <div className="meta">{entries.length} von {data.members.length} ausgefüllt</div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-4)' }}>{open ? '▲' : '▼'}</span>
        </div>
        {open && <StandupBody entries={entries} mine={mine} setMine={setMine} save={save} saving={saving} saved={saved} me={me} members={data.members} others={others} />}
      </div>
    );
  }

  return (
    <div className="card card-pad">
      <div className="row gap-2 items-center mb-4">
        <span style={{ fontSize: 20 }}>☀️</span>
        <div>
          <div className="h3">Team Standup</div>
          <div className="meta">{formatDay(TODAY)}</div>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{entries.length}/{data.members.length} ausgefüllt</span>
      </div>
      <StandupBody entries={entries} mine={mine} setMine={setMine} save={save} saving={saving} saved={saved} me={me} members={data.members} others={others} />
    </div>
  );
}

function StandupBody({ entries, mine, setMine, save, saving, saved, me, members, others }) {
  return (
    <div style={{ padding: '0 0' }}>
      {/* My standup */}
      <div style={{ padding: '12px 16px', background: 'var(--brand-soft)', borderRadius: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand)', marginBottom: 8 }}>Mein heutiger Status</div>
        <div className="col gap-2">
          <div>
            <div className="label" style={{ marginBottom: 3 }}>Was mache ich heute?</div>
            <textarea
              className="input"
              value={mine.today}
              onChange={e => setMine(m => ({ ...m, today: e.target.value }))}
              placeholder="z.B. Episode 47 schneiden, Newsletter Draft schreiben…"
              rows={2}
              style={{ resize: 'vertical', fontSize: 13 }}
            />
          </div>
          <div>
            <div className="label" style={{ marginBottom: 3 }}>Was habe ich gestern erledigt?</div>
            <textarea
              className="input"
              value={mine.yesterday}
              onChange={e => setMine(m => ({ ...m, yesterday: e.target.value }))}
              placeholder="Optional…"
              rows={1}
              style={{ resize: 'vertical', fontSize: 13 }}
            />
          </div>
          <div>
            <div className="label" style={{ marginBottom: 3 }}>Blockiert durch…</div>
            <input
              className="input"
              value={mine.blockers}
              onChange={e => setMine(m => ({ ...m, blockers: e.target.value }))}
              placeholder="Optional — falls nichts, leer lassen"
              style={{ fontSize: 13 }}
            />
          </div>
          <button
            className="btn btn-brand btn-sm"
            onClick={save}
            disabled={saving || !mine.today.trim()}
            style={{ alignSelf: 'flex-start' }}
          >
            {saving ? '…' : saved ? '✓ Gespeichert' : 'Standup speichern'}
          </button>
        </div>
      </div>

      {/* Team standups */}
      {others.length > 0 && (
        <div className="col gap-3">
          <div className="label">Team</div>
          {others.map(entry => {
            const user = members.find(m => m.id === entry.userId);
            if (!user) return null;
            return (
              <div key={entry.id} className="row gap-3 items-start" style={{ padding: '10px 0', borderTop: '1px solid var(--border-soft)' }}>
                <Avatar user={user} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{user.name}</div>
                  {entry.today && (
                    <div style={{ fontSize: 12.5, color: 'var(--text-1)', marginBottom: 2 }}>
                      <span style={{ color: 'var(--text-4)', marginRight: 4 }}>Heute:</span>{entry.today}
                    </div>
                  )}
                  {entry.yesterday && (
                    <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 2 }}>
                      <span style={{ color: 'var(--text-4)', marginRight: 4 }}>Gestern:</span>{entry.yesterday}
                    </div>
                  )}
                  {entry.blockers && (
                    <div style={{ fontSize: 12.5, color: 'var(--danger)' }}>
                      <span style={{ color: 'var(--text-4)', marginRight: 4 }}>Blockiert:</span>{entry.blockers}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {others.length === 0 && (
        <div className="meta" style={{ textAlign: 'center', padding: '12px 0' }}>
          Noch kein anderes Teammitglied hat heute einen Standup eingereicht.
        </div>
      )}
    </div>
  );
}

export function StandupScreen() {
  const { currentWorkspace: brand } = useWorkspace();
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2"><Badge kind="brand" dot>{brand?.name}</Badge></div>
          <h1 className="h1" style={{ margin: 0 }}>Team Standup</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Tägliche Async-Updates — was macht jeder, was blockiert das Team?
          </p>
        </div>
      </div>
      <StandupWidget compact={false} />
    </div>
  );
}
