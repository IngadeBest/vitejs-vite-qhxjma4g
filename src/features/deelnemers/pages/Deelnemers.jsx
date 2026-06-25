import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";
import { supabase } from "@/lib/supabaseClient";
import Container from "@/ui/Container";
import { useWedstrijdContext } from "@/features/wedstrijden/context/WedstrijdContext";
import "./Deelnemers.css";

const DEFAULT_TARIEVEN = {
  base: {
    standaard: 45.0,
    weh_korting: 2.5,
  },
  stal: {
    per_dag: 15.0,
    per_nacht: 25.0,
  },
};

const TARIEVEN_STORAGE_KEY = "deelnemers_tarieven_v1";
const DUBBELEN_REVIEWED_KEY = "deelnemers_dubbelen_reviewed_v1";
const STAL_TOEWIJZINGEN_KEY = "deelnemers_stal_toewijzingen_v1";

const formatOmroeper = (deelnemer) => {
  const { ruiter, paard, omroeper } = deelnemer;
  if (omroeper && omroeper.trim()) return omroeper;
  return `${ruiter || "Ruiter"} met ${paard || "paard"}`;
};

const loadTarieven = (wedstrijdId) => {
  try {
    const raw = localStorage.getItem(TARIEVEN_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data[wedstrijdId] || null;
  } catch (err) {
    console.warn("Kon tarieven niet laden", err);
    return null;
  }
};

const persistTarieven = (wedstrijdId, tarieven) => {
  try {
    const raw = localStorage.getItem(TARIEVEN_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data[wedstrijdId] = tarieven;
    localStorage.setItem(TARIEVEN_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Kon tarieven niet opslaan", err);
  }
};

export default function Deelnemers() {
  const location = useLocation();
  const { items: wedstrijden, loading: wedstrijdenLoading } = useWedstrijden();
  const { selectedWedstrijdId: appSelectedWedstrijdId, selectedWedstrijd: appSelectedWedstrijd } = useWedstrijdContext();

  const [wedstrijd, setWedstrijd] = useState(null);
  const [deelnemers, setDeelnemers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [zoekterm, setZoekterm] = useState("");
  const [filterKlasse, setFilterKlasse] = useState("");
  const [filterStatus, setFilterStatus] = useState("actief");
  const [filterWehLid, setFilterWehLid] = useState("");

  const [tarieven, setTarieven] = useState(DEFAULT_TARIEVEN);
  const [gecontroleerdeDubbelen, setGecontroleerdeDubbelen] = useState(new Set());
  const [stalToewijzingen, setStalToewijzingen] = useState({});

  const [editDeelnemerId, setEditDeelnemerId] = useState(null);
  const [editForm, setEditForm] = useState({ klasse: "", paard: "" });

  const [actieMelding, setActieMelding] = useState("");
  const [actieFout, setActieFout] = useState("");
  const [actieBusyId, setActieBusyId] = useState(null);

  useEffect(() => {
    const wedstrijdId = location?.state?.wedstrijdId || appSelectedWedstrijdId;
    if (!wedstrijdId || !Array.isArray(wedstrijden) || wedstrijden.length === 0) return;

    const geselecteerd = wedstrijden.find((w) => w.id === wedstrijdId);
    if (!geselecteerd) return;

    setWedstrijd((current) => (current?.id === geselecteerd.id ? current : geselecteerd));
  }, [location?.state, appSelectedWedstrijdId, wedstrijden]);

  useEffect(() => {
    if (!wedstrijd && appSelectedWedstrijd) {
      setWedstrijd(appSelectedWedstrijd);
    }
  }, [appSelectedWedstrijd, wedstrijd]);

  useEffect(() => {
    if (!wedstrijd) {
      setDeelnemers([]);
      setTarieven(DEFAULT_TARIEVEN);
      return;
    }
    loadDeelnemers();
  }, [wedstrijd]);

  useEffect(() => {
    if (!wedstrijd) return;
    const stored = loadTarieven(wedstrijd.id);
    setTarieven(stored || DEFAULT_TARIEVEN);
  }, [wedstrijd]);

  useEffect(() => {
    if (!wedstrijd) {
      setGecontroleerdeDubbelen(new Set());
      return;
    }

    try {
      const raw = localStorage.getItem(DUBBELEN_REVIEWED_KEY);
      const data = raw ? JSON.parse(raw) : {};
      const ids = Array.isArray(data[wedstrijd.id]) ? data[wedstrijd.id] : [];
      setGecontroleerdeDubbelen(new Set(ids));
    } catch (err) {
      console.warn("Kon gecontroleerde dubbelen niet laden", err);
      setGecontroleerdeDubbelen(new Set());
    }
  }, [wedstrijd]);

  useEffect(() => {
    if (!wedstrijd) {
      setStalToewijzingen({});
      return;
    }

    try {
      const raw = localStorage.getItem(STAL_TOEWIJZINGEN_KEY);
      const data = raw ? JSON.parse(raw) : {};
      setStalToewijzingen(data[wedstrijd.id] || {});
    } catch (err) {
      console.warn("Kon stal toewijzingen niet laden", err);
      setStalToewijzingen({});
    }
  }, [wedstrijd]);

  useEffect(() => {
    if (!wedstrijd) return;
    try {
      const raw = localStorage.getItem(STAL_TOEWIJZINGEN_KEY);
      const data = raw ? JSON.parse(raw) : {};
      data[wedstrijd.id] = stalToewijzingen;
      localStorage.setItem(STAL_TOEWIJZINGEN_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn("Kon stal toewijzingen niet opslaan", err);
    }
  }, [wedstrijd, stalToewijzingen]);

  useEffect(() => {
    if (!wedstrijd) return;
    persistTarieven(wedstrijd.id, tarieven);
  }, [wedstrijd, tarieven]);

  const loadDeelnemers = async () => {
    if (!wedstrijd) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: dbError } = await supabase
        .from("inschrijvingen")
        .select(`
          id,
          created_at,
          wedstrijd_id,
          deelnemer_status,
          afgemeld_at,
          afgemeld_reden,
          klasse,
          weh_lid,
          ruiter,
          paard,
          email,
          telefoon,
          omroeper,
          opmerkingen,
          wedstrijden(naam, datum)
        `)
        .eq("wedstrijd_id", wedstrijd.id)
        .order("created_at", { ascending: true });

      if (dbError) throw dbError;
      setDeelnemers(data || []);
    } catch (err) {
      console.error("Fout bij laden deelnemers:", err);
      setError("Kon deelnemers niet laden: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const gefilterde = deelnemers.filter((d) => {
    const term = zoekterm.trim().toLowerCase();
    if (term) {
      const haystack = [d.ruiter, d.paard, d.klasse, d.email, d.telefoon, d.omroeper, d.opmerkingen]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }

    if (filterKlasse && d.klasse !== filterKlasse) return false;

    const status = d.deelnemer_status || "actief";
    if (filterStatus === "actief" && status !== "actief") return false;
    if (filterStatus === "afgemeld" && status !== "afgemeld") return false;

    if (filterWehLid === "ja" && !d.weh_lid) return false;
    if (filterWehLid === "nee" && d.weh_lid) return false;

    return true;
  });

  const dubbeleGroepen = useMemo(() => {
    const groepen = new Map();
    for (const d of deelnemers) {
      if ((d.deelnemer_status || "actief") !== "actief") continue;
      if (gecontroleerdeDubbelen.has(d.id)) continue;
      const emailKey = (d.email || "").trim().toLowerCase();
      if (!emailKey || !d.klasse) continue;
      const key = `${d.wedstrijd_id}__${d.klasse}__${emailKey}`;
      const lijst = groepen.get(key) || [];
      lijst.push(d);
      groepen.set(key, lijst);
    }
    return Array.from(groepen.values())
      .filter((groep) => groep.length > 1)
      .map((groep) => [...groep].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
  }, [deelnemers, gecontroleerdeDubbelen]);

  const dubbeleIds = useMemo(() => {
    const ids = new Set();
    dubbeleGroepen.forEach((groep) => {
      groep.forEach((d) => ids.add(d.id));
    });
    return ids;
  }, [dubbeleGroepen]);

  const startEdit = (deelnemer) => {
    setActieFout("");
    setActieMelding("");
    setEditDeelnemerId(deelnemer.id);
    setEditForm({
      klasse: deelnemer.klasse || "",
      paard: deelnemer.paard || "",
    });
  };

  const cancelEdit = () => {
    setEditDeelnemerId(null);
    setEditForm({ klasse: "", paard: "" });
  };

  const saveEdit = async (deelnemer) => {
    const nieuweKlasse = editForm.klasse.trim();
    const nieuwPaard = editForm.paard.trim();

    if (!nieuweKlasse || !nieuwPaard) {
      setActieFout("Klasse en paard zijn verplicht.");
      return;
    }

    setActieBusyId(deelnemer.id);
    setActieFout("");
    setActieMelding("");

    try {
      const { error: dbError } = await supabase
        .from("inschrijvingen")
        .update({ klasse: nieuweKlasse, paard: nieuwPaard })
        .eq("id", deelnemer.id);

      if (dbError) throw dbError;

      setActieMelding(`Gegevens bijgewerkt voor ${deelnemer.ruiter}.`);
      cancelEdit();
      await loadDeelnemers();
    } catch (err) {
      setActieFout(`Bijwerken mislukt: ${err.message}`);
    } finally {
      setActieBusyId(null);
    }
  };

  const afmeldenDeelnemer = async (deelnemer) => {
    if (!confirm(`Inschrijving van ${deelnemer.ruiter} afmelden?`)) {
      return;
    }

    setActieBusyId(deelnemer.id);
    setActieFout("");
    setActieMelding("");

    try {
      const { error: dbError } = await supabase
        .from("inschrijvingen")
        .update({
          deelnemer_status: "afgemeld",
          afgemeld_at: new Date().toISOString(),
          afgemeld_reden: "Afgemeld via deelnemersbeheer",
        })
        .eq("id", deelnemer.id);

      if (dbError) throw dbError;

      const { data: wachtlijstKandidaten, error: wachtlijstError } = await supabase
        .from("wachtlijst")
        .select("*")
        .eq("wedstrijd_id", deelnemer.wedstrijd_id)
        .eq("klasse", deelnemer.klasse)
        .order("created_at", { ascending: true })
        .limit(1);

      if (wachtlijstError) throw wachtlijstError;

      const kandidaat = wachtlijstKandidaten?.[0] || null;
      if (kandidaat) {
        const wilPromoten = confirm(
          `Er staat iemand op de wachtlijst voor ${deelnemer.klasse}: ${kandidaat.ruiter}. Meteen promoveren naar deelnemer?`
        );

        if (wilPromoten) {
          const inschrijving = {
            wedstrijd_id: deelnemer.wedstrijd_id,
            wedstrijd: wedstrijd?.naam || null,
            klasse: kandidaat.klasse,
            weh_lid: kandidaat.weh_lid || false,
            ruiter: kandidaat.ruiter,
            paard: kandidaat.paard,
            leeftijd_ruiter: kandidaat.leeftijd_ruiter,
            geslacht_paard: kandidaat.geslacht_paard,
            email: kandidaat.email,
            telefoon: kandidaat.telefoon,
            opmerkingen: kandidaat.opmerkingen,
            omroeper: kandidaat.omroeper,
            rubriek: "Algemeen",
          };

          const { error: insertError } = await supabase.from("inschrijvingen").insert(inschrijving);
          if (insertError) throw insertError;

          const { error: delWaitError } = await supabase.from("wachtlijst").delete().eq("id", kandidaat.id);
          if (delWaitError) throw delWaitError;

          setActieMelding(
            `${deelnemer.ruiter} is afgemeld. ${kandidaat.ruiter} is gepromoveerd vanuit de wachtlijst.`
          );
        } else {
          setActieMelding(`${deelnemer.ruiter} is afgemeld.`);
        }
      } else {
        setActieMelding(`${deelnemer.ruiter} is afgemeld.`);
      }

      await loadDeelnemers();
    } catch (err) {
      setActieFout(`Afmelden mislukt: ${err.message}`);
    } finally {
      setActieBusyId(null);
    }
  };

  const heractiveerDeelnemer = async (deelnemer) => {
    setActieBusyId(deelnemer.id);
    setActieFout("");
    setActieMelding("");

    try {
      const { error: dbError } = await supabase
        .from("inschrijvingen")
        .update({
          deelnemer_status: "actief",
          afgemeld_at: null,
          afgemeld_reden: null,
        })
        .eq("id", deelnemer.id);

      if (dbError) throw dbError;

      setActieMelding(`${deelnemer.ruiter} is weer actief gemaakt.`);
      await loadDeelnemers();
    } catch (err) {
      setActieFout(`Heractiveren mislukt: ${err.message}`);
    } finally {
      setActieBusyId(null);
    }
  };

  const markeerDubbelGecontroleerd = (deelnemer) => {
    if (!wedstrijd) return;

    const emailKey = (deelnemer.email || "").trim().toLowerCase();
    if (!emailKey || !deelnemer.klasse) return;

    const idsVanGroep = deelnemers
      .filter((d) => {
        const dEmail = (d.email || "").trim().toLowerCase();
        return (
          d.wedstrijd_id === deelnemer.wedstrijd_id &&
          d.klasse === deelnemer.klasse &&
          dEmail === emailKey
        );
      })
      .map((d) => d.id);

    const nextSet = new Set(gecontroleerdeDubbelen);
    idsVanGroep.forEach((id) => nextSet.add(id));
    setGecontroleerdeDubbelen(nextSet);

    try {
      const raw = localStorage.getItem(DUBBELEN_REVIEWED_KEY);
      const data = raw ? JSON.parse(raw) : {};
      data[wedstrijd.id] = Array.from(nextSet);
      localStorage.setItem(DUBBELEN_REVIEWED_KEY, JSON.stringify(data));
      setActieMelding(`Dubbelcontrole opgeslagen voor ${deelnemer.ruiter}.`);
      setActieFout("");
    } catch (err) {
      console.warn("Kon dubbelcontrole niet opslaan", err);
    }
  };

  const stats = {
    totaal: deelnemers.length,
    actief: deelnemers.filter((d) => (d.deelnemer_status || "actief") === "actief").length,
    afgemeld: deelnemers.filter((d) => (d.deelnemer_status || "actief") === "afgemeld").length,
    zichtbaar: gefilterde.length,
  };

  const toggleStal = (deelnemerId) => {
    setStalToewijzingen((prev) => {
      const next = { ...prev };
      if (next[deelnemerId]?.heeftStal) {
        delete next[deelnemerId];
      } else {
        next[deelnemerId] = { heeftStal: true, stalnummer: "" };
      }
      return next;
    });
  };

  const setStalnummer = (deelnemerId, stalnummer) => {
    setStalToewijzingen((prev) => ({
      ...prev,
      [deelnemerId]: {
        heeftStal: true,
        stalnummer,
      },
    }));
  };

  const klassen = [...new Set(deelnemers.map((d) => d.klasse).filter(Boolean))].sort();

  const renderStatusBadge = (deelnemer) => {
    const isAfgemeld = (deelnemer.deelnemer_status || "actief") === "afgemeld";
    return (
      <span className={`dm-badge ${isAfgemeld ? "dm-badge-red" : "dm-badge-green"}`}>
        {isAfgemeld ? "Afgemeld" : "Actief"}
      </span>
    );
  };

  if (wedstrijdenLoading) {
    return (
      <Container>
        <div className="dm-loading">Wedstrijden laden...</div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="dm-page">
        <section className="dm-hero">
          <div>
            <h1>Deelnemers Beheerdashboard</h1>
            <p>Deelnemers beheren, muteren en afmelden op één plek.</p>
          </div>
          <div className="dm-hero-actions">
            <Link to="/wedstrijden" className="dm-btn dm-btn-ghost">
              Naar Wedstrijden
            </Link>
            <button
              type="button"
              onClick={loadDeelnemers}
              disabled={!wedstrijd || loading}
              className="dm-btn dm-btn-ghost"
            >
              Vernieuwen
            </button>
            <Link to="/wachtlijst" className="dm-btn dm-btn-ghost">
              Naar Wachtlijst
            </Link>
            <Link to="/startlijst" className="dm-btn dm-btn-ghost">
              Naar Startlijst
            </Link>
          </div>
        </section>

        <section className="dm-card">
          <div className="dm-row dm-row-bottom">
            <div className="dm-grow">
              <label>Wedstrijd</label>
              <select
                value={wedstrijd?.id || ""}
                onChange={(e) => {
                  const geselecteerd = wedstrijden.find((w) => w.id === e.target.value);
                  setWedstrijd(geselecteerd || null);
                }}
              >
                <option value="">Selecteer een wedstrijd...</option>
                {wedstrijden.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.naam} - {new Date(w.datum).toLocaleDateString("nl-NL")}
                  </option>
                ))}
              </select>
            </div>
            <div className="dm-inline-note">
              {wedstrijd ? `Je beheert nu: ${wedstrijd.naam}` : "Kies eerst een wedstrijd om deelnemers te beheren."}
            </div>
          </div>
        </section>

        {wedstrijd && (
          <details className="dm-card dm-details">
            <summary>Tarieven en stalinformatie</summary>
            <div className="dm-grid4">
              <div>
                <label>Standaard</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tarieven.base.standaard}
                  onChange={(e) =>
                    setTarieven((prev) => ({
                      ...prev,
                      base: { ...prev.base, standaard: Number(e.target.value) },
                    }))
                  }
                />
              </div>
              <div>
                <label>WEH korting</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tarieven.base.weh_korting}
                  onChange={(e) =>
                    setTarieven((prev) => ({
                      ...prev,
                      base: { ...prev.base, weh_korting: Number(e.target.value) },
                    }))
                  }
                />
              </div>
              <div>
                <label>Stal per dag</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tarieven.stal.per_dag}
                  onChange={(e) =>
                    setTarieven((prev) => ({
                      ...prev,
                      stal: { ...prev.stal, per_dag: Number(e.target.value) },
                    }))
                  }
                />
              </div>
              <div>
                <label>Stal per nacht</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tarieven.stal.per_nacht}
                  onChange={(e) =>
                    setTarieven((prev) => ({
                      ...prev,
                      stal: { ...prev.stal, per_nacht: Number(e.target.value) },
                    }))
                  }
                />
              </div>
            </div>
          </details>
        )}

        {wedstrijd && (
          <>
            <section className="dm-stats">
              <article className="dm-stat dm-stat-total">
                <div className="dm-stat-number">{stats.totaal}</div>
                <div className="dm-stat-label">Totaal</div>
              </article>
              <article className="dm-stat dm-stat-active">
                <div className="dm-stat-number">{stats.actief}</div>
                <div className="dm-stat-label">Actief</div>
              </article>
              <article className="dm-stat dm-stat-cancelled">
                <div className="dm-stat-number">{stats.afgemeld}</div>
                <div className="dm-stat-label">Afgemeld</div>
              </article>
              <article className="dm-stat dm-stat-visible">
                <div className="dm-stat-number">{stats.zichtbaar}</div>
                <div className="dm-stat-label">In huidige filter</div>
              </article>
            </section>

            {(actieMelding || actieFout) && (
              <section className="dm-stack">
                {actieMelding && <div className="dm-alert dm-alert-success">{actieMelding}</div>}
                {actieFout && <div className="dm-alert dm-alert-error">{actieFout}</div>}
              </section>
            )}

            <section className="dm-card">
              <div className="dm-row dm-row-between dm-row-bottom dm-wrap">
                <h3>Filters</h3>
                <button
                  type="button"
                  className="dm-btn dm-btn-ghost"
                  onClick={() => {
                    setZoekterm("");
                    setFilterKlasse("");
                    setFilterStatus("actief");
                    setFilterWehLid("");
                  }}
                >
                  Reset filters
                </button>
              </div>

              <div className="dm-filters">
                <div className="dm-filter dm-filter-search">
                  <label>Zoeken</label>
                  <input
                    type="text"
                    value={zoekterm}
                    onChange={(e) => setZoekterm(e.target.value)}
                    placeholder="Ruiter, paard, email, tel..."
                  />
                </div>
                <div className="dm-filter">
                  <label>Klasse</label>
                  <select value={filterKlasse} onChange={(e) => setFilterKlasse(e.target.value)}>
                    <option value="">Alle klassen</option>
                    {klassen.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="dm-filter">
                  <label>Status</label>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="actief">Alleen actief</option>
                    <option value="afgemeld">Alleen afgemeld</option>
                    <option value="alles">Alles</option>
                  </select>
                </div>
                <div className="dm-filter">
                  <label>WEH Lid</label>
                  <select value={filterWehLid} onChange={(e) => setFilterWehLid(e.target.value)}>
                    <option value="">Alle deelnemers</option>
                    <option value="ja">Alleen WEH leden</option>
                    <option value="nee">Alleen niet-leden</option>
                  </select>
                </div>
              </div>
            </section>

            {loading ? (
              <div className="dm-loading">Deelnemers laden...</div>
            ) : error ? (
              <div className="dm-alert dm-alert-error">
                <p>{error}</p>
                <button className="dm-btn dm-btn-danger" onClick={loadDeelnemers}>
                  Opnieuw proberen
                </button>
              </div>
            ) : (
              <section className="dm-card dm-table-card">
                <div className="dm-row dm-row-between dm-row-bottom">
                  <h3>Deelnemers ({gefilterde.length})</h3>
                </div>

                {gefilterde.length === 0 ? (
                  <div className="dm-empty">Geen deelnemers gevonden met de huidige filters</div>
                ) : (
                  <>
                    <div className="dm-table-wrap">
                      <table className="dm-table">
                        <thead>
                          <tr>
                            <th>Ruiter</th>
                            <th>Paard</th>
                            <th>Klasse</th>
                            <th>Status</th>
                            <th>Stal</th>
                            <th>Opmerkingen</th>
                            <th>Contact</th>
                            <th>Acties</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gefilterde.map((deelnemer, idx) => (
                            <tr key={deelnemer.id || idx}>
                              <td>
                                <div className="dm-cell-title">{deelnemer.ruiter}</div>
                                <div className="dm-cell-sub">
                                  Ingeschreven: {new Date(deelnemer.created_at).toLocaleDateString("nl-NL")}
                                </div>
                              </td>
                              <td>
                                <div className="dm-cell-title">{deelnemer.paard || "Onbekend paard"}</div>
                                {deelnemer.weh_lid && <div className="dm-cell-sub dm-ok">WEH lid</div>}
                              </td>
                              <td>
                                <span className="dm-badge dm-badge-blue">{deelnemer.klasse || "Geen klasse"}</span>
                                {dubbeleIds.has(deelnemer.id) && (
                                  <span className="dm-badge dm-badge-amber">Mogelijk dubbel</span>
                                )}
                              </td>
                              <td>{renderStatusBadge(deelnemer)}</td>
                              <td>
                                {stalToewijzingen[deelnemer.id]?.heeftStal ? (
                                  <div className="dm-stal-cell">
                                    <span className="dm-badge dm-badge-green">Ja</span>
                                    <input
                                      type="text"
                                      value={stalToewijzingen[deelnemer.id]?.stalnummer || ""}
                                      onChange={(e) => setStalnummer(deelnemer.id, e.target.value)}
                                      placeholder="Stalnr"
                                    />
                                    <button
                                      type="button"
                                      className="dm-btn dm-btn-ghost"
                                      onClick={() => toggleStal(deelnemer.id)}
                                    >
                                      Verwijder
                                    </button>
                                  </div>
                                ) : (
                                  <div className="dm-stal-cell">
                                    <span className="dm-badge dm-badge-red">Nee</span>
                                    <button
                                      type="button"
                                      className="dm-btn dm-btn-ghost"
                                      onClick={() => toggleStal(deelnemer.id)}
                                    >
                                      Stal toewijzen
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td>
                                <div className="dm-cell-text">{deelnemer.opmerkingen || "Geen opmerkingen"}</div>
                                <div className="dm-cell-sub">Omroeper: {formatOmroeper(deelnemer)}</div>
                              </td>
                              <td>
                                {deelnemer.email ? (
                                  <a href={`mailto:${deelnemer.email}`}>{deelnemer.email}</a>
                                ) : (
                                  <span className="dm-cell-sub">Geen email</span>
                                )}
                                {deelnemer.telefoon && <div className="dm-cell-sub">{deelnemer.telefoon}</div>}
                              </td>
                              <td>
                                {editDeelnemerId === deelnemer.id ? (
                                  <div className="dm-edit-wrap">
                                    <div className="dm-edit-grid">
                                      <input
                                        type="text"
                                        value={editForm.klasse}
                                        onChange={(e) =>
                                          setEditForm((prev) => ({ ...prev, klasse: e.target.value }))
                                        }
                                        placeholder="Klasse"
                                      />
                                      <input
                                        type="text"
                                        value={editForm.paard}
                                        onChange={(e) =>
                                          setEditForm((prev) => ({ ...prev, paard: e.target.value }))
                                        }
                                        placeholder="Paard"
                                      />
                                    </div>
                                    <div className="dm-actions-row">
                                      <button
                                        type="button"
                                        onClick={() => saveEdit(deelnemer)}
                                        disabled={actieBusyId === deelnemer.id}
                                        className="dm-btn dm-btn-primary"
                                      >
                                        Opslaan
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelEdit}
                                        disabled={actieBusyId === deelnemer.id}
                                        className="dm-btn dm-btn-ghost"
                                      >
                                        Annuleren
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="dm-actions-row">
                                    {(deelnemer.deelnemer_status || "actief") === "actief" ? (
                                      <>
                                        {dubbeleIds.has(deelnemer.id) && (
                                          <button
                                            type="button"
                                            onClick={() => markeerDubbelGecontroleerd(deelnemer)}
                                            disabled={actieBusyId === deelnemer.id}
                                            className="dm-btn dm-btn-ghost"
                                          >
                                            Dubbel gecheckt
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => startEdit(deelnemer)}
                                          disabled={actieBusyId === deelnemer.id}
                                          className="dm-btn dm-btn-primary"
                                        >
                                          Wijzig
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => afmeldenDeelnemer(deelnemer)}
                                          disabled={actieBusyId === deelnemer.id}
                                          className="dm-btn dm-btn-danger"
                                        >
                                          Afmelden
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => heractiveerDeelnemer(deelnemer)}
                                        disabled={actieBusyId === deelnemer.id}
                                        className="dm-btn dm-btn-success"
                                      >
                                        Heractiveer
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="dm-mobile-list">
                      {gefilterde.map((deelnemer, idx) => (
                        <article className="dm-mobile-card" key={`mob-${deelnemer.id || idx}`}>
                          <div className="dm-mobile-head">
                            <div>
                              <div className="dm-cell-title">{deelnemer.ruiter}</div>
                              <div className="dm-cell-sub">{deelnemer.paard || "Onbekend paard"}</div>
                            </div>
                            <div>{renderStatusBadge(deelnemer)}</div>
                          </div>

                          <div className="dm-mobile-meta">
                            <span className="dm-badge dm-badge-blue">{deelnemer.klasse || "Geen klasse"}</span>
                            {deelnemer.weh_lid && <span className="dm-badge dm-badge-green">WEH</span>}
                            {dubbeleIds.has(deelnemer.id) && <span className="dm-badge dm-badge-amber">Mogelijk dubbel</span>}
                          </div>

                          <div className="dm-mobile-contact">
                            {deelnemer.email ? <a href={`mailto:${deelnemer.email}`}>{deelnemer.email}</a> : "Geen email"}
                            {deelnemer.telefoon && <div className="dm-cell-sub">{deelnemer.telefoon}</div>}
                          </div>

                          <div className="dm-mobile-stal">
                            <label>Stal</label>
                            {stalToewijzingen[deelnemer.id]?.heeftStal ? (
                              <div className="dm-stal-cell">
                                <span className="dm-badge dm-badge-green">Ja</span>
                                <input
                                  type="text"
                                  value={stalToewijzingen[deelnemer.id]?.stalnummer || ""}
                                  onChange={(e) => setStalnummer(deelnemer.id, e.target.value)}
                                  placeholder="Stalnr"
                                />
                                <button
                                  type="button"
                                  className="dm-btn dm-btn-ghost"
                                  onClick={() => toggleStal(deelnemer.id)}
                                >
                                  Verwijder
                                </button>
                              </div>
                            ) : (
                              <div className="dm-stal-cell">
                                <span className="dm-badge dm-badge-red">Nee</span>
                                <button
                                  type="button"
                                  className="dm-btn dm-btn-ghost"
                                  onClick={() => toggleStal(deelnemer.id)}
                                >
                                  Stal toewijzen
                                </button>
                              </div>
                            )}
                          </div>

                          {editDeelnemerId === deelnemer.id ? (
                            <div className="dm-edit-wrap">
                              <div className="dm-edit-grid">
                                <input
                                  type="text"
                                  value={editForm.klasse}
                                  onChange={(e) => setEditForm((prev) => ({ ...prev, klasse: e.target.value }))}
                                  placeholder="Klasse"
                                />
                                <input
                                  type="text"
                                  value={editForm.paard}
                                  onChange={(e) => setEditForm((prev) => ({ ...prev, paard: e.target.value }))}
                                  placeholder="Paard"
                                />
                              </div>
                              <div className="dm-actions-row">
                                <button
                                  type="button"
                                  onClick={() => saveEdit(deelnemer)}
                                  disabled={actieBusyId === deelnemer.id}
                                  className="dm-btn dm-btn-primary"
                                >
                                  Opslaan
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  disabled={actieBusyId === deelnemer.id}
                                  className="dm-btn dm-btn-ghost"
                                >
                                  Annuleren
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="dm-actions-row">
                              {(deelnemer.deelnemer_status || "actief") === "actief" ? (
                                <>
                                  {dubbeleIds.has(deelnemer.id) && (
                                    <button
                                      type="button"
                                      onClick={() => markeerDubbelGecontroleerd(deelnemer)}
                                      disabled={actieBusyId === deelnemer.id}
                                      className="dm-btn dm-btn-ghost"
                                    >
                                      Dubbel gecheckt
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => startEdit(deelnemer)}
                                    disabled={actieBusyId === deelnemer.id}
                                    className="dm-btn dm-btn-primary"
                                  >
                                    Wijzig
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => afmeldenDeelnemer(deelnemer)}
                                    disabled={actieBusyId === deelnemer.id}
                                    className="dm-btn dm-btn-danger"
                                  >
                                    Afmelden
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => heractiveerDeelnemer(deelnemer)}
                                  disabled={actieBusyId === deelnemer.id}
                                  className="dm-btn dm-btn-success"
                                >
                                  Heractiveer
                                </button>
                              )}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}

            <section className="dm-card dm-info">
              <h4>Tarieven Informatie</h4>
              <div className="dm-grid2">
                <div>
                  <div className="dm-cell-title">Inschrijfgeld</div>
                  <div>Standaard: €{tarieven.base.standaard}</div>
                  <div>
                    WEH leden: €{tarieven.base.standaard - tarieven.base.weh_korting} (korting: €
                    {tarieven.base.weh_korting})
                  </div>
                </div>
                <div>
                  <div className="dm-cell-title">Stal kosten</div>
                  <div>Per dag: €{tarieven.stal.per_dag}</div>
                  <div>Per nacht: €{tarieven.stal.per_nacht}</div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </Container>
  );
}
