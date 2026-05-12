// My Tasks screen
const { useState: useStateMT, useMemo: useMemoMT } = React;

function MyTasksScreen({ workspace, setRoute }) {
  const D = window.CC_DATA;
  const me = D.users[0];
  const [tab, setTab] = useStateMT('all');
  const [groupBy, setGroupBy] = useStateMT('project');
  const [filterPrio, setFilterPrio] = useStateMT(null);

  const myTasks = useMemoMT(() => D.tasks.filter(t => t.workspace === workspace && t.assignee === me.id), [workspace]);

  const filtered = useMemoMT(() => {
    let r = myTasks;
    if (tab === 'today')  r = r.filter(t => daysUntil(t.due) === 0 && t.status !== 'Done');
    if (tab === 'week')   r = r.filter(t => daysUntil(t.due) >= 0 && daysUntil(t.due) <= 7 && t.status !== 'Done');
    if (tab === 'overdue')r = r.filter(t => daysUntil(t.due) < 0 && t.status !== 'Done');
    if (tab === 'blocked')r = r.filter(t => t.status === 'Blocked');
    if (tab === 'waiting')r = r.filter(t => t.status === 'Review' || t.waitingOn);
    if (filterPrio) r = r.filter(t => t.priority === filterPrio);
    return r;
  }, [myTasks, tab, filterPrio]);

  const counts = {
    all: myTasks.filter(t => t.status !== 'Done').length,
    today: myTasks.filter(t => daysUntil(t.due) === 0 && t.status !== 'Done').length,
    week: myTasks.filter(t => daysUntil(t.due) >= 0 && daysUntil(t.due) <= 7 && t.status !== 'Done').length,
    overdue: myTasks.filter(t => daysUntil(t.due) < 0 && t.status !== 'Done').length,
    blocked: myTasks.filter(t => t.status === 'Blocked').length,
    waiting: myTasks.filter(t => t.status === 'Review' || t.waitingOn).length,
  };

  const grouped = useMemoMT(() => {
    if (groupBy === 'project') {
      const groups = {};
      filtered.forEach(t => {
        const p = D.projects.find(pr => pr.id === t.projectId);
        const key = p?.name || 'Ohne Projekt';
        (groups[key] = groups[key] || []).push(t);
      });
      return groups;
    }
    if (groupBy === 'priority') {
      const groups = { High: [], Medium: [], Low: [] };
      filtered.forEach(t => groups[t.priority]?.push(t));
      return groups;
    }
    return { 'Alle': filtered };
  }, [filtered, groupBy]);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2">
            <Badge kind="brand" dot>{D.brands[workspace].name}</Badge>
            <span style={{ color: 'var(--text-3)', fontSize: 12.5 }}>Deine persönliche Ansicht</span>
          </div>
          <h1 className="h1">My Tasks</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            Alles, was dir zugewiesen ist — geordnet nach dem, was als Nächstes zählt.
          </p>
        </div>
        <div className="row gap-2">
          <button className="btn btn-ghost btn-sm">Group: {groupBy === 'project' ? 'Project' : groupBy === 'priority' ? 'Priority' : 'Flat'} <I.chevronDown size={12} /></button>
          <button className="btn btn-brand btn-sm"><I.plus size={13} /> Quick Add</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs mb-4">
        {[
          { id: 'all', label: 'All', c: counts.all },
          { id: 'today', label: 'Today', c: counts.today },
          { id: 'week', label: 'This Week', c: counts.week },
          { id: 'overdue', label: 'Overdue', c: counts.overdue },
          { id: 'blocked', label: 'Blocked', c: counts.blocked },
          { id: 'waiting', label: 'Waiting on Feedback', c: counts.waiting },
        ].map(t => (
          <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label} <span className="count">{t.c}</span>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="row gap-2 mb-4 wrap">
        <span className="meta" style={{ marginRight: 4 }}>Filter:</span>
        {['High', 'Medium', 'Low'].map(p => (
          <button key={p} className={`chip ${filterPrio === p ? 'active' : ''}`} onClick={() => setFilterPrio(filterPrio === p ? null : p)}>
            <span className="dot-indicator" style={{ background: p === 'High' ? 'var(--danger)' : p === 'Medium' ? 'var(--warning)' : 'var(--neutral)' }} />
            {p} <span className="count">{myTasks.filter(t => t.priority === p && t.status !== 'Done').length}</span>
          </button>
        ))}
        <button className="chip" onClick={() => setGroupBy(groupBy === 'project' ? 'priority' : groupBy === 'priority' ? 'flat' : 'project')}>
          Group: {groupBy}
        </button>
        <button className="chip">
          <I.filter size={12} /> Mehr Filter
        </button>
      </div>

      {/* Quick Add inline */}
      <div className="card mb-4" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <I.plus size={14} color="var(--text-3)" />
        <input className="input" placeholder="Quick add — Task-Titel eingeben…" style={{ border: 'none', height: 32 }} />
        <Badge kind="ghost">in {D.brands[workspace].name}</Badge>
        <button className="btn btn-quiet btn-sm">Detail öffnen <I.arrowRight size={12} /></button>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<I.check size={22} />} title="Nichts zu tun." body="Keine Tasks in dieser Ansicht. Wechsle den Tab oder lade die nächste Welle ein." />
        </div>
      ) : (
        Object.entries(grouped).filter(([_, ts]) => ts.length > 0).map(([group, tasks]) => (
          <section key={group} className="mb-4">
            <div className="row gap-2 mb-2" style={{ paddingLeft: 4 }}>
              <span className="label">{group}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{tasks.length}</span>
            </div>
            <div className="card" style={{ overflow: 'hidden' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 30 }}></th>
                    <th>Task</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Project</th>
                    <th>Due</th>
                    <th>Slack</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(t => <TaskRow key={t.id} task={t} setRoute={setRoute} />)}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function TaskRow({ task, setRoute }) {
  const D = window.CC_DATA;
  const p = D.projects.find(pr => pr.id === task.projectId);
  const due = dueLabel(task.due);
  return (
    <tr style={{ cursor: 'pointer' }} onClick={() => setRoute('project:' + task.projectId)}>
      <td>
        <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 999, border: '1.5px solid var(--border-strong)', background: task.status === 'Done' ? 'var(--brand)' : 'transparent', verticalAlign: 'middle' }} />
      </td>
      <td>
        <div style={{ fontWeight: 500 }}>{task.title}</div>
        {task.waitingOn && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>Wartet auf {D.users.find(u => u.id === task.waitingOn)?.name}</div>}
        {task.blocker && <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 2 }}><I.block size={11} /> {task.blocker}</div>}
      </td>
      <td><StatusBadge status={task.status} /></td>
      <td><PriorityBadge priority={task.priority} /></td>
      <td><span style={{ color: 'var(--text-2)' }}>{p?.name}</span></td>
      <td><span className={`badge ${due.danger ? 'danger' : due.today ? 'warning' : 'ghost'}`}>{due.text}</span></td>
      <td>
        {p?.slackConnected ? (
          <span className="row gap-1" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
            <I.slack size={12} /> <span className="mono">{p.slackChannel}</span>
          </span>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-4)' }}>—</span>
        )}
      </td>
    </tr>
  );
}

window.MyTasksScreen = MyTasksScreen;
