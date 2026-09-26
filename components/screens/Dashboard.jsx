'use client';
// Dashboard Overview screen

import { useState, useMemo } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { DivisionSwitcher, useDivisionFilter } from '@/components/DivisionSwitcher';
import { QuickStatusPicker } from '@/components/QuickStatus';
import { I } from '@/components/icons';
import {
  Avatar, AvatarStack, Badge, EmptyState,
  PriorityBadge, Progress, SlackCard, StatusBadge,
} from '@/components/ui';
import { daysUntil, dueLabel, eventColor, formatDate, formatDateLong, parseDate, projectProgress } from '@/lib/utils';
import { markTaskDone, changeTaskStatus } from '@/lib/actions/tasks';
import { StandupWidget } from '@/components/screens/Standup';
import './dashboard.css';

const WEEKDAY_LABEL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const SPECIALTY_LABEL = {
  host:      { icon: '🎙️', label: 'Host / Moderator' },
  editor:    { icon: '✂️', label: 'Cutter / Editor' },
  thumbnail: { icon: '🎨', label: 'Thumbnail Designer' },
  shownotes: { icon: '📝', label: 'Show Notes' },
  social:    { icon: '📱', label: 'Social Media' },
  audio:     { icon: '🎵', label: 'Audio Engineer' },
  manager:   { icon: '⚙️', label: 'Manager / Producer' },
};
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function greeting(name) {
  const h = new Date().getHours();
  const salut = h < 12 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend';
  return `${salut}, ${name}.`;
}

