'use client';
// Status — wie laeuft Unicorn Bakery: Umsatz Plan gegen Ist, Monat fuer Monat,
// Umsatz nach Produkt, Pipeline und alle Projekte. Nur Owner/Admin (App.jsx).
//
// ENTWURF: Zahlen aus lib/status-beispiel.js, alles erfunden. Sobald es eine
// echte Quelle gibt (Tabelle, spaeter Sales), wird nur die Datenquelle getauscht.
// Look wie das Dashboard (dashboard.css, db2-*): weisse Karten, eine Akzentfarbe.
// Produktfarben mit dem dataviz-Validator geprueft (Reihenfolge fest).

import { useState } from 'react';
import { I } from '@/components/icons';
import { MONATE, PERSONEN, PRODUKTE, PROJEKTE, STUFEN } from '@/lib/status-beispiel';
import './dashboard.css';

const PRODUKT_FARBE = { 'Stay with': '#df3090', Doku: '#3f63d6', Event: '#c28a12', Studio: '#7c3aed' };

const zahl = (n, stellen = 0) => n.toLocaleString('de-DE', { maximumFractionDigits: stellen });
const euro = (n) => zahl(n) + ' €';
const k = (n) => zahl(n / 1000, 1);

function Kopf({ icon, titel, hilfe, children }) {
  return (
    <div className="db2-kopf">
      <div className="db2-titel">{icon}<span>{titel}</span>{hilfe && <i className="db2-hilfe" title={hilfe}>i</i>}</div>
      <div className="db2-aktionen">{children}</div>
    </div>
  );
}

function Delta({ jetzt, vorher }) {
  if (!vorher) return null;
  const p = Math.round(((jetzt - vorher) / vorher) * 100);
  return <span className={p >= 0 ? 'db2-delta db2-hoch' : 'db2-delta db2-runter'}>{p >= 0 ? '↑' : '↓'} {Math.abs(p)} %</span>;
}

function tageBis(faellig) {
  const [t, m] = faellig.split('.').map(Number);
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  return Math.round((new Date(2026, m - 1, t).getTime() - heute.getTime()) / 86400000);
}

