'use client';
// Workspace context + data cache.
//
// Responsibilities:
//
//   1. List of workspaces the current user can access. Loaded from Supabase
//      when configured (only workspaces the user is a member of), otherwise
//      from mock so the preview UI keeps working.
//
//   2. The currently-selected workspace id. This is the single source of
//      truth used by App.jsx for routing and by every screen for data
//      filtering. Cross-workspace data leakage isn't possible because every
//      db.* call is keyed by this id (and RLS double-enforces it on the
//      server).
//
//   3. Cached datasets for the current workspace: projects, tasks, members,
//      activity, calendar events, slack notifications, templates, phases.
//      Loaded in parallel when the workspace changes; refresh() refetches.
//
// Why all the data lives in one place: every screen needs the same handful
// of arrays. Co-locating the cache means navigating between screens doesn't
// re-fetch, and there's exactly one loading/error state to reason about.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { db } from '@/lib/db';
import { D } from '@/lib/data';

const EMPTY_DATA = {
  projects: [],
  tasks: [],
  members: [],
  activity: [],
  calendarEvents: [],
  slackNotifications: [],
  templates: {},
  phases: [],
  // Per-task caches populated lazily by mutation helpers (and, in the
  // future, by per-task fetches when a detail screen opens).
  taskComments: {},        // { [taskId]: TaskCommentView[] }
  taskChecklistItems: {},  // { [taskId]: TaskChecklistItemView[] }
};

const noop = () => {};
const WorkspaceContext = createContext({
  workspaces: [],
  currentWorkspaceId: null,
  currentWorkspace: null,
  setCurrentWorkspaceId: () => {},
  data: EMPTY_DATA,
  loading: false,
  error: null,
  refresh: async () => {},
  me: null,
  mode: 'mock',
  // Mutation helpers — call from action callers to merge results into the
  // in-memory cache. Each is a no-op in the default context value.
  addTask: noop,
  updateTaskInCache: noop,
  removeTask: noop,
  addProject: noop,
  updateProjectInCache: noop,
  addTaskComment: noop,
  addChecklistItem: noop,
  updateChecklistItemInCache: noop,
  updateWorkspaceInCache: noop,
  pushActivity: noop,
});

function mockWorkspaces() {
  return Object.values(D.brands);
}

