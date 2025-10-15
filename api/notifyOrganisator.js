// Serverless (Vercel) – nodemailer naar jouw SMTP
import nodemailer from "nodemailer";

function escapeHtml(s) {
  return String(s).replace(/[&<>\"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function nl2br(s) { return String(s).replace(/\n/g, "<br/>"); }

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).send("Method not allowed");
    const {
      organisator_email, wedstrijd_id, wedstrijd_naam,
      klasse, categorie, ruiter, paard, email, opmerkingen, omroeper, startnummer
    } = req.body || {};

    const to = organisator_email || process.env.ORGANISATOR_EMAIL_DEFAULT;
    if (!to) return res.status(200).send("No organizer email configured; skipping.");

    const subject = `Nieuwe inschrijving: ${ruiter || "Onbekend"} – ${wedstrijd_naam || wedstrijd_id || ""}`;
    const html = `
      <div style="font-family:ui-sans-serif,system-ui">
        <h2>Nieuwe inschrijving</h2>
        <p><b>Wedstrijd:</b> ${escapeHtml(wedstrijd_naam || "")} <small>(${escapeHtml(wedstrijd_id || "")})</small></p>
        <p><b>Startnummer:</b> ${startnummer ?? "-"}</p>
        <p><b>Klasse:</b> ${escapeHtml(klasse || "-")}</p>
        <p><b>Categorie:</b> ${escapeHtml(categorie || "-")}</p>
        <p><b>Ruiter:</b> ${escapeHtml(ruiter || "-")}</p>
        <p><b>Paard:</b> ${escapeHtml(paard || "-")}</p>
        <p><b>Email ruiter:</b> ${escapeHtml(email || "-")}</p>
        <p><b>Omroeper tekst:</b><br/>${nl2br(escapeHtml(omroeper || "-"))}</p>
        <p><b>Opmerkingen:</b><br/>${nl2br(escapeHtml(opmerkingen || "-"))}</p>
      </div>
    `;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: (process.env.SMTP_SECURE === "true") || Number(process.env.SMTP_PORT) === 465,
      auth: (process.env.SMTP_USER && process.env.SMTP_PASS) ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
      tls: (process.env.SMTP_TLS_REJECT_UNAUTH === "false") ? { rejectUnauthorized: false } : undefined,
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || "WE Inschrijvingen <no-reply@workingpoint.nl>",
      to,
      subject,
      html,
      replyTo: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
    });

    res.status(200).send("OK");
  } catch (e) {
    console.error("notifyOrganisator error:", e);
    res.status(500).send("MAIL_ERROR");
  }
}
