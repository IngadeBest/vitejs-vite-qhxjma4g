import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
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

// No categorie concept in this app version — kept for backward compatibility in DB

export default function Startlijst() {
  const { items: wedstrijden, loading: loadingWed } = useWedstrijden(false);
  const [sp] = useSearchParams();
  const qId = sp.get("wedstrijdId") || "";

  const [selectedWedstrijdId, setSelectedWedstrijdId] = useState(qId);
  const [klasseFilter, setKlasseFilter] = useState("");
  const [beheer, setBeheer] = useState(false);

  const [rows, setRows] = useState([]);         // ruwe DB-rows
  const [editRows, setEditRows] = useState([]); // bewerkbare kopie
  const [changed, setChanged] = useState(new Set()); // id's met wijzigingen

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const refs = useRef({}); // per-klasse refs for export and PDF
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [klasseOrder, setKlasseOrder] = useState([]); // visual order of klasse cards
  // Scheduling state
  const [scheduleConfig, setScheduleConfig] = useState({
    dressuurStart: '', // 'HH:MM'
    interval: 7, // minutes
    trailOffset: 0, // minutes after starttijd for trail
    trailInfo: '',
  });
  const [pauses, setPauses] = useState({}); // { [klasseCode]: [{ afterIndex: number, minutes: number }] }
  const [visibleCols, setVisibleCols] = useState({ starttijd: true, startnummer: true, ruiter: true, paard: true, klasse: true, starttijdTrail: true });

  // Drag & drop handlers: allow reordering within the same klasse
  function onDragStart(e, id, klasse) {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id, klasse }));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(id);
  }

  function onDragOver(e) { e.preventDefault(); }

  function onDragEnter(e, id) {
    setDragOverId(id);
  }

  function onDragLeave(e) {
    setDragOverId(null);
  }

  function onDrop(e, targetIndex, targetKlasse) {
    e.preventDefault();
    try {
      const payload = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
      const { id, klasse } = payload;
      if (klasse !== targetKlasse) return; // only reorder within same klasse

      // build class-specific list
      const classItems = editRows.filter(r => (r.klasse || '') === targetKlasse).sort((a,b)=>{
        const aNum = a.startnummer == null ? Infinity : Number(a.startnummer);
        const bNum = b.startnummer == null ? Infinity : Number(b.startnummer);
        return aNum - bNum || new Date(a.created_at) - new Date(b.created_at);
      });

      const moving = classItems.find(i => i.id === id);
      if (!moving) return;
      const without = classItems.filter(i => i.id !== id);
      const nextClass = [...without.slice(0, targetIndex), moving, ...without.slice(targetIndex)];

      // map back to global editRows, update startnummer for items in this class
      setEditRows(all => all.map(r => {
        if ((r.klasse || '') !== targetKlasse) return r;
        const idx = nextClass.findIndex(x => x.id === r.id);
        return { ...r, startnummer: idx >= 0 ? idx + 1 : r.startnummer };
      }));

      // mark changed all affected ids
      setChanged(prev => {
        const next = new Set(prev);
        nextClass.forEach(i => next.add(i.id));
        return next;
      });
      setMsg('Startvolgorde aangepast (nog niet opgeslagen)');
      setDraggingId(null);
      setDragOverId(null);
    } catch (err) { console.warn('drop parse failed', err); }
  }

  const gekozen = useMemo(
    () => wedstrijden.find((w) => w.id === selectedWedstrijdId) || null,
    [wedstrijden, selectedWedstrijdId]
  );

  // sync schedule configuration from wedstrijd (persisted in startlijst_config)
  useEffect(() => {
    if (!gekozen) return;
    try {
      const cfg = (gekozen.startlijst_config && typeof gekozen.startlijst_config === 'object') ? gekozen.startlijst_config : (gekozen.startlijst_config ? JSON.parse(gekozen.startlijst_config) : null);
      if (cfg) {
        setScheduleConfig(s => ({ ...s, dressuurStart: cfg.dressuurStart || s.dressuurStart || '', interval: cfg.interval || s.interval || 7, trailOffset: cfg.trailOffset || s.trailOffset || 0, trailInfo: cfg.trailInfo || s.trailInfo || '' }));
        // support both legacy array-shaped pauses and the newer object mapping per klasse
        if (cfg.pauses) {
          if (Array.isArray(cfg.pauses)) {
            // legacy: store under __default__ key
            setPauses({ ...(typeof pauses === 'object' ? pauses : {}), ['__default__']: cfg.pauses });
          } else if (typeof cfg.pauses === 'object') {
            setPauses(cfg.pauses);
          }
        }
      }
    } catch (e) { /* ignore */ }
  }, [gekozen]);

  const fetchRows = useCallback(async () => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      if (!selectedWedstrijdId) {
        setRows([]);
        setEditRows([]);
        return;
      }
      let q = supabase
        .from("inschrijvingen")
    .select("id, created_at, wedstrijd_id, klasse, categorie, ruiter, paard, email, startnummer, omroeper, opmerkingen, starttijd_manual, trailtijd_manual")
        .eq("wedstrijd_id", selectedWedstrijdId)
        .order("startnummer", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: true });

  if (klasseFilter) q = q.eq("klasse", klasseFilter);

      const { data, error } = await q;
      if (error) throw error;

      setRows(data || []);
      setEditRows((data || []).map(r => ({ ...r })));
      setChanged(new Set());
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [selectedWedstrijdId, klasseFilter]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // initialize klasse order when rows or filters change
  useEffect(() => {
    const map = new Map();
    (editRows || []).forEach(r => {
      const k = r.klasse || 'onbekend';
      if (!map.has(k)) map.set(k, 0);
    });
    const keys = [...map.keys()];
    // if no rows, default to KLASSEN_EDIT order
    if (keys.length === 0) setKlasseOrder(KLASSEN_EDIT.map(k => k.code));
    else setKlasseOrder(keys);
  }, [editRows]);

  // Realtime updates (verversen bij wijzigingen, ook als iemand anders iets toevoegt)
  useEffect(() => {
    if (!selectedWedstrijdId) return;
    const channel = supabase
      .channel("rt_startlijst_beheer")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inschrijvingen",
          filter: `wedstrijd_id=eq.${selectedWedstrijdId}`,
        },
        () => fetchRows()
      )
      .subscribe();
    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [selectedWedstrijdId, fetchRows]);

  const markChanged = (id) => {
    setChanged(prev => new Set(prev).add(id));
    setMsg("");
  };

  const onCellChange = (id, field, value) => {
    setEditRows(list => list.map(r => r.id === id ? { ...r, [field]: value } : r));
    markChanged(id);
  };

  const moveRow = (idx, dir) => {
    setEditRows(list => {
      const next = [...list];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return list;
      const tmp = next[idx];
      next[idx] = next[j];
      next[j] = tmp;
      return next;
    });
  };

  const renumber = () => {
    // per-klasse renumber volgens schema: weX -> X01, X02, ... (WE1 -> 101, 102)
    const getDigit = (code) => {
      if (!code) return null;
      const c = String(code).toLowerCase();
      if (c === 'junior') return 6;
      if (c === 'yr' || c === 'young riders' || c === 'young_riders') return 7;
      if (c === 'we2p' || c === 'we2+' ) return 8;
      const m = c.match(/we(\d)/);
      return m ? Number(m[1]) : null;
    };
    const byClass = new Map();
    editRows.forEach(r => {
      const k = r.klasse || 'onbekend';
      if (!byClass.has(k)) byClass.set(k, []);
      byClass.get(k).push(r);
    });
    // sort each group reliably
    for (const [k, arr] of byClass.entries()) {
      arr.sort((a,b)=>{
        const aNum = a.startnummer == null ? Infinity : Number(a.startnummer);
        const bNum = b.startnummer == null ? Infinity : Number(b.startnummer);
        if (aNum !== bNum) return aNum - bNum;
        return new Date(a.created_at) - new Date(b.created_at);
      });
    }
    const newRows = editRows.map(r => {
      const k = r.klasse || 'onbekend';
      const arr = byClass.get(k) || [];
      const idx = arr.findIndex(x => x.id === r.id);
      const digit = getDigit(k);
      if (digit != null && idx >= 0) {
        const num = digit * 100 + (idx + 1);
        return { ...r, startnummer: num };
      }
      // fallback: sequential across group
      if (idx >= 0) return { ...r, startnummer: idx + 1 };
      return r;
    });
    setEditRows(newRows);
    setChanged(new Set(newRows.map(r => r.id)));
    setMsg("Startnummers hernummerd (nog niet opgeslagen).");
  };

  const saveChanges = async () => {
    if (!changed.size) {
      setMsg("Geen wijzigingen om op te slaan.");
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const toSave = editRows
        .filter(r => changed.has(r.id))
        .map(r => ({
          id: r.id,
          wedstrijd_id: r.wedstrijd_id,
          klasse: r.klasse || null,
          categorie: r.categorie || null,
          ruiter: r.ruiter || null,
          paard: r.paard || null,
          email: r.email || null,
          omroeper: r.omroeper || null,
          opmerkingen: r.opmerkingen || null,
          startnummer: r.startnummer != null && r.startnummer !== "" ? Number(r.startnummer) : null,
          starttijd_manual: r.starttijd_manual || null,
          trailtijd_manual: r.trailtijd_manual || null,
        }));

      // Validation: startnummers must be unique per wedstrijd and max 3 digits
      const nums = toSave.map(s => s.startnummer).filter(n => n != null);
      const dup = nums.find((n,i) => nums.indexOf(n) !== i);
      if (dup) throw new Error('Startnummers moeten uniek zijn binnen de wedstrijd. Dubbel: ' + dup);
      if (nums.some(n => Math.abs(Number(n)) > 999)) throw new Error('Startnummers mogen maximaal 3 cijfers bevatten (0-999).');

      const { error } = await supabase.from("inschrijvingen").upsert(toSave, { onConflict: "id" });
      if (error) throw error;

      setMsg(`Wijzigingen opgeslagen ✔️ (${toSave.length})`);
      setChanged(new Set());
      await fetchRows();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const addRow = async () => {
    if (!selectedWedstrijdId) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const nextStart =
        rows.length ? (Math.max(...rows.map(r => r.startnummer || 0)) + 1) : 1;

      const { error } = await supabase.from("inschrijvingen").insert({
        wedstrijd_id: selectedWedstrijdId,
        klasse: klasseFilter || null,
        categorie: null,
        ruiter: "",
        paard: "",
        email: "",
        startnummer: nextStart
      });
      if (error) throw error;
      await fetchRows();
      setMsg("Nieuwe inschrijving toegevoegd ✔️");
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteRow = async (id) => {
    if (!id) return;
    if (!confirm("Weet je zeker dat je deze inschrijving wilt verwijderen?")) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const { error } = await supabase.from("inschrijvingen").delete().eq("id", id);
      if (error) throw error;
      await fetchRows();
      setMsg("Inschrijving verwijderd ✔️");
    } catch (e) {
      // Tip geven als delete policy ontbreekt
      const txt = String(e?.message || "").toLowerCase();
      if (txt.includes("not allowed") || txt.includes("policy")) {
        setErr("Verwijderen is door RLS/policy geblokkeerd. Voeg een DELETE-policy toe voor beheer.");
      } else {
        setErr(e?.message || String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const visible = editRows; // filtering gebeurt al in de query

  // Group rows by klasse for per-klasse sections
  const grouped = useMemo(() => {
    const map = new Map();
    visible.forEach(r => {
      const k = r.klasse || 'onbekend';
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    });
    for (const [k, arr] of map.entries()) {
      arr.sort((a,b)=>{
        const aNum = a.startnummer == null ? Infinity : Number(a.startnummer);
        const bNum = b.startnummer == null ? Infinity : Number(b.startnummer);
        if (aNum !== bNum) return aNum - bNum;
        return new Date(a.created_at) - new Date(b.created_at);
      });
      map.set(k, arr);
    }
    return map;
  }, [visible]);

  function moveClass(code, dir) {
    setKlasseOrder(prev => {
      const idx = prev.indexOf(code);
      if (idx === -1) return prev;
      const to = Math.max(0, Math.min(prev.length - 1, idx + dir));
      if (to === idx) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  }

  function formatStartnummer(r) {
    const raw = r?.startnummer;
    const klasse = r?.klasse || '';
    if (raw == null || raw === '') return '';
    const num = Number(raw);
    if (Number.isNaN(num)) return String(raw);
    const m = String(klasse).toLowerCase().match(/we(\d)/);
    const padded = String(num).padStart(3, '0');
    if (m) {
      const prefix = m[1];
      return `WE${prefix} ${padded}`;
    }
    return padded;
  }

  function parseTimeForDate(timeStr) {
    if (!timeStr) return null;
    // prefer wedstrijd datum if available
    const datePart = (gekozen && gekozen.datum) ? String(gekozen.datum) : null;
    try {
      if (datePart) {
        // timeStr like 'HH:MM'
        return new Date(datePart + 'T' + timeStr + ':00');
      }
      const today = new Date();
      const [hh, mm] = String(timeStr).split(':').map(s => Number(s));
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hh || 0, mm || 0, 0);
      return d;
    } catch (e) { return null; }
  }

  function formatTime(date) {
    if (!date) return '';
    try {
      const d = new Date(date);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return '' }
  }

  function computeStartTimes(items, klasseCode) {
    // items: ordered array for the class
    const base = parseTimeForDate(scheduleConfig.dressuurStart);
    const interval = Number(scheduleConfig.interval) || 7;
    if (!items || !items.length) return [];
    const times = [];
    let cumulative = 0; // minutes
  // pauses may be stored as an object mapping klasseCode -> array of pause objects
  const classPausesRaw = (pauses && pauses[klasseCode]) ? pauses[klasseCode] : ((pauses && pauses['__default__']) ? pauses['__default__'] : []);
  const classPauses = Array.isArray(classPausesRaw) ? classPausesRaw : [];
    for (let i = 0; i < items.length; i++) {
      // pauses are defined as afterIndex === number of previous participants
      const afterIndex = i === 0 ? 0 : i;
      const pauseHere = classPauses.find(p => Number(p.afterIndex) === afterIndex);
      if (i > 0) cumulative += interval;
      if (pauseHere) cumulative += Number(pauseHere.minutes || 0);
      const start = base ? new Date(base.getTime() + cumulative * 60000) : null;
      times.push(start);
    }
    return times;
  }

  async function saveScheduleToWedstrijd() {
    if (!gekozen) return setMsg('Kies eerst een wedstrijd.');
    setBusy(true); setErr(''); setMsg('');
    try {
      const payload = {
        startlijst_config: {
          dressuurStart: scheduleConfig.dressuurStart || null,
          interval: scheduleConfig.interval || 7,
          trailOffset: scheduleConfig.trailOffset || 0,
          trailInfo: scheduleConfig.trailInfo || '',
          pauses: pauses || {}
        }
      };
      const { error } = await supabase.from('wedstrijden').update(payload).eq('id', gekozen.id);
      if (error) throw error;
      setMsg('Planning opgeslagen ✔️');
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  // helper to get displayed start/trail time considering manual overrides on the row
  function getDisplayedTimesForRow(item, idx, classItems, klasseCode) {
    const manualStart = item.starttijd_manual;
    const manualTrail = item.trailtijd_manual;
    const times = computeStartTimes(classItems, klasseCode);
    const computedStart = times[idx] || null;
    const start = manualStart ? (new Date(manualStart)) : computedStart;
    const trail = manualTrail ? (new Date(manualTrail)) : (start ? new Date(start.getTime() + (Number(scheduleConfig.trailOffset || 0) * 60000)) : null);
    return { start, trail, computedStart };
  }

  // Export helpers
  function handleExportExcel(klasseCode) {
    const wb = XLSX.utils.book_new();
    if (klasseCode === '__all__') {
      for (const [k, items] of grouped.entries()) {
        const ws = XLSX.utils.json_to_sheet(
          (items || []).map((item, idx) => {
            const { start, trail } = getDisplayedTimesForRow(item, idx, items, k);
            return {
              Starttijd: formatTime(start),
              Startnummer: item.startnummer || '',
              Ruiter: item.ruiter,
              Paard: item.paard,
              Klasse: KLASSEN.find(x=>x.code=== (item.klasse || ''))?.label || item.klasse || '',
              'Starttijd Trail': formatTime(trail),
            };
          })
        );
        XLSX.utils.book_append_sheet(wb, ws, (k || 'Onbekend').toString().slice(0,30));
      }
      XLSX.writeFile(wb, `Startlijst_${gekozen?.naam ? gekozen.naam.replace(/\s+/g,'_') : 'wedstrijd'}.xlsx`);
      return;
    }
    const items = grouped.get(klasseCode) || [];
    const ws = XLSX.utils.json_to_sheet(
      items.map((item, idx) => {
        const { start, trail } = getDisplayedTimesForRow(item, idx, items, klasseCode);
        return {
          Starttijd: formatTime(start),
          Startnummer: item.startnummer || '',
          Ruiter: item.ruiter,
          Paard: item.paard,
          Klasse: KLASSEN.find(x=>x.code=== (item.klasse || ''))?.label || item.klasse || '',
          'Starttijd Trail': formatTime(trail),
        };
      })
    );
    XLSX.utils.book_append_sheet(wb, ws, klasseCode || 'Onbekend');
    XLSX.writeFile(wb, `Startlijst_${klasseCode || 'onbekend'}.xlsx`);
  }

  async function handleExportPDF(klasseCode) {
    const el = refs.current[klasseCode];
    if (!el) return;
    const canvas = await html2canvas(el, { backgroundColor: '#fff', scale: 2 });
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [canvas.width, canvas.height + 60] });
    pdf.addImage(canvas, 'PNG', 10, 30, canvas.width - 20, canvas.height - 40);
    pdf.text(`Startlijst ${klasseCode}`, 30, 20);
    pdf.save(`Startlijst_${klasseCode}.pdf`);
  }

  async function handleExportAfbeelding(klasseCode) {
    const el = refs.current[klasseCode];
    if (!el) return;
    const canvas = await html2canvas(el, { backgroundColor: '#fff', scale: 2 });
    const link = document.createElement('a');
    link.download = `Startlijst_${klasseCode}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

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

            <label style={{ display: 'flex', gap: 8, alignItems: 'center', userSelect: 'none' }}>
              <input type="checkbox" checked={beheer} onChange={(e)=>setBeheer(e.target.checked)} /> Beheer-modus
            </label>

            <Button onClick={fetchRows} disabled={busy || !selectedWedstrijdId}>{busy ? 'Vernieuwen...' : 'Vernieuw'}</Button>
            <Button onClick={()=>handleExportExcel('__all__')} disabled={!selectedWedstrijdId}>Export hele startlijst (Excel)</Button>
            {beheer && <Button onClick={saveChanges} disabled={busy || !selectedWedstrijdId || !changed.size}>{busy ? 'Opslaan...' : `Opslaan (${changed.size||0})`}</Button>}
          </div>

          {err && <Alert type="error">{String(err)}</Alert>}
          {msg && <Alert type={String(msg).toLowerCase().includes('fout') ? 'error' : 'success'}>{msg}</Alert>}

          {!selectedWedstrijdId && (
            <div style={{ marginTop: 16, color: '#555' }}>Kies hierboven een wedstrijd om de startlijst te tonen. Tip: je kunt ook direct naar <code>#/startlijst?wedstrijdId=&lt;uuid&gt;</code> linken.</div>
          )}

          {selectedWedstrijdId && (
            <>
              <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#666' }}><b>Aantal inschrijvingen:</b> {visible.length}</div>
                {beheer && (<><Button onClick={addRow} disabled={busy} variant="secondary">Nieuwe inschrijving</Button><Button onClick={renumber} disabled={busy || visible.length === 0} variant="secondary">Startnummers hernummeren</Button></>)}
              </div>

              <div style={{ marginTop: 8, display: 'grid', gap: 18 }}>
                {/* Schedule/config panel */}
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
                      <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Trail offset (min)</label>
                      <input type="number" value={scheduleConfig.trailOffset} onChange={e=>setScheduleConfig(s=>({...s, trailOffset: Number(e.target.value)||0}))} style={{ width: 80 }} />
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                      <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Pauzes</label>
                      <small style={{ color: '#666' }}>Voeg pauzes toe via beheer-mode (na welke start; minuten)</small>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, color: '#234' }}><b>Info:</b> {scheduleConfig.trailInfo || 'Stel hierboven de dressuur starttijd, interval en trail offset in.'}</div>
                </div>

                {(klasseOrder || []).map(klasseCode => {
                  const items = grouped.get(klasseCode) || [];
                  return (
                    <div key={klasseCode} draggable={true} onDragStart={(e)=>{ e.dataTransfer.setData('text/plain', klasseCode); e.dataTransfer.effectAllowed='move'; setDraggingId(klasseCode); }} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{ e.preventDefault(); const code = e.dataTransfer.getData('text/plain'); if (code) { const from = klasseOrder.indexOf(code); const to = klasseOrder.indexOf(klasseCode); if (from !== -1 && to !== -1 && from !== to) { const copy = [...klasseOrder]; const [it] = copy.splice(from,1); copy.splice(to, 0, it); setKlasseOrder(copy); } } setDraggingId(null); }} style={{ background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #eef6ff', boxShadow: draggingId === klasseCode ? '0 10px 30px rgba(12,40,80,0.08)' : '0 6px 18px rgba(12,40,80,0.04)', cursor: 'grab' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <div style={{ fontWeight: 800, fontSize: 16 }}>{KLASSEN_EDIT.find(k => k.code === klasseCode)?.label || (klasseCode === 'onbekend' ? 'Onbekend' : klasseCode)}</div>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Button title="Verplaats klasse omhoog" onClick={() => moveClass(klasseCode, -1)} variant="secondary">↑</Button>
                          <Button title="Verplaats klasse omlaag" onClick={() => moveClass(klasseCode, 1)} variant="secondary">↓</Button>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <Button onClick={() => handleExportExcel(klasseCode)} variant="secondary">Export Excel</Button>
                            <Button onClick={() => handleExportPDF(klasseCode)} variant="secondary">Export PDF</Button>
                            <Button onClick={() => handleExportAfbeelding(klasseCode)} variant="secondary">Export afbeelding</Button>
                          </div>
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
                              const times = computeStartTimes(items, klasseCode);
                              return items.map((r, idx) => {
                                const { start, trail, computedStart } = getDisplayedTimesForRow(r, idx, items, klasseCode);
                                return (
                                  <tr key={r.id} draggable={false} onDragOver={onDragOver} onDragEnter={(e)=>onDragEnter(e, r.id)} onDragLeave={onDragLeave} onDrop={(e)=>onDrop(e, idx, klasseCode)} style={{ borderTop: '1px solid #f0f0f0', background: dragOverId === r.id ? '#f0fbff' : undefined, opacity: draggingId === r.id ? 0.6 : 1, transition: 'background 140ms, transform 140ms, opacity 120ms' }}>
                                    {visibleCols.starttijd && <td style={{ padding: 8 }}>{beheer ? (<input type="datetime-local" value={r.starttijd_manual || (computedStart ? new Date(computedStart).toISOString().slice(0,16) : '')} onChange={(e)=>onCellChange(r.id, 'starttijd_manual', e.target.value)} />) : formatTime(start)}</td>}
                                    {visibleCols.startnummer && <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 8, alignItems: 'center', padding: 8 }}>{beheer ? (<><button aria-label="drag-handle" draggable={beheer} onDragStart={(e)=>onDragStart(e, r.id, klasseCode)} onDragEnd={()=>{ setDraggingId(null); setDragOverId(null); }} style={{ cursor: 'grab', padding: 6, borderRadius: 6, border: '1px solid #e6eefb', background: '#fafdff' }}>≡</button><input type="number" value={r.startnummer ?? ''} onChange={(e)=>onCellChange(r.id, 'startnummer', e.target.value)} style={{ width: 64 }} /></>) : (formatStartnummer(r) || (r.startnummer ?? idx + 1))}</td>}
                                    {visibleCols.ruiter && <td style={{ padding: 8 }}>{beheer ? <input value={r.ruiter || ''} onChange={(e)=>onCellChange(r.id, 'ruiter', e.target.value)} style={{ width: '100%' }} /> : (r.ruiter || '—')}</td>}
                                    {visibleCols.paard && <td style={{ padding: 8 }}>{beheer ? <input value={r.paard || ''} onChange={(e)=>onCellChange(r.id, 'paard', e.target.value)} style={{ width: '100%' }} /> : (r.paard || '—')}</td>}
                                    {visibleCols.klasse && <td style={{ padding: 8 }}>{KLASSEN.find(k=>k.code === (r.klasse || ''))?.label || (r.klasse || '—')}</td>}
                                    {visibleCols.starttijdTrail && <td style={{ padding: 8 }}>{beheer ? (<input type="datetime-local" value={r.trailtijd_manual || (trail ? new Date(trail).toISOString().slice(0,16) : '')} onChange={(e)=>onCellChange(r.id, 'trailtijd_manual', e.target.value)} />) : formatTime(trail)}</td>}
                                    {beheer && (<td style={{ whiteSpace: 'nowrap', padding: 8 }}><Button onClick={()=>{/* noop */}} variant="secondary">↕️</Button><Button onClick={()=>deleteRow(r.id)} variant="secondary" style={{ color: 'crimson' }}>Verwijderen</Button></td>)}
                                  </tr>
                                );
                              });
                            })()}
                            {items.length === 0 && (<tr><td colSpan={beheer ? 6 : 5} style={{ color: '#777', padding: '18px 8px' }}>Nog geen inschrijvingen voor deze klasse.</td></tr>)}
                          </tbody>
                        </table>

                        {beheer && (
                          <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: '#fcfeff', border: '1px dashed #e6f2ff' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Pauzes voor {KLASSEN_EDIT.find(k=>k.code===klasseCode)?.label || klasseCode}</div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}><small style={{ color: '#666' }}>Huidige pauzes:</small></div>
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
                        )}
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
          <div style={{ fontSize: 13, color: '#333', marginTop: 6 }}>Dressuur start: <b>{scheduleConfig.dressuurStart || '—'}</b><br/>Interval: <b>{scheduleConfig.interval} min</b><br/>Trail offset: <b>{scheduleConfig.trailOffset} min</b></div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700 }}>Voorbeeld export (alle klassen)</div>
            <div style={{ marginTop: 8 }}>
              {(() => {
                const rows = [];
                for (const [k, items] of grouped.entries()) {
                  for (let i=0;i<items.length;i++) {
                    const it = items[i];
                    const { start, trail } = getDisplayedTimesForRow(it, i, items, k);
                    rows.push({ klasse: KLASSEN.find(x=>x.code===k)?.label || k, start: formatTime(start), trail: formatTime(trail), ruiter: it.ruiter || '—', startnummer: formatStartnummer(it) || (it.startnummer || i+1) });
                  }
                }
                if (!rows.length) return <div style={{ color: '#777' }}>Geen inschrijvingen</div>;
                return (
                  <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                    <thead><tr><th style={{ textAlign: 'left' }}>Klasse</th><th style={{ textAlign: 'left' }}>#</th><th style={{ textAlign: 'left' }}>Ruiter</th><th style={{ textAlign: 'left' }}>Starttijd</th><th style={{ textAlign: 'left' }}>Trail</th></tr></thead>
                    <tbody>
                      {rows.slice(0,50).map((r,i)=>(<tr key={i}><td>{r.klasse}</td><td>{r.startnummer}</td><td>{r.ruiter}</td><td>{r.start}</td><td>{r.trail}</td></tr>))}
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
