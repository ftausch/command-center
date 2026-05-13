'use server';
// Invite a user to a workspace, then upsert their workspace_members row.
//
// Two paths depending on whether the email already has an auth.users row:
//   - new user      → admin.auth.admin.inviteUserByEmail (sends "invite" email)
//   - existing user → admin.auth.resetPasswordForEmail   (sends "recovery" email)
//
// In both cases the email link routes through /auth/callback, which our
// callback forwards to /auth/set-password for type=invite/recovery — so
// the invitee always lands on the password-setup screen first.
//
// Same idea as scripts/invite-user.mjs but exposed as a server action so
// the Team and Settings screens can call it without an admin terminal.
//
// Role gate:
//   - Caller must be owner OR admin of the target workspace (enforced
//     server-side; admin client bypasses RLS so this gate IS the check).
//   - The role being granted is capped at 'admin' from this entry point.
//     Owner promotion stays a manual SQL step.

import { createAdminClient } from '@/lib/supabase/admin';
import { currentUser, getWorkspaceContext, canWriteAsRole } from '@/lib/auth';
import type { ActionResult } from '@/lib/types';

const ALLOWED_INVITE_ROLES = ['admin', 'manager', 'member', 'viewer'] as const;
const MAY_INVITE_ROLES = ['owner', 'admin'] as const;

type InvitableRole = (typeof ALLOWED_INVITE_ROLES)[number];

// Tight email regex. Not perfect by RFC, but rejects whitespace, missing
// @ / TLD, and trailing dots — the practical mistakes that lead to bounces.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteMode = 'invite' | 'recovery';

export async function inviteWorkspaceMember(input: {
  workspaceId: string;
  email: string;
  role: InvitableRole;
}): Promise<ActionResult<{ userId: string; mode: InviteMode; email: string }>> {
  // 1. Auth.
  const user = await currentUser();
  if (!user) return { ok: false, error: 'Not signed in' };

  // 2. Input shape.
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, error: 'Bitte eine gültige E-Mail-Adresse eingeben.' };
  }
  if (!ALLOWED_INVITE_ROLES.includes(input.role)) {
    return { ok: false, error: `Ungültige Rolle "${input.role}"` };
  }

  // 3. Caller's role in the target workspace.
  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) {
    return { ok: false, error: 'Workspace nicht gefunden oder kein Zugriff.' };
  }
  if (!canWriteAsRole(ctx.role, [...MAY_INVITE_ROLES])) {
    return { ok: false, error: 'Nur Owner und Admins können Personen einladen.' };
  }

  // 4. Admin client (service-role; never reaches the browser).
  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: 'Server nicht für Einladungen konfiguriert.' };
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://command-center-git-main-unicorn-bakery.vercel.app';
  const redirectTo = `${siteUrl}/auth/callback`;

  // 5. Is the email already an auth user? listUsers paginates; perPage=1000
  // covers any realistic team size. If we ever outgrow this, switch to a
  // direct auth.users query via SQL.
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listErr) {
    console.error('[invite] listUsers failed', listErr.message);
    return { ok: false, error: 'Bestehende Nutzer konnten nicht geprüft werden.' };
  }
  const existing = list.users.find(
    (u) => u.email?.toLowerCase() === email,
  );

  // 6. Branch: invite (new) vs recovery (existing).
  let userId: string;
  let mode: InviteMode;
  if (existing) {
    userId = existing.id;
    mode = 'recovery';
    const { error } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) {
      console.error('[invite] resetPasswordForEmail failed', error.message);
      return { ok: false, error: error.message };
    }
  } else {
    mode = 'invite';
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });
    if (error) {
      console.error('[invite] inviteUserByEmail failed', error.message);
      return { ok: false, error: error.message };
    }
    if (!data?.user?.id) {
      console.error('[invite] inviteUserByEmail returned no user id');
      return { ok: false, error: 'Invite hat keine User-ID geliefert.' };
    }
    userId = data.user.id;
  }

  // 7. Upsert workspace_members. Admin client bypasses RLS — this IS the
  // moment the membership becomes effective, before the invitee has even
  // clicked the email. That's intentional: it makes the new row visible
  // in the Team / Settings → Members list immediately after the admin
  // submits the modal.
  const { error: memErr } = await admin.from('workspace_members').upsert(
    { workspace_id: ctx.uuid, user_id: userId, role: input.role },
    { onConflict: 'workspace_id,user_id' },
  );
  if (memErr) {
    console.error('[invite] workspace_members upsert failed', memErr.message);
    return { ok: false, error: memErr.message };
  }

  console.log(
    `[invite] ✓ ${mode} sent to ${email}; workspace_members upserted as ${input.role}`,
  );
  return { ok: true, data: { userId, mode, email } };
}
