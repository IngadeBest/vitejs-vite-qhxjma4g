export async function notifyOrganisator(data) {
  const resp = await fetch("/api/notifyOrganisator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    redirect: "error" // breek hard af als er tóch een 30x redirect dreigt
  });

  if (!resp.ok) {
    const msg = await safeJson(resp);
    throw new Error(`Mail failed: ${resp.status} ${msg?.error ?? ""}`);
  }

  return resp.json();
}

async function safeJson(r) {
  try { return await r.json(); } catch { return null; }
}
