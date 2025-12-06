import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Card } from "@/ui/card";

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

function toCSV(rows) {
  const head = "plaats,ruiter,paard,dressuur,stijl,speed,totaal";
  const body = (rows || []).map((r, i) => [i + 1, r.ruiter, r.paard, r.dressuur ?? "", r.stijl ?? "", r.speed ?? "", r.totaal ?? ""].map(v => JSON.stringify(String(v))).join(",")).join("\n");
  return head + "\n" + body + "\n";
}

export default function Einduitslag() {
  const { items: wedstrijden, loading: loadingWed } = useWedstrijden(false);
  const [filters, setFilters] = useState({ wedstrijd_id: "", klasse: "" });
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const disabled = useMemo(() => !filters.wedstrijd_id || !filters.klasse, [filters]);

  async function load() {
    setBusy(true);
    setMsg("");
    try {
      // Map klasse code naar proeven formaat
      const klasseMap = {
        'we0': 'Introductieklasse (WE0)',
        'we1': 'WE1',
        'we2': 'WE2',
        'we2p': 'WE2+',
        'we3': 'WE3',
        'we4': 'WE4',
        'yr': 'Young Riders',
        'junior': 'Junioren'
      };
      const proefKlasse = klasseMap[filters.klasse] || filters.klasse;
      
      // Eerst proeven ophalen voor deze wedstrijd en klasse
      const { data: proeven, error: proevenError } = await supabase
        .from("proeven")
        .select("id, naam, onderdeel, klasse")
        .eq("wedstrijd_id", filters.wedstrijd_id)
        .eq("klasse", proefKlasse);
      
      if (proevenError) throw proevenError;
      
      if (!proeven || proeven.length === 0) {
        setMsg(`⚠️ Geen proeven gevonden voor deze wedstrijd en klasse (gezocht naar: ${proefKlasse})`);
        setRows([]);
        return;
      }
      
      console.log('Found proeven:', proeven);
      const proefIds = proeven.map(p => p.id);
      
      // Dan scores ophalen voor deze proeven
      const { data: scores, error: scoresError } = await supabase
        .from("scores")
        .select("*")
        .in("proef_id", proefIds);
      
      if (scoresError) throw scoresError;
      
      console.log('Found scores:', scores);
      
      // Inschrijvingen ophalen voor ruiter/paard info
      const { data: inschrijvingen, error: inschrijvingenError } = await supabase
        .from("inschrijvingen")
        .select("startnummer, ruiter, paard")
        .eq("wedstrijd_id", filters.wedstrijd_id)
        .eq("klasse", filters.klasse);
      
      if (inschrijvingenError) throw inschrijvingenError;
      
      console.log('Found inschrijvingen:', inschrijvingen);
      
      // Map startnummer naar ruiter/paard
      const inschrijvingMap = new Map();
      (inschrijvingen || []).forEach(i => {
        const numId = i.startnummer ? parseInt(i.startnummer) : null;
        if (numId) {
          inschrijvingMap.set(numId, { ruiter: i.ruiter, paard: i.paard });
        }
      });
      
      // Groepeer scores per ruiter
      const map = new Map();
      for (const s of scores || []) {
        const inschr = inschrijvingMap.get(s.ruiter_id);
        if (!inschr) continue; // Skip als ruiter niet gevonden
        
        const key = `${inschr.ruiter}__${inschr.paard}`;
        const proef = proeven.find(p => p.id === s.proef_id);
        const onderdeel = proef?.onderdeel || "";
        
        const entry = map.get(key) || { 
          ruiter: inschr.ruiter, 
          paard: inschr.paard, 
          dressuur: null, 
          stijl: null, 
          speed: null, 
          totaal: 0 
        };
        
        if (onderdeel === "dressuur") entry.dressuur = Number(s.score) || 0;
        if (onderdeel === "stijl") entry.stijl = Number(s.score) || 0;
        if (onderdeel === "speed") entry.speed = Number(s.score) || 0;
        
        map.set(key, entry);
      }
      
      const arr = Array.from(map.values()).map(r => ({ 
        ...r, 
        totaal: (r.dressuur||0) + (r.stijl||0) + (r.speed||0) 
      }));
      arr.sort((a,b) => (b.totaal - a.totaal));
      setRows(arr);
      setMsg(`✅ Einduitslag samengesteld voor ${arr.length} combinaties (${scores?.length || 0} scores gevonden).`);
    } catch (e) {
      console.error('Load error:', e);
      setMsg("Fout bij laden: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  function exportCSV() {
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "einduitslag.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto" }}>
      <h2>Einduitslag</h2>
      <Card>
        <div style={{ display:"grid", gridTemplateColumns:"200px 1fr", gap:"10px 12px", alignItems:"center" }}>
          <label htmlFor="wedstrijd_select">Wedstrijd*</label>
          <select id="wedstrijd_select" value={filters.wedstrijd_id} onChange={(e)=>setFilters(s=>({...s, wedstrijd_id:e.target.value}))} disabled={loadingWed}>
            <option value="">{loadingWed ? "Laden..." : "— kies wedstrijd —"}</option>
            {wedstrijden.map(w => <option key={w.id} value={w.id}>{w.naam} {w.datum ? `(${w.datum})` : ""}</option>)}
          </select>

          <label htmlFor="klasse_select">Klasse*</label>
          <select id="klasse_select" value={filters.klasse} onChange={(e)=>setFilters(s=>({...s, klasse:e.target.value}))}>
            <option value="">— kies klasse —</option>
            {KLASSEN.map(k => <option key={k.code} value={k.code}>{k.label}</option>)}
          </select>

          <div></div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <Button onClick={load} disabled={disabled || busy} aria-busy={busy}>{busy ? "Laden..." : "Laden"}</Button>
            <Button onClick={exportCSV} disabled={!rows.length} aria-disabled={!rows.length}>Exporteer CSV</Button>
          </div>
        </div>
      </Card>

      {msg && <div style={{ marginTop: 8, color:"#444" }}>{msg}</div>}

      <div style={{ marginTop: 16 }}>
        {rows.length === 0 ? (
          <div style={{ color:"#666" }}>Nog geen scores voor deze selectie.</div>
        ) : (
          <table className="wp-table" cellPadding={8}>
            <thead>
              <tr>
                <th>Pl.</th>
                <th>Ruiter</th>
                <th>Paard</th>
                <th align="right">Dressuur</th>
                <th align="right">Stijl</th>
                <th align="right">Speed</th>
                <th align="right">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop:"1px solid #eee" }}>
                  <td>{i+1}</td>
                  <td>{r.ruiter}</td>
                  <td>{r.paard}</td>
                  <td align="right">{r.dressuur ?? "-"}</td>
                  <td align="right">{r.stijl ?? "-"}</td>
                  <td align="right">{r.speed ?? "-"}</td>
                  <td align="right"><b>{r.totaal}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
