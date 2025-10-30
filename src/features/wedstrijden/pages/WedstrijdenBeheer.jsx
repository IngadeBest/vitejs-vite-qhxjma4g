import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";
import ProefEditor from "@/features/wedstrijden/components/ProefEditor";
import Container from "@/ui/Container";

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

export default function WedstrijdenBeheer() {
  const { items: wedstrijden, loading } = useWedstrijden(false);
  const [nieuw, setNieuw] = useState({ naam: "", datum: "", locatie: "", status: "open" });
  // nieuw.organisator_email optionally
  const [nieuwEmail, setNieuwEmail] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [showNew, setShowNew] = useState(false);
  const gekozen = useMemo(() => wedstrijden.find(w => w.id === selectedId) || null, [selectedId, wedstrijden]);

  const [cfg, setCfg] = useState({
    onderdeel: "dressuur",
    klasse: "we1",
    proef_naam: "",
    max_score: "",
    items_text: "",
  });

  const [msg, setMsg] = useState("");
  const [allowedKlassen, setAllowedKlassen] = useState([]);
  const [startlijstConfig, setStartlijstConfig] = useState({ dressuurStart: '', interval: 7, stijltrailStart: '', pauses: [] });
  const [jeugdAllowed, setJeugdAllowed] = useState({}); // map klasse -> boolean
  const [offsetOverridesText, setOffsetOverridesText] = useState('');
  const [capacitiesMap, setCapacitiesMap] = useState({});
  const [alternatesMap, setAlternatesMap] = useState({});
  // migration SQL UI removed per user request

    

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
      // keep the new-form collapsed when no selection
      setShowNew(false);
      return;
    }
  // expected shape: gekozen.allowed_klassen (array)
  setAllowedKlassen(Array.isArray(gekozen.allowed_klassen) ? gekozen.allowed_klassen : []);
    // populate organisator email if present
    setNieuwEmail(gekozen.organisator_email || "");
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
    setAlternatesMap(cfg.alternates && typeof cfg.alternates === 'object' ? cfg.alternates : {});
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
        organisator_email: nieuwEmail || null,
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
          alternates: alternatesMap || {}
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
    <div style={{ background: "#f5f7fb", minHeight: "100vh", padding: 24 }}>
      <Container maxWidth={1000}>
        <div style={{
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 6px 18px #20457422",
          padding: "32px 28px",
          fontFamily: "system-ui, sans-serif"
        }}>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: "#204574", letterSpacing: 0.6, marginBottom: 18 }}>
          Wedstrijden beheer
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, marginBottom: 18 }}>
          <div style={{ padding: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 800 }}>Nieuwe wedstrijd</div>
              <div style={{ marginLeft: 'auto' }}>
                <button onClick={()=>setShowNew(s=>!s)}>{showNew ? 'Verberg nieuw' : 'Nieuwe wedstrijd'}</button>
              </div>
            </div>
            {showNew && (
              <div style={{ padding: 12, borderRadius: 8, border: '1px solid #eef6ff' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 1fr', gap: 8, alignItems: 'center' }}>
                  <input placeholder="Naam*" value={nieuw.naam} onChange={(e)=>setNieuw(s=>({...s, naam:e.target.value}))} />
                  <input type="date" value={nieuw.datum} onChange={(e)=>setNieuw(s=>({...s, datum:e.target.value}))} />
                  <input placeholder="Locatie" value={nieuw.locatie} onChange={(e)=>setNieuw(s=>({...s, locatie:e.target.value}))} />
                  <input placeholder="Organisator e-mail" value={nieuwEmail} onChange={(e)=>setNieuwEmail(e.target.value)} />
                  <select value={nieuw.status} onChange={(e)=>setNieuw(s=>({...s, status:e.target.value}))}>
                    <option value="open">open</option>
                    <option value="gesloten">gesloten</option>
                    <option value="archief">archief</option>
                  </select>
                  <div></div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <button onClick={addWedstrijd} disabled={!nieuw.naam}>Aanmaken</button>
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: 12, borderRadius: 8, border: '1px solid #eef6ff' }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Selecteer wedstrijd</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={selectedId} onChange={(e)=>setSelectedId(e.target.value)} disabled={loading} style={{ flex: '1 1 auto', minWidth: 0 }}>
                <option value="">{loading ? "Laden..." : "— kies wedstrijd —"}</option>
                {wedstrijden.map(w => <option key={w.id} value={w.id}>{w.naam} {w.datum ? `(${w.datum})` : ""}</option>)}
              </select>
              <button onClick={copyLink} disabled={!gekozen} style={{ whiteSpace: 'nowrap' }}>Kopieer inschrijflink</button>
            </div>
            {gekozen && (
              <div style={{ marginTop: 12, fontSize: 13, color: '#444' }}>
                <div><b>{gekozen.naam}</b></div>
                <div style={{ marginTop: 6 }}><b>Datum:</b> {gekozen.datum || "—"} · <b>Status:</b> {gekozen.status}</div>
                <div style={{ marginTop:8 }}>
                  <label style={{display:'block', fontSize:13, fontWeight:600, marginBottom:6}}>Organisator e-mail</label>
                  <input
                    type="email"
                    placeholder="organisator@example.com"
                    value={nieuwEmail}
                    onChange={(e)=>setNieuwEmail(e.target.value)}
                    style={{padding:6, borderRadius:6, border:'1px solid #ddd', width:'100%'}}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

          <div style={{ padding: 12, borderRadius: 8, border: '1px solid #eef6ff' }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Toegestane klassen</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button type="button" onClick={()=>setAllowedKlassen(KLASSEN.map(k=>k.code))}>Selecteer alles</button>
              <button type="button" onClick={()=>setAllowedKlassen([])}>Reset</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {KLASSEN.map(k => {
                const checked = allowedKlassen.includes(k.code);
                return (
                  <label key={k.code} style={{display:'flex', alignItems:'center', gap:8}}>
                    <input type="checkbox" checked={checked} onChange={(e)=>{
                      setAllowedKlassen(s => e.target.checked ? Array.from(new Set([...s, k.code])) : s.filter(x=>x!==k.code));
                    }} />
                    <span style={{fontSize:13}}>{k.label}</span>
                  </label>
                );
              })}
            </div>
            <div style={{ marginTop: 12, borderTop: '1px solid #f0f4f8', paddingTop: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Jeugd-rubriek</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {KLASSEN.map(k => (
                  <label key={`jeugd-${k.code}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={!!jeugdAllowed[k.code]} onChange={(e)=>{ setJeugdAllowed(prev => ({ ...prev, [k.code]: e.target.checked })); }} />
                    <span style={{ fontSize: 13 }}>{k.label} — jeugd toegestaan</span>
                  </label>
                ))}
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Offset overrides (optioneel)</div>
                <div style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>Voer JSON in zoals: {`{"we2:jeugd":801, "we0:senior":5}`}</div>
                <textarea rows={4} value={offsetOverridesText} onChange={(e)=>setOffsetOverridesText(e.target.value)} style={{ width: '100%', fontFamily: 'monospace' }} />

                <div style={{ fontWeight: 700, marginTop: 12, marginBottom: 6 }}>Capaciteiten & alternatieven per klasse</div>
                <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>Voer per klasse het maximaal aantal deelnemers in en (optioneel) een alternatieve wedstrijd.</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr', gap: 8, alignItems: 'center' }}>
                  <div style={{ fontWeight: 700 }}>Klasse</div>
                  <div style={{ fontWeight: 700 }}>Capacity</div>
                  <div style={{ fontWeight: 700 }}>Alternatief (wedstrijd)</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {KLASSEN.map(k => (
                    <div key={k.code} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr', gap: 8, alignItems: 'center' }}>
                      <div>{k.label}</div>
                      <div>
                        <input type="number" min={0} placeholder="Geen limiet" value={capacitiesMap[k.code] ?? ''} onChange={(e)=>{
                          const v = e.target.value === '' ? undefined : Number(e.target.value);
                          setCapacitiesMap(prev => {
                            const copy = { ...prev };
                            if (v === undefined) delete copy[k.code]; else copy[k.code] = v;
                            return copy;
                          });
                        }} style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid #ddd' }} />
                      </div>
                      <div>
                        <select value={alternatesMap[k.code] || ''} onChange={(e)=>{
                          const val = e.target.value || undefined;
                          setAlternatesMap(prev => {
                            const copy = { ...prev };
                            if (!val) delete copy[k.code]; else copy[k.code] = val;
                            return copy;
                          });
                        }} style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid #ddd' }}>
                          <option value="">— geen —</option>
                          {wedstrijden.filter(w=>w.id !== (gekozen && gekozen.id)).map(w => (
                            <option key={w.id} value={w.id}>{w.naam} {w.datum ? `(${w.datum})` : ''}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* categorie feature removed */}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 8 }}>
          <button onClick={saveWedstrijdConfig} disabled={!gekozen}>Opslaan instellingen</button>
        </div>
      

      

      {gekozen ? (
        <ProefEditor cfg={cfg} setCfg={setCfg} saveProef={saveProef} gekozen={gekozen} />
      ) : (
        <div style={{ marginTop: 12, color: '#666' }}>Selecteer een bestaande wedstrijd om proeven toe te voegen.</div>
      )}

      </Container>

      {msg && <div style={{ marginTop: 12, color: "#333" }}>{msg}</div>}
    </div>
  );
}
