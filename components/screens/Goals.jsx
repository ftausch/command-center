'use client';
// Goals / OKR — quarterly objectives with key results.

import { useEffect, useState, useMemo } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { Avatar, Badge } from '@/components/ui';
import { I } from '@/components/icons';
import {
  listGoals, createGoal, updateGoal, deleteGoal,
  upsertKeyResult, deleteKeyResult,
} from '@/lib/actions/goals';

const STATUS_CONFIG = {
  on_track:  { label: 'On Track',   color: 'var(--success)',  bg: 'rgba(34,197,94,0.1)' },
  at_risk:   { label: 'At Risk',    color: 'var(--warning)',  bg: 'rgba(245,158,11,0.1)' },
  off_track: { label: 'Off Track',  color: 'var(--danger)',   bg: 'rgba(239,68,68,0.1)' },
  done:      { label: 'Erreicht',   color: 'var(--brand)',    bg: 'var(--brand-soft)' },
};

const CUR_YEAR = new Date().getFullYear();
const CUR_Q    = Math.ceil((new Date().getMonth() + 1) / 3);

function progressColor(pct) {
  if (pct >= 80) return 'var(--success)';
  if (pct >= 40) return 'var(--warning)';
  return 'var(--danger)';
}

function KRProgress({ kr }) {
  const pct = kr.target > 0 ? Math.min(100, Math.round(kr.current / kr.target * 100)) : 0;
  return (
    <div className="col gap-1">
      <div className="row gap-2 items-center">
        <span style={{ fontSize: 12.5, flex: 1 }}>{kr.title}</span>
        <span className="mono" style={{ fontSize: 11.5, color: progressColor(pct) }}>
          {kr.current}{kr.unit === '%' ? '' : ' '}{kr.unit} / {kr.target}{kr.unit === '%' ? '' : ' '}{kr.unit}
        </span>
      </div>
      <div style={{ height: 5, background: 'var(--bg-sunk)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: progressColor(pct), borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function KRForm({ goalId, workspaceId, initial, onSave, onCancel }) {
  const [title,   setTitle]   = useState(initial?.title   ?? '');
  const [target,  setTarget]  = useState(initial?.target  ?? 100);
  const [current, setCurrent] = useState(initial?.current ?? 0);
  const [unit,    setUnit]    = useState(initial?.unit    ?? '%');
  const [saving,  setSaving]  = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({ id: initial?.id, title: title.trim(), target: Number(target), current: Number(current), unit });
    setSaving(false);
  };

  return (
    <div className="row gap-2 items-center" style={{ flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--border-soft)' }}>
      <input autoFocus className="input" placeholder="Key Result…" value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()} style={{ flex: 3, minWidth: 160, height: 28, fontSize: 12.5 }} />
      <input type="number" className="input" value={current} onChange={e => setCurrent(e.target.value)}
        style={{ width: 70, height: 28, fontSize: 12.5 }} placeholder="Ist" />
      <input type="number" className="input" value={target} onChange={e => setTarget(e.target.value)}
        style={{ width: 70, height: 28, fontSize: 12.5 }} placeholder="Ziel" />
      <input className="input" value={unit} onChange={e => setUnit(e.target.value)}
        style={{ width: 55, height: 28, fontSize: 12.5 }} placeholder="%" />
      <button className="btn btn-brand btn-sm" onClick={submit} disabled={saving || !title.trim()}>{saving ? '…' : '✓'}</button>
      <button className="btn btn-ghost btn-sm" onClick={onCancel}>✕</button>
    </div>
  );
}

function GoalCard({ goal, workspaceId, members, projects, onUpdate, onDelete }) {
  const [addingKR,  setAddingKR]  = useState(false);
  const [editingKR, setEditingKR] = useState(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [titleDraft, setTitleDraft] = useState(goal.title);
  const [savingTitle, setSavingTitle] = useState(false);

  const sc = STATUS_CONFIG[goal.status];
  const overallPct = goal.keyResults.length > 0
    ? Math.round(goal.keyResults.reduce((s, kr) => s + (kr.target > 0 ? Math.min(100, kr.current / kr.target * 100) : 0), 0) / goal.keyResults.length)
    : null;

  const owner   = members.find(m => m.id === goal.ownerId);
  const project = projects.find(p => p.id === goal.projectId);

  const handleKRSave = async (fields) => {
    const r = await upsertKeyResult({ workspaceId, goalId: goal.id, ...fields });
    if (r.ok && r.data) {
      const krs = editingKR ? goal.keyResults.map(k => k.id === r.data.id ? r.data : k) : [...goal.keyResults, r.data];
      onUpdate({ ...goal, keyResults: krs });
    }
    setAddingKR(false); setEditingKR(null);
  };

  const handleKRDelete = async (krId) => {
    await deleteKeyResult({ goalId: goal.id, krId });
    onUpdate({ ...goal, keyResults: goal.keyResults.filter(k => k.id !== krId) });
  };

  const handleProgressKR = async (kr, delta) => {
    const next = Math.max(0, Math.min(kr.target, kr.current + delta));
    const r = await upsertKeyResult({ workspaceId, goalId: goal.id, id: kr.id, title: kr.title, target: kr.target, current: next, unit: kr.unit });
    if (r.ok) onUpdate({ ...goal, keyResults: goal.keyResults.map(k => k.id === kr.id ? r.data : k) });
  };

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
        <div className="row gap-3 items-start">
          <div style={{ flex: 1, minWidth: 0 }}>
            {editingGoal ? (
              <div className="row gap-2">
                <input autoFocus className="input" value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter') { setSavingTitle(true); await onUpdate({ ...goal, title: titleDraft }); const r = await updateGoal({ workspaceId, goalId: goal.id, patch: { title: titleDraft } }); if (r.ok) onUpdate(r.data); setSavingTitle(false); setEditingGoal(false); }
                    if (e.key === 'Escape') setEditingGoal(false);
                  }}
                  style={{ flex: 1, fontSize: 14, fontWeight: 600 }} />
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingGoal(false)}>✕</button>
              </div>
            ) : (
              <div
                style={{ fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
                onClick={() => setEditingGoal(true)}
              >{goal.title}</div>
            )}
            <div className="row gap-2 mt-1" style={{ flexWrap: 'wrap' }}>
              {owner  && <span className="meta">👤 {owner.name.split(' ')[0]}</span>}
              {project && <span className="meta">📁 {project.name}</span>}
              {overallPct !== null && (
                <span className="mono" style={{ fontSize: 11, color: progressColor(overallPct) }}>{overallPct}% gesamt</span>
              )}
            </div>
          </div>
          <div className="row gap-2 items-center">
            <select
              className="input"
              value={goal.status}
              onChange={async e => {
                const r = await updateGoal({ workspaceId, goalId: goal.id, patch: { status: e.target.value } });
                if (r.ok) onUpdate(r.data);
              }}
              style={{ height: 26, fontSize: 11.5, padding: '0 4px' }}
            >
              {Object.entries(STATUS_CONFIG).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
            </select>
            <span
              style={{ width: 8, height: 8, borderRadius: '50%', background: sc.color, flexShrink: 0 }}
            />
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--danger)' }}
              onClick={() => { if (window.confirm('Ziel wirklich löschen?')) onDelete(goal.id); }}>✕</button>
          </div>
        </div>
      </div>

      {/* Key Results */}
      <div style={{ padding: '10px 18px 14px' }}>
        <div className="col gap-3">
          {goal.keyResults.length === 0 && !addingKR && (
            <div className="meta">Noch keine Key Results.</div>
          )}
          {goal.keyResults.map(kr => (
            <div key={kr.id}>
              {editingKR?.id === kr.id ? (
                <KRForm goalId={goal.id} workspaceId={workspaceId} initial={kr} onSave={handleKRSave} onCancel={() => setEditingKR(null)} />
              ) : (
                <div className="row gap-2 items-start">
                  <div style={{ flex: 1 }}><KRProgress kr={kr} /></div>
                  <div className="row gap-1" style={{ flexShrink: 0, marginTop: 2 }}>
                    <button style={{ background: 'none', border: '1px solid var(--border-soft)', borderRadius: 4, padding: '1px 6px', fontSize: 11, cursor: 'pointer' }} onClick={() => handleProgressKR(kr, -1)}>−</button>
                    <button style={{ background: 'none', border: '1px solid var(--border-soft)', borderRadius: 4, padding: '1px 6px', fontSize: 11, cursor: 'pointer' }} onClick={() => handleProgressKR(kr, 1)}>+</button>
                    <button style={{ background: 'none', border: 'none', fontSize: 11, cursor: 'pointer', color: 'var(--text-4)' }} onClick={() => setEditingKR(kr)}>✎</button>
                    <button style={{ background: 'none', border: 'none', fontSize: 11, cursor: 'pointer', color: 'var(--danger)' }} onClick={() => handleKRDelete(kr.id)}>✕</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {addingKR && (
            <KRForm goalId={goal.id} workspaceId={workspaceId} onSave={handleKRSave} onCancel={() => setAddingKR(false)} />
          )}
        </div>
        {!addingKR && !editingKR && (
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 10, fontSize: 11 }} onClick={() => setAddingKR(true)}>
            + Key Result
          </button>
        )}
      </div>
    </div>
  );
}

function GoalForm({ onSave, onCancel, members, projects }) {
  const now = new Date();
  const [title,   setTitle]   = useState('');
  const [desc,    setDesc]    = useState('');
  const [quarter, setQuarter] = useState(String(CUR_Q));
  const [year,    setYear]    = useState(String(CUR_YEAR));
  const [ownerId, setOwnerId] = useState('');
  const [projId,  setProjId]  = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({ title: title.trim(), description: desc || undefined, quarter: Number(quarter), year: Number(year), ownerId: ownerId || undefined, projectId: projId || undefined });
    setSaving(false);
  };

  return (
    <div className="card card-pad col gap-3 mb-4">
      <div className="h3">Neues Ziel</div>
      <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
        <input autoFocus className="input" placeholder="Ziel-Titel *" value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()} style={{ flex: 3, minWidth: 200 }} />
        <select className="input" value={quarter} onChange={e => setQuarter(e.target.value)} style={{ flex: 1 }}>
          {[1,2,3,4].map(q => <option key={q} value={q}>Q{q}</option>)}
        </select>
        <input type="number" className="input" value={year} onChange={e => setYear(e.target.value)} style={{ width: 80 }} />
      </div>
      <input className="input" placeholder="Beschreibung (optional)" value={desc} onChange={e => setDesc(e.target.value)} />
      <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
        <select className="input" value={ownerId} onChange={e => setOwnerId(e.target.value)} style={{ flex: 1 }}>
          <option value="">— Kein Owner —</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className="input" value={projId} onChange={e => setProjId(e.target.value)} style={{ flex: 1 }}>
          <option value="">— Kein Projekt —</option>
          {projects.filter(p => p.status !== 'Done').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="row gap-2">
        <button className="btn btn-brand btn-sm" onClick={submit} disabled={saving || !title.trim()}>{saving ? '…' : 'Ziel erstellen'}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>Abbrechen</button>
      </div>
    </div>
  );
}

export function GoalsScreen() {
  const { currentWorkspace: brand, currentWorkspaceId, data } = useWorkspace();
  const [goals,   setGoals]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [year,    setYear]    = useState(CUR_YEAR);
  const [quarter, setQuarter] = useState(CUR_Q);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (!currentWorkspaceId) return;
    listGoals(currentWorkspaceId, year, quarter).then(g => { setGoals(g); setLoading(false); });
  }, [currentWorkspaceId, year, quarter]);

  const handleCreate = async (fields) => {
    const r = await createGoal({ workspaceId: currentWorkspaceId, ...fields });
    if (r.ok && r.data) { setGoals(prev => [...prev, r.data]); setFormOpen(false); }
  };

  const handleUpdate = (updated) => setGoals(prev => prev.map(g => g.id === updated.id ? updated : g));
  const handleDelete = async (goalId) => {
    await deleteGoal({ workspaceId: currentWorkspaceId, goalId });
    setGoals(prev => prev.filter(g => g.id !== goalId));
  };

  const onTrack  = goals.filter(g => g.status === 'on_track').length;
  const atRisk   = goals.filter(g => g.status === 'at_risk').length;
  const offTrack = goals.filter(g => g.status === 'off_track').length;
  const done     = goals.filter(g => g.status === 'done').length;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2"><Badge kind="brand" dot>{brand?.name}</Badge></div>
          <div className="row gap-3 items-center" style={{ flexWrap: 'wrap', marginBottom: 4 }}>
            <h1 className="h1" style={{ margin: 0 }}>Ziele & OKRs</h1>
          </div>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Quartals-Objectives mit Key Results tracken.
          </p>
        </div>
        <div className="row gap-2">
          <select className="input" value={quarter} onChange={e => setQuarter(Number(e.target.value))} style={{ height: 32, fontSize: 12 }}>
            {[1,2,3,4].map(q => <option key={q} value={q}>Q{q}</option>)}
          </select>
          <select className="input" value={year} onChange={e => setYear(Number(e.target.value))} style={{ height: 32, fontSize: 12 }}>
            {[CUR_YEAR - 1, CUR_YEAR, CUR_YEAR + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-brand btn-sm" onClick={() => setFormOpen(true)}>
            <I.plus size={13} /> Neues Ziel
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="row gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
        {[
          { label: 'On Track',   value: onTrack,  color: 'var(--success)' },
          { label: 'At Risk',    value: atRisk,   color: 'var(--warning)' },
          { label: 'Off Track',  value: offTrack, color: 'var(--danger)' },
          { label: 'Erreicht',   value: done,     color: 'var(--brand)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '10px 16px', minWidth: 90 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div className="meta">{s.label}</div>
          </div>
        ))}
      </div>

      {formOpen && (
        <GoalForm members={data.members} projects={data.projects} onSave={handleCreate} onCancel={() => setFormOpen(false)} />
      )}

      {loading && <div className="card card-pad meta" style={{ textAlign: 'center' }}>Laden…</div>}

      {!loading && goals.length === 0 && !formOpen && (
        <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--text-4)', padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
          Noch keine Ziele für Q{quarter} {year}. Klicke "+ Neues Ziel".
        </div>
      )}

      <div className="col gap-4">
        {goals.map(goal => (
          <GoalCard
            key={goal.id}
            goal={goal}
            workspaceId={currentWorkspaceId}
            members={data.members}
            projects={data.projects}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
