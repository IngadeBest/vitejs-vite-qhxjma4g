// api/notifyOrganisator.js
import nodemailer from "nodemailer";

function escapeHtml(s){return String(s).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const nl2br = (s)=>String(s||"").replace(/\n/g,"<br/>");

export default async function handler(req,res){
  try{
    if(req.method==="GET" && req.query?.ping){
      // Health check: laat zien of env aanwezig is (zonder geheimen te lekken)
      return res.status(200).json({
        ok:true,
        env:{
          host: !!process.env.SMTP_HOST,
          port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null,
          secure: process.env.SMTP_SECURE === "true" || Number(process.env.SMTP_PORT) === 465,
          user: !!process.env.SMTP_USER,
          from: !!process.env.SMTP_FROM,
          default_to: !!process.env.ORGANISATOR_EMAIL_DEFAULT,
        }
      });
    }

    if(req.method!=="POST"){
      return res.status(405).json({ ok:false, error:"METHOD_NOT_ALLOWED" });
    }

    const b = req.body || {};
    const {
      organisator_email, wedstrijd_id, wedstrijd_naam,
      klasse, categorie, ruiter, paard, email, opmerkingen, omroeper, startnummer
    } = b;

    // ontvanger: per-wedstrijd of env default
    const to = (organisator_email || process.env.ORGANISATOR_EMAIL_DEFAULT || "").trim();
    if(!to){
      console.warn("notifyOrganisator: geen ontvanger (organisator_email/ORGANISATOR_EMAIL_DEFAULT ontbreekt)");
      return res.status(400).json({ ok:false, error:"NO_TO" });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: (process.env.SMTP_SECURE === "true") || Number(process.env.SMTP_PORT) === 465,
      auth: (process.env.SMTP_USER && process.env.SMTP_PASS) ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      } : undefined,
      tls: (process.env.SMTP_TLS_REJECT_UNAUTH === "false") ? { rejectUnauthorized: false } : undefined,
    });

    // verify helpt om duidelijke foutmelding in logs te geven
    try{
      await transporter.verify();
    }catch(e){
      console.error("notifyOrganisator: transporter.verify failed:", e?.message || e);
      return res.status(500).json({ ok:false, error:"VERIFY_FAIL", message:String(e?.message||e) });
    }

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

    const mailOptions = {
      from: process.env.SMTP_FROM || "WE Inschrijvingen <no-reply@workingpoint.nl>",
      to,
      subject,
      html,
      replyTo: (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ? email : undefined,
    };

    let info;
    try{
      info = await transporter.sendMail(mailOptions);
      console.log("notifyOrganisator: sent", { messageId: info?.messageId, to });
    }catch(e){
      console.error("notifyOrganisator: sendMail failed:", e?.message || e);
      return res.status(500).json({ ok:false, error:"SEND_FAIL", message:String(e?.message||e) });
    }

    return res.status(200).json({ ok:true, messageId: info?.messageId || null });
  }catch(e){
    console.error("notifyOrganisator: fatal error:", e);
    return res.status(500).json({ ok:false, error:"MAIL_ERROR" });
  }
}
