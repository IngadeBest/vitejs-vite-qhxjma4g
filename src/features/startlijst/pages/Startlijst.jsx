import React, { useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const KLASSEN = [
  { code: "we0", label: "Introductieklasse (WE0)" },
  { code: "we1", label: "WE1" },
  { code: "we2", label: "WE2" },
  { code: "we3", label: "WE3" },
  { code: "we4", label: "WE4" },
];

function toCSV(rows) {
  const head = "ruiter,paard,startnummer";
  const body = rows.map(r => `${JSON.stringify(r.ruiter)},${JSON.stringify(r.paard)},${JSON.stringify(String(r.startnummer||""))}`).join("\n");
  return head + "\n" + body + "\n";
}

export default function Startlijst() {
  const [filters, setFilters] = useState({ wedstrijd: "", klasse: "" });
    const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const dragIndex = useRef(null);

  const disabled = useMemo(() => !filters.wedstrijd || !filters.klasse, [filters]);

  async function load() {
    setBusy(true);
    try {
      if (!supabase) throw new Error("No supabase");
      const { data, error } = await supabase
        .from("inschrijvingen")
        .select("*")
        .eq("wedstrijd", filters.wedstrijd)
        .eq("klasse", filters.klasse)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const mapped = (data || []).map((d, i) => ({
        id: d.id, ruiter: d.ruiter, paard: d.paard,
        startnummer: d.startnummer || i + 1,
        voorkeur_tijd: d.voorkeur_tijd || "",
        opmerkingen: d.opmerkingen || "",
      }));
      setItems(mapped);
    } catch (e) {
      const all = JSON.parse(localStorage.getItem("wp_inschrijvingen") || "[]");
      const filtered = all.filter(x => x.wedstrijd === filters.wedstrijd && x.klasse === filters.klasse);
      const mapped = filtered.map((d, i) => ({
        id: d.id, ruiter: d.ruiter, paard: d.paard,
        startnummer: d.startnummer || i + 1,
        voorkeur_tijd: d.voorkeur_tijd || "",
        opmerkingen: d.opmerkingen || "",
      }));
      setItems(mapped);
    } finally {
      setBusy(false);
    }
  }

  function resequence() {
    setItems(prev => prev.map((x,i) => ({ ...x, startnummer: i+1 })));
  }

  const onDragStart = (i) => (e) => { dragIndex.current = i; e.dataTransfer.effectAllowed = "move"; };
  const onDragOver  = (i) => (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onDrop      = (i) => (e) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === i) return;
    setItems(prev => {
      const next = [...prev];
      const [m] = next.splice(from, 1);
      next.splice(i, 0, m);
      return next;
    });
    dragIndex.current = null;
  };

  function pushToProtocollen() {
    const rows = items.map(x => ({
      ruiter: x.ruiter,
      paard: x.paard,
      startnummer: x.startnummer
    }));
    const csv = toCSV(rows);
    localStorage.setItem("wp_startlijst_csv", csv);
    alert("Startlijst klaar voor protocollen. Ga naar het tabblad 'Protocollen' en klik op 'Importeer startlijst uit opslag'.");
    window.location.hash = "#/protocollen";
  }

  function exportCSV() {
    const rows = items.map(x => ({ ruiter: x.ruiter, paard: x.paard, startnummer: x.startnummer }));
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "startlijst.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto" }}>
      <h2>Startlijst</h2>
      <div style={{ display:"grid", gridTemplateColumns:"200px 1fr", gap:"10px 12px", alignItems:"center" }}>
        <label>Wedstrijd*</label>
        <input value={filters.wedstrijd} onChange={(e)=>setFilters(s=>({...s, wedstrijd:e.target.value}))} placeholder="Exacte naam, zelfde als bij inschrijven" />
        <label>Klasse*</label>
        <select value={filters.klasse} onChange={(e)=>setFilters(s=>({...s, klasse:e.target.value}))}>
          <option value="">— kies klasse —</option>
          {KLASSEN.map(k => <option key={k.code} value={k.code}>{k.label}</option>)}
        </select>
        <div></div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={load} disabled={disabled || busy}>{busy ? "Laden..." : "Laden"}</button>
          <button onClick={resequence} disabled={!items.length}>Her-nummeren</button>
          <button onClick={exportCSV} disabled={!items.length}>Exporteer CSV</button>
          <button onClick={pushToProtocollen} disabled={!items.length}>Push naar Protocollen</button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {items.length === 0 ? (
          <div style={{ color:"#666" }}>Nog geen items. Kies wedstrijd + klasse en klik <b>Laden</b>.</div>
        ) : (
          <table width="100%" cellPadding={8} style={{ borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#f7f7f7" }}>
                <th align="left" style={{ width: 100 }}>Startnr</th>
                <th align="left">Ruiter</th>
                <th align="left">Paard</th>
                <th align="left" style={{ width: 200 }}>Voorkeur tijd</th>
                <th align="left">Opmerkingen</th>
                <th align="left" style={{ width: 90 }}>Sleep</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id || i} style={{ borderTop:"1px solid #eee" }}
                    draggable onDragStart={onDragStart(i)} onDragOver={onDragOver(i)} onDrop={onDrop(i)}>
                  <td>
                    <input
                      type="number"
                      value={it.startnummer}
                      onChange={(e)=>{
                        const val = parseInt(e.target.value || "0", 10);
                        setItems(prev => prev.map((x,idx) => idx===i ? ({...x, startnummer: val}) : x));
                      }}
                      style={{ width: 80 }}
                    />
                  </td>
                  <td>{it.ruiter}</td>
                  <td>{it.paard}</td>
                  <td>{it.voorkeur_tijd || ""}</td>
                  <td>{it.opmerkingen || ""}</td>
                  <td style={{ color:"#666" }}>☰</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
