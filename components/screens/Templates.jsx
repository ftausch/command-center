'use client';
// Templates screen

import { useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Badge } from '@/components/ui';
import { Field } from '@/components/screens/ProjectDetail';

export function TemplatesScreen() {
  const { currentWorkspaceId: workspace, currentWorkspace: brand, data, workspaces } = useWorkspace();
  const templates = data.templates;
  const [selected, setSelected] = useState(workspace);

  const t = templates[selected] || templates[workspace];
  if (!t) {
    return (
      <div className="page fade-in">
        <p className="meta">Kein Template gefunden für diesen Workspace.</p>
      </div>
    );
  }

  // The Templates screen shows phases for the chosen template, which may
  // belong to a different workspace than the current one. We fall back to the
  // current workspace's phases if the alternate workspace's phases aren't
  // loaded (mock has both; supabase mode would need extra fetches later).
  const ph = data.phases;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2"><Badge kind="brand" dot>{brand?.name}</Badge></div>
          <h1 className="h1">Templates</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Wiederkehrende Workflows als Bauplan. Neue Episode = 1 Klick, alle Tasks vorausgefüllt.
          </p>
        </div>
        <div className="row gap-2">
          <button className="btn btn-ghost btn-sm"><I.archive size={13} /> Archive</button>
          <button className="btn btn-brand btn-sm"><I.plus size={13} /> Template aus diesem Projekt</button>
        </div>
      </div>

      <div className="row gap-2 mb-4 wrap">
        {Object.keys(templates).map((id) => {
          const tpl = workspaces.find((w) => w.id === id);
          return (
            <button key={id} className={`chip ${selected === id ? 'active' : ''}`} onClick={() => setSelected(id)}>
              <span className="dot-indicator" style={{ background: tpl?.color }} />
              {tpl?.name ?? id}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-soft)' }}>
            <div className="row between">
              <div>
                <div className="h2">{t.name}</div>
                <div className="meta mt-1">{t.desc}</div>
              </div>
              <button className="btn btn-brand btn-sm"><I.zap size={13} /> Run Template</button>
            </div>
            <div className="row gap-4 mt-3">
              <Stat2 label="Tasks" value={t.tasks.length} />
              <Stat2 label="Ø Durchlauf" value={t.avgDuration} />
              <Stat2 label="Phasen" value={ph.length} />
              <Stat2 label="Letzter Run" value="Ep. 048" />
            </div>
          </div>

          <div>
            {ph.map((phase, pi) => {
              const phaseTasks = t.tasks.filter((tk) => tk.phase === phase);
              if (phaseTasks.length === 0) return null;
              return (
                <div key={phase}>
                  <div style={{ padding: '12px 20px 8px', borderTop: pi === 0 ? 'none' : '1px solid var(--border-soft)', background: 'var(--bg)' }} className="row gap-2">
                    <span style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--brand-soft)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }} className="mono">{pi + 1}</span>
                    <span className="label">{phase}</span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{phaseTasks.length}</span>
                  </div>
                  {phaseTasks.map((tk, i) => (
                    <div key={i} className="row gap-3" style={{ padding: '10px 20px', borderTop: '1px solid var(--border-soft)' }}>
                      <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 999, border: '1.5px solid var(--border-strong)' }} />
                      <div style={{ flex: 1, fontSize: 13.5 }}>{tk.title}</div>
                      <span className="badge ghost" style={{ fontSize: 11 }}>Owner: {tk.owner}</span>
                      <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-3)', minWidth: 50, textAlign: 'right' }}>Tag +{tk.daysFromStart}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <div className="col gap-4">
          <div className="card card-pad">
            <div className="label mb-3">Default-Konfiguration</div>
            <Field label="Auto-Slack Channel">#{selected}-ep-{`<nr>`}</Field>
            <Field label="Default Owner">Manager</Field>
            <Field label="Default Reviewer">Owner (Fabian)</Field>
            <Field label="Phasen">
              <div className="row gap-1 wrap">
                {ph.map((p) => <span key={p} className="badge ghost" style={{ fontSize: 11 }}>{p}</span>)}
              </div>
            </Field>
          </div>

          <div className="card card-pad">
            <div className="label mb-3">Auto-Aktionen</div>
            <div className="col gap-3">
              <ToggleRow on label="Slack-Channel beim Start erstellen" />
              <ToggleRow on label="Recording → Termin im Kalender" />
              <ToggleRow on label="Bei 'Done' → Slack-Notif #releases" />
              <ToggleRow label="Performance-Tracking nach Publish" />
            </div>
          </div>

          <div className="card card-pad" style={{ background: 'var(--brand-soft)', borderColor: 'var(--brand)' }}>
            <div className="row gap-2"><I.zap size={14} color="var(--brand)" /><span style={{ fontWeight: 600 }}>Schneller Start</span></div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '6px 0 12px' }}>
              Run Template erstellt automatisch ein neues Projekt, legt alle {t.tasks.length} Tasks an und verteilt sie an die Default-Rollen.
            </p>
            <button className="btn btn-brand btn-sm" style={{ width: '100%' }}>Run "{t.name.split('·')[1]?.trim() || 'Template'}"</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Stat2 = ({ label, value }) => (
  <div>
    <div className="label">{label}</div>
    <div className="mono" style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{value}</div>
  </div>
);

export const ToggleRow = ({ label, on }) => (
  <div className="row between">
    <span style={{ fontSize: 13 }}>{label}</span>
    <span style={{
      width: 28, height: 16, borderRadius: 999, background: on ? 'var(--brand)' : 'var(--bg-sunk)',
      position: 'relative', transition: 'background 0.15s',
    }}>
      <span style={{
        position: 'absolute', top: 2, left: on ? 14 : 2,
        width: 12, height: 12, borderRadius: 999, background: 'white',
        transition: 'left 0.15s',
      }} />
    </span>
  </div>
);
