// Event template definitions — client-safe (no 'use server').
// Imported by NewEventModal (client) and applyEventTemplate (server action).

export type EventTemplateId =
  | 'networking'
  | 'founder_dinner'
  | 'pickleball'
  | 'sponsorship'
  | 'workshop'
  | 'live_podcast'
  | 'partner_event';

export interface EventTemplateTask {
  title: string;
  phase: string;
  daysBeforeDue: number;
  priority: 'High' | 'Medium' | 'Low';
}

export const EVENT_TEMPLATES: Record<EventTemplateId, { name: string; desc: string; tasks: EventTemplateTask[] }> = {
  networking: {
    name: 'Networking Event',
    desc: 'Klassisches Networking-Format: Location, Kommunikation, Ablauf.',
    tasks: [
      { title: 'Konzept & Zielgruppe definieren',        phase: 'Konzept',           daysBeforeDue: 42, priority: 'High'   },
      { title: 'Location scouten & buchen',              phase: 'Location',          daysBeforeDue: 35, priority: 'High'   },
      { title: 'Partner / Sponsor ansprechen',           phase: 'Partner/Sponsor',   daysBeforeDue: 28, priority: 'Medium' },
      { title: 'Landingpage erstellen',                  phase: 'Landingpage',       daysBeforeDue: 21, priority: 'High'   },
      { title: 'Email-Kampagne & Social Posts',          phase: 'Kommunikation',     daysBeforeDue: 14, priority: 'Medium' },
      { title: 'Anmeldungen verwalten & bestätigen',     phase: 'Teilnehmer',        daysBeforeDue: 7,  priority: 'Medium' },
      { title: 'Ablaufplan & Briefing erstellen',        phase: 'Ablaufplan',        daysBeforeDue: 5,  priority: 'High'   },
      { title: 'Aufbau & Produktion vor Ort',            phase: 'Produktion vor Ort',daysBeforeDue: 0,  priority: 'High'   },
      { title: 'Nachbericht & Fotos zusammenstellen',    phase: 'Nachbereitung',     daysBeforeDue: -3, priority: 'Medium' },
      { title: 'Content Recap veröffentlichen',          phase: 'Content Recap',     daysBeforeDue: -7, priority: 'Medium' },
    ],
  },
  founder_dinner: {
    name: 'Founder Dinner',
    desc: 'Exklusives Dinner-Format für Gründer & Investoren.',
    tasks: [
      { title: 'Gästeliste & Kuratierung',               phase: 'Konzept',           daysBeforeDue: 28, priority: 'High'   },
      { title: 'Restaurant / Location buchen',           phase: 'Location',          daysBeforeDue: 21, priority: 'High'   },
      { title: 'Sponsor für Dinner gewinnen',            phase: 'Partner/Sponsor',   daysBeforeDue: 14, priority: 'Medium' },
      { title: 'Einladungen verschicken',                phase: 'Kommunikation',     daysBeforeDue: 14, priority: 'High'   },
      { title: 'Bestätigungen & Sitzplan',               phase: 'Teilnehmer',        daysBeforeDue: 5,  priority: 'High'   },
      { title: 'Ablauf & Moderationsnotizen',            phase: 'Ablaufplan',        daysBeforeDue: 2,  priority: 'Medium' },
      { title: 'Dinner durchführen',                     phase: 'Produktion vor Ort',daysBeforeDue: 0,  priority: 'High'   },
      { title: 'Danke-Nachricht & Follow-up',            phase: 'Nachbereitung',     daysBeforeDue: -2, priority: 'Medium' },
      { title: 'Sponsor Report',                         phase: 'Sponsor Report',    daysBeforeDue: -7, priority: 'Medium' },
    ],
  },
  pickleball: {
    name: 'Startup Pickleball',
    desc: 'Sportliches Networking-Event mit Pickleball-Format.',
    tasks: [
      { title: 'Konzept & Format festlegen',             phase: 'Konzept',           daysBeforeDue: 35, priority: 'High'   },
      { title: 'Pickleball-Court buchen',                phase: 'Location',          daysBeforeDue: 28, priority: 'High'   },
      { title: 'Sponsor für Equipment / Drinks',         phase: 'Partner/Sponsor',   daysBeforeDue: 21, priority: 'Medium' },
      { title: 'Landingpage mit Signup erstellen',       phase: 'Landingpage',       daysBeforeDue: 21, priority: 'High'   },
      { title: 'Social Media Ankündigung',               phase: 'Kommunikation',     daysBeforeDue: 14, priority: 'Medium' },
      { title: 'Teams & Spielplan erstellen',            phase: 'Teilnehmer',        daysBeforeDue: 7,  priority: 'High'   },
      { title: 'Ablaufplan & Regeln',                    phase: 'Ablaufplan',        daysBeforeDue: 3,  priority: 'Medium' },
      { title: 'Event-Produktion vor Ort',               phase: 'Produktion vor Ort',daysBeforeDue: 0,  priority: 'High'   },
      { title: 'Content & Fotos posten',                 phase: 'Content Recap',     daysBeforeDue: -2, priority: 'Medium' },
      { title: 'Sponsor-Bericht & Feedback',             phase: 'Sponsor Report',    daysBeforeDue: -5, priority: 'Low'    },
    ],
  },
  sponsorship: {
    name: 'Sponsorship Event',
    desc: 'Event mit Hauptsponsor — inklusive Sponsor-Deliverables und Reporting.',
    tasks: [
      { title: 'Sponsoring-Konzept & Pakete erstellen',  phase: 'Konzept',           daysBeforeDue: 56, priority: 'High'   },
      { title: 'Sponsor akquirieren & Vertrag',          phase: 'Partner/Sponsor',   daysBeforeDue: 42, priority: 'High'   },
      { title: 'Location buchen',                        phase: 'Location',          daysBeforeDue: 35, priority: 'High'   },
      { title: 'Landingpage mit Sponsor-Branding',       phase: 'Landingpage',       daysBeforeDue: 28, priority: 'High'   },
      { title: 'PR & Kommunikations-Plan',               phase: 'Kommunikation',     daysBeforeDue: 21, priority: 'Medium' },
      { title: 'Anmeldungen & Gästeliste',               phase: 'Teilnehmer',        daysBeforeDue: 10, priority: 'Medium' },
      { title: 'Ablaufplan & Sponsor-Briefing',          phase: 'Ablaufplan',        daysBeforeDue: 5,  priority: 'High'   },
      { title: 'Event durchführen',                      phase: 'Produktion vor Ort',daysBeforeDue: 0,  priority: 'High'   },
      { title: 'Nachbereitung & Danke',                  phase: 'Nachbereitung',     daysBeforeDue: -3, priority: 'Medium' },
      { title: 'Content Recap veröffentlichen',          phase: 'Content Recap',     daysBeforeDue: -7, priority: 'Medium' },
      { title: 'Sponsor Report & KPI-Auswertung',        phase: 'Sponsor Report',    daysBeforeDue: -14, priority: 'High'  },
    ],
  },
  workshop: {
    name: 'Workshop',
    desc: 'Praxisorientierter Workshop mit Vorbereitung, Durchführung und Nachbereitung.',
    tasks: [
      { title: 'Thema & Zielgruppe definieren',           phase: 'Konzept',           daysBeforeDue: 28, priority: 'High'   },
      { title: 'Speaker / Trainer bestätigen',            phase: 'Konzept',           daysBeforeDue: 21, priority: 'High'   },
      { title: 'Location oder virtuellen Raum buchen',   phase: 'Location',          daysBeforeDue: 21, priority: 'High'   },
      { title: 'Sponsor ansprechen (optional)',           phase: 'Partner/Sponsor',   daysBeforeDue: 14, priority: 'Low'    },
      { title: 'Landingpage & Anmeldeformular',           phase: 'Landingpage',       daysBeforeDue: 14, priority: 'High'   },
      { title: 'Einladungen & Social Posts',              phase: 'Kommunikation',     daysBeforeDue: 10, priority: 'Medium' },
      { title: 'Teilnehmer bestätigen & Material senden',phase: 'Teilnehmer',        daysBeforeDue: 5,  priority: 'High'   },
      { title: 'Ablaufplan & Slides fertigstellen',       phase: 'Ablaufplan',        daysBeforeDue: 2,  priority: 'High'   },
      { title: 'Workshop durchführen',                   phase: 'Produktion vor Ort',daysBeforeDue: 0,  priority: 'High'   },
      { title: 'Feedback-Formular auswerten',            phase: 'Nachbereitung',     daysBeforeDue: -3, priority: 'Medium' },
      { title: 'Workshop-Recap & Learnings teilen',      phase: 'Content Recap',     daysBeforeDue: -7, priority: 'Medium' },
    ],
  },
  live_podcast: {
    name: 'Live Podcast Recording',
    desc: 'Live-Aufnahme vor Publikum — Gäste, Technik, Community-Event.',
    tasks: [
      { title: 'Thema & Gast bestätigen',                 phase: 'Konzept',           daysBeforeDue: 35, priority: 'High'   },
      { title: 'Recording-Location buchen',               phase: 'Location',          daysBeforeDue: 28, priority: 'High'   },
      { title: 'Technisches Setup planen (Mikro, Kamera)',phase: 'Produktion vor Ort',daysBeforeDue: 21, priority: 'High'   },
      { title: 'Sponsor / Partner für Live-Event',        phase: 'Partner/Sponsor',   daysBeforeDue: 21, priority: 'Medium' },
      { title: 'Luma-Event-Seite erstellen',              phase: 'Landingpage',       daysBeforeDue: 21, priority: 'High'   },
      { title: 'Community-Ankündigung (Newsletter + Social)',phase: 'Kommunikation',  daysBeforeDue: 14, priority: 'High'   },
      { title: 'Gäste-Liste & Reminder',                  phase: 'Teilnehmer',        daysBeforeDue: 7,  priority: 'Medium' },
      { title: 'Interview-Fragen & Ablaufplan finalisieren',phase: 'Ablaufplan',      daysBeforeDue: 3,  priority: 'High'   },
      { title: 'Soundcheck & Probe vor Ort',              phase: 'Produktion vor Ort',daysBeforeDue: 0,  priority: 'High'   },
      { title: 'Live-Recording durchführen',              phase: 'Produktion vor Ort',daysBeforeDue: 0,  priority: 'High'   },
      { title: 'Rohmaterial sichern & schneiden',         phase: 'Nachbereitung',     daysBeforeDue: -3, priority: 'High'   },
      { title: 'Episode veröffentlichen (Spotify, Apple)',phase: 'Content Recap',     daysBeforeDue: -7, priority: 'High'   },
      { title: 'Clip-Highlights für Social Media',        phase: 'Content Recap',     daysBeforeDue: -10,priority: 'Medium' },
      { title: 'Sponsor-Report & Danke',                  phase: 'Sponsor Report',    daysBeforeDue: -14,priority: 'Medium' },
    ],
  },
  partner_event: {
    name: 'Partner Event',
    desc: 'Co-branded Event mit externem Partner — gemeinsame Kommunikation und Deliverables.',
    tasks: [
      { title: 'Partner-Konzept & Co-Branding abstimmen', phase: 'Konzept',           daysBeforeDue: 42, priority: 'High'   },
      { title: 'Kooperationsvertrag & Deliverables',      phase: 'Partner/Sponsor',   daysBeforeDue: 35, priority: 'High'   },
      { title: 'Location gemeinsam auswählen & buchen',   phase: 'Location',          daysBeforeDue: 28, priority: 'High'   },
      { title: 'Partner-Logo & Assets einsammeln',        phase: 'Partner/Sponsor',   daysBeforeDue: 21, priority: 'High'   },
      { title: 'Co-branded Landingpage erstellen',        phase: 'Landingpage',       daysBeforeDue: 21, priority: 'High'   },
      { title: 'Gemeinsame Kommunikation planen',         phase: 'Kommunikation',     daysBeforeDue: 14, priority: 'High'   },
      { title: 'Cross-Promotion bei Partner-Audience',    phase: 'Kommunikation',     daysBeforeDue: 14, priority: 'Medium' },
      { title: 'Gästeliste & RSVP-Management',            phase: 'Teilnehmer',        daysBeforeDue: 10, priority: 'Medium' },
      { title: 'Briefing für Partner-Team',               phase: 'Ablaufplan',        daysBeforeDue: 5,  priority: 'High'   },
      { title: 'Ablaufplan finalisieren',                 phase: 'Ablaufplan',        daysBeforeDue: 3,  priority: 'High'   },
      { title: 'Event durchführen',                       phase: 'Produktion vor Ort',daysBeforeDue: 0,  priority: 'High'   },
      { title: 'Content gemeinsam mit Partner erstellen', phase: 'Content Recap',     daysBeforeDue: -5, priority: 'Medium' },
      { title: 'LinkedIn Recap & Mentions',               phase: 'Content Recap',     daysBeforeDue: -7, priority: 'Medium' },
      { title: 'Partner-Report: Reichweite, Fotos, Daten',phase: 'Sponsor Report',   daysBeforeDue: -14,priority: 'High'   },
    ],
  },
};

export const EVENT_TEMPLATE_LIST = Object.entries(EVENT_TEMPLATES).map(([id, t]) => ({
  id: id as EventTemplateId,
  name: t.name,
  desc: t.desc,
  taskCount: t.tasks.length,
}));