export function DashboardScreen({ setRoute, onOpenTask }) {
  const { currentWorkspace: brand, data, me, myRole } = useWorkspace();
  const filterByDivision = useDivisionFilter();
  const defaultTab = (myRole === 'manager' || myRole === 'member') ? 'focus' : 'overview';
  const [dashTab, setDashTab] = useState(defaultTab);

  const allTasks  = filterByDivision(data.tasks.map(t => ({
    ...t,
    division: data.projects.find(p => p.id === t.projectId)?.division ?? 'general',
  })));
  const projects  = filterByDivision(data.projects);
  const open      = allTasks.filter((t) => t.status !== 'Done');
  const dueToday  = open.filter((t) => daysUntil(t.due) === 0);
  const overdue   = open.filter((t) => daysUntil(t.due) < 0);
  const blocked   = open.filter((t) => t.status === 'Blocked');
  const inReview  = open.filter((t) => t.status === 'Review');
  const myOpen    = me ? open.filter((t) => t.assignee === me.id) : [];
  const slackNotifs = data.slackNotifications;
  const activeProjects = projects.filter((p) => p.status !== 'Done');

  const now = new Date();
  const todayIso    = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayLabel  = `${WEEKDAY_LABEL[now.getDay()]}, ${formatDateLong(todayIso)}`;
  const firstName   = me?.name?.split(' ')[0] ?? 'Fabian';

  const completedThisWeek = useMemo(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    return data.activity.filter((a) => {
      const t = new Date(a.time).getTime();
      return a.icon === 'check' && Number.isFinite(t) && t >= cutoff;
    }).length;
  }, [data.activity]);

  // Critical tasks: overdue first, then due today, then high-priority — deduped
  const criticalTasks = useMemo(() => {
    const seen = new Set();
    const add = (t) => { if (!seen.has(t.id)) { seen.add(t.id); return true; } return false; };
    return [
      ...overdue.filter(add),
      ...dueToday.filter(add),
      ...open.filter((t) => t.priority === 'High' && add(t)),
    ].slice(0, 6);
  }, [overdue, dueToday, open]);

  const upcomingEvents = useMemo(() => {
    const nowMs = Date.now();
    const end   = nowMs + SEVEN_DAYS_MS;
    const evs   = [];
    allTasks.forEach((t) => {
      if (!t.due) return;
      const d = parseDate(t.due).getTime();
      if (d >= nowMs && d <= end) evs.push({ date: t.due, type: t.status === 'Review' ? 'review' : 'deadline', title: t.title, projectId: t.projectId });
    });
    projects.forEach((p) => {
      if (!p.due) return;
      const d = parseDate(p.due).getTime();
      if (d >= nowMs && d <= end) evs.push({ date: p.due, type: 'deadline', title: p.name, projectId: p.id });
    });
    return evs.sort((a, b) => a.date.localeCompare(b.date));
  }, [allTasks, projects]);

  // Build 7-day plan (after allTasks is defined)
  const weekPlan = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      const iso = d.toISOString().slice(0, 10);
      const tasks = allTasks.filter(t => t.due === iso && t.status !== 'Done');
      const events = data.projects.filter(p =>
        p.division === 'events' && p.eventMeta?.eventDate?.slice(0, 10) === iso
      );
      const episodes = (data.episodes ?? []).filter(e => e.date === iso);
      days.push({ iso, label: i === 0 ? 'Heute' : i === 1 ? 'Morgen' : WEEKDAY_LABEL[d.getDay()], tasks, events, episodes, date: d });
    }
    return days;
  }, [allTasks, data.projects, data.episodes]);

  return (
    <div className="page fade-in">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="page-head" style={dashTab === 'overview' ? { paddingBottom: 12, marginBottom: 16, borderBottom: 0 } : { paddingBottom: 20, marginBottom: 24 }}>
        <div>
          <div className="meta mb-2" suppressHydrationWarning>{todayLabel}</div>
          <div className="row gap-3 items-center" style={{ flexWrap: 'wrap', marginBottom: 4 }}>
            <h1 className="h1" style={{ fontSize: 24, margin: 0 }} suppressHydrationWarning>{greeting(firstName)}</h1>
            <DivisionSwitcher />
            <div style={{ display: 'flex', gap: 4, padding: '2px', background: 'var(--bg-sunk)', borderRadius: 10, marginLeft: 4 }}>
              {[{ id: 'overview', label: 'Überblick' }, { id: 'focus', label: 'Mein Fokus' }, { id: 'week', label: 'Wochenplan' }].map((t) => (
                <button key={t.id} onClick={() => setDashTab(t.id)} style={{
                  padding: '4px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 500, transition: 'all 0.12s',
                  background: dashTab === t.id ? 'var(--bg-elev)' : 'transparent',
                  color: dashTab === t.id ? 'var(--text-1)' : 'var(--text-3)',
                  boxShadow: dashTab === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}>{t.label}</button>
              ))}
            </div>
          </div>
          <div className="row gap-2 mt-2" style={{ flexWrap: 'wrap' }}>
            <p style={{ color: 'var(--text-2)', fontSize: 14, margin: 0 }}>
              Das ist dein Überblick für heute.
            </p>
            {me?.specialty && SPECIALTY_LABEL[me.specialty] && (
              <span style={{
                fontSize: 12.5, fontWeight: 500,
                color: 'var(--brand)',
                background: 'var(--brand-soft)',
                border: '1px solid transparent',
                borderRadius: 'var(--r-pill)',
                padding: '2px 10px',
              }}>
                {SPECIALTY_LABEL[me.specialty].icon} {SPECIALTY_LABEL[me.specialty].label}
              </span>
            )}
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setRoute('projects')} style={{ alignSelf: 'flex-start' }}>
          <I.plus size={13} /> Neues Projekt
        </button>
      </div>

      {/* ── Mein Fokus ──────────────────────────────────────────────────── */}
      {dashTab === 'focus' && me && (
        <MeinFokus me={me} data={data} setRoute={setRoute} onOpenTask={onOpenTask} />
      )}

      {dashTab === 'focus' && !me && (
        <div className="card card-pad" style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👤</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Profil wird geladen…</div>
        </div>
      )}

      {dashTab === 'week' && (
        <div className="col gap-3">
          {weekPlan.map(({ iso, label, tasks, events, episodes, date }) => {
            const total = tasks.length + events.length + episodes.length;
            const isToday = label === 'Heute';
            return (
              <div key={iso} style={{
                borderRadius: 10,
                border: `1px solid ${isToday ? 'var(--brand)' : 'var(--border-soft)'}`,
                background: isToday ? 'var(--brand-soft)' : 'var(--bg-card)',
                overflow: 'hidden',
              }}>
                <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: total > 0 ? '1px solid var(--border-soft)' : 'none' }}>
                  <div style={{ minWidth: 90 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: isToday ? 'var(--brand)' : 'var(--text-1)' }}>{label}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>
                      {date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                  {total === 0
                    ? <span style={{ fontSize: 12.5, color: 'var(--text-4)', fontStyle: 'italic' }}>Nichts geplant</span>
                    : <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
                        {events.length > 0 && <span style={{ fontSize: 12, background: '#fff4e6', color: '#e8780a', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>🎪 {events.length} Event{events.length > 1 ? 's' : ''}</span>}
                        {episodes.length > 0 && <span style={{ fontSize: 12, background: 'var(--brand-soft)', color: 'var(--brand)', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>🎙 {episodes.length} Episode{episodes.length > 1 ? 'n' : ''}</span>}
                        {tasks.length > 0 && <span style={{ fontSize: 12, background: 'var(--bg-sunk)', color: 'var(--text-2)', borderRadius: 6, padding: '2px 8px' }}>✅ {tasks.length} Task{tasks.length > 1 ? 's' : ''} fällig</span>}
                      </div>
                  }
                </div>
                {total > 0 && (
                  <div style={{ padding: '6px 16px 10px' }}>
                    {events.map(p => (
                      <div key={p.id} onClick={() => setRoute('project:' + p.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border-soft)' }}>
                        <span>🎪</span>
                        <span style={{ fontWeight: 500, flex: 1 }}>{p.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{p.eventMeta?.location ?? ''}</span>
                      </div>
                    ))}
                    {episodes.map(e => (
                      <div key={e.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13, borderBottom: '1px solid var(--border-soft)' }}>
                        <span>🎙</span>
                        <span style={{ flex: 1 }}>{e.title}</span>
                        {e.num != null && <span style={{ fontSize: 11, color: 'var(--text-4)' }}>Ep. {e.num}</span>}
                      </div>
                    ))}
                    {tasks.slice(0, 4).map(t => (
                      <div key={t.id} onClick={() => onOpenTask?.(t.id, t.projectId)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-4)' }}>✅</span>
                        <span style={{ flex: 1 }} className="truncate">{t.title}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{data.projects.find(p => p.id === t.projectId)?.name ?? ''}</span>
                      </div>
                    ))}
                    {tasks.length > 4 && <div style={{ fontSize: 11.5, color: 'var(--text-4)', paddingTop: 4 }}>+{tasks.length - 4} weitere Tasks</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {dashTab !== 'focus' && dashTab !== 'week' && (() => {
        // ── Überblick: ruhige Karten, eine Akzentfarbe, echte Daten ─────────
        const WOCHE_MS = 7 * 24 * 60 * 60 * 1000;
        const jetzt = Date.now();
        const erledigtIn = (von, bis) => data.activity.filter((a) => {
          const t = new Date(a.time).getTime();
          return a.icon === 'check' && t >= von && t < bis;
        }).length;
        const wochen = Array.from({ length: 8 }, (_, i) => {
          const bis = jetzt - (7 - i) * WOCHE_MS;
          const d = new Date(bis - 1);
          return { label: i === 7 ? 'Diese' : `${d.getDate()}.${d.getMonth() + 1}.`, n: erledigtIn(bis - WOCHE_MS, bis + (i === 7 ? WOCHE_MS : 0)) };
        });
        const dieseWoche = wochen[7].n;
        const vorwoche = wochen[6].n;
        const schnitt = wochen.reduce((s, w) => s + w.n, 0) / wochen.length;
        const wocheMax = Math.max(1, schnitt, ...wochen.map((w) => w.n));
        const delta = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);

        const gruppen = [
          { id: 'offen',    label: 'Offen',     farbe: '#3f63d6', n: open.filter((t) => t.status === 'Backlog' || t.status === 'To Do').length },
          { id: 'arbeit',   label: 'In Arbeit', farbe: 'var(--brand)', n: open.filter((t) => t.status === 'In Progress').length },
          { id: 'review',   label: 'Review',    farbe: '#7c3aed', n: inReview.length },
          { id: 'blockiert',label: 'Blockiert', farbe: 'var(--danger)', n: blocked.length, status: true },
        ];
        const gruppenSumme = Math.max(1, gruppen.reduce((s, g) => s + g.n, 0));

        // Fälligkeiten: 4 Wochen ab Montag dieser Woche, Zeilen = Wochentage
        const montag = new Date(); montag.setHours(0, 0, 0, 0);
        montag.setDate(montag.getDate() - ((montag.getDay() + 6) % 7));
        const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const heatSpalten = Array.from({ length: 4 }, (_, w) => {
          const tage = Array.from({ length: 7 }, (_, t) => {
            const d = new Date(montag); d.setDate(montag.getDate() + w * 7 + t);
            const tasks = open.filter((x) => x.due === iso(d));
            return { iso: iso(d), datum: d, n: tasks.length, titel: tasks.slice(0, 3).map((x) => x.title), vergangen: d < new Date(new Date().setHours(0, 0, 0, 0)) };
          });
          const k = new Date(montag); k.setDate(montag.getDate() + w * 7);
          return { label: w === 0 ? 'Diese Woche' : `ab ${k.getDate()}.${k.getMonth() + 1}.`, tage };
        });
        const heatMax = Math.max(1, ...heatSpalten.flatMap((s) => s.tage.map((t) => t.n)));
        const stufe = (n) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / heatMax) * 4)));
        const faelligVier = heatSpalten.flatMap((s) => s.tage).filter((t) => !t.vergangen).reduce((s, t) => s + t.n, 0);

        const auslastung = data.members
          .map((u) => ({ u, n: open.filter((t) => t.assignee === u.id).length, spaet: overdue.filter((t) => t.assignee === u.id).length }))
          .sort((a, b) => b.n - a.n).slice(0, 6);
        const auslastungMax = Math.max(1, ...auslastung.map((x) => x.n));
        const auslastungSchnitt = auslastung.length ? auslastung.reduce((s, x) => s + x.n, 0) / auslastung.length : 0;
        const person = (id) => data.members.find((u) => u.id === id);
        const projektName = (id) => data.projects.find((p) => p.id === id)?.name ?? '—';

        const Kopf = ({ icon, titel, hilfe, children }) => (
          <div className="db2-kopf">
            <div className="db2-titel">{icon}<span>{titel}</span>{hilfe && <i className="db2-hilfe" title={hilfe}>i</i>}</div>
            <div className="db2-aktionen">{children}</div>
          </div>
        );
        const Delta = ({ wert }) => (wert == null ? null : (
          <span className={wert >= 0 ? 'db2-delta db2-hoch' : 'db2-delta db2-runter'}>{wert >= 0 ? '↑' : '↓'} {Math.abs(wert)} %</span>
        ));

        return (
          <div className="db2">
            {/* ── Kennzahlen ── */}
            <div className="db2-kpis">
              <button type="button" className="db2-karte db2-kpi" onClick={() => setRoute('mytasks')}>
                <Kopf titel="Offene Aufgaben" hilfe="Alle nicht erledigten Aufgaben im Workspace"><span className="db2-rund"><I.task size={15} /></span></Kopf>
                <div className="db2-zahl">{open.length}</div>
                <div className="db2-unter">{overdue.length > 0 ? <span className="db2-delta db2-runter">{overdue.length} überfällig</span> : <span className="db2-delta db2-hoch">nichts überfällig</span>}<span>davon {myOpen.length} bei dir</span></div>
              </button>
              <button type="button" className="db2-karte db2-kpi" onClick={() => setRoute('mytasks')}>
                <Kopf titel="Heute fällig"><span className="db2-rund"><I.calendar size={15} /></span></Kopf>
                <div className="db2-zahl">{dueToday.length}</div>
                <div className="db2-unter"><span>{upcomingEvents.length} Deadlines in den nächsten 7 Tagen</span></div>
              </button>
              <button type="button" className="db2-karte db2-kpi" onClick={() => setRoute('projects')}>
                <Kopf titel="Aktive Projekte"><span className="db2-rund"><I.folder size={15} /></span></Kopf>
                <div className="db2-zahl">{activeProjects.length}</div>
                <div className="db2-unter"><span>{projects.filter((p) => p.status === 'Blocked').length} blockiert · {projects.filter((p) => p.status === 'Review').length} im Review</span></div>
              </button>
              <button type="button" className="db2-karte db2-kpi" onClick={() => setRoute('activity')}>
                <Kopf titel="Erledigt, 7 Tage"><span className="db2-rund"><I.check size={15} /></span></Kopf>
                <div className="db2-zahl">{completedThisWeek}</div>
                <div className="db2-unter"><Delta wert={delta(dieseWoche, vorwoche)} /><span>{vorwoche} in der Vorwoche</span></div>
              </button>
            </div>

            {/* ── Verlauf + Status ── */}
            <div className="db2-reihe db2-8-4">
              <section className="db2-karte">
                <Kopf icon={<I.trend size={15} />} titel="Erledigte Aufgaben" hilfe="Pro Woche, aus dem Aktivitätsverlauf">
                  <button type="button" className="db2-knopf" onClick={() => setRoute('activity')}>Verlauf <I.arrowRight size={12} /></button>
                </Kopf>
                <div className="db2-gross">{dieseWoche}<small>diese Woche</small><Delta wert={delta(dieseWoche, vorwoche)} /></div>
                {wochen.every((w) => w.n === 0) && <p className="db2-hinweis">In den letzten 8 Wochen wurde noch nichts als erledigt markiert.</p>}
                <div className="db2-balken" role="img" aria-label="Erledigte Aufgaben der letzten 8 Wochen">
                  {schnitt > 0 && <div className="db2-schnitt" style={{ bottom: `${(schnitt / wocheMax) * 100}%` }}><span>Ø {schnitt.toLocaleString('de-DE', { maximumFractionDigits: 1 })}</span></div>}
                  {wochen.map((w, i) => (
                    <div key={i} className={i === 7 ? 'db2-saeule db2-an' : 'db2-saeule'}>
                      <div className="db2-saeule-feld">
                        <div className="db2-saeule-wert" style={{ height: `${Math.max(w.n ? 4 : 1.5, (w.n / wocheMax) * 100)}%` }}>
                          {i === 7 && <b>{w.n}</b>}
                        </div>
                        <span className="db2-tipp">{w.n} erledigt</span>
                      </div>
                      <span className="db2-achse">{w.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="db2-karte">
                <Kopf icon={<I.kanban size={15} />} titel="Aufgaben nach Status">
                  <button type="button" className="db2-knopf" onClick={() => setRoute('kanban')}>Board <I.arrowRight size={12} /></button>
                </Kopf>
                <div className="db2-gross">{open.length}<small>offen</small></div>
                <div className="db2-segmente" role="img" aria-label="Verteilung nach Status">
                  {gruppen.filter((g) => g.n > 0).map((g) => (
                    <div key={g.id} style={{ flexGrow: g.n, background: g.farbe }} title={`${g.label}: ${g.n}`} />
                  ))}
                </div>
                <ul className="db2-legende">
                  {gruppen.map((g) => (
                    <li key={g.id}>
                      <i style={{ background: g.farbe }} />
                      <span>{g.status ? <><I.alert size={12} /> {g.label}</> : g.label}</span>
                      <b>{g.n}</b>
                      <em>{Math.round((g.n / gruppenSumme) * 100)} %</em>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* ── Fälligkeiten + Team ── */}
            <div className="db2-reihe db2-7-5">
              <section className="db2-karte">
                <Kopf icon={<I.calendar size={15} />} titel="Fälligkeiten, nächste 4 Wochen" hilfe="Offene Aufgaben nach Fälligkeitstag">
                  <button type="button" className="db2-knopf" onClick={() => setRoute('calendar')}>Kalender <I.arrowRight size={12} /></button>
                </Kopf>
                <div className="db2-gross">{faelligVier}<small>Aufgaben fällig</small></div>
                {faelligVier === 0 && <p className="db2-hinweis">Keine offenen Aufgaben mit Fälligkeit in den nächsten 4 Wochen.</p>}
                <div className="db2-heat">
                  <div className="db2-heat-tage">{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((t) => <span key={t}>{t}</span>)}</div>
                  {heatSpalten.map((s) => (
                    <div key={s.label} className="db2-heat-spalte">
                      {s.tage.map((t) => (
                        <div key={t.iso} className={`db2-zelle db2-s${stufe(t.n)}${t.vergangen ? ' db2-vorbei' : ''}${t.iso === todayIso ? ' db2-heute' : ''}`}>
                          <span className="db2-tipp">{t.datum.getDate()}.{t.datum.getMonth() + 1}. · {t.n} fällig{t.titel.length ? ': ' + t.titel.join(', ') : ''}</span>
                        </div>
                      ))}
                      <span className="db2-achse">{s.label}</span>
                    </div>
                  ))}
                </div>
                <div className="db2-skala"><span>weniger</span>{[0, 1, 2, 3, 4].map((n) => <i key={n} className={`db2-zelle db2-s${n}`} />)}<span>mehr</span></div>
              </section>

              <section className="db2-karte">
                <Kopf icon={<I.team size={15} />} titel="Team-Auslastung" hilfe="Offene Aufgaben pro Person">
                  <button type="button" className="db2-knopf" onClick={() => setRoute('team')}>Team <I.arrowRight size={12} /></button>
                </Kopf>
                <ul className="db2-team">
                  {auslastung.map(({ u, n, spaet }) => (
                    <li key={u.id}>
                      <Avatar user={u} />
                      <span className="db2-team-name">{u.name.split(' ')[0]}</span>
                      <div className="db2-team-spur">
                        <div style={{ width: `${(n / auslastungMax) * 100}%` }} />
                        <i style={{ left: `${(auslastungSchnitt / auslastungMax) * 100}%` }} />
                      </div>
                      <b>{n}</b>
                      {spaet > 0 ? <span className="db2-delta db2-runter">{spaet} spät</span> : <span className="db2-delta db2-leer">—</span>}
                    </li>
                  ))}
                </ul>
                <div className="db2-fussnote">Strich = Ø {auslastungSchnitt.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Aufgaben pro Person</div>
              </section>
            </div>

            {/* ── Kritische Aufgaben ── */}
            <section className="db2-karte db2-tabelle-karte">
              <Kopf icon={<I.alert size={15} />} titel="Jetzt wichtig" hilfe="Überfällig, heute fällig oder hohe Priorität">
                <button type="button" className="db2-knopf" onClick={() => setRoute('mytasks')}>Alle Aufgaben <I.arrowRight size={12} /></button>
              </Kopf>
              {criticalTasks.length === 0 ? (
                <EmptyState icon={<I.check size={20} />} title="Nichts brennt." body="Keine überfälligen oder dringenden Aufgaben." />
              ) : (
                <div className="db2-tabelle-rahmen">
                  <table className="db2-tabelle">
                    <thead><tr><th>Aufgabe</th><th>Projekt</th><th>Zuständig</th><th>Fällig</th><th>Priorität</th><th>Status</th></tr></thead>
                    <tbody>
                      {criticalTasks.map((t) => {
                        const wer = person(t.assignee);
                        const due = dueLabel(t.due);
                        return (
                          <tr key={t.id} onClick={() => onOpenTask?.(t.id, t.projectId)}>
                            <td className="db2-fett">{t.title}</td>
                            <td className="db2-leise">{projektName(t.projectId)}</td>
                            <td>{wer ? <span className="db2-person"><Avatar user={wer} />{wer.name.split(' ')[0]}</span> : '—'}</td>
                            <td><span className={due.danger ? 'db2-pille db2-rot' : due.today ? 'db2-pille db2-gelb' : 'db2-pille'}>{due.text}</span></td>
                            <td><span className={`db2-pille db2-prio-${(t.priority || '').toLowerCase()}`}>{t.priority === 'High' ? 'Hoch' : t.priority === 'Low' ? 'Niedrig' : 'Mittel'}</span></td>
                            <td><span className="db2-pille">{t.status}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── Projekte + Standup/Slack ── */}
            <div className="db2-reihe db2-7-5">
              <section className="db2-karte">
                <Kopf icon={<I.folder size={15} />} titel="Aktive Projekte">
                  <button type="button" className="db2-knopf" onClick={() => setRoute('projects')}>Alle <I.arrowRight size={12} /></button>
                </Kopf>
                <ul className="db2-projekte">
                  {activeProjects.slice(0, 6).map((p) => {
                    const pt = data.tasks.filter((t) => t.projectId === p.id);
                    const fortschritt = projectProgress(pt);
                    const due = dueLabel(p.due);
                    return (
                      <li key={p.id} onClick={() => setRoute('project:' + p.id)}>
                        <div className="db2-projekt-name"><b>{p.name}</b><span>{pt.filter((t) => t.status !== 'Done').length} offen</span></div>
                        <div className="db2-projekt-spur"><div style={{ width: `${fortschritt}%` }} /></div>
                        <span className="db2-projekt-prozent">{fortschritt} %</span>
                        <span className={due.danger ? 'db2-pille db2-rot' : 'db2-pille'}>{due.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
              <div className="db2-stapel">
                <StandupWidget compact={true} />
                {slackNotifs.length > 0 && (
                  <section className="db2-karte">
                    <Kopf icon={<I.slack size={15} />} titel="Slack"><Badge kind="success" dot>Live</Badge></Kopf>
                    <div className="col gap-2">{slackNotifs.slice(0, 3).map((n, i) => <SlackCard key={i} notif={n} />)}</div>
                  </section>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Mein Fokus ────────────────────────────────────────────────────────────

function MeinFokus({ me, data, setRoute, onOpenTask }) {
  const myTasks     = data.tasks.filter((t) => t.assignee === me.id && t.status !== 'Done');
  const overdue     = myTasks.filter((t) => daysUntil(t.due) < 0);
  const dueToday    = myTasks.filter((t) => daysUntil(t.due) === 0);
  const thisWeek    = myTasks.filter((t) => daysUntil(t.due) > 0 && daysUntil(t.due) <= 7);
  const inProgress  = myTasks.filter((t) => t.status === 'In Progress');
  const inReview    = myTasks.filter((t) => t.status === 'Review');
  const myProjects  = data.projects.filter(
    (p) => p.status !== 'Done' && (p.owner === me.id || p.team?.includes(me.id))
  );
  const myEvents    = myProjects.filter((p) => p.division === 'events');

  const sections = [
    { label: '🔴 Überfällig', items: overdue, empty: 'Nichts überfällig.' },
    { label: '📅 Heute fällig', items: dueToday, empty: 'Heute nichts fällig.' },
    { label: '▶️ In Bearbeitung', items: inProgress, empty: null },
    { label: '👀 Wartet auf Review', items: inReview, empty: null },
    { label: '📆 Diese Woche', items: thisWeek, empty: null },
  ].filter((s) => s.items.length > 0 || s.empty !== null);

  return (
    <div className="col gap-4">
      {/* Personal task sections */}
      {sections.map((s) => s.items.length > 0 && (
        <div key={s.label} className="card card-pad">
          <div className="h3 mb-3">{s.label} <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 400 }}>({s.items.length})</span></div>
          <div className="col gap-2">
            {s.items.map((t) => {
              const p = data.projects.find((pr) => pr.id === t.projectId);
              return (
                <div key={t.id} className="row between items-center"
                  style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-sunk)', cursor: 'pointer' }}
                  onClick={() => onOpenTask?.(t.id, t.projectId)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                    {p && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>{p.name}</div>}
                  </div>
                  <div className="row gap-2" style={{ flexShrink: 0, marginLeft: 8 }}>
                    {t.due && <span style={{ fontSize: 11.5, color: daysUntil(t.due) < 0 ? 'var(--danger)' : 'var(--text-3)' }}>{dueLabel(t.due).text}</span>}
                    <QuickStatusPicker task={t} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {myTasks.length === 0 && (
        <div className="card card-pad" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>Alles erledigt!</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Du hast keine offenen Tasks.</div>
        </div>
      )}

      {/* My projects */}
      {myProjects.length > 0 && (
        <div className="card card-pad">
          <div className="h3 mb-3">📁 Meine Projekte ({myProjects.length})</div>
          <div className="col gap-2">
            {myProjects.slice(0, 6).map((p) => {
              const open = data.tasks.filter((t) => t.projectId === p.id && t.status !== 'Done').length;
              return (
                <div key={p.id} className="row between items-center"
                  style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-sunk)', cursor: 'pointer' }}
                  onClick={() => setRoute('project:' + p.id)}
                >
                  <div className="row gap-2 items-center">
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: p.division === 'events' ? '#e8780a' : 'var(--brand)',
                    }} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                    {p.division !== 'general' && (
                      <span style={{ fontSize: 10, color: p.division === 'events' ? '#e8780a' : 'var(--brand)', fontWeight: 600, textTransform: 'uppercase' }}>
                        {p.division === 'events' ? 'Event' : 'Podcast'}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{open} offen</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Legacy export kept for any screens that still import it
export const KPI = ({ label, value, trend, tone }) => (
  <div className="kpi">
    <div className="kpi-label">{label}</div>
    <div className="kpi-value mono">{value}</div>
    <div className={`kpi-trend ${tone === 'ok' ? 'up' : tone === 'bad' ? 'down' : ''}`}>{trend}</div>
  </div>
);

function StatCard({ icon, label, value, color, bg, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: bg,
        border: `1px solid ${color}22`,
        borderRadius: 'var(--r-lg)',
        padding: '18px 20px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.12s, box-shadow 0.12s',
      }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      <div className="row between mb-2">
        <span style={{ color, opacity: 0.8 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12.5, color, opacity: 0.7, marginTop: 6, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function FocusRow({ task, setRoute, onOpenTask, showTag = false }) {
  const { data, currentWorkspaceId, updateTaskInCache, pushActivity } = useWorkspace();
  const p = data.projects.find((pr) => pr.id === task.projectId);
  const due = dueLabel(task.due);
  const [pending, setPending] = useState(false);

  // Wire the existing round button to toggle Done ↔ previous status. The
  // visual stays identical — we just attach an onClick.
  const toggleDone = async (e) => {
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    if (task.status === 'Done') {
      const result = await changeTaskStatus({
        taskId: task.id,
        workspaceId: currentWorkspaceId,
        from: 'Done',
        to: 'In Progress',
      });
      if (result.ok) {
        updateTaskInCache(task.id, { status: 'In Progress' });
        if (result.activity) pushActivity(result.activity);
      }
    } else {
      const result = await markTaskDone({
        taskId: task.id,
        workspaceId: currentWorkspaceId,
        from: task.status,
      });
      if (result.ok) {
        updateTaskInCache(task.id, { status: 'Done' });
        if (result.activity) pushActivity(result.activity);
      }
    }
    setPending(false);
  };

  return (
    <div
      className="row gap-3"
      onClick={() => onOpenTask ? onOpenTask(task.id, task.projectId) : setRoute('project:' + task.projectId)}
      style={{ padding: '11px 18px', borderTop: '1px solid var(--border-soft)', cursor: 'pointer' }}
    >
      <button
        className="btn btn-icon btn-sm"
        onClick={toggleDone}
        disabled={pending}
        style={{ border: '1.5px solid var(--border-strong)', borderRadius: 999, width: 18, height: 18, padding: 0, background: 'transparent' }}
      >
        {task.status === 'Done' && <I.check size={11} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500 }} className="truncate">{task.title}</div>
        <div className="row gap-2 mt-1" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
          <span>{p?.name}</span>
          {task.tags?.length > 0 && <><span>·</span><span>{task.tags.join(', ')}</span></>}
        </div>
      </div>
      {showTag ? (
        <span className={`badge ${due.danger ? 'danger' : due.today ? 'warning' : task.priority === 'High' ? 'info' : 'ghost'}`} style={{ fontSize: 10.5 }}>
          {due.danger ? 'Überfällig' : due.today ? 'Heute' : 'High'}
        </span>
      ) : (
        <>
          <PriorityBadge priority={task.priority} />
          <span className={`badge ${due.danger ? 'danger' : due.today ? 'warning' : 'ghost'}`} style={{ minWidth: 68, justifyContent: 'center', fontSize: 11 }}>{due.text}</span>
        </>
      )}
    </div>
  );
}

function ProjectCard({ project, setRoute }) {
  const { data } = useWorkspace();
  const team     = project.team.map((id) => data.members.find((u) => u.id === id)).filter(Boolean);
  const due      = dueLabel(project.due);
  const progress = projectProgress(data.tasks.filter((t) => t.projectId === project.id));
  const openCount = data.tasks.filter((t) => t.projectId === project.id && t.status !== 'Done').length;

  return (
    <div
      className="card card-pad"
      onClick={() => setRoute('project:' + project.id)}
      style={{ cursor: 'pointer', transition: 'box-shadow 0.12s, transform 0.12s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}
    >
      <div className="row between mb-3">
        <StatusBadge status={project.status} />
        <span className={`badge ${due.danger ? 'danger' : 'ghost'}`} style={{ fontSize: 10.5 }}>{due.text}</span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3, marginBottom: 8 }} className="truncate">{project.name}</div>
      <div className="row between mb-2">
        <span className="meta">{openCount} offene Tasks</span>
        <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{progress}%</span>
      </div>
      <Progress value={progress} brand />
      <div className="row between mt-3">
        <AvatarStack users={team} />
        {project.slackConnected && <I.slack size={13} color="var(--text-4)" />}
      </div>
    </div>
  );
}
