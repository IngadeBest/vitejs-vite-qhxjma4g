import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";
import { supabase } from "@/lib/supabaseClient";
import Container from "@/ui/Container";

// ======= Helpers =======
const LS_KEY = "wp_startlijst_cache_v1";

// Helper functie voor automatische starttijd berekening
const calculateStartTimes = (rows, dressuurStart, trailStart, tussenPauze, pauzeMinuten) => {
  const times = {};
  let currentDressuurTime = new Date(`1970-01-01T${dressuurStart}:00`);
  let currentTrailTime = new Date(`1970-01-01T${trailStart}:00`);
  
  const addMinutes = (date, minutes) => {
    return new Date(date.getTime() + minutes * 60000);
  };
  
  const formatTime = (date) => {
    return date.toTimeString().substring(0, 5);
  };
  
  rows.forEach((row, index) => {
    const id = row.id || index;
    
    if (row.type === 'break') {
      // Voor pauzes: voeg pauzetijd toe aan beide tijden
      currentDressuurTime = addMinutes(currentDressuurTime, pauzeMinuten);
      currentTrailTime = addMinutes(currentTrailTime, pauzeMinuten);
      times[id] = {
        dressuur: '',
        trail: '',
        type: 'break'
      };
    } else {
      // Voor deelnemers: bereken beide tijden
      times[id] = {
        dressuur: formatTime(currentDressuurTime),
        trail: formatTime(currentTrailTime),
        type: 'entry'
      };
      
      // Voeg interval toe voor volgende deelnemer
      currentDressuurTime = addMinutes(currentDressuurTime, tussenPauze);
      currentTrailTime = addMinutes(currentTrailTime, tussenPauze);
    }
  });
  
  return times;
};

// Per-klasse starttijd berekening - automatisch doornummeren
const calculateStartTimesPerClass = (rows, klasseStartTimes, tussenPauze, pauzeMinuten) => {
  const times = {};
  let currentDressuurTime = null;
  let currentTrailTime = null;
  let lastKlasse = null;
  
  const addMinutes = (date, minutes) => {
    return new Date(date.getTime() + minutes * 60000);
  };
  
  const formatTime = (date) => {
    return date.toTimeString().substring(0, 5);
  };
  
  rows.forEach((row, index) => {
    const id = row.id || index;
    
    if (row.type === 'break') {
      // Voor pauzes: voeg pauzetijd toe aan lopende tijden
      if (currentDressuurTime) {
        currentDressuurTime = addMinutes(currentDressuurTime, pauzeMinuten);
      }
      if (currentTrailTime) {
        currentTrailTime = addMinutes(currentTrailTime, pauzeMinuten);
      }
      times[id] = {
        dressuur: '',
        trail: '',
        type: 'break'
      };
    } else {
      const klasse = normalizeKlasse(row.klasse) || 'Geen klasse';
      
      // Check of klasse wijzigt en of er een specifieke starttijd is
      if (klasse !== lastKlasse) {
        const klasseConfig = klasseStartTimes[klasse] || {};
        
        // Als er een specifieke starttijd is voor deze klasse, gebruik die
        // Anders blijf doornummeren vanaf vorige tijd
        if (klasseConfig.dressuur) {
          currentDressuurTime = new Date(`1970-01-01T${klasseConfig.dressuur}:00`);
        } else if (!currentDressuurTime) {
          // Geen tijd ingesteld en geen lopende tijd: laat leeg
          currentDressuurTime = null;
        }
        // Anders: blijf doornummeren (currentDressuurTime blijft behouden)
        
        if (klasseConfig.trail) {
          currentTrailTime = new Date(`1970-01-01T${klasseConfig.trail}:00`);
        } else if (!currentTrailTime) {
          currentTrailTime = null;
        }
        // Anders: blijf doornummeren
        
        lastKlasse = klasse;
      }
      
      times[id] = {
        dressuur: currentDressuurTime ? formatTime(currentDressuurTime) : '',
        trail: currentTrailTime ? formatTime(currentTrailTime) : '',
        type: 'entry'
      };
      
      // Voeg interval toe voor volgende deelnemer
      if (currentDressuurTime) {
        currentDressuurTime = addMinutes(currentDressuurTime, tussenPauze);
      }
      if (currentTrailTime) {
        currentTrailTime = addMinutes(currentTrailTime, tussenPauze);
      }
    }
  });
  
  return times;
};

// Function to add a new empty row
const addEmptyRow = (setRows, klasse) => {
  setRows((prev) => [
    ...prev,
    {
      id: `${Date.now()}`,
      type: "entry",
      ruiter: "",
      paard: "",
      startnummer: "",
      starttijd: "",
      klasse: klasse || "",
    },
  ]);
};

// Function to add a break
const addBreak = (setRows) => {
  setRows((prev) => [
    ...prev,
    {
      id: `break_${Date.now()}`,
      type: "break",
      label: "Pauze",
      duration: 15,
    },
  ]);
};

// Normalize klasse names to consistent format
const normalizeKlasse = (input) => {
  if (!input || typeof input !== 'string') return '';
  
  const clean = input.trim().toLowerCase();
  
  // Map common variations to standard names
  const klasseMap = {
    'we0': 'WE0', 'we 0': 'WE0', 'we-0': 'WE0', 'introductieklasse': 'WE0',
    'we1': 'WE1', 'we 1': 'WE1', 'we-1': 'WE1', 
    'we2': 'WE2', 'we 2': 'WE2', 'we-2': 'WE2',
    'we2+': 'WE2+', 'we 2+': 'WE2+', 'we-2+': 'WE2+', 'we2plus': 'WE2+',
    'we3': 'WE3', 'we 3': 'WE3', 'we-3': 'WE3',
    'we4': 'WE4', 'we 4': 'WE4', 'we-4': 'WE4',
    'junior': 'Junioren', 'junioren': 'Junioren', 'juniors': 'Junioren',
    'young rider': 'Young Riders', 'young riders': 'Young Riders', 'yr': 'Young Riders'
  };
  
  return klasseMap[clean] || input.trim();
};

// TEMP RENAMED TO AVOID CONFLICT
const getStartnummerBase_OLD = (klasse) => {
  const normalized = normalizeKlasse(klasse);
  switch (normalized.toLowerCase()) {
    case 'we0': return 1;
    case 'we1': return 101;
    case 'we2': return 201;
    case 'we3': return 301;
    case 'we4': return 401;
    case 'junioren': return 501;
    case 'young riders': return 601;
    case 'we2+': return 701;
    default: return 1;
  }
};

// Groepeer rows per klasse
const groupRowsByClass = (rows) => {
  const entries = rows.filter(r => r.type === 'entry');
  const breaks = rows.filter(r => r.type === 'break');
  
  const classGroups = {};
  entries.forEach(entry => {
    const klasse = normalizeKlasse(entry.klasse || '');
    if (!classGroups[klasse]) classGroups[klasse] = [];
    classGroups[klasse].push(entry);
  });
  
  return { classGroups, breaks };
};

// Automatische startnummers toewijzen per klasse
const autoAssignStartnumbers = (rows) => {
  const classCounts = {};
  
  return rows.map(row => {
    if (row.type === 'break') return row;
    
    const klasse = normalizeKlasse(row.klasse || '');
    if (!klasse) return row;
    
    if (!classCounts[klasse]) classCounts[klasse] = 0;
    classCounts[klasse]++;
    
    const base = getStartnummerBase(klasse);
    const nummer = base + classCounts[klasse] - 1;
    
    return {
      ...row,
      startnummer: nummer.toString().padStart(3, '0')
    };
  });
};

// TEMP RENAMED TO AVOID CONFLICT
const normalizeKlasse_OLD = (input) => {
  if (!input || typeof input !== 'string') return '';
  
  const clean = input.trim().toLowerCase();
  
  // Map common variations to standard names
  const klasseMap = {
    'we0': 'WE0',
    'we 0': 'WE0', 
    'we-0': 'WE0',
    'introductieklasse': 'WE0',
    'we1': 'WE1',
    'we 1': 'WE1',
    'we-1': 'WE1', 
    'we2': 'WE2',
    'we 2': 'WE2',
    'we-2': 'WE2',
    'we2+': 'WE2+',
    'we 2+': 'WE2+',
    'we-2+': 'WE2+',
    'we2plus': 'WE2+',
    'we3': 'WE3',
    'we 3': 'WE3',
    'we-3': 'WE3',
    'we4': 'WE4',
    'we 4': 'WE4', 
    'we-4': 'WE4',
    'junior': 'Junioren',
    'junioren': 'Junioren',
    'juniors': 'Junioren',
    'young rider': 'Young Riders',
    'young riders': 'Young Riders',
    'yr': 'Young Riders',
    'y.r.': 'Young Riders'
  };
  
  return klasseMap[clean] || input.trim();
};

