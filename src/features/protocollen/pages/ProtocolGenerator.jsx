import { protocolKey, readLocalProtocol, saveProtocol, validItems } from '../protocolPersistence';
import { buildWehProtocolPdf } from "@/pdf/wehProtocolPdf";
import { dressageRows, dressageMaximum } from "@/rules/weh/dressage";
import { WEH_METADATA } from "@/rules/weh/metadata";
import React, { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { padStartnummer, lookupOffset } from '@/lib/startnummer';
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";
import { useWedstrijdContext } from "@/features/wedstrijden/context/WedstrijdContext";
import { obstacleOptions, validateCourse } from "@/rules/weh/obstacles";
import { CLASSES, supportsComponent, normalizeClass, normalizeComponent } from "@/rules/weh/classes";
import { speedEventRules } from "@/rules/weh/speedTrail";
import jsPDF from 'jspdf';
import { generatePdfBlob, KLASSEN as PDF_KLASSEN, ONDERDELEN as PDF_ONDERDELEN } from '@/pdf/buildPdf';
import './ProtocolGenerator.css';

/* Klassen & Onderdelen - gebruik de geëxporteerde constanten uit buildPdf */
const KLASSEN = PDF_KLASSEN;
const ONDERDELEN = PDF_ONDERDELEN;
const TRAIL_LEVELS = CLASSES.map(c => ({code:c.code,label:c.naam}));

/* Backwards compatible wrapper voor makePdfBlob */
async function makePdfBlob(protocol, items) {
  return generatePdfBlob(protocol, items);
}

export default function ProtocolGenerator() {
  const { items: wedstrijden } = useWedstrijden(false);
  const { selectedWedstrijdId: appSelectedWedstrijdId } = useWedstrijdContext();
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
    if (!config.wedstrijd_id && appSelectedWedstrijdId) {
      setConfig(prev => ({ ...prev, wedstrijd_id: appSelectedWedstrijdId }));
    }
  }, [appSelectedWedstrijdId, config.wedstrijd_id]);

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
  const [savedItems, setSavedItems] = useState(null);
  const [savingItems, setSavingItems] = useState(false);
  const savingItemsRef = useRef(false);
  const [reloadItems, setReloadItems] = useState(0);
  const [items, setItems] = useState([]);
  const [dbHint, setDbHint] = useState('');
  const [csvRows, setCsvRows] = useState([]);
  const [dbRows, setDbRows] = useState([]);
  const [selectIndex, setSelectIndex] = useState(0);
  const [selectedRubriek, setSelectedRubriek] = useState('');
  const [pdfUrl, setPdfUrl] = useState(null);
  const [showParcoursMaker, setShowParcoursMaker] = useState(false);
  const [parcoursImage, setParcoursImage] = useState('');
  const [parcoursImageName, setParcoursImageName] = useState('');
  const [parcoursLevel, setParcoursLevel] = useState('we0');
  const [parcoursMeta, setParcoursMeta] = useState({
    eventNaam: '',
    locatie: '',
    datum: '',
    piste: '',
  });
  const [parcoursByLevel, setParcoursByLevel] = useState(() => Object.fromEntries(CLASSES.map(c => [c.code, ''])));
  const draggedItem = useRef(null);
  const draggedFromAvailable = useRef(false);
  const participantRequest = useRef(0);

  useEffect(() => {
    participantRequest.current += 1;
    setDbRows([]); setCsvRows([]); setSelectIndex(0); setPdfUrl(null);
  }, [config.wedstrijd_id, config.klasse, selectedRubriek]);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  useEffect(() => {
    setParcoursMeta((prev) => ({
      ...prev,
      eventNaam: selectedWedstrijd?.naam || prev.eventNaam,
      datum: config.datum || prev.datum,
    }));
  }, [selectedWedstrijd, config.datum]);

  const saveItemsConfig = async () => {
    if (savingItemsRef.current) return;
    savingItemsRef.current = true; setSavingItems(true);
    const snapshot = [...items];
    try {
      try { localStorage.setItem(protocolKey(config.wedstrijd_id, config.klasse), JSON.stringify(snapshot)); } catch { /* Central storage remains available. */ }
      const saved = await saveProtocol(supabase, config.wedstrijd_id, config.klasse, snapshot, savedItems);
      setSavedItems(saved);
      setDbMsg(`Opgeslagen bij de wedstrijd: ${saved.length} hindernissen. Beschikbaar op andere apparaten.`);
    } catch (error) { setDbMsg('Niet centraal opgeslagen: ' + error.message); }
    finally { savingItemsRef.current = false; setSavingItems(false); }
  };

  const loadItemsConfig = () => setReloadItems(v => v + 1);
  const restoreLocalItems = () => {
    const local = readLocalProtocol(localStorage, config.wedstrijd_id, config.klasse);
    if (local) { setItems(local); setDbMsg('Lokale configuratie teruggehaald. Klik Opslaan bij wedstrijd om deze centraal te bewaren.'); }
    else setDbMsg('Geen lokale configuratie gevonden op dit apparaat.');
  };
  const recoverLocalProtocols = async () => {
    if (!config.wedstrijd_id || savingItemsRef.current) return;
    savingItemsRef.current = true; setSavingItems(true);
    let count = 0;
    try {
      const {data, error} = await supabase.from('wedstrijden').select('protocol_config').eq('id', config.wedstrijd_id).maybeSingle();
      if (error) throw error;
      for (const c of CLASSES) {
        const local = readLocalProtocol(localStorage, config.wedstrijd_id, c.code);
        if (local?.length && data?.protocol_config?.[c.code] === undefined) {
          await saveProtocol(supabase, config.wedstrijd_id, c.code, local, null);
          count++;
        }
      }
      setDbMsg(count ? `${count} lokale stijlparcoursen teruggevonden en centraal opgeslagen.` : 'Geen extra lokale parcoursen gevonden. Bestaande centrale parcoursen zijn behouden.');
    } catch (error) { setDbMsg(`${count} parcoursen opgeslagen. Herstel gestopt: ${error.message}`); }
    finally { savingItemsRef.current = false; setSavingItems(false); }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setDbMsg(""); setDbMax(null); setItems([]); setSavedItems(null);
      if (!config.wedstrijd_id || !config.klasse || !config.onderdeel) return;
      
      if (config.onderdeel === 'dressuur') {
        setItems(dressageRows(config.klasse));
        setDbMax(dressageMaximum(config.klasse));
        setDbMsg('Officiële dressuurproef geladen (WEH 2026 v10).');
        return;
      }
      if (config.onderdeel === 'speed') {
        setItems(speedEventRules(config.klasse).map(r => [r.label, r.kind === 'review' ? r.reviewRequired : r.kind === 'disqualification' ? 'DQ' : `${r.kind === 'bonus' ? '-' : '+'}${r.seconds} sec${r.decisionStatus === 'user_agreed_pending_weh' ? ' (werkafspraak; WEH volgt)' : ''}`]));
        setDbMsg('Speedregels geladen uit het centrale WEH-regelboek.');
        return;
      }

      // Shared course per class; the youth section rides the same course.
      try {
        const { data: wedstrijd, error: configError } = await supabase.from('wedstrijden')
          .select('protocol_config').eq('id', config.wedstrijd_id).maybeSingle();
        if (configError) throw configError;
        if (!alive) return;
        const central = wedstrijd?.protocol_config?.[normalizeClass(config.klasse)];
        if (validItems(central)) {
          setSavedItems(central); setItems(central);
          setDbMsg(`Opgeslagen parcours geladen: ${central.length} hindernissen.`); return;
        }
        const local = readLocalProtocol(localStorage, config.wedstrijd_id, config.klasse);
        if (local) {
          setItems(local); setDbMsg('Eerder op dit apparaat opgeslagen parcours teruggevonden. Klik Opslaan bij wedstrijd om het centraal te bewaren.'); return;
        }
        const { data: candidates, error: e1 } = await supabase
          .from("proeven").select("id, uuid, max_score, naam, klasse, onderdeel")
          .eq("wedstrijd_id", config.wedstrijd_id);
        if (e1) throw e1;
        if (!alive) return;
        const matches = (candidates || []).filter(p => normalizeClass(p.klasse) === normalizeClass(config.klasse) && normalizeComponent(p.onderdeel) === normalizeComponent(config.onderdeel));
        const proef = matches[0];
        
        if (!proef?.uuid) { setDbMsg("Nog geen parcours opgeslagen bij deze proef. Selecteer hieronder de hindernissen."); return; }
        const { data: its, error: e2 } = await supabase
          .from("proeven_items").select("nr, omschrijving").eq("proef_id", proef.uuid).order("nr", { ascending: true });
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
  }, [config.wedstrijd_id, config.klasse, config.onderdeel, reloadItems]);

  async function loadDeelnemersFromDB() {
    if (!config.wedstrijd_id || !config.klasse) { setDbMsg('⚠️ Selecteer eerst wedstrijd en klasse'); return; }
    const request = ++participantRequest.current;
    setDbMsg('Laden...');
    setDbRows([]);
    setCsvRows([]);
    
    try {
      const { data: candidates, error } = await supabase
        .from('inschrijvingen')
        .select('ruiter,paard,startnummer,rubriek,klasse')
        .eq('wedstrijd_id', config.wedstrijd_id)
        .or('deelnemer_status.is.null,deelnemer_status.eq.actief')
        .order('startnummer', { ascending: true });
      
      if (error) throw error;
      if (request !== participantRequest.current) return;
      const data = (candidates || []).filter(r => normalizeClass(r.klasse) === normalizeClass(config.klasse)
        && (!selectedRubriek || (String(r.rubriek || '').toLowerCase() === 'jeugd' ? 'jeugd' : 'senior') === selectedRubriek));
      if (data && data.length > 0) {
        setDbRows(data.map((r, i) => ({
          ruiter: r.ruiter || '', paard: r.paard || '', rubriek: r.rubriek || selectedRubriek || 'senior',
          startnummer: (r.startnummer != null && r.startnummer !== '') ? padStartnummer(r.startnummer) : '',
          percentage: '',
          plaatsing: ''
        })));
        setDbMsg(`✅ ${data.length} deelnemers geladen uit database`);
        return;
      }
      setDbRows([]);
      setDbMsg('⚠️ Geen deelnemers gevonden in database voor deze selectie');
      setDbHint('Ga naar Startlijst en klik Opslaan voor deze wedstrijd/klasse, daarna opnieuw laden.');
    } catch (e) {
      if (request !== participantRequest.current) return;
      setDbRows([]);
      setDbMsg('Deelnemers konden niet worden geladen. Probeer opnieuw: ' + e.message);
    }
  }

  function loadTestDeelnemers() {
    if (!config.klasse) {
      setDbMsg('⚠️ Selecteer eerst een klasse');
      return;
    }

    const basis = lookupOffset(
      config.klasse,
      selectedRubriek || 'senior',
      selectedWedstrijd?.startlijst_config
    );

    const testRows = [
      {
        ruiter: 'Test Ruiter 1',
        paard: 'Test Paard 1',
        rubriek: selectedRubriek || 'senior',
        startnummer: String(basis),
      },
      {
        ruiter: 'Test Ruiter 2',
        paard: 'Test Paard 2',
        rubriek: selectedRubriek || 'senior',
        startnummer: String(basis + 1),
      },
      {
        ruiter: 'Test Ruiter 3',
        paard: 'Test Paard 3',
        rubriek: selectedRubriek || 'senior',
        startnummer: String(basis + 2),
      },
    ];

    setDbRows(testRows);
    setCsvRows([]);
    setDbHint('');
    setDbMsg(`✅ 3 testdeelnemers geladen voor ${config.klasse.toUpperCase()}`);
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
        const pick = (row, key) => {
          const i = idx[key];
          if (i === undefined) return "";
          const header = headers[i];
          return row[header] || row[key] || "";
        };
        const norm = rows.map(row => ({
          ruiter: pick(row, "ruiter"),
          paard: pick(row, "paard"),
          startnummer: pick(row, "startnummer"),
          percentage: pick(row, "percentage"),
          plaatsing: pick(row, "plaatsing"),
        })).filter(x => x.ruiter || x.paard);
        setCsvRows(norm);
      } catch { alert("Kon CSV niet lezen."); }
    };
    r.readAsText(file, "utf-8");
  };

  const protocollen = useMemo(() => {
    const src = (dbRows && dbRows.length) ? dbRows : csvRows;
    return (src || []).map((d, idx) => ({
      rulesVersion: WEH_METADATA.rulebookVersion,
      onderdeel: config.onderdeel,
      klasse: config.klasse,
      klasse_naam: KLASSEN.find((k) => k.code === config.klasse)?.naam || config.klasse,
      wedstrijd_id: config.wedstrijd_id,
      wedstrijd_naam: selectedWedstrijd?.naam || "",
      datum: config.datum || "",
      jury: config.jury || "",
      rubriek: d.rubriek || selectedRubriek || 'senior',
      startnummer: d.startnummer === '' || d.startnummer == null ? '' : padStartnummer(d.startnummer),
      ruiter: d.ruiter || "",
      paard: d.paard || "",
      percentage: d.percentage || "",
      plaatsing: d.plaatsing || "",
      max_score: dbMax,
      onderdeel_label: ONDERDELEN.find(o=>o.code===config.onderdeel)?.label || config.onderdeel
    }));
  }, [csvRows, dbRows, config, selectedWedstrijd, dbMax, selectedRubriek]);

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
      const doc = new jsPDF({ unit: "pt", format: "A4" });
      protocollen.forEach((p, i) => {
        if (i > 0) doc.addPage();
        buildWehProtocolPdf(p, items, doc);
      });
      doc.save(`protocollen_${config.onderdeel}.pdf`);
    } catch (error) { console.error(error); alert('Fout bij batch download: ' + error.message); }
  };

  const printBatch = async () => {
    try {
      if (!protocollen.length) return;
      const doc = new jsPDF({ unit: "pt", format: "A4" });
      protocollen.forEach((p, i) => {
        if (i > 0) doc.addPage();
        buildWehProtocolPdf(p, items, doc);
      });
      doc.autoPrint();
      const url = doc.output('bloburl');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) { console.error(error); alert('Fout bij batch printen: ' + error.message); }
  };

  const parseParcoursLines = (value) => String(value || '')
    .split('\n')
    .map((line) => line.trim().replace(/^\d+[.)]\s+/, ''))
    .filter(Boolean);

  const updateParcoursLines = (levelCode, value) => {
    setParcoursByLevel((prev) => ({ ...prev, [levelCode]: value }));
  };

  const fillParcoursFromItems = (levelCode) => {
    const text = (items || [])
      .map((item, idx) => {
        if (Array.isArray(item)) return `${idx + 1}. ${item.filter(Boolean).join(' - ')}`;
        return `${idx + 1}. ${String(item || '').trim()}`;
      })
      .filter((line) => !/\d+\.\s*$/.test(line))
      .join('\n');
    updateParcoursLines(levelCode, text);
  };

  const onParcoursImageFile = (file) => {
    if (!file) {
      setParcoursImage('');
      setParcoursImageName('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setParcoursImage(String(reader.result || ''));
      setParcoursImageName(file.name || 'parcours');
    };
    reader.onerror = () => {
      setParcoursImage('');
      setParcoursImageName('');
      alert('Kon afbeelding niet lezen.');
    };
    reader.readAsDataURL(file);
  };

  const exportTrailParcoursPdf = (levelCode) => {
    const level = TRAIL_LEVELS.find((l) => l.code === levelCode);
    const lines = parseParcoursLines(parcoursByLevel[levelCode]);
    if (!lines.length) {
      alert(`Geen obstakels ingevuld voor ${level?.label || levelCode}.`);
      return;
    }

    const check = validateCourse(levelCode, 'Stijltrail', lines);
    if (!check.valid || check.review.length) { alert([...check.errors, ...check.review].join('\n')); return; }
    const doc = new jsPDF({ unit: 'pt', format: 'A4', orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 34;
    const leftW = 480;
    const imageX = margin;
    const imageY = 96;
    const imageW = leftW;
    const imageH = pageHeight - imageY - margin;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(parcoursMeta.eventNaam || selectedWedstrijd?.naam || 'Trailparcours', margin, 34);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const metaParts = [
      parcoursMeta.locatie || '',
      parcoursMeta.datum || config.datum || '',
      parcoursMeta.piste || '',
    ].filter(Boolean);
    if (metaParts.length) doc.text(metaParts.join('  |  '), margin, 52);

    if (parcoursImage) {
      const imageType = parcoursImage.includes('data:image/png') ? 'PNG' : 'JPEG';
      try {
        doc.addImage(parcoursImage, imageType, imageX, imageY, imageW, imageH);
      } catch {
        doc.rect(imageX, imageY, imageW, imageH);
        doc.setFontSize(11);
        doc.text('Afbeelding kon niet in PDF geplaatst worden.', imageX + 12, imageY + 20);
      }
    } else {
      doc.rect(imageX, imageY, imageW, imageH);
      doc.setFontSize(11);
      doc.text('Upload optioneel een parcours afbeelding.', imageX + 12, imageY + 20);
    }

    const listX = imageX + imageW + 22;
    const listW = pageWidth - listX - margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(level?.label || levelCode, listX, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);

    let y = 68;
    lines.forEach((line, idx) => {
      const text = /^\d+[.)\-:\s]/.test(line) ? line : `${idx + 1}. ${line}`;
      const wrapped = doc.splitTextToSize(text, listW);
      doc.text(wrapped, listX, y);
      y += wrapped.length * 16;
      if (y > pageHeight - 36) {
        doc.addPage();
        y = 44;
      }
    });

    const safe = (s) => String(s || '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const fileBase = safe(parcoursMeta.eventNaam || selectedWedstrijd?.naam || 'trailparcours');
    doc.save(`${fileBase}_${levelCode}.pdf`);
  };

  const exportAllTrailParcours = () => {
    TRAIL_LEVELS.forEach((level) => {
      if (parseParcoursLines(parcoursByLevel[level.code]).length > 0) {
        exportTrailParcoursPdf(level.code);
      }
    });
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
    return config.klasse ? obstacleOptions(config.klasse) : [];
  }, [config.klasse, config.onderdeel]);

  const Header = () => (
    <div className="pg-header">
      <div className="pg-title">Working Point - Protocollen</div>
    </div>
  );

  const viewStap1 = (
    <div className="pg-page">
      <Header />
      <div style={{ maxWidth: 900, margin: "24px auto" }} className="pg-content">
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
          <label>Rubriek</label>
          <select aria-label="Rubriek" value={selectedRubriek} onChange={e => setSelectedRubriek(e.target.value)}>
            <option value="">Alle rubrieken</option>
            <option value="senior">Algemeen / Senior</option>
            <option value="jeugd">Jeugd</option>
          </select>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: "#555" }}>{dbMsg}</div>
        {config.onderdeel === 'stijl' && ['junior', 'yr'].includes(config.klasse) && (
          <p role="status">Junioren en Young Riders gebruiken dezelfde vijf algemene stijlbeoordelingen als WE2, WE2+, WE3 en WE4, volgens afspraak met de organisatie.</p>
        )}
        <div style={{ marginTop: 18 }}>
          <button onClick={recoverLocalProtocols} disabled={!config.wedstrijd_id || savingItems}>Lokale stijlparcoursen veiligstellen</button>
          <button onClick={() => setStap(2)} disabled={!config.wedstrijd_id || !config.klasse || !config.onderdeel}>Volgende: Items & Deelnemers</button>
        </div>
      </div>
    </div>
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
    <div className="pg-page">
      <Header />
      <div style={{ maxWidth: 1200, margin: "24px auto" }} className="pg-content">
        <h2>Items & deelnemers</h2>
        <p role="status">{dbMsg}</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 420px",gap:24,alignItems:"start"}}>
          <div>
            {renderItemsEditor()}
            {config.onderdeel === 'stijl' && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, padding: 12, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
                <button disabled={savingItems} onClick={saveItemsConfig} style={{ flex: 1, background: '#0ea5e9', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6 }}>{savingItems ? 'Opslaan…' : 'Opslaan bij wedstrijd'}</button>
                <button onClick={loadItemsConfig} style={{ flex: 1, background: '#06b6d4', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6 }}>Opgeslagen parcours laden</button>
                <button onClick={restoreLocalItems} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6 }}>Lokale configuratie terughalen</button>
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <b>Startlijst</b>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                <input type="file" accept=".csv,text/csv" onChange={(e)=>onCSV(e.target.files?.[0])}/>
                <button onClick={loadDeelnemersFromDB}>Laad deelnemers uit DB</button>
                <button onClick={loadTestDeelnemers}>Laad testdeelnemers</button>
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
                    {config.onderdeel === 'speed' && Array.isArray(o) ? <><td>{o[0]}</td><td style={{ fontSize: 12, color: '#666' }}>{o[1]}</td></> : <><td>{i+1}</td><td>{Array.isArray(o) ? o.filter(v => typeof v === 'string' && v).join(' • ') : o}</td></>}
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
    </div>
  );

  const viewStap3 = (
    <div className="pg-page">
      <Header />
      <div style={{ maxWidth: 1100, margin: "24px auto" }} className="pg-content">
        <h2>Overzicht & export</h2>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", margin:"8px 0 16px" }}>
          <button onClick={() => setStap(2)}>Terug naar hindernissen</button>
          <button onClick={downloadBatch}>Download batch PDF</button>
          <button onClick={printBatch}>Print batch PDF</button>
          <button onClick={() => setShowParcoursMaker(v => !v)}>
            {showParcoursMaker ? 'Verberg Trailparcours maker' : 'Trailparcours maker'}
          </button>
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
        {showParcoursMaker && (
          <div style={{ border: '1px solid #dbe3ef', borderRadius: 12, padding: 16, background: '#f8fbff', marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Trailparcours maker (los per niveau)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 10 }}>
              <input
                placeholder="Naam wedstrijd"
                value={parcoursMeta.eventNaam}
                onChange={(e) => setParcoursMeta(prev => ({ ...prev, eventNaam: e.target.value }))}
              />
              <input
                placeholder="Locatie"
                value={parcoursMeta.locatie}
                onChange={(e) => setParcoursMeta(prev => ({ ...prev, locatie: e.target.value }))}
              />
              <input
                type="date"
                value={parcoursMeta.datum}
                onChange={(e) => setParcoursMeta(prev => ({ ...prev, datum: e.target.value }))}
              />
              <input
                placeholder="Piste/baan"
                value={parcoursMeta.piste}
                onChange={(e) => setParcoursMeta(prev => ({ ...prev, piste: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onParcoursImageFile(e.target.files?.[0])} />
              {parcoursImageName && <span style={{ fontSize: 12, color: '#475569' }}>Afbeelding: {parcoursImageName}</span>}
              {parcoursImage && <button onClick={() => onParcoursImageFile(null)}>Verwijder afbeelding</button>}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <label>Niveau:</label>
              <select value={parcoursLevel} onChange={(e) => setParcoursLevel(e.target.value)}>
                {TRAIL_LEVELS.map((level) => (
                  <option key={level.code} value={level.code}>{level.label}</option>
                ))}
              </select>
              <button onClick={() => fillParcoursFromItems(parcoursLevel)}>Vul met huidige items</button>
              <button onClick={() => exportTrailParcoursPdf(parcoursLevel)}>Exporteer huidig niveau PDF</button>
              <button onClick={exportAllTrailParcours}>Exporteer alle niveaus</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
              {TRAIL_LEVELS.map((level) => (
                <div key={level.code} style={{ background: '#fff', border: '1px solid #dbe3ef', borderRadius: 10, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <b>{level.label}</b>
                    <button onClick={() => setParcoursLevel(level.code)}>Selecteer</button>
                  </div>
                  <textarea
                    rows={12}
                    value={parcoursByLevel[level.code]}
                    onChange={(e) => updateParcoursLines(level.code, e.target.value)}
                    placeholder={`1. Slalom\n2. Brug\n3. Tonnen`}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        {pdfUrl && <iframe src={pdfUrl} title="PDF preview" style={{ width:"100%", height:"680px", border:"1px solid #ccc", borderRadius:8 }} />}
      </div>
    </div>
  );

  if (stap === 1) return viewStap1;
  if (stap === 2) return viewStap2;
  if (stap === 3) return viewStap3;
  return null;
}
