import nodemailer from 'nodemailer';

function bool(v, d=false){ if(v===undefined) return d; const s=String(v).trim().toLowerCase(); return s==='1'||s==='true'; }

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || `WE Inschrijvingen <no-reply@workingpoint.nl>`;
const ORGANISATOR_EMAIL_DEFAULT = process.env.ORGANISATOR_EMAIL_DEFAULT || '';
const SMTP_TLS_REJECT_UNAUTH = bool(process.env.SMTP_TLS_REJECT_UNAUTH, true);

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  tls: { rejectUnauthorized: SMTP_TLS_REJECT_UNAUTH },
});

export default async function handler(req, res) {
  try {
    if (req.method === 'GET' && (req.query.ping || req.query.health)) {
      return res.status(200).json({
        ok: true,
        env: {
          host: !!SMTP_HOST,
          port: SMTP_PORT,
          secure: SMTP_PORT === 465,
          user: !!SMTP_USER,
          from: !!SMTP_FROM,
          default_to: !!ORGANISATOR_EMAIL_DEFAULT,
        },
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    const b = req.body || {};
  const to = (b.organistor_email || b.organisateur_email || b.organizer_email || b.organisatie_email || b.organisator_email || b.organisatie_email || ORGANISATOR_EMAIL_DEFAULT || '').trim();
  const wedstrijdNaam = b.wedstrijd_naam || b.wedstrijd || 'Wedstrijd';
    const notificationType = b.type || 'nieuwe_inschrijving';

    if (!to) {
      return res.status(400).json({ ok: false, error: 'NO_TO', message: 'No organisator email configured or provided.' });
    }

    try { await transporter.verify(); }
    catch (e) { return res.status(500).json({ ok: false, error: 'VERIFY_FAIL', message: e?.message || String(e) }); }

    let subject, html;

    if (notificationType === 'capacity_warning') {
      // Capaciteit waarschuwing
      subject = `⚠️ Capaciteit waarschuwing: ${wedstrijdNaam}`;
      const warningsList = (b.warnings || []).map(w => `<li>${w.message}</li>`).join('');
      html = `
        <h2>⚠️ Capaciteit waarschuwing</h2>
        <p><b>Wedstrijd:</b> ${wedstrijdNaam}</p>
        <p>De volgende capaciteit waarschuwingen zijn getriggerd:</p>
        <ul>
          ${warningsList}
        </ul>
        ${b.auto_closed ? '<p><strong>⚠️ De wedstrijd is automatisch gesloten omdat het maximaal aantal deelnemers is bereikt.</strong></p>' : ''}
      `;
    } else if (notificationType === 'wachtlijst') {
      // Wachtlijst aanmelding
      subject = `📋 Wachtlijst aanmelding: ${wedstrijdNaam} (${b.klasse || 'klasse onbekend'})`;
      html = `
        <h2>📋 Nieuwe wachtlijst aanmelding</h2>
        <p><b>Wedstrijd:</b> ${wedstrijdNaam}</p>
        <ul>
          <li><b>WEH-lid:</b> ${b.weh_lid ? 'Ja' : 'Nee'}</li>
          <li><b>Klasse:</b> ${b.klasse || '-'}</li>
          <li><b>Ruiter:</b> ${b.ruiter || '-'}</li>
          <li><b>Paard:</b> ${b.paard || '-'}</li>
          <li><b>E-mail ruiter:</b> ${b.email || '-'}</li>
        </ul>
        <p><em>Deze persoon staat op de wachtlijst en kan worden gecontacteerd als er een plek vrijkomt.</em></p>
      `;
    } else {
      // Standaard nieuwe inschrijving
      subject = `Nieuwe inschrijving: ${wedstrijdNaam} (${b.klasse || 'klasse onbekend'})`;
      html = `
        <h2>Nieuwe inschrijving</h2>
        <p><b>Wedstrijd:</b> ${wedstrijdNaam}</p>
        <ul>
          <li><b>WEH-lid:</b> ${b.weh_lid ? 'Ja' : 'Nee'}</li>
          <li><b>Klasse:</b> ${b.klasse || '-'}</li>
          <li><b>Ruiter:</b> ${b.ruiter || '-'}</li>
          <li><b>Leeftijd ruiter:</b> ${b.leeftijd_ruiter != null ? b.leeftijd_ruiter : '-'}</li>
          <li><b>Paard:</b> ${b.paard || '-'}</li>
          <li><b>Geslacht paard:</b> ${b.geslacht_paard || '-'}</li>
          <li><b>E-mail ruiter:</b> ${b.email || '-'}</li>
          <li><b>Omroeper:</b> ${b.omroeper || '-'}</li>
          <li><b>Speciale wensen/stal:</b> ${b.opmerkingen || '-'}</li>
        </ul>
      `;
    }

    const info = await transporter.sendMail({ from: SMTP_FROM, to, subject, html });
    return res.status(200).json({ ok: true, messageId: info.messageId });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'SEND_FAIL', message: e?.message || String(e) });
  }
}
