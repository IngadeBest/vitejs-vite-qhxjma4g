import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";

const KLASSEN = [
  { code: "we0", label: "Introductieklasse (WE0)" },
  { code: "we1", label: "WE1" },
  { code: "we2", label: "WE2" },
  { code: "we3", label: "WE3" },
  { code: "we4", label: "WE4" },
];
const ONDERDELEN = [
  { code: "dressuur", label: "Dressuur" },
  { code: "stijl", label: "Stijltrail" },
  { code: "speed", label: "Speedtrail" },
];

export default function WedstrijdenBeheer() {
  const { items: wedstrijden, loading } = useWedstrijden(false);
  const [nieuw, setNieuw] = useState({ naam: "", datum: "", locatie: "", status: "open" });
  const [selectedId, setSelectedId] = useState("");
  const gekozen = useMemo(() => wedstrijden.find(w => w.id === selectedId) || null, [selectedId, wedstrijden]);

  const [cfg, setCfg] = useState({
    onderdeel: "dressuur",
    klasse: "we1",
    proef_naam: "",
    max_score: "",
    items_text: "",
  });

  const [msg, setMsg] = useState("");

  async function addWedstrijd() {
    setMsg("");
    try {
      const { data, error } = await supabase.from("wedstrijden").insert({
        naam: nieuw.naam,
        datum: nieuw.datum || null,
        locatie: nieuw.locatie || null,
        status: nieuw.status || "open",
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
    const url = `${location.origin}/#/formulier?wedstrijdId=${gekozen.id}`;
    navigator.clipboard.writeText(url);
    setMsg("Link gekopieerd: " + url);
  }

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

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto" }}>
      <h2>Wedstrijden</h2>

      <section style={{border:"1px solid #eee", borderRadius:12, padding:12, marginBottom:16}}>
        <h3>Nieuwe wedstrijd</h3>
        <div style={{display:"grid",gridTemplateColumns:"160px 1fr 1fr 1fr", gap:8}}>
          <input placeholder="Naam*" value={nieuw.naam} onChange={(e)=>setNieuw(s=>({...s, naam:e.target.value}))}/>
          <input type="date" value={nieuw.datum} onChange={(e)=>setNieuw(s=>({...s, datum:e.target.value}))}/>
          <input placeholder="Locatie" value={nieuw.locatie} onChange={(e)=>setNieuw(s=>({...s, locatie:e.target.value}))}/>
          <select value={nieuw.status} onChange={(e)=>setNieuw(s=>({...s, status:e.target.value}))}>
            <option value="open">open</option>
            <option value="gesloten">gesloten</option>
            <option value="archief">archief</option>
          </select>
        </div>
        <div style={{marginTop:8}}>
          <button onClick={addWedstrijd} disabled={!nieuw.naam}>Aanmaken</button>
        </div>
      </section>

      <section style={{border:"1px solid #eee", borderRadius:12, padding:12, marginBottom:16}}>
        <h3>Beheer bestaande wedstrijd</h3>
        <div style={{display:"flex", gap:8, alignItems:"center"}}>
          <select value={selectedId} onChange={(e)=>setSelectedId(e.target.value)} disabled={loading}>
            <option value="">{loading ? "Laden..." : "— kies wedstrijd —"}</option>
            {wedstrijden.map(w => <option key={w.id} value={w.id}>{w.naam} {w.datum ? `(${w.datum})` : ""}</option>)}
          </select>
          <button onClick={copyLink} disabled={!gekozen}>Kopieer inschrijflink</button>
        </div>
        {gekozen && (
          <div style={{marginTop:12, fontSize:13, color:"#444"}}>
            <div><b>Naam:</b> {gekozen.naam}</div>
            <div><b>Datum:</b> {gekozen.datum || "—"} · <b>Status:</b> {gekozen.status}</div>
          </div>
        )}
      </section>

      <section style={{border:"1px solid #eee", borderRadius:12, padding:12}}>
        <h3>Proeven & max scores</h3>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, alignItems:"center"}}>
          <label>Onderdeel</label>
          <select value={cfg.onderdeel} onChange={(e)=>setCfg(s=>({...s, onderdeel:e.target.value}))}>
            {ONDERDELEN.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
          </select>
          <label>Klasse</label>
          <select value={cfg.klasse} onChange={(e)=>setCfg(s=>({...s, klasse:e.target.value}))}>
            {KLASSEN.map(k => <option key={k.code} value={k.code}>{k.label}</option>)}
          </select>
          <div></div>

          <label>Naam/proefcode*</label>
          <input placeholder="Bijv. WE1-A, Stijltrail-1, Speedtrail-1" value={cfg.proef_naam} onChange={(e)=>setCfg(s=>({...s, proef_naam:e.target.value}))}/>

          <label>Max. score (optioneel)</label>
          <input type="number" placeholder="Bijv. 200" value={cfg.max_score} onChange={(e)=>setCfg(s=>({...s, max_score:e.target.value}))}/>

          <div></div><div></div>
        </div>

        <div style={{marginTop:8}}>
          <label style={{display:"block", fontWeight:600}}>Onderdelen van de proef</label>
          <div style={{fontSize:12,color:"#666",margin:"4px 0 8px"}}>
            <b>Dressuur:</b> per regel: <code>omschrijving | max | coeff</code> (bijv. "C binnenkomen | 10 | 1")<br/>
            <b>Stijl/Speed:</b> per regel één obstakel of element.
          </div>
          <textarea rows={8} style={{width:"100%"}} value={cfg.items_text} onChange={(e)=>setCfg(s=>({...s, items_text:e.target.value}))}/>
        </div>

        <div style={{marginTop:8}}>
          <button onClick={saveProef} disabled={!gekozen}>Opslaan</button>
        </div>
      </section>

      {msg && <div style={{ marginTop: 12, color: "#333" }}>{msg}</div>}
    </div>
  );
}
