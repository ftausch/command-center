'use server';
// Auth server actions — password reset via Resend (bypasses Supabase SMTP).
// Never reveals whether an email exists in the system (security best practice).

import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';

const FROM_EMAIL = 'noreply@unicornbakery.de';
const FROM_NAME  = 'Command Center';
const SITE_URL   = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://team.unicornbakery.de';

export async function sendPasswordReset(
  email: string,
): Promise<{ ok: boolean }> {
  const admin = createAdminClient();
  if (!admin) return { ok: true }; // silent in mock mode

  const redirectTo = `${SITE_URL}/auth/callback`;

  try {
    // generateLink creates the recovery link without sending via Supabase SMTP.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type:    'recovery',
      email,
      options: { redirectTo },
    } as Parameters<typeof admin.auth.admin.generateLink>[0]);

    if (linkErr || !linkData) {
      // Don't expose error to client — log only.
      console.error('[auth/reset] generateLink failed:', linkErr?.message);
      return { ok: true }; // return ok: true to not leak account existence
    }

    const link = (linkData as any)?.properties?.action_link;
    if (!link) return { ok: true };

    // Send via Resend.
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.warn('[auth/reset] RESEND_API_KEY not set — link not sent');
      return { ok: true };
    }

    const resend = new Resend(resendKey);
    const { error: sendErr } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to:   email,
      subject: 'Dein Zugangslink zu Command Center',
      html: `<div style="font-family:-apple-system,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fcf8fa">
  <div style="margin-bottom:32px">
    <span style="font-size:20px;font-weight:700;color:#1b1b1d;letter-spacing:-0.02em">Command Center</span>
    <span style="color:#76777d;font-size:14px;margin-left:8px">· UnicornBakery</span>
  </div>
  <h2 style="font-size:24px;font-weight:700;color:#1b1b1d;margin:0 0 12px;letter-spacing:-0.02em">Passwort zurücksetzen 🔑</h2>
  <p style="font-size:15px;color:#45464d;line-height:1.6;margin:0 0 28px">
    Klicke den Button um dein Passwort zurückzusetzen und dich einzuloggen.
  </p>
  <a href="${link}" style="display:inline-block;background:#131b2e;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:8px;font-size:15px;font-weight:600">
    Passwort zurücksetzen →
  </a>
  <p style="font-size:12px;color:#76777d;margin:28px 0 0;line-height:1.5">
    Dieser Link ist 24 Stunden gültig. Falls du kein Reset angefordert hast, ignoriere diese Mail.<br><br>
    <a href="${SITE_URL}" style="color:#712edd;text-decoration:none">${SITE_URL}</a>
  </p>
</div>`,
    });

    if (sendErr) console.error('[auth/reset] Resend failed:', sendErr.message);
    else console.log(`[auth/reset] ✓ reset email sent to ${email}`);
  } catch (e: any) {
    console.error('[auth/reset] unexpected error:', e?.message);
  }

  // Always return ok: true — never reveal if email exists.
  return { ok: true };
}
