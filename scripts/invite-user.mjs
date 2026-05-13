// Invite (or recover) a user via the Supabase admin client. Optionally
// add them to a workspace at a given role in the same call.
//
// Usage:
//   node --env-file=.env.local scripts/invite-user.mjs <email>
//   node --env-file=.env.local scripts/invite-user.mjs <email> <workspace-slug>
//   node --env-file=.env.local scripts/invite-user.mjs <email> <workspace-slug> <role>
//
// Roles: owner, admin, manager, member (default), viewer
//
// Behavior:
//   - If the email is unknown, inviteUserByEmail() sends an "invite"
//     email and creates an auth.users row with no password.
//   - If the email already exists, resetPasswordForEmail() sends a
//     "recovery" email. Same end UX — user clicks, lands on
//     /auth/set-password, sets their password.
//
// Set NEXT_PUBLIC_SITE_URL in .env.local to point at the deployment whose
// /auth/callback should receive the click; defaults to the production
// branch alias. Make sure that URL is in the Supabase Redirect URLs
// allowlist (dashboard → Authentication → URL Configuration), or
// Supabase will silently fall back to the project Site URL.
//
// Exit codes:
//   0  success
//   1  bad CLI args
//   2  env vars missing
//   3  invite / recovery call failed
//   4  workspace slug given but not found
//   5  invited user had no id returned (shouldn't happen)
//   6  workspace_members upsert failed

import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const [email, workspaceSlug, role = 'member'] = args;

const VALID_ROLES = ['owner', 'admin', 'manager', 'member', 'viewer'];

if (!email || args.includes('--help') || args.includes('-h')) {
  console.error('Usage: node scripts/invite-user.mjs <email> [workspace-slug] [role]');
  console.error(`  roles: ${VALID_ROLES.join(', ')} (default: member)`);
  process.exit(email ? 0 : 1);
}
if (!VALID_ROLES.includes(role)) {
  console.error(`Invalid role "${role}". Must be one of: ${VALID_ROLES.join(', ')}`);
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  'https://command-center-git-main-unicorn-bakery.vercel.app';

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(2);
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const redirectTo = `${siteUrl}/auth/callback`;
console.log(`[invite] email=${email}`);
console.log(`[invite] redirect → ${redirectTo}`);

// Determine whether the user already exists. Supabase paginates listUsers,
// so for projects with many users we'd want to switch to a direct
// auth.users query via SQL — for now perPage=1000 covers any realistic
// team size.
const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listErr) {
  console.error(`listUsers failed: ${listErr.message}`);
  process.exit(3);
}
const existing = list.users.find(
  (u) => u.email?.toLowerCase() === email.toLowerCase(),
);

let userId;
if (existing) {
  userId = existing.id;
  console.log(`[invite] user exists (${userId}) — sending recovery email.`);
  const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    console.error(`resetPasswordForEmail failed: ${error.message}`);
    process.exit(3);
  }
  console.log('[invite] ✓ recovery email sent');
} else {
  console.log('[invite] user does not exist — sending invite email.');
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (error) {
    console.error(`inviteUserByEmail failed: ${error.message}`);
    process.exit(3);
  }
  userId = data?.user?.id;
  if (!userId) {
    console.error('inviteUserByEmail returned no user id');
    process.exit(5);
  }
  console.log(`[invite] ✓ invite email sent (user id: ${userId})`);
}

if (!workspaceSlug) {
  console.log('[invite] no workspace specified — skipping workspace_members.');
  process.exit(0);
}

const { data: ws, error: wsErr } = await admin
  .from('workspaces')
  .select('id, name')
  .eq('slug', workspaceSlug)
  .maybeSingle();
if (wsErr || !ws) {
  console.error(`workspace lookup failed: ${wsErr?.message ?? 'no row for slug ' + workspaceSlug}`);
  process.exit(4);
}

const { error: memErr } = await admin
  .from('workspace_members')
  .upsert(
    { workspace_id: ws.id, user_id: userId, role },
    { onConflict: 'workspace_id,user_id' },
  );
if (memErr) {
  console.error(`workspace_members upsert failed: ${memErr.message}`);
  process.exit(6);
}
console.log(`[invite] ✓ added to ${ws.name} (${workspaceSlug}) as ${role}`);
