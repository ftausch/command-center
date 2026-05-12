// Shared small components: Badge, Avatar, ProgressBar, PhaseTracker, SlackCard, etc.

const Badge = ({ kind = 'neutral', children, dot, large }) => (
  <span className={`badge ${kind} ${large ? 'badge-lg' : ''}`}>
    {dot && <span className="badge-dot" />}
    {children}
  </span>
);

const Avatar = ({ user, size = 'sm' }) => {
  const cls = size === 'xl' ? 'avatar-xl' : size === 'lg' ? 'avatar-lg' : size === 'md' ? 'avatar-md' : '';
  return (
    <span className={`avatar ${cls}`} title={user.name} style={{ background: hueFor(user.id) }}>
      {user.initials}
    </span>
  );
};

const AvatarStack = ({ users, max = 4 }) => {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <span className="avatar-stack">
      {shown.map(u => <Avatar key={u.id} user={u} />)}
      {rest > 0 && <span className="avatar" style={{ background: '#e7e5e0', color: '#5a5d66' }}>+{rest}</span>}
    </span>
  );
};

// Deterministic muted avatar color
function hueFor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `oklch(0.82 0.04 ${h})`;
}

const Progress = ({ value, brand }) => (
  <div className="progress">
    <div className={`progress-bar ${brand ? 'brand' : ''}`} style={{ width: `${Math.min(100, value)}%` }} />
  </div>
);

const PhaseTracker = ({ phases, currentIdx }) => (
  <div className="phase-track">
    {phases.map((p, i) => {
      const cls = i < currentIdx ? 'done' : i === currentIdx ? 'current' : '';
      return (
        <div key={p} className={`phase-step ${cls}`}>
          <span className="dot" />
          <span className="bar" />
          <span>{p}</span>
        </div>
      );
    })}
  </div>
);

const PriorityBadge = ({ priority }) => {
  const map = {
    High:   { kind: 'danger',  label: 'High' },
    Medium: { kind: 'warning', label: 'Medium' },
    Low:    { kind: 'neutral', label: 'Low' },
  };
  const m = map[priority] || map.Medium;
  return <Badge kind={m.kind} dot>{m.label}</Badge>;
};

const StatusBadge = ({ status }) => {
  const map = {
    'Backlog':     { kind: 'neutral', label: 'Backlog' },
    'To Do':       { kind: 'ghost',   label: 'To Do' },
    'In Progress': { kind: 'info',    label: 'In Progress' },
    'Review':      { kind: 'warning', label: 'Review' },
    'Blocked':     { kind: 'danger',  label: 'Blocked' },
    'Done':        { kind: 'success', label: 'Done' },
    'Planning':    { kind: 'neutral', label: 'Planning' },
  };
  const m = map[status] || { kind: 'neutral', label: status };
  return <Badge kind={m.kind} dot>{m.label}</Badge>;
};

const BrandBadge = ({ workspace, brand }) => {
  const b = brand || window.CC_DATA.brands[workspace];
  return (
    <span className="badge" style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
      <span className="badge-dot" style={{ background: b.color }} />
      {b.name}
    </span>
  );
};

const SlackCard = ({ notif, compact }) => (
  <div className="slack-card">
    <div className="slack-mark" />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="row gap-2" style={{ fontSize: 12.5 }}>
        <span style={{ fontWeight: 600 }}>{notif.channel}</span>
        <span style={{ color: 'var(--text-3)' }}>· {notif.time}</span>
      </div>
      <div className="mt-1" style={{ fontSize: 13, color: 'var(--text-1)' }}>
        <span style={{ fontWeight: 600 }}>{notif.user}</span>{' '}
        <span style={{ color: 'var(--text-2)' }}>{notif.text}</span>
      </div>
    </div>
  </div>
);

const Kbd = ({ children }) => <span className="kbd">{children}</span>;

const EmptyState = ({ icon, title, body, action }) => (
  <div className="empty">
    <div className="empty-icon">{icon}</div>
    <div className="empty-title">{title}</div>
    <div className="empty-body">{body}</div>
    {action}
  </div>
);

// Date helpers
const TODAY = new Date('2026-05-11T10:00:00');
function parseDate(s) { return new Date(s + 'T00:00:00'); }
function daysUntil(s) {
  const d = parseDate(s);
  const diff = Math.round((d - new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate())) / 86400000);
  return diff;
}
function dueLabel(s) {
  const d = daysUntil(s);
  if (d < 0) return { text: `${Math.abs(d)}d überfällig`, danger: true };
  if (d === 0) return { text: 'Heute', danger: false, today: true };
  if (d === 1) return { text: 'Morgen', danger: false };
  if (d <= 7) return { text: `in ${d}d`, danger: false };
  return { text: formatDate(s), danger: false };
}
function formatDate(s) {
  const d = parseDate(s);
  const m = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  return `${d.getDate()}. ${m[d.getMonth()]}`;
}
function formatDateLong(s) {
  const d = parseDate(s);
  const m = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  return `${d.getDate()}. ${m[d.getMonth()]} ${d.getFullYear()}`;
}
function timeAgo(iso) {
  const t = new Date(iso);
  const diff = Math.round((TODAY - t) / 60000);
  if (diff < 1) return 'gerade eben';
  if (diff < 60) return `vor ${diff} Min`;
  if (diff < 1440) return `vor ${Math.round(diff / 60)} Std`;
  return `vor ${Math.round(diff / 1440)} Tg`;
}

Object.assign(window, {
  Badge, Avatar, AvatarStack, Progress, PhaseTracker,
  PriorityBadge, StatusBadge, BrandBadge, SlackCard, Kbd, EmptyState,
  TODAY, parseDate, daysUntil, dueLabel, formatDate, formatDateLong, timeAgo, hueFor,
});
