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
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    supabase.from('inschrijvingen').select('id,ruiter,paard,klasse,startnummer,deelnemer_status,stal_toewijzing')
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
    <p>Stalnummers worden centraal bijgehouden door de beheerders. Klik op Verversen om recente wijzigingen te zien.</p>
    <label>Zoek ruiter, paard of startnummer <input value={search} onChange={e => setSearch(e.target.value)} /></label>
    <button onClick={() => setVersion(v => v + 1)}>Verversen</button>
    {loading ? <p role="status">Deelnemers laden…</p> : error ? <p role="alert">{error}</p> : <div style={{ overflowX: 'auto' }}><table>
      <thead><tr>{['Startnr', 'Ruiter', 'Paard', 'Klasse', 'Status', 'Stal'].map(h => <th key={h} style={{ padding: 10 }}>{h}</th>)}</tr></thead>
      <tbody>{filtered.map(r => <tr key={r.id}>
        <td>{r.startnummer || '—'}</td><td>{r.ruiter}</td><td>{r.paard}</td><td>{r.klasse}</td><td>{r.deelnemer_status || 'actief'}</td>
        <td>{r.stal_toewijzing == null ? 'Nog niet centraal geregistreerd' : r.stal_toewijzing.heeftStal ? r.stal_toewijzing.stalnummer || 'Nummer nog niet ingevuld' : 'Geen stal'}</td>
      </tr>)}</tbody>
    </table>{filtered.length === 0 && <p>Geen deelnemers gevonden.</p>}</div>}
  </section>;
}
