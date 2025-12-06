import React, { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { padStartnummer, lookupOffset } from '@/lib/startnummer';
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";
import obstakelsData from "@/data/obstakels.json";
import defaultTemplates from "@/data/defaultTemplates.json";

// Globale variabelen voor dynamisch geladen libraries
let jsPDFLoaded = null;
let autoTableLoaded = null;

// Laad PDF libraries dynamisch
async function ensurePdfLibraries() {
  if (!jsPDFLoaded || !autoTableLoaded) {
    const jsPDFModule = await import('jspdf');
    jsPDFLoaded = jsPDFModule.default;
    const autoTableModule = await import('jspdf-autotable');
    autoTableLoaded = autoTableModule.default;
  }
  return { jsPDF: jsPDFLoaded, autoTable: autoTableLoaded };
}

/* Klassen & Onderdelen */
const KLASSEN = [
  { code: "we0", labelKey: "WE0", naam: "Introductieklasse (WE0)", min: 6,  max: 8  },
  { code: "we1", labelKey: "WE1", naam: "WE1",                       min: 6,  max: 10 },
  { code: "we2", labelKey: "WE2", naam: "WE2",                       min: 8,  max: 12 },
  { code: "we2p", labelKey: "WE2+", naam: "WE2+",                     min: 8,  max: 12 },
  { code: "we3", labelKey: "WE3", naam: "WE3",                       min: 10, max: 14 },
  { code: "we4", labelKey: "WE4", naam: "WE4",                       min: 12, max: 16 },
  { code: "yr", labelKey: "YR", naam: "Young Riders",                min: 10, max: 14 },
  { code: "junior", labelKey: "JR", naam: "Junioren",               min: 10, max: 14 },
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
  "Stap/galop/stap overgangen",
  "Zuiverheid van de gangen en regelmatigheid van de bewegingen van het paard",
  "Schwung, dynamiek, elasticiteit van de overgangen, losheid van de rugspieren",
  "Gehoorzaamheid, reactie op de hulpen, oplettendheid richting ruiter en vertrouwen in de ruiter",
  "Zit en rijwijze van de ruiter, effectiviteit van de hulpen",
];

/* PDF Layout Constanten */
const BLUE = [16, 39, 84];
const MARGIN = { left: 40, right: 40 };
const BORDER_COLOR = [160, 160, 160];
const HEADER_COLOR = [220, 230, 245];
const BORDER = BORDER_COLOR; 

// DRESSUUR & STIJL INDELING
// Veel ruimte voor notities, iets minder voor oefening tekst
const COL_WIDTHS = {
  NUM: 25,
  LETTER: 40,
  EXERCISE: 140,
  HEEL: 35,
  HALF: 35,
  NOTE: 240
};

// SPEEDTRAIL INDELING
const COL_WIDTHS_SPEED = {
  NUM: 25,
  OBSTACLE: 140,    
  RULE: 100,        
  SCORE: 45,
  NOTE: 205
};

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

function infoBoxesSideBySide(doc, info, autoTable) {
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
    styles: { fontSize: 9, cellPadding: 4, lineColor: BORDER, lineWidth: 0.5 },
    theme: "grid",
    margin: { left: MARGIN.left, right: 280 },
    tableWidth: "auto",
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
    styles: { fontSize: 9, cellPadding: 4, lineColor: BORDER, lineWidth: 0.5 },
    theme: "grid",
    margin: { left: MARGIN.left + 280, right: MARGIN.right },
    tableWidth: "auto",
    columnStyles: { 0: { cellWidth: 90, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
  });
  return Math.max(leftY, rightY);
}

function obstaclesTable(doc, items, startY) {
  const isSpeedData = items.length > 0 && Array.isArray(items[0]);
  let head, body, colStyles;

  if (isSpeedData) {
    head = [["#", "Hindernis", "Strafbepaling", "Straf", "Opmerking"]];
    body = items.map((row, i) => [i + 1, row[0], row[1], "", ""]);
    colStyles = {
      0: { cellWidth: COL_WIDTHS_SPEED.NUM, halign: "center" },
      1: { cellWidth: COL_WIDTHS_SPEED.OBSTACLE, halign: "left" },
      2: { cellWidth: COL_WIDTHS_SPEED.RULE, fontSize: 8, fontStyle: "italic", textColor: 80 },
      3: { cellWidth: COL_WIDTHS_SPEED.SCORE, halign: "center" },
      4: { cellWidth: COL_WIDTHS_SPEED.NOTE }
    };
  } else {
    head = [["#", "Onderdeel / obstakel", "Heel", "Half", "Opmerking"]];
    body = items.map((o, i) => [i + 1, o, "", "", ""]);
    colStyles = {
      0: { cellWidth: COL_WIDTHS.NUM, halign: "center" },
      1: { cellWidth: COL_WIDTHS.LETTER + COL_WIDTHS.EXERCISE },
      2: { cellWidth: COL_WIDTHS.HEEL, halign: "center" },
      3: { cellWidth: COL_WIDTHS.HALF, halign: "center" },
      4: { cellWidth: COL_WIDTHS.NOTE }
    };
  }

  autoTable(doc, {
    startY,
    head: head,
    body: body,
    styles: { 
      fontSize: 9, 
      cellPadding: { top: 8, right: 3, bottom: 8, left: 3 }, 
      lineColor: BORDER_COLOR, 
      lineWidth: 0.5, 
      valign: "middle",
      minCellHeight: 50 // Ruimte voor schrijven
    },
    headStyles: { 
      fillColor: HEADER_COLOR, 
      textColor: 0, 
      fontStyle: "bold", 
      fontSize: 8,
      cellPadding: 3,
      halign: "left" 
    },
    theme: "grid",
    margin: MARGIN,
    columnStyles: colStyles
  });
  return doc.lastAutoTable.finalY;
}

function generalPointsTable(doc, punten, startY, startIndex = 1) {
  autoTable(doc, {
    startY,
    head: [["#", "Algemene punten", "Heel", "Half", "Opmerking"]],
    body: punten.map((naam, i) => [startIndex + i, naam, "", "", ""]),
    styles: { 
      fontSize: 9, 
      cellPadding: { top: 8, right: 3, bottom: 8, left: 3 }, 
      lineColor: BORDER_COLOR, 
      lineWidth: 0.5,
      valign: "middle",
      minCellHeight: 45 // Ook hier ruimte voor opmerkingen
    },
    headStyles: { 
      fillColor: HEADER_COLOR, 
      textColor: 0, 
      fontStyle: "bold", 
      fontSize: 8,
      cellPadding: 3,
      halign: "left" 
    },
    theme: "grid",
    margin: MARGIN,
    columnStyles: {
      0: { cellWidth: COL_WIDTHS.NUM,  halign: "center" },
      1: { cellWidth: COL_WIDTHS.LETTER + COL_WIDTHS.EXERCISE },
      2: { cellWidth: COL_WIDTHS.HEEL,    halign: "center" },
      3: { cellWidth: COL_WIDTHS.HALF, halign: "center" },
      4: { cellWidth: COL_WIDTHS.NOTE },
    },
  });
  return doc.lastAutoTable.finalY;
}

function totalsBox(doc, startY, maxPoints = null, extraLabel = null, showPuntenaftrek = true, isDressuur = false, isSpeed = false) {
  let bodyRows = [];
  let colStyles = {};

  if (isSpeed) {
    bodyRows = [
      ["Totaal straftijd", "", ""],
      ["Gereden tijd", "", ""],
      ["Totaal tijd", "", ""]
    ];
    const labelWidth = COL_WIDTHS_SPEED.NUM + COL_WIDTHS_SPEED.OBSTACLE + COL_WIDTHS_SPEED.RULE;
    colStyles = {
      0: { cellWidth: labelWidth, halign: "left", fontStyle: "bold" }, 
      1: { cellWidth: COL_WIDTHS_SPEED.SCORE, halign: "center" },
      2: { cellWidth: COL_WIDTHS_SPEED.NOTE }
    };
  } else {
    const totalLabel = maxPoints ? `Totaal (max. ${maxPoints})` : "Totaal";
    bodyRows.push(["Subtotaal", "", "", ""]);
    if (showPuntenaftrek) {
      bodyRows.push(["Puntenaftrek en reden", "", "", ""]);
    }
    bodyRows.push([extraLabel || totalLabel, "", "", ""]);

    const labelWidth = COL_WIDTHS.NUM + COL_WIDTHS.LETTER + COL_WIDTHS.EXERCISE;
    colStyles = { 
      0: { cellWidth: labelWidth, halign: "left" },
      1: { cellWidth: COL_WIDTHS.HEEL, halign: "center" },
      2: { cellWidth: COL_WIDTHS.HALF, halign: "center" },
      3: { cellWidth: COL_WIDTHS.NOTE }
    };
  }
  
  autoTable(doc, {
    startY, 
    head: [],
    body: bodyRows,
    styles: { 
      fontSize: 9, 
      cellPadding: 5, 
      lineColor: BORDER_COLOR, 
      lineWidth: 0.5, 
      fontStyle: "bold" 
    },
    theme: "grid", 
    margin: MARGIN, 
    columnStyles: colStyles
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
  
  // DRESSUUR LOGICA
  if (p.onderdeel === "dressuur") {
    const tableData = [];
    const algemenePuntenData = [];
    let currentGroup = null;
    let groupNumber = 0;
    let inAlgemenePunten = false;
    
    items.forEach((item) => {
      if (Array.isArray(item) && item.length >= 2) {
        const letter = item[0] || "";
        const oefening = item[1] || "";
        const beoordeling = item[3] || item[2] || "";
        
        // Detecteer algemene punten (o.a. 'Gangen', 'Impuls', etc)
        // Als letter en beoordeling leeg zijn, en oefening bevat trefwoorden
        if (!letter && !beoordeling && (
          oefening.toLowerCase().includes("gangen") ||
          oefening.toLowerCase().includes("impuls") ||
          oefening.toLowerCase().includes("gehoorzaamheid") ||
          oefening.toLowerCase().includes("harmonie") ||
          oefening.toLowerCase().includes("rijden op zit") ||
          oefening.toLowerCase().includes("presentatie") ||
          oefening.toLowerCase().includes("ruiter") ||
          oefening.toLowerCase().includes("artistiek")
        )) {
          inAlgemenePunten = true;
          currentGroup = null;
        }
        
        if (inAlgemenePunten) {
          algemenePuntenData.push(oefening);
          return;
        }

        const isNewGroup = letter && beoordeling; // Nieuwe groep als letter én beoordeling bestaan
        
        // Als er geen letter is, maar wel tekst, is het vaak een vervolgregel
        // Tenzij we expliciet nummeren (wat we in de JSON nu doen)
        if (isNewGroup || (oefening && !currentGroup)) {
          groupNumber++;
          currentGroup = {
            nummer: groupNumber.toString(),
            letters: [letter],
            oefeningen: [oefening],
            beoordeling: beoordeling,
            puntenHeel: "",
            puntenHalf: "",
            isHeader: false
          };
          tableData.push(currentGroup);
        } else if (!letter && oefening && currentGroup) {
          // Vervolgregel binnen een oefening
          currentGroup.letters.push("");
          currentGroup.oefeningen.push(oefening);
        } else if (letter && !beoordeling) {
          // Oefening met alleen een letter (soms bij figuren)
          groupNumber++;
          currentGroup = {
            nummer: groupNumber.toString(),
            letters: [letter],
            oefeningen: [oefening],
            beoordeling: "",
            puntenHeel: "",
            puntenHalf: "",
            isHeader: false
          };
          tableData.push(currentGroup);
        }
      }
    });
    
    const formattedData = tableData.map(group => [
      group.nummer,
      group.letters.join("\n"),
      group.oefeningen.join("\n"),
      group.puntenHeel,
      group.puntenHalf,
      group.beoordeling
    ]);
    
    autoTable(doc, {
      startY: infoY + 16,
      head: [["#", "Letter", "Oefening", "Heel", "Half", "Beoordeling/Opmerkingen"]],
      body: formattedData,
      styles: { 
        fontSize: 9, 
        cellPadding: { top: 8, right: 3, bottom: 8, left: 3 }, 
        lineColor: BORDER_COLOR, 
        lineWidth: 0.5,
        valign: "top",
        overflow: 'linebreak',
        minCellHeight: 60  // <--- HIERMEE GEGARANDEERD SCHRIJFRUIMTE
      },
      headStyles: { 
        fillColor: HEADER_COLOR, 
        textColor: 0, 
        fontStyle: "bold", 
        fontSize: 8, 
        cellPadding: 2, 
        halign: "left",
        valign: "middle"
      },
      theme: "grid",
      margin: MARGIN,
      columnStyles: {
        0: { cellWidth: COL_WIDTHS.NUM, halign: "center" }, 
        1: { cellWidth: COL_WIDTHS.LETTER, halign: "left" }, 
        2: { cellWidth: COL_WIDTHS.EXERCISE, halign: "left" }, 
        3: { cellWidth: COL_WIDTHS.HEEL, halign: "center" }, 
        4: { cellWidth: COL_WIDTHS.HALF, halign: "center" }, 
        5: { cellWidth: COL_WIDTHS.NOTE } 
      }
    });
    
    const afterOefeningen = doc.lastAutoTable.finalY;
    
    let afterAlg = afterOefeningen;
    if (algemenePuntenData.length > 0) {
      // SLIMME PAGINA-BREAK:
      // Als er minder dan 150 punten ruimte over is, begin op een nieuwe pagina.
      // Dit voorkomt dat de header op pagina 1 staat en de tabel op pagina 2.
      const pageHeight = doc.internal.pageSize.height;
      const spaceLeft = pageHeight - afterOefeningen - MARGIN.bottom;
      
      let startY = afterOefeningen + 12;
      if (spaceLeft < 150) {
        doc.addPage();
        startY = 40; 
      }

      afterAlg = generalPointsTable(doc, algemenePuntenData, startY, groupNumber + 1);
    }
    
    totalsBox(doc, afterAlg + 6, p.max_score ? Number(p.max_score) : null, null, true, true);
    signatureLine(doc);
    return;
  }
  
  // STIJL & SPEED LOGICA
  const afterItems = obstaclesTable(doc, items, infoY + 16);
  let afterAlg = afterItems;
  const isSpeed = p.onderdeel === "speed";
  const isStijl = p.onderdeel === "stijl";

  if (isStijl) {
    const punten = (p.klasse === "we0" || p.klasse === "we1") ? ALG_PUNTEN_WE0_WE1 : ALG_PUNTEN_WE2PLUS;
    
    // Check ruimte voor stijltrail
    const pageHeight = doc.internal.pageSize.height;
    const spaceLeft = pageHeight - afterItems - MARGIN.bottom;
    
    let startY = afterItems + 12;
    if (spaceLeft < 150) {
      doc.addPage();
      startY = 40;
    }

    afterAlg = generalPointsTable(doc, punten, startY, items.length + 1);
  }

  totalsBox(
    doc, 
    afterAlg + 6, 
    p.max_score ? Number(p.max_score) : null, 
    isSpeed ? "Tijd / Strafseconden / Totaal" : null, 
    !isSpeed, 
    false,    
    isSpeed   
  );
  
  signatureLine(doc);
}

async function makePdfBlob(protocol, items) {
  try {
    const jsPDF = await loadPdfLibraries();
    const doc = new jsPDF({ unit: "pt", format: "A4" });
    
    // Check of autoTable beschikbaar is
    if (typeof doc.autoTable !== 'function') {
      throw new Error('autoTable functie niet beschikbaar op doc');
    }
    
    protocolToDoc(doc, protocol, items);
    return doc.output("blob");
  } catch (error) {
    console.error('Error creating PDF:', error);
    throw new Error('Kon PDF niet genereren: ' + error.message);
  }
}

export default function ProtocolGenerator() {
  const { items: wedstrijden } = useWedstrijden(false);
  const [stap, setStap] = useState(1);
  const [config, setConfig] = useState({
    wedstrijd_id: "",
    klasse: "",
    onderdeel: "", 
    datum: new Date().toISOString().split("T")[0],
    jury: ""
  });
  const selectedWedstrijd = useMemo(
    () => wedstrijden.find(w => w.id === config.wedstrijd_id) || null,
    [wedstrijden, config.wedstrijd_id]
  );

  useEffect(() => {
    if (selectedWedstrijd?.datum) {
      setConfig(prev => ({ ...prev, datum: selectedWedstrijd.datum }));
    }
  }, [selectedWedstrijd]);

  useEffect(() => {
    if ((config.klasse === 'we0' || config.klasse === 'we1') && config.onderdeel === 'speed') {
      setConfig(prev => ({ ...prev, onderdeel: '' }));
    }
  }, [config.klasse, config.onderdeel]);

  const [dbMsg, setDbMsg] = useState("");
  const [dbMax, setDbMax] = useState(null);
  const [items, setItems] = useState([]);
  const [dbHint, setDbHint] = useState('');
  const [csvRows, setCsvRows] = useState([]);
  const [dbRows, setDbRows] = useState([]);
  const [selectIndex, setSelectIndex] = useState(0);
  const [selectedRubriek, setSelectedRubriek] = useState('senior');
  const [pdfUrl, setPdfUrl] = useState(null);
  const draggedItem = useRef(null);
  const draggedFromAvailable = useRef(false);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const saveItemsConfig = () => {
    const key = `protocol_items_${config.wedstrijd_id}_${config.klasse}_${config.onderdeel}`;
    localStorage.setItem(key, JSON.stringify(items));
    alert(`✅ Configuratie opgeslagen voor ${config.klasse} ${config.onderdeel}`);
  };

  const loadItemsConfig = () => {
    const key = `protocol_items_${config.wedstrijd_id}_${config.klasse}_${config.onderdeel}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setItems(parsed);
        setDbMsg(`✅ Configuratie geladen: ${parsed.length} items`);
        return true;
      } catch (e) {
        console.error('Error loading config:', e);
      }
    }
    return false;
  };

  const clearItemsConfig = () => {
    const key = `protocol_items_${config.wedstrijd_id}_${config.klasse}_${config.onderdeel}`;
    localStorage.removeItem(key);
    alert('🗑️ Opgeslagen configuratie verwijderd');
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setDbMsg(""); setDbMax(null); setItems([]);
      if (!config.wedstrijd_id || !config.klasse || !config.onderdeel) return;
      
      if (config.onderdeel === "dressuur" || config.onderdeel === "speed") {
        try {
          const klasseMap = {
            'we0': 'WE0', 'we1': 'WE1', 'we2': 'WE2', 'we2p': 'WE2+', 'we2+': 'WE2+',
            'we2plus': 'WE2+', 'we3': 'WE3', 'we4': 'WE4',
            'junior': 'JUNIOR', 'junioren': 'JUNIOR', 'young riders': 'YOUNG_RIDERS', 'yr': 'YOUNG_RIDERS'
          };
          const normalizedKlasse = klasseMap[config.klasse.toLowerCase()] || config.klasse.toUpperCase();
          const templateType = config.onderdeel === "dressuur" ? "dressuur" : "speed";
          const template = defaultTemplates[templateType]?.[normalizedKlasse];
          
          if (template && template.sections && template.sections[0]) {
            const section = template.sections[0];
            setItems(section.rows);
            setDbMsg(`✅ ${config.onderdeel} geladen: ${section.title} (${section.rows.length} items)`);
          } else {
            setDbMsg(`⚠️ Geen ${templateType} protocol gevonden voor klasse ${config.klasse}`);
          }
          return;
        } catch (e) {
          setDbMsg(`Kon ${config.onderdeel} protocol niet laden: ` + e.message);
          return;
        }
      }
      
      // Voor stijl: haal uit database of localStorage
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
        
        const key = `protocol_items_${config.wedstrijd_id}_${config.klasse}_${config.onderdeel}`;
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsedItems = JSON.parse(saved);
          setItems(parsedItems);
          setDbMax(proef.max_score || null);
          setDbMsg(`✅ Opgeslagen configuratie geladen: ${parsedItems.length} items`);
          return;
        }

        const { data: its, error: e2 } = await supabase
          .from("proeven_items").select("nr, omschrijving").eq("proef_id", proef.id).order("nr", { ascending: true });
        if (e2) throw e2;
        if (!alive) return;
        
        setItems((its || []).map(it => it.omschrijving));
        setDbMax(proef.max_score || null);
        setDbMsg(`Proef geladen: ${proef.naam} (${(its||[]).length} onderdelen)`);
      } catch (e) {
        if (!alive) return;
        setDbMsg("Kon proeven niet laden: " + e.message);
      }
    })();
    return () => { alive = false; };
  }, [config.wedstrijd_id, config.klasse, config.onderdeel]);

  async function loadDeelnemersFromDB() {
    if (!config.wedstrijd_id || !config.klasse) { setDbMsg('⚠️ Selecteer eerst wedstrijd en klasse'); return; }
    setDbMsg('Laden...');
    
    // Fallback LocalStorage logic
    const loadFromLocalStorage = () => {
      const storageKey = `startlijst_${config.wedstrijd_id}`;
      const stored = localStorage.getItem(storageKey) || localStorage.getItem('wp_startlijst_cache_v1');
      if (!stored) return null;
      try {
        const parsed = JSON.parse(stored);
        const klasseNorm = config.klasse.toLowerCase().replace(/[^a-z0-9]/g, '');
        const filtered = parsed.filter(r => r.type === 'entry' && (r.klasse||'').toLowerCase().replace(/[^a-z0-9]/g, '') === klasseNorm);
        if (filtered.length === 0) return null;
        return filtered.map((r, i) => ({
          ruiter: r.ruiter || '', paard: r.paard || '', rubriek: r.rubriek || selectedRubriek || 'senior',
          startnummer: r.startnummer || String(lookupOffset(config.klasse, (r.rubriek || selectedRubriek || 'senior'), selectedWedstrijd?.startlijst_config) + i)
        }));
      } catch { return null; }
    };
    
    try {
      const klasseMap = { 
        'we0':'WE0', 'we1':'WE1', 'we2':'WE2', 'we2p':'WE2+', 'we2+':'WE2+', 'we2plus':'WE2+',
        'we3':'WE3', 'we4':'WE4', 
        'yr':'Young Riders', 'young riders':'Young Riders', 'youngriders':'Young Riders',
        'junior':'Junioren', 'junioren':'Junioren' 
      };
      const normalizedKlasse = klasseMap[config.klasse.toLowerCase()] || config.klasse.toUpperCase();
      
      const { data, error } = await supabase
        .from('inschrijvingen')
        .select('ruiter,paard,startnummer,rubriek')
        .eq('wedstrijd_id', config.wedstrijd_id)
        .eq('klasse', normalizedKlasse)
        .order('startnummer', { ascending: true });
      
      if (error) throw error;
      if (data && data.length > 0) {
        setDbRows(data.map((r, i) => ({
          ruiter: r.ruiter || '', paard: r.paard || '', rubriek: r.rubriek || selectedRubriek || 'senior',
          startnummer: (r.startnummer != null && r.startnummer !== '') ? String(r.startnummer) : String(lookupOffset(config.klasse, r.rubriek || selectedRubriek || 'senior', selectedWedstrijd?.startlijst_config) + i)
        })));
        setDbMsg(`✅ ${data.length} deelnemers geladen uit database`);
        return;
      }
      const localData = loadFromLocalStorage();
      if (localData && localData.length > 0) {
        setDbRows(localData);
        setDbMsg(`✅ ${localData.length} deelnemers geladen (localStorage)`);
      } else {
        setDbMsg('⚠️ Geen deelnemers gevonden');
        setDbHint('Zorg dat je eerst deelnemers hebt opgeslagen in de Startlijst pagina');
      }
    } catch (e) {
      const localData = loadFromLocalStorage();
      if (localData && localData.length > 0) {
        setDbRows(localData);
        setDbMsg(`✅ ${localData.length} deelnemers geladen (localStorage)`);
      } else {
        setDbMsg('❌ Database error en geen lokale data');
      }
    }
  }

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
      startnummer: padStartnummer(d.startnummer || String( (dbRows && dbRows.length) ? (Number(d.startnummer) || String( lookupOffset(config.klasse, d.rubriek || selectedRubriek || 'senior', selectedWedstrijd?.startlijst_config) + idx )) : String(idx + 1) )),
      ruiter: d.ruiter || "",
      paard: d.paard || "",
      max_score: dbMax,
      onderdeel_label: ONDERDELEN.find(o=>o.code===config.onderdeel)?.label || config.onderdeel
    }));
  }, [csvRows, dbRows, config, selectedWedstrijd, dbMax]);

  const previewPdf = async () => {
    try {
      if (!protocollen.length) return;
      const p = protocollen[selectIndex] || protocollen[0];
      const blob = await makePdfBlob(p, items);
      const url = URL.createObjectURL(blob);
      setPdfUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
    } catch (error) { console.error(error); alert('Fout bij PDF preview: ' + error.message); }
  };
  const openNewTab = async () => {
    try {
      if (!protocollen.length) return;
      const blob = await makePdfBlob(protocollen[selectIndex] || protocollen[0], items);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { console.error(error); alert('Fout bij openen: ' + error.message); }
  };
  const downloadSingle = async () => {
    try {
      if (!protocollen.length) return;
      const p = protocollen[selectIndex] || protocollen[0];
      const blob = await makePdfBlob(p, items);
      const a = document.createElement("a");
      const safe = (s) => String(s || "").replace(/[^\w\-]+/g, "_").slice(0, 40);
      a.href = URL.createObjectURL(blob);
      const sn = padStartnummer(p.startnummer);
      a.download = `${safe(p.onderdeel)}-${safe(sn)}-${safe(p.ruiter)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (error) { console.error(error); alert('Fout bij downloaden: ' + error.message); }
  };
  const downloadBatch = async () => {
    try {
      if (!protocollen.length) return;
      const jsPDF = await loadPdfLibraries();
      const doc = new jsPDF({ unit: "pt", format: "A4" });
      
      if (typeof doc.autoTable !== 'function') {
        throw new Error('autoTable functie niet beschikbaar op doc');
      }
      
      protocollen.forEach((p, i) => { if (i > 0) doc.addPage(); protocolToDoc(doc, p, items); });
      doc.save(`protocollen_${config.onderdeel}.pdf`);
    } catch (error) { console.error(error); alert('Fout bij batch download: ' + error.message); }
  };

  const handleDragStart = (e, item, fromAvailable) => {
    draggedItem.current = item;
    draggedFromAvailable.current = fromAvailable;
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDrop = (e, targetItem, isAvailableList) => {
    e.preventDefault();
    if (!draggedItem.current) return;
    const draggedObstakel = draggedItem.current;
    if (isAvailableList && !draggedFromAvailable.current) {
      const idx = items.findIndex(i => i === draggedObstakel);
      if (idx >= 0) { const n = [...items]; n.splice(idx, 1); setItems(n); }
    } else if (!isAvailableList) {
      if (draggedFromAvailable.current) {
        const n = [...items];
        if (targetItem) n.splice(items.indexOf(targetItem), 0, draggedObstakel);
        else n.push(draggedObstakel);
        setItems(n);
      } else {
        if (targetItem && draggedObstakel !== targetItem) {
          const n = [...items];
          n.splice(items.indexOf(draggedObstakel), 1);
          n.splice(n.indexOf(targetItem), 0, draggedObstakel);
          setItems(n);
        }
      }
    }
    draggedItem.current = null; draggedFromAvailable.current = false;
  };
  const availableObstakels = useMemo(() => {
    if (!config.klasse || config.onderdeel !== 'stijl') return [];
    const km = {'we0':'WE0','we1':'WE1','we2':'WE2','we2p':'WE2+','we2+':'WE2+','we2plus':'WE2+','we3':'WE3','we4':'WE4','yr':'YR','junior':'JR','junioren':'JR'};
    return obstakelsData[km[config.klasse.toLowerCase()] || config.klasse.toUpperCase()] || [];
  }, [config.klasse, config.onderdeel]);

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
            {KLASSEN.filter(k => {
              if (config.onderdeel === 'speed' && (k.code === 'we0' || k.code === 'we1')) return false;
              return true;
            }).map(k=><option key={k.code} value={k.code}>{k.naam}</option>)}
          </select>
          <label>Onderdeel*</label>
          <select value={config.onderdeel} onChange={(e)=>setConfig(c=>({...c, onderdeel:e.target.value}))}>
            <option value="">— kies onderdeel —</option>
            {ONDERDELEN.filter(o => {
              if ((config.klasse === 'we0' || config.klasse === 'we1') && o.code === 'speed') return false;
              return true;
            }).map(o=> <option key={o.code} value={o.code}>{o.label}</option>)}
          </select>
          <label>Datum (optioneel)</label>
          <input type="date" value={config.datum} onChange={(e)=>setConfig(c=>({...c, datum:e.target.value}))}/>
          <label>Jury (optioneel)</label>
          <input value={config.jury} onChange={(e)=>setConfig(c=>({...c, jury:e.target.value}))}/>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: "#555" }}>{dbMsg}</div>
        <div style={{ marginTop: 18 }}>
          <button onClick={() => setStap(2)} disabled={!config.wedstrijd_id || !config.klasse || !config.onderdeel}>Volgende: Items & Deelnemers</button>
        </div>
      </div>
    </>
  );

  const renderItemsEditor = () => {
    if (config.onderdeel === 'dressuur' || config.onderdeel === 'speed') {
      const label = config.onderdeel === 'dressuur' ? 'Dressuur onderdelen' : 'Speedtrail hindernissen';
      const explanation = config.onderdeel === 'dressuur' 
        ? `Dressuurprotocol wordt automatisch geladen uit de template voor <b>${config.klasse?.toUpperCase()}</b>.`
        : `Speedtrail protocol wordt automatisch geladen uit de standaard template voor <b>${config.klasse?.toUpperCase()}</b>.`;
      return (
        <div style={{ marginTop: 12 }}>
          <b>{label} ({items.length})</b>
          <div style={{ marginTop: 6, padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 8 }} dangerouslySetInnerHTML={{ __html: explanation }} />
            {items.length === 0 && <p style={{ fontSize: 13, color: '#999', fontStyle: 'italic' }}>Geen template beschikbaar.</p>}
          </div>
        </div>
      );
    }
    if (config.onderdeel === 'stijl') {
      return (
        <div style={{ marginTop: 12 }}>
          <b>Obstakels voor Stijltrail</b>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
            <div style={{ background: '#f9fafb', border: '2px dashed #d1d5db', borderRadius: 8, padding: 12, minHeight: 200 }}
              onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, null, true)}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: '#6b7280', fontSize: 13 }}>📋 BESCHIKBAAR ({availableObstakels.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {availableObstakels.map((o, i) => (
                  <div key={i} draggable onDragStart={(e) => handleDragStart(e, o, true)} onClick={() => setItems([...items, o])}
                    style={{ padding: '8px 12px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'grab', fontSize: 13 }}>{o}</div>
                ))}
              </div>
            </div>
            <div style={{ background: '#eff6ff', border: '2px solid #3b82f6', borderRadius: 8, padding: 12, minHeight: 200 }}
              onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, null, false)}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: '#1e40af', fontSize: 13 }}>✅ GESELECTEERD ({items.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {items.map((o, i) => (
                  <div key={i} draggable onDragStart={(e) => handleDragStart(e, o, false)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, o, false)}
                    style={{ padding: '8px 12px', background: 'white', border: '1px solid #93c5fd', borderRadius: 6, cursor: 'grab', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#9ca3af', fontWeight: 600, minWidth: 24 }}>{i + 1}.</span><span style={{ flex: 1 }}>{o}</span>
                    <button onClick={(e) => { e.stopPropagation(); setItems(items.filter((_, idx) => idx !== i)); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button onClick={() => setItems(availableObstakels)} style={{ fontSize: 12, padding: '6px 12px' }}>Alles</button>
                <button onClick={() => setItems([])} style={{ fontSize: 12, padding: '6px 12px' }}>Wis</button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return <textarea value={Array.isArray(items) ? items.join("\n") : items} onChange={(e) => setItems(e.target.value.split("\n"))} rows={10} style={{ width: "100%", marginTop: 6 }} />;
  };

  const viewStap2 = (
    <>
      <Header />
      <div style={{ maxWidth: 1200, margin: "24px auto" }}>
        <h2>Items & deelnemers</h2>
        <div style={{display:"grid",gridTemplateColumns:"1fr 420px",gap:24,alignItems:"start"}}>
          <div>
            {renderItemsEditor()}
            {config.onderdeel === 'stijl' && items.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, padding: 12, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
                <button onClick={saveItemsConfig} style={{ flex: 1, background: '#0ea5e9', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6 }}>💾 Opslaan</button>
                <button onClick={loadItemsConfig} style={{ flex: 1, background: '#06b6d4', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6 }}>📥 Laden</button>
                <button onClick={clearItemsConfig} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6 }}>🗑️</button>
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <b>Startlijst</b>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                <input type="file" accept=".csv,text/csv" onChange={(e)=>onCSV(e.target.files?.[0])}/>
                <button onClick={loadDeelnemersFromDB}>Laad deelnemers uit DB</button>
              </div>
            </div>
          </div>
          <div style={{ border:"1px solid #e5e7eb", borderRadius:12, padding:12, background:"#fff" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Preview items ({items.length})</div>
            <table width="100%" cellPadding={6} style={{ borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr style={{ background: "#f7f7f7" }}>
                {config.onderdeel === 'speed' ? <><th align="left">Hindernis</th><th align="left">Strafbepaling</th></> : <><th align="left" style={{ width:60 }}>#</th><th align="left">Item</th></>}
              </tr></thead>
              <tbody>
                {items.map((o,i)=>(
                  <tr key={`prev-${i}`} style={{ borderTop:"1px solid #f0f0f0" }}>
                    {config.onderdeel === 'speed' && Array.isArray(o) ? <><td>{o[0]}</td><td style={{ fontSize: 12, color: '#666' }}>{o[1]}</td></> : <><td>{i+1}</td><td>{Array.isArray(o) ? o.join(' • ') : o}</td></>}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 16, borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Preview deelnemers ({dbRows.length + csvRows.length})</div>
              <ul style={{ marginTop: 4, fontSize: 13 }}>
                {(dbRows.length ? dbRows : csvRows).slice(0, 3).map((d, i) => <li key={i}>{d.startnummer} - {d.ruiter} ({d.paard})</li>)}
              </ul>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
          <button onClick={() => setStap(1)}>Terug</button>
          <button onClick={() => setStap(3)} disabled={!items.length || (csvRows.length === 0 && dbRows.length === 0)} style={{ opacity: (!items.length || (csvRows.length === 0 && dbRows.length === 0)) ? 0.5 : 1 }}>Volgende: Overzicht & PDF</button>
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