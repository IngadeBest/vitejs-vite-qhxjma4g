import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";
import ProefEditor from "@/features/wedstrijden/components/ProefEditor";
import Container from "@/ui/Container";
import "./WedstrijdenBeheer.css";

const KLASSEN = [
  { code: "we0", label: "Introductieklasse (WE0)" },
  { code: "we1", label: "WE1" },
  { code: "we2", label: "WE2" },
  { code: "we2p", label: "WE2+" },
  { code: "we3", label: "WE3" },
  { code: "we4", label: "WE4" },
  { code: "yr", label: "Young Riders" },
  { code: "junior", label: "Junioren" },
];
const ONDERDELEN = [
  { code: "dressuur", label: "Dressuur" },
  { code: "stijl", label: "Stijltrail" },
  { code: "speed", label: "Speedtrail" },
];

const EMPTY_WEDSTRIJD = {
  naam: "",
  datum: "",
  locatie: "",
  status: "open",
  organisator_email: "",
};

const EMPTY_STARTLIJST_CONFIG = {
  dressuurStart: "",
  interval: 7,
  stijltrailStart: "",
  pauses: [],
};

function formatDateInput(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function hydrateWedstrijdForm(wedstrijd) {
  if (!wedstrijd) return { ...EMPTY_WEDSTRIJD };
  return {
    naam: wedstrijd.naam || "",
    datum: formatDateInput(wedstrijd.datum),
    locatie: wedstrijd.locatie || "",
    status: wedstrijd.status || "open",
    organisator_email: wedstrijd.organisator_email || "",
  };
}

function hydrateStartlijstConfig(wedstrijd) {
  if (!wedstrijd) {
    return {
      config: { ...EMPTY_STARTLIJST_CONFIG },
      jeugdAllowed: {},
      offsetOverridesText: "",
      capacitiesMap: {},
      alternatesMap: {},
      totaalMaximum: "",
      wachtlijstEnabled: false,
    };
  }

  try {
    const cfg = (wedstrijd.startlijst_config && typeof wedstrijd.startlijst_config === "object")
      ? wedstrijd.startlijst_config
      : (wedstrijd.startlijst_config ? JSON.parse(wedstrijd.startlijst_config) : null);

    const pauses = cfg?.pauses && !Array.isArray(cfg.pauses)
      ? cfg.pauses
      : { __default__: (Array.isArray(cfg?.pauses) ? cfg.pauses : []) };

    let stijltrailStart = cfg?.stijltrailStart || "";
    if (!stijltrailStart && (cfg?.trailOffset || cfg?.trailOffset === 0) && cfg?.dressuurStart) {
      try {
        const parts = String(cfg.dressuurStart).split(":").map((value) => Number(value));
        const baseDate = new Date();
        baseDate.setHours(parts[0] || 0, parts[1] || 0, 0, 0);
        const shifted = new Date(baseDate.getTime() + Number(cfg.trailOffset || 0) * 60000);
        stijltrailStart = shifted.toTimeString().slice(0, 5);
      } catch (error) {
        stijltrailStart = "";
      }
    }

    return {
      config: {
        dressuurStart: cfg?.dressuurStart || "",
        interval: cfg?.interval || 7,
        stijltrailStart,
        pauses,
      },
      jeugdAllowed: cfg?.jeugdAllowed || {},
      offsetOverridesText: cfg?.offsetOverrides ? JSON.stringify(cfg.offsetOverrides, null, 2) : "",
      capacitiesMap: cfg?.capacities && typeof cfg.capacities === "object" ? cfg.capacities : {},
      alternatesMap: cfg?.alternates && typeof cfg.alternates === "object" ? cfg.alternates : {},
      totaalMaximum: cfg?.totaalMaximum !== undefined && cfg?.totaalMaximum !== null ? String(cfg.totaalMaximum) : "",
      wachtlijstEnabled: !!wedstrijd.wachtlijst_enabled,
    };
  } catch (error) {
    return {
      config: { ...EMPTY_STARTLIJST_CONFIG },
      jeugdAllowed: {},
      offsetOverridesText: "",
      capacitiesMap: {},
      alternatesMap: {},
      totaalMaximum: "",
      wachtlijstEnabled: !!wedstrijd.wachtlijst_enabled,
    };
  }
}

export default function WedstrijdenBeheer() {
  const { items: wedstrijden, loading } = useWedstrijden(false);
  const [nieuw, setNieuw] = useState({ naam: "", datum: "", locatie: "", status: "open" });
  const [nieuwEmail, setNieuwEmail] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const gekozen = useMemo(() => wedstrijden.find(w => w.id === selectedId) || null, [selectedId, wedstrijden]);
  const [showNew, setShowNew] = useState(false);
  const [editForm, setEditForm] = useState(() => hydrateWedstrijdForm(null));

  const [cfg, setCfg] = useState({
    onderdeel: "dressuur",
    klasse: "we1",
    proef_naam: "",
    max_score: "",
    items_text: "",
  });

  const [msg, setMsg] = useState("");
  const [allowedKlassen, setAllowedKlassen] = useState([]);
  const [startlijstConfig, setStartlijstConfig] = useState({ ...EMPTY_STARTLIJST_CONFIG });
  const [jeugdAllowed, setJeugdAllowed] = useState({});
  const [offsetOverridesText, setOffsetOverridesText] = useState("");
  const [capacitiesMap, setCapacitiesMap] = useState({});
  const [alternatesMap, setAlternatesMap] = useState({});
  const [totaalMaximum, setTotaalMaximum] = useState("");
  const [wachtlijstEnabled, setWachtlijstEnabled] = useState(false);
  const [deleteRelated, setDeleteRelated] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("open");
  // migration SQL UI removed per user request

  useEffect(() => {
    if (!gekozen) {
      setEditForm(hydrateWedstrijdForm(null));
      setAllowedKlassen([]);
      setStartlijstConfig({ ...EMPTY_STARTLIJST_CONFIG });
      setJeugdAllowed({});
      setOffsetOverridesText("");
      setCapacitiesMap({});
      setAlternatesMap({});
      setTotaalMaximum("");
      setWachtlijstEnabled(false);
      return;
    }

    setEditForm(hydrateWedstrijdForm(gekozen));
    setAllowedKlassen(Array.isArray(gekozen.allowed_klassen) ? gekozen.allowed_klassen : []);

    const hydrated = hydrateStartlijstConfig(gekozen);
    setStartlijstConfig(hydrated.config);
    setJeugdAllowed(hydrated.jeugdAllowed);
    setOffsetOverridesText(hydrated.offsetOverridesText);
    setCapacitiesMap(hydrated.capacitiesMap);
    setAlternatesMap(hydrated.alternatesMap);
    setTotaalMaximum(hydrated.totaalMaximum);
    setWachtlijstEnabled(hydrated.wachtlijstEnabled);
  }, [gekozen]);

    

  async function addWedstrijd() {
    setMsg("");
    try {
      const { data, error } = await supabase.from("wedstrijden").insert({
        naam: nieuw.naam,
        datum: nieuw.datum || null,
        locatie: nieuw.locatie || null,
        status: nieuw.status || "open",
        organisator_email: nieuwEmail || null,
      }).select("id").single();
      if (error) throw error;
      setNieuw({ naam: "", datum: "", locatie: "", status: "open" });
      setMsg("Wedstrijd aangemaakt ✔️");
      setSelectedId(data.id);
    } catch (e) {
      setMsg("Fout: " + (e?.message || String(e)));
    }
  }

  async function saveWedstrijdDetails() {
    if (!gekozen) {
      setMsg("Kies eerst een wedstrijd.");
      return;
    }

    const payload = {
      naam: editForm.naam.trim(),
      datum: editForm.datum || null,
      locatie: editForm.locatie.trim() || null,
      status: editForm.status || "open",
      organisator_email: editForm.organisator_email.trim() || null,
    };

    if (!payload.naam) {
      setMsg("Geef een naam op voor de wedstrijd.");
      return;
    }

    setMsg("");
    try {
      const { error } = await supabase.from("wedstrijden").update(payload).eq("id", gekozen.id);
      if (error) throw error;
      setMsg("Wedstrijdgegevens opgeslagen ✔️");
      window.dispatchEvent(new Event("wedstrijden:refresh"));
    } catch (e) {
      setMsg("Opslaan mislukt: " + (e?.message || String(e)));
    }
  }

  async function deleteWedstrijd() {
    if (!gekozen) return;
    const confirmed = window.confirm(
      `Weet je zeker dat je de wedstrijd "${gekozen.naam}" wilt verwijderen?${
        deleteRelated ? "\n\nOok alle inschrijvingen, proeven en wachtlijstitems worden verwijderd." : ""
      }`
    );
    if (!confirmed) return;

    setMsg("");
    try {
      if (deleteRelated) {
        const { data: proevenData, error: proevenErr } = await supabase
          .from("proeven")
          .select("id")
          .eq("wedstrijd_id", gekozen.id);
        if (proevenErr) throw proevenErr;

        const proefIds = (proevenData || []).map((p) => p.id).filter(Boolean);
        if (proefIds.length) {
          const { error: itemsErr } = await supabase
            .from("proeven_items")
            .delete()
            .in("proef_id", proefIds);
          if (itemsErr) throw itemsErr;

          const { error: scoresErr } = await supabase
            .from("scores")
            .delete()
            .in("proef_id", proefIds);
          if (scoresErr && !/relation .*scores.* does not exist/i.test(String(scoresErr.message || scoresErr))) {
            throw scoresErr;
          }
        }

        const { error: proevenDelErr } = await supabase
          .from("proeven")
          .delete()
          .eq("wedstrijd_id", gekozen.id);
        if (proevenDelErr) throw proevenDelErr;

        const { error: inschrijvingenErr } = await supabase
          .from("inschrijvingen")
          .delete()
          .eq("wedstrijd_id", gekozen.id);
        if (inschrijvingenErr) throw inschrijvingenErr;

        const { error: wachtlijstErr } = await supabase
          .from("wachtlijst")
          .delete()
          .eq("wedstrijd_id", gekozen.id);
        if (wachtlijstErr) throw wachtlijstErr;
      }

      const { data: deletedRows, error: delErr } = await supabase
        .from("wedstrijden")
        .delete()
        .eq("id", gekozen.id)
        .select("id");
      if (delErr) throw delErr;
      if (!deletedRows || deletedRows.length === 0) {
        throw new Error("Geen rijen verwijderd. Controleer RLS/policies of je Supabase-omgeving.");
      }

      setSelectedId("");
      setMsg("Wedstrijd verwijderd ✔️");
      window.dispatchEvent(new Event("wedstrijden:refresh"));
    } catch (e) {
      setMsg("Verwijderen mislukt: " + (e?.message || String(e)));
    }
  }

  function copyLink() {
    if (!gekozen) return;
    // Ensure the link points to the public site (strip leading `app.` subdomain)
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const targetHost = host && host.startsWith('app.') ? host.replace(/^app\./, '') : host;
    const url = `${location.protocol}//${targetHost}/#/formulier?wedstrijdId=${gekozen.id}`;
    try { navigator.clipboard.writeText(url); setMsg("Link gekopieerd: " + url); }
    catch (e) { setMsg("Kopie mislukt, kopieer handmatig: " + url); }
  }

  function syncConfigFromSelected() {
    if (!gekozen) {
      setAllowedKlassen([]);
        setStartlijstConfig({ dressuurStart: '', interval: 7, stijltrailStart: '', pauses: [] });
      setSelectedStatus("open");
      // keep the new-form collapsed when no selection
      setShowNew(false);
      return;
    }
  // expected shape: gekozen.allowed_klassen (array)
  setAllowedKlassen(Array.isArray(gekozen.allowed_klassen) ? gekozen.allowed_klassen : []);
    // populate organisator email if present
    setNieuwEmail(gekozen.organisator_email || "");
    setSelectedStatus(gekozen.status || "open");
    // load startlijst_config if present
    try {
      const cfg = (gekozen.startlijst_config && typeof gekozen.startlijst_config === 'object') ? gekozen.startlijst_config : (gekozen.startlijst_config ? JSON.parse(gekozen.startlijst_config) : null);
      if (cfg) {
        // support both legacy array pauses and new object-shaped pauses
        const pauses = cfg.pauses && !Array.isArray(cfg.pauses) ? cfg.pauses : { ['__default__']: (Array.isArray(cfg.pauses) ? cfg.pauses : []) };
        // support legacy trailOffset by converting to stijltrailStart if necessary
        let stijl = cfg.stijltrailStart || '';
        if (!stijl && (cfg.trailOffset || cfg.trailOffset === 0) && cfg.dressuurStart) {
          // compute stijl start as dressuurStart + trailOffset minutes
          try {
            const parts = String(cfg.dressuurStart).split(':').map(s=>Number(s));
            const d = new Date();
            d.setHours(parts[0]||0, parts[1]||0, 0, 0);
            const t = new Date(d.getTime() + (Number(cfg.trailOffset||0) * 60000));
            stijl = t.toTimeString().slice(0,5);
          } catch(e) { stijl = ''; }
        }
        setStartlijstConfig({ dressuurStart: cfg.dressuurStart || '', interval: cfg.interval || 7, stijltrailStart: stijl, pauses });
        setJeugdAllowed(cfg.jeugdAllowed || {});
    setOffsetOverridesText(cfg.offsetOverrides ? JSON.stringify(cfg.offsetOverrides, null, 2) : '');
    setCapacitiesMap(cfg.capacities && typeof cfg.capacities === 'object' ? cfg.capacities : {});
    setAlternatesMap(cfg.alternates && typeof cfg.alternates === 'object' ? cfg.alternates : {});    setTotaalMaximum(cfg.totaalMaximum !== undefined && cfg.totaalMaximum !== null ? String(cfg.totaalMaximum) : '');        
    setWachtlijstEnabled(!!gekozen.wachtlijst_enabled);
    // ensure proef-editor default klasse is the first allowed class for this wedstrijd
        const allowed = Array.isArray(gekozen.allowed_klassen) && gekozen.allowed_klassen.length ? gekozen.allowed_klassen : (Array.isArray(cfg.allowed_klassen) ? cfg.allowed_klassen : []);
        if (allowed && allowed.length) {
          setCfg(s => ({ ...s, klasse: allowed[0] }));
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  // when selected changes, populate local config
  React.useEffect(() => {
    syncConfigFromSelected();
  }, [selectedId, wedstrijden]);

  async function saveProef() {
    setMsg("");
    if (!gekozen) return setMsg("Kies eerst een wedstrijd.");
    if (!cfg.proef_naam) return setMsg("Geef een naam voor de proef.");
    const maxInt = cfg.max_score ? parseInt(cfg.max_score, 10) : null;

    try {
      const { data: p, error: e1 } = await supabase.from("proeven")
        .insert({
          wedstrijd_id: gekozen.id,
          onderdeel: cfg.onderdeel,
          klasse: cfg.klasse,
          naam: cfg.proef_naam,
          max_score: maxInt
        })
        .select("id")
        .single();
      if (e1) throw e1;

      const rows = (cfg.items_text || "").split("\n").map(l => l.trim()).filter(Boolean);
      const items = rows.map((line, idx) => {
        if (cfg.onderdeel === "dressuur") {
          const parts = line.split("|").map(s=>s.trim());
          return {
            proef_id: p.id, nr: idx+1,
            omschrijving: parts[0] || line,
            max_punt: parts[1] ? parseInt(parts[1],10) : null,
            coeff: parts[2] ? parseInt(parts[2],10) : 1
          };
        } else {
          return { proef_id: p.id, nr: idx+1, omschrijving: line, max_punt: null, coeff: 1 };
        }
      });
      if (items.length) {
        const { error: e2 } = await supabase.from("proeven_items").insert(items);
        if (e2) throw e2;
      }
      setMsg("Proef + onderdelen opgeslagen ✔️");
    } catch (e) {
      setMsg("Opslaan mislukt: " + (e?.message || String(e)));
    }
  }

  async function saveWedstrijdConfig() {
    setMsg("");
    if (!gekozen) return setMsg("Kies eerst een wedstrijd.");
    try {
      const payload = {
        allowed_klassen: allowedKlassen,
        organisator_email: editForm.organisator_email || null,
        status: editForm.status || "open",
        wachtlijst_enabled: wachtlijstEnabled || false,
          startlijst_config: {
          dressuurStart: startlijstConfig.dressuurStart || null,
          interval: startlijstConfig.interval || 7,
          stijltrailStart: startlijstConfig.stijltrailStart || null,
          pauses: startlijstConfig.pauses || {},
          jeugdAllowed: jeugdAllowed || {},
          offsetOverrides: (() => {
            try { return offsetOverridesText ? JSON.parse(offsetOverridesText) : {}; } catch(e) { return {}; }
          })(),
          capacities: capacitiesMap || {},
          alternates: alternatesMap || {},
          totaalMaximum: totaalMaximum !== '' ? Number(totaalMaximum) : null
        }
      };
      const { error } = await supabase.from("wedstrijden").update(payload).eq("id", gekozen.id);
      if (error) throw error;
  setMsg("Wedstrijd instellingen opgeslagen ✔️");
  // notify other parts of the app to refresh wedstrijden
  window.dispatchEvent(new Event('wedstrijden:refresh'));
    } catch (e) {
      // likely column doesn't exist — instruct admin to run DB migration
      const em = (e?.message || String(e));
      const hint = "Controleer of de kolom 'allowed_klassen' bestaat in de tabel 'wedstrijden'.";
  setMsg("Opslaan mislukt: " + em + " — " + hint);
    }
  }

    return (
      <div className="wb-page-shell">
        <Container maxWidth={1280} className="wb-container">
          <section className="wb-hero">
            <div>
              <h1>Wedstrijden beheer</h1>
              <p>Aanmaken, bewerken en configureren van wedstrijden op één plek.</p>
            </div>
            <div className="wb-hero-actions">
              <button type="button" className="wp-btn secondary" onClick={() => setShowNew((value) => !value)}>
                {showNew ? "Nieuwe wedstrijd verbergen" : "Nieuwe wedstrijd"}
              </button>
              <button type="button" className="wp-btn secondary" onClick={() => window.dispatchEvent(new Event("wedstrijden:refresh"))} disabled={loading}>
                Vernieuwen
              </button>
            </div>
          </section>

          {msg && (
            <div className={`wb-alert ${msg.toLowerCase().includes("mislukt") || msg.toLowerCase().includes("fout") ? "wb-alert-error" : "wb-alert-success"}`}>
              {msg}
            </div>
          )}

          <section className="wb-grid wb-grid-2">
            <article className="wb-card">
              <div className="wb-card-head">
                <div>
                  <h2>Nieuwe wedstrijd</h2>
                  <p>Maak een wedstrijd aan en ga direct verder met bewerken.</p>
                </div>
              </div>
              {showNew && (
                <div className="wb-form-grid">
                  <div>
                    <label>Naam</label>
                    <input className="wp-input" placeholder="Naam*" value={nieuw.naam} onChange={(e) => setNieuw((s) => ({ ...s, naam: e.target.value }))} />
                  </div>
                  <div>
                    <label>Datum</label>
                    <input className="wp-input" type="date" value={nieuw.datum} onChange={(e) => setNieuw((s) => ({ ...s, datum: e.target.value }))} />
                  </div>
                  <div>
                    <label>Locatie</label>
                    <input className="wp-input" placeholder="Locatie" value={nieuw.locatie} onChange={(e) => setNieuw((s) => ({ ...s, locatie: e.target.value }))} />
                  </div>
                  <div>
                    <label>Organisator e-mail</label>
                    <input className="wp-input" type="email" placeholder="organisator@example.com" value={nieuwEmail} onChange={(e) => setNieuwEmail(e.target.value)} />
                  </div>
                  <div>
                    <label>Status</label>
                    <select className="wp-input" value={nieuw.status} onChange={(e) => setNieuw((s) => ({ ...s, status: e.target.value }))}>
                      <option value="open">open</option>
                      <option value="gesloten">gesloten</option>
                      <option value="archief">archief</option>
                    </select>
                  </div>
                  <div className="wb-form-actions">
                    <button type="button" className="wp-btn" onClick={addWedstrijd} disabled={!nieuw.naam}>Aanmaken</button>
                  </div>
                </div>
              )}
            </article>

            <article className="wb-card">
              <div className="wb-card-head">
                <div>
                  <h2>Selecteer wedstrijd</h2>
                  <p>Kies een bestaande wedstrijd om gegevens, proeven en instellingen te beheren.</p>
                </div>
                <button type="button" className="wp-btn secondary" onClick={copyLink} disabled={!gekozen}>Kopieer inschrijflink</button>
              </div>
              <div className="wb-form-grid wb-form-grid-select">
                <div className="wb-span-2">
                  <label>Wedstrijd</label>
                  <select className="wp-input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} disabled={loading}>
                    <option value="">{loading ? "Laden..." : "— kies wedstrijd —"}</option>
                    {wedstrijden.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.naam} {w.datum ? `(${w.datum})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="wb-inline-note wb-span-2">
                  {gekozen ? `Je beheert nu: ${gekozen.naam}` : "Selecteer een wedstrijd om de bewerk- en configuratiekaarten te tonen."}
                </div>
              </div>
            </article>
          </section>

          {gekozen ? (
            <>
              <section className="wb-grid wb-grid-2">
                <article className="wb-card">
                  <div className="wb-card-head">
                    <div>
                      <h2>Wedstrijdgegevens</h2>
                      <p>Bewerk naam, datum, locatie en status na het aanmaken.</p>
                    </div>
                  </div>
                  <div className="wb-form-grid">
                    <div>
                      <label>Naam</label>
                      <input className="wp-input" value={editForm.naam} onChange={(e) => setEditForm((s) => ({ ...s, naam: e.target.value }))} />
                    </div>
                    <div>
                      <label>Datum</label>
                      <input className="wp-input" type="date" value={editForm.datum} onChange={(e) => setEditForm((s) => ({ ...s, datum: e.target.value }))} />
                    </div>
                    <div>
                      <label>Locatie</label>
                      <input className="wp-input" value={editForm.locatie} onChange={(e) => setEditForm((s) => ({ ...s, locatie: e.target.value }))} />
                    </div>
                    <div>
                      <label>Organisator e-mail</label>
                      <input className="wp-input" type="email" value={editForm.organisator_email} onChange={(e) => setEditForm((s) => ({ ...s, organisator_email: e.target.value }))} />
                    </div>
                    <div>
                      <label>Status</label>
                      <select className="wp-input" value={editForm.status} onChange={(e) => setEditForm((s) => ({ ...s, status: e.target.value }))}>
                        <option value="open">open</option>
                        <option value="gesloten">gesloten</option>
                        <option value="archief">archief</option>
                      </select>
                    </div>
                    <div className="wb-form-actions">
                      <button type="button" className="wp-btn" onClick={saveWedstrijdDetails} disabled={!gekozen || !editForm.naam.trim()}>
                        Wijzigingen opslaan
                      </button>
                    </div>
                  </div>
                </article>

                <article className="wb-card">
                  <div className="wb-card-head">
                    <div>
                      <h2>Wedstrijdacties</h2>
                      <p>Beheer toegangsopties en verwijder alleen wanneer je zeker bent.</p>
                    </div>
                  </div>
                  <div className="wb-stack">
                    <div className="wb-inline-note">
                      <strong>{gekozen.naam}</strong><br />
                      {gekozen.datum ? `Datum: ${gekozen.datum}` : "Geen datum ingesteld"}
                    </div>
                    <label className="wb-check-row wb-check-card">
                      <input type="checkbox" checked={deleteRelated} onChange={(e) => setDeleteRelated(e.target.checked)} />
                      <span>Ook inschrijvingen, proeven en wachtlijst verwijderen</span>
                    </label>
                    <div className="wb-actions-row">
                      <button type="button" className="wp-btn secondary" onClick={() => setEditForm((current) => ({ ...current, status: gekozen.status || "open" }))}>
                        Status terugzetten
                      </button>
                      <button type="button" className="wp-btn wb-btn-danger" onClick={deleteWedstrijd}>Verwijder wedstrijd</button>
                    </div>
                  </div>
                </article>
              </section>

              <section className="wb-card">
                <div className="wb-card-head">
                  <div>
                    <h2>Toegestane klassen en limieten</h2>
                    <p>Stel wedstrijdbreed gedrag in voor inschrijven, startlijst en wachtlijst.</p>
                  </div>
                  <div className="wb-actions-row">
                    <button type="button" className="wp-btn secondary" onClick={() => setAllowedKlassen(KLASSEN.map(k => k.code))}>Selecteer alles</button>
                    <button type="button" className="wp-btn secondary" onClick={() => setAllowedKlassen([])}>Reset</button>
                  </div>
                </div>

                <div className="wb-two-col">
                  <div>
                    <h3>Toegestane klassen</h3>
                    <div className="wb-checklist">
                      {KLASSEN.map((k) => {
                        const checked = allowedKlassen.includes(k.code);
                        return (
                          <label key={k.code} className="wb-check-row">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setAllowedKlassen((s) => e.target.checked ? Array.from(new Set([...s, k.code])) : s.filter((x) => x !== k.code));
                              }}
                            />
                            <span>{k.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="wb-stack">
                    <div>
                      <label>Wachtlijst inschakelen</label>
                      <label className="wb-check-row wb-check-card">
                        <input type="checkbox" checked={wachtlijstEnabled} onChange={(e) => setWachtlijstEnabled(e.target.checked)} />
                        <span>Gebruik een wachtlijst wanneer de wedstrijd of een klasse vol is.</span>
                      </label>
                    </div>

                    <div>
                      <label>Totaal maximum deelnemers</label>
                      <input className="wp-input" type="number" min={0} placeholder="Geen limiet" value={totaalMaximum} onChange={(e) => setTotaalMaximum(e.target.value)} />
                    </div>

                    <div>
                      <label>Offset overrides</label>
                      <textarea className="wb-textarea" rows={4} value={offsetOverridesText} onChange={(e) => setOffsetOverridesText(e.target.value)} placeholder='{"we2:jeugd":801, "we0:senior":5}' />
                    </div>
                  </div>
                </div>

                <div className="wb-divider" />

                <div className="wb-two-col">
                  <div>
                    <h3>Jeugd-rubriek</h3>
                    <div className="wb-checklist">
                      {KLASSEN.map((k) => (
                        <label key={`jeugd-${k.code}`} className="wb-check-row">
                          <input type="checkbox" checked={!!jeugdAllowed[k.code]} onChange={(e) => { setJeugdAllowed(prev => ({ ...prev, [k.code]: e.target.checked })); }} />
                          <span>{k.label} - jeugd toegestaan</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3>Capaciteiten & alternatieven</h3>
                    <div className="wb-capacity-grid wb-capacity-grid-head">
                      <div>Klasse</div>
                      <div>Capaciteit</div>
                      <div>Alternatief</div>
                    </div>
                    <div className="wb-capacity-list">
                      {KLASSEN.map((k) => (
                        <div key={k.code} className="wb-capacity-grid">
                          <div>{k.label}</div>
                          <div>
                            <input
                              className="wp-input"
                              type="number"
                              min={0}
                              placeholder="Geen limiet"
                              value={capacitiesMap[k.code] ?? ""}
                              onChange={(e) => {
                                const v = e.target.value === "" ? undefined : Number(e.target.value);
                                setCapacitiesMap((prev) => {
                                  const copy = { ...prev };
                                  if (v === undefined) delete copy[k.code]; else copy[k.code] = v;
                                  return copy;
                                });
                              }}
                            />
                          </div>
                          <div>
                            <select
                              className="wp-input"
                              value={alternatesMap[k.code] || ""}
                              onChange={(e) => {
                                const val = e.target.value || undefined;
                                setAlternatesMap((prev) => {
                                  const copy = { ...prev };
                                  if (!val) delete copy[k.code]; else copy[k.code] = val;
                                  return copy;
                                });
                              }}
                            >
                              <option value="">— geen —</option>
                              {wedstrijden.filter((wedstrijd) => wedstrijd.id !== (gekozen && gekozen.id)).map((wedstrijd) => (
                                <option key={wedstrijd.id} value={wedstrijd.id}>
                                  {wedstrijd.naam} {wedstrijd.datum ? `(${wedstrijd.datum})` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="wb-actions-row wb-actions-row-end">
                  <button type="button" className="wp-btn" onClick={saveWedstrijdConfig} disabled={!gekozen}>Instellingen opslaan</button>
                </div>
              </section>

              <section className="wb-card">
                <div className="wb-card-head">
                  <div>
                    <h2>Proeven</h2>
                    <p>Voeg proeven toe voor de geselecteerde wedstrijd.</p>
                  </div>
                </div>
                <ProefEditor cfg={cfg} setCfg={setCfg} saveProef={saveProef} gekozen={gekozen} />
              </section>
            </>
          ) : (
            <div className="wb-empty-state">
              <h2>Proeven en instellingen</h2>
              <p>Selecteer eerst een bestaande wedstrijd om de bewerk- en configuratiekaarten te tonen.</p>
            </div>
          )}
        </Container>
      </div>
    );
}
