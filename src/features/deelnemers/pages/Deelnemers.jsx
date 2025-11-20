import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";
import { supabase } from "@/lib/supabaseClient";
import Container from "@/ui/Container";

// Inschrijfgeld tarieven (in euros)
const TARIEVEN = {
  base: {
    weh_lid: 35.0,
    niet_weh_lid: 45.0
  },
  stal: {
    per_dag: 15.0,
    per_nacht: 25.0
  }
};

// Helper functie voor inschrijfgeld berekening
const berekenInschrijfgeld = (deelnemer, stalToewijzingen) => {
  const { weh_lid } = deelnemer;
  
  // Basis tarief
  let totaal = weh_lid ? TARIEVEN.base.weh_lid : TARIEVEN.base.niet_weh_lid;
  
  // Stal kosten - check stal toewijzing
  if (stalToewijzingen && stalToewijzingen[deelnemer.id]) {
    totaal += TARIEVEN.stal.per_dag; // Default per dag, kan later uitgebreid worden
  }
  
  return totaal;
};

// Helper functie om omroeper tekst te formatteren
const formatOmroeper = (deelnemer) => {
  const { ruiter, paard, omroeper } = deelnemer;
  
  if (omroeper && omroeper.trim()) {
    return omroeper;
  }
  
  // Fallback: genereer standaard omroeper tekst
  return `${ruiter || 'Ruiter'} met ${paard || 'paard'}`;
};

