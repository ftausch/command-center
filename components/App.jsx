'use client';
// App root — wires shell + screens + Cmd+K + workspace state.
//
// Workspace state lives in WorkspaceProvider; this component reads/writes it
// via the useWorkspace() hook. Screen data lives there too — every screen
// reads via useWorkspace().data instead of importing the mock D object.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { Sidebar, Topbar, MobileBottomNav } from '@/components/shell';
import { BrowserNotifications } from '@/components/BrowserNotifications';
import { QuickCaptureModal } from '@/components/QuickCaptureModal';
import { CmdK } from '@/components/CmdK';
import { TaskDrawer } from '@/components/TaskDrawer';
import { NewTaskModal } from '@/components/NewTaskModal';
import { WorkspaceSwitcher } from '@/components/screens/WorkspaceSwitcher';
import { OnboardingScreen } from '@/components/OnboardingScreen';
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
import { PodcastHubScreen } from '@/components/screens/PodcastHub';
import { EpisodePipelineScreen } from '@/components/screens/EpisodePipeline';
import { EventHubScreen } from '@/components/screens/EventHub';
import { EventPipelineScreen } from '@/components/screens/EventPipeline';
import { PartnersScreen } from '@/components/screens/Partners';
import { AssistantHubScreen } from '@/components/screens/AssistantHub';
import { ShortcutOverlay } from '@/components/ShortcutOverlay';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SkeletonPage } from '@/components/Skeleton';
import { PAWelcome } from '@/components/PAWelcome';
import { OpsHealthScreen } from '@/components/screens/OpsHealth';
import { ApprovalCenterScreen } from '@/components/screens/ApprovalCenter';
import { DecisionCenterScreen } from '@/components/screens/DecisionCenter';
import { RiskBoardScreen } from '@/components/screens/RiskBoard';

