import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const {
      wedstrijd_id,
      wedstrijd_naam,
      categorie,
      klasse,
      ruiter,
      paard,
      email,
      organisator_email
    } = payload || {};

    const to = organisator_email || process.env.ORGANISATOR_EMAIL_DEFAULT;
    if (!to) return res.status(400).json({ ok: false, error: "No recipient" });

    const from = process.env.MAIL_FROM || "no-reply@workingpoint.nl"; // moet geverifieerd zijn bij Resend

    const subject = `Nieuwe inschrijving: ${wedstrijd_naam ?? wedstrijd_id ?? ""}`;
    const text = [
      `Wedstrijd: ${wedstrijd_naam ?? ""} (${wedstrijd_id ?? ""})`,
      `Categorie/klasse: ${categorie ?? klasse ?? ""}`,
      `Ruiter: ${ruiter ?? ""}`,
      `Paard: ${paard ?? ""}`,
      `Email ruiter: ${email ?? ""}`
    ].join("\n");

    const result = await resend.emails.send({ from, to, subject, text });
    return res.status(200).json({ ok: true, id: (result as any)?.id ?? null });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err?.message || "unknown" });
  }
}
