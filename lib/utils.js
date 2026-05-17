// Shared helpers — date math, color resolvers

/** Compute project progress (0-100) from a slice of tasks belonging to the project. */
export function projectProgress(tasks) {
  if (!tasks || tasks.length === 0) return 0;
  return Math.round(tasks.filter((t) => t.status === 'Done').length / tasks.length * 100);
}

export const TODAY = new Date();

export function parseDate(s) { return new Date(s + 'T00:00:00'); }

export function daysUntil(s) {
  const d = parseDate(s);
  const diff = Math.round((d - new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate())) / 86400000);
  return diff;
}

export function dueLabel(s) {
  if (!s) return { text: '—', danger: false };
  const d = daysUntil(s);
  if (!isFinite(d)) return { text: '—', danger: false };
  if (d < 0) return { text: `${Math.abs(d)}d überfällig`, danger: true };
  if (d === 0) return { text: 'Heute', danger: false, today: true };
  if (d === 1) return { text: 'Morgen', danger: false };
  if (d <= 7) return { text: `in ${d}d`, danger: false };
  return { text: formatDate(s), danger: false };
}

export function formatDate(s) {
  const d = parseDate(s);
  const m = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  return `${d.getDate()}. ${m[d.getMonth()]}`;
}

export function formatDateLong(s) {
  const d = parseDate(s);
  const m = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  return `${d.getDate()}. ${m[d.getMonth()]} ${d.getFullYear()}`;
}

export function timeAgo(iso) {
  const t = new Date(iso);
  const diff = Math.round((TODAY - t) / 60000);
  if (diff < 1) return 'gerade eben';
  if (diff < 60) return `vor ${diff} Min`;
  if (diff < 1440) return `vor ${Math.round(diff / 60)} Std`;
  return `vor ${Math.round(diff / 1440)} Tg`;
}

export function hueFor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `oklch(0.82 0.04 ${h})`;
}

export function eventColor(type) {
  return ({
    deadline:        'var(--danger)',
    review:          'var(--warning)',
    recording:       'var(--info)',
    publish:         'var(--success)',
    'event-live':    '#e8780a',
    'event-deadline':'#f59e0b',
  })[type] || 'var(--neutral)';
}

export function statusColor(s) {
  return ({
    'In Progress': 'var(--info)',
    Planning: 'var(--neutral)',
    Review: 'var(--warning)',
    Blocked: 'var(--danger)',
    Done: 'var(--success)',
  })[s] || 'var(--neutral)';
}

export function kColColor(c) {
  return ({
    Backlog: 'var(--neutral)',
    'To Do': 'var(--text-3)',
    'In Progress': 'var(--info)',
    Review: 'var(--warning)',
    Done: 'var(--success)',
  })[c] || 'var(--neutral)';
}