export function App() {
  const {
    currentWorkspaceId: workspace,
    setCurrentWorkspaceId,
    data,
    loading,
    error,
    me,
    myRole,
    mode,
  } = useWorkspace();

  // All hooks must be declared unconditionally before any early return.
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [route, setRoute] = useState('dashboard');
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [drawerTask, setDrawerTask] = useState(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const gPending = useRef(false);
  const gTimer = useRef(null);

  // Onboarding: show role-picker on first login (specialty not yet set).
  // Only in Supabase mode — mock mode always skips.
  const showOnboarding =
    mode === 'supabase' &&
    me !== null &&
    me.specialty == null &&
    !onboardingDone;

  // Keyboard shortcuts. Skip when focus is in an input/textarea/select so
  // typing doesn't accidentally trigger navigation.
  useEffect(() => {
    if (showOnboarding) return;
    const onKey = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const inInput = tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.isContentEditable;

      // ⌘K / Ctrl+K — toggle palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdkOpen((o) => !o);
        return;
      }
      if (e.key === 'Escape') { setCmdkOpen(false); return; }

      // Single-key shortcuts — skip when typing
      if (inInput || cmdkOpen) return;

      // '/' — focus palette
      if (e.key === '/') { e.preventDefault(); setCmdkOpen(true); return; }

      // 'n' — new task
      if (e.key === 'n') { e.preventDefault(); setNewTaskOpen(true); return; }

      // 'b' — board
      if (e.key === 'b') { e.preventDefault(); setRoute('kanban'); return; }

      // 'a' — assistant hub
      if (e.key === 'a') { e.preventDefault(); setRoute('assisthub'); return; }

      // Shift+A — quick capture (new assistant item from anywhere)
      if (e.key === 'A' && e.shiftKey) { e.preventDefault(); setQuickCaptureOpen(true); return; }

      // 'e' — event hub
      if (e.key === 'e') { e.preventDefault(); setRoute('eventhub'); return; }

      // 'h' — health dashboard
      if (e.key === 'h') { e.preventDefault(); setRoute('ops-health'); return; }

      // '?' — shortcuts overlay
      if (e.key === '?') { e.preventDefault(); setShortcutsOpen(true); return; }

      // 'p' — podcast hub
      if (e.key === 'P' && e.shiftKey) { e.preventDefault(); setRoute('podcast'); return; }

      // 'g' prefix navigation
      if (e.key === 'g') {
        e.preventDefault();
        gPending.current = true;
        clearTimeout(gTimer.current);
        gTimer.current = setTimeout(() => { gPending.current = false; }, 1500);
        return;
      }
      if (gPending.current) {
        gPending.current = false;
        clearTimeout(gTimer.current);
        e.preventDefault();
        if (e.key === 'd') setRoute('dashboard');
        else if (e.key === 'p') setRoute('projects');
        else if (e.key === 't') setRoute('mytasks');
        else if (e.key === 'c') setRoute('calendar');
        else if (e.key === 'a') setRoute('activity');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(gTimer.current); };
  }, [setCmdkOpen, cmdkOpen, setRoute, showOnboarding]);

  // Restore dark mode preference on mount
  useEffect(() => {
    try {
      const surface = localStorage.getItem('cc.surface');
      if (surface) document.body.dataset.ccSurface = surface;
    } catch {}
  }, []);

  // Reflect workspace as a data-brand on <body>
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (workspace) document.body.dataset.brand = workspace;
    else delete document.body.dataset.brand;
  }, [workspace]);

  // Sidebar counts
  const counts = useMemo(() => {
    if (!workspace) return { myTasks: 0, projects: 0 };
    const meId = data.members[0]?.id ?? 'fabian';
    return {
      myTasks: data.tasks.filter(
        (t) => t.assignee === meId && t.status !== 'Done',
      ).length,
      projects: data.projects.filter((p) => p.status !== 'Done').length,
    };
  }, [workspace, data]);

  if (showOnboarding) {
    return (
      <OnboardingScreen
        onDone={(specialty) => {
          setOnboardingDone(true);
          if (me) me.specialty = specialty ?? 'skipped';
        }}
      />
    );
  }

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
        screen = <DashboardScreen setRoute={setRoute} onOpenTask={(taskId, projectId) => setDrawerTask({ taskId, projectId })} />;
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
      case 'podcast':
        screen = <PodcastHubScreen setRoute={setRoute} />;
        breadcrumb = 'Podcast Hub';
        break;
      case 'pipeline':
        screen = <EpisodePipelineScreen setRoute={setRoute} />;
        breadcrumb = 'Episode Pipeline';
        break;
      case 'eventhub':
        screen = <EventHubScreen setRoute={setRoute} />;
        breadcrumb = 'Event Hub';
        break;
      case 'eventpipeline':
        screen = <EventPipelineScreen setRoute={setRoute} />;
        breadcrumb = 'Event Pipeline';
        break;
      case 'partners':
        screen = <PartnersScreen setRoute={setRoute} />;
        breadcrumb = 'Partner & Sponsoren';
        break;
      case 'assisthub':
        screen = <AssistantHubScreen setRoute={setRoute} />;
        break;
      case 'ops-health':
        screen = <OpsHealthScreen setRoute={setRoute} />;
        break;
      case 'approvals':
        screen = <ApprovalCenterScreen setRoute={setRoute} />;
        break;
      case 'decisions':
        screen = <DecisionCenterScreen setRoute={setRoute} />;
        break;
      case 'risks':
        screen = <RiskBoardScreen setRoute={setRoute} />;
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
        setRoute={(r) => { setRoute(r); setSidebarOpen(false); }}
        onSwitchWorkspace={() => { setCurrentWorkspaceId(null); setSidebarOpen(false); }}
        counts={counts}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />
      <main className="main">
        <Topbar
          openCmdK={() => setCmdkOpen(true)}
          breadcrumb={breadcrumb}
          setRoute={setRoute}
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenTask={(taskId, projectId) => setDrawerTask({ taskId, projectId })}
        />
        {error ? (
          <div style={{ padding: '40px 28px', maxWidth: 480 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, color: 'var(--danger)' }}>Workspace konnte nicht geladen werden</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>{error?.message ?? 'Unbekannter Fehler. Bitte Seite neu laden.'}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => window.location.reload()}>Neu laden</button>
          </div>
        ) : loading && data.projects.length === 0 ? (
          <SkeletonPage />
        ) : (
          <div className="main-scroll" key={route}>
            <ErrorBoundary key={route}>
              {screen}
            </ErrorBoundary>
          </div>
        )}
      </main>
      <NewTaskModal
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        onNeedProject={() => { setNewTaskOpen(false); setRoute('projects'); }}
      />
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
      {shortcutsOpen && <ShortcutOverlay onClose={() => setShortcutsOpen(false)} />}
      {me && myRole === 'manager' && (
        <PAWelcome userId={me.id} onClose={() => setRoute('assisthub')} />
      )}
      <MobileBottomNav route={route} setRoute={setRoute} />
      <BrowserNotifications />
      {quickCaptureOpen && <QuickCaptureModal onClose={() => setQuickCaptureOpen(false)} />}
    </div>
  );
}
