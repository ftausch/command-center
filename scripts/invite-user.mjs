// Invite (or recover) a user via generateLink + Resend.
// Bypasses Supabase built-in email sending entirely.
//
// Usage:
//   node --env-file=.env.local scripts/invite-user.mjs <email>
//   node --env-file=.env.local scripts/invite-user.mjs <email> <workspace-slug>
//   node --env-file=.env.local scripts/invite-user.mjs <email> <workspace-slug> <role>
//
// Requires in .env.local:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY

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
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendKey   = process.env.RESEND_API_KEY;
const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://team.unicornbakery.de';

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

// Determine whether the user already exists.
const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listErr) { console.error(`listUsers failed: ${listErr.message}`); process.exit(3); }

const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
const mode = existing ? 'recovery' : 'invite';
let userId = existing?.id;

console.log(existing
  ? `[invite] user exists (${userId}) — generating recovery link`
  : '[invite] new user — generating invite link');

// generateLink creates the auth.users row for new users + gives us the magic link.
const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: mode,
  email,
  options: { redirectTo },
});
if (linkErr) { console.error(`generateLink failed: ${linkErr.message}`); process.exit(3); }

// Use hashed_token → our /auth/callback instead of Supabase's direct URL.
// The action_link (supabase.co/auth/v1/verify) requires apikey in some configs.
const hashedToken = linkData?.properties?.hashed_token;
if (!hashedToken) { console.error('generateLink returned no hashed_token'); process.exit(3); }
const inviteLink = `${siteUrl}/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=${mode}`;

// Resolve userId for new users.
if (!existing) {
  userId = linkData?.user?.id;
  if (!userId) {
    const { data: recheck } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const found = recheck?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!found) { console.error('Could not find newly created user'); process.exit(5); }
    userId = found.id;
  }
}

console.log(`[invite] ✓ link generated`);

// Send via Resend.
if (resendKey) {
  const intro = mode === 'invite'
    ? 'Du hast eine Einladung zu <strong>Command Center</strong> erhalten.'
    : 'Hier ist dein persönlicher Zugangslink zu <strong>Command Center</strong>.';
  const label = mode === 'invite' ? 'Einladung annehmen →' : 'Jetzt einloggen →';
  const subject = mode === 'invite'
    ? 'Du wurdest zu Command Center eingeladen'
    : 'Dein Zugang zu Command Center';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Command Center <noreply@unicornbakery.de>',
      to: [email],
      subject,
      html: `<div style="font-family:-apple-system,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fcf8fa">
  <div style="margin-bottom:32px"><span style="font-size:20px;font-weight:700;color:#1b1b1d">Command Center</span><span style="color:#76777d;font-size:14px;margin-left:8px">· UnicornBakery</span></div>
  <h2 style="font-size:24px;font-weight:700;color:#1b1b1d;margin:0 0 12px">${mode === 'invite' ? 'Du wurdest eingeladen 🎉' : 'Dein Zugangslink 🔑'}</h2>
  <p style="font-size:15px;color:#45464d;line-height:1.6;margin:0 0 28px">${intro}</p>
  <a href="${inviteLink}" style="display:inline-block;background:#131b2e;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:8px;font-size:15px;font-weight:600">${label}</a>
  <p style="font-size:12px;color:#76777d;margin:28px 0 0;line-height:1.5">Dieser Link ist 24 Stunden gültig.<br><a href="https://team.unicornbakery.de" style="color:#712edd;text-decoration:none">team.unicornbakery.de</a></p>
</div>`,
    }),
  });
  const body = await res.json();
  if (res.ok) console.log(`[invite] ✓ Email via Resend gesendet (id: ${body.id})`);
  else console.error('[invite] Resend failed:', JSON.stringify(body));
} else {
  console.log('[invite] RESEND_API_KEY not set — skipping email. Use this link manually:');
  console.log(inviteLink);
}

if (!workspaceSlug) {
  console.log('[invite] no workspace specified — skipping workspace_members.');
  process.exit(0);
}

const { data: ws, error: wsErr } = await admin
  .from('workspaces').select('id, name').eq('slug', workspaceSlug).maybeSingle();
if (wsErr || !ws) {
  console.error(`workspace lookup failed: ${wsErr?.message ?? 'no row for slug ' + workspaceSlug}`);
  process.exit(4);
}

// Ensure profiles row.
await admin.from('profiles').upsert({ id: userId, email, full_name: email }, { onConflict: 'id' });

const { error: memErr } = await admin.from('workspace_members')
  .upsert({ workspace_id: ws.id, user_id: userId, role }, { onConflict: 'workspace_id,user_id' });
if (memErr) { console.error(`workspace_members upsert failed: ${memErr.message}`); process.exit(6); }
console.log(`[invite] ✓ added to ${ws.name} (${workspaceSlug}) as ${role}`);
