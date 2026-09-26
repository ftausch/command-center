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
import { MONATE } from '@/lib/status-beispiel';
import './status.css';

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
          {dashTab !== 'overview' && <div className="meta mb-2" suppressHydrationWarning>{todayLabel}</div>}
          <div className="row gap-3 items-center" style={{ flexWrap: 'wrap', marginBottom: 4 }}>
            {dashTab !== 'overview' && <h1 className="h1" style={{ fontSize: 28, margin: 0 }} suppressHydrationWarning>{greeting(firstName)}</h1>}
            <DivisionSwitcher />
            <div style={{ display: 'flex', gap: 4, padding: '2px', background: 'var(--bg-sunk)', borderRadius: 10, marginLeft: 4 }}>
              {[{ id: 'overview', label: 'Überblick' }, { id: 'focus', label: '🎯 Mein Fokus' }, { id: 'week', label: '📅 Wochenplan' }].map((t) => (
                <button key={t.id} onClick={() => setDashTab(t.id)} style={{
                  padding: '4px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 500, transition: 'all 0.12s',
                  background: dashTab === t.id ? 'var(--bg-elev)' : 'transparent',
                  color: dashTab === t.id ? 'var(--text-1)' : 'var(--text-3)',
                  boxShadow: dashTab === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}>{t.label}</button>
              ))}
            </div>
          </div>
          {dashTab !== 'overview' && <div className="row gap-2 mt-2" style={{ flexWrap: 'wrap' }}>
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
          </div>}
        </div>
        <button className="btn btn-brand btn-sm" onClick={() => setRoute('projects')} style={{ alignSelf: 'flex-start' }}>
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
        // ── Neuer Überblick (Look wie Status): echte Tasks, Projekte, Team ──
        const puenktlich = open.length ? Math.round(((open.length - overdue.length) / open.length) * 100) : 100;
        const wocheMax = Math.max(1, ...weekPlan.map((d) => d.tasks.length + d.events.length + d.episodes.length));
        const auslastung = data.members
          .map((u) => ({ u, n: open.filter((t) => t.assignee === u.id).length }))
          .sort((a, b) => b.n - a.n)
          .slice(0, 6);
        const auslastungMax = Math.max(1, ...auslastung.map((x) => x.n));
        const umsatz = MONATE[MONATE.length - 1];
        const umsatzQuote = Math.round((umsatz.umsatzIst / umsatz.umsatzPlan) * 100);
        const istLeitung = myRole === 'owner' || myRole === 'admin';
        const personName = (id) => data.members.find((u) => u.id === id)?.name ?? '';
        const projektName = (id) => data.projects.find((p) => p.id === id)?.name ?? '';

        return (
          <div className="st-seite db-seite">
            <div className="st-raster">
              <section className="st-held">
                <h1 className="st-held-titel" suppressHydrationWarning>{greeting(firstName)}<br /><span suppressHydrationWarning>{todayLabel}</span></h1>
                <p className="st-held-unter">Das ist dein Überblick für heute.</p>
                <div className="st-held-drei">
                  <button type="button" onClick={() => setRoute('mytasks')}><small><i />Überfällig</small><b>{overdue.length}</b></button>
                  <button type="button" onClick={() => setRoute('mytasks')}><small><i />Heute fällig</small><b>{dueToday.length}</b></button>
                  <button type="button" onClick={() => setRoute('kanban')}><small><i />Blockiert</small><b>{blocked.length}</b></button>
                </div>
                <div className="st-held-bogen">
                  <DbBogen prozent={puenktlich} klasse="st-bogen st-bogen-held" />
                  <div className="st-held-zahl">
                    <small>{puenktlich} % im Zeitplan</small>
                    <b>{open.length}</b>
                    <span>offene Tasks · {completedThisWeek} erledigt in 7 Tagen</span>
                  </div>
                </div>
              </section>

              <section className="st-feed">
                <h2>Jetzt <span>wichtig</span></h2>
                {criticalTasks.length === 0 ? (
                  <p className="db-feed-leer">Nichts überfällig, nichts brennt. Gute Arbeit!</p>
                ) : (
                  <ul>
                    {criticalTasks.map((t) => {
                      const due = dueLabel(t.due);
                      const wer = personName(t.assignee);
                      return (
                        <li key={t.id} className="st-feed-eintrag db-klickbar" onClick={() => onOpenTask?.(t.id, t.projectId)}>
                          <span className="st-feed-zeichen">{(wer || '?')[0]}</span>
                          <div>
                            <b>{t.title}</b>
                            <span>{projektName(t.projectId) || 'Ohne Projekt'}{wer ? ` · ${wer.split(' ')[0]}` : ''}</span>
                          </div>
                          <span className={due.danger ? 'st-feed-wann st-feed-spaet' : 'st-feed-wann'}>{due.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <div className="st-kacheln">
                <button type="button" className="st-kachel" onClick={() => setRoute('mytasks')}>
                  <span>Meine offenen Tasks</span>
                  <b>{myOpen.length}<em> Tasks</em></b>
                  <div className="st-kachel-fuss">{myOpen.filter((t) => daysUntil(t.due) <= 0).length} davon heute oder überfällig</div>
                </button>
                <button type="button" className="st-kachel" onClick={() => setRoute('projects')}>
                  <span>Aktive Projekte</span>
                  <b>{activeProjects.length}<em> Projekte</em></b>
                  <div className="st-kachel-fuss">{upcomingEvents.length} Deadlines in 7 Tagen</div>
                </button>
                <button type="button" className="st-kachel" onClick={() => setRoute('activity')}>
                  <span>Erledigt, letzte 7 Tage</span>
                  <b>{completedThisWeek}<em> Tasks</em></b>
                  <div className="st-kachel-fuss">{inReview.length} im Review</div>
                </button>
              </div>

              <section className="st-box st-verlauf-box">
                <div className="st-box-kopf">
                  <h2>Diese Woche</h2>
                  <button type="button" className="db-link" onClick={() => setRoute('calendar')}>Kalender <I.arrowRight size={13} /></button>
                </div>
                <div className="st-summe">
                  <small>Fällig in den nächsten 7 Tagen</small>
                  <b>{weekPlan.reduce((s, d) => s + d.tasks.length, 0)}<em> Tasks</em></b>
                </div>
                <div className="st-verlauf">
                  {weekPlan.map((d, n) => {
                    const menge = d.tasks.length + d.events.length + d.episodes.length;
                    const titel = [...d.events.map((e) => e.name), ...d.episodes.map((e) => e.title), ...d.tasks.map((t) => t.title)];
                    return (
                      <button key={d.iso} type="button" onClick={() => setRoute('calendar')} className={n === 0 ? 'st-saeule st-an' : 'st-saeule'}>
                        <div className="st-saeule-feld">
                          <div className="st-plan" style={{ height: '100%' }} />
                          <div className="st-ist" style={{ height: `${Math.max(menge ? 6 : 0, (menge / wocheMax) * 100)}%` }}>
                            {n === 0 && <span className="st-marke">{menge} heute</span>}
                          </div>
                          {titel.length > 0 && (
                            <div className="st-tipp">
                              <b>{d.label}</b>
                              {titel.slice(0, 4).map((x, k) => <span key={k} className="db-tipp-zeile">{x}</span>)}
                              {titel.length > 4 && <span className="st-klein">+ {titel.length - 4} weitere</span>}
                            </div>
                          )}
                        </div>
                        <span className="st-monat">{n < 2 ? d.label : d.label.slice(0, 2)}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="st-box st-produkte">
                <div className="st-box-kopf">
                  <h2>Team-Auslastung</h2>
                  <button type="button" className="db-link" onClick={() => setRoute('team')}>Team <I.arrowRight size={13} /></button>
                </div>
                <div className="db-last">
                  {auslastung.map(({ u, n }) => (
                    <div key={u.id} className="db-last-zeile">
                      <Avatar user={u} />
                      <span className="db-last-name">{u.name.split(' ')[0]}</span>
                      <div className="db-last-balken">
                        <div className={n > 6 ? 'db-last-voll db-last-hoch' : 'db-last-voll'} style={{ width: `${(n / auslastungMax) * 100}%` }} />
                      </div>
                      <span className={n > 6 ? 'db-last-zahl st-schlecht' : 'db-last-zahl'}>{n}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="st-box st-pipeline">
                {istLeitung ? (
                  <>
                    <div className="st-box-kopf">
                      <h2>Umsatz {umsatz.kurz}</h2>
                      <button type="button" className="db-link" onClick={() => setRoute('status')}>Status <I.arrowRight size={13} /></button>
                    </div>
                    <div className="st-pipeline-bogen">
                      <DbBogen prozent={umsatzQuote} klasse="st-bogen st-bogen-hell" />
                      <div className="st-pipeline-zahl">
                        <b>{umsatzQuote} %</b>
                        <span>vom Monatsziel</span>
                      </div>
                    </div>
                    <div className="st-pipeline-fuss">
                      <div><small><i className="st-punkt st-punkt-ist" />Ist</small><b>{umsatz.umsatzIst.toLocaleString('de-DE')} €</b></div>
                      <div><small><i className="st-punkt st-punkt-plan" />Ziel</small><b>{umsatz.umsatzPlan.toLocaleString('de-DE')} €</b></div>
                    </div>
                    <p className="st-klein db-hinweis">Beispielzahlen, bis die echte Quelle steht</p>
                  </>
                ) : (
                  <>
                    <div className="st-box-kopf"><h2>Review & Blockiert</h2></div>
                    <div className="st-pipeline-fuss db-zwei">
                      <div><small><i className="st-punkt st-punkt-ist" />Im Review</small><b>{inReview.length}</b></div>
                      <div><small><i className="st-punkt st-punkt-hinten" />Blockiert</small><b>{blocked.length}</b></div>
                    </div>
                  </>
                )}
              </section>

              <section className="st-box st-projekte">
                <div className="st-box-kopf">
                  <h2>Aktive Projekte</h2>
                  <button type="button" className="db-link" onClick={() => setRoute('projects')}>Alle Projekte <I.arrowRight size={13} /></button>
                </div>
                {activeProjects.length === 0 ? (
                  <EmptyState icon={<I.folder size={20} />} title="Keine aktiven Projekte." body="Erstelle ein Projekt um loszulegen." />
                ) : (
                  <div className="db-projekte">
                    {activeProjects.slice(0, 6).map((p) => <ProjectCard key={p.id} project={p} setRoute={setRoute} />)}
                  </div>
                )}
              </section>
            </div>

            <div className={slackNotifs.length > 0 ? 'db-unten' : 'db-unten db-unten-eins'}>
              <StandupWidget compact={true} />
              {slackNotifs.length > 0 && (
                <section className="st-box">
                  <div className="st-box-kopf">
                    <h2 className="row gap-2"><I.slack size={15} /> Slack Digest</h2>
                    <Badge kind="success" dot>Live</Badge>
                  </div>
                  <div className="col gap-2">
                    {slackNotifs.slice(0, 3).map((n, i) => <SlackCard key={i} notif={n} />)}
                  </div>
                </section>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// Halbkreis-Bogen wie auf der Status-Seite. prozent 0–100, Farben aus status.css.
function DbBogen({ prozent, klasse }) {
  const d = 'M 20 150 A 130 130 0 0 1 280 150';
  return (
    <svg viewBox="0 0 300 160" className={klasse} aria-hidden>
      <path d={d} pathLength={100} className="st-bogen-hinten" />
      <path d={d} pathLength={100} className="st-bogen-vorne" strokeDasharray={`${Math.min(prozent, 100)} 100`} />
    </svg>
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