// Startnummer mapping per klasse
const getStartnummerBase = (klasse) => {
  const normalizedKlasse = normalizeKlasse(klasse);
  switch (normalizedKlasse.toLowerCase()) {
    case 'we0': return 1;
    case 'we1': return 101;
    case 'we2': return 201;
    case 'we3': return 301;
    case 'we4': return 401;
    case 'junioren': return 501;
    case 'young riders': return 601;
    case 'we2+': return 701;
    default: return 1; // fallback
  }
};

// TEMP RENAMED TO AVOID CONFLICT
const groupRowsByClass_OLD = (rows) => {
  const entries = rows.filter(r => r.type === 'entry');
  const breaks = rows.filter(r => r.type === 'break');
  
  // Groepeer entries per klasse
  const classGroups = {};
  entries.forEach(entry => {
    const klasse = normalizeKlasse(entry.klasse || '');
    if (!classGroups[klasse]) {
      classGroups[klasse] = [];
    }
    classGroups[klasse].push(entry);
  });
  
  return { classGroups, breaks };
};

// TEMP RENAMED TO AVOID CONFLICT  
const autoAssignStartnumbers_OLD2 = (rows) => {
  const classCounts = {};
  
  return rows.map(row => {
    if (row.type === 'break') return row;
    
    const klasse = normalizeKlasse(row.klasse || '');
    if (!klasse) return row;
    
    if (!classCounts[klasse]) {
      classCounts[klasse] = 0;
    }
    classCounts[klasse]++;
    
    const base = getStartnummerBase(klasse);
    const nummer = base + classCounts[klasse] - 1;
    
    return {
      ...row,
      startnummer: nummer.toString().padStart(3, '0')
    };
  });
};

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = {
    ruiter: header.indexOf("ruiter"),
    paard: header.indexOf("paard"),
    startnummer: header.indexOf("startnummer"),
    tijd: header.indexOf("tijd"),
  };
  return lines.slice(1).map((ln, i) => {
    const cols = ln.split(",").map((s) => s.trim());
    return {
      id: `row_${Date.now()}_${i}`,
      type: "entry",
      ruiter: idx.ruiter >= 0 ? cols[idx.ruiter] : cols[0] || "",
      paard: idx.paard >= 0 ? cols[idx.paard] : cols[1] || "",
      startnummer:
        idx.startnummer >= 0 ? cols[idx.startnummer] : cols[2] || "",
      starttijd: idx.tijd >= 0 ? cols[idx.tijd] : "",
      klasse: "",
    };
  });
}

function setQueryParam(name, value) {
  const url = new URL(window.location.href);
  if (value === undefined || value === null || value === "") {
    url.searchParams.delete(name);
  } else {
    url.searchParams.set(name, String(value));
  }
  history.replaceState(null, "", url.toString());
}
function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name) || "";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function generateSimplePDF(title, rows, calculatedTimes = {}, wedstrijdNaam = '') {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(16);
  doc.text(wedstrijdNaam || title, 40, 50);
  
  if (wedstrijdNaam && wedstrijdNaam !== title) {
    doc.setFontSize(12);
    doc.text(title, 40, 70);
  }

  const body = rows.map((r, i) => {
    if (r.type === "break") {
      return [
        "",
        "",
        "",
        "",
        `🍕 PAUZE: ${r.label || ""} (${r.duration || 0} min)`,
        "",
      ];
    }
    const times = calculatedTimes[r.id || i] || {};
    return [
      String(i + 1),
      times.dressuur || "--:--",
      times.trail || "--:--",
      r.startnummer || "",
      r.ruiter || "",
      r.paard || "",
    ];
  });

  autoTable(doc, {
    head: [["#", "Dressuur", "Trail", "Startnr", "Ruiter", "Paard"]],
    body,
    startY: wedstrijdNaam && wedstrijdNaam !== title ? 90 : 80,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [230, 230, 230] },
    margin: { left: 40, right: 40 },
    didParseCell: (data) => {
      const r = rows[data.row.index];
      if (r?.type === "break") {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [255, 243, 224];
      }
    },
  });

  return doc.output("blob");
}

