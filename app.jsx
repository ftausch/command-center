// App root — wires shell + screens + Cmd+K + workspace state
const { useState, useEffect, useMemo } = React;

function App() {
  const D = window.CC_DATA;
  const [workspace, setWorkspace] = useState(null); // null = pick screen
  const [route, setRoute] = useState('dashboard');
  const [cmdkOpen, setCmdkOpen] = useState(false);

  // Cmd+K shortcut
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdkOpen(o => !o); }
      if (e.key === 'Escape') setCmdkOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Counts for sidebar
  const counts = useMemo(() => {
    if (!workspace) return { myTasks: 0, projects: 0 };
    const me = D.users[0].id;
    const tasks = D.tasks.filter(t => t.workspace === workspace);
    return {
      myTasks: tasks.filter(t => t.assignee === me && t.status !== 'Done').length,
      projects: D.projects.filter(p => p.workspace === workspace && p.status !== 'Done').length,
    };
  }, [workspace]);

  // Workspace switcher full-bleed
  if (!workspace) {
    return <WorkspaceSwitcher onPick={(w) => { setWorkspace(w); setRoute('dashboard'); }} />;
  }

  // Resolve route → screen
  let screen, breadcrumb;
  if (route.startsWith('project:')) {
    const id = route.split(':')[1];
    const proj = D.projects.find(p => p.id === id);
    breadcrumb = proj ? proj.name : 'Project';
    screen = <ProjectDetailScreen projectId={id} workspace={workspace} setRoute={setRoute} />;
  } else {
    switch (route) {
      case 'dashboard':  screen = <DashboardScreen workspace={workspace} setRoute={setRoute} />; breadcrumb = 'Dashboard'; break;
      case 'mytasks':    screen = <MyTasksScreen workspace={workspace} setRoute={setRoute} />; breadcrumb = 'My Tasks'; break;
      case 'projects':   screen = <ProjectsScreen workspace={workspace} setRoute={setRoute} />; breadcrumb = 'Projects'; break;
      case 'kanban':     screen = <KanbanScreen workspace={workspace} />; breadcrumb = 'Board'; break;
      case 'calendar':   screen = <CalendarScreen workspace={workspace} />; breadcrumb = 'Calendar'; break;
      case 'team':       screen = <TeamScreen workspace={workspace} />; breadcrumb = 'Team'; break;
      case 'templates':  screen = <TemplatesScreen workspace={workspace} />; breadcrumb = 'Templates'; break;
      case 'activity':   screen = <ActivityScreen workspace={workspace} />; breadcrumb = 'Activity'; break;
      case 'settings':   screen = <SettingsScreen workspace={workspace} />; breadcrumb = 'Settings'; break;
      case 'concept':    screen = <ConceptScreen setRoute={setRoute} />; breadcrumb = 'Concept Doc'; break;
      default:           screen = <DashboardScreen workspace={workspace} setRoute={setRoute} />; breadcrumb = 'Dashboard';
    }
  }

  return (
    <div className="app" data-workspace={workspace} data-brand={workspace}>
      <Sidebar route={route} setRoute={setRoute} workspace={workspace} onSwitchWorkspace={() => setWorkspace(null)} counts={counts} />
      <main className="main">
        <Topbar workspace={workspace} openCmdK={() => setCmdkOpen(true)} breadcrumb={breadcrumb} />
        <div className="main-scroll" key={route}>
          {screen}
        </div>
      </main>
      {cmdkOpen && <CmdK workspace={workspace} onClose={() => setCmdkOpen(false)} setRoute={(r) => { setCmdkOpen(false); setRoute(r); }} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
