import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useWedstrijden } from '@/features/inschrijven/pages/hooks/useWedstrijden';
import { useWedstrijdContext } from '@/features/wedstrijden/context/WedstrijdContext';
import Container from '@/ui/Container';
import { Card } from '@/ui/card';
import { Button } from '@/ui/button';
import { Alert } from '@/ui/alert';
import './WachtlijstBeheer.css';

export default function WachtlijstBeheer() {
  const { items: wedstrijden, loading: wedstrijdenLoading } = useWedstrijden(false);
  const { selectedWedstrijdId: appSelectedWedstrijdId } = useWedstrijdContext();
  const [selectedWedstrijdId, setSelectedWedstrijdId] = useState('');
  const [wachtlijst, setWachtlijst] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const gekozenWedstrijd = wedstrijden.find(w => w.id === selectedWedstrijdId) || null;

  useEffect(() => {
    if (!selectedWedstrijdId && appSelectedWedstrijdId) {
      setSelectedWedstrijdId(appSelectedWedstrijdId);
    }
  }, [appSelectedWedstrijdId, selectedWedstrijdId]);

  async function loadWachtlijst() {
    if (!selectedWedstrijdId) return;
    setLoading(true);
    setMsg('');
    try {
      const { data, error } = await supabase
        .from('wachtlijst')
        .select('*')
        .eq('wedstrijd_id', selectedWedstrijdId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(error.message || 'Laden mislukt');
      }

      setWachtlijst(data || []);
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
    <div className="wl-page">
      <Container maxWidth={1200}>
        <Card className="wl-shell">
          <h2 className="wl-title">
            Wachtlijst beheer
          </h2>

          <div className="wl-select-wrap">
            <label className="wl-label">
              Selecteer wedstrijd
            </label>
            <select
              value={selectedWedstrijdId}
              onChange={(e) => setSelectedWedstrijdId(e.target.value)}
              disabled={wedstrijdenLoading}
              className="wl-select"
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
            <div className="wl-empty">
              Geen personen op de wachtlijst
            </div>
          )}

          {!loading && wachtlijst.length > 0 && (
            <div className="wl-results">
              <div className="wl-summary">
                Totaal {wachtlijst.length} {wachtlijst.length === 1 ? 'persoon' : 'personen'} op de wachtlijst
              </div>

              {Object.keys(groupedByKlasse).sort().map(klasse => (
                <div key={klasse} className="wl-klasse-block">
                  <h3 className="wl-klasse-title">
                    {klasse} ({groupedByKlasse[klasse].length})
                  </h3>

                  <div className="wl-table-wrap">
                    <table className="wl-table">
                      <thead>
                        <tr>
                          <th>Datum/tijd</th>
                          <th>Ruiter</th>
                          <th>Paard</th>
                          <th>Email</th>
                          <th>Telefoon</th>
                          <th>WEH-lid</th>
                          <th>Opmerkingen</th>
                          <th>Acties</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedByKlasse[klasse].map((item, idx) => (
                          <tr key={item.id}>
                            <td className="wl-cell-sm">
                              {new Date(item.created_at).toLocaleString('nl-NL')}
                            </td>
                            <td className="wl-strong">{item.ruiter}</td>
                            <td>{item.paard}</td>
                            <td className="wl-cell-sm">
                              <a href={`mailto:${item.email}`} className="wl-link">
                                {item.email}
                              </a>
                            </td>
                            <td className="wl-cell-sm">{item.telefoon || '—'}</td>
                            <td className="wl-center">
                              {item.weh_lid ? '✓' : '—'}
                            </td>
                            <td className="wl-cell-sm wl-notes">
                              {item.opmerkingen || '—'}
                            </td>
                            <td className="wl-center">
                              <div className="wl-actions">
                                <Button 
                                  onClick={() => promoteToDeelnemer(item)}
                                  disabled={busy}
                                  className="wl-btn wl-btn-accept"
                                >
                                  ✓ Toevoegen
                                </Button>
                                <Button 
                                  onClick={() => removeFromWachtlijst(item)}
                                  disabled={busy}
                                  className="wl-btn wl-btn-remove"
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
            <div className="wl-footer-actions">
              <Button onClick={loadWachtlijst} className="wl-btn-refresh">
                Ververs
              </Button>
            </div>
          )}
        </Card>
      </Container>
    </div>
  );
}
