'use client';
// Sprint Planning — create sprints, assign tasks, track burndown.

import { useEffect, useState, useMemo } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { DivisionSwitcher, useDivisionFilter } from '@/components/DivisionSwitcher';
import { Badge, PriorityBadge, StatusBadge } from '@/components/ui';
import { I } from '@/components/icons';
import { daysUntil } from '@/lib/utils';
import { listSprints, createSprint, updateSprint, deleteSprint, assignTaskToSprint } from '@/lib/actions/sprints';

const STATUS_COLOR = {
  planned:   'var(--text-3)',
  active:    'var(--brand)',
  completed: 'var(--success)',
};
const STATUS_LABEL = { planned: 'Geplant', active: 'Aktiv', completed: 'Abgeschlossen' };

function SprintForm({ initial, onSave, onCancel }) {
  const [name,  setName]  = useState(initial?.name  ?? '');
  const [goal,  setGoal]  = useState(initial?.goal  ?? '');
  const [start, setStart] = useState(initial?.startDate ?? '');
  const [end,   setEnd]   = useState(initial?.endDate   ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || !start || !end) return;
    setSaving(true);
    await onSave({ name: name.trim(), goal: goal || undefined, startDate: start, endDate: end });
    setSaving(false);
  };

  return (
    <div className="card card-pad col gap-3 mb-4">
      <div className="h3">{initial ? 'Sprint bearbeiten' : 'Neuer Sprint'}</div>
      <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
        <input autoFocus className="input" placeholder="Sprint-Name *" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()} style={{ flex: 2, minWidth: 180 }} />
        <input type="date" className="input" value={start} onChange={e => setStart(e.target.value)} title="Start" style={{ flex: 1 }} />
        <input type="date" className="input" value={end}   onChange={e => setEnd(e.target.value)}   title="Ende"  style={{ flex: 1 }} />
      </div>
      <input className="input" placeholder="Sprint-Ziel (optional)" value={goal} onChange={e => setGoal(e.target.value)} />
      <div className="row gap-2">
        <button className="btn btn-brand btn-sm" onClick={submit} disabled={saving || !name.trim() || !start || !end}>
          {saving ? '…' : initial ? 'Speichern' : 'Sprint erstellen'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>Abbrechen</button>
      </div>
    </div>
  );
}

