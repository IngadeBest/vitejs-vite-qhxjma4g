// src/features/protocollen/pages/ProtocolGenerator.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import obstakelsCatalog from "@/data/obstakels.json";
import templates from "@/data/defaultTemplates.json";

/* =========================
   Klassenconfig (zonder obstakels)
   ========================= */
const KLASSEN = [
  { code: "we0", labelKey: "WE0", naam: "Introductieklasse (WE0)", min: 6,  max: 8  },
  { code: "we1", labelKey: "WE1", naam: "WE1",                       min: 6,  max: 10 },
  { code: "we2", labelKey: "WE2", naam: "WE2",                       min: 8,  max: 12 },
  { code: "we3", labelKey: "WE3", naam: "WE3",                       min: 10, max: 14 },
  { code: "we4", labelKey: "WE4", naam: "WE4",                       min: 12, max: 16 },
];

/* =========================
   Algemene punten per klasse
   ========================= */
const ALG_PUNTEN_WE0_WE1 = [
  "Zuiverheid van de gangen en regelmatigheid van de bewegingen van het paard",
  "Schwung, dynamiek, elasticiteit van de overgangen, losheid van de rugspieren",
  "Gehoorzaamheid, reactie op de hulpen, oplettendheid richting ruiter en vertrouwen in de ruiter",
  "Zit en rijwijze van de ruiter",
];

const ALG_PUNTEN_WE2PLUS = [
  "Stap/galop/stap overgangen / Canter/walk transitions",
  "Zuiverheid van de gangen en regelmatigheid van de bewegingen van het paard / Purity of the gait and regularity of the movements of the horse",
  "Schwung, dynamiek, elasticiteit van de overgangen, losheid van de rugspieren / Panache, dynamics, elasticity of the transitions, looseness of the back muscles",
  "Gehoorzaamheid, reactie op de hulpen, oplettendheid richting ruiter en vertrouwen in de ruiter / Obedience, reaction to aids, thoughtfulness towards the rider and confidence in the rider",
  "Zit en rijwijze van de ruiter, effectiviteit van de hulpen / Position and seat of the rider. Correct use and effectiveness of the aids.",
];

/* =========================
   CSV helpers
   ========================= */
function csvToRows(text) {
  const sep = text.includes(";") && !text.includes(",") ? ";" : ",";
  const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim().length);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = splitCSVLine(lines[0], sep);
  const rows = lines.slice(1).map(l => splitCSVLine(l, sep)).map(cols => {
    const o = {};
    headers.forEach((h,i)=>o[h.trim()] = (cols[i] ?? "").trim());
    return o;
  });
  return { headers, rows };
}
function splitCSVLine(line, sep) {
  const out=[], n=line.length; let cur="", inQ=false;
  for (let i=0;i<n;i++){
    const c=line[i];
    if (c==='"'){ if(inQ && line[i+1]==='"'){cur+='"'; i++;} else inQ=!inQ; }
    else if (c===sep && !inQ){ out.push(cur); cur=""; }
    else cur+=c;
  }
  out.push(cur); return out;
}
function downloadCSVTemplate() {
  const s = [
    "ruiter,paard,startnummer",
    "Inga de Best,Pedro,1",
    "Ruiter 2,Paard 2,2"
  ].join("\n");
  const blob = new Blob([s], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download="deelnemers_template.csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

/* =========================
   PDF helpers – moderne lay-out
   ========================= */
const BLUE = [16, 39, 84];
const LIGHT_HEAD = [240, 243, 249];
const BORDER = [223, 227, 235];
const MARGIN = { left: 40, right: 40 };

const COL_NUM  = 26;
const COL_NAME = 260;
const COL_H    = 40;
const COL_HALF = 40;

/* ---------- PDF building ---------- */
function titleBar(doc, title, subtitle) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, W, 64, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 40, 40);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (subtitle) doc.text(subtitle, 40, 56);
  doc.setTextColor(0, 0, 0);
}

