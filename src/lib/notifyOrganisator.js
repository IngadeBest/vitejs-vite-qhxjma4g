// src/lib/notifyOrganisator.js
export async function notifyOrganisator({ wedstrijd, inschrijving }) {
  try {
    const body = {
      organisator_email: wedstrijd?.organisator_email || null,
      wedstrijd_id: wedstrijd?.id || inschrijving?.wedstrijd_id || null,
      wedstrijd_naam: wedstrijd?.naam || null,
      klasse: inschrijving?.klasse || null,
      categorie: inschrijving?.categorie || null,
      ruiter: inschrijving?.ruiter || null,
      paard: inschrijving?.paard || null,
      email: inschrijving?.email || null,
      opmerkingen: inschrijving?.opmerkingen || null,
      omroeper: inschrijving?.omroeper || null,
      startnummer: inschrijving?.startnummer ?? null,
    };

    const resp = await fetch("/api/notifyOrganisator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { ok: resp.ok, raw: text }; }

    // Altijd zichtbaar in console voor debug
    console.info("notifyOrganisator response:", resp.status, data);

    return data;
  } catch (e) {
    console.warn("notifyOrganisator fetch error:", e);
    return { ok: false, error: "FETCH_FAIL", message: String(e?.message || e) };
  }
}
