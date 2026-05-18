// Luma API client — server-side only.
// Never import this directly from client components.
// All calls go through lib/actions/luma.ts (server actions).

const LUMA_BASE = 'https://api.lu.ma/public/v1';

function getKey(): string {
  const key = process.env.LUMA_API_KEY;
  if (!key) throw new Error('LUMA_API_KEY ist nicht konfiguriert.');
  return key;
}

function lumaHeaders() {
  return { 'x-luma-api-key': getKey(), Accept: 'application/json' };
}

export function extractLumaSlug(url: string): string | null {
  const s = url.trim();
  // Manage URL: luma.com/event/manage/evt-xxx  → use evt-xxx
  const manage = s.match(/luma\.com\/event\/manage\/(evt-[a-zA-Z0-9]+)/);
  if (manage) return manage[1];
  // Direct evt-xxx ID in any URL
  const evt = s.match(/(evt-[a-zA-Z0-9]+)/);
  if (evt) return evt[1];
  // Public slug: lu.ma/slug
  const slug = s.match(/lu\.ma\/([a-zA-Z0-9_-]+)/);
  return slug ? slug[1] : null;
}

export interface LumaEventData {
  apiId: string;
  name: string;
  startAt?: string;
  endAt?: string;
  timezone?: string;
  location?: string;
  url: string;
  coverUrl?: string;
  guestCount?: number;
}

export interface LumaGuest {
  name: string;
  email?: string;
  approvalStatus: 'approved' | 'pending_approval' | 'declined';
}

export async function getLumaEvent(slug: string): Promise<LumaEventData> {
  const res = await fetch(
    `${LUMA_BASE}/event/get?api_id=${encodeURIComponent(slug)}`,
    { headers: lumaHeaders(), cache: 'no-store' },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Luma API ${res.status}: ${body.slice(0, 120)}`);
  }
  const json = await res.json();
  const ev = json.event ?? json;
  return {
    apiId:     ev.api_id ?? slug,
    name:      ev.name ?? '',
    startAt:   ev.start_at   ?? undefined,
    endAt:     ev.end_at     ?? undefined,
    timezone:  ev.timezone   ?? undefined,
    location:  ev.geo_address_info?.full_address
            ?? ev.geo_address_json?.address
            ?? undefined,
    url:       `https://lu.ma/${slug}`,
    coverUrl:  ev.cover_url  ?? undefined,
    guestCount: typeof ev.guest_count === 'number' ? ev.guest_count : undefined,
  };
}

export async function getLumaGuests(eventApiId: string): Promise<LumaGuest[]> {
  const guests: LumaGuest[] = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({ event_api_id: eventApiId, limit: '100' });
    if (cursor) params.set('pagination_cursor', cursor);

    const res = await fetch(`${LUMA_BASE}/event/get-guests?${params}`, {
      headers: lumaHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) break;

    const json = await res.json();
    for (const entry of json.entries ?? []) {
      const g = entry.guest ?? entry;
      guests.push({
        name:           g.name ?? g.full_name ?? 'Unbekannt',
        email:          g.email ?? undefined,
        approvalStatus: g.approval_status ?? 'approved',
      });
    }
    cursor = json.next_cursor ?? undefined;
  } while (cursor && guests.length < 500);

  return guests;
}
