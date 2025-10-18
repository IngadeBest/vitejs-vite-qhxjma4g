import nodemailer from "nodemailer";

function bool(v, d=false){ if(v===undefined) return d; const s=String(v).trim().toLowerCase(); return s==="1"||s==="true"; }

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || `Working Point <no-reply@workingpoint.nl>`;
const CONTACT_TO = process.env.CONTACT_TO || process.env.ORGANISATOR_EMAIL_DEFAULT || "info@workingpoint.nl";
const SMTP_TLS_REJECT_UNAUTH = bool(process.env.SMTP_TLS_REJECT_UNAUTH, true);

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // anders STARTTLS
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  tls: { rejectUnauthorized: SMTP_TLS_REJECT_UNAUTH },
});

export default async function handler(req, res) {
  try {
    // Healthcheck
    if (req.method === "GET" && (req.query.ping || req.query.health)) {
      return res.status(200).json({
        ok: true,
        env: {
          host: !!SMTP_HOST,
          port: SMTP_PORT,
          secure: SMTP_PORT === 465,
          user: !!SMTP_USER,
          from: !!SMTP_FROM,
          to: !!CONTACT_TO,
        },
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    const b = req.body || {};
    const { name, email, subject, message, hp } = b;

    // Honeypot: als ingevuld, negeren we (doen alsof OK is om spammers niet te triggeren)
    if (hp && String(hp).trim() !== "") {
      return res.status(200).json({ ok: true, ignored: true });
    }

    if (!name || !email || !message) {
      return res.status(400).json({ ok: false, error: "BAD_REQUEST", message: "Naam, e-mail en bericht zijn verplicht." });
    }

    try { await transporter.verify(); }
    catch (e) { return res.status(500).json({ ok: false, error: "VERIFY_FAIL", message: e?.message || String(e) }); }

    const subj = subject && subject.trim() ? subject.trim() : "Nieuw bericht via Contactformulier";
    const html = `
      <h2>Nieuw bericht via Contactformulier</h2>
      <ul>
        <li><b>Naam:</b> ${escapeHtml(name)}</li>
        <li><b>E-mail:</b> ${escapeHtml(email)}</li>
        <li><b>Onderwerp:</b> ${escapeHtml(subj)}</li>
      </ul>
      <p style="white-space: pre-wrap">${escapeHtml(message)}</p>
    `;

    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to: CONTACT_TO,
      subject: subj,
      html,
      replyTo: email, // zodat je direct kunt antwoorden
    });

    return res.status(200).json({ ok: true, messageId: info.messageId });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "SEND_FAIL", message: e?.message || String(e) });
  }
}

// simpele HTML escape
function escapeHtml(s="") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
