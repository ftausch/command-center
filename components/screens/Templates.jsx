'use client';
// Templates screen — stubbed.
//
// The full template engine (per-workspace template store, run-template
// action, default-config + auto-action toggles) is not yet built. The
// previous version of this screen read `data.templates`, which is
// populated only in mock mode — in production it returned a "no
// template found" empty state, and the auto-action toggles were pure
// CSS with no persistence.
//
// Showing decorative-but-non-functional UI in production is exactly
// what the Phase 1 audit flagged as a P0. So until templates are real,
// the screen renders a single explicit "kommt bald" card and exports
// helpers (Stat2, ToggleRow) that other screens still import.

import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Badge } from '@/components/ui';

export function TemplatesScreen() {
  const { currentWorkspace: brand } = useWorkspace();

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2">
            <Badge kind="brand" dot>{brand?.name}</Badge>
          </div>
          <h1 className="h1">Templates</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Wiederkehrende Workflows als Bauplan. Neue Episode = 1 Klick, alle Tasks vorausgefüllt.
          </p>
        </div>
      </div>

      <div
        className="card card-pad"
        style={{ maxWidth: 640, padding: '32px 28px' }}
      >
        <div className="row gap-3 mb-3">
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--bg-sunk)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <I.zap size={18} color="var(--text-3)" />
          </div>
          <div>
            <div className="h3">Templates kommen bald</div>
            <div className="meta mt-1">Phase 2 · noch keine Backend-Anbindung.</div>
          </div>
        </div>
        <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.55, margin: '0 0 16px' }}>
          Templates speichern wiederkehrende Workflows (Episoden-Setup, Newsletter, Clip-Batch) als
          Bauplan, sodass ein neues Projekt mit allen Tasks und Default-Owner per Klick angelegt
          wird. Sobald das Template-Backend steht, taucht hier die volle Konfiguration auf.
        </p>
        <p className="meta" style={{ margin: 0 }}>
          Bis dahin: Projekte und Tasks lassen sich manuell über{' '}
          <span className="mono">Projects → New Project</span> anlegen.
        </p>
      </div>
    </div>
  );
}

// Re-exported for Settings.jsx and SlackSection. These two are simple
// presentational components; the Templates screen above no longer uses
// them, but keeping the export avoids cross-screen churn.
export const Stat2 = ({ label, value }) => (
  <div>
    <div className="label">{label}</div>
    <div className="mono" style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{value}</div>
  </div>
);

export const ToggleRow = ({ label, on, onChange }) => (
  <div
    className="row between"
    onClick={onChange}
    style={onChange ? { cursor: 'pointer', userSelect: 'none' } : undefined}
  >
    <span style={{ fontSize: 13 }}>{label}</span>
    <span style={{
      width: 28, height: 16, borderRadius: 999, background: on ? 'var(--brand)' : 'var(--bg-sunk)',
      position: 'relative', transition: 'background 0.15s', flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', top: 2, left: on ? 14 : 2,
        width: 12, height: 12, borderRadius: 999, background: 'white',
        transition: 'left 0.15s',
      }} />
    </span>
  </div>
);
