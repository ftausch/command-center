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
import { rowToTask, rowToProject, rowToActivity } from '@/lib/db/supabase';
import { D } from '@/lib/data';
import { isAtLeast } from '@/lib/roles';

const EMPTY_DATA = {
  projects: [],
  tasks: [],
  members: [],
  activity: [],
  calendarEvents: [],
  slackNotifications: [],
  templates: {},
  phases: [],
  episodes: [],
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
  myRole: 'owner', // default so mock mode has full access
  // Mutation helpers — call from action callers to merge results into the
  // in-memory cache. Each is a no-op in the default context value.
  addTask: noop,
  updateTaskInCache: noop,
  removeTask: noop,
  addProject: noop,
  updateProjectInCache: noop,
  removeProject: noop,
  addTaskComment: noop,
  addChecklistItem: noop,
  updateChecklistItemInCache: noop,
  updateWorkspaceInCache: noop,
  addEpisode: noop,
  updateEpisodeInCache: noop,
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
        episodes,
      ] = await Promise.all([
        db.listProjects(workspaceId),
        db.listTasks(workspaceId),
        db.listMembers(workspaceId),
        db.listActivity(workspaceId),
        db.listCalendarEvents(workspaceId),
        db.listSlackNotifications(workspaceId),
        db.listTemplates(workspaceId),
        db.getWorkspacePhases(workspaceId),
        db.listEpisodes(workspaceId),
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
        episodes,
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

  // ── Supabase Realtime subscription ────────────────────────────────────────
  // Subscribes to INSERT/UPDATE/DELETE events on tasks, projects, and
  // activity_logs so changes made by other tabs or other users are reflected
  // in the cache without a manual refresh.
  //
  // Deduplication for INSERT: our own server actions already add entities to
  // the cache optimistically, so we skip an INSERT whose id is already present.
  // UPDATE and DELETE are idempotent, so no dedup needed.
  //
  // Requires migration 0005_realtime.sql to be applied (adds the tables to the
  // supabase_realtime publication).
  useEffect(() => {
    if (!isSupabaseConfigured() || !currentWorkspaceId) return;
    const supabase = createClient();
    if (!supabase) return;

    let channel = null;
    let cancelled = false;

    (async () => {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('id')
        .eq('slug', currentWorkspaceId)
        .maybeSingle();
      if (cancelled || !ws?.id) return;
      const uuid = ws.id;
      const slug = currentWorkspaceId;

      channel = supabase
        .channel(`ws-${slug}-live`)
        // ── Tasks ──────────────────────────────────────────────────────────
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${uuid}` }, (payload) => {
          const task = rowToTask(payload.new, slug);
          setData((d) => {
            if (d.tasks.some((t) => t.id === task.id)) return d;
            return { ...d, tasks: [task, ...d.tasks] };
          });
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${uuid}` }, (payload) => {
          const task = rowToTask(payload.new, slug);
          setData((d) => ({ ...d, tasks: d.tasks.map((t) => t.id === task.id ? task : t) }));
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${uuid}` }, (payload) => {
          const id = payload.old?.id;
          if (id) setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
        })
        // ── Projects ───────────────────────────────────────────────────────
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'projects', filter: `workspace_id=eq.${uuid}` }, (payload) => {
          const project = rowToProject(payload.new, slug);
          setData((d) => {
            if (d.projects.some((p) => p.id === project.id)) return d;
            return { ...d, projects: [project, ...d.projects] };
          });
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects', filter: `workspace_id=eq.${uuid}` }, (payload) => {
          const project = rowToProject(payload.new, slug);
          setData((d) => ({ ...d, projects: d.projects.map((p) => p.id === project.id ? project : p) }));
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'projects', filter: `workspace_id=eq.${uuid}` }, (payload) => {
          const id = payload.old?.id;
          if (id) setData((d) => ({
            ...d,
            projects: d.projects.filter((p) => p.id !== id),
            tasks: d.tasks.filter((t) => t.projectId !== id),
          }));
        })
        // ── Activity logs ──────────────────────────────────────────────────
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs', filter: `workspace_id=eq.${uuid}` }, (payload) => {
          const entry = rowToActivity(payload.new, slug);
          setData((d) => {
            if (d.activity.some((a) => a.id === entry.id)) return d;
            return { ...d, activity: [entry, ...d.activity] };
          });
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentWorkspaceId]);

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
  const removeProject = useCallback((projectId) => {
    setData((d) => ({
      ...d,
      projects: d.projects.filter((p) => p.id !== projectId),
      tasks: d.tasks.filter((t) => t.projectId !== projectId),
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
  const addEpisode = useCallback((episode) => {
    if (!episode) return;
    setData((d) => ({ ...d, episodes: [episode, ...d.episodes] }));
  }, []);
  const updateEpisodeInCache = useCallback((episodeId, patch) => {
    setData((d) => ({
      ...d,
      episodes: d.episodes.map((e) => (e.id === episodeId ? { ...e, ...patch } : e)),
    }));
  }, []);
  const updateWorkspaceInCache = useCallback((workspaceId, patch) => {
    setWorkspaces((ws) => ws.map((w) => (w.id === workspaceId ? { ...w, ...patch } : w)));
  }, []);

  const currentWorkspace = useMemo(
    () => workspaces.find((w) => w.id === currentWorkspaceId) ?? null,
    [workspaces, currentWorkspaceId],
  );

  // Derive the current user's role in this workspace from the members list.
  // Falls back to 'owner' in mock mode (no Supabase) so all actions remain
  // accessible during local development.
  const myRole = useMemo(() => {
    if (!isSupabaseConfigured()) return 'owner';
    if (!me) return 'viewer';
    const found = data.members.find((m) => m.id === me.id);
    return found?.role?.toLowerCase() ?? 'viewer';
  }, [me, data.members]);

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
      myRole,
      addTask,
      updateTaskInCache,
      removeTask,
      addProject,
      updateProjectInCache,
      removeProject,
      addTaskComment,
      addChecklistItem,
      updateChecklistItemInCache,
      updateWorkspaceInCache,
      addEpisode,
      updateEpisodeInCache,
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
      myRole,
      addTask,
      updateTaskInCache,
      removeTask,
      addProject,
      updateProjectInCache,
      removeProject,
      addTaskComment,
      addChecklistItem,
      updateChecklistItemInCache,
      updateWorkspaceInCache,
      addEpisode,
      updateEpisodeInCache,
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
