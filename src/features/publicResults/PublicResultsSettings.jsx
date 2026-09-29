import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabaseClient';
import './publicResults.css';

export default function PublicResultsSettings({ wedstrijd }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [qr, setQr] = useState('');
  const dialog = useRef(null);
  const url = `${window.location.origin}/results/${encodeURIComponent(wedstrijd.id)}`;

  async function load(signal) {
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch(`/api/results?eventId=${encodeURIComponent(wedstrijd.id)}&preview=1`, {
      headers: { Authorization: `Bearer ${sessionData.session?.access_token || ''}` }, cache: 'no-store', signal,
    });
    if (!response.ok) throw new Error();
    const result = await response.json();
    if (!signal?.aborted) setData(result);
    return result;
  }
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).catch(() => { if (!controller.signal.aborted) setMessage('Publicatie-instellingen konden niet worden geladen.'); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [wedstrijd.id]);

  async function save(patch) {
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.from('public_result_settings').upsert({ wedstrijd_id: wedstrijd.id, ...patch }, { onConflict: 'wedstrijd_id' });
      if (error) throw error;
      await load();
      setMessage('Publicatie-instellingen opgeslagen.');
    } catch { setMessage('Opslaan of verversen is mislukt. Controleer de instelling door opnieuw te laden.'); }
    finally { setBusy(false); }
  }
  async function refresh() {
    setBusy(true); setMessage('');
    try { await load(); } catch { setMessage('Instellingen konden niet worden geladen.'); }
    finally { setBusy(false); }
  }
  async function showQr() {
    try {
      setQr(await QRCode.toDataURL(url, { width: 1000, margin: 4, errorCorrectionLevel: 'M', color:{dark:'#000000',light:'#ffffff'} }));
      dialog.current.showModal();
    } catch { setMessage('QR-code kon niet worden geopend. Gebruik de link hieronder.'); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(url); setMessage('Link gekopieerd.'); }
    catch { setMessage('Kopiëren niet mogelijk. Selecteer en kopieer de link hieronder.'); }
  }
  return <article className="wb-card pr-settings">
    <h2>Publieke uitslagen</h2>
    <p>Deel de live tussenstand en einduitslag via één vaste link.</p>
    <label>Publicatie
      <select aria-label="Publieke uitslagen" value={data?.published ? 'published' : 'hidden'} disabled={busy || !data} onChange={e => save({ published: e.target.value === 'published' })}>
        <option value="hidden">Niet gepubliceerd</option><option value="published">Gepubliceerd</option>
      </select>
    </label>
    <div className="pr-actions">
      <a className="wp-btn secondary" href={url} target="_blank" rel="noreferrer">Open publieke pagina</a>
      <button type="button" onClick={copyLink}>Kopieer link</button>
      <button type="button" onClick={showQr}>QR-code</button>
      <button type="button" onClick={refresh} disabled={busy}>Instellingen verversen</button>
    </div>
    <input className="pr-link" aria-label="Publieke uitslagenlink" readOnly value={url} onFocus={e => e.target.select()} />
    {message && <p role="status">{message}</p>}
    {data?.hasErrors && <p role="alert">Controleer de uitslagen in het dashboard: niet alle klassen kunnen worden gerangschikt.</p>}
    {!!data?.sections?.length && <>
      <h3>Onderdelen definitief maken</h3>
      <p>Het totale klassement staat op de publieke pagina onder Totaal. Het wordt een einduitslag zodra alle vereiste onderdelen van die klasse definitief zijn.</p>
      <p>Goedkeuring geldt voor de huidige uitslagen. Bij gewijzigde scoredata binnen de klasse wordt het weer een tussenstand.</p>
      {data.sections.map(s => <div className="pr-finalize" key={s.id}>
        <span><strong>{s.className} · {s.component}</strong><br />{s.name} · {s.final ? 'Einduitslag' : 'Tussenstand'}</span>
        <button type="button" disabled={busy || !s.complete} onClick={() => save({ finalized: {...data.finalized, [s.id]: s.final ? null : s.fingerprint} })}>{s.final ? 'Heropenen' : 'Definitief maken'}</button>
        {!s.complete && <small>Nog niet alle scores of statussen zijn ingevoerd.</small>}
      </div>)}
    </>}
    <dialog ref={dialog} className="pr-qr-dialog">
      <div className="pr-qr-sheet"><p className="pr-brand">WorkingPoint</p><h2>{wedstrijd.naam}</h2><p>Scan voor live uitslagen</p>
        {qr && <img src={qr} alt={`QR-code voor de uitslagen van ${wedstrijd.naam}`} width="1000" height="1000" />}
        <p className="pr-print-url">{url}</p>
      </div>
      <div className="pr-actions"><a href={qr} download={`WorkingPoint-uitslagen-${wedstrijd.id}.png`}>Download PNG</a><button type="button" onClick={() => window.print()}>Printen</button><button type="button" onClick={() => dialog.current.close()}>Sluiten</button></div>
    </dialog>
  </article>;
}
