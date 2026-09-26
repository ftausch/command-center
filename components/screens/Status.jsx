'use client';
// Status — wie laeuft Unicorn Bakery: Plan gegen Ist, Monat fuer Monat, und
// was gerade in Arbeit ist. Nur fuer Owner/Admins (Routing in App.jsx).
//
// ENTWURF: Zahlen aus lib/status-beispiel.js, alles erfunden. Sobald es eine
// echte Quelle gibt (Google-Tabelle, spaeter CRM), wird nur die Datenquelle
// getauscht.

import { useMemo, useState } from 'react';
import { MONATE, PERSONEN, PRODUKTE, PROJEKTE, STUFEN } from '@/lib/status-beispiel';
import './status.css';

const zahl = (n, stellen = 0) => n.toLocaleString('de-DE', { maximumFractionDigits: stellen });
const euro = (n) => zahl(n) + ' €';

// Zahl in Haupt- und Nebenteil, z. B. 86,5 | k € — der Nebenteil wird blass gesetzt.
function geteilt(n) {
  if (n >= 1000) return [zahl(n / 1000, 1), 'k €'];
  return [zahl(n), ' €'];
}

function trend(jetzt, vorher) {
  if (!vorher) return null;
  const p = ((jetzt - vorher) / vorher) * 100;
  return { gut: p >= 0, text: `${p >= 0 ? '▲' : '▼'} ${zahl(Math.abs(p), 1)} %` };
}

function Trend({ t }) {
  if (!t) return null;
  return <span className={t.gut ? 'st-trend st-gut' : 'st-trend st-schlecht'}>{t.text}</span>;
}

// Tage bis zu einem Datum "TT.MM." (Beispieldaten: 2026).
function tageBis(faellig, heute) {
  const [t, m] = faellig.split('.').map(Number);
  return Math.round((new Date(2026, m - 1, t).getTime() - heute.getTime()) / 86400000);
}

function Bogen({ prozent, klasse }) {
  const d = 'M 20 150 A 130 130 0 0 1 280 150';
  return (
    <svg viewBox="0 0 300 160" className={klasse} aria-hidden>
      <path d={d} pathLength={100} className="st-bogen-hinten" />
      <path d={d} pathLength={100} className="st-bogen-vorne" strokeDasharray={`${Math.min(prozent, 100)} 100`} />
    </svg>
  );
}

