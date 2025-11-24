import React, { useEffect, useMemo, useState } from "react";
// jsPDF / autoTable are heavy and can execute code on module init in some builds.
// Load them on-demand in the functions that need them to avoid initialization-order
// errors in the app bundle (see Startlijst dynamic import approach).
let autoTable = null;
import { supabase } from "@/lib/supabaseClient";
import { padStartnummer, lookupOffset } from '@/lib/startnummer';
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";

/* Klassen & Onderdelen */
const KLASSEN = [
  { code: "we0", labelKey: "WE0", naam: "Introductieklasse (WE0)", min: 6,  max: 8  },
  { code: "we1", labelKey: "WE1", naam: "WE1",                       min: 6,  max: 10 },
  { code: "we2", labelKey: "WE2", naam: "WE2",                       min: 8,  max: 12 },
  { code: "we2p", labelKey: "WE2+", naam: "WE2+",                     min: 8,  max: 12 },
  { code: "we3", labelKey: "WE3", naam: "WE3",                       min: 10, max: 14 },
  { code: "we4", labelKey: "WE4", naam: "WE4",                       min: 12, max: 16 },
  { code: "yr", labelKey: "YR", naam: "Young Riders",                min: 6,  max: 10 },
  { code: "junior", labelKey: "JR", naam: "Junioren",               min: 6,  max: 10 },
];
const ONDERDELEN = [
  { code: "dressuur", label: "Dressuur" },
  { code: "stijl", label: "Stijltrail" },
  { code: "speed", label: "Speedtrail" },
];

/* Algemene punten (Stijltrail) */
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

