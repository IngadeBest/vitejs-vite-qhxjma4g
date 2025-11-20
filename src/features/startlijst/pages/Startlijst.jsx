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

// ======= Helpers =======
const LS_KEY = "wp_startlijst_cache_v1";

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

async function generateSimplePDF(title, rows, classStartTimes = {}) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(16);
  doc.text(title, 40, 50);

  const body = rows.map((r, i) => {
    if (r.type === "break") {
      return [
        "",
        "",
        "",
        `— PAUZE: ${r.label || ""} (${r.duration || 0} min) —`,
        "",
      ];
    }
    const classTime =
      r.klasse && classStartTimes[r.klasse] ? classStartTimes[r.klasse] : "";
    const effectiveTime = r.starttijd || classTime || "";
    return [
      String(i + 1),
      effectiveTime,
      r.startnummer || "",
      r.ruiter || "",
      r.paard || "",
    ];
  });

  autoTable(doc, {
    head: [["#", "Tijd", "Startnr", "Ruiter", "Paard / Pauze"]],
    body,
    startY: 80,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [230, 230, 230] },
    margin: { left: 40, right: 40 },
    didParseCell: (data) => {
      const r = rows[data.row.index];
      if (r?.type === "break") {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  return doc.output("blob");
}

// Excel export met fallback
async function exportToExcel(rows, meta = {}, classStartTimes = {}) {
  try {
    const XLSX = await import("xlsx");
    const data = rows.map((r, idx) => {
      const classTime =
        r.klasse && classStartTimes[r.klasse] ? classStartTimes[r.klasse] : "";
      const effectiveTime = r.type === "break" ? "" : r.starttijd || classTime || "";
      return {
        Volgorde: idx + 1,
        Type: r.type === "break" ? "PAUZE" : "RIT",
        Tijd: effectiveTime,
        Startnummer: r.type === "break" ? "" : r.startnummer || "",
        Ruiter: r.type === "break" ? "" : r.ruiter || "",
        Paard: r.type === "break" ? "" : r.paard || "",
        Klasse: r.type === "break" ? "" : r.klasse || "",
        PauzeLabel: r.type === "break" ? r.label || "" : "",
        PauzeMinuten: r.type === "break" ? r.duration || 0 : "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Startlijst");
    const title = `Startlijst_${meta.wedstrijd || ""}_${
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
    // Fallback CSV
    const header = [
      "Volgorde",
      "Type",
      "Tijd",
      "Startnummer",
      "Ruiter",
      "Paard",
      "Klasse",
      "PauzeLabel",
      "PauzeMinuten",
    ];
    const lines = [header.join(",")];
    rows.forEach((r, idx) => {
      const classTime =
        r.klasse && classStartTimes[r.klasse] ? classStartTimes[r.klasse] : "";
      const effectiveTime = r.type === "break" ? "" : r.starttijd || classTime || "";
      const line = [
        idx + 1,
        r.type === "break" ? "PAUZE" : "RIT",
        effectiveTime,
        r.type === "break" ? "" : r.startnummer || "",
        r.type === "break" ? "" : r.ruiter || "",
        r.type === "break" ? "" : r.paard || "",
        r.type === "break" ? "" : r.klasse || "",
        r.type === "break" ? r.label || "" : "",
        r.type === "break" ? r.duration || 0 : "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
      lines.push(line);
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

  // DnD (per deelnemer, in hoofdtabel) - binnen dezelfde klasse
  const dragIndex = useRef(null);
  const onDragStart = (idx) => (ev) => {
    dragIndex.current = idx;
    ev.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (idx) => (ev) => {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = "move";
  };
  const onDrop = (idx) => (ev) => {
    ev.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === idx) return;

    const sourceRow = filtered[from];
    const targetRow = filtered[idx];

    // Pauzes mogen overal heen, deelnemers alleen binnen hun klasse
    if (
      sourceRow?.type === "entry" &&
      targetRow?.type === "entry" &&
      (sourceRow.klasse || "") !== (targetRow.klasse || "")
    ) {
      dragIndex.current = null;
      return;
    }

    setRows((prev) => {
      const next = prev.slice();
      const fromReal = prev.indexOf(sourceRow);
      const toReal = prev.indexOf(targetRow);
      if (fromReal === -1 || toReal === -1) return prev;
      const [moved] = next.splice(fromReal, 1);
      next.splice(toReal, 0, moved);
      return next;
    });
    dragIndex.current = null;
  };

  // DnD voor klassen (chips)
  const classDragIndex = useRef(null);
  const onClassDragStart = (index) => (e) => {
    classDragIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
  };
  const onClassDragOver = (index) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onClassDrop = (index) => (e) => {
    e.preventDefault();
    const from = classDragIndex.current;
    if (from === null || from === index) return;
    setClassOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
    classDragIndex.current = null;
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

  // Preview modal
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  
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
    setDbMessage("Opslaan naar database...");

    try {
      // Eenvoudige aanpak: verwijder alle bestaande entries voor deze wedstrijd en voeg alle huidige toe
      
      // Stap 1: BACKUP check - ensure we have data in current rows
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
        console.error("Delete error:", deleteError);
        throw deleteError;
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
        console.error("Insert error:", insertError);
        throw insertError;
      }

      // Save to localStorage als backup
      localStorage.setItem(LS_KEY, JSON.stringify(rows));
      
      setDbMessage(`✅ ${entries.length} deelnemers opgeslagen in database (backup: ${backupKey})`);
      setShowPreview(false);
      
      // Herlaad data om sync te behouden
      setTimeout(() => {
        loadDeelnemersFromDB();
      }, 1000);

    } catch (error) {
      console.error('Error saving to database:', error);
      const errorMsg = error?.message || String(error);
      setDbMessage(`❌ Fout bij opslaan: ${errorMsg} (Backup beschikbaar: ${backupKey})`);
      alert(`Fout bij opslaan naar database: ${errorMsg}\n\nBackup gemaakt: ${backupKey}`);
    } finally {
      setSaving(false);
    }
  };

  const meta = { wedstrijd, klasse, rubriek };

  const makeBatchPDF = async () => {
    const blob = await generateSimplePDF(
      `Startlijst ${wedstrijd || ""} ${klasse || ""} ${rubriek || ""}`.trim(),
      filtered,
      classStartTimes
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
      
      if (error) throw error;

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
      setDbMessage(`Fout bij laden: ${errorMsg}`);
      console.error("Error loading participants:", e);
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
    <div className="p-4 max-w-full mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Startlijsten</h1>
        
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

      {/* Flex layout zodat preview altijd rechts staat */}
      <div className="flex gap-4 items-start">
        {/* Main editing area (links) */}
        <div className="w-2/3">
          <div className="grid grid-cols-4 gap-3 mb-4">
            <select
              className="border rounded px-2 py-1"
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
            <input
              className="border rounded px-2 py-1"
              placeholder="Klasse (WE0–WE4)"
              value={klasse}
              onChange={(e) => setKlasse(e.target.value)}
            />
            <input
              className="border rounded px-2 py-1"
              placeholder="Rubriek"
              value={rubriek}
              onChange={(e) => setRubriek(e.target.value)}
            />
            <input
              className="border rounded px-2 py-1"
              placeholder="Zoeken (ruiter/paard/startnr/tijd/pauze)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="cursor-pointer inline-flex items-center gap-2">
              <span className="px-3 py-2 border rounded bg-white">
                CSV uploaden
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={onCSV}
              />
            </label>

            <button
              className="px-3 py-2 border rounded"
              onClick={() => setShowPreview(true)}
            >
              Preview
            </button>

            <button
              className="px-3 py-2 border rounded"
              onClick={makeBatchPDF}
              disabled={!filtered.length}
            >
              Batch PDF
            </button>

            <button
              className="px-3 py-2 border rounded"
              onClick={() => exportToExcel(filtered, meta, classStartTimes)}
              disabled={!filtered.length}
            >
              Export naar Excel
            </button>

            <button
              className="px-3 py-2 border rounded bg-blue-50"
              onClick={loadDeelnemersFromDB}
              disabled={!wedstrijd || loadingFromDB}
            >
              {loadingFromDB ? "Laden..." : "Laad deelnemers uit DB"}
            </button>
            
            <button
              className="px-3 py-2 border rounded bg-green-50"
              onClick={() => {
                const updatedRows = autoAssignStartnumbers(rows);
                setRows(updatedRows);
              }}
              disabled={!rows.filter(r => r.type === 'entry').length}
              title="Automatische startnummers per klasse: WE0=001+, WE1=101+, WE2=201+, etc."
            >
              🔢 Auto Startnummers
            </button>
            
            <button
              className="px-3 py-2 border rounded bg-green-50"
              onClick={() => {
                const updatedRows = autoAssignStartnumbers(rows);
                setRows(updatedRows);
              }}
              disabled={!rows.filter(r => r.type === 'entry').length}
              title="Automatische startnummers per klasse: WE0=001+, WE1=101+, WE2=201+, etc."
            >
              🔢 Auto Startnummers
            </button>
            
            <button
              className="px-3 py-2 border rounded bg-green-50"
              onClick={() => {
                const updatedRows = autoAssignStartnumbers(rows);
                setRows(updatedRows);
              }}
              disabled={!rows.filter(r => r.type === 'entry').length}
            >
              🔢 Auto Startnummers
            </button>
          </div>

          {dbMessage && (
            <div
              className={`mb-4 p-2 rounded ${
                dbMessage.includes("Fout")
                  ? "bg-red-100 text-red-700"
                  : dbMessage.includes("✅")
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {dbMessage}
            </div>
          )}

          {/* Data management tools */}
          {wedstrijd && rows.length === 0 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800 mb-2">
                Geen deelnemers gevonden voor deze wedstrijd.
              </p>
              <div className="flex gap-2 flex-wrap">
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
                  + Nieuwe deelnemer
                </button>
                <button
                  className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                  onClick={showManualRecoveryForm}
                >
                  Bulk import
                </button>
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

          <div className="space-y-6">
            {(() => {
              // Groepeer deelnemers per klasse
              const { classGroups, breaks } = groupRowsByClass(filtered);
              
              // Definieer klasse volgorde
              const klasseOrder = ['WE0', 'WE1', 'WE2', 'WE3', 'WE4', 'Junioren', 'Young Riders', 'WE2+'];
              const orderedKlassen = klasseOrder.filter(k => classGroups[k] && classGroups[k].length > 0);
              const otherKlassen = Object.keys(classGroups).filter(k => !klasseOrder.includes(k) && classGroups[k].length > 0);
              
              // Handel lege klassen af
              const legeKlasseEntries = classGroups[''] || [];
              
              return (
                <>
                  {/* Entries zonder klasse */}
                  {legeKlasseEntries.length > 0 && (
                    <div className="border rounded-lg overflow-hidden bg-red-50">
                      <div className="bg-red-100 px-4 py-3 border-b">
                        <h3 className="font-semibold text-red-800 flex items-center gap-2">
                          ⚠️ Geen klasse toegewezen ({legeKlasseEntries.length} deelnemers)
                          <span className="text-sm font-normal">Wijs hieronder een klasse toe</span>
                        </h3>
                      </div>
                      <div className="p-4">
                        <table className="min-w-full">
                          <thead>
                            <tr className="bg-gray-50 text-left">
                              <th className="p-3 w-12">#</th>
                              <th className="p-3 w-24">Tijd</th>
                              <th className="p-3 w-24">Startnr</th>
                              <th className="p-3">Ruiter</th>
                              <th className="p-3">Paard</th>
                              <th className="p-3 w-32">Klasse</th>
                              <th className="p-3 w-36">Acties</th>
                            </tr>
                          </thead>
                          <tbody>
                            {legeKlasseEntries.map((row, idx) => {
                              const globalIdx = filtered.indexOf(row);
                              return (
                                <tr key={row.id || idx} className="border-t hover:bg-gray-50">
                                  <td className="p-3 text-sm text-gray-600">{idx + 1}</td>
                                  <td className="p-3">
                                    <input
                                      type="time"
                                      className="border rounded px-2 py-1 w-24 text-sm"
                                      value={row.starttijd || ""}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setRows((prev) => {
                                          const next = prev.slice();
                                          const realIndex = rows.indexOf(row);
                                          if (realIndex >= 0) {
                                            next[realIndex] = { ...next[realIndex], starttijd: val };
                                          }
                                          return next;
                                        });
                                      }}
                                    />
                                  </td>
                                  <td className="p-3">
                                    <input
                                      className="border rounded px-2 py-1 w-20 text-sm"
                                      value={row.startnummer || ""}
                                      placeholder="001"
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
                                  </td>
                                  <td className="p-3">
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
                                  </td>
                                  <td className="p-3">
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
                                  </td>
                                  <td className="p-3">
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
                                  </td>
                                  <td className="p-3">
                                    <div className="flex space-x-1">
                                      <button
                                        className="px-2 py-1 text-xs border rounded hover:bg-red-50"
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
                                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">DB</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {/* Render klassen in volgorde */}
                  {[...orderedKlassen, ...otherKlassen].map(klasseNaam => {
                    const klasseEntries = classGroups[klasseNaam];
                    if (!klasseEntries || klasseEntries.length === 0) return null;
                    
                    return (
                      <div key={klasseNaam} className="border rounded-lg overflow-hidden shadow-sm">
                        {/* Klasse header */}
                        <div className="bg-blue-100 px-4 py-3 border-b">
                          <h3 className="font-semibold text-blue-800 text-lg flex items-center justify-between">
                            <span>{klasseNaam} ({klasseEntries.length} deelnemers)</span>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="px-2 py-1 bg-blue-200 text-blue-700 rounded text-xs">
                                Startnrs: {getStartnummerBase(klasseNaam).toString().padStart(3, '0')}+
                              </span>
                              <button
                                className="px-2 py-1 bg-blue-200 hover:bg-blue-300 text-blue-700 rounded text-xs"
                                onClick={() => {
                                  // Auto-assign startnumbers for just this class
                                  const updatedRows = rows.map(row => {
                                    if (row.type === 'entry' && normalizeKlasse(row.klasse) === klasseNaam) {
                                      const classEntries = rows.filter(r => r.type === 'entry' && normalizeKlasse(r.klasse) === klasseNaam);
                                      const index = classEntries.indexOf(row);
                                      const base = getStartnummerBase(klasseNaam);
                                      return { ...row, startnummer: (base + index).toString().padStart(3, '0') };
                                    }
                                    return row;
                                  });
                                  setRows(updatedRows);
                                }}
                                title={`Automatische startnummers voor ${klasseNaam}`}
                              >
                                🔢 Auto nrs
                              </button>
                            </div>
                          </h3>
                        </div>
                        
                        {/* Deelnemers tabel */}
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead>
                              <tr className="bg-gray-50 text-left">
                                <th className="p-3 w-12">#</th>
                                <th className="p-3 w-24">Tijd</th>
                                <th className="p-3 w-24">Startnr</th>
                                <th className="p-3">Ruiter</th>
                                <th className="p-3">Paard</th>
                                <th className="p-3 w-32">Klasse</th>
                                <th className="p-3 w-36">Acties</th>
                              </tr>
                            </thead>
                            <tbody>
                              {klasseEntries.map((row, idx) => {
                                const globalIdx = filtered.indexOf(row);
                                return (
                                  <tr key={row.id || idx} className="border-t hover:bg-gray-50">
                                    <td className="p-3 text-sm text-gray-600">{idx + 1}</td>
                                    <td className="p-3">
                                      <input
                                        type="time"
                                        className="border rounded px-2 py-1 w-24 text-sm"
                                        value={row.starttijd || ""}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setRows((prev) => {
                                            const next = prev.slice();
                                            const realIndex = rows.indexOf(row);
                                            if (realIndex >= 0) {
                                              next[realIndex] = { ...next[realIndex], starttijd: val };
                                            }
                                            return next;
                                          });
                                        }}
                                      />
                                    </td>
                                    <td className="p-3">
                                      <input
                                        className="border rounded px-2 py-1 w-20 text-sm"
                                        value={row.startnummer || ""}
                                        placeholder={`${getStartnummerBase(klasseNaam).toString().padStart(3, '0')}`}
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
                                    </td>
                                    <td className="p-3">
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
                                    </td>
                                    <td className="p-3">
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
                                    </td>
                                    <td className="p-3">
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
                                    </td>
                                    <td className="p-3">
                                      <div className="flex space-x-1">
                                        <button
                                          className="px-2 py-1 text-xs border rounded hover:bg-red-50"
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
                                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">DB</span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Pauzes sectie */}
                  {breaks.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-yellow-100 px-4 py-3 border-b">
                        <h3 className="font-semibold text-yellow-800 text-lg">
                          🍕 Pauzes ({breaks.length})
                        </h3>
                      </div>
                      <div className="p-4">
                        <table className="min-w-full">
                          <tbody>
                            {breaks.map((row, idx) => {
                              const globalIdx = filtered.indexOf(row);
                              return (
                                <tr key={row.id || idx} className="border-t bg-yellow-50">
                                  <td className="p-3 w-12 text-sm text-gray-600">{globalIdx + 1}</td>
                                  <td className="p-3 font-semibold text-orange-700">
                                    <input
                                      className="border rounded px-2 py-1 bg-white"
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
                                  </td>
                                  <td className="p-3">
                                    <div className="flex items-center space-x-2">
                                      <input
                                        className="border rounded px-2 py-1 w-16"
                                        type="number"
                                        value={row.duration || ""}
                                        placeholder="Min"
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
                                      <span className="text-orange-600 text-sm">minuten</span>
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <button
                                      className="px-2 py-1 text-xs border rounded hover:bg-red-50"
                                      onClick={() => {
                                        const realIndex = rows.indexOf(row);
                                        if (realIndex >= 0) {
                                          setRows((prev) => prev.filter((_, i) => i !== realIndex));
                                        }
                                      }}
                                    >
                                      🗑️
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {/* Lege staat */}
                  {Object.keys(classGroups).length === 0 && breaks.length === 0 && (
                    <div className="p-12 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                      <div className="text-4xl mb-4">🏇</div>
                      <p className="text-lg mb-2">Geen deelnemers of pauzes om te tonen</p>
                      <p className="text-sm mb-4">Klik op "Laad deelnemers uit DB" om te beginnen of voeg handmatig toe</p>
                      <div className="space-x-2">
                        {wedstrijd && (
                          <button
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            onClick={loadDeelnemersFromDB}
                            disabled={loadingFromDB}
                          >
                            {loadingFromDB ? "Laden..." : "Laad deelnemers"}
                          </button>
                        )}
                        <button
                          className="px-4 py-2 border rounded hover:bg-gray-50"
                          onClick={() => addEmptyRow(setRows, klasse)}
                        >
                          + Nieuwe deelnemer
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          <div className="mt-4 flex gap-2 justify-between items-center">
            <div className="flex gap-2">
              <button
                className="px-3 py-2 border rounded bg-green-50 hover:bg-green-100"
                onClick={() => addEmptyRow(setRows, klasse)}
              >
                + Nieuwe deelnemer
              </button>
              
              <button
                className="px-3 py-2 border rounded bg-yellow-50 hover:bg-yellow-100"
                onClick={() => addBreak(setRows)}
              >
                🍕 + Pauze
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
            
            <div className="text-sm text-gray-600">
              {filtered.length} {filtered.length === 1 ? 'deelnemer' : 'deelnemers'}
            </div>
          </div>
        </div>

        {/* Live Preview Sidebar (rechts) */}
        <div className="w-1/3">
          <div className="sticky top-4 space-y-3">
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-700">
                  Live Preview
                </h3>
                <span className="text-sm text-gray-500">
                  {filtered.length} items
                </span>
              </div>

              {/* Volgorde + starttijd per klasse (drag & drop) */}
              {classOrder.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-semibold text-gray-600 mb-1">
                    Volgorde klassen (starttijden)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {classOrder.map((cls, index) => {
                      if (!previewClassMap.has(cls)) return null;
                      return (
                        <div
                          key={cls}
                          className="flex items-center gap-2 text-xs bg-white border rounded-full px-2 py-1 cursor-move"
                          draggable
                          onDragStart={onClassDragStart(index)}
                          onDragOver={onClassDragOver(index)}
                          onDrop={onClassDrop(index)}
                        >
                          <span>{cls === "Zonder klasse" ? "—" : cls}</span>
                          <input
                            type="time"
                            className="border rounded px-1 py-[1px] text-[10px]"
                            value={classStartTimes[cls] || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setClassStartTimes((prev) => ({
                                ...prev,
                                [cls]: val,
                              }));
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="max-h-[70vh] overflow-auto border rounded bg-white">
                {classOrder
                  .filter((cls) => previewClassMap.has(cls))
                  .map((cls) => {
                    const groupRows = previewClassMap.get(cls) || [];
                    const classTime = classStartTimes[cls] || "";
                    return (
                      <div key={cls} className="border-b last:border-b-0">
                        <div className="bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 flex justify-between items-center">
                          <span>
                            Klasse{" "}
                            {cls === "Zonder klasse" ? "— (niet ingevuld)" : cls}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {groupRows.length} deelnemer
                            {groupRows.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 text-left">
                              <th className="p-2 text-[10px]">#</th>
                              <th className="p-2 text-[10px]">Tijd</th>
                              <th className="p-2 text-[10px]">Nr</th>
                              <th className="p-2 text-[10px]">Ruiter</th>
                              <th className="p-2 text-[10px]">Paard</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupRows.map((r) => {
                              const globalIndex =
                                filtered.indexOf(r) + 1 || "?";
                              const effectiveTime =
                                r.starttijd || classTime || "--:--";
                              return (
                                <tr
                                  key={r.id}
                                  className="border-t hover:bg-gray-50"
                                >
                                  <td className="p-2 text-gray-600">
                                    {globalIndex}
                                  </td>
                                  <td className="p-2 font-mono">
                                    {effectiveTime}
                                  </td>
                                  <td className="p-2 font-mono">
                                    {r.startnummer || "??"}
                                  </td>
                                  <td className="p-2">
                                    <span className="font-medium">
                                      {r.ruiter || "[Leeg]"}
                                    </span>
                                  </td>
                                  <td className="p-2">
                                    <span className="text-gray-700">
                                      {r.paard || "[Leeg]"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}

                {/* Pauzes apart tonen */}
                {previewBreaks.length > 0 && (
                  <div className="border-t">
                    <div className="bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">
                      Pauzes (algemeen)
                    </div>
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-yellow-50 text-left">
                          <th className="p-2 text-[10px]">#</th>
                          <th className="p-2 text-[10px]">Beschrijving</th>
                          <th className="p-2 text-[10px]">Duur</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewBreaks.map((r) => {
                          const globalIndex = filtered.indexOf(r) + 1 || "?";
                          return (
                            <tr
                              key={r.id}
                              className="border-t bg-yellow-50/50"
                            >
                              <td className="p-2 text-gray-600">
                                {globalIndex}
                              </td>
                              <td className="p-2 font-semibold text-orange-700">
                                {r.label || "Pauze"}
                              </td>
                              <td className="p-2 text-orange-600">
                                {r.duration || 0} min
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {classOrder.filter((cls) => previewClassMap.has(cls)).length ===
                  0 && previewBreaks.length === 0 && (
                  <div className="p-4 text-gray-500 text-center text-xs">
                    Geen items om te tonen
                  </div>
                )}
              </div>

              {/* Quick stats */}
              <div className="mt-3 text-xs text-gray-600 space-y-1">
                <div>
                  Deelnemers:{" "}
                  {filtered.filter((r) => r.type === "entry").length}
                </div>
                <div>
                  Pauzes: {filtered.filter((r) => r.type === "break").length}
                </div>
                {wedstrijd && (
                  <div className="text-blue-600 font-medium">
                    Wedstrijd:{" "}
                    {wedstrijden?.find((w) => w.id === wedstrijd)?.naam ||
                      wedstrijd}
                  </div>
                )}
                {klasse && <div>Actieve filter klasse: {klasse}</div>}
                {rubriek && <div>Rubriek: {rubriek}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview modal (platte lijst) */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">Preview startlijst</h2>
              <button
                className="px-3 py-1 border rounded"
                onClick={() => setShowPreview(false)}
              >
                Sluiten
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto border rounded">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-2 w-10">#</th>
                    <th className="p-2 w-24">Tijd</th>
                    <th className="p-2 w-24">Startnr</th>
                    <th className="p-2">Ruiter</th>
                    <th className="p-2">Paard</th>
                    <th className="p-2 w-56">Type / Pauze</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const classTime =
                      r.klasse && classStartTimes[r.klasse]
                        ? classStartTimes[r.klasse]
                        : "";
                    const effectiveTime =
                      r.type === "break"
                        ? ""
                        : r.starttijd || classTime || "--:--";
                    return (
                      <tr
                        key={r.id || i}
                        className={`border-t ${
                          r.type === "break" ? "bg-yellow-50" : ""
                        }`}
                      >
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2">
                          {r.type === "break" ? "—" : effectiveTime}
                        </td>
                        <td className="p-2">
                          {r.type === "break" ? "—" : r.startnummer}
                        </td>
                        <td className="p-2">
                          {r.type === "break" ? "—" : r.ruiter}
                        </td>
                        <td className="p-2">
                          {r.type === "break" ? "—" : r.paard}
                        </td>
                        <td className="p-2">
                          {r.type === "break"
                            ? `PAUZE: ${r.label || ""} (${
                                r.duration || 0
                              } min)`
                            : `Rit${r.klasse ? ` (${r.klasse})` : ""}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex gap-2 justify-end">
              <button
                className="px-3 py-2 border rounded"
                onClick={() => exportToExcel(rows, meta, classStartTimes)}
              >
                Export naar Excel
              </button>
              <button
                className="px-3 py-2 border rounded"
                onClick={async () => {
                  const blob = await generateSimplePDF(
                    `Startlijst ${wedstrijd || ""} ${klasse || ""} ${
                      rubriek || ""
                    }`.trim(),
                    rows,
                    classStartTimes
                  );
                  downloadBlob(blob, "startlijst.pdf");
                }}
              >
                Download PDF
              </button>
              <button
                className={`px-3 py-2 border rounded text-white ${saving ? 'bg-gray-400' : 'bg-black'}`}
                onClick={saveList}
                disabled={saving}
              >
                {saving ? 'Bezig...' : 'Opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
