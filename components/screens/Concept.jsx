'use client';
// Concept Doc — written deliverable embedded as a page

import { I } from '@/components/icons';
import { Badge, PriorityBadge, StatusBadge } from '@/components/ui';

export function ConceptScreen({ setRoute }) {
  return (
    <div className="page fade-in" style={{ maxWidth: 920 }}>
      <div style={{ padding: '8px 0 24px' }}>
        <div className="label mb-2">Internes Konzeptdokument</div>
        <h1 style={{ fontSize: 38, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.1, margin: 0 }}>
          Command Center — Designkonzept
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: 16, margin: '12px 0 0', maxWidth: 720 }}>
          Das interne Operations Dashboard für UnicornBakery & SelbstFrei. Dieses Dokument fasst die Produktvision, die UX-Logik, die Informationsarchitektur, das Designsystem und die MVP-Strategie zusammen.
        </p>
        <div className="row gap-2 mt-4">
          <Badge kind="ghost">v0.1 Draft</Badge>
          <Badge kind="ghost">Mai 2026</Badge>
          <Badge kind="ghost">Owner: Fabian Tausch</Badge>
        </div>
      </div>

      <Section n="01" title="Produktvision">
        <p><strong>Command Center</strong> ist das interne Betriebssystem für eine moderne Media Company. Es ersetzt WhatsApp-Chaos durch klare Aufgabenverteilung, sichtbare Verantwortung und nachvollziehbare Workflows — ohne den Charme eines persönlich geführten Studios zu verlieren.</p>
        <p>Die zentrale Frage, die das Dashboard in unter <strong>5 Sekunden</strong> beantworten muss:</p>
        <blockquote style={{ borderLeft: '3px solid var(--brand)', paddingLeft: 16, fontSize: 17, fontWeight: 500, margin: '12px 0', color: 'var(--text-1)' }}>
          Was muss ich tun, bis wann, für welches Projekt — und wer wartet auf mich?
        </blockquote>
        <p>Alles andere ist sekundär. Reports, Analytics, Automationen und Slack-Tiefe folgen erst, nachdem diese vier Fragen mühelos beantwortet sind.</p>
      </Section>

      <Section n="02" title="Wichtigste UX-Logik">
        <ul className="list">
          <li><strong>Workspace-First Architektur.</strong> Jeder Bildschirm ist immer in einem Workspace verankert. Brand-Vermischung ist technisch nicht möglich.</li>
          <li><strong>„Heute" ist Default.</strong> Dashboard und My Tasks öffnen sich immer mit der Frage „Was heute?". Filter sind sekundär.</li>
          <li><strong>Status sind binär lesbar.</strong> 5 Status (Backlog, To Do, In Progress, Review, Done) plus Blocked als horizontaler Override.</li>
          <li><strong>Slack ist ein Spiegel, nicht das Original.</strong> Tasks leben in Command Center, werden in Slack gespiegelt — nicht umgekehrt.</li>
          <li><strong>Klare Ownership.</strong> Jede Task hat genau einen Assignee. Jedes Projekt hat genau einen Owner. Mehrdeutigkeit ist eine UX-Sünde.</li>
          <li><strong>Phase-Tracker für Episoden.</strong> Da der Output zyklisch ist, gibt es pro Brand einen Phasen-Bauplan (Booking → Briefing → Recording → Edit → Review → Publish).</li>
        </ul>
      </Section>

      <Section n="03" title="Navigationsstruktur">
        <div className="card card-pad mt-3" style={{ background: 'var(--bg)' }}>
          <div className="mono" style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.8 }}>
            Command Center<br/>
            ├── <strong>Workspace Switcher</strong>  (Entry · UnicornBakery / SelbstFrei)<br/>
            └── App Shell  (Sidebar + Topbar mit ⌘K)<br/>
            {'    '}├── Dashboard      <span style={{ color: 'var(--text-4)' }}>// Was heute zählt</span><br/>
            {'    '}├── My Tasks       <span style={{ color: 'var(--text-4)' }}>// Persönlicher Fokus</span><br/>
            {'    '}├── Projects       <span style={{ color: 'var(--text-4)' }}>// Alle Projekte des Workspace</span><br/>
            {'    '}│  └── Project Detail<br/>
            {'    '}├── Board          <span style={{ color: 'var(--text-4)' }}>// Kanban über alle Projekte</span><br/>
            {'    '}├── Calendar       <span style={{ color: 'var(--text-4)' }}>// Recordings, Deadlines, Publish</span><br/>
            {'    '}├── Team           <span style={{ color: 'var(--text-4)' }}>// Auslastung pro Person</span><br/>
            {'    '}├── Templates      <span style={{ color: 'var(--text-4)' }}>// Bauplan für wiederkehrende Workflows</span><br/>
            {'    '}├── Activity       <span style={{ color: 'var(--text-4)' }}>// Chronologischer Verlauf</span><br/>
            {'    '}└── Settings       <span style={{ color: 'var(--text-4)' }}>// Workspace, Members, Slack, Brand</span>
          </div>
        </div>
      </Section>

      <Section n="04" title="Wichtigste Screens (Wireframe-Logik)">
        <ScreenDesc title="Login" >
          Minimal. Logo, Magic-Link oder SSO. Direkt nach Login → Workspace Switcher (nicht Dashboard), weil 80% der Mitglieder in beiden Workspaces sind.
        </ScreenDesc>
        <ScreenDesc title="Workspace Auswahl">
          Ganzseitige Auswahl. Zwei große Karten (UnicornBakery, SelbstFrei) mit Statistik-Footer (Projekte / offene Tasks / Team). Aktive Brand-Akzentfarbe blitzt nur beim Hover auf, nie flächig. Tipp-Footer mit ⌘K-Hinweis.
        </ScreenDesc>
        <ScreenDesc title="Dashboard Overview">
          4-spaltige KPI-Reihe (Offen · Heute · Blockiert · In Review). Darunter 2-Spalten-Grid: links „Was du heute tun musst" + aktive Projekte + Aufmerksamkeitsliste; rechts Team-Auslastung + Slack-Feed + Wochenkalender. Brand-Akzent nur als Pille und Phase-Progress-Bar.
        </ScreenDesc>
        <ScreenDesc title="My Tasks">
          Persönliche Sicht. Tabs: All / Today / This Week / Overdue / Blocked / Waiting on Feedback. Filter-Chips für Priority. Group-By: Project / Priority / Flat. Inline Quick-Add Bar oben.
        </ScreenDesc>
        <ScreenDesc title="Projects">
          Klassische Tabelle. Eine Zeile pro Projekt: Name, Status, Phase (mit aktueller Nummer), Progress-Bar, Priority, Owner, Team, Deadline, Slack-Channel. Filter über Status-Chips + Suche.
        </ScreenDesc>
        <ScreenDesc title="Project Detail">
          Kopf: Status/Priority/Deadline + Titel + Beschreibung. Darunter <strong>Phase Tracker</strong> als roter Faden. Tabs: Tasks / Activity / Comments / Files. Rechte Sidebar: Owner, Team, Deadline, <strong>Slack Panel</strong> mit Live-Preview, Quick Links.
        </ScreenDesc>
        <ScreenDesc title="Kanban Board">
          5 Spalten (Backlog · To Do · In Progress · Review · Done). Blocked wird in In Progress mit rotem Border markiert, nicht als eigene Spalte. Filter über Projekt-Dropdown + Priority-Chips.
        </ScreenDesc>
        <ScreenDesc title="Calendar">
          Monatsansicht mit farbigen Pillen pro Termin (Recording blau, Deadline rot, Review gelb, Publish grün). Heute = Brand-soft Hintergrund. Liste „Demnächst" unter dem Grid.
        </ScreenDesc>
        <ScreenDesc title="Templates">
          Pro Brand ein Episode-Template. Tasks gruppiert nach Phase, mit Default-Owner und „Tag +N" Offset. Rechts: Default-Konfiguration + Auto-Aktionen (Slack-Channel anlegen, Kalender-Termin, etc.) + großer „Run Template"-CTA.
        </ScreenDesc>
        <ScreenDesc title="Team View">
          Grid aus Personen-Karten. Pro Person: Avatar mit Online-Punkt, Rolle, 3 Stats (Offen / In Progress / Überfällig), Workload-Bar (gelb bei &gt;60%, rot bei &gt;80%), aktuelle Top-2-Tasks.
        </ScreenDesc>
        <ScreenDesc title="Settings">
          Linke Sub-Nav: Workspace · Team & Roles · Slack Integration · Notifications · Brand Colors. Slack-Bereich ist die größte Sektion: Workspace-Verbindung, Channel-Mapping pro Projekt, Event-Toggles, Live-Notification-Preview.
        </ScreenDesc>
      </Section>

      <Section n="05" title="Designsystem">
        <div className="grid grid-2 gap-4 mt-3">
          <DSCard title="Farben">
            <DSRow label="Background" value="#fafaf8 (warmes Off-White)" sw="#fafaf8" />
            <DSRow label="Card / Elevated" value="#ffffff" sw="#ffffff" border />
            <DSRow label="Border" value="#e7e5e0" sw="#e7e5e0" />
            <DSRow label="Text Primary" value="#1a1d24" sw="#1a1d24" />
            <DSRow label="Text Secondary" value="#5a5d66" sw="#5a5d66" />
            <DSRow label="Text Tertiary" value="#8a8d96" sw="#8a8d96" />
            <DSRow label="UnicornBakery" value="#1a3d5c (Deep Navy)" sw="#1a3d5c" />
            <DSRow label="SelbstFrei" value="#7a3dc4 (Indigo Violet)" sw="#7a3dc4" />
            <DSRow label="Status: Success" value="oklch muted green" sw="oklch(0.62 0.11 145)" />
            <DSRow label="Status: Warning" value="oklch muted amber" sw="oklch(0.68 0.12 70)" />
            <DSRow label="Status: Danger" value="oklch muted red" sw="oklch(0.56 0.15 25)" />
            <DSRow label="Status: Info" value="oklch muted blue" sw="oklch(0.58 0.10 240)" />
          </DSCard>
          <DSCard title="Typografie">
            <p style={{ fontFamily: 'Hanken Grotesk', fontWeight: 600, fontSize: 28, letterSpacing: '-0.02em', margin: '8px 0 4px' }}>Hanken Grotesk 600 / 28px</p>
            <p style={{ color: 'var(--text-3)', fontSize: 12, margin: '0 0 16px' }}>Headings · Page Title (H1)</p>
            <p style={{ fontFamily: 'Hanken Grotesk', fontWeight: 600, fontSize: 18, letterSpacing: '-0.01em', margin: '8px 0 4px' }}>Hanken Grotesk 600 / 18px</p>
            <p style={{ color: 'var(--text-3)', fontSize: 12, margin: '0 0 16px' }}>Section · Card Title (H2)</p>
            <p style={{ fontFamily: 'Hanken Grotesk', fontWeight: 400, fontSize: 14, margin: '8px 0 4px' }}>Hanken Grotesk 400 / 14px — Body</p>
            <p style={{ color: 'var(--text-3)', fontSize: 12, margin: '0 0 16px' }}>Standardtext, Tabellen, Cards</p>
            <p className="label" style={{ margin: '8px 0 4px' }}>LABEL · 11PX / 600 / UPPER</p>
            <p className="mono" style={{ fontSize: 14, margin: '8px 0 4px' }}>JetBrains Mono · 1,234 · #ub-ep142</p>
            <p style={{ color: 'var(--text-3)', fontSize: 12, margin: 0 }}>Für Zahlen, IDs, Channel-Namen</p>
          </DSCard>
        </div>

        <div className="grid grid-2 gap-4 mt-4">
          <DSCard title="Cards">
            <div className="card card-pad" style={{ background: 'var(--bg-elev)' }}>
              <div className="h3">Card Title</div>
              <p className="meta mt-1">Border 1px · Radius 12px · Shadow xs</p>
              <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '8px 0 0' }}>Inhalt mit ausreichend Padding (20px). Karten haben nie Inner-Shadows. Hover: kein Lift, kleiner Border-Shift.</p>
            </div>
          </DSCard>
          <DSCard title="Buttons">
            <div className="row gap-2 wrap">
              <button className="btn btn-primary">Primary</button>
              <button className="btn btn-brand">Brand</button>
              <button className="btn btn-ghost">Ghost</button>
              <button className="btn btn-quiet">Quiet</button>
            </div>
            <div className="meta mt-3">Höhe 32px · Radius 6px · Font 13/500. Primary = Schwarz. Brand = nur für brand-spezifische Actions.</div>
          </DSCard>
        </div>

        <div className="grid grid-2 gap-4 mt-4">
          <DSCard title="Badges">
            <div className="row gap-2 wrap">
              <StatusBadge status="Backlog" />
              <StatusBadge status="To Do" />
              <StatusBadge status="In Progress" />
              <StatusBadge status="Review" />
              <StatusBadge status="Blocked" />
              <StatusBadge status="Done" />
            </div>
            <div className="row gap-2 wrap mt-2">
              <PriorityBadge priority="High" />
              <PriorityBadge priority="Medium" />
              <PriorityBadge priority="Low" />
            </div>
            <div className="meta mt-3">Höhe 22px · Soft-Fill + matched Border + farbiger Text. Niemals Vollfarbe.</div>
          </DSCard>
          <DSCard title="Sidebar & Topbar">
            <div className="meta" style={{ lineHeight: 1.7 }}>
              <strong>Sidebar (248px):</strong> Workspace-Pille oben, Quick-Add direkt darunter, Nav-Sektionen Main / Workspace / Pinned Projects, User-Footer unten.<br/>
              <strong>Topbar (56px):</strong> Breadcrumb links, Search-Trigger mittig (⌘K), Bell + Primary-CTA rechts. Sticky mit Backdrop-Blur.
            </div>
          </DSCard>
        </div>

        <div className="grid grid-2 gap-4 mt-4">
          <DSCard title="Tabellen">
            <div className="meta">Spaltenkopf 11.5px uppercase 600 tertiary. Zeilenhöhe ~44px. Border-soft zwischen Zeilen. Hover: bg-subtle. Erste Spalte fett. Statuspille, Avatar, Due-Pille rechtsbündig.</div>
          </DSCard>
          <DSCard title="Modals & Empty States">
            <div className="meta">Modal: max 560px breit, Header/Body/Footer-Struktur, Pop-Shadow, Backdrop-Blur. Empty State: 40px Icon-Tile + Title + Body + ein CTA. Niemals leerer Bildschirm ohne Hilfetext.</div>
          </DSCard>
        </div>
      </Section>

      <Section n="06" title="Brand-Trennung — UnicornBakery vs. SelbstFrei">
        <p>Die beiden Brands teilen sich <strong>100% der UI-Grammatik</strong>: gleicher Background, gleiche Cards, gleiche Tabellen, gleiche Buttons, gleiche Typo. Was sich unterscheidet sind drei minimale Signale:</p>
        <ol className="list">
          <li><strong>Akzentfarbe (`--brand`).</strong> UB = Deep Navy `#1a3d5c`, SF = Indigo Violet `#7a3dc4`. Wird nur auf Brand-Pille, aktivem Tab-Underline, Phase-Tracker, Progress-Bar und Brand-Badges genutzt.</li>
          <li><strong>Brand-Marker (UB / SF).</strong> Quadrat 28px in Akzentfarbe mit weißen Initialen — sitzt in der Sidebar-Pille und als Dot auf Brand-Badges.</li>
          <li><strong>Workspace-Kontext.</strong> Jeder Screen trägt oben eine Brand-Badge (kleiner Dot in Akzentfarbe + Name). Daten sind hart getrennt: Wechselt der Workspace, leeren sich alle Listen vollständig — keine geteilten Tasks, keine geteilten Projekte.</li>
        </ol>
        <p>Was bewusst <strong>nicht</strong> brand-spezifisch ist: Statusfarben (rot/gelb/grün sind universal), Sidebar-Background (immer warm Off-White), Buttons (primary bleibt schwarz). Sonst würde das System inkonsistent wirken.</p>
      </Section>

      <Section n="07" title="MVP — Priorisierte Screen-Liste">
        <ol className="list">
          <li><strong>Workspace Switcher</strong> — ohne das geht kein Login</li>
          <li><strong>Dashboard Overview</strong> — das tägliche Ankunfts-Erlebnis</li>
          <li><strong>My Tasks</strong> — wichtigster Arbeitsbildschirm</li>
          <li><strong>Projects (Liste)</strong> + <strong>Project Detail</strong></li>
          <li><strong>Kanban Board</strong> — visueller Backbone</li>
          <li><strong>Settings → Slack Integration</strong> + <strong>Team & Roles</strong></li>
          <li><strong>Cmd+K</strong> Command Palette — auch im MVP, weil Top-Power-User es täglich nutzen</li>
        </ol>
      </Section>

      <Section n="08" title="Nicht im MVP">
        <ul className="list">
          <li>Calendar — als V2. Bis dahin reicht Deadline in Projects/Tasks.</li>
          <li>Templates — V2. MVP: Tasks manuell anlegen.</li>
          <li>Team View — V2.</li>
          <li>Activity Feed — wird durch Notifications + Comments anfangs abgedeckt.</li>
          <li>Custom Roles &amp; Permissions — MVP nur 3 Rollen: Owner, Member, Viewer.</li>
          <li>Analytics / Reports — V3.</li>
          <li>Mobile-App. Mobile-Webview reicht für MVP.</li>
          <li>Automationen (Zapier-style) — V3.</li>
        </ul>
      </Section>

      <Section n="09" title="UI Copy — Buttons, Status, Labels, Empty States">
        <div className="grid grid-2 gap-4">
          <DSCard title="Buttons">
            <CopyRow k="Primary CTA Dashboard" v="New Task" />
            <CopyRow k="Quick Add Inline" v="Quick add — Task-Titel eingeben…" />
            <CopyRow k="Project Detail Primary" v="Open in Slack" />
            <CopyRow k="Templates" v="Run Template" />
            <CopyRow k="Empty: erste Task" v="Erste Task anlegen" />
            <CopyRow k="Filter Reset" v="Filter zurücksetzen" />
          </DSCard>
          <DSCard title="Status">
            <CopyRow k="Backlog" v="Backlog" />
            <CopyRow k="To Do" v="To Do" />
            <CopyRow k="In Progress" v="In Progress" />
            <CopyRow k="Review" v="Review (wartet auf Feedback)" />
            <CopyRow k="Blocked" v="Blocked" />
            <CopyRow k="Done" v="Done" />
          </DSCard>
          <DSCard title="Labels (UI English / Inhalt DE)">
            <CopyRow k="My Tasks" v="My Tasks" />
            <CopyRow k="Heute fällig" v="Today" />
            <CopyRow k="Diese Woche" v="This Week" />
            <CopyRow k="Überfällig" v="Overdue" />
            <CopyRow k="Workload" v="Workload" />
            <CopyRow k="Brand-Akzent" v="Akzentfarbe" />
          </DSCard>
          <DSCard title="Empty States">
            <CopyRow k="Inbox leer" v="Inbox leer. Keine Tasks für dich heute. Genieß den Kaffee." />
            <CopyRow k="Kein Slack" v="Kein Slack-Channel verknüpft. Aufgaben werden nicht automatisch in Slack gespiegelt." />
            <CopyRow k="Keine Treffer" v="Keine Treffer in {Workspace}." />
            <CopyRow k="Nichts zu tun" v="Nichts zu tun. Wechsle den Tab oder lade die nächste Welle ein." />
          </DSCard>
        </div>
      </Section>

      <Section n="10" title="Finale Zusammenfassung — wie das Dashboard wirken soll">
        <p style={{ fontSize: 15, lineHeight: 1.6 }}>
          Command Center soll sich anfühlen wie der Maschinenraum einer modernen Media Company: <strong>still, präzise, gut beleuchtet.</strong> Kein Bunt, kein Glitter, kein Startup-Lärm. Wenn man morgens das Dashboard öffnet, soll man innerhalb von Sekunden das tun, was als Nächstes wichtig ist — und alles andere ausblenden können.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.6 }}>
          UnicornBakery und SelbstFrei sind <strong>zwei Wohnungen in einem Haus</strong>: Architektur ist gleich, Möblierung leicht unterschiedlich. Niemand verwechselt sie, niemand muss raten, in welcher er gerade ist.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.6 }}>
          Das Tool ist erfolgreich, wenn nach 4 Wochen Nutzung <strong>weniger als 10% der operativen Kommunikation</strong> noch über WhatsApp läuft — und niemand mehr fragen muss „wer macht eigentlich gerade die Pausder-Cuts?".
        </p>
        <div className="card card-pad mt-4" style={{ background: 'var(--bg)', borderColor: 'var(--brand)' }}>
          <div className="row gap-2"><I.zap size={14} color="var(--brand)" /><span style={{ fontWeight: 600 }}>Erfolg ist Schweigen.</span></div>
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: '8px 0 0', lineHeight: 1.55 }}>
            Ein gutes internes Tool fällt nicht auf. Es macht keine Show. Es liefert Klarheit — und dann verschwindet es. Daran messen wir das Design.
          </p>
        </div>
      </Section>

      <div className="row gap-2 mt-8" style={{ borderTop: '1px solid var(--border)', paddingTop: 24 }}>
        <button className="btn btn-brand" onClick={() => setRoute('dashboard')}>Prototyp ansehen <I.arrowRight size={13} /></button>
        <button className="btn btn-ghost" onClick={() => setRoute('mytasks')}>My Tasks öffnen</button>
        <span style={{ marginLeft: 'auto', color: 'var(--text-4)', fontSize: 12 }}>Command Center · Concept Doc v0.1</span>
      </div>
    </div>
  );
}

