import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";
import { notifyOrganisator } from "@/lib/notifyOrganisator";

// Klassen incl. WE2+
const KLASSEN = [
  { code: "we0",  label: "Introductieklasse (WE0)" },
  { code: "we1",  label: "WE1" },
  { code: "we2",  label: "WE2" },
  { code: "we2+", label: "WE2+" },
  { code: "we3",  label: "WE3" },
  { code: "we4",  label: "WE4" },
];

const CATS = [
  { code: "senior", label: "Senioren" },
  { code: "yr",     label: "Young Riders" },
  { code: "junior", label: "Junioren" },
];

export default function PublicInschrijven() {
  const { items: wedstrijden, loading } = useWedstrijden(true);
  const [sp] = useSearchParams();
  const qId = sp.get("wedstrijdId") || "";

  const [form, setForm] = useState({
    wedstrijd_id: qId || "",
    klasse: "",
    categorie: "senior",
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

  const disabled = useMemo(() => {
    if (!form.wedstrijd_id || !form.klasse) return true;
    if (!form.ruiter || !form.paard || !form.email) return true;
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
      categorie: form.categorie,
      ruiter: form.ruiter?.trim(),
      paard: form.paard?.trim(),
      email: form.email?.trim(),
      opmerkingen: form.opmerkingen?.trim() || null,
      omroeper: form.omroeper?.trim() || null,
      voorkeur_tijd: null, // bewust niet in gebruik
    };

    try {
      // Opslaan
      const { error } = await supabase.from("inschrijvingen").insert(payload);
      if (error) throw error;

      // Mail organisator (via env of wedstrijd.organistor_email)
      try {
        await notifyOrganisator({
          wedstrijd: gekozenWedstrijd,   // { id, naam, organisator_email } indien beschikbaar
          inschrijving: { ...payload },
        });
      } catch (mailErr) {
        console.warn("notifyOrganisator error:", mailErr);
      }

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
        <p>
          Je inschrijving is ontvangen
          {gekozenWedstrijd?.naam ? <> voor <b>{gekozenWedstrijd.naam}</b></> : null}.
        </p>
        <p>Je ontvangt binnenkort een bevestiging van inschrijving per e-mail.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: "24px auto" }}>
      <h2>Inschrijfformulier Ruiters</h2>
      <p style={{ color: "#555" }}>Velden met * zijn verplicht. Er is geen voorkeur starttijd veld.</p>

      <form
        onSubmit={onSubmit}
        style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "10px 12px", alignItems: "center" }}
      >
        <label>Wedstrijd*</label>
        <select
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

        <label>Klasse*</label>
        <select
          value={form.klasse}
          onChange={(e) => setForm((s) => ({ ...s, klasse: e.target.value }))}
        >
          <option value="">— kies klasse —</option>
          {KLASSEN.map((k) => (
            <option key={k.code} value={k.code}>
              {k.label}
            </option>
          ))}
        </select>

        <label>Categorie*</label>
        <select
          value={form.categorie}
          onChange={(e) => setForm((s) => ({ ...s, categorie: e.target.value }))}
        >
          {CATS.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>

        <label>Ruiter (volledige naam)*</label>
        <input
          value={form.ruiter}
          onChange={(e) => setForm((s) => ({ ...s, ruiter: e.target.value }))}
          placeholder="Naam ruiter"
        />

        <label>Paard*</label>
        <input
          value={form.paard}
          onChange={(e) => setForm((s) => ({ ...s, paard: e.target.value }))}
          placeholder="Naam paard"
        />

        <label>E-mail*</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
          placeholder="jij@example.com"
        />

        <label>Tekst voor de omroeper (optioneel)</label>
        <textarea
          rows={4}
          value={form.omroeper}
          onChange={(e) => setForm((s) => ({ ...s, omroeper: e.target.value }))}
          placeholder="Korte introductie / bijzonderheden"
        />

        <label>Opmerkingen (optioneel)</label>
        <textarea
          rows={3}
          value={form.opmerkingen}
          onChange={(e) => setForm((s) => ({ ...s, opmerkingen: e.target.value }))}
          placeholder="Bijv. speciale wensen / opmerkingen"
        />

        <div></div>
        <button type="submit" disabled={busy || disabled}>
          {busy ? "Verzenden..." : "Inschrijven"}
        </button>
      </form>

      {err && <div style={{ marginTop: 12, color: "crimson" }}>{String(err)}</div>}
    </div>
  );
}
