'use client';
// Keyboard Shortcut Overlay — press ? to show all shortcuts

import { useEffect } from 'react';
import { Kbd } from '@/components/ui';

const GROUPS = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['G', 'D'], desc: 'Dashboard' },
      { keys: ['G', 'P'], desc: 'Projekte' },
      { keys: ['G', 'T'], desc: 'My Tasks' },
      { keys: ['G', 'C'], desc: 'Kalender' },
      { keys: ['G', 'A'], desc: 'Aktivität' },
      { keys: ['E'],      desc: 'Event Hub' },
      { keys: ['A'],      desc: 'Assistant Hub' },
      { keys: ['H'],      desc: 'Health Dashboard' },
      { keys: ['B'],      desc: 'Kanban Board' },
    ],
  },
  {
    title: 'Aktionen',
    shortcuts: [
      { keys: ['N'],         desc: 'Neue Task' },
      { keys: ['⇧', 'A'],   desc: 'Schnell erfassen (Follow-up, Termin…)' },
      { keys: ['⌘', 'K'],   desc: 'Command Palette öffnen' },
      { keys: ['/'],         desc: 'Suche' },
      { keys: ['?'],         desc: 'Shortcuts anzeigen' },
      { keys: ['Esc'],       desc: 'Modal / Drawer schließen' },
    ],
  },
  {
    title: 'Podcast',
    shortcuts: [
      { keys: ['⇧', 'P'], desc: 'Podcast Hub' },
    ],
  },
];

export function ShortcutOverlay({ onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape' || e.key === '?') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(20,22,28,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card card-pad" style={{ width:'100%', maxWidth:560, maxHeight:'80vh', overflowY:'auto' }}>
        <div className="row between mb-4">
          <div className="h2">⌨️ Keyboard Shortcuts</div>
          <button className="btn btn-quiet btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="col gap-5">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:10 }}>
                {g.title}
              </div>
              <div className="col gap-0">
                {g.shortcuts.map((s, i) => (
                  <div key={i} className="row between items-center" style={{ padding:'7px 0', borderBottom:'1px solid var(--border-soft)' }}>
                    <span style={{ fontSize:13.5, color:'var(--text-1)' }}>{s.desc}</span>
                    <div className="row gap-1">
                      {s.keys.map((k, j) => (
                        <Kbd key={j}>{k}</Kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop:20, fontSize:12, color:'var(--text-4)', textAlign:'center' }}>
          Drücke <Kbd>?</Kbd> oder <Kbd>Esc</Kbd> um zu schließen
        </div>
      </div>
    </div>
  );
}
