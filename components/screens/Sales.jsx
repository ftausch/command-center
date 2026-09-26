'use client';
// Sales — eine Pipeline fuer Events, Stay with, Doku, Studio und Pakete.
// Unter 10.000 € baut Daniel auf und schliesst ab (Land), ab 10.000 € geht
// der Deal an Fabian (Expand). Umsatz zaehlt fuer den, der den Account
// aufgebaut hat — deshalb steht "aufgebaut von" auf jeder Karte.
//
// ENTWURF: Deals aus lib/sales-beispiel.js (erfunden), Radar echt (KW 39).
// Aenderungen hier leben nur im Browser, bis es die Tabelle `deals` gibt.

import { useMemo, useState } from 'react';
import { I } from '@/components/icons';
import { DEALS, GRENZE_EXPAND, PERSONEN, PRODUKTE, QUELLEN, RADAR, STUFEN } from '@/lib/sales-beispiel';
import './status.css';

const euro = (n) => n.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €';
const k = (n) => (n >= 1000 ? (n / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) : String(n));

function zustaendig(deal) {
  return deal.wert >= GRENZE_EXPAND ? 'fabian' : 'daniel';
}

function DealKarte({ deal, onZurueck, onWeiter }) {
  const wer = zustaendig(deal);
  const i = STUFEN.findIndex((s) => s.id === deal.stufe);
  return (
    <div className="sl-karte">
      <div className="sl-karte-kopf">
        <b>{deal.firma}</b>
        <span className="sl-wert">{deal.wert ? euro(deal.wert) : 'Wert offen'}</span>
      </div>
      <div className="sl-karte-zeile">
        <span className="sl-chip">{deal.produkt}</span>
        <span className="sl-chip sl-chip-leise">{QUELLEN[deal.quelle]}</span>
      </div>
      {deal.naechster && <div className="sl-naechster">→ {deal.naechster}</div>}
      <div className="sl-karte-fuss">
        <span title="Wer den Account aufgebaut hat, bekommt den Umsatz">
          aufgebaut: <b>{PERSONEN[deal.aufgebaut]}</b>
        </span>
        {wer === 'fabian' && deal.aufgebaut !== 'fabian' && <span className="sl-uebergabe">an Fabian</span>}
      </div>
      <div className="sl-pfeile">
        <button type="button" onClick={onZurueck} disabled={i === 0} aria-label="Eine Stufe zurück">‹</button>
        <button type="button" onClick={onWeiter} disabled={i === STUFEN.length - 1} aria-label="Eine Stufe weiter">›</button>
      </div>
    </div>
  );
}

