import React, { useMemo, useState } from "react";
import { Alert } from "@/ui/alert";

/**
 * Eenvoudig contactformulier:
 * - Velden: naam, e-mail, onderwerp (optioneel), bericht
 * - Honeypot (onzichtbaar) tegen spam
 * - POST naar /api/contact (serverless)
 */
export default function Contact() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    hp: "", // honeypot, moet leeg blijven
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const disabled = useMemo(() => {
    if (!form.name.trim()) return true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return true;
    if (!form.message.trim()) return true;
    return false;
  }, [form]);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setDone(false);
    setErr("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          subject: form.subject.trim() || null,
          message: form.message.trim(),
          hp: form.hp || "", // honeypot
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Versturen is niet gelukt.");
      }
      setDone(true);
    } catch (e2) {
      setErr(e2?.message || String(e2));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div style={{ maxWidth: 720, margin: "24px auto", lineHeight: 1.5 }}>
        <h2>Bedankt!</h2>
        <p>Je bericht is verzonden. We nemen zo snel mogelijk contact met je op.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "24px auto", lineHeight: 1.5 }}>
      <h2>Contact</h2>
      <p>
        Vragen over de Working Point wedstrijd-app, een demo of interesse om samen te werken?
        Stuur ons een bericht via dit formulier.
      </p>

      <form
        onSubmit={onSubmit}
        style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "10px 12px", alignItems: "center", marginTop: 12 }}
      >
        {/* Honeypot (onzichtbaar) */}
        <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }} aria-hidden="true">
          <label>Laat dit veld leeg</label>
          <input
            tabIndex={-1}
            autoComplete="off"
            value={form.hp}
            onChange={(e) => setForm((s) => ({ ...s, hp: e.target.value }))}
            placeholder="Laat leeg"
          />
        </div>

        <label>Naam*</label>
        <input
          value={form.name}
          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          placeholder="Je naam"
          autoComplete="name"
        />

        <label>E-mail*</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
          placeholder="jij@example.com"
          autoComplete="email"
        />

        <label>Onderwerp</label>
        <input
          value={form.subject}
          onChange={(e) => setForm((s) => ({ ...s, subject: e.target.value }))}
          placeholder="Onderwerp (optioneel)"
        />

        <label>Bericht*</label>
        <textarea
          rows={6}
          value={form.message}
          onChange={(e) => setForm((s) => ({ ...s, message: e.target.value }))}
          placeholder="Waarmee kunnen we helpen?"
        />

        <div></div>
        <button type="submit" disabled={busy || disabled}>
          {busy ? "Verzenden..." : "Verstuur bericht"}
        </button>
      </form>

  {err && <Alert type="error">{String(err)}</Alert>}
    </div>
  );
}
