import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useWedstrijden } from "./hooks/useWedstrijden";

const KLASSEN = [
  { code: "we0", label: "Introductieklasse (WE0)" },
  { code: "we1", label: "WE1" },
  { code: "we2", label: "WE2" },
  { code: "we3", label: "WE3" },
  { code: "we4", label: "WE4" },
];

export default function InschrijfFormulier() {
  const { items: wedstrijden, loading } = useWedstrijden(false);

  const [form, setForm] = useState({
    wedstrijd_id: "",
    klasse: "",
    ruiter: "",
    paard: "",
    email: "",
    telefoon: "",
    omroeper: "",
    opmerkingen: "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const disabled = useMemo(() => {
    return !form.ruiter || !form.paard || !form.klasse || !form.wedstrijd_id;
  }, [form]);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");

    const wedstrijdObj = wedstrijden.find(w => w.id === form.wedstrijd_id);
    const payload = {
      wedstrijd_id: form.wedstrijd_id,
      wedstrijd: wedstrijdObj ? wedstrijdObj.naam : null, // denormalized voor leesbaarheid
      klasse: form.klasse,
      ruiter: form.ruiter,
      paard: form.paard,
      email: form.email || null,
      telefoon: form.telefoon || null,
      voorkeur_tijd: null, // geen voorkeuren hier
      omroeper: form.omroeper || null,
      opmerkingen: form.opmerkingen || null,
    };

    try {
      const { error } = await supabase.from("inschrijvingen").insert(payload);
      if (error) throw error;
      setMsg("Inschrijving opgeslagen ✔️");
      setForm(s => ({ ...s, ruiter:"", paard:"", email:"", telefoon:"", omroeper:"", opmerkingen:"" }));
    } catch (err) {
      setMsg("Fout bij opslaan: " + (err?.message || String(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "24px auto" }}>
      <h2>Inschrijven (beheer)</h2>
      <p style={{ color:"#555" }}>Kies wedstrijd uit de database en voeg inschrijvingen toe. Geen offline opslag meer.</p>

      <form onSubmit={onSubmit} style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "10px 12px", alignItems:"center" }}>
        <label>Wedstrijd*</label>
        <select value={form.wedstrijd_id} onChange={(e)=>setForm(s=>({...s, wedstrijd_id:e.target.value}))} disabled={loading}>
          <option value="">{loading ? "Laden..." : "— kies wedstrijd —"}</option>
          {wedstrijden.map(w => <option key={w.id} value={w.id}>{w.naam} {w.datum ? `(${w.datum})` : ""}</option>)}
        </select>

        <label>Klasse*</label>
        <select value={form.klasse} onChange={(e)=>setForm(s=>({...s, klasse:e.target.value}))}>
          <option value="">— kies klasse —</option>
          {KLASSEN.map(k => <option key={k.code} value={k.code}>{k.label}</option>)}
        </select>

        <label>Ruiter*</label>
        <input value={form.ruiter} onChange={(e)=>setForm(s=>({...s, ruiter:e.target.value}))} />

        <label>Paard*</label>
        <input value={form.paard} onChange={(e)=>setForm(s=>({...s, paard:e.target.value}))} />

        <label>E-mail</label>
        <input type="email" value={form.email} onChange={(e)=>setForm(s=>({...s, email:e.target.value}))} />

        <label>Telefoon</label>
        <input value={form.telefoon} onChange={(e)=>setForm(s=>({...s, telefoon:e.target.value}))} />

        <label>Tekst voor omroeper</label>
        <textarea rows={3} value={form.omroeper} onChange={(e)=>setForm(s=>({...s, omroeper:e.target.value}))} />

        <label>Opmerkingen</label>
        <textarea rows={3} value={form.opmerkingen} onChange={(e)=>setForm(s=>({...s, opmerkingen:e.target.value}))} />

        <div></div>
        <button type="submit" disabled={busy || disabled}>{busy ? "Bezig..." : "Inschrijven"}</button>
      </form>

      {msg && <div style={{ marginTop: 12, padding: 10, background:"#f6ffed", border:"1px solid #b7eb8f", borderRadius: 8 }}>{msg}</div>}
    </div>
  );
}