function Verlauf({ aktiv, onWahl }) {
  const oben = Math.ceil(Math.max(...MONATE.flatMap((m) => [m.umsatzPlan, m.umsatzIst])) / 10000) * 10000;
  return (
    <div className="st-verlauf">
      {MONATE.map((m) => {
        const hinten = m.umsatzIst < m.umsatzPlan && !m.laeuft;
        const an = m.schluessel === aktiv;
        const quote = Math.round((m.umsatzIst / m.umsatzPlan) * 100);
        return (
          <button key={m.schluessel} type="button" onClick={() => onWahl(m.schluessel)}
            className={['st-saeule', an && 'st-an', m.laeuft && 'st-laeuft'].filter(Boolean).join(' ')}
            aria-label={`${m.lang}: ${euro(m.umsatzIst)} von ${euro(m.umsatzPlan)}`}>
            <div className="st-saeule-feld">
              <div className="st-plan" style={{ height: `${(m.umsatzPlan / oben) * 100}%` }} />
              <div className="st-ist" style={{ height: `${(m.umsatzIst / oben) * 100}%` }}>
                {an && <span className="st-marke">{geteilt(m.umsatzIst).join('')}</span>}
              </div>
              <div className="st-tipp">
                <b>{m.lang}{m.laeuft ? ' · läuft' : ''}</b>
                <span>Plan <em>{euro(m.umsatzPlan)}</em></span>
                <span>Ist <em>{euro(m.umsatzIst)}</em></span>
                <span className={quote >= 100 ? 'st-gut' : 'st-schlecht'}>{quote} % vom Plan</span>
              </div>
            </div>
            <span className="st-monat">
              {m.kurz}
              {hinten && <i className="st-unter-plan" title="unter Plan" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FeedEintrag({ p, heute }) {
  const tage = tageBis(p.faellig, heute);
  const wann = tage < 0 ? `${-tage} T. überfällig` : tage === 0 ? 'heute' : tage === 1 ? 'morgen' : `in ${tage} Tagen`;
  return (
    <li className="st-feed-eintrag">
      <span className="st-feed-zeichen">{PERSONEN[p.person][0]}</span>
      <div>
        <b>{p.naechster}</b>
        <span>{p.kunde} · {p.produkt}</span>
      </div>
      <span className={tage < 0 ? 'st-feed-wann st-feed-spaet' : 'st-feed-wann'}>{wann}</span>
    </li>
  );
}

export function StatusScreen() {
  const [wahl, setWahl] = useState(MONATE[MONATE.length - 1].schluessel);
  const [person, setPerson] = useState(null);
  const heute = useMemo(() => new Date(), []);

  const i = Math.max(0, MONATE.findIndex((x) => x.schluessel === wahl));
  const m = MONATE[i];
  const v = MONATE[i - 1];
  const quote = Math.round((m.umsatzIst / m.umsatzPlan) * 100);

  const projekte = PROJEKTE.filter((p) => !person || p.person === person)
    .sort((a, b) => STUFEN.indexOf(a.stufe) - STUFEN.indexOf(b.stufe));
  const feed = [...PROJEKTE].sort((a, b) => tageBis(a.faellig, heute) - tageBis(b.faellig, heute));

  const gesichert = PROJEKTE.filter((p) => ['Gebucht', 'In Produktion', 'Geliefert'].includes(p.stufe)).reduce((s, p) => s + p.wert, 0);
  const offen = PROJEKTE.filter((p) => ['Lead', 'Angebot raus'].includes(p.stufe)).reduce((s, p) => s + p.wert, 0);
  const anteilGesichert = Math.round((gesichert / (gesichert + offen)) * 100);
  const schnitt = m.gewonnen ? m.umsatzIst / m.gewonnen : 0;
  const hoechstMonat = Math.max(...MONATE.map((x) => x.umsatzIst));

  const [pipeHaupt, pipeNeben] = geteilt(m.pipeline);
  const [schnittHaupt, schnittNeben] = geteilt(schnitt);

  return (
    <div className="st-seite">
      <div className="st-leiste">
        <span className="st-entwurf">Entwurf mit Beispielzahlen: Firmen und Beträge sind erfunden</span>
        <div className="st-wahl" role="tablist" aria-label="Monat wählen">
          {MONATE.map((x) => (
            <button key={x.schluessel} type="button" onClick={() => setWahl(x.schluessel)} aria-pressed={x.schluessel === m.schluessel}>
              {x.kurz}
            </button>
          ))}
        </div>
      </div>

      <div className="st-raster">
        <section className="st-held">
          <h1 className="st-held-titel">Status<br /><span>{m.lang}</span></h1>
          <p className="st-held-unter">Wie läuft Unicorn Bakery? Plan gegen Ist, auf einen Blick.</p>
          <div className="st-held-drei">
            <div><small><i />Events</small><b>{m.eventsProfitabel}</b><Trend t={trend(m.eventsProfitabel, v?.eventsProfitabel)} /></div>
            <div><small><i />Geliefert</small><b>{m.geliefert}</b><Trend t={trend(m.geliefert, v?.geliefert)} /></div>
            <div><small><i />Studio</small><b>{m.studio}</b><Trend t={trend(m.studio, v?.studio)} /></div>
          </div>
          <div className="st-held-bogen">
            <Bogen prozent={quote} klasse="st-bogen st-bogen-held" />
            <div className="st-held-zahl">
              <small>{quote} % vom Ziel ({euro(m.umsatzPlan)})</small>
              <b>{euro(m.umsatzIst)}</b>
              <span>Umsatz {m.kurz}{m.laeuft ? ' · Monat läuft' : ''}</span>
            </div>
          </div>
        </section>

        <section className="st-feed">
          <h2>Als Nächstes <span>fällig</span></h2>
          <ul>
            {feed.map((p) => <FeedEintrag key={p.kunde} p={p} heute={heute} />)}
          </ul>
        </section>

        <div className="st-kacheln">
          <div className="st-kachel">
            <span>Umsatz gegenüber Vormonat</span>
            <b>{zahl(m.umsatzIst / 1000, 1)}<em>k €</em></b>
            <div className="st-kachel-fuss"><Trend t={trend(m.umsatzIst, v?.umsatzIst)} /> {v ? `vorher ${euro(v.umsatzIst)}` : ''}</div>
          </div>
          <div className="st-kachel">
            <span>Offene Pipeline</span>
            <b>{pipeHaupt}<em>{pipeNeben}</em></b>
            <div className="st-kachel-fuss">{m.pipelineDeals} Deals offen</div>
          </div>
          <div className="st-kachel">
            <span>Ø pro gewonnenem Deal</span>
            <b>{schnittHaupt}<em>{schnittNeben}</em></b>
            <div className="st-kachel-fuss">{m.gewonnen} Deals gewonnen</div>
          </div>
        </div>

        <section className="st-box st-verlauf-box">
          <div className="st-box-kopf">
            <h2>Umsatz: Plan und Ist</h2>
            <div className="st-legende">
              <span><i className="st-punkt st-punkt-plan" />Plan</span>
              <span><i className="st-punkt st-punkt-ist" />Ist</span>
              <span><i className="st-punkt st-punkt-hinten" />unter Plan</span>
            </div>
          </div>
          <div className="st-summe">
            <small>Summe April bis {m.kurz}</small>
            <b>{zahl(MONATE.slice(0, i + 1).reduce((s, x) => s + x.umsatzIst, 0) / 1000, 1)}<em>k €</em></b>
          </div>
          <Verlauf aktiv={m.schluessel} onWahl={setWahl} />
        </section>

        <section className="st-box st-produkte">
          <div className="st-box-kopf"><h2>Umsatz nach Produkt</h2></div>
          <div className="st-produkt-zahlen">
            {PRODUKTE.map((p, n) => {
              const [h, s] = geteilt(m.produkte[p]);
              return (
                <div key={p}>
                  <small><i className={`st-punkt st-produkt-${n}`} />{p}</small>
                  <b>{h}<em>{s}</em></b>
                </div>
              );
            })}
          </div>
          <div className="st-produkt-verlauf">
            {MONATE.map((x) => (
              <button key={x.schluessel} type="button" onClick={() => setWahl(x.schluessel)} className={x.schluessel === m.schluessel ? 'st-an' : undefined}>
                <div className="st-stapel-feld">
                  <div className="st-stapel" style={{ height: `${(x.umsatzIst / hoechstMonat) * 100}%` }}>
                    {PRODUKTE.map((p, n) => (
                      <div key={p} className={`st-produkt-${n}`} style={{ flexGrow: x.produkte[p] }} title={`${p}: ${euro(x.produkte[p])}`} />
                    ))}
                  </div>
                </div>
                <span>{x.kurz}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="st-box st-pipeline">
          <div className="st-box-kopf"><h2>Pipeline</h2></div>
          <div className="st-pipeline-bogen">
            <Bogen prozent={anteilGesichert} klasse="st-bogen st-bogen-hell" />
            <div className="st-pipeline-zahl">
              <b>{anteilGesichert} %</b>
              <span>gesichert</span>
            </div>
          </div>
          <div className="st-pipeline-fuss">
            <div><small><i className="st-punkt st-punkt-ist" />Gebucht</small><b>{euro(gesichert)}</b></div>
            <div><small><i className="st-punkt st-punkt-plan" />Offen</small><b>{euro(offen)}</b></div>
          </div>
        </section>

        <section className="st-box st-projekte">
          <div className="st-box-kopf">
            <h2>Alle Projekte</h2>
            <div className="st-wahl" aria-label="Person wählen">
              <button type="button" onClick={() => setPerson(null)} aria-pressed={!person}>Alle</button>
              {Object.keys(PERSONEN).map((p) => (
                <button key={p} type="button" onClick={() => setPerson(p)} aria-pressed={person === p}>{PERSONEN[p]}</button>
              ))}
            </div>
          </div>
          <div className="st-tabelle-rahmen">
            <table className="st-tabelle">
              <thead>
                <tr><th>Kunde</th><th>Produkt</th><th>Wer</th><th>Status</th><th className="st-rechts">Wert</th><th>Nächster Schritt</th></tr>
              </thead>
              <tbody>
                {projekte.map((p) => (
                  <tr key={p.kunde}>
                    <td><b>{p.kunde}</b></td>
                    <td>{p.produkt}</td>
                    <td>{PERSONEN[p.person]}</td>
                    <td><span className={`st-stufe st-stufe-${STUFEN.indexOf(p.stufe)}`}>{p.stufe}</span></td>
                    <td className="st-rechts">{euro(p.wert)}</td>
                    <td>{p.naechster} <span className="st-klein">bis {p.faellig}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
