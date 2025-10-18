import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";
import { notifyOrganisator } from "@/lib/notifyOrganisator";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Card } from "@/ui/card";
import { Alert } from "@/ui/alert";

// Klassen incl. WE2+ en extra klassen voor leeftijdsgroepen
const KLASSEN = [
  { code: "we0",  label: "Introductieklasse (WE0)" },
  { code: "we1",  label: "WE1" },
  { code: "we2",  label: "WE2" },
  { code: "we2+", label: "WE2+" },
  { code: "we3",  label: "WE3" },
  { code: "we4",  label: "WE4" },
  { code: "yr",   label: "Young Riders" },
  { code: "junior", label: "Junioren" },
];

export default function PublicInschrijven() {
  const { items: wedstrijden, loading } = useWedstrijden(true);
  const [sp] = useSearchParams();
  const qId = sp.get("wedstrijdId") || "";

  const [form, setForm] = useState({
    wedstrijd_id: qId || "",
    klasse: "",
  // categorie removed — we now use klasstype only
    leeftijd_ruiter: "",
    geslacht_paard: "",
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
    () => wedstrijden.find((w) => w.id === form.wedstrijd_id) || null,
    [wedstrijden, form.wedstrijd_id]
  );

  const allowedKlassenForWedstrijd = useMemo(() => {
    if (!gekozenWedstrijd) return KLASSEN.map((k) => k.code);
    return Array.isArray(gekozenWedstrijd.allowed_klassen) && gekozenWedstrijd.allowed_klassen.length
      ? gekozenWedstrijd.allowed_klassen
      : KLASSEN.map((k) => k.code);
  }, [gekozenWedstrijd]);

  // categorie removed, no per-klasse categorieen to enforce

  const disabled = useMemo(() => {
  if (!form.wedstrijd_id || !form.klasse) return true;
    if (!form.ruiter || !form.paard || !form.email) return true;
    // leeftijd_ruiter is optional but if present must be a positive integer
    if (form.leeftijd_ruiter && !/^[0-9]{1,3}$/.test(String(form.leeftijd_ruiter))) return true;
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
      klasse: form.klasse,
      leeftijd_ruiter: form.leeftijd_ruiter ? Number(form.leeftijd_ruiter) : null,
      geslacht_paard: form.geslacht_paard || null,
      ruiter: form.ruiter?.trim(),
      paard: form.paard?.trim(),
      email: form.email?.trim(),
      opmerkingen: form.opmerkingen?.trim() || null,
      omroeper: form.omroeper?.trim() || null,
      voorkeur_tijd: null,
    };

    try {
      // client validation
      if (gekozenWedstrijd) {
        if (!allowedKlassenForWedstrijd.includes(payload.klasse)) throw new Error('Geselecteerde klasse is niet toegestaan voor deze wedstrijd.');
      }

      const res = await fetch('/api/inschrijvingen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const text = await res.text().catch(() => '');
      let json = {};
      try { json = text ? JSON.parse(text) : {}; } catch (e) { json = { raw: text }; }
      if (!res.ok) {
        const msg = (json && json.message) ? json.message : (json.error || (json.raw ? String(json.raw) : 'Opslaan mislukt'));
        throw new Error(`API ${res.status}: ${msg}`);
      }

      // best effort notify via existing client helper (still useful)
      try { await notifyOrganisator({ wedstrijd: gekozenWedstrijd, inschrijving: payload }); } catch (e) { /* ignore */ }

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
        <Card>
          <h2>Dank je wel!</h2>
          <p>
            Je inschrijving is ontvangen
            {gekozenWedstrijd?.naam ? <> voor <b>{gekozenWedstrijd.naam}</b></> : null}.
          </p>
          <p>Je ontvangt binnenkort een bevestiging van inschrijving per e-mail.</p>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: "24px auto" }}>
      <h2>Inschrijfformulier Ruiters</h2>
      <p style={{ color: "#555" }}>Velden met * zijn verplicht.</p>

      <Card variant="info" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" }}>
      <form
        onSubmit={onSubmit}
        style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "10px 12px", alignItems: "center" }}
      >
        <label htmlFor="wedstrijd_select">Wedstrijd*</label>
        <select
          id="wedstrijd_select"
          value={form.wedstrijd_id}
          onChange={(e) => setForm((s) => ({ ...s, wedstrijd_id: e.target.value }))}
          disabled={loading || !!qId}
        >
          <option value="">{loading ? "Laden..." : "— kies een wedstrijd —"}</option>
          {wedstrijden.map((w) => (
            <option key={w.id} value={w.id}>
              {w.naam} {w.datum ? `(${w.datum})` : ""}
            </option>
          ))}
        </select>

        <label htmlFor="klasse_select">Klasse*</label>
        <select
          id="klasse_select"
          value={form.klasse}
          onChange={(e) => setForm((s) => ({ ...s, klasse: e.target.value }))}
        >
          <option value="">— kies klasse —</option>
          {KLASSEN.filter((k) => allowedKlassenForWedstrijd.includes(k.code)).map((k) => (
            <option key={k.code} value={k.code}>
              {k.label}
            </option>
          ))}
        </select>

        {/* categorie removed — we only select klasse now */}

        <label htmlFor="ruiter_input">Ruiter (volledige naam)*</label>
        <Input
          id="ruiter_input"
          value={form.ruiter}
          onChange={(e) => setForm((s) => ({ ...s, ruiter: e.target.value }))}
          placeholder="Naam ruiter"
        />

        <label htmlFor="paard_input">Paard*</label>
        <Input
          id="paard_input"
          value={form.paard}
          onChange={(e) => setForm((s) => ({ ...s, paard: e.target.value }))}
          placeholder="Naam paard"
        />

        <label htmlFor="geslacht_select">Geslacht paard</label>
        <select id="geslacht_select" value={form.geslacht_paard} onChange={(e) => setForm((s) => ({ ...s, geslacht_paard: e.target.value }))}>
          <option value="">— kies —</option>
          <option value="merrie">Merrie</option>
          <option value="ruin">Ruin</option>
          <option value="hengst">Hengst</option>
        </select>

        <label htmlFor="leeftijd_input">Leeftijd ruiter (optioneel)</label>
        <Input id="leeftijd_input" type="number" min="1" max="150" value={form.leeftijd_ruiter} onChange={(e)=>setForm(s=>({...s, leeftijd_ruiter: e.target.value}))} placeholder="Bijv. 32" />

        <label htmlFor="email_input">E-mail*</label>
        <Input
          id="email_input"
          type="email"
          value={form.email}
          onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
          placeholder="jij@example.com"
        />
        {/* inline validation */}
        <div style={{ gridColumn: "2 / 3", color: form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? "crimson" : "#666", fontSize: 13 }}>
          {form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? "Voer een geldig e-mailadres in." : ""}
        </div>

        <label htmlFor="omroeper_input">Tekst voor de omroeper (optioneel)</label>
        <textarea
          id="omroeper_input"
          rows={4}
          value={form.omroeper}
          onChange={(e) => setForm((s) => ({ ...s, omroeper: e.target.value }))}
          placeholder="Korte introductie / bijzonderheden"
          className="border rounded px-2 py-1 w-full"
        />

        <label htmlFor="opmerkingen_input">Opmerkingen (optioneel)</label>
        <textarea
          id="opmerkingen_input"
          rows={3}
          value={form.opmerkingen}
          onChange={(e) => setForm((s) => ({ ...s, opmerkingen: e.target.value }))}
          placeholder="Bijv. speciale wensen / opmerkingen"
          className="border rounded px-2 py-1 w-full"
        />

        <div></div>
        <Button type="submit" disabled={busy || disabled} aria-busy={busy}>{busy ? "Verzenden..." : "Inschrijven"}</Button>
      </form>
      </Card>

  {err && <Alert type="error">{String(err)}</Alert>}
    </div>
  );
}
