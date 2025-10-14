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

function toCSV(rows) {
  const head = "plaats,ruiter,paard,dressuur,stijl,speed,totaal";
  const body = rows.map((r,i)=>[i+1, r.ruiter, r.paard, r.dressuur ?? "", r.stijl ?? "", r.speed ?? "", r.totaal ?? ""].map(v => JSON.stringify(String(v))).join(",")).join("\n");
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
      const { data, error } = await supabase
        .from("scores")
        .select("*")
        .eq("wedstrijd_id", filters.wedstrijd_id)
        .eq("klasse", filters.klasse);
      if (error) throw error;

      const map = new Map();
      for (const s of data || []) {
        const key = `${s.ruiter}__${s.paard}`;
        const entry = map.get(key) || { ruiter: s.ruiter, paard: s.paard, dressuur: null, stijl: null, speed: null, totaal: 0 };
        if (s.onderdeel === "dressuur") entry.dressuur = Number(s.totaal) || 0;
        if (s.onderdeel === "stijl") entry.stijl = Number(s.totaal) || 0;
        if (s.onderdeel === "speed") entry.speed = Number(s.totaal) || 0;
        map.set(key, entry);
      }
      const arr = Array.from(map.values()).map(r => ({ ...r, totaal: (r.dressuur||0) + (r.stijl||0) + (r.speed||0) }));
      arr.sort((a,b) => (b.totaal - a.totaal));
      setRows(arr);
      setMsg(`Einduitslag samengesteld voor ${arr.length} combinaties.`);
    } catch (e) {
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
      <div style={{ display:"grid", gridTemplateColumns:"200px 1fr", gap:"10px 12px", alignItems:"center" }}>
        <label>Wedstrijd*</label>
        <select value={filters.wedstrijd_id} onChange={(e)=>setFilters(s=>({...s, wedstrijd_id:e.target.value}))} disabled={loadingWed}>
          <option value="">{loadingWed ? "Laden..." : "— kies wedstrijd —"}</option>
          {wedstrijden.map(w => <option key={w.id} value={w.id}>{w.naam} {w.datum ? `(${w.datum})` : ""}</option>)}
        </select>
        <label>Klasse*</label>
        <select value={filters.klasse} onChange={(e)=>setFilters(s=>({...s, klasse:e.target.value}))}>
          <option value="">— kies klasse —</option>
          {KLASSEN.map(k => <option key={k.code} value={k.code}>{k.label}</option>)}
        </select>
        <div></div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button onClick={load} disabled={disabled || busy}>{busy ? "Laden..." : "Laden"}</button>
          <button onClick={exportCSV} disabled={!rows.length}>Exporteer CSV</button>
        </div>
      </div>

      {msg && <div style={{ marginTop: 8, color:"#444" }}>{msg}</div>}

      <div style={{ marginTop: 16 }}>
        {rows.length === 0 ? (
          <div style={{ color:"#666" }}>Nog geen scores voor deze selectie.</div>
        ) : (
          <table width="100%" cellPadding={8} style={{ borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#f7f7f7" }}>
                <th align="left">Pl.</th>
                <th align="left">Ruiter</th>
                <th align="left">Paard</th>
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
