
import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";
import { supabase } from "@/lib/supabaseClient";

import { notifyOrganisator } from "@/lib/notifyOrganisator";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Card } from "@/ui/card";
import Container from "@/ui/Container";
import { Alert } from "@/ui/alert";

// Klassen incl. WE2+ en extra klassen voor leeftijdsgroepen
const KLASSEN = [
  { code: "we0",  label: "Introductieklasse (WE0)" },
  { code: "we1",  label: "WE1" },
  { code: "we2",  label: "WE2" },
  { code: "we2p", label: "WE2+" },
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
    weh_lid: false,
    ruiter: "",
    paard: "",
    email: "",
    omroeper: "",
    opmerkingen: "",
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [capacityLimit, setCapacityLimit] = useState(null);
  const [currentCount, setCurrentCount] = useState(null);
  const [capacityLoading, setCapacityLoading] = useState(false);

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

  // when selected wedstrijd + klasse changes, load capacity info and current count
  React.useEffect(() => {
    let mounted = true;
    async function loadCapacity() {
      setCapacityLimit(null);
      setCurrentCount(null);
      if (!gekozenWedstrijd || !form.klasse) return;
      setCapacityLoading(true);
      try {
        const cfg = gekozenWedstrijd.startlijst_config && typeof gekozenWedstrijd.startlijst_config === 'object' ? gekozenWedstrijd.startlijst_config : (gekozenWedstrijd.startlijst_config ? JSON.parse(gekozenWedstrijd.startlijst_config) : null);
        const cap = cfg && cfg.capacities ? (cfg.capacities[form.klasse] ?? null) : null;
        const alternate = cfg && cfg.alternates ? (cfg.alternates[form.klasse] ?? null) : null;
        if (!mounted) return;
        setCapacityLimit(typeof cap === 'number' ? cap : (cap === null ? null : Number(cap)));

        if (cap !== undefined && cap !== null) {
          // count current inscriptions using supabase client for accurate count
          const { count, error } = await supabase
            .from('inschrijvingen')
            .select('id', { count: 'exact', head: true })
            .eq('wedstrijd_id', gekozenWedstrijd.id)
            .eq('klasse', form.klasse);
          if (error) {
            // ignore — we simply won't show count
            setCurrentCount(null);
          } else {
            if (!mounted) return;
            setCurrentCount(count || 0);
          }
        } else {
          setCurrentCount(null);
        }
        // store alternate as a lightweight hint on the gekozen object (not persisted)
        if (alternate) {
          // attach for UI convenience
          setForm(s => ({ ...s })); // trigger re-render
          // we don't mutate gekozenWedstrijd directly
        }
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setCapacityLoading(false);
      }
    }
    loadCapacity();
    return () => { mounted = false; };
  }, [gekozenWedstrijd, form.klasse]);

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
      weh_lid: form.weh_lid ? true : false,
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

      // capacity double-check (client-side). Server should also verify to avoid race conditions.
      try {
        const cfg = gekozenWedstrijd && (gekozenWedstrijd.startlijst_config && typeof gekozenWedstrijd.startlijst_config === 'object') ? gekozenWedstrijd.startlijst_config : (gekozenWedstrijd && gekozenWedstrijd.startlijst_config ? JSON.parse(gekozenWedstrijd.startlijst_config) : null);
        const cap = cfg && cfg.capacities ? (cfg.capacities[payload.klasse] ?? null) : null;
        if (cap !== undefined && cap !== null) {
          const { count, error } = await supabase
            .from('inschrijvingen')
            .select('id', { count: 'exact', head: true })
            .eq('wedstrijd_id', payload.wedstrijd_id)
            .eq('klasse', payload.klasse);
          if (error) throw error;
          if ((count || 0) >= Number(cap)) {
            // if an alternate is configured, suggest it
            const alternate = cfg.alternates ? cfg.alternates[payload.klasse] : null;
            if (alternate) {
              throw new Error(`De klasse is volzet (${count}/${cap}). Er is een alternatieve wedstrijd ingesteld. Kies deze of contacteer de organisatie.`);
            }
            throw new Error(`De klasse is volzet (${count}/${cap}). Neem contact op met de organisatie.`);
          }
        }
      } catch (e) {
        // surface capacity error to user
        throw e;
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
      <Container maxWidth={720}>
        <Card>
          <h2>Dank je wel!</h2>
          <p>
            Je inschrijving is ontvangen
            {gekozenWedstrijd?.naam ? <> voor <b>{gekozenWedstrijd.naam}</b></> : null}.
          </p>
          <p>Je ontvangt binnenkort een bevestiging van inschrijving per e-mail.</p>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth={1100}>
      <h2>Inschrijfformulier Ruiters</h2>
      <p style={{ color: "#555" }}>Velden met * zijn verplicht.</p>

      <Card variant="info" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" }}>
      <form
        onSubmit={onSubmit}
        className="inschrijf-form"
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
          style={{ width: '100%' }}
        />

        <label htmlFor="paard_input">Paard*</label>
        <Input
          id="paard_input"
          value={form.paard}
          onChange={(e) => setForm((s) => ({ ...s, paard: e.target.value }))}
          placeholder="Naam paard"
          style={{ width: '100%' }}
        />

        <label htmlFor="geslacht_select">Geslacht paard</label>
        <select id="geslacht_select" value={form.geslacht_paard} onChange={(e) => setForm((s) => ({ ...s, geslacht_paard: e.target.value }))} style={{ width: '100%' }}>
          <option value="">— kies —</option>
          <option value="merrie">Merrie</option>
          <option value="ruin">Ruin</option>
          <option value="hengst">Hengst</option>
        </select>

  <label htmlFor="leeftijd_input">Leeftijd ruiter (optioneel)</label>
  <Input id="leeftijd_input" type="number" min="1" max="150" value={form.leeftijd_ruiter} onChange={(e)=>setForm(s=>({...s, leeftijd_ruiter: e.target.value}))} placeholder="Bijv. 32" style={{ width: '100%' }} />

        <label htmlFor="email_input">E-mail*</label>
        <Input
          id="email_input"
          type="email"
          value={form.email}
          onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
          placeholder="jij@example.com"
          style={{ width: '100%' }}
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
          style={{ width: '100%' }}
        />

        <label htmlFor="opmerkingen_input">Opmerkingen (optioneel)</label>
        <textarea
          id="opmerkingen_input"
          rows={3}
          value={form.opmerkingen}
          onChange={(e) => setForm((s) => ({ ...s, opmerkingen: e.target.value }))}
          placeholder="Speciale wensen/stal"
          className="border rounded px-2 py-1 w-full"
          style={{ width: '100%' }}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }} htmlFor="weh_lid_cb">
          <input id="weh_lid_cb" type="checkbox" checked={form.weh_lid} onChange={(e) => setForm(s => ({ ...s, weh_lid: e.target.checked }))} />
          <span>WEH-lid</span>
        </label>

        <div className="full"></div>
        <div className="full" style={{ textAlign: 'right' }}>
          <Button type="submit" disabled={busy || disabled} aria-busy={busy}>{busy ? "Verzenden..." : "Inschrijven"}</Button>
        </div>
      </form>
    </Card>
      
  {capacityLoading && <div style={{ marginTop: 8, color: '#666' }}>Controleren beschikbare plaatsen…</div>}

  {capacityLimit !== null && currentCount !== null && (
    <div style={{ marginTop: 10 }}>
      {currentCount >= capacityLimit ? (
        <Alert type="error">De geselecteerde klasse is volzet ({currentCount}/{capacityLimit}).</Alert>
      ) : (
        <div style={{ color: '#333', fontSize: 13 }}>Beschikbare plaatsen: {capacityLimit - currentCount} van {capacityLimit} beschikbaar.</div>
      )}
    </div>
  )}

  {err && <Alert type="error">{String(err)}</Alert>}
    </Container>
  );
}