/* PDF helpers */
const BLUE = [16, 39, 84];
const LIGHT_HEAD = [240, 243, 249];
const BORDER = [223, 227, 235];
const MARGIN = { left: 40, right: 40 };
const COL_NUM  = 26;
const COL_NAME = 260;
const COL_H    = 40;
const COL_HALF = 40;

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
      ["Wedstrijd", info.wedstrijd_naam || ""],
      ["Datum", info.datum || ""],
      ["Jury", info.jury || ""],
      ["Klasse", info.klasse_naam || info.klasse || ""],
      ["Onderdeel", info.onderdeel_label || info.onderdeel || ""],
    ],
    styles: { fontSize: 10, cellPadding: 5, lineColor: BORDER, lineWidth: 0.2 },
    theme: "grid",
    margin: { left: MARGIN.left, right: 0 },
    tableWidth: 300,
    columnStyles: { 0: { cellWidth: 100, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
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
    margin: { left: MARGIN.left + 320, right: 0 },
    tableWidth: 220,
    columnStyles: { 0: { cellWidth: 90, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
  });
  const rightY = doc.lastAutoTable.finalY;
  return Math.max(leftY, rightY);
}
function obstaclesTable(doc, items, startY) {
  autoTable(doc, {
    startY,
    head: [["#", "Onderdeel / obstakel", "Heel", "Half", "Opmerking"]],
    body: (items || []).map((o, i) => [i + 1, o, "", "", ""]),
    styles: { fontSize: 10, cellPadding: { top: 5, right: 5, bottom: 10, left: 5 }, lineColor: BORDER, lineWidth: 0.2, valign: "top" },
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
    styles: { fontSize: 10, cellPadding: { top: 5, right: 5, bottom: 12, left: 5 }, lineColor: BORDER, lineWidth: 0.2 },
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
function totalsBox(doc, startY, maxPoints = null, extraLabel = null) {
  const totalLabel = maxPoints ? `Totaal (${maxPoints} max. punten)` : "Totaal";
  autoTable(doc, {
    startY, head: [],
    body: [
      ["Subtotaal", ""],
      ["Puntenaftrek en reden", ""],
      [extraLabel || totalLabel, ""],
    ],
    styles: { fontSize: 10, cellPadding: 6, lineColor: BORDER, lineWidth: 0.2 },
    theme: "grid", margin: MARGIN, columnStyles: { 0: { cellWidth: 220, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
  });
  return doc.lastAutoTable.finalY;
}
function signatureLine(doc) {
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Handtekening jury:", MARGIN.left, pageH - 42);
  doc.line(MARGIN.left + 120, pageH - 44, doc.internal.pageSize.getWidth() - MARGIN.right, pageH - 44);
}
function protocolToDoc(doc, p, items) {
  const title = p.onderdeel === "dressuur" ? "Working Point • Dressuurprotocol"
               : p.onderdeel === "stijl" ? "Working Point • Stijltrail Protocol"
               : "Working Point • Speedtrail Protocol";
  titleBar(doc, title, `${p.klasse_naam || p.klasse}`);
  const infoY = infoBoxesSideBySide(doc, p);
  const afterItems = obstaclesTable(doc, items, infoY + 16);
  let afterAlg = afterItems;
  if (p.onderdeel === "stijl") {
    const punten = (p.klasse === "we0" || p.klasse === "we1") ? ALG_PUNTEN_WE0_WE1 : ALG_PUNTEN_WE2PLUS;
    afterAlg = generalPointsTable(doc, punten, afterItems + 12, items.length + 1);
  }
  const maxPoints = p.max_score ? Number(p.max_score) : null;
  const isSpeed = p.onderdeel === "speed";
  totalsBox(doc, afterAlg + 6, isSpeed ? null : maxPoints, isSpeed ? "Tijd / Strafseconden / Totaal" : null);
  signatureLine(doc);
}
async function makePdfBlob(protocol, items) {
  const mod = await import('jspdf');
  const modAuto = await import('jspdf-autotable');
  const jsPDFLib = (mod && (mod.default || mod.jsPDF)) || mod;
  autoTable = (modAuto && (modAuto.default || modAuto)) || modAuto;
  const doc = new (jsPDFLib.default || jsPDFLib)({ unit: "pt", format: "A4" });
  protocolToDoc(doc, protocol, items);
  return doc.output("blob");
}

export default function ProtocolGenerator() {
  const { items: wedstrijden } = useWedstrijden(false);
  const [stap, setStap] = useState(1);
  const [config, setConfig] = useState({
    wedstrijd_id: "",
    klasse: "",
    onderdeel: "stijl",
    datum: new Date().toISOString().split("T")[0],
    jury: ""
  });
  const selectedWedstrijd = useMemo(
    () => wedstrijden.find(w => w.id === config.wedstrijd_id) || null,
    [wedstrijden, config.wedstrijd_id]
  );

  // DB-config + items
  const [dbMsg, setDbMsg] = useState("");
  const [dbMax, setDbMax] = useState(null);
  const [items, setItems] = useState([]);
  const [dbHint, setDbHint] = useState('');

  // Deelnemers (CSV) + preview index + preview URL
  const [csvRows, setCsvRows] = useState([]);
  const [dbRows, setDbRows] = useState([]); // deelnemers geladen uit DB
  const [selectIndex, setSelectIndex] = useState(0);
  const [selectedRubriek, setSelectedRubriek] = useState('senior');
  const [pdfUrl, setPdfUrl] = useState(null);
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  // Proefconfig ophalen
  useEffect(() => {
    let alive = true;
    (async () => {
      setDbMsg(""); setDbMax(null); setItems([]);
      if (!config.wedstrijd_id || !config.klasse || !config.onderdeel) return;
      try {
        const { data: proef, error: e1 } = await supabase
          .from("proeven").select("id, max_score, naam")
          .eq("wedstrijd_id", config.wedstrijd_id)
          .eq("klasse", config.klasse)
          .eq("onderdeel", config.onderdeel)
          .order("created_at", { ascending: true })
          .limit(1).maybeSingle();
        if (e1) throw e1;
        if (!proef) { setDbMsg("Geen proefconfig gevonden voor deze selectie."); return; }
        const { data: its, error: e2 } = await supabase
          .from("proeven_items").select("nr, omschrijving").eq("proef_id", proef.id).order("nr", { ascending: true });
        if (e2) throw e2;
        if (!alive) return;
        setItems((its || []).map(it => it.omschrijving));
        setDbMax(proef.max_score || null);
        setDbMsg(`Proef geladen: ${proef.naam} (${(its||[]).length} onderdelen)`);
      } catch (e) {
        if (!alive) return;
        setDbMsg("Kon proeven niet laden: " + (e?.message || String(e)));
      }
    })();
    return () => { alive = false; };
  }, [config.wedstrijd_id, config.klasse, config.onderdeel]);

  // helper: klasse-based startnummer offsets (same mapping as Startlijst)
  function klasseStartOffset(code) {
    switch((code || '').toLowerCase()) {
      case 'we0': return 1;
      case 'we1': return 101;
      case 'we2': return 201;
      case 'we3': return 301;
      case 'we4': return 401;
      case 'junior': return 501;
      case 'yr': return 601;
      case 'we2p': return 701;
      default: return 1;
    }
  }

  // load deelnemers directly from inschrijvingen table for selected wedstrijd+klasse
  async function loadDeelnemersFromDB() {
    if (!config.wedstrijd_id || !config.klasse) { setDbMsg('Selecteer wedstrijd en klasse eerst'); return; }
    setDbMsg('Laden...');
    try {
      const { data, error } = await supabase.from('inschrijvingen').select('ruiter,paard,startnummer,rubriek').eq('wedstrijd_id', config.wedstrijd_id).eq('klasse', config.klasse).order('startnummer', { ascending: true });
      
      if (error) {
        console.warn("Database error, trying localStorage:", error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        // Try localStorage fallback
        const storageKey = `startlijst_${config.wedstrijd_id}`;
        const stored = localStorage.getItem(storageKey) || localStorage.getItem('wp_startlijst_cache_v1');
        
        if (stored) {
          const parsed = JSON.parse(stored);
          const klasseNorm = config.klasse.toLowerCase().replace(/[^a-z0-9]/g, '');
          const filtered = parsed.filter(r => {
            if (r.type !== 'entry') return false;
            const rowKlasse = (r.klasse || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return rowKlasse === klasseNorm;
          });
          
          const norm = filtered.map((r, i) => ({
            ruiter: r.ruiter || '',
            paard: r.paard || '',
            rubriek: r.rubriek || selectedRubriek || 'senior',
            startnummer: r.startnummer || String(lookupOffset(config.klasse, (r.rubriek || selectedRubriek || 'senior'), selectedWedstrijd?.startlijst_config) + i)
          }));
          
          setDbRows(norm);
          setDbMsg(`✅ ${norm.length} deelnemers geladen (localStorage)`);
          setDbHint('');
          return;
        }
        
        setDbMsg('⚠️ Geen deelnemers gevonden');
        return;
      }
      
      const norm = (data || []).map((r, i) => ({
        ruiter: r.ruiter || '',
        paard: r.paard || '',
        rubriek: r.rubriek || selectedRubriek || 'senior',
        startnummer: (r.startnummer != null && r.startnummer !== '') ? String(r.startnummer) : String( lookupOffset(config.klasse, (r.rubriek || selectedRubriek || 'senior'), selectedWedstrijd?.startlijst_config) + i )
      }));
      setDbRows(norm);
      setDbMsg(`Gevonden ${norm.length} deelnemers uit DB`);
      setDbHint('');
    } catch (e) {
      const em = (e?.message || String(e));
      console.error("Load error, trying localStorage:", e);
      
      // Fallback to localStorage
      const storageKey = `startlijst_${config.wedstrijd_id}`;
      const stored = localStorage.getItem(storageKey) || localStorage.getItem('wp_startlijst_cache_v1');
      
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const klasseNorm = config.klasse.toLowerCase().replace(/[^a-z0-9]/g, '');
          const filtered = parsed.filter(r => {
            if (r.type !== 'entry') return false;
            const rowKlasse = (r.klasse || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return rowKlasse === klasseNorm;
          });
          
          const norm = filtered.map((r, i) => ({
            ruiter: r.ruiter || '',
            paard: r.paard || '',
            rubriek: r.rubriek || selectedRubriek || 'senior',
            startnummer: r.startnummer || String(lookupOffset(config.klasse, (r.rubriek || selectedRubriek || 'senior'), selectedWedstrijd?.startlijst_config) + i)
          }));
          
          setDbRows(norm);
          setDbMsg(`✅ ${norm.length} deelnemers geladen (localStorage - database niet beschikbaar)`);
          setDbHint('');
        } catch (parseErr) {
          setDbMsg('Kon deelnemers niet laden: ' + em);
        }
      } else {
        setDbMsg('⚠️ Geen opgeslagen data gevonden (database niet beschikbaar)');
      }
    }
  }

  // use shared padStartnummer from '@/lib/startnummer'

  // CSV helpers
  function csvToRows(text) {
    const sep = text.includes(";") && !text.includes(",") ? ";" : ",";
    const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim().length);
    if (!lines.length) return { headers: [], rows: [] };
    const headers = splitCSVLine(lines[0], sep);
    const rows = lines.slice(1).map(l => splitCSVLine(l, sep)).map(cols => {
      const o = {}; headers.forEach((h,i)=>o[h.trim()] = (cols[i] ?? "").trim()); return o;
    });
    return { headers, rows };
  }
  function splitCSVLine(line, sep) {
    const out=[], n=line.length; let cur="", inQ=false;
    for (let i=0;i<n;i++){
      const c=line[i];
      if (c=='"'){ if(inQ && line[i+1]=='"'){cur+='"'; i++;} else inQ=!inQ; }
      else if (c===sep && !inQ){ out.push(cur); cur=""; }
      else cur+=c;
    }
    out.push(cur); return out;
  }
  const onCSV = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const { headers, rows } = csvToRows(String(r.result || ""));
        const req = ["ruiter", "paard", "startnummer"];
        const low = headers.map((h) => h.toLowerCase().trim());
        if (!req.every((x) => low.includes(x))) { alert("CSV moet kolommen bevatten: ruiter, paard, startnummer."); return; }
        const idx = Object.fromEntries(low.map((h, i) => [h, i]));
        const norm = rows.map(row => ({
          ruiter: row[headers[idx["ruiter"]]] || row["ruiter"] || "",
          paard: row[headers[idx["paard"]]] || row["paard"] || "",
          startnummer: row[headers[idx["startnummer"]]] || row["startnummer"] || "",
        })).filter(x => x.ruiter || x.paard);
        setCsvRows(norm);
      } catch { alert("Kon CSV niet lezen."); }
    };
    r.readAsText(file, "utf-8");
  };

  const protocollen = useMemo(() => {
    const src = (dbRows && dbRows.length) ? dbRows : csvRows;
    return (src || []).map((d, idx) => ({
      onderdeel: config.onderdeel,
      klasse: config.klasse,
      klasse_naam: KLASSEN.find((k) => k.code === config.klasse)?.naam || config.klasse,
      wedstrijd_id: config.wedstrijd_id,
      wedstrijd_naam: selectedWedstrijd?.naam || "",
      datum: config.datum || "",
      jury: config.jury || "",
      rubriek: d.rubriek || selectedRubriek || 'senior',
  // use provided startnummer or default to class-offset + index; pad to 3 digits
  startnummer: padStartnummer(d.startnummer || String( (dbRows && dbRows.length) ? (Number(d.startnummer) || String( lookupOffset(config.klasse, d.rubriek || selectedRubriek || 'senior', selectedWedstrijd?.startlijst_config) + idx )) : String(idx + 1) )),
      ruiter: d.ruiter || "",
      paard: d.paard || "",
      max_score: dbMax,
      onderdeel_label: ONDERDELEN.find(o=>o.code===config.onderdeel)?.label || config.onderdeel
    }));
  }, [csvRows, dbRows, config, selectedWedstrijd, dbMax]);

  // PDF actions
  const previewPdf = async () => {
    if (!protocollen.length) return;
    const p = protocollen[selectIndex] || protocollen[0];
    const blob = await makePdfBlob(p, items);
    const url = URL.createObjectURL(blob);
    setPdfUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
  };
  const openNewTab = async () => {
    if (!protocollen.length) return;
    const p = protocollen[selectIndex] || protocollen[0];
    const blob = await makePdfBlob(p, items);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  const downloadSingle = async () => {
    if (!protocollen.length) return;
    const p = protocollen[selectIndex] || protocollen[0];
    const blob = await makePdfBlob(p, items);
    const a = document.createElement("a");
    const safe = (s) => String(s || "").replace(/[^\w\-]+/g, "_").slice(0, 40);
    a.href = URL.createObjectURL(blob);
    const sn = padStartnummer(p.startnummer);
    a.download = `${safe(p.onderdeel)}-${safe(sn)}-${safe(p.ruiter)}-${safe(p.paard)}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const downloadBatch = async () => {
    if (!protocollen.length) return;
    const mod = await import('jspdf');
    const modAuto = await import('jspdf-autotable');
    const jsPDFLib = (mod && (mod.default || mod.jsPDF)) || mod;
    autoTable = (modAuto && (modAuto.default || modAuto)) || modAuto;
    const doc = new (jsPDFLib.default || jsPDFLib)({ unit: "pt", format: "A4" });
    protocollen.forEach((p, i) => { if (i > 0) doc.addPage(); protocolToDoc(doc, p, items); });
    doc.save(`protocollen_${config.onderdeel}.pdf`);
  };

  const Header = () => (
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:"1px solid #eee",position:"sticky",top:0,background:"#fff",zIndex:10}}>
      <div style={{fontWeight:700,fontSize:18,color:"#102754"}}>WE Protocol Generator</div>
      <div style={{marginLeft:"auto",fontSize:12,color:"#667085"}}>
        <a href="#/" style={{ color:"#2b6cb0", textDecoration:"none" }}>Inschrijven</a>{" · "}
        <a href="#/startlijst" style={{ color:"#2b6cb0", textDecoration:"none" }}>Startlijst</a>{" · "}
        <a href="#/wedstrijden" style={{ color:"#2b6cb0", textDecoration:"none" }}>Wedstrijden</a>
      </div>
    </div>
  );

  const viewStap1 = (
    <>
      <Header />
      <div style={{ maxWidth: 900, margin: "24px auto" }}>
        <h2>Protocollen configureren</h2>
        <div style={{display:"grid",gridTemplateColumns:"200px 1fr 200px 1fr",gap:"10px 12px",alignItems:"center"}}>
          <label>Wedstrijd*</label>
          <select value={config.wedstrijd_id} onChange={(e)=>setConfig(c=>({...c, wedstrijd_id:e.target.value}))}>
            <option value="">— kies wedstrijd —</option>
            {wedstrijden.map(w => <option key={w.id} value={w.id}>{w.naam} {w.datum ? `(${w.datum})` : ""}</option>)}
          </select>

          <label>Klasse*</label>
          <select value={config.klasse} onChange={(e)=>setConfig(c=>({...c, klasse:e.target.value}))}>
            <option value="">— kies klasse —</option>
            {KLASSEN.map(k=><option key={k.code} value={k.code}>{k.naam}</option>)}
          </select>

          <label>Onderdeel*</label>
          <select value={config.onderdeel} onChange={(e)=>setConfig(c=>({...c, onderdeel:e.target.value}))}>
            {ONDERDELEN.map(o=> <option key={o.code} value={o.code}>{o.label}</option>)}
          </select>

          <label>Datum (optioneel)</label>
          <input type="date" value={config.datum} onChange={(e)=>setConfig(c=>({...c, datum:e.target.value}))}/>

          <label>Jury (optioneel)</label>
          <input value={config.jury} onChange={(e)=>setConfig(c=>({...c, jury:e.target.value}))}/>

          <label>Rubriek</label>
          <select value={selectedRubriek} onChange={(e)=>setSelectedRubriek(e.target.value)}>
            <option value="senior">Senior</option>
            <option value="jeugd">Jeugd</option>
          </select>
        </div>

        <div style={{ marginTop: 6, fontSize: 12, color: "#555" }}>{dbMsg}</div>

        <div style={{ marginTop: 18 }}>
          <button onClick={() => setStap(2)} disabled={!config.wedstrijd_id || !config.klasse || !config.onderdeel}>
            Volgende: Items & Deelnemers
          </button>
        </div>
      </div>
    </>
  );

  const viewStap2 = (
    <>
      <Header />
      <div style={{ maxWidth: 1200, margin: "24px auto" }}>
        <h2>Items & deelnemers</h2>

        <div style={{display:"grid",gridTemplateColumns:"1fr 420px",gap:24,alignItems:"start"}}>
          <div>
            <div style={{ marginTop: 12 }}>
              <b>Items/onderdelen ({items.length})</b>
              <textarea
                placeholder={"Zet elk onderdeel op een nieuwe regel. Voor stijl/speed = obstakels. Voor dressuur = onderdelen."}
                value={items.join("\n")}
                onChange={(e) => setItems(e.target.value.split("\n"))}
                rows={10}
                style={{ width: "100%", marginTop: 6 }}
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <b>Startlijst</b>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                <input type="file" accept=".csv,text/csv" onChange={(e)=>onCSV(e.target.files?.[0])}/>
                <button onClick={loadDeelnemersFromDB}>Laad deelnemers uit DB</button>
                <button onClick={()=>{
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
                }}>Download CSV template</button>
                <button onClick={()=>{
                  try{
                    const csv = localStorage.getItem("wp_startlijst_csv") || "";
                    if (!csv.trim()) { alert("Geen startlijst in opslag."); return; }
                    const { headers, rows } = csvToRows(csv);
                    const req = ["ruiter", "paard", "startnummer"];
                    const low = headers.map((h) => h.toLowerCase().trim());
                    if (!req.every((x) => low.includes(x))) { alert("Startlijst mist verplichte kolommen."); return; }
                    const idx = Object.fromEntries(low.map((h, i) => [h, i]));
                    const norm = rows.map(row => ({
                      ruiter: row[headers[idx["ruiter"]]] || row["ruiter"] || "",
                      paard: row[headers[idx["paard"]]] || row["paard"] || "",
                      startnummer: row[headers[idx["startnummer"]]] || row["startnummer"] || "",
                    })).filter(x => x.ruiter || x.paard);
                    setCsvRows(norm);
                    alert("Startlijst geïmporteerd ✔️");
                  } catch { alert("Kon startlijst niet importeren."); }
                }}>Importeer startlijst uit opslag</button>
              </div>
            </div>
            {dbHint && (
              <div style={{ marginTop: 12, padding: 8, border: '1px dashed #e6f2ff', background: '#fcfeff' }}>
                <div style={{ fontWeight: 700 }}>Database probleem - mogelijke fix</div>
                <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', marginTop: 6 }}>{dbHint}</div>
                <div style={{ marginTop: 8 }}>
                  <button onClick={()=>{ try { navigator.clipboard.writeText(dbHint); setDbMsg('SQL gekopieerd naar Klembord'); } catch(e){ setDbMsg('Kopie mislukt'); } }}>Kopieer SQL</button>
                </div>
              </div>
            )}
          </div>

          <div style={{ border:"1px solid #e5e7eb", borderRadius:12, padding:12, background:"#fff" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Preview items</div>
            <table width="100%" cellPadding={6} style={{ borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr style={{ background: "#f7f7f7" }}><th align="left" style={{ width:60 }}>#</th><th align="left">Item</th></tr></thead>
              <tbody>
                {items.map((o,i)=>(
                  <tr key={`prev-${i}`} style={{ borderTop:"1px solid #f0f0f0" }}>
                    <td>{i+1}</td>
                    <td>{o}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length===0 && <div style={{ color:"#777" }}>Nog geen items</div>}
          </div>
        </div>

        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
          <button onClick={() => setStap(1)}>Terug</button>
          <button onClick={() => setStap(3)} disabled={!items.length || (csvRows.length === 0 && dbRows.length === 0)}>Volgende: Overzicht & PDF</button>
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
