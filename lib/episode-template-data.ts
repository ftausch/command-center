// Client-safe episode template data (no 'use server').
// Imported by both NewProjectModal (client) and lib/actions/templates.ts (server).

export const EPISODE_TEMPLATE_PREVIEW: {
  title: string;
  phase: string;
  specialty: string;
}[] = [
  { title: 'Gast bestätigen & Briefing senden',     phase: 'Booking',    specialty: 'manager'   },
  { title: 'Aufnahme durchführen',                   phase: 'Aufnahme',   specialty: 'host'      },
  { title: 'Transkript erstellen',                   phase: 'Produktion', specialty: 'editor'    },
  { title: 'Audio schneiden & produzieren',          phase: 'Produktion', specialty: 'editor'    },
  { title: 'Thumbnail designen',                     phase: 'Publishing', specialty: 'thumbnail' },
  { title: 'Show Notes schreiben',                   phase: 'Publishing', specialty: 'shownotes' },
  { title: 'Social Media Posts erstellen',           phase: 'Publishing', specialty: 'social'    },
  { title: 'Episode veröffentlichen & distribuieren',phase: 'Publishing', specialty: 'manager'   },
];
