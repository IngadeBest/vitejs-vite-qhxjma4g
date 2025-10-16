import React, { useState } from "react";
import { notifyOrganisator } from "@/lib/notifyOrganisator";

export default function Formulier() {
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true); setErr(""); setOk(false);
    const fd = new FormData(e.currentTarget);

    try {
      await notifyOrganisator({
        wedstrijd_id: fd.get("wedstrijd_id"),
        wedstrijd_naam: fd.get("wedstrijd_naam"),
        categorie: fd.get("categorie"),
        ruiter: fd.get("ruiter"),
        paard: fd.get("paard"),
        email: fd.get("email"),
        organisator_email: fd.get("organisator_email")
      });
      setOk(true);
      e.currentTarget.reset();
    } catch (error) {
      setErr(error.message || "Er ging iets mis");
    } finally {
      setBusy(false);
    }
  }

  if (ok) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <h1>Inschrijving ontvangen ✅</h1>
        <p>Je ontvangt binnenkort een bevestiging van inschrijving per e-mail.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="p-6 max-w-xl mx-auto space-y-3">
      <input name="wedstrijd_id" placeholder="Wedstrijd ID" required />
      <input name="wedstrijd_naam" placeholder="Wedstrijd naam" required />
      <input name="categorie" placeholder="Categorie/Klasse" required />
      <input name="ruiter" placeholder="Naam ruiter" required />
      <input name="paard" placeholder="Naam paard/pony" required />
      <input name="email" type="email" placeholder="E-mail ruiter" required />
      <input name="organisator_email" type="email" placeholder="E-mail organisator (optioneel)" />
      {err && <p style={{ color: "red" }}>{err}</p>}
      <button disabled={busy}>{busy ? "Versturen…" : "Inschrijven"}</button>
    </form>
  );
}
