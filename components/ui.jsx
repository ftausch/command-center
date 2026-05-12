'use client';
// Shared small components: Badge, Avatar, ProgressBar, PhaseTracker, SlackCard, etc.

import { D } from '@/lib/data';
import { hueFor } from '@/lib/utils';

export const Badge = ({ kind = 'neutral', children, dot, large }) => (
  <span className={`badge ${kind} ${large ? 'badge-lg' : ''}`}>
    {dot && <span className="badge-dot" />}
    {children}
  </span>
);

export const Avatar = ({ user, size = 'sm' }) => {
  const cls = size === 'xl' ? 'avatar-xl' : size === 'lg' ? 'avatar-lg' : size === 'md' ? 'avatar-md' : '';
  return (
    <span className={`avatar ${cls}`} title={user.name} style={{ background: hueFor(user.id) }}>
      {user.initials}
    </span>
  );
};

export const AvatarStack = ({ users, max = 4 }) => {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <span className="avatar-stack">
      {shown.map(u => <Avatar key={u.id} user={u} />)}
      {rest > 0 && <span className="avatar" style={{ background: '#e7e5e0', color: '#5a5d66' }}>+{rest}</span>}
    </span>
  );
};

export const Progress = ({ value, brand }) => (
  <div className="progress">
    <div className={`progress-bar ${brand ? 'brand' : ''}`} style={{ width: `${Math.min(100, value)}%` }} />
  </div>
);

export const PhaseTracker = ({ phases, currentIdx }) => (
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

export const PriorityBadge = ({ priority }) => {
  const map = {
    High:   { kind: 'danger',  label: 'High' },
    Medium: { kind: 'warning', label: 'Medium' },
    Low:    { kind: 'neutral', label: 'Low' },
  };
  const m = map[priority] || map.Medium;
  return <Badge kind={m.kind} dot>{m.label}</Badge>;
};

export const StatusBadge = ({ status }) => {
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

export const BrandBadge = ({ workspace, brand }) => {
  const b = brand || D.brands[workspace];
  return (
    <span className="badge" style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
      <span className="badge-dot" style={{ background: b.color }} />
      {b.name}
    </span>
  );
};

export const SlackCard = ({ notif, compact }) => (
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

export const Kbd = ({ children }) => <span className="kbd">{children}</span>;

export const EmptyState = ({ icon, title, body, action }) => (
  <div className="empty">
    <div className="empty-icon">{icon}</div>
    <div className="empty-title">{title}</div>
    <div className="empty-body">{body}</div>
    {action}
  </div>
);