export function StatusScreen() {
  const [wahl, setWahl] = useState(MONATE[MONATE.length - 1].schluessel);
  const [person, setPerson] = useState(null);

  const i = Math.max(0, MONATE.findIndex((x) => x.schluessel === wahl));
  const m = MONATE[i];
  const v = MONATE[i - 1];
  const quote = Math.round((m.umsatzIst / m.umsatzPlan) * 100);
  const oben = Math.max(...MONATE.flatMap((x) => [x.umsatzPlan, x.umsatzIst]));
  const schnittIst = MONATE.reduce((s, x) => s + x.umsatzIst, 0) / MONATE.length;
  const produktSumme = PRODUKTE.reduce((s, p) => s + m.produkte[p], 0) || 1;

  const gesichert = PROJEKTE.filter((p) => ['Gebucht', 'In Produktion', 'Geliefert'].includes(p.stufe)).reduce((s, p) => s + p.wert, 0);
  const offen = PROJEKTE.filter((p) => ['Lead', 'Angebot raus'].includes(p.stufe)).reduce((s, p) => s + p.wert, 0);
  const faellig = [...PROJEKTE].sort((a, b) => tageBis(a.faellig) - tageBis(b.faellig)).slice(0, 6);
  const projekte = PROJEKTE.filter((p) => !person || p.person === person)
    .sort((a, b) => STUFEN.indexOf(a.stufe) - STUFEN.indexOf(b.stufe));

  return (
    <div className="page fade-in">
      <div className="page-head" style={{ borderBottom: 0, paddingBottom: 8, marginBottom: 16 }}>
        <div>
          <div className="meta mb-2">Umsatz, Pipeline und Projekte</div>
          <h1 className="h1" style={{ margin: 0 }}>Status</h1>
          <p className="db2-hinweis" style={{ margin: '8px 0 0' }}>Entwurf mit Beispielzahlen — Firmen und Beträge sind erfunden.</p>
        </div>
        <div className="db2-wahl" role="group" aria-label="Monat wählen">
          {MONATE.map((x) => (
            <button key={x.schluessel} type="button" onClick={() => setWahl(x.schluessel)} aria-pressed={x.schluessel === m.schluessel}>{x.kurz}</button>
          ))}
        </div>
      </div>

      <div className="db2">
        <div className="db2-kpis">
          <div className="db2-karte db2-kpi">
            <Kopf titel={`Umsatz ${m.kurz}`} hilfe="Ist-Umsatz im gewählten Monat"><span className="db2-rund">€</span></Kopf>
            <div className="db2-zahl">{euro(m.umsatzIst)}</div>
            <div className="db2-unter"><Delta jetzt={m.umsatzIst} vorher={v?.umsatzIst} /><span>{v ? `${euro(v.umsatzIst)} im ${v.kurz}` : 'kein Vormonat'}</span></div>
          </div>
          <div className="db2-karte db2-kpi">
            <Kopf titel="Monatsziel"><span className="db2-rund"><I.flag size={15} /></span></Kopf>
            <div className="db2-zahl">{quote} %</div>
            <div className="db2-unter">
              <span className={quote >= 100 ? 'db2-delta db2-hoch' : m.laeuft ? 'db2-delta db2-leer' : 'db2-delta db2-runter'}>{quote >= 100 ? 'erreicht' : m.laeuft ? 'läuft' : 'verfehlt'}</span>
              <span>Ziel {euro(m.umsatzPlan)}</span>
            </div>
          </div>
          <div className="db2-karte db2-kpi">
            <Kopf titel="Offene Pipeline"><span className="db2-rund"><I.kanban size={15} /></span></Kopf>
            <div className="db2-zahl">{euro(m.pipeline)}</div>
            <div className="db2-unter"><Delta jetzt={m.pipeline} vorher={v?.pipeline} /><span>{m.pipelineDeals} Deals offen</span></div>
          </div>
          <div className="db2-karte db2-kpi">
            <Kopf titel="Gewonnene Deals"><span className="db2-rund"><I.check size={15} /></span></Kopf>
            <div className="db2-zahl">{m.gewonnen}</div>
            <div className="db2-unter"><span>Ø {euro(m.gewonnen ? m.umsatzIst / m.gewonnen : 0)} pro Deal</span></div>
          </div>
        </div>

        <div className="db2-reihe db2-8-4">
          <section className="db2-karte">
            <Kopf icon={<I.trend size={15} />} titel="Umsatz: Plan und Ist" hilfe="Heller Balken = Plan, dunkler = Ist. Klick wählt den Monat.">
              <div className="db2-legende-kurz">
                <span><i style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-strong)' }} />Plan</span>
                <span><i style={{ background: 'var(--text-3)' }} />Ist</span>
                <span><i style={{ background: 'var(--danger)' }} />unter Plan</span>
              </div>
            </Kopf>
            <div className="db2-gross">{k(MONATE.slice(0, i + 1).reduce((s, x) => s + x.umsatzIst, 0))}<small>k € seit April</small></div>
            <div className="db2-balken" role="img" aria-label="Umsatz pro Monat, Plan und Ist">
              <div className="db2-schnitt" style={{ bottom: `${(schnittIst / oben) * 100}%` }}><span>Ø {k(schnittIst)}k</span></div>
              {MONATE.map((x) => {
                const unter = x.umsatzIst < x.umsatzPlan && !x.laeuft;
                return (
                  <button key={x.schluessel} type="button" onClick={() => setWahl(x.schluessel)}
                    className={['db2-saeule', x.schluessel === m.schluessel && 'db2-an', unter && 'db2-unter-plan'].filter(Boolean).join(' ')}>
                    <div className="db2-saeule-feld">
                      <div className="db2-plan" style={{ height: `${(x.umsatzPlan / oben) * 100}%` }} />
                      <div className="db2-saeule-wert db2-schmal" style={{ height: `${(x.umsatzIst / oben) * 100}%` }}>
                        {x.schluessel === m.schluessel && <b>{k(x.umsatzIst)}k</b>}
                      </div>
                      <span className="db2-tipp">{x.lang}: {euro(x.umsatzIst)} von {euro(x.umsatzPlan)} ({Math.round((x.umsatzIst / x.umsatzPlan) * 100)} %)</span>
                    </div>
                    <span className="db2-achse">{x.kurz}{x.laeuft ? ' ·' : ''}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="db2-karte">
            <Kopf icon={<I.folder size={15} />} titel={`Umsatz nach Produkt, ${m.kurz}`} />
            <div className="db2-gross">{euro(m.umsatzIst)}</div>
            <div className="db2-segmente" role="img" aria-label="Umsatz nach Produkt">
              {PRODUKTE.map((p) => <div key={p} style={{ flexGrow: m.produkte[p], background: PRODUKT_FARBE[p] }} title={`${p}: ${euro(m.produkte[p])}`} />)}
            </div>
            <ul className="db2-legende">
              {PRODUKTE.map((p) => (
                <li key={p}>
                  <i style={{ background: PRODUKT_FARBE[p] }} />
                  <span>{p}</span>
                  <b>{euro(m.produkte[p])}</b>
                  <em>{Math.round((m.produkte[p] / produktSumme) * 100)} %</em>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="db2-reihe db2-7-5">
          <section className="db2-karte">
            <Kopf icon={<I.calendar size={15} />} titel="Als Nächstes fällig" />
            <ul className="db2-liste">
              {faellig.map((p) => {
                const t = tageBis(p.faellig);
                return (
                  <li key={p.kunde}>
                    <span className="db2-kreis">{PERSONEN[p.person][0]}</span>
                    <div><b>{p.naechster}</b><span>{p.kunde} · {p.produkt}</span></div>
                    <span className={t < 0 ? 'db2-pille db2-rot' : t === 0 ? 'db2-pille db2-gelb' : 'db2-pille'}>
                      {t < 0 ? `${-t} T. überfällig` : t === 0 ? 'heute' : t === 1 ? 'morgen' : `in ${t} Tagen`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="db2-karte">
            <Kopf icon={<I.kanban size={15} />} titel="Pipeline" hilfe="Gebucht = gebucht, in Produktion oder geliefert" />
            <div className="db2-gross">{Math.round((gesichert / (gesichert + offen)) * 100)} %<small>gesichert</small></div>
            <div className="db2-segmente">
              <div style={{ flexGrow: gesichert, background: 'var(--brand)' }} title={`Gebucht: ${euro(gesichert)}`} />
              <div style={{ flexGrow: offen, background: 'var(--border-strong)' }} title={`Offen: ${euro(offen)}`} />
            </div>
            <ul className="db2-legende">
              <li><i style={{ background: 'var(--brand)' }} /><span>Gebucht</span><b>{euro(gesichert)}</b><em /></li>
              <li><i style={{ background: 'var(--border-strong)' }} /><span>Offen (Lead, Angebot)</span><b>{euro(offen)}</b><em /></li>
            </ul>
          </section>
        </div>

        <section className="db2-karte db2-tabelle-karte">
          <Kopf icon={<I.task size={15} />} titel="Alle Projekte">
            <div className="db2-wahl db2-wahl-klein">
              <button type="button" onClick={() => setPerson(null)} aria-pressed={!person}>Alle</button>
              {Object.keys(PERSONEN).map((p) => (
                <button key={p} type="button" onClick={() => setPerson(p)} aria-pressed={person === p}>{PERSONEN[p]}</button>
              ))}
            </div>
          </Kopf>
          <div className="db2-tabelle-rahmen">
            <table className="db2-tabelle">
              <thead><tr><th>Kunde</th><th>Produkt</th><th>Wer</th><th>Status</th><th style={{ textAlign: 'right' }}>Wert</th><th>Nächster Schritt</th></tr></thead>
              <tbody>
                {projekte.map((p) => (
                  <tr key={p.kunde}>
                    <td className="db2-fett">{p.kunde}</td>
                    <td className="db2-leise">{p.produkt}</td>
                    <td>{PERSONEN[p.person]}</td>
                    <td><span className={p.stufe === 'Geliefert' ? 'db2-pille db2-gruen' : 'db2-pille'}>{p.stufe}</span></td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{euro(p.wert)}</td>
                    <td className="db2-leise">{p.naechster} · bis {p.faellig}</td>
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