export function SalesScreen() {
  const [deals, setDeals] = useState(DEALS);
  const [produkt, setProdukt] = useState(null);
  const [uebernommen, setUebernommen] = useState([]);

  const sichtbar = deals.filter((d) => !produkt || d.produkt === produkt);
  const offen = sichtbar.filter((d) => d.stufe !== 'gewonnen');
  const zahlen = useMemo(() => {
    const summe = offen.reduce((s, d) => s + d.wert, 0);
    const gewichtet = offen.reduce((s, d) => s + d.wert * (STUFEN.find((x) => x.id === d.stufe)?.wahrscheinlich ?? 0), 0);
    const gewonnen = sichtbar.filter((d) => d.stufe === 'gewonnen').reduce((s, d) => s + d.wert, 0);
    const expand = offen.filter((d) => d.wert >= GRENZE_EXPAND);
    return { summe, gewichtet, gewonnen, expand };
  }, [offen, sichtbar]);

  const verschieben = (id, schritt) => setDeals((alt) => alt.map((d) => {
    if (d.id !== id) return d;
    const i = STUFEN.findIndex((s) => s.id === d.stufe);
    const j = Math.min(STUFEN.length - 1, Math.max(0, i + schritt));
    return { ...d, stufe: STUFEN[j].id };
  }));

  const uebernehmen = (r) => {
    setUebernommen((u) => [...u, r.firma]);
    setDeals((alt) => [{
      id: 'radar-' + r.firma, firma: r.firma, produkt: r.format.startsWith('Doku') ? 'Doku' : r.format.startsWith('Stay') ? 'Stay with' : 'Event',
      wert: 0, stufe: 'neu', quelle: 'radar', aufgebaut: 'daniel', naechster: 'Erste Nachricht schicken',
    }, ...alt]);
  };

  return (
    <div className="page fade-in">
      <div className="st-seite db-seite">
        <div className="st-leiste">
          <div>
            <h1 className="h1" style={{ margin: 0 }}>Sales</h1>
            <p className="meta" style={{ margin: '4px 0 0' }}>Unter {euro(GRENZE_EXPAND)} Daniel, ab {euro(GRENZE_EXPAND)} Fabian. Der Umsatz zählt für den, der den Account aufgebaut hat.</p>
          </div>
          <div className="st-wahl" aria-label="Produkt filtern">
            <button type="button" onClick={() => setProdukt(null)} aria-pressed={!produkt}>Alle</button>
            {PRODUKTE.map((p) => (
              <button key={p} type="button" onClick={() => setProdukt(p)} aria-pressed={produkt === p}>{p}</button>
            ))}
          </div>
        </div>
        <span className="st-entwurf" style={{ display: 'inline-block', marginBottom: 14 }}>Entwurf: Deals erfunden, Radar echt. Verschieben speichert noch nicht.</span>

        <div className="sl-kacheln">
          <div className="st-kachel"><span>Offene Pipeline</span><b>{k(zahlen.summe)}<em>{zahlen.summe >= 1000 ? 'k €' : ' €'}</em></b><div className="st-kachel-fuss">{offen.length} Deals offen</div></div>
          <div className="st-kachel"><span>Gewichtet</span><b>{k(Math.round(zahlen.gewichtet))}<em>k €</em></b><div className="st-kachel-fuss">nach Stufe gewichtet</div></div>
          <div className="st-kachel"><span>Gewonnen</span><b>{k(zahlen.gewonnen)}<em>k €</em></b><div className="st-kachel-fuss">in dieser Ansicht</div></div>
          <div className="st-kachel"><span>Bei Fabian (ab 10k)</span><b>{zahlen.expand.length}<em> Deals</em></b><div className="st-kachel-fuss">{euro(zahlen.expand.reduce((s, d) => s + d.wert, 0))} offen</div></div>
        </div>

        <div className="sl-raster">
          <div className="sl-board">
            {STUFEN.map((s) => {
              const spalte = sichtbar.filter((d) => d.stufe === s.id);
              const summe = spalte.reduce((x, d) => x + d.wert, 0);
              return (
                <section key={s.id} className={s.id === 'gewonnen' ? 'sl-spalte sl-spalte-gewonnen' : 'sl-spalte'}>
                  <div className="sl-spalte-kopf">
                    <b>{s.label}</b>
                    <span>{spalte.length} · {k(summe)}{summe >= 1000 ? 'k' : ''} €</span>
                  </div>
                  <div className="sl-spalte-inhalt">
                    {spalte.map((d) => (
                      <DealKarte key={d.id} deal={d} onZurueck={() => verschieben(d.id, -1)} onWeiter={() => verschieben(d.id, 1)} />
                    ))}
                    {spalte.length === 0 && <div className="sl-leer">—</div>}
                  </div>
                </section>
              );
            })}
          </div>

          <aside className="st-feed sl-radar">
            <h2>Radar <span>{RADAR.woche}</span></h2>
            <p className="sl-radar-unter">Frische Finanzierungsrunden, die zu uns passen. Kommt jeden Sonntag auch per WhatsApp.</p>
            <ul>
              {RADAR.runden.map((r) => {
                const drin = uebernommen.includes(r.firma);
                return (
                  <li key={r.firma} className="sl-radar-eintrag">
                    <div>
                      <b>{r.firma} <small>{r.stadt}</small></b>
                      <span>{r.betrag}{r.runde ? ` · ${r.runde}` : ''} → {r.format}</span>
                      <em>{r.warum}</em>
                    </div>
                    <button type="button" onClick={() => uebernehmen(r)} disabled={drin}>
                      {drin ? 'Lead ✓' : <><I.plus size={12} /> Lead</>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
