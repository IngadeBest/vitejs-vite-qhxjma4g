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
      if (item?.starttijd_manual) {
        const manualDate = new Date(item.starttijd_manual);
        if (!Number.isNaN(manualDate.getTime())) { times.push(manualDate); if (base) cumulative = Math.round((manualDate.getTime() - base.getTime()) / 60000); else cumulative = 0; continue; }
      }
      const afterIndex = i === 0 ? 0 : i;
      const pauseHere = classPauses.find(p => Number(p.afterIndex) === afterIndex);
      if (i > 0) cumulative += interval;
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
        const manualDate = new Date(item.trailtijd_manual);
        if (!Number.isNaN(manualDate.getTime())) { times.push(manualDate); if (base) cumulative = Math.round((manualDate.getTime() - base.getTime()) / 60000); else cumulative = 0; continue; }
      }
      if (!base) { times.push(null); continue; }
      const afterIndex = i === 0 ? 0 : i;
      const pauseHere = classPauses.find(p => Number(p.afterIndex) === afterIndex);
      if (i > 0) cumulative += interval;
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
      }
    } catch (e) { /* ignore parse errors */ }
  }, [gekozen]);

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
    const manualStart = item?.starttijd_manual;
    const manualTrail = item?.trailtijd_manual;
    if (scheduleConfig.globalSequence) {
      // simplified: fallback to per-class computation when global not fully implemented
      const times = computeStartTimes(classItems, klasseCode);
      const trailTimes = computeTrailTimes(classItems, klasseCode);
      return { start: manualStart ? new Date(manualStart) : times[idx] || null, trail: manualTrail ? new Date(manualTrail) : trailTimes[idx] || null };
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
      for (const [k, items] of grouped.entries()) {
        for (let i=0;i<items.length;i++) {
          const it = items[i]; const { start, trail } = getDisplayedTimesForRow(it, i, items, k);
          combined.push({ Klasse: KLASSEN.find(x=>x.code=== (it.klasse || ''))?.label || it.klasse || '', Startnummer: it.startnummer || '', Ruiter: it.ruiter, Paard: it.paard, Starttijd: formatTime(start), 'Starttijd Trail': formatTime(trail) });
        }
      }
      const ws = XLSX.utils.json_to_sheet(combined);
      XLSX.utils.book_append_sheet(wb, ws, 'Startlijst');
      XLSX.writeFile(wb, `Startlijst_all.xlsx`);
      return;
    }
    const items = grouped.get(klasseCode) || [];
    const ws = XLSX.utils.json_to_sheet(items.map((it, idx) => { const { start, trail } = getDisplayedTimesForRow(it, idx, items, klasseCode); return { Starttijd: formatTime(start), Startnummer: it.startnummer || '', Ruiter: it.ruiter, Paard: it.paard, Klasse: KLASSEN.find(x=>x.code=== (it.klasse || ''))?.label || it.klasse || '', 'Starttijd Trail': formatTime(trail) }; }));
    XLSX.utils.book_append_sheet(wb, ws, klasseCode || 'Onbekend');
    XLSX.writeFile(wb, `Startlijst_${klasseCode || 'onbekend'}.xlsx`);
  }

  async function handleExportPDF(klasseCode) {
    const el = refs.current[klasseCode]; if (!el) return;
    const canvas = await html2canvas(el, { backgroundColor: '#fff', scale: 2 });
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [canvas.width, canvas.height + 60] });
    pdf.addImage(canvas, 'PNG', 10, 30, canvas.width - 20, canvas.height - 40);
    pdf.save(`Startlijst_${klasseCode}.pdf`);
  }

  async function handleExportAfbeelding(klasseCode) { const el = refs.current[klasseCode]; if (!el) return; const canvas = await html2canvas(el, { backgroundColor: '#fff', scale: 2 }); const link = document.createElement('a'); link.download = `Startlijst_${klasseCode}.png`; link.href = canvas.toDataURL('image/png'); link.click(); }

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
                    </div>
                  </div>
                </div>

                {(Array.from(grouped.keys())).map(klasseCode => {
                  const items = grouped.get(klasseCode) || [];
                  return (
                    <div key={klasseCode} style={{ background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #eef6ff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <div style={{ fontWeight: 800, fontSize: 16 }}>{KLASSEN_EDIT.find(k => k.code === klasseCode)?.label || (klasseCode === 'onbekend' ? 'Onbekend' : klasseCode)}</div>
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
                                  <tr key={r.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                                    {visibleCols.starttijd && <td style={{ padding: 8 }}>{beheer ? (<input type="datetime-local" value={r.starttijd_manual || (start ? formatForInput(start) : '')} onChange={(e)=>onCellChange(r.id, 'starttijd_manual', e.target.value)} />) : formatTime(start)}</td>}
                                    {visibleCols.startnummer && <td style={{ padding: 8 }}>{beheer ? (<input type="number" value={r.startnummer ?? ''} onChange={(e)=>onCellChange(r.id, 'startnummer', e.target.value)} style={{ width: 80 }} />) : (r.startnummer || idx + 1)}</td>}
                                    {visibleCols.ruiter && <td style={{ padding: 8 }}>{beheer ? <input value={r.ruiter || ''} onChange={(e)=>onCellChange(r.id, 'ruiter', e.target.value)} style={{ width: '100%' }} /> : (r.ruiter || '—')}</td>}
                                    {visibleCols.paard && <td style={{ padding: 8 }}>{beheer ? <input value={r.paard || ''} onChange={(e)=>onCellChange(r.id, 'paard', e.target.value)} style={{ width: '100%' }} /> : (r.paard || '—')}</td>}
                                    {visibleCols.klasse && <td style={{ padding: 8 }}>{KLASSEN.find(k=>k.code === (r.klasse || ''))?.label || (r.klasse || '—')}</td>}
                                    {visibleCols.starttijdTrail && <td style={{ padding: 8 }}>{beheer ? (<input type="datetime-local" value={r.trailtijd_manual || (trail ? formatForInput(trail) : '')} onChange={(e)=>onCellChange(r.id, 'trailtijd_manual', e.target.value)} />) : formatTime(trail)}</td>}
                                    {beheer && (<td style={{ padding: 8 }}><Button onClick={()=>deleteRow(r.id)} variant="secondary" style={{ color: 'crimson' }}>Verwijderen</Button></td>)}
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
                for (const k of (klasseOrder || [])) {
                  const items = grouped.get(k) || [];
                  for (let i=0;i<items.length;i++) {
                    const it = items[i];
                    const { start, trail } = getDisplayedTimesForRow(it, i, items, k);
                    rowsPreview.push({ klasse: KLASSEN.find(x=>x.code===k)?.label || k, start: formatTime(start), trail: formatTime(trail), ruiter: it.ruiter || '—', startnummer: formatStartnummer(it) || (it.startnummer || i+1) });
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
