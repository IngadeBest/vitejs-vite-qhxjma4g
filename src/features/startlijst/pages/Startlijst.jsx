import React, { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// Klassen (incl. WE2+ = 'we2p')
const KLASSEN = [
  { code: "",     label: "Alle klassen" },
  { code: "we0",  label: "Introductieklasse (WE0)" },
  { code: "we1",  label: "WE1" },
  { code: "we2",  label: "WE2" },
  { code: "we2p", label: "WE2+" },
  { code: "we3",  label: "WE3" },
  { code: "we4",  label: "WE4" },
  { code: "yr",   label: "Young Riders" },
  { code: "junior", label: "Junioren" },
];
const KLASSEN_EDIT = KLASSEN.filter(k => k.code !== "");

// Lightweight, cleaned Startlijst component -- focuses on correct JSX and core scheduling logic
export default function Startlijst() {
  const { items: wedstrijden, loading: loadingWed } = useWedstrijden(false);
  const [sp] = useSearchParams();
  const qId = sp.get("wedstrijdId") || "";

  const [selectedWedstrijdId, setSelectedWedstrijdId] = useState(qId);
  const [klasseFilter, setKlasseFilter] = useState("");
  const beheer = true;

  const [rows, setRows] = useState([]); // source rows
  const [changed, setChanged] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const refs = useRef({});

  const [klasseOrder, setKlasseOrder] = useState([]);
  const [dragState, setDragState] = useState({ type: null, id: null, fromClass: null });
  const [scheduleConfig, setScheduleConfig] = useState({ dressuurStart: '', interval: 7, stijltrailStart: '', trailInfo: '', globalSequence: true });
  const [pauses, setPauses] = useState({});
  const [visibleCols] = useState({ starttijd: true, startnummer: true, ruiter: true, paard: true, klasse: true, starttijdTrail: true });
  // --- helpers and computation functions ---
  function parseTimeForDate(timeStr) {
    if (!timeStr) return null;
    try {
      // accept HH:MM or full ISO
      if (/^\d{2}:\d{2}$/.test(timeStr)) {
        const today = new Date(); const [hh, mm] = timeStr.split(':').map(Number);
        return new Date(today.getFullYear(), today.getMonth(), today.getDate(), hh || 0, mm || 0, 0);
      }
      const d = new Date(timeStr);
      if (!Number.isNaN(d.getTime())) return d;
      return null;
    } catch (e) { return null; }
  }
  // parse a datetime-local string (YYYY-MM-DDTHH:MM) as local time to avoid timezone shifts
  function parseDateTimeLocal(str) {
    if (!str) return null;
    try {
      const m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (m) {
        const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]); const hh = Number(m[4]); const mm = Number(m[5]);
        return new Date(y, mo - 1, d, hh, mm, 0);
      }
      const d = new Date(str);
      if (!Number.isNaN(d.getTime())) return d;
      return null;
    } catch (e) { return null; }
  }
  function formatTime(date) { if (!date) return ''; try { const d = new Date(date); const pad = (n) => String(n).padStart(2,'0'); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; } catch (e) { return '' } }
  function formatForInput(date) { if (!date) return ''; try { const d = new Date(date); if (Number.isNaN(d.getTime())) return ''; const pad = (n) => String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; } catch (e) { return '' } }

  function computeStartTimes(items, klasseCode) {
    const base = parseTimeForDate(scheduleConfig.dressuurStart);
    const interval = Number(scheduleConfig.interval) || 7;
    if (!items || !items.length) return [];
    const times = []; let cumulative = 0;
    const classPauses = Array.isArray(pauses?.[klasseCode]) ? pauses[klasseCode] : (Array.isArray(pauses?.['__default__']) ? pauses['__default__'] : []);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // if manual time set, use it and reset cumulative to manual offset
      if (item?.starttijd_manual) {
        const manualDate = parseDateTimeLocal(item.starttijd_manual) || parseTimeForDate(item.starttijd_manual);
        if (manualDate && !Number.isNaN(manualDate.getTime())) {
          times.push(manualDate);
          if (base) cumulative = Math.round((manualDate.getTime() - base.getTime()) / 60000);
          else cumulative = 0;
          continue;
        }
      }
      // between starts: add interval (except before first)
      if (i > 0) cumulative += interval;
      // if a pause is defined AFTER previous count (i) then apply it before computing current start
      const pauseHere = classPauses.find(p => Number(p.afterIndex) === i) || null;
      if (pauseHere) cumulative += Number(pauseHere.minutes || 0);
      const start = base ? new Date(base.getTime() + cumulative * 60000) : null;
      times.push(start);
    }
    return times;
  }

  function computeTrailTimes(items, klasseCode) {
    const base = parseTimeForDate(scheduleConfig.stijltrailStart);
    const interval = Number(scheduleConfig.interval) || 7;
    if (!items || !items.length) return [];
    const times = []; let cumulative = 0;
    const classPauses = Array.isArray(pauses?.[klasseCode]) ? pauses[klasseCode] : (Array.isArray(pauses?.['__default__']) ? pauses['__default__'] : []);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item?.trailtijd_manual) {
        const manualDate = parseDateTimeLocal(item.trailtijd_manual) || parseTimeForDate(item.trailtijd_manual);
        if (manualDate && !Number.isNaN(manualDate.getTime())) { times.push(manualDate); if (base) cumulative = Math.round((manualDate.getTime() - base.getTime()) / 60000); else cumulative = 0; continue; }
      }
      if (!base) { times.push(null); continue; }
      if (i > 0) cumulative += interval;
      const pauseHere = classPauses.find(p => Number(p.afterIndex) === i) || null;
      if (pauseHere) cumulative += Number(pauseHere.minutes || 0);
      const start = base ? new Date(base.getTime() + cumulative * 60000) : null;
      times.push(start);
    }
    return times;
  }
  // group rows by klasse
  const grouped = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      const key = r.klasse || 'onbekend';
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(r);
    }
    return m;
  }, [rows]);

  // global continuous times across classes when enabled
  const globalTimes = useMemo(() => {
    if (!scheduleConfig.globalSequence) return null;
    const base = parseTimeForDate(scheduleConfig.dressuurStart);
    const interval = Number(scheduleConfig.interval) || 7;
    const defaultPauses = Array.isArray(pauses?.['__default__']) ? pauses['__default__'] : [];
    const times = [];
    let cumulative = 0;
    // counts per class to identify afterIndex
    const perClassCounts = {};
    for (const k of (klasseOrder || [])) perClassCounts[k] = 0;
    for (const k of (klasseOrder || [])) {
      const items = grouped.get(k) || [];
      const classPauses = Array.isArray(pauses?.[k]) ? pauses[k] : [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        // manual start takes precedence and resets cumulative relative to base
        if (item?.starttijd_manual) {
          const manualDate = parseDateTimeLocal(item.starttijd_manual) || parseTimeForDate(item.starttijd_manual);
          if (manualDate && !Number.isNaN(manualDate.getTime())) {
            times.push(manualDate);
            if (base) cumulative = Math.round((manualDate.getTime() - base.getTime()) / 60000);
            else cumulative = 0;
            perClassCounts[k] = (perClassCounts[k] || 0) + 1;
            continue;
          }
        }
        // add interval between flattened items (except first overall)
        if (times.length > 0) cumulative += interval;
        // apply pause defined for this class after previous count
        const pauseHere = (classPauses.find(p => Number(p.afterIndex) === (perClassCounts[k] || 0)) || defaultPauses.find(p => Number(p.afterIndex) === (perClassCounts[k] || 0)) || null);
        if (pauseHere) cumulative += Number(pauseHere.minutes || 0);
        const start = base ? new Date(base.getTime() + cumulative * 60000) : null;
        times.push(start);
        perClassCounts[k] = (perClassCounts[k] || 0) + 1;
      }
    }
    return times;
  }, [scheduleConfig.globalSequence, scheduleConfig.dressuurStart, scheduleConfig.interval, klasseOrder, grouped, pauses]);

  // initialize klasseOrder after rows are loaded (avoid setState during render)
  useEffect(() => {
    const keys = Array.from(grouped.keys()).sort();
    if (keys.length && !klasseOrder.length) setKlasseOrder(keys);
  }, [grouped, klasseOrder.length]);

  // chosen wedstrijd (gekozen) and load its startlijst_config into scheduleConfig / pauses
  const gekozen = useMemo(() => wedstrijden.find((w) => w.id === selectedWedstrijdId) || null, [wedstrijden, selectedWedstrijdId]);
  useEffect(() => {
    if (!gekozen) return;
    try {
      const cfg = (gekozen.startlijst_config && typeof gekozen.startlijst_config === 'object') ? gekozen.startlijst_config : (gekozen.startlijst_config ? JSON.parse(gekozen.startlijst_config) : null);
      if (cfg) {
        setScheduleConfig(s => ({ ...s, dressuurStart: cfg.dressuurStart || s.dressuurStart, interval: cfg.interval || s.interval, stijltrailStart: cfg.stijltrailStart || s.stijltrailStart, trailInfo: cfg.trailInfo || s.trailInfo, globalSequence: typeof cfg.globalSequence === 'boolean' ? cfg.globalSequence : s.globalSequence }));
        if (cfg.pauses && typeof cfg.pauses === 'object') setPauses(cfg.pauses);
        // load persisted klasseOrder if present
        if (cfg.klasseOrder && Array.isArray(cfg.klasseOrder)) setKlasseOrder(cfg.klasseOrder);
      }
    } catch (e) { /* ignore parse errors */ }
  }, [gekozen]);

  // dev sanity logs: lightweight checks to help diagnose timezone / ordering issues
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    try {
      console.groupCollapsed && console.groupCollapsed('Startlijst sanity');
      console.log('gekozen:', gekozen ? { id: gekozen.id, naam: gekozen.naam, datum: gekozen.datum } : null);
      console.log('klasseOrder:', klasseOrder);
      const sample = rows.slice(0,10).map(r => ({ id: r.id, startnummer: r.startnummer, klasse: r.klasse, starttijd_manual: r.starttijd_manual, parsed_manual: r.starttijd_manual ? (parseDateTimeLocal(r.starttijd_manual) || parseTimeForDate(r.starttijd_manual)) : null }));
      console.log('rows sample (parsed):', sample);
      if (scheduleConfig.globalSequence && globalTimes) {
        const gaps = [];
        for (let i = 1; i < Math.min(globalTimes.length, 50); i++) {
          const a = globalTimes[i-1]; const b = globalTimes[i]; if (a && b) gaps.push((b.getTime() - a.getTime())/60000);
        }
        console.log('globalTimes sample gaps (min):', gaps.slice(0,10));
      }
      console.groupEnd && console.groupEnd();
    } catch (e) { console.warn('sanity log failed', e); }
  }, [gekozen, klasseOrder, rows, scheduleConfig.globalSequence, globalTimes]);

  // load rows for selected wedstrijd
  useEffect(() => {
    async function fetchRows() {
      if (!selectedWedstrijdId) return setRows([]);
      setBusy(true); setErr('');
      try {
        const { data, error } = await supabase.from('inschrijvingen').select('*').eq('wedstrijd_id', selectedWedstrijdId).order('startnummer', { ascending: true });
        if (error) throw error;
        setRows(data || []);
      } catch (e) {
        setErr(String(e.message || e));
      } finally { setBusy(false); }
    }
    fetchRows();
  }, [selectedWedstrijdId]);

  function getDisplayedTimesForRow(item, idx, classItems, klasseCode) {
  const manualStart = item?.starttijd_manual ? (parseDateTimeLocal(item.starttijd_manual) || parseTimeForDate(item.starttijd_manual)) : null;
  const manualTrail = item?.trailtijd_manual ? (parseDateTimeLocal(item.trailtijd_manual) || parseTimeForDate(item.trailtijd_manual)) : null;
    if (scheduleConfig.globalSequence && globalTimes) {
      const prevCount = (klasseOrder.slice(0, klasseOrder.indexOf(klasseCode)).reduce((acc, k) => acc + ((grouped.get(k) || []).length), 0));
      const globalIndex = prevCount + idx;
      const gStart = globalTimes[globalIndex];
      const start = manualStart ? new Date(manualStart) : (gStart || null);
      // trail: manual overrides win; otherwise compute from delta between dressuur and stijltrail if provided
      if (manualTrail) return { start, trail: new Date(manualTrail), computedStart: null };
      if (scheduleConfig.stijltrailStart && gStart) {
        const dressStart = parseTimeForDate(scheduleConfig.dressuurStart);
        const stijlBase = parseTimeForDate(scheduleConfig.stijltrailStart);
        const delta = (dressStart && stijlBase) ? Math.round((stijlBase.getTime() - dressStart.getTime()) / 60000) : 0;
        const trailTime = gStart ? new Date(gStart.getTime() + delta * 60000) : null;
        return { start, trail: trailTime, computedStart: null };
      }
      return { start, trail: gStart ? new Date(gStart.getTime()) : null, computedStart: null };
    }
    const times = computeStartTimes(classItems, klasseCode);
    const trailTimes = computeTrailTimes(classItems, klasseCode);
    return { start: manualStart ? new Date(manualStart) : times[idx] || null, trail: manualTrail ? new Date(manualTrail) : trailTimes[idx] || null };
  }

  // simple cell edit handler
  function onCellChange(id, field, value) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    setChanged(prev => { const copy = new Set(prev); copy.add(id); return copy; });
  }

  // move a class up/down in klasseOrder
  function moveClass(klasseCode, dir) {
    setKlasseOrder(prev => {
      const copy = [...(prev || [])];
      const idx = copy.indexOf(klasseCode);
      if (idx === -1) return copy;
      const ni = dir === 'up' ? idx - 1 : idx + 1;
      if (ni < 0 || ni >= copy.length) return copy;
      [copy[idx], copy[ni]] = [copy[ni], copy[idx]];
      return copy;
    });
  }

  // move a participant up/down within its klasse
  function moveParticipant(id, klasseCode, dir) {
    setRows(prev => {
      // group prev rows by klasse
      const m = new Map();
      for (const r of prev) {
        const key = r.klasse || 'onbekend';
        if (!m.has(key)) m.set(key, []);
        m.get(key).push(r);
      }
      const arr = m.get(klasseCode) || [];
      const idx = arr.findIndex(x => x.id === id);
      if (idx === -1) return prev;
      const ni = dir === 'up' ? idx - 1 : idx + 1;
      if (ni < 0 || ni >= arr.length) return prev;
      const copyArr = [...arr];
      [copyArr[idx], copyArr[ni]] = [copyArr[ni], copyArr[idx]];
      m.set(klasseCode, copyArr);
      // reconstruct rows preserving original class order from prev
      const classOrderFromPrev = Array.from(new Set(prev.map(r => r.klasse || 'onbekend')));
      const newRows = [];
      for (const k of classOrderFromPrev) {
        const list = m.get(k) || [];
        for (const r of list) newRows.push(r);
      }
      // append any classes not in original order
      for (const [k, list] of m) {
        if (!classOrderFromPrev.includes(k)) for (const r of list) newRows.push(r);
      }
      setChanged(prevSet => { const c = new Set(prevSet); c.add(id); return c; });
      return newRows;
    });
  }

  function deleteRow(id) { setRows(prev => prev.filter(r => r.id !== id)); setChanged(prev => { const copy = new Set(prev); copy.delete(id); return copy; }); }
  function addRow() { const newRow = { id: `new-${Date.now()}`, wedstrijd_id: selectedWedstrijdId, startnummer: null, ruiter: '', paard: '', klasse: '', starttijd_manual: null, trailtijd_manual: null }; setRows(prev => [ ...prev, newRow ]); setChanged(prev => { const copy = new Set(prev); copy.add(newRow.id); return copy; }); }
  function renumber() {
    setRows(prev => prev.map((r,i)=> ({ ...r, startnummer: i+1 })));
    setChanged(prev => { const copy = new Set(prev); (rows || []).forEach(r => copy.add(r.id)); return copy; });
  }

  async function saveChanges() {
    if (!selectedWedstrijdId) return setErr('Geen wedstrijd geselecteerd');
    setBusy(true); setErr(''); setMsg('');
    try {
      const toSave = rows.filter(r => changed.has(r.id));
      // naive upsert: send all changed rows to supabase
      for (const row of toSave) {
        const payload = { ...row, wedstrijd_id: selectedWedstrijdId };
        // if id starts with new- insert, otherwise update
        if (String(row.id).startsWith('new-')) {
          await supabase.from('inschrijvingen').insert(payload);
        } else {
          await supabase.from('inschrijvingen').update(payload).eq('id', row.id);
        }
      }
      // persist startlijst configuration (including klasseOrder and pauses) on the wedstrijd
      try {
        const cfg = { ...scheduleConfig, pauses: pauses || {}, klasseOrder: klasseOrder || [] };
        await supabase.from('wedstrijden').update({ startlijst_config: cfg }).eq('id', selectedWedstrijdId);
      } catch (e) { /* non-fatal */ }
      setMsg('Wijzigingen opgeslagen');
      setChanged(new Set());
    } catch (e) { setErr(String(e?.message || e)); }
    finally { setBusy(false); }
  }

  function formatStartnummer(r) { return (r && r.startnummer != null) ? String(r.startnummer) : ''; }

  // Export helpers (kept minimal)
  function handleExportExcel(klasseCode) {
    const wb = XLSX.utils.book_new();
    if (klasseCode === '__all__') {
      const combined = [];
      const defaultPauses = Array.isArray(pauses?.['__default__']) ? pauses['__default__'] : [];
      for (const k of (klasseOrder || Array.from(grouped.keys()))) {
        const items = grouped.get(k) || [];
        const classPauses = Array.isArray(pauses?.[k]) ? pauses[k] : [];
        for (let i=0;i<items.length;i++) {
          const it = items[i]; const { start, trail } = getDisplayedTimesForRow(it, i, items, k);
          combined.push({
            Klasse: KLASSEN.find(x=>x.code=== (it.klasse || ''))?.label || it.klasse || '', Startnummer: it.startnummer || '', Ruiter: it.ruiter, Paard: it.paard, Starttijd: formatTime(start), 'Starttijd Trail': formatTime(trail)
          });
          // if a pause is defined after this start, insert a pause marker row
          const pauseAfter = (classPauses.find(p => Number(p.afterIndex) === (i+1)) || defaultPauses.find(p => Number(p.afterIndex) === (i+1)) || null);
          if (pauseAfter) combined.push({ Klasse: '', Startnummer: '', Ruiter: '', Paard: '', Starttijd: `Pauze — ${pauseAfter.minutes} min`, 'Starttijd Trail': '' });
        }
      }
      const ws = XLSX.utils.json_to_sheet(combined);
  XLSX.utils.book_append_sheet(wb, ws, 'Startlijst');
  XLSX.writeFile(wb, `Startlijst ${gekozen?.naam || 'onbekend'}.xlsx`);
      return;
    }
    const items = grouped.get(klasseCode) || [];
    const ws = XLSX.utils.json_to_sheet(items.map((it, idx) => { const { start, trail } = getDisplayedTimesForRow(it, idx, items, klasseCode); return { Starttijd: formatTime(start), Startnummer: it.startnummer || '', Ruiter: it.ruiter, Paard: it.paard, Klasse: KLASSEN.find(x=>x.code=== (it.klasse || ''))?.label || it.klasse || '', 'Starttijd Trail': formatTime(trail) }; }));
    XLSX.utils.book_append_sheet(wb, ws, klasseCode || 'Onbekend');
    XLSX.writeFile(wb, `Startlijst ${gekozen?.naam || klasseCode || 'onbekend'}.xlsx`);
  }

  async function handleExportPDF(klasseCode) {
    const el = refs.current[klasseCode]; if (!el) return;
    const canvas = await html2canvas(el, { backgroundColor: '#fff', scale: 2 });
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [canvas.width, canvas.height + 60] });
    pdf.addImage(canvas, 'PNG', 10, 30, canvas.width - 20, canvas.height - 40);
    pdf.save(`Startlijst ${gekozen?.naam || klasseCode}.pdf`);
  }

  async function handleExportAfbeelding(klasseCode) {
    const el = refs.current[klasseCode];
    if (!el) return;
    const canvas = await html2canvas(el, { backgroundColor: '#fff', scale: 2 });
    const link = document.createElement('a');
    link.download = `Startlijst ${gekozen?.naam || klasseCode}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  // visible rows (filter)
  const visible = rows.filter(r => !klasseFilter || (r.klasse || '') === klasseFilter);

  return (
    <div style={{ background: '#f5f7fb', minHeight: '100vh', padding: 28 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18 }}>
        <main style={{ background: '#fff', borderRadius: 16, boxShadow: '0 6px 24px #20457422', padding: '30px 28px', fontFamily: 'system-ui, sans-serif' }}>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: '#204574', marginBottom: 14 }}>Startlijst per klasse</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto auto', gap: 8, alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Wedstrijd</label>
              <select value={selectedWedstrijdId} onChange={(e)=>setSelectedWedstrijdId(e.target.value)} disabled={loadingWed} style={{ width: '100%' }}>
                <option value="">{loadingWed ? 'Laden...' : '— kies wedstrijd —'}</option>
                {wedstrijden.map(w => <option key={w.id} value={w.id}>{w.naam} {w.datum ? `(${w.datum})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Klasse (filter)</label>
              <select value={klasseFilter} onChange={(e)=>setKlasseFilter(e.target.value)} style={{ width: '100%' }}>
                {KLASSEN.map(k => <option key={k.code || 'all'} value={k.code}>{k.label}</option>)}
              </select>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', userSelect: 'none' }}><input type="checkbox" checked={beheer} readOnly /> Beheer-modus</label>
            <Button onClick={()=>{ /* fetch already auto-runs on change */ }} disabled={busy || !selectedWedstrijdId}>{busy ? 'Vernieuwen...' : 'Vernieuw'}</Button>
            <Button onClick={()=>handleExportExcel('__all__')} disabled={!selectedWedstrijdId}>Export hele startlijst (Excel)</Button>
            {beheer && <Button onClick={saveChanges} disabled={busy || !selectedWedstrijdId || !changed.size}>{busy ? 'Opslaan...' : `Opslaan (${changed.size||0})`}</Button>}
          </div>

          {err && <Alert type="error">{String(err)}</Alert>}
          {msg && <Alert type={String(msg).toLowerCase().includes('fout') ? 'error' : 'success'}>{msg}</Alert>}

          {!selectedWedstrijdId && (<div style={{ marginTop: 16, color: '#555' }}>Kies hierboven een wedstrijd om de startlijst te tonen.</div>)}

          {selectedWedstrijdId && (
            <>
              <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#666' }}><b>Aantal inschrijvingen:</b> {visible.length}</div>
                {beheer && (<><Button onClick={addRow} disabled={busy} variant="secondary">Nieuwe inschrijving</Button><Button onClick={renumber} disabled={busy || visible.length === 0} variant="secondary">Startnummers hernummeren</Button></>) }
              </div>

              <div style={{ marginTop: 8, display: 'grid', gap: 18 }}>
                <div style={{ background: '#f8fbff', padding: 12, borderRadius: 8, border: '1px solid #eef6ff' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Dressuur start (HH:MM)</label>
                      <input value={scheduleConfig.dressuurStart} onChange={e=>setScheduleConfig(s=>({...s, dressuurStart: e.target.value}))} placeholder="09:00" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Interval (min)</label>
                      <input type="number" value={scheduleConfig.interval} onChange={e=>setScheduleConfig(s=>({...s, interval: Number(e.target.value) || 7}))} style={{ width: 80 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Stijltrail start (HH:MM)</label>
                      <input value={scheduleConfig.stijltrailStart} onChange={e=>setScheduleConfig(s=>({...s, stijltrailStart: e.target.value}))} placeholder="12:30" style={{ width: 110 }} />
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                      <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Pauzes</label>
                      <small style={{ color: '#666' }}>Voeg pauzes toe per klasse (na welke start; minuten)</small>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center', userSelect: 'none' }}>
                        <input type="checkbox" checked={!!scheduleConfig.globalSequence} onChange={(e)=>setScheduleConfig(s=>({...s, globalSequence: e.target.checked}))} />
                        Doortellen over klassen (globale volgorde)
                      </label>
                      <div style={{ marginLeft: 12, fontSize: 12, color: '#666', maxWidth: 280 }}>
                        Wanneer ingeschakeld worden de starttijden niet opnieuw begonnen per klasse maar doorgeteld over alle klassen volgens de ingestelde klasse-volgorde. Handig wanneer je één doorlopende ringplanning wilt.
                      </div>
                    </div>
                  </div>
                </div>

                {( (klasseOrder && klasseOrder.length) ? klasseOrder : Array.from(grouped.keys()) ).map(klasseCode => {
                  const items = grouped.get(klasseCode) || [];
                  return (
                    <div key={klasseCode}
                      draggable
                      onDragStart={(e)=>{ setDragState({ type: 'class', id: klasseCode }); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragOver={(e)=>{ e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                      onDrop={(e)=>{ e.preventDefault(); const ds = dragState; if (ds?.type === 'class' && ds.id) { // swap positions
                          const from = ds.id; const to = klasseCode; setKlasseOrder(prev=>{ const arr = [...(prev && prev.length ? prev : Array.from(grouped.keys()))]; const fi = arr.indexOf(from); const ti = arr.indexOf(to); if (fi === -1 || ti === -1) return arr; arr.splice(fi,1); arr.splice(ti,0,from); return arr; }); setDragState({ type:null,id:null,fromClass:null }); }
                        if (ds?.type === 'participant' && ds.id) { // move participant into this class at end
                          const pid = ds.id; setRows(prev=>{ const p = prev.find(r=>r.id===pid); if (!p) return prev; const updated = prev.map(r=> r.id===pid ? { ...r, klasse: klasseCode } : r); setChanged(cs=>{ const c = new Set(cs); c.add(pid); return c; }); return updated; }); setDragState({ type:null,id:null,fromClass:null }); }
                      }}
                      style={{ background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #eef6ff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <div style={{ fontWeight: 800, fontSize: 16 }}>{KLASSEN_EDIT.find(k => k.code === klasseCode)?.label || (klasseCode === 'onbekend' ? 'Onbekend' : klasseCode)}</div>
                        <div style={{ marginLeft: 8, display: 'flex', gap: 6 }}>
                          <Button variant="secondary" onClick={() => moveClass(klasseCode, 'up')}>↑</Button>
                          <Button variant="secondary" onClick={() => moveClass(klasseCode, 'down')}>↓</Button>
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Button onClick={() => handleExportExcel(klasseCode)} variant="secondary">Export Excel</Button>
                          <Button onClick={() => handleExportPDF(klasseCode)} variant="secondary">Export PDF</Button>
                          <Button onClick={() => handleExportAfbeelding(klasseCode)} variant="secondary">Export afbeelding</Button>
                        </div>
                      </div>

                      <div ref={el => refs.current[klasseCode] = el}>
                        <table width="100%" cellPadding={6} style={{ borderCollapse: 'collapse', fontSize: 14, background: '#fafdff', borderRadius: 8 }}>
                          <thead>
                            <tr style={{ background: '#dfeffd', color: '#174174' }}>
                              {visibleCols.starttijd && <th style={{ borderBottom: '1px solid #e0edf8', width: 110, padding: 8 }}>Starttijd</th>}
                              {visibleCols.startnummer && <th style={{ borderBottom: '1px solid #e0edf8', width: 60, padding: 8 }}>#</th>}
                              {visibleCols.ruiter && <th style={{ borderBottom: '1px solid #e0edf8', padding: 8 }}>Ruiter</th>}
                              {visibleCols.paard && <th style={{ borderBottom: '1px solid #e0edf8', padding: 8 }}>Paard</th>}
                              {visibleCols.klasse && <th style={{ borderBottom: '1px solid #e0edf8', padding: 8 }}>Klasse</th>}
                              {visibleCols.starttijdTrail && <th style={{ borderBottom: '1px solid #e0edf8', padding: 8 }}>Starttijd Trail</th>}
                              {beheer && <th style={{ borderBottom: '1px solid #e0edf8', width: 120, padding: 8 }}>Acties</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const classPauses = Array.isArray(pauses?.[klasseCode]) ? pauses[klasseCode] : [];
                              const out = [];
                              for (let idx = 0; idx < items.length; idx++) {
                                const r = items[idx];
                                const { start, trail } = getDisplayedTimesForRow(r, idx, items, klasseCode);
                                out.push(
                                  <tr key={r.id}
                                    draggable
                                    onDragStart={(e)=>{ setDragState({ type: 'participant', id: r.id, fromClass: klasseCode }); e.dataTransfer.effectAllowed = 'move'; }}
                                    onDragOver={(e)=>{ e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                    onDrop={(e)=>{ e.preventDefault(); const ds = dragState; if (ds?.type === 'participant' && ds.id && ds.id !== r.id) {
                                        // move participant before/after this row depending on drop
                                        setRows(prev=>{
                                          const all = [...prev];
                                          const movingIdx = all.findIndex(x=>x.id===ds.id);
                                          if (movingIdx === -1) return prev;
                                          const moving = all.splice(movingIdx,1)[0];
                                          // set its klasse to this klasseCode
                                          moving.klasse = klasseCode;
                                          // find index of this row in new all
                                          const targetIdx = all.findIndex(x=>x.id===r.id);
                                          all.splice(targetIdx,0,moving);
                                          setChanged(cs=>{ const c = new Set(cs); c.add(ds.id); return c; });
                                          return all;
                                        });
                                        setDragState({ type:null,id:null,fromClass:null });
                                      } }}
                                  style={{ borderTop: '1px solid #f0f0f0' }}>
                                    {visibleCols.starttijd && <td style={{ padding: 8 }}>{beheer ? (<input type="datetime-local" value={r.starttijd_manual || (start ? formatForInput(start) : '')} onChange={(e)=>onCellChange(r.id, 'starttijd_manual', e.target.value)} />) : formatTime(start)}</td>}
                                    {visibleCols.startnummer && <td style={{ padding: 8 }}>{beheer ? (<input type="number" value={r.startnummer ?? ''} onChange={(e)=>onCellChange(r.id, 'startnummer', e.target.value)} style={{ width: 80 }} />) : (r.startnummer || idx + 1)}</td>}
                                    {visibleCols.ruiter && <td style={{ padding: 8 }}>{beheer ? <input value={r.ruiter || ''} onChange={(e)=>onCellChange(r.id, 'ruiter', e.target.value)} style={{ width: '100%' }} /> : (r.ruiter || '—')}</td>}
                                    {visibleCols.paard && <td style={{ padding: 8 }}>{beheer ? <input value={r.paard || ''} onChange={(e)=>onCellChange(r.id, 'paard', e.target.value)} style={{ width: '100%' }} /> : (r.paard || '—')}</td>}
                                    {visibleCols.klasse && <td style={{ padding: 8 }}>{KLASSEN.find(k=>k.code === (r.klasse || ''))?.label || (r.klasse || '—')}</td>}
                                    {visibleCols.starttijdTrail && <td style={{ padding: 8 }}>{beheer ? (<input type="datetime-local" value={r.trailtijd_manual || (trail ? formatForInput(trail) : '')} onChange={(e)=>onCellChange(r.id, 'trailtijd_manual', e.target.value)} />) : formatTime(trail)}</td>}
                                    {beheer && (<td style={{ padding: 8, display: 'flex', gap: 6 }}>
                                      <Button variant="secondary" onClick={()=>moveParticipant(r.id, klasseCode, 'up')}>▲</Button>
                                      <Button variant="secondary" onClick={()=>moveParticipant(r.id, klasseCode, 'down')}>▼</Button>
                                      <Button onClick={()=>deleteRow(r.id)} variant="secondary" style={{ color: 'crimson' }}>Verwijderen</Button>
                                    </td>)}
                                  </tr>
                                );
                                const pauseAfter = classPauses.find(p => Number(p.afterIndex) === (idx + 1));
                                if (pauseAfter) out.push(<tr key={`pause-${klasseCode}-${idx}`} style={{ background: '#fff8ec', color: '#6b4a00' }}><td colSpan={visibleCols.startnummer ? 6 : 5} style={{ padding: 8 }}>Pauze — {pauseAfter.minutes} min</td></tr>);
                              }
                              if (!out.length) return (<tr><td colSpan={beheer ? 6 : 5} style={{ color: '#777', padding: '18px 8px' }}>Nog geen inschrijvingen voor deze klasse.</td></tr>);
                              return out;
                            })()}
                          </tbody>
                        </table>

                        <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: '#fcfeff', border: '1px dashed #e6f2ff' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Pauzes voor {KLASSEN_EDIT.find(k=>k.code===klasseCode)?.label || klasseCode}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {(pauses[klasseCode] || []).map((p, i) => (
                              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <div style={{ fontSize: 13 }}>Na {p.afterIndex} starts — {p.minutes} min</div>
                                <Button variant="secondary" onClick={()=>{ setPauses(prev => { const copy = { ...(prev || {}) }; copy[klasseCode] = (copy[klasseCode] || []).filter((_,idx)=>idx !== i); return copy; }); }}>Verwijder</Button>
                              </div>
                            ))}
                          </div>

                          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input type="number" placeholder="Na (count)" id={`pause-after-${klasseCode}`} style={{ width: 100 }} />
                            <input type="number" placeholder="Minuten" id={`pause-min-${klasseCode}`} style={{ width: 100 }} />
                            <Button onClick={()=>{ const elA = document.getElementById(`pause-after-${klasseCode}`); const elM = document.getElementById(`pause-min-${klasseCode}`); const after = Number(elA?.value || 0); const minutes = Number(elM?.value || 0); if (!Number.isFinite(after) || !Number.isFinite(minutes)) return; setPauses(prev => { const copy = { ...(prev || {}) }; copy[klasseCode] = copy[klasseCode] || []; copy[klasseCode].push({ afterIndex: after, minutes }); return copy; }); if (elA) elA.value = ''; if (elM) elM.value = ''; }}>Voeg pauze toe</Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </main>

        <aside style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #eef6ff' }}>
          <h3 style={{ marginTop: 0 }}>Preview & uitleg</h3>
          <p style={{ color: '#444', marginTop: 6 }}>Trail offset geeft aan hoeveel minuten na de dressuur-starttijd de trail begint voor die start. Pauzes voegen extra minuten toe op de planning na een gegeven positie.</p>
          <div style={{ marginTop: 8, fontWeight: 700 }}>Huidige instellingen</div>
          <div style={{ fontSize: 13, color: '#333', marginTop: 6 }}>Dressuur start: <b>{scheduleConfig.dressuurStart || '—'}</b><br/>Interval: <b>{scheduleConfig.interval} min</b><br/>Stijltrail start: <b>{scheduleConfig.stijltrailStart || '—'}</b></div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700 }}>Voorbeeld export (alle klassen)</div>
            <div style={{ marginTop: 8 }}>
              {(() => {
                const rowsPreview = [];
                const defaultPauses = Array.isArray(pauses?.['__default__']) ? pauses['__default__'] : [];
                for (const k of (klasseOrder || Array.from(grouped.keys()))) {
                  const items = grouped.get(k) || [];
                  const classPauses = Array.isArray(pauses?.[k]) ? pauses[k] : [];
                  for (let i=0;i<items.length;i++) {
                    const it = items[i];
                    const { start, trail } = getDisplayedTimesForRow(it, i, items, k);
                    rowsPreview.push({ klasse: KLASSEN.find(x=>x.code===k)?.label || k, start: formatTime(start), trail: formatTime(trail), ruiter: it.ruiter || '—', startnummer: formatStartnummer(it) || (it.startnummer || i+1) });
                    const pauseAfter = (classPauses.find(p => Number(p.afterIndex) === (i+1)) || defaultPauses.find(p => Number(p.afterIndex) === (i+1)) || null);
                    if (pauseAfter) rowsPreview.push({ klasse: '', start: `Pauze — ${pauseAfter.minutes} min`, trail: '', ruiter: '', startnummer: '' });
                  }
                }
                if (!rowsPreview.length) return <div style={{ color: '#777' }}>Geen inschrijvingen</div>;
                return (
                  <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                    <thead><tr><th style={{ textAlign: 'left' }}>Klasse</th><th style={{ textAlign: 'left' }}>#</th><th style={{ textAlign: 'left' }}>Ruiter</th><th style={{ textAlign: 'left' }}>Starttijd</th><th style={{ textAlign: 'left' }}>Trail</th></tr></thead>
                    <tbody>
                      {rowsPreview.slice(0,50).map((r,i)=>(<tr key={i}><td>{r.klasse}</td><td>{r.startnummer}</td><td>{r.ruiter}</td><td>{r.start}</td><td>{r.trail}</td></tr>))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
