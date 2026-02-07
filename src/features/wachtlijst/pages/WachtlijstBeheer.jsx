import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
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
  const [busy, setBusy] = useState(false);

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

  async function promoteToDeelnemer(item) {
    if (!confirm(`${item.ruiter} met paard ${item.paard} toevoegen als deelnemer?\n\nLet op: controleer eerst of er nog ruimte is in de wedstrijd/klasse!`)) {
      return;
    }

    setBusy(true);
    setMsg('');
    try {
      // Check capaciteit voordat we toevoegen
      const cfg = gekozenWedstrijd?.startlijst_config || {};
      
      // Check totaal capaciteit
      if (cfg.totaalMaximum) {
        const { count: totaalCount } = await supabase
          .from('inschrijvingen')
          .select('id', { count: 'exact', head: true })
          .eq('wedstrijd_id', selectedWedstrijdId);
        
        if ((totaalCount || 0) >= Number(cfg.totaalMaximum)) {
          throw new Error(`⚠️ Wedstrijd is nog steeds vol (${totaalCount}/${cfg.totaalMaximum}). Verhoog de limiet eerst in Wedstrijden Beheer.`);
        }
      }

      // Check klasse capaciteit
      if (cfg.capacities && cfg.capacities[item.klasse]) {
        const { count } = await supabase
          .from('inschrijvingen')
          .select('id', { count: 'exact', head: true })
          .eq('wedstrijd_id', selectedWedstrijdId)
          .eq('klasse', item.klasse);
        
        if ((count || 0) >= Number(cfg.capacities[item.klasse])) {
          throw new Error(`⚠️ Klasse ${item.klasse} is nog steeds vol (${count}/${cfg.capacities[item.klasse]}). Verhoog de limiet eerst.`);
        }
      }

      // Voeg toe als deelnemer
      const inschrijving = {
        wedstrijd_id: selectedWedstrijdId,
        wedstrijd: gekozenWedstrijd?.naam || null,
        klasse: item.klasse,
        weh_lid: item.weh_lid || false,
        ruiter: item.ruiter,
        paard: item.paard,
        leeftijd_ruiter: item.leeftijd_ruiter,
        geslacht_paard: item.geslacht_paard,
        email: item.email,
        opmerkingen: item.opmerkingen,
        omroeper: item.omroeper,
        rubriek: "Algemeen",
      };

      const { error: insertError } = await supabase
        .from('inschrijvingen')
        .insert(inschrijving);

      if (insertError) throw insertError;

      // Verwijder van wachtlijst
      await supabase.from('wachtlijst').delete().eq('id', item.id);

      setMsg(`✅ ${item.ruiter} is toegevoegd als deelnemer!`);
      
      // Herlaad wachtlijst
      await loadWachtlijst();

      // TODO: Optioneel - stuur email naar persoon dat er een plek is
      
    } catch (e) {
      setMsg((e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function removeFromWachtlijst(item) {
    if (!confirm(`${item.ruiter} definitief verwijderen van de wachtlijst?`)) {
      return;
    }

    setBusy(true);
    setMsg('');
    try {
      const { error } = await supabase
        .from('wachtlijst')
        .delete()
        .eq('id', item.id);

      if (error) throw error;
      
      setMsg(`✅ ${item.ruiter} is verwijderd van de wachtlijst`);
      await loadWachtlijst();
    } catch (e) {
      setMsg('❌ Fout: ' + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

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
                          <th style={{ padding: 10, textAlign: 'center', fontWeight: 700, minWidth: 180 }}>Acties</th>
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
                            <td style={{ padding: 10, textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                <Button 
                                  onClick={() => promoteToDeelnemer(item)}
                                  disabled={busy}
                                  style={{ 
                                    padding: '6px 12px', 
                                    fontSize: 13, 
                                    background: '#4caf50',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  ✓ Toevoegen
                                </Button>
                                <Button 
                                  onClick={() => removeFromWachtlijst(item)}
                                  disabled={busy}
                                  style={{ 
                                    padding: '6px 12px', 
                                    fontSize: 13, 
                                    background: '#f44336',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  ✗ Verwijder
                                </Button>
                              </div>
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
