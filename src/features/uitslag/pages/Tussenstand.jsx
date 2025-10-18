import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";

const KLASSEN = [
  { code: "we0", label: "Introductieklasse (WE0)" },
  { code: "we1", label: "WE1" },
  { code: "we2", label: "WE2" },
  { code: "we3", label: "WE3" },
  { code: "we4", label: "WE4" },
];

export default function Tussenstand() {
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

      // groepeer per combinatie (ruiter + paard)
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
      setMsg(`Gevonden ${arr.length} combinaties.`);
    } catch (e) {
      setMsg("Fout bij laden: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto" }}>
      <h2>Tussenstand</h2>
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
