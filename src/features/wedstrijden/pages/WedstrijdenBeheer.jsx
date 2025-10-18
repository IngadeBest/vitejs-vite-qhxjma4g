import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";
import ProefEditor from "@/features/wedstrijden/components/ProefEditor";

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
  const [startlijstConfig, setStartlijstConfig] = useState({ dressuurStart: '', interval: 7, trailOffset: 0, pauses: [] });
  const [migrationSql, setMigrationSql] = useState("");

  const MIGRATION_SQL = `-- add allowed_klassen to wedstrijden\nALTER TABLE IF EXISTS wedstrijden\n  ADD COLUMN IF NOT EXISTS allowed_klassen jsonb DEFAULT '[]'::jsonb;`;

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
      setStartlijstConfig({ dressuurStart: '', interval: 7, trailOffset: 0, pauses: [] });
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
      if (cfg) setStartlijstConfig({ dressuurStart: cfg.dressuurStart || '', interval: cfg.interval || 7, trailOffset: cfg.trailOffset || 0, pauses: Array.isArray(cfg.pauses) ? cfg.pauses : [] });
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
      const { error } = await supabase.from("wedstrijden").update({
        allowed_klassen: allowedKlassen,
        organisator_email: nieuwEmail || null,
        startlijst_config: startlijstConfig || {}
      }).eq("id", gekozen.id);
      if (error) throw error;
      setMsg("Wedstrijd instellingen opgeslagen ✔️");
      setMigrationSql("");
    } catch (e) {
      // likely column doesn't exist — instruct admin to run DB migration
      const em = (e?.message || String(e));
      const hint = "Controleer of de kolom 'allowed_klassen' bestaat in de tabel 'wedstrijden'.";
      setMsg("Opslaan mislukt: " + em + " — " + hint);
      setMigrationSql(MIGRATION_SQL);
    }
  }

    return (
    <div style={{ background: "#f5f7fb", minHeight: "100vh", padding: 24 }}>
      <div style={{
        maxWidth: 1000,
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 6px 18px #20457422",
        margin: "0 auto",
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

      {msg && <div style={{ marginTop: 12, color: "#333" }}>{msg}</div>}
      {migrationSql && (
        <section style={{marginTop:12, border:'1px dashed #e2e8f0', padding:12, borderRadius:8}}>
          <h3 style={{marginTop:0}}>DB-migratie benodigd</h3>
          <p style={{marginTop:4, color:'#555'}}>Kopieer onderstaande SQL en voer deze uit op je database (psql of Supabase SQL editor).</p>
          <textarea readOnly rows={6} style={{width:'100%', fontFamily:'monospace', fontSize:13}} value={migrationSql}></textarea>
          <div style={{marginTop:8}}>
            <button onClick={()=>{ navigator.clipboard.writeText(migrationSql); setMsg('SQL gekopieerd naar Klembord'); }}>Kopieer SQL</button>
          </div>
        </section>
      )}
    </div>
  );
}