export default function Deelnemers() {
  const { items: wedstrijden, loading: wedstrijdenLoading } = useWedstrijden();
  const [wedstrijd, setWedstrijd] = useState(null);
  const [deelnemers, setDeelnemers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterKlasse, setFilterKlasse] = useState("");
  const [filterWehLid, setFilterWehLid] = useState("");
  const [filterStal, setFilterStal] = useState("");
  const [stalToewijzingen, setStalToewijzingen] = useState({});

  // Load deelnemers when wedstrijd changes
  useEffect(() => {
    if (!wedstrijd) {
      setDeelnemers([]);
      return;
    }

    loadDeelnemers();
  }, [wedstrijd]);

  const loadDeelnemers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('inschrijvingen')
        .select(`
          *,
          wedstrijden(naam, datum)
        `)
        .eq('wedstrijd_id', wedstrijd.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      setDeelnemers(data || []);
    } catch (err) {
      console.error('Fout bij laden deelnemers:', err);
      setError('Kon deelnemers niet laden: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter deelnemers
  const gefilterde = deelnemers.filter(d => {
    if (filterKlasse && d.klasse !== filterKlasse) return false;
    if (filterWehLid === 'ja' && !d.weh_lid) return false;
    if (filterWehLid === 'nee' && d.weh_lid) return false;
    if (filterStal === 'ja' && !stalToewijzingen[d.id]) return false;
    if (filterStal === 'nee' && stalToewijzingen[d.id]) return false;
    return true;
  });

  // Statistieken
  const stats = {
    totaal: gefilterde.length,
    wehLeden: gefilterde.filter(d => d.weh_lid).length,
    stalVerzoeken: gefilterde.filter(d => stalToewijzingen[d.id]).length,
    totaalInschrijfgeld: gefilterde.reduce((sum, d) => sum + berekenInschrijfgeld(d, stalToewijzingen), 0),
  };

  // Unieke klassen voor filter
  const klassen = [...new Set(deelnemers.map(d => d.klasse).filter(Boolean))].sort();

  if (wedstrijdenLoading) {
    return (
      <Container>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Wedstrijden laden...</span>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="max-w-7xl mx-auto py-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Deelnemers Management</h1>
              <p className="text-gray-600 mt-2">
                Overzicht van alle inschrijvingen met organisatie-relevante informatie
              </p>
            </div>
            
            {/* Navigation links */}
            <div className="flex gap-2">
              <Link
                to="/startlijst"
                className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-sm font-medium"
              >
                📋 Naar Startlijst
              </Link>
            </div>
          </div>
        </div>

        {/* Wedstrijd Selectie */}
        <div className="bg-white rounded-lg border p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Wedstrijd Selectie</h2>
          <select
            className="w-full max-w-md border rounded px-3 py-2"
            value={wedstrijd?.id || ""}
            onChange={(e) => {
              const geselecteerd = wedstrijden.find(w => w.id === e.target.value);
              setWedstrijd(geselecteerd || null);
            }}
          >
            <option value="">Selecteer een wedstrijd...</option>
            {wedstrijden.map(w => (
              <option key={w.id} value={w.id}>
                {w.naam} - {new Date(w.datum).toLocaleDateString('nl-NL')}
              </option>
            ))}
          </select>
        </div>

        {wedstrijd && (
          <>
            {/* Statistieken */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 border">
                <div className="text-2xl font-bold text-blue-600">{stats.totaal}</div>
                <div className="text-blue-800 text-sm">Totaal Deelnemers</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border">
                <div className="text-2xl font-bold text-green-600">{stats.wehLeden}</div>
                <div className="text-green-800 text-sm">WEH Leden</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 border">
                <div className="text-2xl font-bold text-yellow-600">{stats.stalVerzoeken}</div>
                <div className="text-yellow-800 text-sm">Stal Toewijzingen</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 border">
                <div className="text-2xl font-bold text-purple-600">€{stats.totaalInschrijfgeld.toFixed(2)}</div>
                <div className="text-purple-800 text-sm">Totaal Inschrijfgeld</div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg border p-4 mb-6">
              <h3 className="text-lg font-semibold mb-3">Filters</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Klasse</label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={filterKlasse}
                    onChange={(e) => setFilterKlasse(e.target.value)}
                  >
                    <option value="">Alle klassen</option>
                    {klassen.map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">WEH Lid</label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={filterWehLid}
                    onChange={(e) => setFilterWehLid(e.target.value)}
                  >
                    <option value="">Alle deelnemers</option>
                    <option value="ja">Alleen WEH leden</option>
                    <option value="nee">Alleen niet-leden</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Stal Toewijzing</label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={filterStal}
                    onChange={(e) => setFilterStal(e.target.value)}
                  >
                    <option value="">Alle deelnemers</option>
                    <option value="ja">Met stal toewijzing</option>
                    <option value="nee">Zonder stal toewijzing</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Deelnemers Tabel */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2">Deelnemers laden...</span>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700">{error}</p>
                <button
                  className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  onClick={loadDeelnemers}
                >
                  Opnieuw proberen
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-lg border overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b">
                  <h3 className="text-lg font-semibold">
                    Deelnemers ({gefilterde.length})
                  </h3>
                </div>
                
                {gefilterde.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <div className="text-4xl mb-4">🏇</div>
                    <p>Geen deelnemers gevonden met de huidige filters</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ruiter</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paard</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Klasse</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">WEH</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stal</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inschrijfgeld</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Omroeper</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Opmerkingen</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {gefilterde.map((deelnemer, idx) => (
                          <tr key={deelnemer.id || idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{deelnemer.ruiter}</div>
                              <div className="text-xs text-gray-500">
                                Ingeschreven: {new Date(deelnemer.created_at).toLocaleDateString('nl-NL')}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-900">{deelnemer.paard}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                {deelnemer.klasse || 'Geen klasse'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {deelnemer.weh_lid ? (
                                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                  ✓ Ja
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                                  - Nee
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={!!stalToewijzingen[deelnemer.id]}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setStalToewijzingen(prev => ({
                                        ...prev,
                                        [deelnemer.id]: { stalnummer: "" }
                                      }));
                                    } else {
                                      setStalToewijzingen(prev => {
                                        const next = { ...prev };
                                        delete next[deelnemer.id];
                                        return next;
                                      });
                                    }
                                  }}
                                  className="rounded"
                                />
                                {stalToewijzingen[deelnemer.id] && (
                                  <input
                                    type="text"
                                    placeholder="Nr"
                                    value={stalToewijzingen[deelnemer.id]?.stalnummer || ""}
                                    onChange={(e) => {
                                      setStalToewijzingen(prev => ({
                                        ...prev,
                                        [deelnemer.id]: { stalnummer: e.target.value }
                                      }));
                                    }}
                                    className="border rounded px-2 py-1 w-16 text-xs"
                                  />
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">
                                €{berekenInschrijfgeld(deelnemer, stalToewijzingen).toFixed(2)}
                              </div>
                              <div className="text-xs text-gray-500">
                                Basis: €{deelnemer.weh_lid ? TARIEVEN.base.weh_lid : TARIEVEN.base.niet_weh_lid}
                                {stalToewijzingen[deelnemer.id] && ' + stal'}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-gray-900 max-w-xs">
                                {formatOmroeper(deelnemer)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {deelnemer.opmerkingen ? (
                                <div className="text-sm text-gray-900 max-w-xs">
                                  {deelnemer.opmerkingen}
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">Geen opmerkingen</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-gray-900">{deelnemer.email}</div>
                              {deelnemer.telefoon && (
                                <div className="text-xs text-gray-500">{deelnemer.telefoon}</div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tarieven Info */}
            <div className="mt-6 bg-blue-50 rounded-lg p-4 border">
              <h4 className="font-semibold text-blue-900 mb-2">Tarieven Informatie</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium text-blue-800">Inschrijfgeld:</div>
                  <div className="text-blue-700">WEH Leden: €{TARIEVEN.base.weh_lid}</div>
                  <div className="text-blue-700">Niet-leden: €{TARIEVEN.base.niet_weh_lid}</div>
                </div>
                <div>
                  <div className="font-medium text-blue-800">Stal kosten:</div>
                  <div className="text-blue-700">Per dag: €{TARIEVEN.stal.per_dag}</div>
                  <div className="text-blue-700">Per nacht: €{TARIEVEN.stal.per_nacht}</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Container>
  );
}