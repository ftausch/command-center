'use client';
// Workspace context. Two responsibilities:
//
//   1. Make the list of workspaces the user can access available to any
//      component (current Sidebar/Switcher reach into mock data directly —
//      this is the seam they'll migrate to).
//
//   2. Hold the *currently selected* workspace_id. Every data query the
//      rest of the app makes is scoped to this value. UnicornBakery and
//      SelbstFrei data never mix because every db.* call takes a workspace
//      id and RLS enforces it on the server.
//
// When Supabase is configured we load workspaces the signed-in user is a
// member of. Otherwise we fall back to the mock workspaces so the existing
// preview / mock-data UI keeps working without a session.

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { D } from '@/lib/data';

const WorkspaceContext = createContext({
  workspaces: [],
  currentWorkspaceId: null,
  setCurrentWorkspaceId: () => {},
  loading: false,
  mode: 'mock',
});

function mockWorkspaces() {
  return Object.values(D.brands).map((b) => ({
    id: b.id,
    slug: b.id,
    name: b.name,
    color: b.color ?? null,
    tagline: b.tagline ?? null,
    created_at: null,
  }));
}

export function WorkspaceProvider({ children }) {
  const [workspaces, setWorkspaces] = useState(() => mockWorkspaces());
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState(isSupabaseConfigured() ? 'supabase' : 'mock');

  // Load workspaces the user is a member of, when Supabase is configured.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        // Not signed in: middleware should have redirected. Leave mock
        // workspaces in place so the UI doesn't blank out.
        setMode('mock');
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('workspaces')
        .select('id, slug, name, color, tagline, created_at')
        .order('name');
      if (cancelled) return;
      if (error) {
        console.error('[workspace] load failed', error);
      } else if (data) {
        setWorkspaces(data);
        setMode('supabase');
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspaceId,
        setCurrentWorkspaceId,
        loading,
        mode,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
