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

/**
 * Compute an Event Health Score based on how close the event is and what's missing.
 * @param {object} project   — ProjectView with eventMeta
 * @param {array}  tasks     — TaskView[] for this project
 * @param {array}  partners  — EventPartner[] for this project (optional)
 * @returns {{ score: 'green'|'yellow'|'red', reasons: string[] }}
 */
export function eventHealthScore(project, tasks = [], partners = []) {
  const reasons = [];
  const meta    = project?.eventMeta ?? {};
  const hoursUntil = meta.eventDate
    ? (new Date(meta.eventDate).getTime() - Date.now()) / 3_600_000
    : null;
  const daysUntilEvent = hoursUntil !== null ? hoursUntil / 24 : null;

  const openTasks   = tasks.filter((t) => t.status !== 'Done');
  const overdueTasks = openTasks.filter((t) => {
    if (!t.due) return false;
    return new Date(t.due) < new Date();
  });
  const overdueHigh  = overdueTasks.filter((t) => t.priority === 'High');

  // ── RED conditions ──────────────────────────────────────────────────────
  if (daysUntilEvent !== null && daysUntilEvent <= 7 && daysUntilEvent >= 0) {
    if (!meta.location) {
      reasons.push('Keine Location eingetragen — Event in < 7 Tagen');
    }
    if (overdueHigh.length > 0) {
      reasons.push(`${overdueHigh.length} überfällige High-Priority Task${overdueHigh.length > 1 ? 's' : ''}`);
    }
  }
  if (reasons.length > 0) return { score: 'red', reasons };

  // ── YELLOW conditions ────────────────────────────────────────────────────
  if (daysUntilEvent !== null && daysUntilEvent <= 14 && daysUntilEvent >= 0) {
    if (!meta.landingPageUrl && !meta.signupUrl) {
      reasons.push('Landing Page und Signup-Link fehlen noch');
    }
  }
  const confirmedWithoutLogo = partners.filter(
    (p) => (p.status === 'confirmed' || p.status === 'active') && !p.logoReceived
  );
  if (confirmedWithoutLogo.length > 0) {
    reasons.push(`${confirmedWithoutLogo.length} bestätigte${confirmedWithoutLogo.length > 1 ? 'r' : ''} Sponsor ohne Logo`);
  }
  if (overdueTasks.length > 2) {
    reasons.push(`${overdueTasks.length} überfällige Tasks`);
  }
  if (reasons.length > 0) return { score: 'yellow', reasons };

  return { score: 'green', reasons: [] };
}

export function eventHealthColor(score) {
  return score === 'red' ? 'var(--danger)' : score === 'yellow' ? 'var(--warning)' : 'var(--success)';
}

/**
 * General project health score for any project (podcast, general, events).
 * Events get the richer event-specific calculation.
 * @param {object} project  — ProjectView
 * @param {array}  tasks    — TaskView[] for this project
 * @returns {{ score: 'green'|'yellow'|'red', reasons: string[] }}
 */
export function projectHealthScore(project, tasks = []) {
  if (project?.division === 'events' && project?.eventMeta?.eventDate) {
    return eventHealthScore(project, tasks);
  }

  const reasons = [];
  const openTasks    = tasks.filter((t) => t.status !== 'Done');
  const blockedTasks = openTasks.filter((t) => t.status === 'Blocked');
  const overdueTasks = openTasks.filter((t) => t.due && new Date(t.due) < new Date());
  const overdueHigh  = overdueTasks.filter((t) => t.priority === 'High');

  const daysLeft = project?.due ? daysUntil(project.due) : null;

  // RED: deadline < 7 days + overdue High tasks, or project itself is Blocked
  if (project?.status === 'Blocked') {
    reasons.push('Projekt ist blockiert');
    return { score: 'red', reasons };
  }
  if (daysLeft !== null && daysLeft <= 7 && daysLeft >= 0 && overdueHigh.length > 0) {
    reasons.push(`Deadline in ${daysLeft}d + ${overdueHigh.length} überfällige High-Tasks`);
    return { score: 'red', reasons };
  }
  if (daysLeft !== null && daysLeft < 0 && project?.status !== 'Done') {
    reasons.push(`Deadline ${Math.abs(daysLeft)}d überschritten`);
    return { score: 'red', reasons };
  }

  // YELLOW: blocked tasks, many overdue, or close deadline
  if (blockedTasks.length > 0) {
    reasons.push(`${blockedTasks.length} blockierte Task${blockedTasks.length > 1 ? 's' : ''}`);
  }
  if (overdueTasks.length > 1) {
    reasons.push(`${overdueTasks.length} überfällige Tasks`);
  }
  if (daysLeft !== null && daysLeft <= 14 && daysLeft >= 0) {
    reasons.push(`Deadline in ${daysLeft} Tagen`);
  }
  if (reasons.length > 0) return { score: 'yellow', reasons };

  return { score: 'green', reasons: [] };
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
