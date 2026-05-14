'use client';
// Templates screen — browse workspace templates and create projects from them.
//
// Templates are static data (lib/data.js mock layer, same for all envs).
// "Template verwenden" opens an inline modal, collects project name + start
// date, calls createProjectFromTemplate, then navigates to the new project.

import { useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Badge } from '@/components/ui';
import { createProjectFromTemplate } from '@/lib/actions/templates';

// TODAY as a default start date for the modal
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function TemplatesScreen({ setRoute }) {
  const { currentWorkspace: brand, data } = useWorkspace();
  const templates = data.templates ?? {};

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2">
            <Badge kind="brand" dot>{brand?.name}</Badge>
          </div>
          <h1 className="h1">Templates</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Wiederkehrende Workflows als Bauplan — neues Projekt mit allen Tasks in einem Klick.
          </p>
        </div>
      </div>

      {Object.keys(templates).length === 0 && (
        <div className="card card-pad" style={{ maxWidth: 520 }}>
          <div className="meta">Keine Templates für diesen Workspace. Templates werden in einem späteren Update konfigurierbar.</div>
        </div>
      )}

      <div className="grid grid-2 gap-4">
        {Object.entries(templates).map(([key, tmpl]) => (
          <TemplateCard key={key} templateKey={key} template={tmpl} setRoute={setRoute} />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({ templateKey, template, setRoute }) {
  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const phases = [...new Set(template.tasks.map((t) => t.phase))];

  return (
    <>
      <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-soft)' }}>
          <div className="row gap-3 mb-2">
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-sunk)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <I.zap size={16} color="var(--brand)" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14.5 }}>{template.name}</div>
              <div className="meta mt-1">{template.desc}</div>
            </div>
          </div>
          <div className="row gap-3 mt-3" style={{ fontSize: 12, color: 'var(--text-3)' }}>
            <span className="row gap-1"><I.check size={11} /> {template.tasks.length} Tasks</span>
            <span>·</span>
            <span>ø {template.avgDuration}</span>
            <span>·</span>
            <span>{phases.length} Phasen</span>
          </div>
        </div>

        {/* Phase chips */}
        <div className="row gap-1 wrap" style={{ padding: '10px 18px', borderBottom: '1px solid var(--border-soft)' }}>
          {phases.map((p) => (
            <span key={p} className="badge ghost" style={{ fontSize: 11 }}>{p}</span>
          ))}
        </div>

        {/* Expandable task list */}
        {expanded && (
          <div style={{ borderBottom: '1px solid var(--border-soft)' }}>
            {phases.map((phase) => (
              <div key={phase}>
                <div style={{ padding: '8px 18px 4px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-4)' }}>
                  {phase}
                </div>
                {template.tasks.filter((t) => t.phase === phase).map((t, i) => (
                  <div key={i} className="row gap-3" style={{ padding: '6px 18px', fontSize: 13, color: 'var(--text-2)' }}>
                    <span className="mono" style={{ color: 'var(--text-4)', minWidth: 42, fontSize: 11 }}>+{t.daysFromStart}d</span>
                    <span style={{ flex: 1 }}>{t.title}</span>
                    <span className="meta">{t.owner}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="row between" style={{ padding: '12px 18px', marginTop: 'auto' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? <><I.chevron size={11} style={{ transform: 'rotate(-90deg)' }} /> Verbergen</> : <><I.chevron size={11} /> Tasks anzeigen</>}
          </button>
          <button
            className="btn btn-brand btn-sm"
            onClick={() => setModalOpen(true)}
          >
            <I.plus size={13} /> Template verwenden
          </button>
        </div>
      </div>

      {modalOpen && (
        <UseTemplateModal
          template={template}
          onClose={() => setModalOpen(false)}
          onCreated={(projectId) => {
            setModalOpen(false);
            setRoute('project:' + projectId);
          }}
        />
      )}
    </>
  );
}

function UseTemplateModal({ template, onClose, onCreated }) {
  const { currentWorkspaceId: workspaceId, addProject, addTask } = useWorkspace();
  const [name, setName] = useState(template.name);
  const [startDate, setStartDate] = useState(todayIso());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await createProjectFromTemplate({
      workspaceId,
      name: name.trim(),
      startDate,
      tasks: template.tasks.map((t) => ({ title: t.title, daysFromStart: t.daysFromStart })),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Fehler beim Anlegen');
      return;
    }
    addProject(result.data.project);
    result.data.tasks.forEach((t) => addTask(t));
    onCreated(result.data.project.id);
  };

  return (
    <div
      className="overlay"
      onClick={(e) => { if (e.target === e.currentTarget && !pending) onClose(); }}
    >
      <div className="modal fade-in" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-soft)' }}>
          <div className="h3">Neues Projekt aus Template</div>
          <div className="meta mt-1">{template.name} · {template.tasks.length} Tasks</div>
        </div>
        <form onSubmit={submit} className="col gap-4" style={{ padding: '20px 22px' }}>
          <div className="col gap-1">
            <label className="label">Projektname</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
              required
              autoFocus
            />
          </div>
          <div className="col gap-1">
            <label className="label">Startdatum</label>
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={pending}
              required
            />
            <div className="meta">Task-Deadlines werden relativ zum Startdatum berechnet.</div>
          </div>
          {error && (
            <div style={{ fontSize: 12.5, color: 'var(--danger)', padding: '6px 8px', background: 'var(--danger-bg)', borderRadius: 6, border: '1px solid var(--danger-border)' }}>
              {error}
            </div>
          )}
          <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={pending}>Abbrechen</button>
            <button type="submit" className="btn btn-brand btn-sm" disabled={pending || !name.trim() || !startDate}>
              {pending ? 'Wird angelegt…' : `Projekt anlegen (${template.tasks.length} Tasks)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Re-exported for Settings.jsx (SlackSection uses ToggleRow, Stat2).
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
