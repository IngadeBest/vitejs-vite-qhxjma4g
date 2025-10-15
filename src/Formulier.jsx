
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const KLASSEN = [
  { code: "we0", label: "Introductieklasse (WE0)" },
  { code: "we1", label: "WE1" },
  { code: "we2", label: "WE2" },
  { code: "we3", label: "WE3" },
  { code: "we4", label: "WE4" },
];

function useQuery() {
  const [params, setParams] = useState(new URLSearchParams(location.search));
  useEffect(() => {
    const onPop = () => setParams(new URLSearchParams(location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return params;
}

export default function Formulier() {
  const q = useQuery();
  const qWedstrijdId = q.get("wedstrijdId") || "";
  const [wedstrijden, setWedstrijden] = useState([]);
  const [loadingWed, setLoadingWed] = useState(true);

  const [form, setForm] = useState({
    wedstrijd_id: qWedstrijdId || "",
    klasse: "",
    ruiter: "",
    paard: "",
    email: "",
    opmerkingen: "",
    omroeper: ""
  });

  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingWed(true);
      try {
        const { data, error } = await supabase
          .from("wedstrijden")
          .select("id, naam, datum, organisator_email, status")
          .order("datum", { ascending: true });
        if (error) throw error;
        if (!alive) return;
        setWedstrijden(data || []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || String(e));
      } finally {
        if (alive) setLoadingWed(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const gekozen = useMemo(
    () => wedstrijden.find(w => w.id === (form.wedstrijd_id || qWedstrijdId)) || null,
    [wedstrijden, form.wedstrijd_id, qWedstrijdId]
  );

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setOk(""); setErr("");
    try {
      if (!form.wedstrijd_id && !qWedstrijdId) throw new Error("Kies eerst een wedstrijd.");
      if (!form.klasse) throw new Error("Kies een klasse.");
      if (!form.ruiter?.trim()) throw new Error("Vul de naam van de ruiter in.");
      if (!form.paard?.trim()) throw new Error("Vul de naam van het paard in.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) throw new Error("Vul een geldig e-mailadres in.");

      const payload = {
        wedstrijd_id: qWedstrijdId || form.wedstrijd_id,
        klasse: form.klasse,
        ruiter: form.ruiter.trim(),
        paard: form.paard.trim(),
        email: form.email.trim(),
        opmerkingen: form.opmerkingen?.trim() || null,
        omroeper: form.omroeper?.trim() || null
      };

      const { data: rows, error: e1 } = await supabase
        .from("inschrijvingen")
        .insert(payload)
        .select("id, startnummer")
        .limit(1);
      if (e1) throw e1;
      const inserted = rows?.[0];

      try {
        const resp = await fetch("/api/notifyOrganisator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wedstrijd_id: payload.wedstrijd_id,
            wedstrijd_naam: gekozen?.naam || null,
            klasse: payload.klasse,
            ruiter: payload.ruiter,
            paard: payload.paard,
            email: payload.email,
            opmerkingen: payload.opmerkingen,
            omroeper: payload.omroeper,
            startnummer: inserted?.startnummer ?? null,
            organisator_email: gekozen?.organisator_email || null
          })
        });
        if (!resp.ok) {
          console.warn("Email-notificatie mislukte:", await resp.text());
        }
      } catch (e) {
        console.warn("Email-notificatie kon niet worden verstuurd:", e);
      }

      setOk(`Bedankt voor je inschrijving! Je startnummer is ${inserted?.startnummer ?? "nog niet bekend"}.`);
      setForm(f => ({ ...f, ruiter: "", paard: "", email: "", opmerkingen: "", omroeper: "" }));
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <div className="top">
        <h1>Inschrijven</h1>
        <div className="spacer">Working Equitation</div>
      </div>

      <div className="card">
        <form onSubmit={onSubmit}>
          {!qWedstrijdId && (
            <div style={{ marginBottom: 12 }}>
              <label>Wedstrijd</label>
              <select
                value={form.wedstrijd_id}
                onChange={(e) => set("wedstrijd_id", e.target.value)}
                disabled={loadingWed}
              >
                <option value="">{loadingWed ? "Laden..." : "— kies een wedstrijd —"}</option>
                {wedstrijden.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.naam} {w.datum ? `(${w.datum})` : ""}
                  </option>
                ))}
              </select>
              <small className="mut">Tip: deel de link als <code>?wedstrijdId=&lt;uuid&gt;</code> om deze keuze te verbergen.</small>
            </div>
          )}

          <div className="row" style={{ marginBottom: 12 }}>
            <div>
              <label>Klasse *</label>
              <select value={form.klasse} onChange={(e) => set("klasse", e.target.value)} required>
                <option value="">— kies klasse —</option>
                {KLASSEN.map(k => <option key={k.code} value={k.code}>{k.label}</option>)}
              </select>
            </div>
            <div></div>
          </div>

          <div className="row" style={{ marginBottom: 12 }}>
            <div>
              <label>Ruiter *</label>
              <input value={form.ruiter} onChange={(e)=>set("ruiter", e.target.value)} placeholder="Naam ruiter" required />
            </div>
            <div>
              <label>Paard *</label>
              <input value={form.paard} onChange={(e)=>set("paard", e.target.value)} placeholder="Naam paard" required />
            </div>
          </div>

          <div className="row" style={{ marginBottom: 12 }}>
            <div>
              <label>E-mail *</label>
              <input type="email" value={form.email} onChange={(e)=>set("email", e.target.value)} placeholder="jij@example.com" required />
            </div>
            <div></div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Tekst voor de omroeper (optioneel)</label>
            <textarea value={form.omroeper} onChange={(e)=>set("omroeper", e.target.value)} placeholder="Korte introductie / bijzonderheden" />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Opmerkingen (optioneel)</label>
            <textarea value={form.opmerkingen} onChange={(e)=>set("opmerkingen", e.target.value)} placeholder="Bijv. speciale wensen / opmerkingen (geen starttijd-voorkeur a.u.b.)" />
          </div>

          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Versturen..." : "Inschrijven"}
          </button>

          {ok && <div className="msg-ok">{ok}</div>}
          {err && <div className="msg-err">{err}</div>}
        </form>
      </div>

      <hr className="sep" />

      <small className="mut">
        Door in te schrijven ga je akkoord met verwerking van je gegevens t.b.v. de wedstrijdorganisatie.
      </small>
    </div>
  );
}
