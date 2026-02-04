import React, { useState, useEffect } from 'react';
import { useWedstrijden } from '@/features/inschrijven/pages/hooks/useWedstrijden';
import Container from '@/ui/Container';
import { Card } from '@/ui/card';
import { Button } from '@/ui/button';
import { Alert } from '@/ui/alert';

export default function WachtlijstBeheer() {
  const { items: wedstrijden, loading: wedstrijdenLoading } = useWedstrijden(false);
  const [selectedWedstrijdId, setSelectedWedstrijdId] = useState('');
  const [wachtlijst, setWachtlijst] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const gekozenWedstrijd = wedstrijden.find(w => w.id === selectedWedstrijdId) || null;

  async function loadWachtlijst() {
    if (!selectedWedstrijdId) return;
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`/api/wachtlijst?wedstrijd_id=${selectedWedstrijdId}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || json.error || 'Laden mislukt');
      }
      setWachtlijst(json.data || []);
    } catch (e) {
      setMsg('Fout bij laden: ' + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedWedstrijdId) {
      loadWachtlijst();
    } else {
      setWachtlijst([]);
    }
  }, [selectedWedstrijdId]);

  // Group wachtlijst by klasse
  const groupedByKlasse = wachtlijst.reduce((acc, item) => {
    if (!acc[item.klasse]) acc[item.klasse] = [];
    acc[item.klasse].push(item);
    return acc;
  }, {});

  return (
    <div style={{ background: '#f5f7fb', minHeight: '100vh', padding: 24 }}>
      <Container maxWidth={1200}>
        <Card>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: '#204574', marginBottom: 18 }}>
            Wachtlijst beheer
          </h2>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontWeight: 700, display: 'block', marginBottom: 8 }}>
              Selecteer wedstrijd
            </label>
            <select
              value={selectedWedstrijdId}
              onChange={(e) => setSelectedWedstrijdId(e.target.value)}
              disabled={wedstrijdenLoading}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd', minWidth: 300 }}
            >
              <option value="">— kies wedstrijd —</option>
              {wedstrijden.map(w => (
                <option key={w.id} value={w.id}>
                  {w.naam} {w.datum ? `(${w.datum})` : ''}
                </option>
              ))}
            </select>
          </div>

          {gekozenWedstrijd && !gekozenWedstrijd.wachtlijst_enabled && (
            <Alert type="warning">
              Wachtlijst is niet ingeschakeld voor deze wedstrijd. 
              Ga naar Wedstrijden Beheer om de wachtlijst in te schakelen.
            </Alert>
          )}

          {msg && <Alert type="error">{msg}</Alert>}

          {loading && <div>Laden...</div>}

          {!loading && selectedWedstrijdId && wachtlijst.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#666' }}>
              Geen personen op de wachtlijst
            </div>
          )}

          {!loading && wachtlijst.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ marginBottom: 12, fontWeight: 700, fontSize: 16 }}>
                Totaal {wachtlijst.length} {wachtlijst.length === 1 ? 'persoon' : 'personen'} op de wachtlijst
              </div>

              {Object.keys(groupedByKlasse).sort().map(klasse => (
                <div key={klasse} style={{ marginBottom: 32 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: '#204574', marginBottom: 12 }}>
                    {klasse} ({groupedByKlasse[klasse].length})
                  </h3>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f0f4f8', borderBottom: '2px solid #ddd' }}>
                          <th style={{ padding: 10, textAlign: 'left', fontWeight: 700 }}>Datum/tijd</th>
                          <th style={{ padding: 10, textAlign: 'left', fontWeight: 700 }}>Ruiter</th>
                          <th style={{ padding: 10, textAlign: 'left', fontWeight: 700 }}>Paard</th>
                          <th style={{ padding: 10, textAlign: 'left', fontWeight: 700 }}>Email</th>
                          <th style={{ padding: 10, textAlign: 'left', fontWeight: 700 }}>Telefoon</th>
                          <th style={{ padding: 10, textAlign: 'center', fontWeight: 700 }}>WEH-lid</th>
                          <th style={{ padding: 10, textAlign: 'left', fontWeight: 700 }}>Opmerkingen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedByKlasse[klasse].map((item, idx) => (
                          <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: 10, fontSize: 13 }}>
                              {new Date(item.created_at).toLocaleString('nl-NL')}
                            </td>
                            <td style={{ padding: 10, fontWeight: 600 }}>{item.ruiter}</td>
                            <td style={{ padding: 10 }}>{item.paard}</td>
                            <td style={{ padding: 10, fontSize: 13 }}>
                              <a href={`mailto:${item.email}`} style={{ color: '#204574' }}>
                                {item.email}
                              </a>
                            </td>
                            <td style={{ padding: 10, fontSize: 13 }}>{item.telefoon || '—'}</td>
                            <td style={{ padding: 10, textAlign: 'center' }}>
                              {item.weh_lid ? '✓' : '—'}
                            </td>
                            <td style={{ padding: 10, fontSize: 13, maxWidth: 200 }}>
                              {item.opmerkingen || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedWedstrijdId && !loading && (
            <div style={{ marginTop: 24, textAlign: 'right' }}>
              <Button onClick={loadWachtlijst}>
                🔄 Ververs
              </Button>
            </div>
          )}
        </Card>
      </Container>
    </div>
  );
}
