// Shared utilities for workspace setup — usable on both client and server.

/** Convert a project name to a safe Slack channel name.
 *  - lowercase, no umlauts, no spaces, max 80 chars
 *  - German umlauts: ä→ae, ö→oe, ü→ue, ß→ss
 */
export function safeSlackChannelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}
