import React from 'react';
import { useAccess } from '@/features/auth/AdminGate';
import { useWedstrijdContext } from '@/features/wedstrijden/context/WedstrijdContext';
import ScoreInvoer from './ScoreInvoer';
import { Link } from 'react-router-dom';

export default function ScoreWerkplek({ children, title = "Score-invoer" }) {
  const { isAdmin, scoreWedstrijdIds } = useAccess();
  const { wedstrijden, selectedWedstrijdId, setSelectedWedstrijdId, loadingWedstrijden } = useWedstrijdContext();
  const allowed = wedstrijden.filter(w => isAdmin || scoreWedstrijdIds.includes(w.id));
  const selected = allowed.some(w => w.id === selectedWedstrijdId);
  return <>
    <section style={{ padding: 20 }}>
      <h1>{title}</h1>
      <nav aria-label="Secretariaat"><Link to="/scores">Score-invoer</Link>{" · "}<Link to="/deelnemers">Deelnemers en stallen</Link>{" · "}<Link to="/uitslagen">Einduitslag</Link></nav>
      <label>Wedstrijd
        <select value={selected ? selectedWedstrijdId : ''} onChange={e => setSelectedWedstrijdId(e.target.value)}>
          <option value="">Kies een wedstrijd</option>
          {allowed.map(w => <option key={w.id} value={w.id}>{w.naam} ({w.datum})</option>)}
        </select>
      </label>
      {!loadingWedstrijden && allowed.length === 0 && <p>Er is nog geen wedstrijd aan dit account toegewezen.</p>}
    </section>
    {selected && <React.Fragment key={selectedWedstrijdId}>{children || <ScoreInvoer />}</React.Fragment>}
  </>;
}
