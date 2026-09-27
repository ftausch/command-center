/**
 * Sales-Pipeline — Entwurf.
 *
 * DEALS sind erfunden (Beispiel). RADAR ist echt: die Top-Runden aus dem
 * Finanzierungs-Radar KW 39 (20.–26.09.2026), Quelle deutsche-startups.de /
 * StartupValley. Sobald es eine Tabelle `deals` in Supabase gibt, ersetzt ein
 * Loader diese Datei; der Screen bleibt gleich.
 */

// Ab diesem Wert uebernimmt Fabian (Expand), darunter Daniel (Land).
export const GRENZE_EXPAND = 10000;

export const STUFEN = [
  { id: 'neu',        label: 'Neu',          wahrscheinlich: 0.1 },
  { id: 'gespraech',  label: 'Im Gespräch',  wahrscheinlich: 0.3 },
  { id: 'angebot',    label: 'Angebot raus', wahrscheinlich: 0.5 },
  { id: 'verhandlung',label: 'Verhandlung',  wahrscheinlich: 0.7 },
  { id: 'gewonnen',   label: 'Gewonnen',     wahrscheinlich: 1 },
];

export const PRODUKTE = ['Stay with', 'Doku', 'Event', 'Studio', 'Paket'];

export const QUELLEN = {
  radar: 'Radar',
  studio: 'Studioseite',
  podcast: 'Podcast-Gast',
  referral: 'Referral',
  event: 'Event',
};

export const DEALS = [
  { id: 'd1', firma: 'Kaffeekraft', produkt: 'Stay with', wert: 4200, stufe: 'gewonnen', quelle: 'podcast', aufgebaut: 'daniel', naechster: 'Drehtag 08.10.' },
  { id: 'd2', firma: 'Nordlicht Energy', produkt: 'Doku', wert: 8500, stufe: 'gewonnen', quelle: 'referral', aufgebaut: 'daniel', naechster: 'Schnitt Rohfassung' },
  { id: 'd3', firma: 'Lumo Health', produkt: 'Paket', wert: 24000, stufe: 'verhandlung', quelle: 'event', aufgebaut: 'daniel', naechster: 'Call mit CEO 30.09.' },
  { id: 'd4', firma: 'Tessera AI', produkt: 'Event', wert: 12000, stufe: 'angebot', quelle: 'podcast', aufgebaut: 'fabian', naechster: 'Nachfassen 01.10.' },
  { id: 'd5', firma: 'Brightwork', produkt: 'Stay with', wert: 4200, stufe: 'gespraech', quelle: 'referral', aufgebaut: 'daniel', naechster: 'Erstgespräch 29.09.' },
  { id: 'd6', firma: 'Wellenreiter', produkt: 'Studio', wert: 1500, stufe: 'neu', quelle: 'studio', aufgebaut: 'malik', naechster: 'Termin vorschlagen' },
  { id: 'd7', firma: 'Stadtgrün', produkt: 'Doku', wert: 9200, stufe: 'angebot', quelle: 'event', aufgebaut: 'daniel', naechster: 'Angebot erklären' },
  { id: 'd8', firma: 'Founders Dinner Q4', produkt: 'Event', wert: 6800, stufe: 'verhandlung', quelle: 'event', aufgebaut: 'daniel', naechster: 'Sponsoren bestätigen' },
];

export const RADAR = {
  woche: 'KW 39 · 20.–26.09.',
  runden: [
    { firma: 'Mika', stadt: 'Berlin', betrag: '6 Mio. €', runde: 'Seed', format: 'Podcast + Event-Sponsoring', warum: 'Ihre Kunden sind Gründer — unser Publikum' },
    { firma: 'Noxtua', stadt: 'Berlin', betrag: '100 Mio. €', runde: 'Series C', format: 'Doku / Event-Partner', warum: 'Große Geschichte, großes Budget' },
    { firma: 'F13', stadt: 'Berlin', betrag: '5 Mio. $', runde: 'Pre-Seed', format: 'Stay with', warum: 'Wiederholungsgründer vor dem ersten Launch' },
    { firma: 'Arcos', stadt: 'München', betrag: '5,5 Mio. €', runde: '', format: 'Doku', warum: 'Baut das Team aus — Sichtbarkeit hilft beim Recruiting' },
    { firma: 'Bee People', stadt: 'St. Moritz', betrag: '1,3 Mio. CHF', runde: '', format: 'Stay with', warum: 'Consumer-Marke, erfahrene Gründer' },
  ],
};

export const PERSONEN = { daniel: 'Daniel', fabian: 'Fabian', malik: 'Malik' };
