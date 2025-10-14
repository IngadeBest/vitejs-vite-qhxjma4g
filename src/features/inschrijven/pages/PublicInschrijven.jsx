import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useWedstrijden } from "./hooks/useWedstrijden";

const KLASSEN = [
  { code: "we0", label: "Introductieklasse (WE0)" },
  { code: "we1", label: "WE1" },
  { code: "we2", label: "WE2" },
  { code: "we3", label: "WE3" },
  { code: "we4", label: "WE4" },
];

export default function PublicInschrijven() {
  const { items: wedstrijden, loading } = useWedstrijden(true);
  const [sp] = useSearchParams();
  const qId = sp.get("wedstrijdId") || "";
  const qKlasse = sp.get("klasse") || "";

  const [form, setForm] = useState({
    wedstrijd_id: qId || "",
    klasse: qKlasse || "",
    ruiter: "",
    paard: "",
    email: "",
    omroeper: "",
    opmerkingen: "",
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const gekozenWedstrijd = useMemo(
    () => wedstrijden.find(w => w.id === form.wedstrijd_id) || null,
    [wedstrijden, form.wedstrijd_id]
  );

  const disabled = useMemo(() => {
    if (!form.ruiter || !form.paard || !form.email) return true;
    if (!form.wedstrijd_id || !form.klasse) return true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return true;
    return false;
  }, [form]);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setDone(false);
    setErr("");

    const payload = {
      wedstrijd_id: form.wedstrijd_id,
      wedstrijd: gekozenWedstrijd ? gekozenWedstrijd.naam : null,
      klasse: form.klasse,
      ruiter: form.ruiter,
      paard: form.paard,
      email: form.email,
      opmerkingen: form.opmerkingen || null,
      omroeper: form.omroeper || null,
      voorkeur_tijd: null, // GEEN voorkeuren publiek
    };

    try {
      const { error } = await supabase.from("inschrijvingen").insert(payload);
      if (error) throw error;
      setDone(true);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div style={{ maxWidth: 720, margin: "24px auto" }}>
        <h2>Dank je wel!</h2>
        <p>We hebben je inschrijving ontvangen. Je staat in het systeem voor: <b>{gekozenWedstrijd?.naam || "—"}</b>.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "24px auto" }}>
      <h2>Inschrijfformulier Ruiters</h2>
      <p style={{ color:"#555" }}>Velden met * zijn verplicht. Er is geen voorkeur starttijd veld.</p>

      <form onSubmit={onSubmit} style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "10px 12px", alignItems:"center" }}>
        <label>Wedstrijd*</label>
        <select value={form.wedstrijd_id} onChange={(e)=>setForm(s=>({...s, wedstrijd_id:e.target.value}))} disabled={loading || !!qId}>
          <option value="">{loading ? "Laden..." : "— kies wedstrijd —"}</option>
          {wedstrijden.map(w => <option key={w.id} value={w.id}>{w.naam} {w.datum ? `(${w.datum})` : ""}</option>)}
        </select>

        <label>Klasse*</label>
        {qKlasse ? (
          <input value={form.klasse} disabled />
        ) : (
          <select value={form.klasse} onChange={(e)=>setForm(s=>({...s, klasse:e.target.value}))}>
            <option value="">— kies klasse —</option>
            {KLASSEN.map(k => <option key={k.code} value={k.code}>{k.label}</option>)}
          </select>
        )}

        <label>Ruiter (volledige naam)*</label>
        <input value={form.ruiter} onChange={(e)=>setForm(s=>({...s, ruiter:e.target.value}))} />

        <label>Paard*</label>
        <input value={form.paard} onChange={(e)=>setForm(s=>({...s, paard:e.target.value}))} />

        <label>E-mail*</label>
        <input type="email" value={form.email} onChange={(e)=>setForm(s=>({...s, email:e.target.value}))} placeholder="naam@voorbeeld.nl" />

        <label>Tekst voor omroeper</label>
        <textarea
          rows={4}
          value={form.omroeper}
          onChange={(e)=>setForm(s=>({...s, omroeper:e.target.value}))}
          placeholder="Korte tekst voor de omroeper (ruiter & paard)."
        />

        <label>Opmerkingen voor de organisatie</label>
        <textarea
          rows={3}
          value={form.opmerkingen}
          onChange={(e)=>setForm(s=>({...s, opmerkingen:e.target.value}))}
        />

        <div></div>
        <button type="submit" disabled={busy || disabled}>{busy ? "Verzenden..." : "Inschrijven"}</button>
      </form>

      {err && <div style={{ marginTop: 12, color: "crimson" }}>{String(err)}</div>}
    </div>
  );
}
