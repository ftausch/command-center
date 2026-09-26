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
import './dashboard.css';

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
      <div className="page-head" style={{ borderBottom: 0, paddingBottom: 8, marginBottom: 16 }}>
        <div>
          <div className="meta mb-2">Unter {euro(GRENZE_EXPAND)} Daniel · ab {euro(GRENZE_EXPAND)} Fabian · Umsatz zählt für den, der den Account aufgebaut hat</div>
          <h1 className="h1" style={{ margin: 0 }}>Sales</h1>
          <p className="db2-hinweis" style={{ margin: '8px 0 0' }}>Entwurf: Deals erfunden, Radar echt. Verschieben speichert noch nicht.</p>
        </div>
        <div className="db2-wahl" role="group" aria-label="Produkt filtern">
          <button type="button" onClick={() => setProdukt(null)} aria-pressed={!produkt}>Alle</button>
          {PRODUKTE.map((p) => (
            <button key={p} type="button" onClick={() => setProdukt(p)} aria-pressed={produkt === p}>{p}</button>
          ))}
        </div>
      </div>

      <div className="db2">
        <div className="db2-kpis">
          <div className="db2-karte"><div className="db2-kopf"><div className="db2-titel"><span>Offene Pipeline</span></div><span className="db2-rund"><I.kanban size={15} /></span></div><div className="db2-zahl">{euro(zahlen.summe)}</div><div className="db2-unter"><span>{offen.length} Deals offen</span></div></div>
          <div className="db2-karte"><div className="db2-kopf"><div className="db2-titel"><span>Gewichtet</span><i className="db2-hilfe" title="Wert × Wahrscheinlichkeit der Stufe">i</i></div><span className="db2-rund"><I.trend size={15} /></span></div><div className="db2-zahl">{euro(Math.round(zahlen.gewichtet))}</div><div className="db2-unter"><span>realistisch zu erwarten</span></div></div>
          <div className="db2-karte"><div className="db2-kopf"><div className="db2-titel"><span>Gewonnen</span></div><span className="db2-rund"><I.check size={15} /></span></div><div className="db2-zahl">{euro(zahlen.gewonnen)}</div><div className="db2-unter"><span>in dieser Ansicht</span></div></div>
          <div className="db2-karte"><div className="db2-kopf"><div className="db2-titel"><span>Bei Fabian</span><i className="db2-hilfe" title="Offene Deals ab 10.000 €">i</i></div><span className="db2-rund"><I.flag size={15} /></span></div><div className="db2-zahl">{zahlen.expand.length} <small className="db2-einheit">Deals</small></div><div className="db2-unter"><span>{euro(zahlen.expand.reduce((s, d) => s + d.wert, 0))} offen</span></div></div>
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

          <aside className="db2-karte sl-radar">
            <div className="db2-kopf"><div className="db2-titel"><I.trend size={15} /><span>Radar</span><i className="db2-hilfe" title="Frische Finanzierungsrunden aus DACH, jeden Sonntag auch per WhatsApp">i</i></div><span className="db2-pille">{RADAR.woche}</span></div>
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
