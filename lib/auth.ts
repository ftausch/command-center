// Server-side auth helpers. Use these from server components, route
// handlers, and server actions. When Supabase isn't configured the helpers
// return null so the rest of the app degrades to mock mode without errors.

import { createClient } from '@/lib/supabase/server';
import type { Profile, Role } from '@/lib/types';

/** Returns the current Supabase auth user, or null. */
export async function currentUser() {
  const supabase = createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Returns the current user's profile row, or null. */
export async function currentProfile(): Promise<Profile | null> {
  const user = await currentUser();
  if (!user) return null;
  const supabase = createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

/**
 * Idempotently make sure the current user has a profile row. The signup
 * trigger already creates one, but this is a safety net for users imported
 * by other means (admin invite, OAuth provider with stale state, etc.).
 */
export async function ensureProfile(): Promise<Profile | null> {
  const user = await currentUser();
  if (!user) return null;
  const supabase = createClient();
  if (!supabase) return null;
  await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: user.email!,
        full_name:
          (user.user_metadata?.full_name as string | undefined) ?? user.email!,
      },
      { onConflict: 'id' },
    );
  return currentProfile();
}

/** Sign out the current user. Safe no-op if Supabase isn't configured. */
export async function signOut() {
  const supabase = createClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}

/**
 * Resolve a workspace slug to its UUID AND look up the current user's role
 * in that workspace, in a single trip. The UI keys workspaces by slug (so
 * mock + Supabase code paths share IDs), but the DB stores UUIDs — so
 * every server action needs both pieces to write.
 *
 * Returns null in three cases:
 *   - mock mode (no Supabase client): callers branch on `!supabase` first
 *     and synthesize entities there, so they never reach this function
 *   - the slug doesn't exist
 *   - the current user isn't a member of that workspace
 *
 * Two queries instead of one PostgREST join — clearer code, negligible
 * runtime cost (both queries hit indexed columns).
 */
export async function getWorkspaceContext(
  workspaceSlug: string,
): Promise<{ uuid: string; role: Role } | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const user = await currentUser();
  if (!user) return null;

  const { data: ws } = await supabase
    .from('workspaces')
    .select('id')
    .eq('slug', workspaceSlug)
    .maybeSingle();
  if (!ws?.id) return null;

  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', ws.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member?.role) return null;

  return { uuid: ws.id as string, role: member.role as Role };
}

/**
 * Convenience: fetch only the role for the current user in a workspace.
 * Returns 'owner' in mock mode so server actions can exercise every code
 * path without an auth flow. Returns null if the user isn't a member.
 */
export async function getWorkspaceRole(
  workspaceSlug: string,
): Promise<Role | null> {
  const supabase = createClient();
  if (!supabase) return 'owner';
  const ctx = await getWorkspaceContext(workspaceSlug);
  return ctx?.role ?? null;
}

/** Returns true if `role` is in the allowed list. Use for early role gates
 *  in server actions; RLS still enforces at the DB level. */
export function canWriteAsRole(
  role: Role | null,
  allowed: Role[],
): boolean {
  return role !== null && allowed.includes(role);
}
