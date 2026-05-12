// Kanban Board
const { useState: useStateKB, useMemo: useMemoKB } = React;

const KANBAN_COLS = ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'];

function KanbanScreen({ workspace, setRoute }) {
  const D = window.CC_DATA;
  const [projectFilter, setProjectFilter] = useStateKB('all');
  const [groupBy, setGroupBy] = useStateKB('status');

  const tasks = useMemoKB(() => {
    let r = D.tasks.filter(t => t.workspace === workspace);
    if (projectFilter !== 'all') r = r.filter(t => t.projectId === projectFilter);
    return r;
  }, [workspace, projectFilter]);

  const grouped = useMemoKB(() => {
    const g = {};
    KANBAN_COLS.forEach(c => g[c] = []);
    g['Blocked'] = [];
    tasks.forEach(t => {
      if (t.status === 'Blocked') g['Blocked'].push(t);
      else (g[t.status] = g[t.status] || []).push(t);
    });
    return g;
  }, [tasks]);

  const projects = D.projects.filter(p => p.workspace === workspace);

  return (
    <div className="page fade-in" style={{ paddingBottom: 24 }}>
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2"><Badge kind="brand" dot>{D.brands[workspace].name}</Badge></div>
          <h1 className="h1">Board</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Status-Spalten über alle Projekte. Drag (visuell) zwischen Spalten zum Verschieben.
          </p>
        </div>
        <div className="row gap-2">
          <select className="input" style={{ width: 220, height: 32 }} value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
            <option value="all">Alle Projekte ({projects.length})</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm">Group: Status <I.chevronDown size={12} /></button>
          <button className="btn btn-brand btn-sm"><I.plus size={13} /> New Task</button>
        </div>
      </div>

      <div className="row gap-2 mb-4 wrap">
        <span className="meta">Filter:</span>
        <button className="chip active">Alle <span className="count">{tasks.length}</span></button>
        <button className="chip"><span className="dot-indicator danger" /> High <span className="count">{tasks.filter(t => t.priority === 'High').length}</span></button>
        <button className="chip">Assignee: Me</button>
        <button className="chip">Has Slack</button>
        <button className="chip"><I.filter size={11} /> Mehr</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(260px, 1fr))', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
        {KANBAN_COLS.map(col => (
          <KColumn key={col} title={col} tasks={grouped[col] || []} blocked={col === 'In Progress' ? grouped['Blocked'] : null} workspace={workspace} setRoute={setRoute} />
        ))}
      </div>
    </div>
  );
}

function KColumn({ title, tasks, blocked, workspace, setRoute }) {
  const D = window.CC_DATA;
  const allTasks = blocked ? [...tasks, ...(blocked || [])] : tasks;
  return (
    <div style={{ background: 'transparent', minHeight: 400 }}>
      <div className="row between" style={{ padding: '8px 4px 10px' }}>
        <div className="row gap-2">
          <span className="dot-indicator" style={{ background: kColColor(title) }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.005em' }}>{title}</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{allTasks.length}</span>
        </div>
        <button className="btn btn-icon btn-sm btn-quiet"><I.plus size={13} /></button>
      </div>

      <div className="col gap-2">
        {allTasks.map(t => <KCard key={t.id} task={t} workspace={workspace} setRoute={setRoute} isBlockedSection={t.status === 'Blocked'} />)}
        {allTasks.length === 0 && (
          <div style={{
            padding: 14, borderRadius: 8, border: '1.5px dashed var(--border)',
            color: 'var(--text-4)', fontSize: 12, textAlign: 'center',
          }}>
            Leer. Tasks hier ablegen.
          </div>
        )}
        <button style={{
          padding: '8px 10px', border: '1px solid transparent', background: 'transparent', color: 'var(--text-3)',
          textAlign: 'left', fontSize: 12.5, borderRadius: 6, cursor: 'pointer',
        }}><I.plus size={12} /> Add task</button>
      </div>
    </div>
  );
}

function kColColor(c) {
  return ({
    Backlog: 'var(--neutral)',
    'To Do': 'var(--text-3)',
    'In Progress': 'var(--info)',
    Review: 'var(--warning)',
    Done: 'var(--success)',
  })[c] || 'var(--neutral)';
}

function KCard({ task, workspace, setRoute, isBlockedSection }) {
  const D = window.CC_DATA;
  const a = D.users.find(u => u.id === task.assignee);
  const p = D.projects.find(pr => pr.id === task.projectId);
  const td = dueLabel(task.due);
  return (
    <div
      onClick={() => setRoute('project:' + task.projectId)}
      style={{
        background: 'var(--bg-elev)',
        border: `1px solid ${task.status === 'Blocked' ? 'var(--danger-border)' : 'var(--border)'}`,
        borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
        boxShadow: 'var(--shadow-sm)',
        transition: 'border-color 0.12s, transform 0.12s',
      }}
    >
      {task.status === 'Blocked' && (
        <div className="row gap-1 mb-2" style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 500 }}>
          <I.block size={11} /> Blocked
        </div>
      )}
      <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.35, marginBottom: 6 }}>{task.title}</div>
      {(task.blocker || task.waitingOn) && (
        <div className="meta mb-2" style={{ fontSize: 11.5 }}>
          {task.blocker || 'Wartet auf ' + D.users.find(u => u.id === task.waitingOn)?.name}
        </div>
      )}
      <div className="row gap-2" style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>
        <span className="truncate" style={{ flex: 1 }}>{p?.name}</span>
      </div>
      <div className="row between">
        <div className="row gap-2">
          <Avatar user={a} />
          <PriorityBadge priority={task.priority} />
        </div>
        <span className={`badge ${td.danger ? 'danger' : td.today ? 'warning' : 'ghost'}`}>{td.text}</span>
      </div>
    </div>
  );
}

window.KanbanScreen = KanbanScreen;