// Excel export met fallback - VERBETERDE VERSIE met klasse headers en zonder Type kolom
async function exportToExcel(rows, meta = {}, calculatedTimes = {}) {
  try {
    const XLSX = await import("xlsx");
    
    // Groepeer rows per klasse
    const grouped = [];
    let currentKlasse = null;
    let entryCounter = 0; // Teller voor alleen deelnemers (geen pauzes)
    
    rows.forEach((r, idx) => {
      if (r.type === 'break') {
        // Pauze toevoegen
        grouped.push({
          Volgorde: '',
          Klasse: '',
          Dressuur: '',
          Trail: '',
          Startnummer: '',
          Ruiter: `🍕 PAUZE: ${r.label || 'Pauze'}`,
          Paard: `${r.duration || 0} minuten`,
        });
      } else {
        entryCounter++;
        const rowKlasse = normalizeKlasse(r.klasse) || 'Geen klasse';
        
        // Voeg klasse header toe als nieuwe klasse
        if (rowKlasse !== currentKlasse) {
          currentKlasse = rowKlasse;
          grouped.push({
            Volgorde: '',
            Klasse: `📋 ${rowKlasse}`,
            Dressuur: '',
            Trail: '',
            Startnummer: '',
            Ruiter: '',
            Paard: '',
          });
        }
        
        // Voeg deelnemer toe
        const times = calculatedTimes[r.id || idx] || {};
        grouped.push({
          Volgorde: entryCounter,
          Klasse: rowKlasse,
          Dressuur: times.dressuur || "",
          Trail: times.trail || "",
          Startnummer: r.startnummer || "",
          Ruiter: r.ruiter || "",
          Paard: r.paard || "",
        });
      }
    });
    
    const ws = XLSX.utils.json_to_sheet(grouped);
    
    // Styling: maak klasse headers bold (dit werkt in sommige Excel versies)
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: 1 }); // Klasse kolom
      if (ws[cellAddress] && ws[cellAddress].v && ws[cellAddress].v.startsWith('📋')) {
        ws[cellAddress].s = { font: { bold: true } };
      }
    }
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Startlijst");
    
    const wedstrijdNaam = meta.wedstrijdNaam || meta.wedstrijd || "Wedstrijd";
    const title = `Startlijst_${wedstrijdNaam}_${
      meta.klasse || ""
    }_${meta.rubriek || ""}`.replace(/\s+/g, "_");
    
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(
      new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `${title}.xlsx`
    );
  } catch (e) {
    console.error('Excel export error:', e);
    // Fallback CSV
    const header = [
      "Volgorde",
      "Klasse",
      "Dressuur",
      "Trail", 
      "Startnummer",
      "Ruiter",
      "Paard",
    ];
    const lines = [header.join(",")];
    
    let currentKlasse = null;
    let entryCounter = 0;
    
    rows.forEach((r, idx) => {
      if (r.type === 'break') {
        lines.push([
          '',
          '',
          '',
          '',
          '',
          `🍕 PAUZE: ${r.label || 'Pauze'}`,
          `${r.duration || 0} minuten`
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
      } else {
        entryCounter++;
        const rowKlasse = normalizeKlasse(r.klasse) || 'Geen klasse';
        
        if (rowKlasse !== currentKlasse) {
          currentKlasse = rowKlasse;
          lines.push([
            '',
            `📋 ${rowKlasse}`,
            '',
            '',
            '',
            '',
            ''
          ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
        }
        
        const times = calculatedTimes[r.id || idx] || {};
        const line = [
          entryCounter,
          rowKlasse,
          times.dressuur || "",
          times.trail || "",
          r.startnummer || "",
          r.ruiter || "",
          r.paard || "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",");
        lines.push(line);
      }
    });
    const csv = lines.join("\n");
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      "startlijst.csv"
    );
  }
}

// ======= Component =======
export default function Startlijst() {
  // Filters met URL sync
  const [wedstrijd, setWedstrijd] = useState(getQueryParam("wedstrijd_id"));
  const { items: wedstrijden, loading: loadingWed } = useWedstrijden(false);
  const [klasse, setKlasse] = useState(getQueryParam("klasse"));
  const [rubriek, setRubriek] = useState(getQueryParam("rubriek"));
  useEffect(() => {
    setQueryParam("wedstrijd_id", wedstrijd);
  }, [wedstrijd]);
  useEffect(() => {
    setQueryParam("klasse", klasse);
  }, [klasse]);
  useEffect(() => {
    setQueryParam("rubriek", rubriek);
  }, [rubriek]);

  // Lijst (entries + breaks)
  const [rows, setRows] = useState(() => {
    try {
      const cached = localStorage.getItem(LS_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [search, setSearch] = useState("");
  const [loadingFromDB, setLoadingFromDB] = useState(false);
  const [dbMessage, setDbMessage] = useState("");

  // Volgorde van klassen + starttijden per klasse
  const [classOrder, setClassOrder] = useState([]);
  const [classStartTimes, setClassStartTimes] = useState({});

  // Zorg dat classOrder altijd alle gebruikte klassen bevat, in stabiele volgorde
  useEffect(() => {
    const classesInRows = Array.from(
      new Set(
        rows
          .filter((r) => r.type === "entry")
          .map((r) => r.klasse || "Zonder klasse")
      )
    );
    setClassOrder((prev) => {
      const kept = prev.filter((c) => classesInRows.includes(c));
      const added = classesInRows.filter((c) => !kept.includes(c));
      return [...kept, ...added];
    });
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) =>
      r.type === "break"
        ? (r.label || "").toLowerCase().includes(q)
        : (r.ruiter || "").toLowerCase().includes(q) ||
          (r.paard || "").toLowerCase().includes(q) ||
          (r.startnummer || "").toLowerCase().includes(q) ||
          (r.starttijd || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  // Preview per klasse groeperen (alleen deelnemers; pauzes apart)
  const previewClassMap = useMemo(() => {
    const map = new Map();
    filtered.forEach((r) => {
      if (r.type === "entry") {
        const key = r.klasse || "Zonder klasse";
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(r);
      }
    });
    return map;
  }, [filtered]);

  const previewBreaks = useMemo(
    () => filtered.filter((r) => r.type === "break"),
    [filtered]
  );

  // CSV upload → voegt alleen RIT-regels toe (type: entry)
  const onCSV = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    const parsed = parseCSV(text);
    setRows(parsed);
    e.target.value = "";
  };

  // Drag & drop handlers voor deelnemers
  const draggedRow = useRef(null);
  
  // Klasse verplaats functies (up/down knoppen)
  const moveClassUp = useCallback((klasseToMove) => {
    console.log('⬆️ Moving class up:', klasseToMove);
    
    setRows(prev => {
      // Group rows by class in CURRENT order
      const klasseGroups = {};
      const klasseOrder = [];
      const breaks = [];
      
      prev.forEach(row => {
        if (row.type === 'break') {
          breaks.push(row);
        } else {
          const rowKlasse = normalizeKlasse(row.klasse) || 'Geen klasse';
          if (!klasseGroups[rowKlasse]) {
            klasseGroups[rowKlasse] = [];
            klasseOrder.push(rowKlasse);
          }
          klasseGroups[rowKlasse].push(row);
        }
      });
      
      const currentIndex = klasseOrder.indexOf(klasseToMove);
      if (currentIndex <= 0) {
        console.log('Already at top');
        return prev; // Already at top
      }
      
      // Swap with previous class
      const newOrder = [...klasseOrder];
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
      
      // Rebuild rows
      const newRows = [];
      newOrder.forEach(klasse => {
        if (klasseGroups[klasse] && klasseGroups[klasse].length > 0) {
          newRows.push(...klasseGroups[klasse]);
        }
      });
      newRows.push(...breaks);
      
      console.log('✅ Moved up:', klasseToMove);
      return newRows;
    });
  }, []);

  const moveClassDown = useCallback((klasseToMove) => {
    console.log('⬇️ Moving class down:', klasseToMove);
    
    setRows(prev => {
      // Group rows by class in CURRENT order
      const klasseGroups = {};
      const klasseOrder = [];
      const breaks = [];
      
      prev.forEach(row => {
        if (row.type === 'break') {
          breaks.push(row);
        } else {
          const rowKlasse = normalizeKlasse(row.klasse) || 'Geen klasse';
          if (!klasseGroups[rowKlasse]) {
            klasseGroups[rowKlasse] = [];
            klasseOrder.push(rowKlasse);
          }
          klasseGroups[rowKlasse].push(row);
        }
      });
      
      const currentIndex = klasseOrder.indexOf(klasseToMove);
      if (currentIndex === -1 || currentIndex >= klasseOrder.length - 1) {
        console.log('Already at bottom');
        return prev; // Already at bottom
      }
      
      // Swap with next class
      const newOrder = [...klasseOrder];
      [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
      
      // Rebuild rows
      const newRows = [];
      newOrder.forEach(klasse => {
        if (klasseGroups[klasse] && klasseGroups[klasse].length > 0) {
          newRows.push(...klasseGroups[klasse]);
        }
      });
      newRows.push(...breaks);
      
      console.log('✅ Moved down:', klasseToMove);
      return newRows;
    });
  }, []);

  const handleDragStart = (e, row) => {
    console.log('🚀 Drag start:', row.id, row.ruiter || row.label || 'Unknown');
    draggedRow.current = row;
    e.target.style.opacity = '0.5';
    e.target.style.transform = 'scale(1.02)';
    e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({id: row.id, type: 'row'}));
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '';
    e.target.style.transform = '';
    e.target.style.boxShadow = '';
    e.target.closest('tr')?.classList.remove('bg-blue-100');
    draggedRow.current = null;
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // MUST prevent default to allow drop
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    // Add visual feedback for drop zone
    const tr = e.target.closest('tr');
    if (tr && !tr.classList.contains('bg-blue-50')) {
      // Add border to show where item will be dropped
      tr.style.borderTop = '3px solid #3b82f6';
      tr.classList.add('bg-blue-100');
    }
  };

  const handleDragLeave = (e) => {
    // Remove visual feedback when leaving drop zone
    const tr = e.target.closest('tr');
    if (tr) {
      tr.classList.remove('bg-blue-100');
      tr.style.borderTop = '';
    }
  };

  const handleDrop = (e, targetRow) => {
    e.preventDefault();
    e.stopPropagation();
    
    const tr = e.target.closest('tr');
    if (tr) {
      tr.classList.remove('bg-blue-100');
      tr.style.borderTop = '';
    }
    
    if (!draggedRow.current) {
      console.log('❌ No dragged row');
      return;
    }
    
    if (draggedRow.current.id === targetRow.id) {
      console.log('↩️ Same row, ignoring');
      draggedRow.current = null;
      return;
    }
    
    const sourceRow = draggedRow.current;
    console.log('🔄 Moving:', sourceRow.ruiter || sourceRow.label, '→', targetRow.ruiter || targetRow.label);
    
    setRows(prev => {
      const newRows = [...prev];
      const sourceIndex = newRows.findIndex(r => r.id === sourceRow.id);
      const targetIndex = newRows.findIndex(r => r.id === targetRow.id);
      
      if (sourceIndex === -1 || targetIndex === -1) {
        console.log('❌ Invalid indices:', { sourceIndex, targetIndex });
        return prev;
      }
      
      // Remove from original position
      const [movedRow] = newRows.splice(sourceIndex, 1);
      
      // Insert at new position
      newRows.splice(targetIndex, 0, movedRow);
      
      console.log('✅ Reorder complete');
      return newRows;
    });
    
    draggedRow.current = null;
  };



  // Pauze toevoegen
  const [pauseLabel, setPauseLabel] = useState("");
  const [pauseMin, setPauseMin] = useState(10);
  const addPauseAtEnd = () => {
    setRows((prev) => [
      ...prev,
      {
        id: `break_${Date.now()}`,
        type: "break",
        label: pauseLabel || "Pauze",
        duration: Number(pauseMin) || 10,
      },
    ]);
    setPauseLabel("");
    setPauseMin(10);
  };

  // Starttijd systeem state
  const [dressuurStarttijd, setDressuurStarttijd] = useState("09:00");
  const [trailStarttijd, setTrailStarttijd] = useState("13:00");
  const [tussenPauze, setTussenPauze] = useState(6); // minuten tussen deelnemers
  const [pauzeMinuten, setPauzeMinuten] = useState(15); // minuten voor een pauze
  const [saving, setSaving] = useState(false);
  
  // Per-klasse starttijden state
  const [klasseStartTimes, setKlasseStartTimes] = useState({});
  
  // Sorteer functie voor klassen 
  const sortRowsByClass = useCallback(() => {
    const klasseOrder = ['WE0', 'WE1', 'WE2', 'WE3', 'WE4', 'Junioren', 'Young Riders', 'WE2+'];
    
    setRows(prev => {
      // Groepeer per klasse, behoud pauzes op hun positie
      const groups = [];
      let currentGroup = [];
      
      prev.forEach(row => {
        if (row.type === 'break') {
          // Pauze: voeg huidige groep toe en start nieuwe
          if (currentGroup.length > 0) {
            groups.push({ type: 'entries', items: currentGroup });
            currentGroup = [];
          }
          groups.push({ type: 'break', items: [row] });
        } else {
          currentGroup.push(row);
        }
      });
      
      // Voeg laatste groep toe
      if (currentGroup.length > 0) {
        groups.push({ type: 'entries', items: currentGroup });
      }
      
      // Sorteer entries binnen elke groep
      const sorted = [];
      groups.forEach(group => {
        if (group.type === 'break') {
          sorted.push(...group.items);
        } else {
          // Sorteer entries op klasse
          const sortedEntries = group.items.sort((a, b) => {
            const klasseA = normalizeKlasse(a.klasse || '') || 'ZZZ_Geen_klasse';
            const klasseB = normalizeKlasse(b.klasse || '') || 'ZZZ_Geen_klasse';
            
            const indexA = klasseOrder.indexOf(klasseA);
            const indexB = klasseOrder.indexOf(klasseB);
            
            if (indexA !== -1 && indexB !== -1) {
              return indexA - indexB;
            }
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return klasseA.localeCompare(klasseB);
          });
          sorted.push(...sortedEntries);
        }
      });
      
      return sorted;
    });
  }, []);

  // Auto-sorteer wanneer er klassen veranderen
  useEffect(() => {
    if (rows.length > 0) {
      sortRowsByClass();
    }
  }, []); // Alleen bij component mount

  const addEmptyRow = () => {
    const newRow = {
      id: `manual_${Date.now()}`,
      type: "entry",
      ruiter: "",
      paard: "",
      startnummer: "",
      klasse: "",
      starttijd: "",
      fromDB: false,
    };
    setRows(prev => [...prev, newRow]);
  };

  // Emergency data recovery function
  const recoverFromLocalStorage = () => {
    const LS_KEY = "startlijst-rows";
    const backup = localStorage.getItem(LS_KEY);
    
    console.log("Checking localStorage keys:", Object.keys(localStorage));
    console.log("Checking for backup in key:", LS_KEY);
    
    // Check alternative localStorage keys that might have data
    const possibleKeys = [
      "startlijst-rows",
      "rows", 
      "inschrijvingen",
      "deelnemers",
      "wedstrijd-data"
    ];
    
    let foundBackup = null;
    let foundKey = null;
    
    for (const key of possibleKeys) {
      const data = localStorage.getItem(key);
      if (data && data !== 'null' && data !== '[]') {
        console.log(`Found data in localStorage key '${key}':`, data.substring(0, 100) + "...");
        foundBackup = data;
        foundKey = key;
        break;
      }
    }
    
    if (foundBackup) {
      try {
        const parsedData = JSON.parse(foundBackup);
        console.log("Found backup data:", parsedData);
        
        const confirmed = confirm(
          `Backup gevonden in '${foundKey}' met ${Array.isArray(parsedData) ? parsedData.length : 'onbekend aantal'} entries. Wil je deze herstellen?`
        );
        
        if (confirmed) {
          restoreToDatabase(Array.isArray(parsedData) ? parsedData : [parsedData]);
        }
      } catch (e) {
        console.error("Error parsing backup:", e);
        setDbMessage(`❌ Fout bij lezen backup: ${e.message}`);
      }
    } else {
      setDbMessage("❌ Geen backup gevonden in localStorage");
      console.log("No backup found in any localStorage keys");
      
      // Show manual recovery option
      const manual = confirm("Geen backup gevonden. Wil je handmatig data invoeren?");
      if (manual) {
        showManualRecoveryForm();
      }
    }
  };

  const showManualRecoveryForm = () => {
    const csvData = prompt(`Bulk invoer - meerdere formats ondersteund:

FORMAT 1 (CSV): ruiter,paard,startnummer,klasse
Jan Jansen,Zwarte Piet,1,Junior
Marie de Boer,Witte Roos,2,Junior

FORMAT 2 (Tab-separated, kopieer uit Excel):
Jan Jansen    Zwarte Piet    1    Junior
Marie de Boer    Witte Roos    2    Junior

FORMAT 3 (Ruiter-lijst, auto startnummers):
Jan Jansen
Marie de Boer
Piet de Vries

Plak je data hieronder:`);
    
    if (csvData) {
      try {
        const lines = csvData.split('\n').filter(line => line.trim());
        const entries = [];
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          let ruiter, paard, startnummer, klasse;
          
          // Detect format and parse accordingly
          if (line.includes(',')) {
            // CSV format
            [ruiter, paard, startnummer, klasse] = line.split(',').map(s => s.trim());
          } else if (line.includes('\t')) {
            // Tab-separated (Excel copy/paste)
            [ruiter, paard, startnummer, klasse] = line.split('\t').map(s => s.trim());
          } else {
            // Simple ruiter list - generate startnummer
            ruiter = line;
            paard = '';
            startnummer = (i + 1).toString();
            klasse = '';
          }
          
          if (ruiter) {
            entries.push({
              id: `manual_recovery_${Date.now()}_${i}`,
              type: "entry",
              ruiter: ruiter || "",
              paard: paard || "",
              startnummer: startnummer || (i + 1).toString(),
              klasse: klasse || "",
              starttijd: "",
              fromDB: false,
            });
          }
        }
        
        if (entries.length > 0) {
          setRows(entries);
          setDbMessage(`✅ ${entries.length} entries geïmporteerd - controleer en klik Preview > Opslaan`);
        } else {
          setDbMessage("❌ Geen geldige data gevonden in invoer");
        }
      } catch (e) {
        setDbMessage(`❌ Fout bij verwerken data: ${e.message}`);
      }
    }
  };

  // Quick template generator
  const generateTemplate = () => {
    const count = prompt("Hoeveel lege rijen wil je genereren? (bijv. 24)");
    const num = parseInt(count);
    
    if (num && num > 0 && num <= 100) {
      const emptyRows = Array.from({length: num}, (_, i) => ({
        id: `template_${Date.now()}_${i}`,
        type: "entry",
        ruiter: "",
        paard: "",
        startnummer: (i + 1).toString(),
        klasse: "",
        starttijd: "",
        fromDB: false,
      }));
      setRows(emptyRows);
      setDbMessage(`✅ ${num} lege rijen gegenereerd met genummerde startnummers`);
    } else {
      alert("Voer een geldig getal in tussen 1 en 100");
    }
  };

  const restoreToDatabase = async (backupData) => {
    try {
      setDbMessage("Herstellen van backup data...");
      
      // Filter only real entries (not breaks)
      const entries = backupData
        .filter(row => row.type === 'entry' && row.ruiter && row.ruiter.trim())
        .map(row => ({
          wedstrijd_id: "6837ee22-6992-4cee-a23f-f8bbae8b4f42", // Restore to original wedstrijd
          ruiter: row.ruiter.trim(),
          paard: row.paard ? row.paard.trim() : null,
          startnummer: row.startnummer ? parseInt(row.startnummer) || null : null,
          klasse: normalizeKlasse(row.klasse),
          rubriek: 'WE0', // Assume WE0 for recovered data
        }));

      if (entries.length > 0) {
        const { error: insertError } = await supabase
          .from('inschrijvingen')
          .insert(entries);
        
        if (insertError) throw insertError;
        
        setDbMessage(`✅ ${entries.length} entries hersteld van backup!`);
        
        // Reload data
        setTimeout(() => {
          loadDeelnemersFromDB();
        }, 1000);
      } else {
        setDbMessage("❌ Geen geldige entries gevonden in backup");
      }
    } catch (error) {
      console.error('Restore error:', error);
      const errorMsg = error?.message || String(error);
      setDbMessage(`❌ Fout bij herstellen: ${errorMsg}`);
    }
  };
  const rollbackMigration = async () => {
    const targetWedstrijdId = "6837ee22-6992-4cee-a23f-f8bbae8b4f42"; // Original wedstrijd ID
    const confirmed = confirm(
      `ROLLBACK: Alle inschrijvingen terugzetten naar originele wedstrijd?`
    );
    
    if (!confirmed) return;

    try {
      setDbMessage("Rollback: inschrijvingen terugzetten...");
      
      // Move all entries from current wedstrijd back to original
      const { error } = await supabase
        .from('inschrijvingen')
        .update({ wedstrijd_id: targetWedstrijdId })
        .eq('wedstrijd_id', wedstrijd);
      
      if (error) throw error;
      
      setDbMessage("✅ Rollback succesvol - data teruggezet");
      
      // Reload data 
      setTimeout(() => {
        loadDeelnemersFromDB();
      }, 500);
      
    } catch (error) {
      console.error('Rollback error:', error);
      const errorMsg = error?.message || String(error);
      setDbMessage(`❌ Fout bij rollback: ${errorMsg}`);
    }
  };

  // Function to COPY (not move) entries from another wedstrijd to current one
  const copyFromOtherWedstrijd = async () => {
    if (!wedstrijd) {
      alert("Selecteer eerst een wedstrijd");
      return;
    }

    const sourceWedstrijdId = "6837ee22-6992-4cee-a23f-f8bbae8b4f42"; // The source ID
    const confirmed = confirm(
      `Wil je alle deelnemers van de andere wedstrijd KOPIËREN naar deze wedstrijd? (Originele data blijft behouden)`
    );
    
    if (!confirmed) return;

    try {
      setDbMessage("Kopiëren van deelnemers...");
      
      // First get all entries from source wedstrijd
      const { data: sourceEntries, error: fetchError } = await supabase
        .from('inschrijvingen')
        .select('ruiter,paard,startnummer,klasse,rubriek')
        .eq('wedstrijd_id', sourceWedstrijdId);
      
      if (fetchError) throw fetchError;
      
      if (sourceEntries && sourceEntries.length > 0) {
        // Insert copies with new wedstrijd_id
        const copiesToInsert = sourceEntries.map(entry => ({
          ...entry,
          wedstrijd_id: wedstrijd
        }));
        
        const { error: insertError } = await supabase
          .from('inschrijvingen')
          .insert(copiesToInsert);
        
        if (insertError) throw insertError;
        
        setDbMessage(`✅ ${sourceEntries.length} deelnemers gekopieerd`);
      } else {
        setDbMessage("❌ Geen brondata gevonden om te kopiëren");
      }
      
      // Reload data for current wedstrijd
      setTimeout(() => {
        loadDeelnemersFromDB();
      }, 500);
      
    } catch (error) {
      console.error('Copy error:', error);
      const errorMsg = error?.message || String(error);
      setDbMessage(`❌ Fout bij kopiëren: ${errorMsg}`);
    }
  };

  const saveList = async () => {
    if (!wedstrijd) {
      alert("Selecteer eerst een wedstrijd om wijzigingen op te slaan.");
      return;
    }

    console.log("SaveList called with:", { wedstrijd, rowsLength: rows.length });
    
    // Create timestamped backup BEFORE any database operations
    const timestamp = new Date().toISOString();
    const backupKey = `backup_${timestamp.slice(0, 16).replace(/[:-]/g, '')}`;
    localStorage.setItem(backupKey, JSON.stringify(rows));
    localStorage.setItem("last_backup", JSON.stringify({ key: backupKey, timestamp, wedstrijd }));
    
    setSaving(true);
    setDbMessage("Opslaan...");

    try {
      // BACKUP check - ensure we have data in current rows
      const entries = rows
        .filter(row => row.type === 'entry')
        .filter(row => row.ruiter && row.ruiter.trim());
      
      if (entries.length === 0) {
        throw new Error("Geen geldige deelnemers om op te slaan. Operatie geannuleerd voor veiligheid.");
      }
      
      // Stap 1: Verwijder alle bestaande inschrijvingen voor deze wedstrijd
      const { error: deleteError } = await supabase
        .from('inschrijvingen')
        .delete()
        .eq('wedstrijd_id', wedstrijd);
      
      if (deleteError) {
        console.error("Database delete error:", deleteError);
        throw new Error(`Database fout bij verwijderen: ${deleteError.message || JSON.stringify(deleteError)}`);
      }

      // Stap 2: Voeg alle huidige entries toe
      const entriesToInsert = entries.map(row => ({
        wedstrijd_id: wedstrijd,
        ruiter: row.ruiter.trim(),
        paard: row.paard ? row.paard.trim() : null,
        startnummer: row.startnummer ? parseInt(row.startnummer) || null : null,
        klasse: normalizeKlasse(row.klasse),
        rubriek: rubriek || 'Algemeen',
      }));

      const { error: insertError } = await supabase
        .from('inschrijvingen')
        .insert(entriesToInsert);
      
      if (insertError) {
        console.error("Database insert error:", insertError);
        throw new Error(`Database fout bij invoegen: ${insertError.message || JSON.stringify(insertError)}`);
      }
      
      // Save to localStorage as backup (after successful database save)
      const storageKey = `startlijst_${wedstrijd}`;
      localStorage.setItem(storageKey, JSON.stringify(rows));
      localStorage.setItem(LS_KEY, JSON.stringify(rows));
      
      setDbMessage(`✅ ${entries.length} deelnemers succesvol opgeslagen in database`);
      
      // Herlaad data om sync te behouden
      setTimeout(() => {
        loadDeelnemersFromDB();
      }, 1000);

    } catch (error) {
      console.error('Error saving to database:', error);
      const errorMsg = error?.message || String(error);
      setDbMessage(`❌ Fout bij opslaan naar database: ${errorMsg}`);
      alert(`Fout bij opslaan naar database:\n\n${errorMsg}\n\nBackup gemaakt in localStorage: ${backupKey}`);
    } finally {
      setSaving(false);
    }
  };

  const wedstrijdNaam = wedstrijden?.find(w => w.id === wedstrijd)?.naam || '';
  const meta = { wedstrijd, wedstrijdNaam, klasse, rubriek, dressuurStarttijd, trailStarttijd, tussenPauze, pauzeMinuten };

  const makeBatchPDF = async () => {
    const hasKlasseStartTimes = Object.keys(klasseStartTimes).some(k => klasseStartTimes[k]?.dressuur || klasseStartTimes[k]?.trail);
    const calculatedTimes = hasKlasseStartTimes 
      ? calculateStartTimesPerClass(filtered, klasseStartTimes, tussenPauze, pauzeMinuten)
      : calculateStartTimes(filtered, dressuurStarttijd, trailStarttijd, tussenPauze, pauzeMinuten);
    
    const blob = await generateSimplePDF(
      `Startlijst ${klasse || ""} ${rubriek || ""}`.trim(),
      filtered,
      calculatedTimes,
      wedstrijdNaam
    );
    downloadBlob(blob, "startlijst.pdf");
  };

  // Load deelnemers from database
  const loadDeelnemersFromDB = useCallback(async () => {
    if (!wedstrijd) {
      setDbMessage("Selecteer eerst een wedstrijd");
      return;
    }
    setLoadingFromDB(true);
    setDbMessage("Laden van deelnemers...");
    
    console.log("Loading deelnemers for wedstrijd:", wedstrijd, "klasse:", klasse);
    
    try {
      let query = supabase
        .from("inschrijvingen")
        .select("id,ruiter,paard,startnummer,klasse,rubriek,wedstrijd_id,created_at")
        .eq("wedstrijd_id", wedstrijd)
        .order("created_at", { ascending: true }); // Sorteren op aanmelddatum, oudste eerst

      if (klasse) {
        query = query.eq("klasse", klasse);
      }

      const { data, error } = await query;
      console.log("Database query result:", { dataLength: data?.length, error, wedstrijd_id: wedstrijd });
      
      if (error) {
        console.warn("Database error, trying localStorage:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        // Try localStorage fallback
        console.log("No database data, trying localStorage");
        const storageKey = `startlijst_${wedstrijd}`;
        const stored = localStorage.getItem(storageKey) || localStorage.getItem(LS_KEY);
        
        if (stored) {
          const parsed = JSON.parse(stored);
          const filteredRows = klasse ? parsed.filter(r => normalizeKlasse(r.klasse) === klasse) : parsed;
          setRows(filteredRows);
          setDbMessage(`✅ ${filteredRows.filter(r => r.type === 'entry').length} deelnemers geladen (localStorage)`);
          setLoadingFromDB(false);
          return;
        }
      }

      const loadedRows = (data || []).map((r, i) => ({
        id: `db_${Date.now()}_${i}`,
        type: "entry",
        ruiter: r.ruiter || "",
        paard: r.paard || "",
        startnummer: (r.startnummer || "").toString(),
        klasse: normalizeKlasse(r.klasse) || "", // Normaliseer klasse bij laden
        starttijd: "",
        dbId: r.id, // Store database ID for later updates/deletes
        fromDB: true, // Mark as loaded from database
      }));

      setRows(loadedRows);
      setDbMessage(`${loadedRows.length} deelnemers geladen uit database`);
      console.log("Loaded rows:", loadedRows);
    } catch (e) {
      const errorMsg = e?.message || String(e);
      console.error("Error loading participants, trying localStorage:", e);
      
      // Fallback to localStorage
      const storageKey = `startlijst_${wedstrijd}`;
      const stored = localStorage.getItem(storageKey) || localStorage.getItem(LS_KEY);
      
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const filteredRows = klasse ? parsed.filter(r => normalizeKlasse(r.klasse) === klasse) : parsed;
          setRows(filteredRows);
          setDbMessage(`✅ ${filteredRows.filter(r => r.type === 'entry').length} deelnemers geladen (localStorage - database niet beschikbaar)`);
        } catch (parseErr) {
          setDbMessage(`❌ Fout bij laden: ${errorMsg}`);
        }
      } else {
        setDbMessage(`⚠️ Geen opgeslagen data gevonden (database niet beschikbaar)`);
      }
    } finally {
      setLoadingFromDB(false);
    }
  }, [wedstrijd, klasse]);

  useEffect(() => {
    if (wedstrijd) {
      loadDeelnemersFromDB();
    }
  }, [wedstrijd, loadDeelnemersFromDB]);

  return (
    <Container>
      <div className="max-w-7xl mx-auto py-6">
        {/* Header sectie */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Startlijst Management</h1>
              <p className="text-gray-600 mt-2">
                Beheer startlijsten, startnummers en deelnemer volgorde
              </p>
            </div>
            
            {/* Navigation links */}
            <div className="flex gap-2">
              <Link
                to="/deelnemers"
                className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-sm font-medium"
              >
                👥 Naar Deelnemers
              </Link>
            </div>
          </div>
        </div>

      {/* Flex layout - links bewerkingstabel, rechts preview */}
      <div className="flex gap-6 items-start">
        {/* Main editing area (links) - nu 65% van de ruimte */}
        <div className="flex-1 max-w-4xl">
        {/* Filters sectie */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters & Zoekopdrachten</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Wedstrijd:
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={wedstrijd}
                onChange={(e) => setWedstrijd(e.target.value)}
              >
                <option value="">
                  {loadingWed ? "Laden..." : "— kies wedstrijd —"}
                </option>
                {(wedstrijden || []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.naam}
                    {w.datum ? ` (${w.datum})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Klasse:
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Klasse (WE0–WE4)"
                value={klasse}
                onChange={(e) => setKlasse(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Rubriek:
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Rubriek"
                value={rubriek}
                onChange={(e) => setRubriek(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Zoeken:
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="ruiter/paard/startnr/tijd/pauze"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Startnummer Configuratie (vereenvoudigd) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-gray-900">Starttijden</h2>
              <div className="flex items-center gap-2 text-sm">
                <label className="text-gray-600">Dressuur:</label>
                <input
                  type="time"
                  className="border rounded px-2 py-1 text-sm"
                  value={dressuurStarttijd}
                  onChange={(e) => setDressuurStarttijd(e.target.value)}
                />
                <label className="text-gray-600 ml-3">Trail:</label>
                <input
                  type="time"
                  className="border rounded px-2 py-1 text-sm"
                  value={trailStarttijd}
                  onChange={(e) => setTrailStarttijd(e.target.value)}
                />
                <label className="text-gray-600 ml-3">Interval:</label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  className="border rounded px-1 py-1 w-12 text-sm"
                  value={tussenPauze}
                  onChange={(e) => setTussenPauze(Number(e.target.value))}
                />
                <span className="text-gray-600 text-sm">min</span>
              </div>
            </div>
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              onClick={() => {
                const updatedRows = autoAssignStartnumbers(rows);
                setRows(updatedRows);
              }}
              disabled={!rows.filter(r => r.type === 'entry').length}
            >
              🔢 Auto Nummers
            </button>
            
            <button
              className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 ml-2"
              onClick={sortRowsByClass}
              disabled={!rows.filter(r => r.type === 'entry').length}
              title="Sorteer alle klassen op volgorde: WE0, WE1, WE2, WE3, WE4, Junioren, Young Riders, WE2+"
            >
              📋 Sorteer Klassen
            </button>
          </div>
        </div>

        {/* Per-klasse starttijden configuratie */}
        {classOrder.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <h3 className="text-md font-semibold text-gray-900 mb-3">Per klasse starttijden (optioneel)</h3>
            <p className="text-sm text-gray-600 mb-3">
              ⏱️ <strong>Automatisch doornummeren:</strong> Vul een starttijd in voor de eerste klasse. Alle klassen erna nummeren automatisch door, 
              tenzij je voor een volgende klasse een nieuwe starttijd invult - dan begint vanaf daar weer een nieuwe reeks.
            </p>
            <p className="text-sm text-gray-500 mb-3">
              Voorbeeld: WE0 start om 09:00, WE1 start automatisch door (bijv. 09:30), maar WE2 kun je instellen op 13:00 (na pauze).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {classOrder.map((klasse) => (
                <div key={klasse} className="border rounded p-3 bg-gray-50">
                  <div className="font-medium text-sm mb-2 text-gray-700">{klasse}</div>
                  <div className="flex gap-2 items-center">
                    <div className="flex flex-col flex-1">
                      <label className="text-xs text-gray-600">Dressuur:</label>
                      <input
                        type="time"
                        className="border rounded px-2 py-1 text-xs"
                        value={klasseStartTimes[klasse]?.dressuur || ''}
                        onChange={(e) => {
                          setKlasseStartTimes(prev => ({
                            ...prev,
                            [klasse]: {
                              ...prev[klasse],
                              dressuur: e.target.value
                            }
                          }));
                        }}
                        placeholder="Auto"
                      />
                    </div>
                    <div className="flex flex-col flex-1">
                      <label className="text-xs text-gray-600">Trail:</label>
                      <input
                        type="time"
                        className="border rounded px-2 py-1 text-xs"
                        value={klasseStartTimes[klasse]?.trail || ''}
                        onChange={(e) => {
                          setKlasseStartTimes(prev => ({
                            ...prev,
                            [klasse]: {
                              ...prev[klasse],
                              trail: e.target.value
                            }
                          }));
                        }}
                        placeholder="Auto"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actieknoppen sectie (vereenvoudigd) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Data laden</h2>
            
            <div className="flex items-center gap-3">
              <label className="cursor-pointer px-3 py-2 border-2 border-dashed border-gray-300 rounded hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm">
                📁 CSV Upload
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={onCSV}
                />
              </label>

              <button
                className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
                onClick={loadDeelnemersFromDB}
                disabled={!wedstrijd || loadingFromDB}
              >
                {loadingFromDB ? "⏳ Laden..." : "🔄 DB Laden"}
              </button>
            </div>
          </div>
        </div>

          {dbMessage && (
            <div className="mb-6">
              <div
                className={`p-4 rounded-lg border ${
                  dbMessage.includes("Fout")
                    ? "bg-red-50 border-red-200 text-red-800"
                    : dbMessage.includes("✅")
                    ? "bg-green-50 border-green-200 text-green-800"
                    : "bg-blue-50 border-blue-200 text-blue-800"
                }`}
              >
                <p className="font-medium">{dbMessage}</p>
              </div>
            </div>
          )}

          {/* Geen deelnemers gevonden helper */}
          {wedstrijd && rows.length === 0 && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 text-lg">ℹ️</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-blue-900 mb-2">
                    Geen deelnemers gevonden
                  </h3>
                  <p className="text-blue-700 mb-4">
                    Er zijn geen deelnemers gevonden voor deze wedstrijd. Je kunt:
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      onClick={copyFromOtherWedstrijd}
                    >
                      📋 Kopieer van andere wedstrijd
                    </button>
                    <button
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                      onClick={addEmptyRow}
                    >
                      ➕ Nieuwe deelnemer
                    </button>
                    <button
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                      onClick={showManualRecoveryForm}
                    >
                      📝 Bulk import
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Migration helper when no data found */}
          {wedstrijd && rows.length === 0 && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800 mb-2">
                Geen deelnemers gevonden voor deze wedstrijd.
              </p>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  onClick={copyFromOtherWedstrijd}
                >
                  Kopieer van andere wedstrijd
                </button>
                <button
                  className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  onClick={addEmptyRow}
                >
                  Voeg handmatig toe
                </button>
              </div>
            </div>
          )}

          <div className="flex items-end gap-2 mb-4">
            <div className="flex flex-col">
              <label className="text-sm text-gray-600">Pauze titel</label>
              <input
                className="border rounded px-2 py-1"
                placeholder="Bijv. Koffiepauze"
                value={pauseLabel}
                onChange={(e) => setPauseLabel(e.target.value)}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm text-gray-600">Minuten</label>
              <input
                className="border rounded px-2 py-1 w-24"
                type="number"
                min={1}
                value={pauseMin}
                onChange={(e) => setPauseMin(e.target.value)}
              />
            </div>
            <button
              className="px-3 py-2 border rounded"
              onClick={addPauseAtEnd}
            >
              + Pauze toevoegen
            </button>
          </div>

          {/* Eenvoudige bewerkingstabel - alle deelnemers op volgorde */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Startlijst Bewerken</h2>
                  <p className="text-xs text-gray-500 mt-1">💡 Sleep rijen (inclusief pauzes) om volgorde aan te passen</p>
                </div>
                <div className="text-sm text-gray-600">
                  {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Klasse</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dressuur</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trail</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Startnr</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ruiter</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paard</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acties</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    // Gebruik filtered rows in huidige volgorde (geen extra sorting)
                    // De volgorde wordt nu bepaald door moveClassUp/Down functies
                    let currentKlasse = null;
                    let klasseItemNumber = 0;
                    const seenKlasses = new Set(); // Track which class headers we've shown
                    
                    return filtered.map((row, index) => {
                      // Ensure every row has a valid ID
                      if (!row.id) {
                        row.id = `row_${Date.now()}_${index}`;
                      }
                      // Check if we need a class header
                      const rowKlasse = row.type === 'break' ? 'PAUZE' : (normalizeKlasse(row.klasse) || 'Geen klasse');
                      const showClassHeader = rowKlasse !== currentKlasse;
                      const isFirstHeaderForClass = !seenKlasses.has(rowKlasse);
                      
                      if (showClassHeader) {
                        currentKlasse = rowKlasse;
                        klasseItemNumber = 0;
                        seenKlasses.add(rowKlasse);
                      }
                      
                      if (row.type !== 'break') {
                        klasseItemNumber++;
                      }

                      // Gebruik per-klasse starttijden als deze ingesteld zijn, anders gebruik algemene tijden
                      const hasKlasseStartTimes = Object.keys(klasseStartTimes).some(k => klasseStartTimes[k]?.dressuur || klasseStartTimes[k]?.trail);
                      const calculatedTimes = hasKlasseStartTimes 
                        ? calculateStartTimesPerClass(rows, klasseStartTimes, tussenPauze, pauzeMinuten)
                        : calculateStartTimes(rows, dressuurStarttijd, trailStarttijd, tussenPauze, pauzeMinuten);
                      const times = calculatedTimes[row.id || index] || {};

                      return (
                        <React.Fragment key={`${row.id || index}-${rowKlasse}`}>
                          {showClassHeader && (
                            <tr className={`${row.type !== 'break' ? 'bg-blue-50' : 'bg-yellow-50'} transition-colors`}>
                              <td colSpan="8" className="px-4 py-2 text-sm font-semibold text-blue-800 border-b border-blue-200">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {row.type === 'break' ? 
                                      '🍕 Pauzes' : 
                                      `📋 Klasse ${rowKlasse} ${row.type !== 'break' ? `(startnrs vanaf ${getStartnummerBase(rowKlasse).toString().padStart(3, '0')})` : ''}`
                                    }
                                  </div>
                                  {row.type !== 'break' && isFirstHeaderForClass && (
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => moveClassUp(rowKlasse)}
                                        className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                        title="Verplaats klasse naar boven"
                                      >
                                        ▲
                                      </button>
                                      <button
                                        onClick={() => moveClassDown(rowKlasse)}
                                        className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                        title="Verplaats klasse naar beneden"
                                      >
                                        ▼
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}                          <tr 
                            className={`hover:bg-gray-50 ${row.type === 'break' ? 'bg-yellow-50' : ''} cursor-move transition-colors`}
                            draggable={true}
                            onDragStart={(e) => {
                              console.log('Drag start on element:', e.target.tagName);
                              handleDragStart(e, row);
                            }}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => {
                              e.preventDefault(); // Critical for drop to work
                              handleDragOver(e);
                            }}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, row)}
                            title="Sleep om rij te verplaatsen"
                          >
                            <td className="px-4 py-3 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <span className="cursor-move text-gray-400 hover:text-gray-600" title="Sleep hier om rij te verplaatsen">
                                  ⋮⋮
                                </span>
                                {row.type === 'break' ? '—' : klasseItemNumber}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {row.type === 'break' ? (
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                                  PAUZE
                                </span>
                              ) : (
                                <select
                                  className="border rounded px-2 py-1 text-sm bg-white"
                                  value={normalizeKlasse(row.klasse) || ""}
                                  onChange={(e) => {
                                    const newKlasse = e.target.value;
                                    setRows((prev) => {
                                      const next = prev.slice();
                                      const realIndex = rows.indexOf(row);
                                      if (realIndex >= 0) {
                                        next[realIndex] = { ...next[realIndex], klasse: newKlasse };
                                      }
                                      return next;
                                    });
                                  }}
                                >
                                  <option value="">Kies klasse...</option>
                                  <option value="WE0">WE0</option>
                                  <option value="WE1">WE1</option>
                                  <option value="WE2">WE2</option>
                                  <option value="WE3">WE3</option>
                                  <option value="WE4">WE4</option>
                                  <option value="Junioren">Junioren</option>
                                  <option value="Young Riders">Young Riders</option>
                                  <option value="WE2+">WE2+</option>
                                </select>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-mono text-blue-600">
                                {row.type === 'break' ? '—' : (times.dressuur || '--:--')}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-mono text-green-600">
                                {row.type === 'break' ? '—' : (times.trail || '--:--')}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {row.type === 'break' ? (
                                <span className="text-gray-400">—</span>
                              ) : (
                                <input
                                  className="border rounded px-2 py-1 w-16 text-sm"
                                  value={row.startnummer || ""}
                                  placeholder={`${getStartnummerBase(rowKlasse).toString().padStart(3, '0')}`}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setRows((prev) => {
                                      const next = prev.slice();
                                      const realIndex = rows.indexOf(row);
                                      if (realIndex >= 0) {
                                        next[realIndex] = { ...next[realIndex], startnummer: val };
                                      }
                                      return next;
                                    });
                                  }}
                                />
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {row.type === 'break' ? (
                                <input
                                  className="border rounded px-2 py-1 text-sm font-medium"
                                  value={row.label || ""}
                                  placeholder="Pauze naam"
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setRows((prev) => {
                                      const next = prev.slice();
                                      const realIndex = rows.indexOf(row);
                                      if (realIndex >= 0) {
                                        next[realIndex] = { ...next[realIndex], label: val };
                                      }
                                      return next;
                                    });
                                  }}
                                />
                              ) : (
                                <input
                                  className="border rounded px-2 py-1 text-sm"
                                  value={row.ruiter || ""}
                                  placeholder="Ruiter naam"
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setRows((prev) => {
                                      const next = prev.slice();
                                      const realIndex = rows.indexOf(row);
                                      if (realIndex >= 0) {
                                        next[realIndex] = { ...next[realIndex], ruiter: val };
                                      }
                                      return next;
                                    });
                                  }}
                                />
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {row.type === 'break' ? (
                                <div className="flex items-center space-x-1">
                                  <input
                                    className="border rounded px-1 py-1 w-12 text-xs"
                                    type="number"
                                    value={row.duration || ""}
                                    placeholder="15"
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setRows((prev) => {
                                        const next = prev.slice();
                                        const realIndex = rows.indexOf(row);
                                        if (realIndex >= 0) {
                                          next[realIndex] = { ...next[realIndex], duration: Number(val) || 0 };
                                        }
                                        return next;
                                      });
                                    }}
                                  />
                                  <span className="text-xs text-gray-500">min</span>
                                </div>
                              ) : (
                                <input
                                  className="border rounded px-2 py-1 text-sm"
                                  value={row.paard || ""}
                                  placeholder="Paard naam"
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setRows((prev) => {
                                      const next = prev.slice();
                                      const realIndex = rows.indexOf(row);
                                      if (realIndex >= 0) {
                                        next[realIndex] = { ...next[realIndex], paard: val };
                                      }
                                      return next;
                                    });
                                  }}
                                />
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-1">
                                <button
                                  className="px-2 py-1 text-xs border rounded hover:bg-red-50 text-red-600"
                                  onClick={() => {
                                    const realIndex = rows.indexOf(row);
                                    if (realIndex >= 0) {
                                      setRows((prev) => prev.filter((_, i) => i !== realIndex));
                                    }
                                  }}
                                  title="Verwijderen"
                                >
                                  🗑️
                                </button>
                                {row.fromDB && (
                                  <span className="px-1 py-1 text-xs bg-blue-100 text-blue-700 rounded">DB</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Lege staat */}
            {filtered.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <div className="text-4xl mb-4">🏇</div>
                <p className="text-lg mb-2">Geen deelnemers om te tonen</p>
                <p className="text-sm mb-4">Selecteer een wedstrijd en laad deelnemers</p>
              </div>
            )}
          </div>

          <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium"
                  onClick={() => addEmptyRow(setRows, klasse)}
                >
                  + Nieuwe deelnemer
                </button>
                
                <button
                  className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                  onClick={() => addBreak(setRows)}
                >
                  🍕 + Pauze
                </button>

                <label className="cursor-pointer px-4 py-2 border-2 border-dashed border-gray-300 rounded hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  📁 CSV Upload
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={onCSV}
                  />
                </label>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  onClick={loadDeelnemersFromDB}
                  disabled={!wedstrijd || loadingFromDB}
                >
                  {loadingFromDB ? "⏳ Laden..." : "🔄 DB Laden"}
                </button>

                <button
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  onClick={() => {
                    const hasKlasseStartTimes = Object.keys(klasseStartTimes).some(k => klasseStartTimes[k]?.dressuur || klasseStartTimes[k]?.trail);
                    const calculatedTimes = hasKlasseStartTimes 
                      ? calculateStartTimesPerClass(filtered, klasseStartTimes, tussenPauze, pauzeMinuten)
                      : calculateStartTimes(filtered, dressuurStarttijd, trailStarttijd, tussenPauze, pauzeMinuten);
                    exportToExcel(filtered, meta, calculatedTimes);
                  }}
                  disabled={!filtered.length}
                >
                  📊 Excel Export
                </button>
                
                <button
                  className={`px-4 py-2 rounded text-white font-medium ${saving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                  onClick={saveList}
                  disabled={saving || !wedstrijd}
                  title={!wedstrijd ? "Selecteer eerst een wedstrijd" : "Sla wijzigingen op naar database"}
                >
                  {saving ? 'Bezig...' : 'Opslaan'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Simpele samenvatting sidebar (rechts) */}
        <div className="w-80 flex-shrink-0">
          <div className="sticky top-4 space-y-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                📊 Overzicht
              </h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                  <span className="text-sm text-blue-700">Totaal deelnemers:</span>
                  <span className="font-bold text-blue-800">
                    {filtered.filter(r => r.type === 'entry').length}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-yellow-50 rounded">
                  <span className="text-sm text-yellow-700">Pauzes:</span>
                  <span className="font-bold text-yellow-800">
                    {filtered.filter(r => r.type === 'break').length}
                  </span>
                </div>

                {(() => {
                  const klassen = {};
                  filtered.filter(r => r.type === 'entry').forEach(r => {
                    const kl = normalizeKlasse(r.klasse) || 'Geen klasse';
                    klassen[kl] = (klassen[kl] || 0) + 1;
                  });
                  
                  return Object.keys(klassen).length > 0 && (
                    <div className="border-t pt-3">
                      <div className="text-sm font-medium text-gray-700 mb-2">Per klasse:</div>
                      <div className="space-y-1">
                        {Object.entries(klassen)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([klasse, count]) => (
                            <div key={klasse} className="flex justify-between items-center text-sm">
                              <span className="text-gray-600">{klasse}:</span>
                              <span className="font-medium">{count}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })()}

                {wedstrijd && (
                  <div className="border-t pt-3">
                    <div className="text-xs text-gray-500">
                      <div>Wedstrijd: {wedstrijden?.find(w => w.id === wedstrijd)?.naam || wedstrijd}</div>
                      {klasse && <div>Filter klasse: {klasse}</div>}
                      {rubriek && <div>Rubriek: {rubriek}</div>}
                    </div>
                  </div>
                )}

                <div className="border-t pt-3">
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Dressuur start: <span className="font-mono">{dressuurStarttijd}</span></div>
                    <div>Trail start: <span className="font-mono">{trailStarttijd}</span></div>
                    <div>Interval: {tussenPauze} minuten</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-700 mb-3">Snelle acties</h4>
              <div className="space-y-2">
                <button
                  className="w-full px-3 py-2 text-sm bg-white border rounded hover:bg-gray-50 text-left"
                  onClick={makeBatchPDF}
                  disabled={!filtered.length}
                >
                  📄 Download PDF
                </button>
                <button
                  className="w-full px-3 py-2 text-sm bg-white border rounded hover:bg-gray-50 text-left"
                  onClick={() => {
                    // Open een nieuw venster met de volledige startlijst
                    const printWindow = window.open('', '_blank');
                    const hasKlasseStartTimes = Object.keys(klasseStartTimes).some(k => klasseStartTimes[k]?.dressuur || klasseStartTimes[k]?.trail);
                    const calculatedTimes = hasKlasseStartTimes 
                      ? calculateStartTimesPerClass(filtered, klasseStartTimes, tussenPauze, pauzeMinuten)
                      : calculateStartTimes(filtered, dressuurStarttijd, trailStarttijd, tussenPauze, pauzeMinuten);
                    
                    const htmlContent = `
                      <!DOCTYPE html>
                      <html>
                      <head>
                        <title>Startlijst Volledig Overzicht</title>
                        <style>
                          body { font-family: Arial, sans-serif; margin: 20px; }
                          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                          th { background-color: #f2f2f2; font-weight: bold; }
                          .class-header { background-color: #e3f2fd; font-weight: bold; }
                          .break-row { background-color: #fff3e0; font-weight: bold; }
                          .dressuur { color: #1976d2; }
                          .trail { color: #388e3c; }
                          @media print { body { margin: 0; } }
                        </style>
                      </head>
                      <body>
                        <h1>Startlijst ${wedstrijdNaam || 'Wedstrijd'}</h1>
                        <p>Gegenereerd op: ${new Date().toLocaleString()}</p>
                        <p>Dressuur start: ${dressuurStarttijd} | Trail start: ${trailStarttijd} | Interval: ${tussenPauze} min</p>
                        
                        <table>
                          <tr>
                            <th>#</th>
                            <th>Klasse</th>
                            <th>Dressuur</th>
                            <th>Trail</th>
                            <th>Startnr</th>
                            <th>Ruiter</th>
                            <th>Paard</th>
                          </tr>
                          ${filtered.map((row, index) => {
                            const times = calculatedTimes[row.id || index] || {};
                            if (row.type === 'break') {
                              return `<tr class="break-row">
                                <td>${index + 1}</td>
                                <td colspan="4">🍕 PAUZE</td>
                                <td>${row.label || 'Pauze'}</td>
                                <td>${row.duration || 0} minuten</td>
                              </tr>`;
                            }
                            return `<tr>
                              <td>${index + 1}</td>
                              <td>${normalizeKlasse(row.klasse) || 'Geen klasse'}</td>
                              <td class="dressuur">${times.dressuur || '--:--'}</td>
                              <td class="trail">${times.trail || '--:--'}</td>
                              <td>${row.startnummer || ''}</td>
                              <td>${row.ruiter || ''}</td>
                              <td>${row.paard || ''}</td>
                            </tr>`;
                          }).join('')}
                        </table>
                        
                        <script>
                          window.onload = function() {
                            window.print();
                          }
                        </script>
                      </body>
                      </html>
                    `;
                    
                    printWindow.document.write(htmlContent);
                    printWindow.document.close();
                  }}
                  disabled={!filtered.length}
                >
                  👁️ Volledig overzicht
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </Container>
  );
}
