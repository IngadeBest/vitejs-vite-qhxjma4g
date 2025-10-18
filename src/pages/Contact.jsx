import React, { useState } from "react";
import { Alert } from "@/ui/alert";

export default function Contact() {
  const [form, setForm] = useState({ naam: "", email: "", bericht: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const disabled =
    !form.naam.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ||
    !form.bericht.trim();

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setDone(false);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Versturen mislukt");
      setDone(true);
      setForm({ naam: "", email: "", bericht: "" });
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "24px auto" }}>
      <h2>Contact</h2>
      <p style={{ color: "#555" }}>
        Vragen of interesse in de Working Point app? Stuur ons een bericht.
      </p>

      {done && (
        <Alert type="success">Dank je! We hebben je bericht ontvangen en reageren zo snel mogelijk.</Alert>
      )}
      {err && (
        <Alert type="error">{String(err)}</Alert>
      )}

      <form
        onSubmit={onSubmit}
        style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "10px 12px", alignItems: "center" }}
      >
        <label>Naam*</label>
        <input
          value={form.naam}
          onChange={(e) => setForm((s) => ({ ...s, naam: e.target.value }))}
          placeholder="Jouw naam"
        />

        <label>E-mail*</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
          placeholder="jij@example.com"
        />

        <label>Bericht*</label>
        <textarea
          rows={5}
          value={form.bericht}
          onChange={(e) => setForm((s) => ({ ...s, bericht: e.target.value }))}
          placeholder="Waarmee kunnen we helpen?"
        />

        <div></div>
        <button type="submit" disabled={busy || disabled}>
          {busy ? "Versturen..." : "Versturen"}
        </button>
      </form>

      <div style={{ marginTop: 16, color: "#666", fontSize: 14 }}>
        Liever direct mailen? <a href="mailto:info@workingpoint.nl">info@workingpoint.nl</a>
      </div>
    </div>
  );
}
