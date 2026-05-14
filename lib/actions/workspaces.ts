'use server';

import { createClient } from '@/lib/supabase/server';
import { currentUser, getWorkspaceContext, canWriteAsRole } from '@/lib/auth';
import type { ActionResult } from '@/lib/types';

const ADMIN_ROLES = ['owner', 'admin'] as const;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export async function updateWorkspace(input: {
  workspaceId: string;
  name?: string;
  tagline?: string;
  color?: string;
}): Promise<ActionResult<{ name: string; tagline: string; color: string }>> {
  const user = await currentUser();
  if (!user) return { ok: false, error: 'Not signed in' };

  const ctx = await getWorkspaceContext(input.workspaceId);
  if (!ctx) return { ok: false, error: 'Workspace nicht gefunden oder kein Zugriff.' };
  if (!canWriteAsRole(ctx.role, [...ADMIN_ROLES])) {
    return { ok: false, error: 'Nur Owner und Admins können Workspace-Einstellungen ändern.' };
  }

  const patch: Record<string, string> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { ok: false, error: 'Name darf nicht leer sein.' };
    patch.name = name;
  }
  if (input.tagline !== undefined) patch.tagline = input.tagline.trim();
  if (input.color !== undefined) {
    if (!HEX_COLOR.test(input.color)) {
      return { ok: false, error: 'Farbe muss ein gültiger Hex-Code sein (#rrggbb).' };
    }
    patch.color = input.color;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true, data: { name: input.name ?? '', tagline: input.tagline ?? '', color: input.color ?? '' } };
  }

  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Nicht konfiguriert.' };

  const { data: updated, error } = await supabase
    .from('workspaces')
    .update(patch)
    .eq('id', ctx.uuid)
    .select('name, tagline, color')
    .single();

  if (error) {
    console.error('[updateWorkspace] failed', error.message);
    return { ok: false, error: error.message };
  }

  console.log(`[updateWorkspace] ✓ ${input.workspaceId} updated`);
  return {
    ok: true,
    data: {
      name: updated.name,
      tagline: updated.tagline ?? '',
      color: updated.color ?? '',
    },
  };
}
