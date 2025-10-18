import { createClient } from '@supabase/supabase-js';


// Prefer server env names, fall back to VITE_* for local dev
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

const supabaseServer = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

export default async function handler(req, res) {
  console.log('inschrijvingen handler invoked', {
    has_supabase_url: !!process.env.VITE_SUPABASE_URL || !!process.env.SUPABASE_URL,
    has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY || !!process.env.SUPABASE_KEY,
  });
  if (req.method === 'GET' && req.query?.ping) return res.status(200).json({ ok: true });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });

  const b = req.body || {};
  const wedstrijd_id = b.wedstrijd_id;

  if (!wedstrijd_id) return res.status(400).json({ ok: false, error: 'NO_WEDSTRIJD_ID' });

  try {
  // fetch wedstrijd settings using public client if server client not available
  // prefer SUPABASE_URL / SUPABASE_ANON_KEY but fall back to VITE_* names for local dev
  const PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const PUBLIC_SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON) {
    console.error('Missing public Supabase env vars', { PUBLIC_SUPABASE_URL: !!PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON: !!PUBLIC_SUPABASE_ANON });
    return res.status(500).json({ ok: false, error: 'MISSING_SUPABASE_ENV', message: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY (or VITE_* equivalents) in environment.' });
  }
  const publicFetch = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON);
    const { data: wedstrijden = [], error: wErr } = await publicFetch.from('wedstrijden').select('*').eq('id', wedstrijd_id).limit(1);
    if (wErr) {
      console.error('Failed to fetch wedstrijd (publicFetch):', wErr);
      throw new Error('WEDSTRIJD_FETCH_FAILED: ' + (wErr.message || JSON.stringify(wErr)));
    }
    const wedstrijd = (wedstrijden && wedstrijden[0]) || null;
    if (!wedstrijd) return res.status(404).json({ ok: false, error: 'WEDSTRIJD_NOT_FOUND', message: 'Wedstrijd niet gevonden.' });

    // validate class/cat
    const allowedKlassen = Array.isArray(wedstrijd.allowed_klassen) && wedstrijd.allowed_klassen.length ? wedstrijd.allowed_klassen : null;
    if (allowedKlassen && !allowedKlassen.includes(b.klasse)) {
      return res.status(400).json({ ok: false, error: 'KLASSE_NOT_ALLOWED' , message: 'Geselecteerde klasse is niet toegestaan voor deze wedstrijd.'});
    }
    const map = wedstrijd.klasse_categorieen || {};
    const allowedCats = map[b.klasse] && map[b.klasse].length ? map[b.klasse] : null;
    if (allowedCats && !allowedCats.includes(b.categorie)) {
      return res.status(400).json({ ok: false, error: 'CATEGORIE_NOT_ALLOWED', message: 'Geselecteerde categorie niet toegestaan voor deze klasse.'});
    }

    const payload = {
      wedstrijd_id,
      wedstrijd: b.wedstrijd || wedstrijd.naam || null, // denormalized name for readability
      klasse: b.klasse,
      categorie: b.categorie,
      ruiter: b.ruiter || null,
      paard: b.paard || null,
      email: b.email || null,
      opmerkingen: b.opmerkingen || null,
      omroeper: b.omroeper || null,
      voorkeur_tijd: b.voorkeur_tijd || null,
    };

    // insert using server key if available
    if (supabaseServer) {
      const { error: insertErr } = await supabaseServer.from('inschrijvingen').insert(payload);
      if (insertErr) {
        console.error('Supabase insert error (server):', insertErr);
        throw new Error('INSERT_FAILED_SERVER: ' + (insertErr.message || JSON.stringify(insertErr)));
      }
    } else {
      // fallback: use public client (may fail due to RLS) — document risk
      const PUB_SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const PUB_SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (!PUB_SUPABASE_URL || !PUB_SUPABASE_ANON) {
        console.error('Missing public Supabase env vars for fallback insert', { PUB_SUPABASE_URL: !!PUB_SUPABASE_URL, PUB_SUPABASE_ANON: !!PUB_SUPABASE_ANON });
        return res.status(500).json({ ok: false, error: 'MISSING_SUPABASE_ENV', message: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY (or VITE_* equivalents) in environment for public insert fallback.' });
      }
      const pub = createClient(PUB_SUPABASE_URL, PUB_SUPABASE_ANON);
      const { error: insertErr } = await pub.from('inschrijvingen').insert(payload);
      if (insertErr) {
        console.error('Supabase insert error (public):', insertErr);
        throw new Error('INSERT_FAILED_PUBLIC: ' + (insertErr.message || JSON.stringify(insertErr)));
      }
    }

    // send notification to organisator (reuse existing endpoint)
    try {
      const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
      await fetch(base + '/api/notifyOrganisator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wedstrijd_naam: wedstrijd.naam, ...b }),
      }).catch((e) => console.warn('notifyOrganisator forward failed:', e));
    } catch(e) {
      console.warn('notifyOrganisator error:', e);
    }

    return res.status(200).json({ ok: true, message: 'Inschrijving opgeslagen' });
  } catch (e) {
    console.error('inschrijvingen API error:', e);
    return res.status(500).json({ ok: false, error: 'INSERT_FAILED', message: e?.message || String(e) });
  }
}
