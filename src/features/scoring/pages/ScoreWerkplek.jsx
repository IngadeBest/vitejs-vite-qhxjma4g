import React from 'react';
import { useAccess } from '@/features/auth/AdminGate';
import { useWedstrijdContext } from '@/features/wedstrijden/context/WedstrijdContext';
import ScoreInvoer from './ScoreInvoer';

export default function ScoreWerkplek() {
  const { isAdmin, scoreWedstrijdIds } = useAccess();
  const { wedstrijden, selectedWedstrijdId, setSelectedWedstrijdId, loadingWedstrijden } = useWedstrijdContext();
  const allowed = wedstrijden.filter(w => isAdmin || scoreWedstrijdIds.includes(w.id));
  const selected = allowed.some(w => w.id === selectedWedstrijdId);
  return <>
    <section style={{ padding: 20 }}>
      <h1>Score-invoer</h1>
      <label>Wedstrijd voor score-invoer
        <select value={selected ? selectedWedstrijdId : ''} onChange={e => setSelectedWedstrijdId(e.target.value)}>
          <option value="">Kies een wedstrijd</option>
          {allowed.map(w => <option key={w.id} value={w.id}>{w.naam} ({w.datum})</option>)}
        </select>
      </label>
      {!loadingWedstrijden && allowed.length === 0 && <p>Er is nog geen wedstrijd aan dit account toegewezen.</p>}
    </section>
    {selected && <ScoreInvoer key={selectedWedstrijdId} />}
  </>;
}
