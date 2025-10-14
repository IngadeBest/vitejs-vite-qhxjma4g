import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const KLASSEN = [
  { code: "we0", label: "Introductieklasse (WE0)" },
  { code: "we1", label: "WE1" },
  { code: "we2", label: "WE2" },
  { code: "we3", label: "WE3" },
  { code: "we4", label: "WE4" },
];

export default function InschrijfFormulier() {
  const [form, setForm] = useState({
    wedstrijd: "",
    klasse: "",
    ruiter: "",
    paard: "",
    email: "",
    telefoon: "",
    voorkeur_tijd: "",
    opmerkingen: "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const disabled = useMemo(() => {
    return !form.ruiter || !form.paard || !form.klasse || !form.wedstrijd;
  }, [form]);

  async function bewaarLocalFallback(data) {
    const key = "wp_inschrijvingen";
    const cur = JSON.parse(localStorage.getItem(key) || "[]");
    cur.push({ ...data, id: "local-" + Date.now() });
    localStorage.setItem(key, JSON.stringify(cur));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const payload = {
      wedstrijd: form.wedstrijd,
      klasse: form.klasse,
      ruiter: form.ruiter,
      paard: form.paard,
      email: form.email || null,
      telefoon: form.telefoon || null,
      voorkeur_tijd: form.voorkeur_tijd || null,
      opmerkingen: form.opmerkingen || null,
    };
    try {
      if (!supabase) throw new Error("Geen supabase client");
      const { error } = await supabase.from("inschrijvingen").insert(payload);
      if (error) throw error;
      setMsg("Inschrijving opgeslagen ✔️");
    } catch (err) {
      await bewaarLocalFallback(payload);
      setMsg("Opgeslagen in lokale opslag (offline) ✔️");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 740, margin: "24px auto" }}>
      <h2>Inschrijven</h2>
      <p style={{ color:"#555" }}>Vul hieronder de gegevens in. Deze inschrijvingen kun je vervolgens op de pagina <b>Startlijst</b> omzetten naar een startvolgorde en exporteren naar de <b>Protocollen</b>.</p>
      <form onSubmit={onSubmit} style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "10px 12px", alignItems:"center" }}>
        <label>Wedstrijd*</label>
        <input value={form.wedstrijd} onChange={(e)=>setForm(s=>({...s, wedstrijd:e.target.value}))} placeholder="Bijv. WE De Driesporen 29-06-2025" />

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

        <label>Voorkeur starttijd</label>
        <input placeholder="Bijv. na 11:00 ivm paard" value={form.voorkeur_tijd} onChange={(e)=>setForm(s=>({...s, voorkeur_tijd:e.target.value}))} />

        <label>Opmerkingen</label>
        <textarea rows={3} value={form.opmerkingen} onChange={(e)=>setForm(s=>({...s, opmerkingen:e.target.value}))} />

        <div></div>
        <button type="submit" disabled={busy || disabled}>{busy ? "Bezig..." : "Inschrijven"}</button>
      </form>

      {msg && <div style={{ marginTop: 12, padding: 10, background:"#f6ffed", border:"1px solid #b7eb8f", borderRadius: 8 }}>{msg}</div>}

      <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
        <a href="#/startlijst"><button>Ga naar Startlijst</button></a>
        <a href="#/protocollen"><button>Ga naar Protocollen</button></a>
      </div>
    </div>
  );
}
