import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useWedstrijdContext } from '@/features/wedstrijden/context/WedstrijdContext';

export default function DeelnemersInzage() {
  const { selectedWedstrijdId } = useWedstrijdContext();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [version, setVersion] = useState(0);
  let stalls = {};
  try { stalls = JSON.parse(localStorage.getItem('deelnemers_stal_toewijzingen_v1') || '{}')[selectedWedstrijdId] || {}; } catch { /* Unavailable local storage must not block the participant list. */ }
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    supabase.from('inschrijvingen').select('id,ruiter,paard,klasse,startnummer,deelnemer_status')
      .eq('wedstrijd_id', selectedWedstrijdId).order('ruiter').then(({ data, error }) => {
        if (!active) return;
        setRows(data || []);
        setError(error ? 'Deelnemers konden niet worden geladen. Probeer opnieuw.' : '');
        setLoading(false);
      });
    return () => { active = false; };
  }, [selectedWedstrijdId, version]);
  const filtered = rows.filter(r => `${r.ruiter || ''} ${r.paard || ''} ${r.startnummer || ''}`.toLowerCase().includes(search.toLowerCase()));
  return <section style={{ padding: 20 }}>
    <p>Deelnemers bekijken. Wijzigingen worden door een beheerder gedaan.</p>
    <p>Staltoewijzingen zijn momenteel alleen zichtbaar in de browser waarin ze zijn ingevuld. Een ontbrekend nummer betekent niet dat er geen stal is toegewezen.</p>
    <label>Zoek ruiter, paard of startnummer <input value={search} onChange={e => setSearch(e.target.value)} /></label>
    <button onClick={() => setVersion(v => v + 1)}>Verversen</button>
    {loading ? <p role="status">Deelnemers laden…</p> : error ? <p role="alert">{error}</p> : <div style={{ overflowX: 'auto' }}><table>
      <thead><tr>{['Startnr', 'Ruiter', 'Paard', 'Klasse', 'Status', 'Stal'].map(h => <th key={h} style={{ padding: 10 }}>{h}</th>)}</tr></thead>
      <tbody>{filtered.map(r => <tr key={r.id}>
        <td>{r.startnummer || '—'}</td><td>{r.ruiter}</td><td>{r.paard}</td><td>{r.klasse}</td><td>{r.deelnemer_status || 'actief'}</td>
        <td>{stalls[r.id]?.heeftStal ? stalls[r.id].stalnummer || 'Nummer nog niet ingevuld' : 'Niet geregistreerd in deze browser'}</td>
      </tr>)}</tbody>
    </table>{filtered.length === 0 && <p>Geen deelnemers gevonden.</p>}</div>}
  </section>;
}
