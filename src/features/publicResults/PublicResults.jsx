import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import './publicResults.css';

export const POLL_MS = 20000;
export default function PublicResults() {
  const { eventId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedComponent, setSelectedComponent] = useState('');

  useEffect(() => {
    let active = true, inFlight = false;
    let controller;
    setData(null); setError(''); setUpdated(null);
    async function refresh() {
      if (inFlight) return;
      inFlight = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(`/api/results?eventId=${encodeURIComponent(eventId)}`, {
          cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const next = await response.json();
        if (active) { setData(next); setError(''); setUpdated(new Date()); }
      } catch {
        // Fail closed: do not keep showing data whose publication cannot be verified.
        if (active) { setData(null); setError('De uitslagen zijn tijdelijk niet bereikbaar. We proberen het automatisch opnieuw.'); }
      } finally { clearTimeout(timeout); inFlight = false; }
    }
    void refresh();
    const timer = setInterval(refresh, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; clearInterval(timer); controller?.abort(); document.removeEventListener('visibilitychange', onVisible); };
  }, [eventId]);

  const sections = data?.sections || [];
  const classes = [...new Set(sections.map(s => s.className))];
  const className = classes.includes(selectedClass) ? selectedClass : classes[0];
  const classSections = [...(data?.totals || []), ...sections].filter(s => s.className === className);
  const section = classSections.find(s => s.component === selectedComponent) || classSections[0];
  const date = data?.event?.datum ? new Date(`${data.event.datum.slice(0,10)}T12:00:00`).toLocaleDateString('nl-NL', {day:'numeric',month:'long',year:'numeric'}) : '';

  return <main className="pr-page">
    <div className="pr-brand">WorkingPoint <span>Uitslagen</span></div>
    {error ? <p role="alert" className="pr-notice">{error}</p> : !data ? <p role="status">Uitslagen laden…</p> : !data.published ?
      <div className="pr-hero"><h1>Nog niet gepubliceerd</h1><p>De uitslagen van deze wedstrijd zijn nog niet gepubliceerd.</p></div> : <>
      <header className="pr-hero">
        <span className={`pr-badge ${data.final ? 'pr-final' : ''}`}>{data.final ? 'Einduitslag' : 'Live tussenstand'}</span>
        <h1>{data.event.naam}</h1>
        <p>{[date, data.event.locatie].filter(Boolean).join(' · ')}</p>
      </header>
      {data.hasErrors && <p role="alert" className="pr-notice">Een deel van de uitslagen wordt gecontroleerd en is tijdelijk niet beschikbaar.</p>}
      {!sections.length ? <p className="pr-notice">Zodra er resultaten zijn, verschijnen ze hier automatisch.</p> : <>
        <label className="pr-class">Klasse / rubriek
          <select value={className} onChange={e => setSelectedClass(e.target.value)}>{classes.map(c => <option key={c}>{c}</option>)}</select>
        </label>
        <div className="pr-tabs" aria-label="Onderdeel">{classSections.map(s => <button key={s.id} aria-pressed={section.id === s.id} onClick={() => setSelectedComponent(s.component)}>{s.component}</button>)}</div>
        <section aria-label={`${section.className} ${section.component}`}>
          <div className="pr-section-head"><h2>{section.name || section.component}</h2><span className="pr-badge">{section.final ? 'Einduitslag' : 'Tussenstand'}</span></div>
          {!section.final && <p className="pr-help">Deze tussenstand kan nog wijzigen.</p>}
          {section.component === 'Totaal' && <p className="pr-help">Het totaal is de som van de plaatsingspunten per onderdeel.{section.preliminary && ' Nog niet alle scores of statussen zijn ingevoerd; de totaalplaatsen zijn daarom nog voorlopig.'}</p>}
          <div className="pr-list-head"><span>Plaats · Deelnemer / paard</span><span>{section.component === 'Totaal' ? 'Totaalpunten' : 'Score / tijd'}</span></div>
          <ol className="pr-results">{section.rows.map((row,i) => <li key={i}>
            <strong className="pr-place" aria-label={`Plaats ${row.place || 'nog geen plaats'}`}>{row.place === 'voorlopig' ? '—' : row.place || '—'}</strong>
            <div className="pr-combination"><strong>{row.rider}</strong><span>{row.horse}</span></div>
            <div className="pr-score"><strong>{row.score}</strong>
              {row.penalty != null && Number(row.penalty) > 0 && <small>Straf: {row.penalty} {row.penaltyUnit}</small>}
              {row.bonus != null && Number(row.bonus) > 0 && <small>Bonus: {row.bonus} sec</small>}
            </div>
            {row.components && <div className="pr-total-details">{row.components.map(c => <div key={c.name}><span>{c.name}</span><span>{c.score}</span><strong>{c.points} pt</strong></div>)}</div>}
          </li>)}</ol>
        </section>
        <p className="pr-help">DQ = gediskwalificeerd · EL = geëlimineerd · NS = niet gestart · HC = hors concours</p>
      </>}
      <footer className="pr-footer">Automatisch bijgewerkt iedere 20 seconden{updated && <> · Laatste update <time dateTime={updated.toISOString()}>{updated.toLocaleTimeString('nl-NL')}</time></>}</footer>
    </>}
  </main>;
}
