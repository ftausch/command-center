'use server';

import { createClient } from '@/lib/supabase/server';
import { currentUser } from '@/lib/auth';
import type { ActionResult } from '@/lib/types';

const VALID_SPECIALTIES = ['host','editor','thumbnail','shownotes','social','audio','manager'] as const;

export async function updateMyProfile(input: {
  fullName?: string;
  specialty?: string;
}): Promise<ActionResult<{ fullName: string }>> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };
  const u = await currentUser();
  if (!u) return { ok: false, error: 'Nicht eingeloggt.' };

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.fullName  !== undefined) row.full_name = input.fullName.trim() || null;
  if (input.specialty !== undefined) row.specialty = input.specialty || null;

  const { error } = await supabase.from('profiles').update(row).eq('id', u.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { fullName: input.fullName ?? '' } };
}

export async function updateSpecialty(
  specialty: string,
): Promise<ActionResult<{ specialty: string }>> {
  if (!VALID_SPECIALTIES.includes(specialty as any)) {
    return { ok: false, error: 'Ungültige Spezialisierung.' };
  }
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };

  const user = await currentUser();
  if (!user) return { ok: false, error: 'Nicht eingeloggt.' };

  const { error } = await supabase
    .from('profiles')
    .update({ specialty })
    .eq('id', user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { specialty } };
}
