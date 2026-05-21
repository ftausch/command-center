// Outbound webhooks — fires events to n8n (or any webhook URL) when
// key things happen in Command Center.
//
// Set N8N_WEBHOOK_URL in Vercel environment variables to enable.
// n8n receives the event and routes to the appropriate workflow.
//
// Event payload shape:
// {
//   event: string,          // e.g. "episode.published"
//   workspaceId: string,    // workspace UUID
//   timestamp: string,      // ISO 8601
//   data: object            // event-specific data
// }

const TIMEOUT_MS = 4000;

export async function fireWebhook(event: string, workspaceId: string, data: Record<string, unknown>): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return; // silently skip if not configured

  const payload = {
    event,
    workspaceId,
    timestamp: new Date().toISOString(),
    source: 'command-center',
    data,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[outbound] webhook POST failed: ${res.status}`);
    } else {
      console.log(`[outbound] ✓ fired ${event}`);
    }
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      console.warn(`[outbound] webhook error for ${event}:`, e.message);
    }
  } finally {
    clearTimeout(timer);
  }
}

// ── Typed event helpers ────────────────────────────────────────────────────

export const OutboundEvents = {
  episodePublished: (wsId: string, ep: { id: string; title: string; num?: number | null; guest?: string; date?: string }) =>
    fireWebhook('episode.published', wsId, ep),

  guestConfirmed: (wsId: string, guest: { id: string; name: string; email?: string; company?: string }) =>
    fireWebhook('guest.confirmed', wsId, guest),

  taskDone: (wsId: string, task: { id: string; title: string; projectId?: string; episodeId?: string; assignee?: string }) =>
    fireWebhook('task.done', wsId, task),

  eventCompleted: (wsId: string, project: { id: string; name: string; eventDate?: string; attendeeCount?: number }) =>
    fireWebhook('event.completed', wsId, project),

  projectBlocked: (wsId: string, project: { id: string; name: string; division?: string }) =>
    fireWebhook('project.blocked', wsId, project),

  schedulingConfirmed: (wsId: string, item: { id: string; title: string; confirmedDate?: string; participants?: string }) =>
    fireWebhook('scheduling.confirmed', wsId, item),
};