function BurndownBar({ total, done }) {
  if (total === 0) return null;
  const pct = Math.round(done / total * 100);
  return (
    <div style={{ marginTop: 6 }}>
      <div className="row gap-2 items-center mb-1">
        <div style={{ flex: 1, height: 6, background: 'var(--bg-sunk)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--success)', borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-3)', minWidth: 30, textAlign: 'right' }}>{pct}%</span>
      </div>
      <div className="meta">{done}/{total} Tasks erledigt</div>
    </div>
  );
}

export function SprintBoardScreen({ setRoute }) {
  const { currentWorkspace: brand, currentWorkspaceId, data, updateTaskInCache } = useWorkspace();
  const filterByDivision = useDivisionFilter();
  const [sprints,    setSprints]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [formOpen,   setFormOpen]   = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [activeSprint, setActiveSprint] = useState(null);
  const [backlogOpen, setBacklogOpen] = useState(false);

  useEffect(() => {
    if (!currentWorkspaceId) return;
    listSprints(currentWorkspaceId).then(s => {
      setSprints(s);
      const active = s.find(x => x.status === 'active');
      if (active) setActiveSprint(active.id);
      else if (s.length > 0) setActiveSprint(s[0].id);
      setLoading(false);
    });
  }, [currentWorkspaceId]);

  const allTasks = useMemo(() => filterByDivision(
    data.tasks.map(t => ({
      ...t, division: data.projects.find(p => p.id === t.projectId)?.division ?? 'general',
    }))
  ), [data.tasks, data.projects, filterByDivision]);

  const backlogTasks = allTasks.filter(t => !t.sprintId && t.status !== 'Done');

  const handleCreate = async (fields) => {
    const r = await createSprint({ workspaceId: currentWorkspaceId, ...fields });
    if (r.ok && r.data) { setSprints(prev => [r.data, ...prev]); setFormOpen(false); setActiveSprint(r.data.id); }
  };

  const handleUpdate = async (fields) => {
    const r = await updateSprint({ workspaceId: currentWorkspaceId, sprintId: editing.id, patch: fields });
    if (r.ok && r.data) { setSprints(prev => prev.map(s => s.id === r.data.id ? r.data : s)); setEditing(null); }
  };

  const handleStatusChange = async (sprintId, status) => {
    const r = await updateSprint({ workspaceId: currentWorkspaceId, sprintId, patch: { status } });
    if (r.ok && r.data) setSprints(prev => prev.map(s => s.id === r.data.id ? r.data : s));
  };

  const handleDelete = async (sprintId) => {
    if (!window.confirm('Sprint wirklich löschen? Tasks bleiben erhalten.')) return;
    const r = await deleteSprint({ workspaceId: currentWorkspaceId, sprintId });
    if (r.ok) { setSprints(prev => prev.filter(s => s.id !== sprintId)); if (activeSprint === sprintId) setActiveSprint(sprints[0]?.id ?? null); }
  };

  const handleAssign = async (taskId, sprintId) => {
    await assignTaskToSprint({ workspaceId: currentWorkspaceId, taskId, sprintId });
    updateTaskInCache(taskId, { sprintId });
  };

  const selectedSprint = sprints.find(s => s.id === activeSprint);
  const sprintTasks = selectedSprint ? allTasks.filter(t => t.sprintId === selectedSprint.id) : [];
  const doneTasks   = sprintTasks.filter(t => t.status === 'Done');
  const openTasks   = sprintTasks.filter(t => t.status !== 'Done');

  const totalPoints = sprintTasks.reduce((s, t) => s + (t.estimate ?? 0), 0);
  const donePoints  = doneTasks.reduce((s, t) => s + (t.estimate ?? 0), 0);

  const today = new Date().toISOString().slice(0, 10);
  const daysLeft = selectedSprint ? Math.max(0, daysUntil(selectedSprint.endDate)) : null;
  const daysTotal = selectedSprint
    ? Math.max(1, Math.round((new Date(selectedSprint.endDate + 'T00:00:00') - new Date(selectedSprint.startDate + 'T00:00:00')) / 86400000))
    : null;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2"><Badge kind="brand" dot>{brand?.name}</Badge></div>
          <div className="row gap-3 items-center" style={{ flexWrap: 'wrap', marginBottom: 4 }}>
            <h1 className="h1" style={{ margin: 0 }}>Sprint-Planung</h1>
            <DivisionSwitcher />
          </div>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Wöchentliche oder zweiwöchentliche Sprints planen und tracken.
          </p>
        </div>
        <div className="row gap-2">
          <button className="btn btn-brand btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <I.plus size={13} /> Neuer Sprint
          </button>
        </div>
      </div>

      {(formOpen || editing) && (
        <SprintForm
          initial={editing ?? null}
          onSave={editing ? handleUpdate : handleCreate}
          onCancel={() => { setFormOpen(false); setEditing(null); }}
        />
      )}

      {loading && <div className="card card-pad meta" style={{ textAlign: 'center' }}>Laden…</div>}

      {!loading && sprints.length === 0 && !formOpen && (
        <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--text-4)', padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏃</div>
          Noch keine Sprints. Klicke "+ Neuer Sprint" um zu starten.
        </div>
      )}

      {!loading && sprints.length > 0 && (
        <div className="grid gap-5" style={{ gridTemplateColumns: '220px 1fr' }}>
          {/* Sprint list */}
          <div className="col gap-2">
            {sprints.map(s => {
              const sTasks = allTasks.filter(t => t.sprintId === s.id);
              const sDone  = sTasks.filter(t => t.status === 'Done').length;
              return (
                <div
                  key={s.id}
                  onClick={() => setActiveSprint(s.id)}
                  style={{
                    padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${s.id === activeSprint ? 'var(--brand)' : 'var(--border-soft)'}`,
                    background: s.id === activeSprint ? 'var(--brand-soft)' : 'var(--bg-card)',
                  }}
                >
                  <div className="row gap-2 items-center">
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[s.status], flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{s.name}</span>
                  </div>
                  <div className="meta mt-1">{s.startDate} — {s.endDate}</div>
                  {sTasks.length > 0 && <BurndownBar total={sTasks.length} done={sDone} />}
                </div>
              );
            })}
          </div>

          {/* Sprint detail */}
          {selectedSprint && (
            <div className="col gap-4">
              {/* Sprint header */}
              <div className="card card-pad">
                <div className="row gap-3 items-start">
                  <div style={{ flex: 1 }}>
                    <div className="row gap-2 items-center mb-1">
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[selectedSprint.status] }} />
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{selectedSprint.name}</span>
                      <span style={{ fontSize: 12, color: STATUS_COLOR[selectedSprint.status], fontWeight: 600 }}>{STATUS_LABEL[selectedSprint.status]}</span>
                    </div>
                    {selectedSprint.goal && <div style={{ fontSize: 13.5, color: 'var(--text-2)', marginBottom: 6 }}>🎯 {selectedSprint.goal}</div>}
                    <div className="meta">{selectedSprint.startDate} → {selectedSprint.endDate} {daysLeft !== null && selectedSprint.status === 'active' && `· noch ${daysLeft} Tage`}</div>
                  </div>
                  <div className="row gap-2">
                    {selectedSprint.status === 'planned' && (
                      <button className="btn btn-brand btn-sm" onClick={() => handleStatusChange(selectedSprint.id, 'active')}>▶ Starten</button>
                    )}
                    {selectedSprint.status === 'active' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => handleStatusChange(selectedSprint.id, 'completed')}>✓ Abschließen</button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(selectedSprint); setFormOpen(false); }}>✎</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(selectedSprint.id)}>✕</button>
                  </div>
                </div>

                <div className="row gap-4 mt-3" style={{ flexWrap: 'wrap' }}>
                  {[
                    { label: 'Tasks', value: sprintTasks.length },
                    { label: 'Erledigt', value: doneTasks.length },
                    { label: 'Offen', value: openTasks.length },
                    { label: 'Story Points', value: totalPoints > 0 ? `${donePoints}/${totalPoints}` : '—' },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{s.value}</div>
                      <div className="meta">{s.label}</div>
                    </div>
                  ))}
                </div>
                {sprintTasks.length > 0 && <BurndownBar total={sprintTasks.length} done={doneTasks.length} />}
              </div>

              {/* Sprint tasks */}
              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-soft)', fontSize: 13, fontWeight: 600 }}>
                  Tasks in diesem Sprint <span className="count">{sprintTasks.length}</span>
                </div>
                {sprintTasks.length === 0 ? (
                  <div style={{ padding: '20px 18px', color: 'var(--text-4)', fontSize: 13 }}>
                    Noch keine Tasks. Füge unten Tasks aus dem Backlog hinzu.
                  </div>
                ) : (
                  <table className="table">
                    <tbody>
                      {sprintTasks.map(t => {
                        const proj = data.projects.find(p => p.id === t.projectId);
                        return (
                          <tr key={t.id}>
                            <td style={{ fontWeight: 500 }}>{t.title}</td>
                            <td><StatusBadge status={t.status} /></td>
                            <td><PriorityBadge priority={t.priority} /></td>
                            <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{proj?.name}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{t.estimate ? `${t.estimate} SP` : '—'}</td>
                            <td>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: 11, color: 'var(--text-4)' }}
                                onClick={() => handleAssign(t.id, null)}
                              >
                                Entfernen
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Backlog */}
              <div className="card" style={{ overflow: 'hidden' }}>
                <div
                  className="row gap-2 items-center"
                  style={{ padding: '12px 18px', borderBottom: backlogOpen ? '1px solid var(--border-soft)' : 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                  onClick={() => setBacklogOpen(o => !o)}
                >
                  <span>Backlog — nicht zugeordnet</span>
                  <span className="count">{backlogTasks.length}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-4)' }}>{backlogOpen ? '▲' : '▼'}</span>
                </div>
                {backlogOpen && (
                  <table className="table">
                    <tbody>
                      {backlogTasks.length === 0 && (
                        <tr><td colSpan={5} style={{ padding: '16px 18px', color: 'var(--text-4)', fontSize: 13 }}>Backlog ist leer.</td></tr>
                      )}
                      {backlogTasks.map(t => {
                        const proj = data.projects.find(p => p.id === t.projectId);
                        return (
                          <tr key={t.id}>
                            <td style={{ fontWeight: 500 }}>{t.title}</td>
                            <td><PriorityBadge priority={t.priority} /></td>
                            <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{proj?.name}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{t.estimate ? `${t.estimate} SP` : '—'}</td>
                            <td>
                              <button
                                className="btn btn-brand btn-sm"
                                style={{ fontSize: 11 }}
                                onClick={() => handleAssign(t.id, selectedSprint.id)}
                              >
                                + Sprint
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
