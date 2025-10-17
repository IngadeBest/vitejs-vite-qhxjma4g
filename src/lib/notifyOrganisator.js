export async function notifyOrganisator(payload) {
  try {
    const res = await fetch('/api/notifyOrganisator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wedstrijd_id: payload?.inschrijving?.wedstrijd_id || payload?.wedstrijd?.id || null,
        wedstrijd_naam: payload?.wedstrijd?.naam || null,
        organisator_email: payload?.wedstrijd?.organisator_email || null,
        ...payload?.inschrijving,
      }),
    });
    const json = await res.json().catch(() => ({}));
    console.log('notifyOrganisator response:', res.status, json);
    return { ok: res.ok, status: res.status, body: json };
  } catch (e) {
    console.warn('notifyOrganisator fetch failed:', e);
    return { ok: false, error: String(e) };
  }
}