function infoBoxesSideBySide(doc, info) {
  const startY = 74;

  autoTable(doc, {
    startY,
    head: [],
    body: [
      ["Wedstrijd", info.wedstrijd || ""],
      ["Datum", info.datum || ""],
      ["Jury", info.jury || ""],
      ["Klasse", info.klasse_naam || info.klasse || ""],
    ],
    styles: { fontSize: 10, cellPadding: 5, lineColor: BORDER, lineWidth: 0.2 },
    theme: "grid",
    margin: { left: MARGIN.left, right: 0 },
    tableWidth: 240,
    columnStyles: { 0: { cellWidth: 90, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
  });
  const leftY = doc.lastAutoTable.finalY;

  autoTable(doc, {
    startY,
    head: [],
    body: [
      ["Ruiter", info.ruiter || ""],
      ["Paard", info.paard || ""],
      ["Startnummer", info.startnummer || ""],
    ],
    styles: { fontSize: 10, cellPadding: 5, lineColor: BORDER, lineWidth: 0.2 },
    theme: "grid",
    margin: { left: MARGIN.left + 260, right: 0 },
    tableWidth: 220,
    columnStyles: { 0: { cellWidth: 90, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
  });
  const rightY = doc.lastAutoTable.finalY;
  return Math.max(leftY, rightY);
}

function displayNaam(item, baseIndex) {
  if (item.type === "group") {
    const letters = "abcdefghijklmnopqrstuvwxyz".split("");
    const parts = item.items.map((it, idx) => `${baseIndex}${letters[idx]} ${it}`);
    return parts.join("\n");
  }
  return item.naam;
}

function countScoringLines(items) {
  return (items || []).reduce((acc) => acc + 1, 0);
}

function obstaclesTable(doc, obstakels, startY) {
  autoTable(doc, {
    startY,
    head: [["#", "Obstakel (volgorde)", "Heel", "Half", "Opmerking"]],
    body: (obstakels || []).map((o, i) => [i + 1, displayNaam(o, i + 1), "", "", ""]),
    styles: {
      fontSize: 10,
      cellPadding: { top: 5, right: 5, bottom: 10, left: 5 },
      lineColor: BORDER,
      lineWidth: 0.2,
      valign: "top",
    },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === 1) d.cell.styles.valign = "top";
    },
    headStyles: { fillColor: LIGHT_HEAD, textColor: 0, fontStyle: "bold" },
    theme: "grid",
    margin: MARGIN,
    columnStyles: {
      0: { cellWidth: COL_NUM,  halign: "center" },
      1: { cellWidth: COL_NAME },
      2: { cellWidth: COL_H,    halign: "center" },
      3: { cellWidth: COL_HALF, halign: "center" },
      4: { cellWidth: "auto" },
    },
  });
  return doc.lastAutoTable.finalY;
}

function generalPointsTable(doc, punten, startY, startIndex = 1) {
  autoTable(doc, {
    startY,
    head: [["#", "Algemene punten", "Heel", "Half", "Opmerking"]],
    body: punten.map((naam, i) => [startIndex + i, naam, "", "", ""]),
    styles: {
      fontSize: 10,
      cellPadding: { top: 5, right: 5, bottom: 12, left: 5 },
      lineColor: BORDER,
      lineWidth: 0.2,
    },
    headStyles: { fillColor: LIGHT_HEAD, textColor: 0, fontStyle: "bold" },
    theme: "grid",
    margin: MARGIN,
    columnStyles: {
      0: { cellWidth: COL_NUM,  halign: "center" },
      1: { cellWidth: COL_NAME },
      2: { cellWidth: COL_H,    halign: "center" },
      3: { cellWidth: COL_HALF, halign: "center" },
      4: { cellWidth: "auto" },
    },
  });
  return doc.lastAutoTable.finalY;
}

function totalsBox(doc, startY, maxPoints = null) {
  const totalLabel = maxPoints ? `Totaal (${maxPoints} max. punten)` : "Totaal";
  autoTable(doc, {
    startY,
    head: [],
    body: [
      ["Subtotaal", ""],
      ["Puntenaftrek en reden", ""],
      [totalLabel, ""],
    ],
    styles: { fontSize: 10, cellPadding: 6, lineColor: BORDER, lineWidth: 0.2 },
    theme: "grid",
    margin: MARGIN,
    columnStyles: {
      0: { cellWidth: 180, fontStyle: "bold" },
      1: { cellWidth: "auto" },
    },
  });
  return doc.lastAutoTable.finalY;
}

function signatureLine(doc) {
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Handtekening jury:", MARGIN.left, pageH - 42);
  doc.line(MARGIN.left + 100, pageH - 44, doc.internal.pageSize.getWidth() - MARGIN.right, pageH - 44);
}

function protocolToDocModern(doc, p) {
  titleBar(doc, "Working Point • Stijltrail Protocol", `${p.klasse_naam || p.klasse}`);
  const infoY = infoBoxesSideBySide(doc, p);

  const afterObst = obstaclesTable(doc, p.obstakels || [], infoY + 16);

  const punten = (p.klasse === "we0" || p.klasse === "we1") ? ALG_PUNTEN_WE0_WE1 : ALG_PUNTEN_WE2PLUS;

  const scoringLines = countScoringLines(p.obstakels || []);
  const afterAlg = generalPointsTable(doc, punten, afterObst + 12, scoringLines + 1);

  const MAX_PER_ITEM = 10;
  const maxPoints = (scoringLines + punten.length) * MAX_PER_ITEM;

  totalsBox(doc, afterAlg + 6, maxPoints);
  signatureLine(doc);
}

function makePdfBlob(protocol) {
  const doc = new jsPDF({ unit: "pt", format: "A4" });
  protocolToDocModern(doc, protocol);
  return doc.output("blob");
}

export default function ProtocolGenerator() {
  const [stap, setStap] = useState(1);

  const [config, setConfig] = useState({
    klasse: "",
    wedstrijd: "",
    datum: new Date().toISOString().split("T")[0],
    jury: "",
  });

  const selectedKlasse = useMemo(
    () => KLASSEN.find((k) => k.code === config.klasse) || null,
    [config.klasse]
  );

  const [obstakels, setObstakels] = useState([]);
  const dragIndex = useRef(null);

  // Deelnemers CSV
  const [csvRows, setCsvRows] = useState([]);
  const [csvError, setCsvError] = useState("");

  // Voor PDF preview / enkele download
  const [selectIndex, setSelectIndex] = useState(0);
  const [pdfUrl, setPdfUrl] = useState(null);
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  // Bulk invoer obstakels
  const [bulkText, setBulkText] = useState("");
  const handleBulkAdd = () => {
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length);

    if (!lines.length) return;

    let next = [...obstakels];
    for (const line of lines) {
      if (next.length >= minMax.max) break;
      if (line.includes("|")) {
        const items = line.split("|").map((s) => s.trim()).filter(Boolean);
        next.push({ type: "group", items });
      } else {
        next.push({ type: "single", naam: line });
      }
    }
    setObstakels(next);
    setBulkText("");
  };

  const minMax = useMemo(() => {
    if (!selectedKlasse) return { min: 0, max: 0 };
    return { min: selectedKlasse.min, max: selectedKlasse.max };
  }, [selectedKlasse]);

  const catalogList = useMemo(() => {
    if (!selectedKlasse) return [];
    return (obstakelsCatalog?.[selectedKlasse.labelKey] ?? []).slice();
  }, [selectedKlasse]);

  const addSingle = (naam) => {
    setObstakels((prev) =>
      prev.length >= minMax.max ? prev : [...prev, { type: "single", naam }]
    );
  };
  const addGroup = (items) => {
    const clean = items.map((s) => s.trim()).filter(Boolean);
    if (!clean.length) return;
    setObstakels((prev) =>
      prev.length >= minMax.max ? prev : [...prev, { type: "group", items: clean }]
    );
  };
  const removeAt = (i) =>
    setObstakels((prev) => prev.filter((_, idx) => idx !== i));
  const onDragStart = (i) => (e) => {
    dragIndex.current = i;
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (i) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onDrop = (i) => (e) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === i) return;
    setObstakels((prev) => {
      const next = [...prev];
      const [m] = next.splice(from, 1);
      next.splice(i, 0, m);
      return next;
    });
    dragIndex.current = null;
  };

  const loadTemplate = () => {
    if (!selectedKlasse) return;
    const list =
      templates?.[selectedKlasse.labelKey] && Array.isArray(templates[selectedKlasse.labelKey])
        ? templates[selectedKlasse.labelKey]
        : [];
    if (!list.length) return;

    let next = [...obstakels];
    for (const entry of list) {
      if (next.length >= minMax.max) break;
      if (Array.isArray(entry)) {
        const items = entry.map((x) => String(x).trim()).filter(Boolean);
        if (items.length) next.push({ type: "group", items });
      } else {
        next.push({ type: "single", naam: String(entry) });
      }
    }
    setObstakels(next);
  };

  const onCSV = (file) => {
    setCsvError("");
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const { headers, rows } = csvToRows(String(r.result || ""));
        const req = ["ruiter", "paard", "startnummer"];
        const low = headers.map((h) => h.toLowerCase().trim());
        if (!req.every((x) => low.includes(x))) {
          setCsvError("CSV moet kolommen bevatten: ruiter, paard, startnummer.");
          setCsvRows([]);
          return;
        }
        const idx = Object.fromEntries(low.map((h, i) => [h, i]));
        const norm = rows
          .map((row) => ({
            ruiter: row[headers[idx["ruiter"]]] || row["ruiter"] || "",
            paard: row[headers[idx["paard"]]] || row["paard"] || "",
            startnummer:
              row[headers[idx["startnummer"]]] || row["startnummer"] || "",
          }))
          .filter((x) => x.ruiter || x.paard);
        setCsvRows(norm);
      } catch {
        setCsvError("Kon CSV niet lezen. Controleer het bestand.");
        setCsvRows([]);
      }
    };
    r.readAsText(file, "utf-8");
  };

  function importFromStorage() {
    try {
      const csv = localStorage.getItem("wp_startlijst_csv") || "";
      if (!csv.trim()) {
        alert("Geen startlijst gevonden in opslag.");
        return;
      }
      const { headers, rows } = csvToRows(csv);
      const req = ["ruiter", "paard", "startnummer"];
      const low = headers.map((h) => h.toLowerCase().trim());
      if (!req.every((x) => low.includes(x))) {
        alert("Opgeslagen startlijst mist verplichte kolommen.");
        return;
      }
      const idx = Object.fromEntries(low.map((h, i) => [h, i]));
      const norm = rows
        .map((row) => ({
          ruiter: row[headers[idx["ruiter"]]] || row["ruiter"] || "",
          paard: row[headers[idx["paard"]]] || row["paard"] || "",
          startnummer:
            row[headers[idx["startnummer"]]] || row["startnummer"] || "",
        }))
        .filter((x) => x.ruiter || x.paard);
      setCsvRows(norm);
      alert("Startlijst geïmporteerd ✔️");
    } catch {
      alert("Kon startlijst niet importeren.");
    }
  }
  function clearStorageStartlijst() {
    localStorage.removeItem("wp_startlijst_csv");
    alert("Startlijst in opslag gewist.");
  }

  const protocollen = useMemo(
    () =>
      csvRows.map((d, idx) => ({
        type: "stijltrail",
        klasse: config.klasse,
        klasse_naam:
          KLASSEN.find((k) => k.code === config.klasse)?.naam || config.klasse,
        wedstrijd: config.wedstrijd || "",
        datum: config.datum || "",
        jury: config.jury || "",
        startnummer: d.startnummer || String(idx + 1),
        ruiter: d.ruiter || "",
        paard: d.paard || "",
        obstakels,
      })),
    [csvRows, config, obstakels]
  );

  const previewPdf = () => {
    const p = protocollen[selectIndex];
    const blob = makePdfBlob(p);
    const url = URL.createObjectURL(blob);
    setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
  };
  const openNewTab = () => {
    const p = protocollen[selectIndex];
    const blob = makePdfBlob(p);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  const downloadSingle = () => {
    const p = protocollen[selectIndex];
    const blob = makePdfBlob(p);
    const a = document.createElement("a");
    const safe = (s) => String(s || "").replace(/[^\w\-]+/g, "_").slice(0, 40);
    a.href = URL.createObjectURL(blob);
    a.download = `${safe(p.startnummer)}-${safe(p.ruiter)}-${safe(p.paard)}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const downloadBatch = () => {
    const doc = new jsPDF({ unit: "pt", format: "A4" });
    protocollen.forEach((p, i) => { if (i > 0) doc.addPage(); protocolToDocModern(doc, p); });
    doc.save("protocollen_stijltrail.pdf");
  };

  const Header = () => (
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:"1px solid #eee",position:"sticky",top:0,background:"#fff",zIndex:10}}>
      <div style={{fontWeight:700,fontSize:18,color:"#102754"}}>WE Protocol Generator</div>
      <div style={{marginLeft:"auto",fontSize:12,color:"#667085"}}>
        <a href="#/" style={{ color:"#2b6cb0", textDecoration:"none" }}>Inschrijven</a>
        {" · "}
        <a href="#/startlijst" style={{ color:"#2b6cb0", textDecoration:"none" }}>Startlijst</a>
      </div>
    </div>
  );

  const tooFew = obstakels.length < minMax.min;
  const tooMany = obstakels.length > minMax.max;

  const viewStap1 = (
    <>
      <Header />
      <div style={{ maxWidth: 680, margin: "24px auto" }}>
        <h2>Stijltrail – wedstrijdconfig</h2>
        <div style={{display:"grid",gridTemplateColumns:"180px 1fr",gap:"10px 12px",alignItems:"center"}}>
          <label>Klasse:</label>
          <select value={config.klasse} onChange={(e)=>{ setConfig(c=>({...c, klasse:e.target.value})); setObstakels([]); }}>
            <option value="">— kies klasse —</option>
            {KLASSEN.map(k=><option key={k.code} value={k.code}>{k.naam}</option>)}
          </select>
          <label>Naam wedstrijd (optioneel):</label>
          <input value={config.wedstrijd} onChange={(e)=>setConfig(c=>({...c, wedstrijd:e.target.value}))}/>
          <label>Datum (optioneel):</label>
          <input type="date" value={config.datum} onChange={(e)=>setConfig(c=>({...c, datum:e.target.value}))}/>
          <label>Jury (optioneel):</label>
          <input value={config.jury} onChange={(e)=>setConfig(c=>({...c, jury:e.target.value}))}/>
        </div>
        <div style={{ marginTop: 18 }}>
          <button onClick={() => setStap(2)} disabled={!config.klasse}>
            Volgende: Obstakels & Deelnemers
          </button>
        </div>
      </div>
    </>
  );

  const viewStap2 = (
    <>
      <Header />
      <div style={{ maxWidth: 1200, margin: "24px auto" }}>
        <h2>Obstakels & deelnemers</h2>

        <div style={{display:"grid",gridTemplateColumns:"1fr 420px",gap:24,alignItems:"start"}}>
          <div>
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              <button onClick={loadTemplate} disabled={!selectedKlasse}>
                Template laden ({selectedKlasse?.labelKey ?? "—"})
              </button>
              <span style={{ color:"#666", fontSize:13 }}>Tip: groep = gebruik <code>|</code> tussen onderdelen</span>
            </div>

            <div style={{ marginTop: 12 }}>
              <b>Snel toevoegen</b>
              <textarea
                placeholder={"Voorbeeld:\nBrug\nGarrocha uit ton pakken | Ringsteken | Garrocha in een ton zetten\nParallelslalom"}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={5}
                style={{ width: "100%", marginTop: 6 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleBulkAdd} disabled={!bulkText.trim()}>Regels toevoegen</button>
                <button onClick={() => setBulkText("")}>Leeg maken</button>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Catalogus (klik om toe te voegen)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {catalogList.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => addSingle(name)}
                    disabled={obstakels.length >= minMax.max}
                    title="Klik om toe te voegen; duplicaten toegestaan"
                    style={{ border: "1px solid #ddd", borderRadius: 999, padding: "6px 10px", background: "#fff" }}
                  >+ {name}</button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                Gekozen volgorde ({obstakels.length}) {tooFew ? `— min ${minMax.min}` : ""} {tooMany ? `— max ${minMax.max}` : ""}
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, border:"1px dashed #cbd5e1", padding:10, borderRadius:12, background:"#fafafa" }}>
                {obstakels.length === 0 && <span style={{ color:"#777" }}>Sleep/klik obstakels hier</span>}
                {obstakels.map((ob, i) => (
                  <div
                    key={`ob-${i}`}
                    draggable onDragStart={onDragStart(i)} onDragOver={onDragOver(i)} onDrop={onDrop(i)}
                    style={{ display:"inline-flex", alignItems:"center", gap:8, border:"1px solid #ddd", borderRadius:12, padding:"6px 10px", background:"#fff", cursor:"grab", maxWidth:360 }}
                    title="Slepen om te herordenen"
                  >
                    <span style={{ width:22, height:22, borderRadius:999, background:"#eef2ff", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700 }}>{i + 1}</span>
                    <span style={{ whiteSpace:"pre-wrap" }}>{ob.type === "single" ? ob.naam : ob.items.join(" | ")}</span>
                    <button type="button" onClick={() => removeAt(i)} style={{ border:"none", background:"transparent", cursor:"pointer" }} title="Verwijder">✕</button>
                  </div>
                ))}
              </div>
            </div>

            <hr style={{ margin: "24px 0" }} />

            <h3>Deelnemers</h3>
            <p>Upload CSV of importeer de startlijst die je zojuist opstelde.</p>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
              <input type="file" accept=".csv,text/csv" onChange={(e)=>onCSV(e.target.files?.[0])}/>
              <button onClick={downloadCSVTemplate}>Download CSV template</button>
              <button onClick={importFromStorage}>Importeer startlijst uit opslag</button>
              <button onClick={clearStorageStartlijst}>Wis opslag</button>
            </div>
            {csvError && <div style={{ color:"crimson", marginTop: 8 }}>{csvError}</div>}
            {csvRows.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <b>{csvRows.length}</b> deelnemer(s) ingelezen.
                <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid #eee", marginTop: 8 }}>
                  <table width="100%" cellPadding={6} style={{ borderCollapse: "collapse" }}>
                    <thead><tr style={{ background: "#f7f7f7" }}><th align="left">Startnr</th><th align="left">Ruiter</th><th align="left">Paard</th></tr></thead>
                    <tbody>{csvRows.map((r,i)=>(<tr key={i} style={{ borderTop:"1px solid #f0f0f0" }}><td>{r.startnummer}</td><td>{r.ruiter}</td><td>{r.paard}</td></tr>))}</tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
              <button onClick={() => setStap(1)}>Terug</button>
              <button
                onClick={() => setStap(3)}
                disabled={obstakels.length < minMax.min || obstakels.length > minMax.max || csvRows.length === 0}
              >Volgende: Overzicht & PDF</button>
            </div>
          </div>

          <div style={{ border:"1px solid #e5e7eb", borderRadius:12, padding:12, background:"#fff" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Preview obstakels (volgorde)</div>
            <table width="100%" cellPadding={6} style={{ borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr style={{ background: "#f7f7f7" }}><th align="left" style={{ width:60 }}>#</th><th align="left">Obstakel</th></tr></thead>
              <tbody>
                {obstakels.map((o,i)=>(
                  <tr key={`prev-${i}`} style={{ borderTop:"1px solid #f0f0f0" }}>
                    <td>{i+1}</td>
                    <td>{o.type==="single" ? o.naam : <div style={{ whiteSpace:"pre-wrap" }}>{o.items.map((it,idx)=>`${i+1}${String.fromCharCode(97+idx)} ${it}`).join("\n")}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {obstakels.length===0 && <div style={{ color:"#777" }}>Nog geen obstakels geselecteerd</div>}
          </div>
        </div>
      </div>
    </>
  );

  const viewStap3 = (
    <>
      <Header />
      <div style={{ maxWidth: 1100, margin: "24px auto" }}>
        <h2>Overzicht & export</h2>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", margin:"8px 0 16px" }}>
          <button onClick={downloadBatch}>Download batch PDF</button>
          <span style={{ display:"inline-flex", gap:8, alignItems:"center" }}>
            <select value={selectIndex} onChange={(e)=>setSelectIndex(Number(e.target.value))}>
              {protocollen.map((p,i)=>(<option key={i} value={i}>{p.startnummer} – {p.ruiter} – {p.paard}</option>))}
            </select>
            <button onClick={downloadSingle}>Download gekozen protocol</button>
            <button onClick={previewPdf}>Bekijk in pagina</button>
            <button onClick={openNewTab}>Open in nieuw tabblad</button>
          </span>
          <a href="#/startlijst"><button>Terug naar Startlijst</button></a>
        </div>

        {pdfUrl && <iframe src={pdfUrl} title="PDF preview" style={{ width:"100%", height:"680px", border:"1px solid #ccc", borderRadius:8 }} />}
      </div>
    </>
  );

  if (stap === 1) return viewStap1;
  if (stap === 2) return viewStap2;
  if (stap === 3) return viewStap3;
  return null;
}
