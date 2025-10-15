
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).send("Method not allowed");
    const body = req.body || {};
    const {
      organisator_email,
      wedstrijd_id, wedstrijd_naam,
      klasse, ruiter, paard, email, opmerkingen, omroeper, startnummer
    } = body;

    const to = organisator_email || process.env.ORGANISATOR_EMAIL_DEFAULT;
    if (!to) return res.status(200).send("No organizer email configured; skipping.");

    const subject = `Nieuwe inschrijving: ${ruiter || "Onbekend"} – ${wedstrijd_naam || wedstrijd_id || ""}`;
    const html = `
      <div style="font-family:ui-sans-serif,system-ui">
        <h2>Nieuwe inschrijving</h2>
        <p><b>Wedstrijd:</b> ${escapeHtml(wedstrijd_naam || "")} <small>(${escapeHtml(wedstrijd_id || "")})</small></p>
        <p><b>Startnummer:</b> ${startnummer ?? "-"}</p>
        <p><b>Klasse:</b> ${escapeHtml(klasse || "-")}</p>
        <p><b>Ruiter:</b> ${escapeHtml(ruiter || "-")}</p>
        <p><b>Paard:</b> ${escapeHtml(paard || "-")}</p>
        <p><b>Email ruiter:</b> ${escapeHtml(email || "-")}</p>
        <p><b>Omroeper tekst:</b><br/>${nl2br(escapeHtml(omroeper || "-"))}</p>
        <p><b>Opmerkingen:</b><br/>${nl2br(escapeHtml(opmerkingen || "-"))}</p>
      </div>
    `;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "WE Inschrijvingen <no-reply@resend.dev>",
        to: [to],
        subject,
        html
      })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(500).send(`Resend error: ${txt}`);
    }
    return res.status(200).send("OK");
  } catch (e) {
    return res.status(500).send(String(e));
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>\"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function nl2br(s) {
  return String(s).replace(/\n/g, "<br/>");
}
