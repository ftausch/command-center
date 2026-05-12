'use client';
// App root — wires shell + screens + Cmd+K + workspace state

import { useState, useEffect, useMemo } from 'react';
import { D } from '@/lib/data';
import { Sidebar, Topbar } from '@/components/shell';
import { CmdK } from '@/components/CmdK';
import { WorkspaceSwitcher } from '@/components/screens/WorkspaceSwitcher';
import { DashboardScreen } from '@/components/screens/Dashboard';
import { MyTasksScreen } from '@/components/screens/MyTasks';
import { ProjectsScreen } from '@/components/screens/Projects';
import { ProjectDetailScreen } from '@/components/screens/ProjectDetail';
import { KanbanScreen } from '@/components/screens/Kanban';
import { CalendarScreen } from '@/components/screens/Calendar';
import { TemplatesScreen } from '@/components/screens/Templates';
import { TeamScreen } from '@/components/screens/Team';
import { ActivityScreen } from '@/components/screens/Activity';
import { SettingsScreen } from '@/components/screens/Settings';
import { ConceptScreen } from '@/components/screens/Concept';

export function App() {
  const [workspace, setWorkspace] = useState(null);
  const [route, setRoute] = useState('dashboard');
  const [cmdkOpen, setCmdkOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdkOpen(o => !o); }
      if (e.key === 'Escape') setCmdkOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const counts = useMemo(() => {
    if (!workspace) return { myTasks: 0, projects: 0 };
    const me = D.users[0].id;
    const tasks = D.tasks.filter(t => t.workspace === workspace);
    return {
      myTasks: tasks.filter(t => t.assignee === me && t.status !== 'Done').length,
      projects: D.projects.filter(p => p.workspace === workspace && p.status !== 'Done').length,
    };
  }, [workspace]);

  // Reflect workspace as a data-brand on <body> so the brand CSS variables in
  // styles.css (which key off [data-brand]) light up the right palette.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (workspace) document.body.dataset.brand = workspace;
    else delete document.body.dataset.brand;
  }, [workspace]);

  if (!workspace) {
    return <WorkspaceSwitcher onPick={(w) => { setWorkspace(w); setRoute('dashboard'); }} />;
  }

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
      case 'kanban':     screen = <KanbanScreen workspace={workspace} setRoute={setRoute} />; breadcrumb = 'Board'; break;
      case 'calendar':   screen = <CalendarScreen workspace={workspace} setRoute={setRoute} />; breadcrumb = 'Calendar'; break;
      case 'team':       screen = <TeamScreen workspace={workspace} setRoute={setRoute} />; breadcrumb = 'Team'; break;
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
      <CmdK open={cmdkOpen} workspace={workspace} onClose={() => setCmdkOpen(false)} setRoute={(r) => { setCmdkOpen(false); setRoute(r); }} />
    </div>
  );
}
