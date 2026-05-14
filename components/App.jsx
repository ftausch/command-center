'use client';
// App root — wires shell + screens + Cmd+K + workspace state.
//
// Workspace state lives in WorkspaceProvider; this component reads/writes it
// via the useWorkspace() hook. Screen data lives there too — every screen
// reads via useWorkspace().data instead of importing the mock D object.

import { useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { Sidebar, Topbar } from '@/components/shell';
import { CmdK } from '@/components/CmdK';
import { TaskDrawer } from '@/components/TaskDrawer';
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
  const {
    currentWorkspaceId: workspace,
    setCurrentWorkspaceId,
    data,
    loading,
  } = useWorkspace();
  const [route, setRoute] = useState('dashboard');
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [drawerTask, setDrawerTask] = useState(null); // { taskId, projectId } | null

  // Cmd+K shortcut
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdkOpen((o) => !o);
      }
      if (e.key === 'Escape') setCmdkOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCmdkOpen]);

  // Reflect workspace as a data-brand on <body> so the brand CSS variables
  // in styles.css (which key off [data-brand]) light up the right palette.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (workspace) document.body.dataset.brand = workspace;
    else delete document.body.dataset.brand;
  }, [workspace]);

  // Sidebar counts
  const counts = useMemo(() => {
    if (!workspace) return { myTasks: 0, projects: 0 };
    const me = data.members[0]?.id ?? 'fabian';
    return {
      myTasks: data.tasks.filter(
        (t) => t.assignee === me && t.status !== 'Done',
      ).length,
      projects: data.projects.filter((p) => p.status !== 'Done').length,
    };
  }, [workspace, data]);

  if (!workspace) {
    return (
      <WorkspaceSwitcher
        onPick={(w) => {
          setCurrentWorkspaceId(w);
          setRoute('dashboard');
        }}
      />
    );
  }

  let screen;
  let breadcrumb;
  if (route.startsWith('project:')) {
    const id = route.split(':')[1];
    const proj = data.projects.find((p) => p.id === id);
    breadcrumb = proj ? proj.name : 'Project';
    screen = <ProjectDetailScreen projectId={id} setRoute={setRoute} />;
  } else {
    switch (route) {
      case 'dashboard':
        screen = <DashboardScreen setRoute={setRoute} />;
        breadcrumb = 'Dashboard';
        break;
      case 'mytasks':
        screen = <MyTasksScreen setRoute={setRoute} />;
        breadcrumb = 'My Tasks';
        break;
      case 'projects':
        screen = <ProjectsScreen setRoute={setRoute} />;
        breadcrumb = 'Projects';
        break;
      case 'kanban':
        screen = <KanbanScreen setRoute={setRoute} />;
        breadcrumb = 'Board';
        break;
      case 'calendar':
        screen = <CalendarScreen setRoute={setRoute} />;
        breadcrumb = 'Calendar';
        break;
      case 'team':
        screen = <TeamScreen setRoute={setRoute} />;
        breadcrumb = 'Team';
        break;
      case 'templates':
        screen = <TemplatesScreen setRoute={setRoute} />;
        breadcrumb = 'Templates';
        break;
      case 'activity':
        screen = <ActivityScreen />;
        breadcrumb = 'Activity';
        break;
      case 'settings':
        screen = <SettingsScreen />;
        breadcrumb = 'Settings';
        break;
      case 'concept':
        screen = <ConceptScreen setRoute={setRoute} />;
        breadcrumb = 'Concept Doc';
        break;
      default:
        screen = <DashboardScreen setRoute={setRoute} />;
        breadcrumb = 'Dashboard';
    }
  }

  return (
    <div className="app" data-workspace={workspace} data-brand={workspace}>
      <Sidebar
        route={route}
        setRoute={setRoute}
        onSwitchWorkspace={() => setCurrentWorkspaceId(null)}
        counts={counts}
      />
      <main className="main">
        <Topbar openCmdK={() => setCmdkOpen(true)} breadcrumb={breadcrumb} setRoute={setRoute} />
        {loading && data.projects.length === 0 ? (
          // First load only — flicker-free render once the cache is warm.
          <div
            style={{
              padding: '40px 28px',
              color: 'var(--text-3)',
              fontSize: 13,
            }}
          >
            Lade Workspace …
          </div>
        ) : (
          <div className="main-scroll" key={route}>
            {screen}
          </div>
        )}
      </main>
      <CmdK
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        setRoute={(r) => {
          setCmdkOpen(false);
          setRoute(r);
        }}
        onOpenTask={(taskId, projectId) => {
          setCmdkOpen(false);
          setDrawerTask({ taskId, projectId });
        }}
      />
      <TaskDrawer
        taskId={drawerTask?.taskId ?? null}
        projectId={drawerTask?.projectId ?? null}
        onClose={() => setDrawerTask(null)}
      />
    </div>
  );
}
