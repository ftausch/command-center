// Cmd+K — Command palette overlay
const { useEffect: useEffectCK, useState: useStateCK, useMemo, useRef } = React;

function CmdK({ open, onClose, workspace, setRoute }) {
  const [q, setQ] = useStateCK('');
  const [idx, setIdx] = useStateCK(0);
  const inputRef = useRef(null);
  const D = window.CC_DATA;

  useEffectCK(() => {
    if (open) {
      setQ('');
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const items = useMemo(() => {
    if (!open) return [];
    const ws = workspace;
    const tasks = D.tasks.filter(t => t.workspace === ws).map(t => ({
      kind: 'Task', id: t.id, label: t.title, sub: 'Task · ' + (D.projects.find(p => p.id === t.projectId)?.name || ''), action: () => { setRoute('project:' + t.projectId); onClose(); },
    }));
    const projects = D.projects.filter(p => p.workspace === ws).map(p => ({
      kind: 'Project', id: p.id, label: p.name, sub: 'Project · ' + p.status, action: () => { setRoute('project:' + p.id); onClose(); },
    }));
    const users = D.users.filter(u => u.workspaces.includes(ws)).map(u => ({
      kind: 'Person', id: u.id, label: u.name, sub: u.role, action: () => { setRoute('team'); onClose(); },
    }));
    const actions = [
      { kind: 'Action', id: 'new-task',  label: 'New Task',  sub: '⌘N',  action: () => { onClose(); } },
      { kind: 'Action', id: 'go-board',  label: 'Go to Board', sub: 'Navigation', action: () => { setRoute('kanban'); onClose(); } },
      { kind: 'Action', id: 'go-dash',   label: 'Go to Dashboard', sub: 'Navigation', action: () => { setRoute('dashboard'); onClose(); } },
      { kind: 'Action', id: 'switch-ws', label: 'Workspace wechseln', sub: 'Switcher', action: () => { setRoute('__switch__'); onClose(); } },
    ];
    const all = [...actions, ...projects, ...tasks, ...users];
    const filtered = q.trim() === '' ? all.slice(0, 12) : all.filter(it => (it.label + ' ' + it.sub).toLowerCase().includes(q.toLowerCase())).slice(0, 16);
    return filtered;
  }, [q, open, workspace]);

  useEffectCK(() => {
    const onKey = (e) => {
      if (!open) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(items.length - 1, i + 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); }
      if (e.key === 'Enter') { e.preventDefault(); items[idx]?.action(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, idx]);

  if (!open) return null;

  return (
    <div className="overlay" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: 100 }}>
      <div className="modal fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
          <I.search size={16} color="var(--text-3)" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            placeholder="Suche Tasks, Projekte, Personen oder Actions…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: 'var(--text-1)' }}
          />
          <Kbd>esc</Kbd>
        </div>
        <div style={{ maxHeight: 380, overflowY: 'auto', padding: 6 }}>
          {items.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              Keine Treffer in {D.brands[workspace].name}.
            </div>
          )}
          {items.map((it, i) => (
            <div
              key={it.kind + it.id}
              onMouseEnter={() => setIdx(i)}
              onClick={it.action}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 6, cursor: 'pointer',
                background: i === idx ? 'var(--bg-hover)' : 'transparent',
              }}
            >
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
                color: 'var(--text-3)', minWidth: 56,
              }}>{it.kind}</span>
              <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text-1)' }}>{it.label}</span>
              <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{it.sub}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)' }}>
          <span className="row gap-3">
            <span className="row gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> Navigate</span>
            <span className="row gap-1"><Kbd>↵</Kbd> Open</span>
          </span>
          <span>{D.brands[workspace].name}</span>
        </div>
      </div>
    </div>
  );
}

window.CmdK = CmdK;