const Section = ({ n, title, children }) => (
  <section style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
    <div className="row gap-3 mb-3 items-end">
      <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>{n}</span>
      <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em', margin: 0 }}>{title}</h2>
    </div>
    <div style={{ fontSize: 14.5, color: 'var(--text-2)', lineHeight: 1.65 }}>{children}</div>
  </section>
);

const ScreenDesc = ({ title, children }) => (
  <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border-soft)' }}>
    <div style={{ fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: 13.5 }}>{children}</div>
  </div>
);

const DSCard = ({ title, children }) => (
  <div className="card card-pad">
    <div className="label mb-3">{title}</div>
    {children}
  </div>
);

const DSRow = ({ label, value, sw, border }) => (
  <div className="row gap-3" style={{ padding: '6px 0', fontSize: 12.5 }}>
    <div style={{ width: 22, height: 22, borderRadius: 5, background: sw, border: border ? '1px solid var(--border)' : 'none' }} />
    <span style={{ flex: 1, fontWeight: 500 }}>{label}</span>
    <span className="mono" style={{ color: 'var(--text-3)' }}>{value}</span>
  </div>
);

const CopyRow = ({ k, v }) => (
  <div style={{ padding: '7px 0', borderBottom: '1px solid var(--border-soft)' }}>
    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>{k}</div>
    <div style={{ fontSize: 13, color: 'var(--text-1)' }}>{v}</div>
  </div>
);
