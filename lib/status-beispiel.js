/**
 * Beispielzahlen fuer die Status-Seite (gleicher Stand wie UB Connect).
 *
 * Alles hier ist erfunden — Firmen, Betraege, Personen-Zuordnung. Sobald es
 * eine echte Quelle gibt (Google-Tabelle, spaeter das CRM), wird nur diese
 * Datei durch einen Loader ersetzt; die Seite bleibt gleich.
 */



export const PRODUKTE = ["Stay with", "Doku", "Event", "Studio"];

export const MONATE = [
  { schluessel: "2026-04", kurz: "Apr", lang: "April 2026", umsatzPlan: 38000, umsatzIst: 41200, eventsProfitabel: 2, geliefert: 3, studio: 8, pipeline: 64000, pipelineDeals: 9, gewonnen: 6, produkte: { "Stay with": 12600, Doku: 17000, Event: 8200, Studio: 3400 } },
  { schluessel: "2026-05", kurz: "Mai", lang: "Mai 2026", umsatzPlan: 40000, umsatzIst: 36800, eventsProfitabel: 1, geliefert: 2, studio: 10, pipeline: 71500, pipelineDeals: 11, gewonnen: 4, produkte: { "Stay with": 8400, Doku: 17000, Event: 7200, Studio: 4200 } },
  { schluessel: "2026-06", kurz: "Jun", lang: "Juni 2026", umsatzPlan: 42000, umsatzIst: 47500, eventsProfitabel: 3, geliefert: 4, studio: 9, pipeline: 78000, pipelineDeals: 10, gewonnen: 7, produkte: { "Stay with": 16800, Doku: 18500, Event: 8400, Studio: 3800 } },
  { schluessel: "2026-07", kurz: "Jul", lang: "Juli 2026", umsatzPlan: 42000, umsatzIst: 39100, eventsProfitabel: 2, geliefert: 3, studio: 6, pipeline: 69000, pipelineDeals: 10, gewonnen: 5, produkte: { "Stay with": 12600, Doku: 17000, Event: 7000, Studio: 2500 } },
  { schluessel: "2026-08", kurz: "Aug", lang: "August 2026", umsatzPlan: 38000, umsatzIst: 31400, eventsProfitabel: 1, geliefert: 2, studio: 9, pipeline: 74500, pipelineDeals: 11, gewonnen: 3, produkte: { "Stay with": 8400, Doku: 13200, Event: 6000, Studio: 3800 } },
  { schluessel: "2026-09", kurz: "Sep", lang: "September 2026", laeuft: true, umsatzPlan: 45000, umsatzIst: 33900, eventsProfitabel: 2, geliefert: 3, studio: 7, pipeline: 86500, pipelineDeals: 12, gewonnen: 5, produkte: { "Stay with": 12600, Doku: 9200, Event: 9200, Studio: 2900 } },
];


export const PERSONEN = { daniel: "Daniel", fabian: "Fabian", malik: "Malik" };


export const STUFEN = ["Lead", "Angebot raus", "Gebucht", "In Produktion", "Geliefert"];


export const PROJEKTE = [
  { kunde: "Nordlicht Energy", produkt: "Doku", person: "daniel", stufe: "In Produktion", wert: 8500, naechster: "Schnitt Rohfassung", faellig: "02.10." },
  { kunde: "Kaffeekraft", produkt: "Stay with", person: "daniel", stufe: "Gebucht", wert: 4200, naechster: "Drehtag", faellig: "08.10." },
  { kunde: "Lumo Health", produkt: "Paket", person: "fabian", stufe: "Angebot raus", wert: 24000, naechster: "Call mit CEO", faellig: "30.09." },
  { kunde: "Founders Dinner Q4", produkt: "Event", person: "daniel", stufe: "Gebucht", wert: 6800, naechster: "Sponsoren bestätigen", faellig: "05.10." },
  { kunde: "Brightwork", produkt: "Stay with", person: "daniel", stufe: "Lead", wert: 4200, naechster: "Erstgespräch", faellig: "29.09." },
  { kunde: "Podcast Pionier", produkt: "Studio", person: "malik", stufe: "Gebucht", wert: 780, naechster: "Aufnahme", faellig: "01.10." },
  { kunde: "Stadtgrün", produkt: "Doku", person: "fabian", stufe: "Geliefert", wert: 9200, naechster: "Rechnung schreiben", faellig: "28.09." },
  { kunde: "Tessera AI", produkt: "Event", person: "fabian", stufe: "Angebot raus", wert: 12000, naechster: "Nachfassen", faellig: "01.10." },
  { kunde: "Wellenreiter", produkt: "Studio", person: "malik", stufe: "Lead", wert: 1500, naechster: "Termin vorschlagen", faellig: "27.09." },
];

