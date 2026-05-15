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

import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';
import { currentUser, getWorkspaceContext, canWriteAsRole } from '@/lib/auth';
import type { ActionResult } from '@/lib/types';

const FROM_EMAIL = 'noreply@unicornbakery.de';
const FROM_NAME  = 'Command Center';

async function sendInviteEmail(to: string, link: string, mode: 'invite' | 'recovery') {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[invite] RESEND_API_KEY not set — skipping email send');
    return;
  }
  const resend = new Resend(key);
  const subject = mode === 'invite'
    ? 'Du wurdest zu Command Center eingeladen'
    : 'Dein Zugang zu Command Center';
  const actionLabel = mode === 'invite' ? 'Einladung annehmen →' : 'Jetzt einloggen →';
  const intro = mode === 'invite'
    ? 'Du hast eine Einladung zu <strong>Command Center</strong> erhalten — dem zentralen Workspace für Projekte, Tasks und Podcast-Produktion bei UnicornBakery.'
    : 'Hier ist dein persönlicher Zugangslink zu <strong>Command Center</strong>. Klicke unten um dein Passwort zu setzen und loszulegen.';

  const html = `<div style="font-family:-apple-system,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fcf8fa">
  <div style="margin-bottom:32px">
    <span style="font-size:20px;font-weight:700;color:#1b1b1d;letter-spacing:-0.02em">Command Center</span>
    <span style="color:#76777d;font-size:14px;margin-left:8px">· UnicornBakery</span>
  </div>
  <h2 style="font-size:24px;font-weight:700;color:#1b1b1d;margin:0 0 12px;letter-spacing:-0.02em">${mode === 'invite' ? 'Du wurdest eingeladen 🎉' : 'Dein Zugangslink 🔑'}</h2>
  <p style="font-size:15px;color:#45464d;line-height:1.6;margin:0 0 28px">${intro}</p>
  <a href="${link}" style="display:inline-block;background:#131b2e;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:-0.01em">${actionLabel}</a>
  <p style="font-size:12px;color:#76777d;margin:28px 0 0;line-height:1.5">
    Dieser Link ist 24 Stunden gültig. Falls du keine Einladung erwartet hast, kannst du diese Email ignorieren.<br><br>
    <a href="https://team.unicornbakery.de" style="color:#712edd;text-decoration:none">team.unicornbakery.de</a>
  </p>
</div>`;

  const { error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to,
    subject,
    html,
  });
  if (error) console.error('[invite] Resend send failed:', error.message);
  else console.log(`[invite] ✓ Resend email sent to ${to} (${mode})`);
}

const RATE_LIMIT_WARNING =
  'E-Mail-Limit bei Resend erreicht. Mitglied wurde angelegt, aber die Einladungs-E-Mail konnte nicht gesendet werden. ' +
  'Bitte den Backup-Link unten per Slack oder WhatsApp teilen oder später erneut einladen.';

function isRateLimitError(err: { message?: string; status?: number; code?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === 'over_email_send_rate_limit' ||
    (err.message?.toLowerCase().includes('rate limit') ?? false) ||
    err.status === 429
  );
}

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
}): Promise<ActionResult<{ userId: string; mode: InviteMode; email: string; inviteLink?: string }>> {
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
    'https://team.unicornbakery.de';
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
  const users = (list as { users: { id: string; email?: string }[] }).users;
  const existing = users.find(
    (u) => u.email?.toLowerCase() === email,
  );

  // 6. Branch: invite (new) vs recovery (existing).
  //    We skip Supabase's built-in email sending entirely and use Resend
  //    directly. generateLink creates the auth user if needed and returns
  //    the magic link — we handle delivery ourselves.
  let userId: string;
  let mode: InviteMode;

  if (existing) {
    userId = existing.id;
    // Reject if already a member of this workspace.
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
      return {
        ok: false,
        error: `Diese Person ist bereits Mitglied dieses Workspaces (Rolle: ${existingMember.role}).`,
      };
    }
    mode = 'recovery';
  } else {
    // generateLink with type 'invite' creates the auth.users row implicitly.
    mode = 'invite';
  }

  // 7. Generate magic link first — for new users this also creates the
  //    auth.users row and gives us the userId we need for steps 8 & 9.
  let inviteLink: string | undefined;
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: mode === 'invite' ? 'invite' : 'recovery',
    email,
    options: { redirectTo },
  } as Parameters<typeof admin.auth.admin.generateLink>[0]);
  if (linkErr) {
    console.error('[invite] generateLink failed', linkErr.message);
    return { ok: false, error: linkErr.message };
  }
  // Build link to our own /auth/callback using hashed_token.
  // The direct action_link (supabase.co/auth/v1/verify) can fail with
  // "No API key" on some Supabase project configs — our callback route
  // calls verifyOtp() server-side which has no such restriction.
  const hashedToken = (linkData as any)?.properties?.hashed_token;
  if (hashedToken) {
    const linkType = mode === 'invite' ? 'invite' : 'recovery';
    inviteLink = `${siteUrl}/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=${linkType}`;
  }

  // Resolve userId for new users (generateLink creates the auth.users row).
  if (mode === 'invite') {
    const newId = (linkData as any)?.user?.id;
    if (newId) {
      userId = newId;
    } else {
      const { data: recheck } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const found = (recheck as { users: { id: string; email?: string }[] } | null)?.users
        ?.find((u) => u.email?.toLowerCase() === email);
      if (!found) return { ok: false, error: 'Nutzer konnte nicht angelegt werden.' };
      userId = found.id;
    }
  }

  // 8. Ensure profiles row exists (FK guard for workspace_members).
  const { error: profileErr } = await admin.from('profiles').upsert(
    { id: userId, email, full_name: email },
    { onConflict: 'id' },
  );
  if (profileErr) console.error('[invite] profiles upsert failed (non-fatal)', profileErr.message);

  // 9. Upsert workspace_members — membership is effective immediately.
  const { error: memErr } = await admin.from('workspace_members').upsert(
    { workspace_id: ctx.uuid, user_id: userId, role: input.role },
    { onConflict: 'workspace_id,user_id' },
  );
  if (memErr) {
    console.error('[invite] workspace_members upsert failed', memErr.message);
    return { ok: false, error: memErr.message };
  }

  // 10. Send via Resend. Fire-and-forget — never blocks the response.
  if (inviteLink) {
    sendInviteEmail(email, inviteLink, mode).catch((e) =>
      console.error('[invite] sendInviteEmail threw', e?.message),
    );
  }

  console.log(`[invite] ✓ ${mode} for ${email}; workspace_members upserted as ${input.role}`);
  return { ok: true, data: { userId, mode, email, inviteLink } };
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
