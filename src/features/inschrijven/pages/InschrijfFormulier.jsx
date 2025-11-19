import React, { useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useWedstrijden } from "./hooks/useWedstrijden";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Card } from "@/ui/card";
import { Alert } from "@/ui/alert";

const KLASSEN = [
  { code: "we0", label: "Introductieklasse (WE0)" },
  { code: "we1", label: "WE1" },
  { code: "we2", label: "WE2" },
  { code: "we3", label: "WE3" },
  { code: "we4", label: "WE4" },
];

export default function InschrijfFormulier({ initialWedstrijdId = '', onSaved = null }) {
  const { items: wedstrijden, loading } = useWedstrijden(false);

  const [form, setForm] = useState({
    wedstrijd_id: initialWedstrijdId || "",
    klasse: "",
    ruiter: "",
    paard: "",
    email: "",
    telefoon: "",
    omroeper: "",
    opmerkingen: "",
    rubriek: "Algemeen", // Default value for rubriek - matches database constraint
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const firstInputRef = useRef(null);

  const disabled = useMemo(() => {
    return !form.ruiter || !form.paard || !form.klasse || !form.wedstrijd_id;
  }, [form]);

  const gekozenWedstrijd = useMemo(() => wedstrijden.find(w => w.id === form.wedstrijd_id) || null, [wedstrijden, form.wedstrijd_id]);

  const allowedKlassenForWedstrijd = useMemo(() => {
    if (!gekozenWedstrijd) return KLASSEN.map(k=>k.code);
    return Array.isArray(gekozenWedstrijd.allowed_klassen) && gekozenWedstrijd.allowed_klassen.length ? gekozenWedstrijd.allowed_klassen : KLASSEN.map(k=>k.code);
  }, [gekozenWedstrijd]);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");

    const wedstrijdObj = wedstrijden.find(w => w.id === form.wedstrijd_id);
    const payload = {
      wedstrijd_id: form.wedstrijd_id,
      wedstrijd: wedstrijdObj ? wedstrijdObj.naam : null, // denormalized voor leesbaarheid
      klasse: form.klasse,
      rubriek: form.rubriek || "Algemeen", // Always provide a rubriek value, default to "Algemeen"
      ruiter: form.ruiter,
      paard: form.paard,
      email: form.email || null,
      telefoon: form.telefoon || null,
      voorkeur_tijd: null, // geen voorkeuren hier
      omroeper: form.omroeper || null,
      opmerkingen: form.opmerkingen || null,
    };

    try {
      // client-side validation: ensure class allowed for selected wedstrijd
      if (gekozenWedstrijd && !allowedKlassenForWedstrijd.includes(payload.klasse)) {
        throw new Error('Geselecteerde klasse is niet toegestaan voor deze wedstrijd.');
      }
      // Try insert. If DB schema lacks 'rubriek' column, retry without it and inform the admin.
      let res = await supabase.from("inschrijvingen").insert(payload);
      let error = res?.error;
      if (error && /rubriek|column .* does not exist/i.test(String(error.message || error))) {
        // retry without rubriek
        const payload2 = { ...payload };
        delete payload2.rubriek;
        const retry = await supabase.from("inschrijvingen").insert(payload2);
        if (retry?.error) throw retry.error;
        // success but inform admin
        setMsg("Inschrijving opgeslagen ✔️ (let op: database mist kolom 'rubriek' — voer de migratie uit voor volledige ondersteuning)");
        // notify parent
        try { if (typeof onSaved === 'function') onSaved(payload2); } catch (e) { /* ignore */ }
        setForm(s => ({ ...s, ruiter:"", paard:"", email:"", telefoon:"", omroeper:"", opmerkingen:"" }));
        setBusy(false);
        return;
      }
      if (error) throw error;
  setMsg("Inschrijving opgeslagen ✔️");
  setForm(s => ({ ...s, ruiter:"", paard:"", email:"", telefoon:"", omroeper:"", opmerkingen:"" }));
  // focus first input for faster next entry
  setTimeout(() => firstInputRef.current?.focus?.(), 50);
  // notify parent if provided (e.g. Startlijst wants to reload rows)
  try { if (typeof onSaved === 'function') onSaved(payload); } catch (e) { /* ignore */ }
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

      <Card>
      <form onSubmit={onSubmit} style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "10px 12px", alignItems:"center" }}>
        <label htmlFor="wedstrijd_select">Wedstrijd*</label>
        <select id="wedstrijd_select" value={form.wedstrijd_id} onChange={(e)=>setForm(s=>({...s, wedstrijd_id:e.target.value}))} disabled={loading}>
          <option value="">{loading ? "Laden..." : "— kies wedstrijd —"}</option>
          {wedstrijden.map(w => <option key={w.id} value={w.id}>{w.naam} {w.datum ? `(${w.datum})` : ""}</option>)}
        </select>

        <label htmlFor="klasse_select">Klasse*</label>
        <select id="klasse_select" value={form.klasse} onChange={(e)=>setForm(s=>({...s, klasse:e.target.value}))}>
          <option value="">— kies klasse —</option>
          {KLASSEN.map(k => <option key={k.code} value={k.code}>{k.label}</option>)}
        </select>

        {/** Only show rubriek select if this wedstrijd allows jeugd for the selected klasse */}
        {(() => {
          const wedstrijd = gekozenWedstrijd || {};
          const startlijstConfig = (wedstrijd.startlijst_config) || {};
          const jeugdAllowed = (startlijstConfig.jeugdAllowed && startlijstConfig.jeugdAllowed[form.klasse]) || false;
          if (!jeugdAllowed) {
            return null;
          }
          return (
            <>
              <label htmlFor="rubriek_select">Rubriek</label>
              <select id="rubriek_select" value={form.rubriek} onChange={(e)=>setForm(s=>({...s, rubriek:e.target.value}))}>
                <option value="Algemeen">Algemeen</option>
                <option value="Senior">Senior</option>
                <option value="Jeugd">Jeugd</option>
              </select>
            </>
          );
        })()}

        <label htmlFor="ruiter_input">Ruiter*</label>
        <Input id="ruiter_input" ref={firstInputRef} value={form.ruiter} onChange={(e)=>setForm(s=>({...s, ruiter:e.target.value}))} />

        <label htmlFor="paard_input">Paard*</label>
        <Input id="paard_input" value={form.paard} onChange={(e)=>setForm(s=>({...s, paard:e.target.value}))} />

        <label htmlFor="email_input">E-mail</label>
        <Input id="email_input" type="email" value={form.email} onChange={(e)=>setForm(s=>({...s, email:e.target.value}))} />

        <label htmlFor="telefoon_input">Telefoon</label>
        <Input id="telefoon_input" value={form.telefoon} onChange={(e)=>setForm(s=>({...s, telefoon:e.target.value}))} />

        <label htmlFor="omroeper_input">Tekst voor omroeper</label>
        <textarea id="omroeper_input" rows={3} value={form.omroeper} onChange={(e)=>setForm(s=>({...s, omroeper:e.target.value}))} className="border rounded px-2 py-1 w-full" />

        <label htmlFor="opmerkingen_input">Opmerkingen</label>
        <textarea id="opmerkingen_input" rows={3} value={form.opmerkingen} onChange={(e)=>setForm(s=>({...s, opmerkingen:e.target.value}))} className="border rounded px-2 py-1 w-full" />

        <div></div>
        <Button type="submit" disabled={busy || disabled}>{busy ? "Bezig..." : "Inschrijven"}</Button>
      </form>
      </Card>

  {msg && <Alert type={msg.startsWith('Fout') ? 'error' : 'success'}>{msg}</Alert>}
    </div>
  );
}
