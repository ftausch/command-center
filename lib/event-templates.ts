// Event template definitions — client-safe (no 'use server').
// Imported by NewEventModal (client) and applyEventTemplate (server action).

export type EventTemplateId =
  | 'networking'
  | 'founder_dinner'
  | 'pickleball'
  | 'sponsorship';

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
};

export const EVENT_TEMPLATE_LIST = Object.entries(EVENT_TEMPLATES).map(([id, t]) => ({
  id: id as EventTemplateId,
  name: t.name,
  desc: t.desc,
  taskCount: t.tasks.length,
}));
