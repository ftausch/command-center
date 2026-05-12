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
 * Fetch the current user's role inside the given workspace. Returns null if
 * the user isn't a member. In mock mode (no Supabase) returns 'owner' so
 * dev/preview can exercise every action without an auth flow.
 */
export async function getWorkspaceRole(
  workspaceId: string,
): Promise<Role | null> {
  const supabase = createClient();
  if (!supabase) return 'owner';
  const user = await currentUser();
  if (!user) return null;
  const { data } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();
  return (data?.role as Role | undefined) ?? null;
}

/** Returns true if `role` is in the allowed list. Use for early role gates
 *  in server actions; RLS still enforces at the DB level. */
export function canWriteAsRole(
  role: Role | null,
  allowed: Role[],
): boolean {
  return role !== null && allowed.includes(role);
}