export function WorkspaceProvider({ children }) {
  const [workspaces, setWorkspaces] = useState(() => mockWorkspaces());
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(null);
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [me, setMe] = useState(null);
  const [mode, setMode] = useState(isSupabaseConfigured() ? 'supabase' : 'mock');

  // Load the "me" identity once on mount. Works in both modes:
  //   - mock: returns D.users[0] (Fabian)
  //   - supabase: returns the auth user's profile
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await db.getCurrentUser();
        if (!cancelled) setMe(u);
      } catch (e) {
        console.error('[workspace] getCurrentUser failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the workspaces the current user can see, once on mount. With no
  // Supabase configured we keep the mock list. Failures fall back silently
  // to the mock list so the UI never blanks out entirely.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setMode('mock');
        return;
      }
      try {
        const ws = await db.listWorkspaces();
        if (!cancelled && ws.length > 0) {
          setWorkspaces(ws);
          setMode('supabase');
        }
      } catch (e) {
        console.error('[workspace] listWorkspaces failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load all data for the selected workspace in parallel whenever it
  // changes. Clearing the workspace clears the cache.
  const loadData = useCallback(async (workspaceId) => {
    if (!workspaceId) {
      setData(EMPTY_DATA);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [
        projects,
        tasks,
        members,
        activity,
        calendarEvents,
        slackNotifications,
        templates,
        phases,
      ] = await Promise.all([
        db.listProjects(workspaceId),
        db.listTasks(workspaceId),
        db.listMembers(workspaceId),
        db.listActivity(workspaceId),
        db.listCalendarEvents(workspaceId),
        db.listSlackNotifications(workspaceId),
        db.listTemplates(workspaceId),
        db.getWorkspacePhases(workspaceId),
      ]);
      setData({
        projects,
        tasks,
        members,
        activity,
        calendarEvents,
        slackNotifications,
        templates,
        phases,
      });
    } catch (e) {
      setError(e);
      console.error('[workspace] loadData failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(currentWorkspaceId);
  }, [currentWorkspaceId, loadData]);

  const refresh = useCallback(
    () => loadData(currentWorkspaceId),
    [currentWorkspaceId, loadData],
  );

  // ── Mutation helpers ───────────────────────────────────────────────────
  // Each helper merges a newly-created/updated/deleted entity returned by a
  // server action into the in-memory cache so the UI sees the change without
  // a full re-fetch. The helpers themselves never call the server.
  const addTask = useCallback((task) => {
    if (!task) return;
    setData((d) => ({ ...d, tasks: [task, ...d.tasks] }));
  }, []);
  const updateTaskInCache = useCallback((taskId, patch) => {
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
    }));
  }, []);
  const removeTask = useCallback((taskId) => {
    setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== taskId) }));
  }, []);
  const addProject = useCallback((project) => {
    if (!project) return;
    setData((d) => ({ ...d, projects: [project, ...d.projects] }));
  }, []);
  const updateProjectInCache = useCallback((projectId, patch) => {
    setData((d) => ({
      ...d,
      projects: d.projects.map((p) =>
        p.id === projectId ? { ...p, ...patch } : p,
      ),
    }));
  }, []);
  const addTaskComment = useCallback((comment) => {
    if (!comment) return;
    setData((d) => {
      const existing = d.taskComments[comment.taskId] ?? [];
      return {
        ...d,
        taskComments: { ...d.taskComments, [comment.taskId]: [...existing, comment] },
      };
    });
  }, []);
  const addChecklistItem = useCallback((item) => {
    if (!item) return;
    setData((d) => {
      const existing = d.taskChecklistItems[item.taskId] ?? [];
      return {
        ...d,
        taskChecklistItems: {
          ...d.taskChecklistItems,
          [item.taskId]: [...existing, item],
        },
      };
    });
  }, []);
  const updateChecklistItemInCache = useCallback((taskId, itemId, patch) => {
    setData((d) => {
      const existing = d.taskChecklistItems[taskId] ?? [];
      return {
        ...d,
        taskChecklistItems: {
          ...d.taskChecklistItems,
          [taskId]: existing.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
        },
      };
    });
  }, []);
  const pushActivity = useCallback((entry) => {
    if (!entry) return;
    setData((d) => ({ ...d, activity: [entry, ...d.activity] }));
  }, []);
  const updateWorkspaceInCache = useCallback((workspaceId, patch) => {
    setWorkspaces((ws) => ws.map((w) => (w.id === workspaceId ? { ...w, ...patch } : w)));
  }, []);

  const currentWorkspace = useMemo(
    () => workspaces.find((w) => w.id === currentWorkspaceId) ?? null,
    [workspaces, currentWorkspaceId],
  );

  const value = useMemo(
    () => ({
      workspaces,
      currentWorkspaceId,
      currentWorkspace,
      setCurrentWorkspaceId,
      data,
      loading,
      error,
      refresh,
      me,
      mode,
      addTask,
      updateTaskInCache,
      removeTask,
      addProject,
      updateProjectInCache,
      addTaskComment,
      addChecklistItem,
      updateChecklistItemInCache,
      updateWorkspaceInCache,
      pushActivity,
    }),
    [
      workspaces,
      currentWorkspaceId,
      currentWorkspace,
      data,
      loading,
      error,
      refresh,
      me,
      mode,
      addTask,
      updateTaskInCache,
      removeTask,
      addProject,
      updateProjectInCache,
      addTaskComment,
      addChecklistItem,
      updateChecklistItemInCache,
      updateWorkspaceInCache,
      pushActivity,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
