
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";
import { supabase } from "@/lib/supabaseClient";

import { notifyOrganisator } from "@/lib/notifyOrganisator";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Card } from "@/ui/card";
import Container from "@/ui/Container";
import { Alert } from "@/ui/alert";
import "./PublicInschrijven.css";

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

function toDateKey(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return trimmed.slice(0, 10);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isPastWedstrijd(wedstrijd) {
  if (!wedstrijd) return false;
  const wedstrijdDate = toDateKey(wedstrijd.datum);
  if (!wedstrijdDate) return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return wedstrijdDate < today;
}

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
  const [totaalCapacityLimit, setTotaalCapacityLimit] = useState(null);
  const [totaalCurrentCount, setTotaalCurrentCount] = useState(null);
  const [capacityLoading, setCapacityLoading] = useState(false);
  const [showWachtlijst, setShowWachtlijst] = useState(false);
  const [wachtlijstBusy, setWachtlijstBusy] = useState(false);
  const [wachtlijstDone, setWachtlijstDone] = useState(false);

  const gekozenWedstrijd = useMemo(
    () => wedstrijden.find((w) => w.id === form.wedstrijd_id) || null,
    [wedstrijden, form.wedstrijd_id]
  );
  const queryWedstrijdBestaat = useMemo(
    () => !!qId && wedstrijden.some((w) => w.id === qId),
    [wedstrijden, qId]
  );
  const wedstrijdNietBeschikbaar = !!form.wedstrijd_id && !gekozenWedstrijd;

  useEffect(() => {
    if (qId && queryWedstrijdBestaat) {
      if (form.wedstrijd_id !== qId) {
        setForm((prev) => ({ ...prev, wedstrijd_id: qId }));
      }
      return;
    }
    if (form.wedstrijd_id) return;
    if (!wedstrijden?.length) return;
    setForm((prev) => ({ ...prev, wedstrijd_id: wedstrijden[0].id }));
  }, [form.wedstrijd_id, qId, wedstrijden, queryWedstrijdBestaat]);

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
      setTotaalCapacityLimit(null);
      setTotaalCurrentCount(null);
      if (!gekozenWedstrijd || !form.klasse) return;
      setCapacityLoading(true);
      try {
        const cfg = gekozenWedstrijd.startlijst_config && typeof gekozenWedstrijd.startlijst_config === 'object' ? gekozenWedstrijd.startlijst_config : (gekozenWedstrijd.startlijst_config ? JSON.parse(gekozenWedstrijd.startlijst_config) : null);
        
        // Laad totaal capaciteit
        if (cfg && cfg.totaalMaximum !== undefined && cfg.totaalMaximum !== null) {
          const totaalMax = Number(cfg.totaalMaximum);
          const { count: totaalCount, error: totaalError } = await supabase
            .from('inschrijvingen')
            .select('id', { count: 'exact', head: true })
            .eq('wedstrijd_id', gekozenWedstrijd.id);
          if (!totaalError && mounted) {
            setTotaalCapacityLimit(totaalMax);
            setTotaalCurrentCount(totaalCount || 0);
          }
        }
        
        // Laad per-klasse capaciteit
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
    if (wedstrijdNietBeschikbaar) return true;
    // Check if wedstrijd is gesloten or concept
    if (gekozenWedstrijd && (gekozenWedstrijd.status === 'gesloten' || gekozenWedstrijd.status === 'concept')) {
      return true;
    }
    if (gekozenWedstrijd && isPastWedstrijd(gekozenWedstrijd)) {
      return true;
    }
    if (!form.wedstrijd_id || !form.klasse) return true;
    if (!form.ruiter || !form.paard || !form.email) return true;
    // leeftijd_ruiter is optional but if present must be a positive integer
    if (form.leeftijd_ruiter && !/^[0-9]{1,3}$/.test(String(form.leeftijd_ruiter))) return true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return true;
    return false;
  }, [form, gekozenWedstrijd, wedstrijdNietBeschikbaar]);

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
      rubriek: "Algemeen", // Default rubriek voor publieke inschrijvingen
    };

    try {
      if (!gekozenWedstrijd) {
        throw new Error("Deze wedstrijd is niet (meer) beschikbaar voor inschrijving.");
      }
      if (isPastWedstrijd(gekozenWedstrijd)) {
        throw new Error("Inschrijven voor deze wedstrijd is niet meer mogelijk omdat de datum al voorbij is.");
      }

      // client validation
      if (gekozenWedstrijd) {
        if (!allowedKlassenForWedstrijd.includes(payload.klasse)) throw new Error('Geselecteerde klasse is niet toegestaan voor deze wedstrijd.');
      }

      // capacity double-check (client-side). Server should also verify to avoid race conditions.
      try {
        const cfg = gekozenWedstrijd && (gekozenWedstrijd.startlijst_config && typeof gekozenWedstrijd.startlijst_config === 'object') ? gekozenWedstrijd.startlijst_config : (gekozenWedstrijd && gekozenWedstrijd.startlijst_config ? JSON.parse(gekozenWedstrijd.startlijst_config) : null);
        
        // Check totaal maximum voor hele wedstrijd
        if (cfg && cfg.totaalMaximum !== undefined && cfg.totaalMaximum !== null) {
          const { count: totaalCount, error: totaalError } = await supabase
            .from('inschrijvingen')
            .select('id', { count: 'exact', head: true })
            .eq('wedstrijd_id', payload.wedstrijd_id);
          if (totaalError) throw totaalError;
          if ((totaalCount || 0) >= Number(cfg.totaalMaximum)) {
            // Check if wachtlijst is enabled
            if (gekozenWedstrijd.wachtlijst_enabled) {
              setShowWachtlijst(true);
              throw new Error(`De wedstrijd is volledig volzet (${totaalCount}/${cfg.totaalMaximum} deelnemers). Je kunt je op de wachtlijst plaatsen.`);
            }
            throw new Error(`De wedstrijd is volledig volzet (${totaalCount}/${cfg.totaalMaximum} deelnemers). Neem contact op met de organisatie.`);
          }
        }
        
        // Check per-klasse capaciteit
        const cap = cfg && cfg.capacities ? (cfg.capacities[payload.klasse] ?? null) : null;
        if (cap !== undefined && cap !== null) {
          const { count, error } = await supabase
            .from('inschrijvingen')
            .select('id', { count: 'exact', head: true })
            .eq('wedstrijd_id', payload.wedstrijd_id)
            .eq('klasse', payload.klasse);
          if (error) throw error;
          if ((count || 0) >= Number(cap)) {
            // Check if wachtlijst is enabled
            if (gekozenWedstrijd.wachtlijst_enabled) {
              setShowWachtlijst(true);
              throw new Error(`De klasse is volzet (${count}/${cap}). Je kunt je op de wachtlijst plaatsen.`);
            }
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
        // Check if wachtlijst is enabled for this error
        if ((json.error === 'WEDSTRIJD_VOLZET_WACHTLIJST' || json.error === 'KLASSE_VOLZET_WACHTLIJST') && json.wachtlijst_enabled) {
          setShowWachtlijst(true);
        }
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

  async function onWachtlijstSubmit(e) {
    e.preventDefault();
    setWachtlijstBusy(true);
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
      telefoon: form.telefoon?.trim() || null,
      opmerkingen: form.opmerkingen?.trim() || null,
      omroeper: form.omroeper?.trim() || null,
    };

    try {
      const res = await fetch('/api/wachtlijst', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      const json = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        const msg = json.message || json.error || 'Toevoegen aan wachtlijst mislukt';
        throw new Error(msg);
      }

      setWachtlijstDone(true);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setWachtlijstBusy(false);
    }
  }

  if (wachtlijstDone) {
    return (
      <Container maxWidth={820}>
        <Card className="pi-result-card">
          <h2>Je staat op de wachtlijst! 📋</h2>
          <p>
            Je bent toegevoegd aan de wachtlijst voor <b>{gekozenWedstrijd?.naam}</b> - klasse <b>{form.klasse}</b>.
          </p>
          <p>
            Je ontvangt een e-mail als er een plek vrijkomt. De organisator kan je ook rechtstreeks contacteren.
          </p>
          <Button onClick={() => { setWachtlijstDone(false); setShowWachtlijst(false); setForm(f => ({ ...f, wedstrijd_id: "", klasse: "" })); }}>
            Nieuwe inschrijving
          </Button>
        </Card>
      </Container>
    );
  }

  if (done) {
    return (
      <Container maxWidth={820}>
        <Card className="pi-result-card">
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
    <Container maxWidth={980}>
      <section className="pi-public-shell">
        <header className="pi-hero">
          <div>
            <div className="pi-kicker">Working Point</div>
            <h1>Inschrijfformulier Ruiters</h1>
            <p>Schrijf je in voor de geselecteerde wedstrijd. Velden met * zijn verplicht.</p>
          </div>
          <div className="pi-hero-badges">
            <div className="pi-badge">{wedstrijden.length} wedstrijd(en) open</div>
            {gekozenWedstrijd?.datum && <div className="pi-badge pi-badge-soft">Datum: {gekozenWedstrijd.datum}</div>}
          </div>
        </header>

      {/* Status controle */}
      {gekozenWedstrijd && gekozenWedstrijd.status === 'gesloten' && (
        <Alert variant="warning" style={{ marginBottom: "20px" }}>
          <h3>Inschrijvingen gesloten</h3>
          <p>Inschrijvingen voor <strong>{gekozenWedstrijd.naam}</strong> op {gekozenWedstrijd.datum} zijn gesloten. 
          Contact de organisatie voor meer informatie.</p>
        </Alert>
      )}

      {gekozenWedstrijd && gekozenWedstrijd.status === 'concept' && (
        <Alert variant="info" style={{ marginBottom: "20px" }}>
          <h3>Wedstrijd in voorbereiding</h3>
          <p><strong>{gekozenWedstrijd.naam}</strong> is nog in voorbereiding. Inschrijvingen zijn nog niet geopend.</p>
        </Alert>
      )}

      {wedstrijdNietBeschikbaar && (
        <Alert type="warning" className="pi-section-gap">
          De gekozen wedstrijd is niet meer beschikbaar. Kies een andere open wedstrijd.
        </Alert>
      )}

      <Card className="pi-form-card">
      <form
        onSubmit={onSubmit}
        className="pi-public-form"
      >
        <label htmlFor="wedstrijd_select">Wedstrijd*</label>
        <select
          id="wedstrijd_select"
          value={form.wedstrijd_id}
          onChange={(e) => setForm((s) => ({ ...s, wedstrijd_id: e.target.value }))}
          disabled={loading || queryWedstrijdBestaat}
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
        <div className="pi-inline-note" style={{ color: form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? "crimson" : "#666" }}>
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

        <div className="pi-form-actions">
          {showWachtlijst ? (
            <div className="pi-actions-inline">
              <Button 
                type="button" 
                onClick={() => setShowWachtlijst(false)}
                style={{ background: '#888' }}
              >
                Annuleren
              </Button>
              <Button 
                type="button" 
                onClick={onWachtlijstSubmit} 
                disabled={wachtlijstBusy || disabled}
                style={{ background: '#ff9800' }}
              >
                {wachtlijstBusy ? "Bezig..." : "📋 Plaatsen op wachtlijst"}
              </Button>
            </div>
          ) : (
            <Button type="submit" disabled={busy || disabled} aria-busy={busy}>
              {busy ? "Verzenden..." : "Inschrijven"}
            </Button>
          )}
        </div>
      </form>
    </Card>

    {showWachtlijst && !wachtlijstBusy && (
      <Alert type="info" className="pi-section-gap">
        <strong>📋 Wachtlijst</strong>
        <p className="pi-alert-copy">
          Deze wedstrijd of klasse is vol. Je kunt je op de wachtlijst plaatsen en wordt gecontacteerd als er een plek vrijkomt.
        </p>
      </Alert>
    )}
      
  {capacityLoading && <div className="pi-section-gap pi-muted">Controleren beschikbare plaatsen…</div>}

  {totaalCapacityLimit !== null && totaalCurrentCount !== null && (
    <div className="pi-capacity-box pi-section-gap">
      {totaalCurrentCount >= totaalCapacityLimit ? (
        <Alert type="error">De wedstrijd is volledig volzet ({totaalCurrentCount}/{totaalCapacityLimit} deelnemers).</Alert>
      ) : (
        <div className="pi-capacity-copy">
          Wedstrijd capaciteit: {totaalCapacityLimit - totaalCurrentCount} van {totaalCapacityLimit} plaatsen beschikbaar
        </div>
      )}
    </div>
  )}

  {capacityLimit !== null && currentCount !== null && (
    <div className="pi-section-gap">
      {currentCount >= capacityLimit ? (
        <Alert type="error">De geselecteerde klasse is volzet ({currentCount}/{capacityLimit}).</Alert>
      ) : (
        <div className="pi-capacity-copy">Beschikbare plaatsen in klasse: {capacityLimit - currentCount} van {capacityLimit} beschikbaar.</div>
      )}
    </div>
  )}

  {err && <Alert type="error">{String(err)}</Alert>}
      </section>
    </Container>
  );
}
