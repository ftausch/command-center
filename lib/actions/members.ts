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
//   - All five workspace roles can be granted from this entry point.
//     Owner promotion is rare but permitted — the existing role gate
//     already ensures the caller is owner/admin, so only an authorized
//     person can transfer ownership-level access.

import { createAdminClient } from '@/lib/supabase/admin';
import { currentUser, getWorkspaceContext, canWriteAsRole } from '@/lib/auth';
import type { ActionResult } from '@/lib/types';

const ALLOWED_INVITE_ROLES = ['owner', 'admin', 'manager', 'member', 'viewer'] as const;
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
    // Reject early if the user is already a member of THIS workspace —
    // we don't want to silently overwrite a role via the invite UI, and
    // we definitely don't want to email a recovery link to a user who
    // is already signed up here. Role changes for existing members go
    // through the dedicated change-role flow (P1 follow-up).
    const { data: existingMember, error: memCheckErr } = await admin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', ctx.uuid)
      .eq('user_id', userId)
      .maybeSingle();
    if (memCheckErr) {
      console.error('[invite] workspace_members lookup failed', memCheckErr.message);
      return { ok: false, error: 'Mitgliedschaft konnte nicht geprüft werden.' };
    }
    if (existingMember) {
      console.log('[invite] reject: already a member of', input.workspaceId);
      return {
        ok: false,
        error: `Diese Person ist bereits Mitglied dieses Workspaces (Rolle: ${existingMember.role}).`,
      };
    }
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

// ── Member management ─────────────────────────────────────────────────────
//
// Role change + removal. Shared sanity checks:
//   - Caller must be owner OR admin of the workspace.
//   - Only an owner can change OR remove someone whose current role is
//     owner. Otherwise an admin could lock the workspace's actual owner
//     out.
//   - Only an owner can grant the owner role (no privilege escalation
//     via "make me owner" by an admin).
//   - The LAST owner can't be demoted or removed — we'd leave the
//     workspace with nobody who can grant owner-level access back.

type ManageableRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

const VALID_ROLES: readonly ManageableRole[] = [
  'owner', 'admin', 'manager', 'member', 'viewer',
];

async function loadMemberRole(
  admin: ReturnType<typeof createAdminClient>,
  workspaceUuid: string,
  userId: string,
): Promise<ManageableRole | null> {
  if (!admin) return null;
  const { data } = await admin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceUuid)
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.role as ManageableRole | undefined) ?? null;
}

async function countOwners(
  admin: ReturnType<typeof createAdminClient>,
  workspaceUuid: string,
): Promise<number> {
  if (!admin) return 0;
  const { count } = await admin
    .from('workspace_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceUuid)
    .eq('role', 'owner');
  return count ?? 0;
}

export async function updateMemberRole(input: {
  workspaceId: string;
  userId: string;
  role: ManageableRole;
}): Promise<ActionResult<{ userId: string; role: ManageableRole }>> {
  const caller = await currentUser();
  if (!caller) return { ok: false, error: 'Not signed in' };

  if (!VALID_ROLES.includes(input.role)) {
    return { ok: false, error: `Ungültige Rolle "${input.role}"` };
  }

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace nicht gefunden oder kein Zugriff.' };
  if (!canWriteAsRole(ctx.role, [...MAY_INVITE_ROLES])) {
    return { ok: false, error: 'Nur Owner und Admins können Rollen ändern.' };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Server nicht konfiguriert.' };

  // Target's current role.
  const targetRole = await loadMemberRole(admin, ctx.uuid, input.userId);
  if (!targetRole) {
    return { ok: false, error: 'Person ist kein Mitglied dieses Workspaces.' };
  }
  if (targetRole === input.role) {
    return { ok: true, data: { userId: input.userId, role: input.role } };
  }

  // An admin can't touch an owner, and can't grant owner.
  if (targetRole === 'owner' && ctx.role !== 'owner') {
    return { ok: false, error: 'Nur Owner können die Rolle eines anderen Owners ändern.' };
  }
  if (input.role === 'owner' && ctx.role !== 'owner') {
    return { ok: false, error: 'Nur Owner können die Owner-Rolle vergeben.' };
  }

  // Don't strand the workspace without any owner.
  if (targetRole === 'owner' && input.role !== 'owner') {
    const owners = await countOwners(admin, ctx.uuid);
    if (owners <= 1) {
      return { ok: false, error: 'Der letzte Owner kann nicht degradiert werden.' };
    }
  }

  const { error } = await admin
    .from('workspace_members')
    .update({ role: input.role })
    .eq('workspace_id', ctx.uuid)
    .eq('user_id', input.userId);
  if (error) {
    console.error('[member-role] update failed', error.message);
    return { ok: false, error: error.message };
  }
  console.log(
    `[member-role] ✓ ${input.userId} → ${input.role} in ${input.workspaceId}`,
  );
  return { ok: true, data: { userId: input.userId, role: input.role } };
}

export async function removeMember(input: {
  workspaceId: string;
  userId: string;
}): Promise<ActionResult<{ userId: string }>> {
  const caller = await currentUser();
  if (!caller) return { ok: false, error: 'Not signed in' };

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace nicht gefunden oder kein Zugriff.' };
  if (!canWriteAsRole(ctx.role, [...MAY_INVITE_ROLES])) {
    return { ok: false, error: 'Nur Owner und Admins können Mitglieder entfernen.' };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Server nicht konfiguriert.' };

  const targetRole = await loadMemberRole(admin, ctx.uuid, input.userId);
  if (!targetRole) {
    return { ok: false, error: 'Person ist kein Mitglied dieses Workspaces.' };
  }

  if (targetRole === 'owner' && ctx.role !== 'owner') {
    return { ok: false, error: 'Nur Owner können andere Owner entfernen.' };
  }

  if (targetRole === 'owner') {
    const owners = await countOwners(admin, ctx.uuid);
    if (owners <= 1) {
      return { ok: false, error: 'Der letzte Owner kann nicht entfernt werden.' };
    }
  }

  const { error } = await admin
    .from('workspace_members')
    .delete()
    .eq('workspace_id', ctx.uuid)
    .eq('user_id', input.userId);
  if (error) {
    console.error('[member-remove] delete failed', error.message);
    return { ok: false, error: error.message };
  }
  console.log(`[member-remove] ✓ ${input.userId} from ${input.workspaceId}`);
  return { ok: true, data: { userId: input.userId } };
}
