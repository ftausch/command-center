// Minimal line-icon set (24x24). Stroke 1.6. All accept {size, color}.
const Icon = ({ d, size = 16, color = 'currentColor', fill = 'none', stroke = 1.6, children, viewBox = '0 0 24 24' }) => (
  <svg width={size} height={size} viewBox={viewBox} fill={fill} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {d ? <path d={d} /> : children}
  </svg>
);

const I = {
  home:      (p) => <Icon {...p}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></Icon>,
  task:      (p) => <Icon {...p}><path d="M9 11l2 2 5-5"/><rect x="3" y="4" width="18" height="16" rx="2"/></Icon>,
  folder:    (p) => <Icon {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></Icon>,
  kanban:    (p) => <Icon {...p}><rect x="3" y="4" width="5" height="16" rx="1.2"/><rect x="10" y="4" width="5" height="11" rx="1.2"/><rect x="17" y="4" width="4" height="7" rx="1.2"/></Icon>,
  calendar:  (p) => <Icon {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></Icon>,
  template:  (p) => <Icon {...p}><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="13" width="11" height="7" rx="1.5"/><rect x="16" y="13" width="5" height="7" rx="1.5"/></Icon>,
  team:      (p) => <Icon {...p}><circle cx="9" cy="9" r="3"/><path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="7" r="2.5"/><path d="M15 13c3 0 5 2 5 5"/></Icon>,
  activity:  (p) => <Icon {...p}><path d="M3 12h4l3-7 4 14 3-7h4"/></Icon>,
  settings:  (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></Icon>,
  search:    (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></Icon>,
  bell:      (p) => <Icon {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9z"/><path d="M10 21a2 2 0 0 0 4 0"/></Icon>,
  plus:      (p) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>,
  filter:    (p) => <Icon {...p}><path d="M3 5h18l-7 8v6l-4-2v-4z"/></Icon>,
  chevron:   (p) => <Icon {...p}><path d="M9 6l6 6-6 6"/></Icon>,
  chevronDown:(p) => <Icon {...p}><path d="M6 9l6 6 6-6"/></Icon>,
  caret:     (p) => <Icon {...p}><path d="M7 10l5 5 5-5"/></Icon>,
  check:     (p) => <Icon {...p}><path d="M4 12l5 5L20 6"/></Icon>,
  x:         (p) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18"/></Icon>,
  arrowRight:(p) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6"/></Icon>,
  clock:     (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>,
  alert:     (p) => <Icon {...p}><path d="M12 3l10 17H2z"/><path d="M12 10v5M12 18.5v.1"/></Icon>,
  block:     (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M5.5 5.5l13 13"/></Icon>,
  flag:      (p) => <Icon {...p}><path d="M5 21V4h12l-2 4 2 4H5"/></Icon>,
  message:   (p) => <Icon {...p}><path d="M21 12a8 8 0 0 1-12.2 6.8L3 21l1.5-4.3A8 8 0 1 1 21 12z"/></Icon>,
  paperclip: (p) => <Icon {...p}><path d="M21 11l-9.5 9.5a5 5 0 0 1-7-7L13 5a3.5 3.5 0 1 1 5 5L9.5 18.5a2 2 0 1 1-3-3L14 8"/></Icon>,
  link:      (p) => <Icon {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.5-1.5"/></Icon>,
  slack:     (p) => <Icon {...p} stroke={0}><path fill="#ECB22E" d="M5 14.5a2 2 0 1 1-2-2h2zM6 14.5a2 2 0 1 1 4 0v5a2 2 0 1 1-4 0z"/><path fill="#E01E5A" d="M9.5 5a2 2 0 1 1 2-2v2zM9.5 6a2 2 0 1 1 0 4h-5a2 2 0 1 1 0-4z"/><path fill="#2EB67D" d="M19 9.5a2 2 0 1 1 2 2h-2zM18 9.5a2 2 0 1 1-4 0v-5a2 2 0 1 1 4 0z"/><path fill="#36C5F0" d="M14.5 19a2 2 0 1 1-2 2v-2zM14.5 18a2 2 0 1 1 0-4h5a2 2 0 1 1 0 4z"/></Icon>,
  user:      (p) => <Icon {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></Icon>,
  inbox:     (p) => <Icon {...p}><path d="M3 12l3-7h12l3 7v7H3z"/><path d="M3 12h5l1 3h6l1-3h5"/></Icon>,
  drag:      (p) => <Icon {...p} viewBox="0 0 20 20"><circle cx="7" cy="5" r="1.3"/><circle cx="13" cy="5" r="1.3"/><circle cx="7" cy="10" r="1.3"/><circle cx="13" cy="10" r="1.3"/><circle cx="7" cy="15" r="1.3"/><circle cx="13" cy="15" r="1.3"/></Icon>,
  more:      (p) => <Icon {...p}><circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/></Icon>,
  doc:       (p) => <Icon {...p}><path d="M6 3h9l5 5v13H6z"/><path d="M14 3v6h6"/></Icon>,
  zap:       (p) => <Icon {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></Icon>,
  trend:     (p) => <Icon {...p}><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></Icon>,
  archive:   (p) => <Icon {...p}><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8M10 12h4"/></Icon>,
};

window.I = I;
