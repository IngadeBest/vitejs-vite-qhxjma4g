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
];
const KLASSEN_EDIT = KLASSEN.filter(k => k.code !== "");

// Categorieën (Senioren / Young Riders / Junioren)
const CATS = [
  { code: "",       label: "Alle categorieën" },
  { code: "senior", label: "Senioren" },
  { code: "yr",     label: "Young Riders" },
  { code: "junior", label: "Junioren" },
];
const CATS_EDIT = CATS.filter(c => c.code !== "");
const CAT_LABEL = Object.fromEntries(CATS_EDIT.map(c => [c.code, c.label]));

export default function Startlijst() {
  const { items: wedstrijden, loading: loadingWed } = useWedstrijden(false);
  const [sp] = useSearchParams();
  const qId = sp.get("wedstrijdId") || "";

  const [selectedWedstrijdId, setSelectedWedstrijdId] = useState(qId);
  const [klasseFilter, setKlasseFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
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
        .select("id, created_at, wedstrijd_id, klasse, categorie, ruiter, paard, email, startnummer, omroeper, opmerkingen")
        .eq("wedstrijd_id", selectedWedstrijdId)
        .order("startnummer", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: true });

      if (klasseFilter) q = q.eq("klasse", klasseFilter);
      if (catFilter) q = q.eq("categorie", catFilter);

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
  }, [selectedWedstrijdId, klasseFilter, catFilter]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

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
    setEditRows(list => list.map((r, i) => ({ ...r, startnummer: i + 1 })));
    // markeer alles gewijzigd
    setChanged(new Set(editRows.map(r => r.id)));
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
        }));

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
        categorie: catFilter || "senior", // default
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

  // Export helpers
  function handleExportExcel(klasseCode) {
    const items = grouped.get(klasseCode) || [];
    const ws = XLSX.utils.json_to_sheet(
      items.map(item => ({
        Startnummer: item.startnummer || '',
        Ruiter: item.ruiter,
        Paard: item.paard,
        Categorie: item.categorie,
        Email: item.email,
        Omroeper: item.omroeper,
        Opmerkingen: item.opmerkingen,
      }))
    );
    const wb = XLSX.utils.book_new();
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
    <div style={{ maxWidth: 1200, margin: "24px auto" }}>
      <h2>Startlijst</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr auto auto auto",
          gap: 8,
          alignItems: "end",
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#666" }}>
            Wedstrijd
          </label>
          <select
            value={selectedWedstrijdId}
            onChange={(e) => setSelectedWedstrijdId(e.target.value)}
            disabled={loadingWed}
            style={{ width: "100%" }}
          >
            <option value="">{loadingWed ? "Laden..." : "— kies wedstrijd —"}</option>
            {wedstrijden.map((w) => (
              <option key={w.id} value={w.id}>
                {w.naam} {w.datum ? `(${w.datum})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, color: "#666" }}>
            Klasse (filter)
          </label>
          <select
            value={klasseFilter}
            onChange={(e) => setKlasseFilter(e.target.value)}
            style={{ width: "100%" }}
          >
            {KLASSEN.map((k) => (
              <option key={k.code || "all"} value={k.code}>
                {k.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, color: "#666" }}>
            Categorie (filter)
          </label>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            style={{ width: "100%" }}
          >
            {CATS.map((c) => (
              <option key={c.code || "all"} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <label
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={beheer}
            onChange={(e) => setBeheer(e.target.checked)}
          />
          Beheer-modus
        </label>

        <Button onClick={fetchRows} disabled={busy || !selectedWedstrijdId}>
          {busy ? "Vernieuwen..." : "Vernieuw"}
        </Button>

        {beheer && (
          <Button
            onClick={saveChanges}
            disabled={busy || !selectedWedstrijdId || !changed.size}
          >
            {busy ? "Opslaan..." : `Opslaan (${changed.size || 0})`}
          </Button>
        )}
      </div>

  {err && <Alert type="error">{String(err)}</Alert>}
  {msg && <Alert type={String(msg).toLowerCase().includes('fout') ? 'error' : 'success'}>{msg}</Alert>}

      {!selectedWedstrijdId && (
        <div style={{ marginTop: 16, color: "#555" }}>
          Kies hierboven een wedstrijd om de startlijst te tonen. Tip: je kunt ook direct naar{" "}
          <code>#/startlijst?wedstrijdId=&lt;uuid&gt;</code> linken.
        </div>
      )}

      {selectedWedstrijdId && (
        <>
          <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "#666" }}>
              <b>Aantal inschrijvingen:</b> {visible.length}
            </div>
            {beheer && (
              <>
                <button onClick={addRow} disabled={busy}>Nieuwe inschrijving</button>
                <button onClick={renumber} disabled={busy || visible.length === 0}>
                  Startnummers hernummeren 1..n
                </button>
              </>
            )}
          </div>

          <div style={{ marginTop: 8, display: 'grid', gap: 18 }}>
            {[...grouped.keys()].map(klasseCode => {
              const items = grouped.get(klasseCode) || [];
              return (
                <div key={klasseCode} style={{ background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #eef6ff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{KLASSEN_EDIT.find(k => k.code === klasseCode)?.label || (klasseCode === 'onbekend' ? 'Onbekend' : klasseCode)}</div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                      <button onClick={() => handleExportExcel(klasseCode)}>Export Excel</button>
                      <button onClick={() => handleExportPDF(klasseCode)}>Export PDF</button>
                      <button onClick={() => handleExportAfbeelding(klasseCode)}>Export afbeelding</button>
                    </div>
                  </div>

                  <div ref={el => refs.current[klasseCode] = el}>
                    <table width="100%" cellPadding={6} style={{ borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead>
                        <tr style={{ background: '#f7f7f7' }}>
                          <th style={{ borderBottom: '1px solid #eee', width: 60 }}>#</th>
                          <th style={{ borderBottom: '1px solid #eee' }}>Ruiter</th>
                          <th style={{ borderBottom: '1px solid #eee' }}>Paard</th>
                          <th style={{ borderBottom: '1px solid #eee', width: 160 }}>Categorie</th>
                          <th style={{ borderBottom: '1px solid #eee' }}>Email</th>
                          <th style={{ borderBottom: '1px solid #eee' }}>Omroeper</th>
                          <th style={{ borderBottom: '1px solid #eee' }}>Opmerkingen</th>
                          {beheer && <th style={{ borderBottom: '1px solid #eee', width: 120 }}>Acties</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((r, idx) => (
                          <tr key={r.id}
                            draggable={beheer}
                            onDragStart={(e)=>onDragStart(e, r.id, klasseCode)}
                            onDragOver={onDragOver}
                            onDragEnter={(e)=>onDragEnter(e, r.id)}
                            onDragLeave={onDragLeave}
                            onDrop={(e)=>onDrop(e, idx, klasseCode)}
                            style={{ borderTop: '1px solid #f0f0f0', background: dragOverId === r.id ? '#f0fbff' : undefined, opacity: draggingId === r.id ? 0.6 : 1 }}>
                            <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 8, alignItems: 'center' }}>{beheer ? (
                              <>
                                <button aria-label="handle" style={{ cursor: 'grab', padding: 4 }}>≡</button>
                                <input type="number" value={r.startnummer ?? ''} onChange={(e)=>onCellChange(r.id, 'startnummer', e.target.value)} style={{ width: 64 }} />
                              </>
                            ) : (r.startnummer ?? idx + 1)}</td>
                            <td>{beheer ? <input value={r.ruiter || ''} onChange={(e)=>onCellChange(r.id, 'ruiter', e.target.value)} style={{ width: '100%' }} /> : (r.ruiter || '—')}</td>
                            <td>{beheer ? <input value={r.paard || ''} onChange={(e)=>onCellChange(r.id, 'paard', e.target.value)} style={{ width: '100%' }} /> : (r.paard || '—')}</td>
                            <td>{beheer ? (
                              <select value={r.categorie || ''} onChange={(e)=>onCellChange(r.id, 'categorie', e.target.value)} style={{ width: '100%' }}>
                                <option value="">— kies categorie —</option>
                                {CATS_EDIT.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                              </select>
                            ) : (CAT_LABEL[r.categorie] || r.categorie || '—')}</td>
                            <td>{beheer ? <input type="email" value={r.email || ''} onChange={(e)=>onCellChange(r.id, 'email', e.target.value)} style={{ width: '100%' }} /> : (r.email || '—')}</td>
                            <td>{beheer ? <input value={r.omroeper || ''} onChange={(e)=>onCellChange(r.id, 'omroeper', e.target.value)} style={{ width: '100%' }} placeholder="Tekst voor omroeper" /> : (r.omroeper || '—')}</td>
                            <td>{beheer ? <input value={r.opmerkingen || ''} onChange={(e)=>onCellChange(r.id, 'opmerkingen', e.target.value)} style={{ width: '100%' }} /> : (r.opmerkingen || '—')}</td>
                            {beheer && (
                              <td style={{ whiteSpace: 'nowrap' }}>
                                <button onClick={()=>{/* noop: explicit move via drag/drop preferred */}}>↕️</button>
                                <button onClick={()=>deleteRow(r.id)} style={{ color: 'crimson' }}>Verwijderen</button>
                              </td>
                            )}
                          </tr>
                        ))}
                        {items.length === 0 && (
                          <tr><td colSpan={beheer ? 7 : 6} style={{ color: '#777', padding: '18px 8px' }}>Nog geen inschrijvingen voor deze klasse.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          {!!gekozen && (
            <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
              Formulier-link voor ruiters:{" "}
              <code>
                {location.origin}/#/formulier?wedstrijdId={gekozen.id}
              </code>
            </div>
          )}
        </>
      )}
    </div>
  );
}
