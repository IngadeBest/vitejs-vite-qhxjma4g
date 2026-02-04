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
    let wedstrijden = [];
    let wErr = null;
    // first, try fetching by id — this will fail if the provided id is not a uuid
    try {
      const res = await publicFetch.from('wedstrijden').select('*').eq('id', wedstrijd_id).limit(1);
      wedstrijden = res.data || [];
      wErr = res.error || null;
      if (wErr) {
        // if the error looks like an invalid uuid input, fall through to a fallback query
        const msg = String(wErr.message || JSON.stringify(wErr)).toLowerCase();
        if (!msg.includes('invalid input syntax for type uuid')) {
          console.error('Failed to fetch wedstrijd (publicFetch):', wErr);
          throw new Error('WEDSTRIJD_FETCH_FAILED: ' + (wErr.message || JSON.stringify(wErr)));
        }
        // else: continue to fallback
      }
    } catch (err) {
      // If the client threw (e.g. server returned 500) check message for uuid issue, else rethrow
      const m = String(err?.message || '').toLowerCase();
      if (!m.includes('invalid input syntax for type uuid')) {
        console.error('Failed to fetch wedstrijd (publicFetch exception):', err);
        throw new Error('WEDSTRIJD_FETCH_FAILED: ' + (err?.message || String(err)));
      }
      // otherwise we'll try the fallback below
    }

    // fallback: try to find by slug or partial name if id lookup failed due to uuid syntax
    if (!wedstrijden.length) {
      try {
        // try slug exact match first
        const bySlug = await publicFetch.from('wedstrijden').select('*').eq('slug', wedstrijd_id).limit(1);
        if (bySlug.data && bySlug.data.length) {
          wedstrijden = bySlug.data;
        } else {
          // try name search (case-insensitive, partial)
          const byName = await publicFetch.from('wedstrijden').select('*').ilike('naam', `%${wedstrijd_id}%`).limit(1);
          wedstrijden = byName.data || [];
          wErr = byName.error || null;
          if (wErr) {
            console.error('Failed fallback fetch by naam:', wErr);
            throw new Error('WEDSTRIJD_FETCH_FAILED: ' + (wErr.message || JSON.stringify(wErr)));
          }
        }
      } catch (err) {
        console.error('Fallback fetch failed:', err);
        throw new Error('WEDSTRIJD_FETCH_FAILED: ' + (err?.message || String(err)));
      }
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
    // Only enforce category validation when the client actually provided a categorie value.
    // Public form no longer submits categorie, so missing categorie should not cause a 400.
    if (allowedCats && b.categorie != null && b.categorie !== '' && !allowedCats.includes(b.categorie)) {
      return res.status(400).json({ ok: false, error: 'CATEGORIE_NOT_ALLOWED', message: 'Geselecteerde categorie niet toegestaan voor deze klasse.'});
    }

    // Server-side capacity validation
    let shouldAutoClose = false;
    let capacityWarnings = [];
    try {
      const cfg = wedstrijd.startlijst_config && typeof wedstrijd.startlijst_config === 'object' 
        ? wedstrijd.startlijst_config 
        : (wedstrijd.startlijst_config ? JSON.parse(wedstrijd.startlijst_config) : null);

      // Check totaal maximum voor hele wedstrijd
      if (cfg && cfg.totaalMaximum !== undefined && cfg.totaalMaximum !== null) {
        const totaalClient = supabaseServer || createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);
        const { count: totaalCount, error: totaalError } = await totaalClient
          .from('inschrijvingen')
          .select('id', { count: 'exact', head: true })
          .eq('wedstrijd_id', wedstrijd_id);
        
        if (!totaalError && (totaalCount || 0) >= Number(cfg.totaalMaximum)) {
          // Check if wachtlijst is enabled
          if (wedstrijd.wachtlijst_enabled) {
            return res.status(400).json({ 
              ok: false, 
              error: 'WEDSTRIJD_VOLZET_WACHTLIJST', 
              message: `De wedstrijd is volledig volzet (${totaalCount}/${cfg.totaalMaximum} deelnemers). Je kunt je op de wachtlijst plaatsen.`,
              wachtlijst_enabled: true
            });
          }
          return res.status(400).json({ 
            ok: false, 
            error: 'WEDSTRIJD_VOLZET', 
            message: `De wedstrijd is volledig volzet (${totaalCount}/${cfg.totaalMaximum} deelnemers).` 
          });
        }

        // Check if we're at 90% capacity (warning threshold)
        const percentage = (totaalCount / Number(cfg.totaalMaximum)) * 100;
        if (percentage >= 90 && percentage < 100) {
          capacityWarnings.push({
            type: 'totaal_90',
            message: `Wedstrijd is voor ${Math.round(percentage)}% vol (${totaalCount}/${cfg.totaalMaximum})`
          });
        }

        // After this registration, check if we'll hit the limit
        if ((totaalCount + 1) >= Number(cfg.totaalMaximum)) {
          shouldAutoClose = true;
          capacityWarnings.push({
            type: 'totaal_vol',
            message: `Wedstrijd is nu VOL (${totaalCount + 1}/${cfg.totaalMaximum})`
          });
        }
      }

      // Check per-klasse capaciteit
      const cap = cfg && cfg.capacities ? (cfg.capacities[b.klasse] ?? null) : null;
      if (cap !== undefined && cap !== null) {
        const capClient = supabaseServer || createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);
        const { count, error } = await capClient
          .from('inschrijvingen')
          .select('id', { count: 'exact', head: true })
          .eq('wedstrijd_id', wedstrijd_id)
          .eq('klasse', b.klasse);
        
        if (!error && (count || 0) >= Number(cap)) {
          // Check if wachtlijst is enabled
          if (wedstrijd.wachtlijst_enabled) {
            return res.status(400).json({ 
              ok: false, 
              error: 'KLASSE_VOLZET_WACHTLIJST', 
              message: `De klasse is volzet (${count}/${cap} deelnemers). Je kunt je op de wachtlijst plaatsen.`,
              wachtlijst_enabled: true
            });
          }
          return res.status(400).json({ 
            ok: false, 
            error: 'KLASSE_VOLZET', 
            message: `De klasse is volzet (${count}/${cap} deelnemers).` 
          });
        }

        // Check if class is at 90% capacity
        const classPercentage = (count / Number(cap)) * 100;
        if (classPercentage >= 90 && classPercentage < 100) {
          capacityWarnings.push({
            type: 'klasse_90',
            klasse: b.klasse,
            message: `Klasse ${b.klasse} is voor ${Math.round(classPercentage)}% vol (${count}/${cap})`
          });
        }

        // After this registration, check if class will be full
        if ((count + 1) >= Number(cap)) {
          capacityWarnings.push({
            type: 'klasse_vol',
            klasse: b.klasse,
            message: `Klasse ${b.klasse} is nu VOL (${count + 1}/${cap})`
          });
        }
      }
    } catch (capacityError) {
      console.error('Capacity validation error:', capacityError);
      // Don't block the registration if capacity check fails
    }

    const payload = {
      wedstrijd_id,
      wedstrijd: b.wedstrijd || wedstrijd.naam || null, // denormalized name for readability
      klasse: b.rubriek === "Jeugd" ? (b.klasse + " - Jeugd") : b.klasse, // Voeg " - Jeugd" toe als rubriek Jeugd is
      categorie: b.categorie,
      weh_lid: b.weh_lid || false,
      ruiter: b.ruiter || null,
      paard: b.paard || null,
      leeftijd_ruiter: b.leeftijd_ruiter || null,
      geslacht_paard: b.geslacht_paard || null,
      email: b.email || null,
      opmerkingen: b.opmerkingen || null,
      omroeper: b.omroeper || null,
      voorkeur_tijd: b.voorkeur_tijd || null,
      rubriek: b.rubriek || "Algemeen", // Default rubriek voor database constraint
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

    // Auto-close wedstrijd if capacity reached
    if (shouldAutoClose && supabaseServer) {
      try {
        await supabaseServer
          .from('wedstrijden')
          .update({ status: 'gesloten' })
          .eq('id', wedstrijd_id);
        console.log(`Wedstrijd ${wedstrijd_id} automatically closed (capacity reached)`);
      } catch (closeError) {
        console.error('Failed to auto-close wedstrijd:', closeError);
      }
    }

    // send notification to organisator (reuse existing endpoint)
    try {
      const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
      // forward a payload that includes the denormalized wedstrijd name plus relevant fields
      const notifyBody = {
        wedstrijd_naam: wedstrijd.naam,
        wedstrijd_id,
        klasse: b.klasse,
        categorie: b.categorie,
        ruiter: b.ruiter,
        paard: b.paard,
        email: b.email,
        opmerkingen: b.opmerkingen,
        omroeper: b.omroeper,
        leeftijd_ruiter: b.leeftijd_ruiter || null,
        geslacht_paard: b.geslacht_paard || null,
        weh_lid: b.weh_lid || false,
      };
      if (wedstrijd.organisator_email) notifyBody.organisatie_email = wedstrijd.organisator_email;
      await fetch(base + '/api/notifyOrganisator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifyBody),
      }).catch((e) => console.warn('notifyOrganisator forward failed:', e));

      // Send capacity warnings if any
      if (capacityWarnings.length > 0) {
        await fetch(base + '/api/notifyOrganisator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'capacity_warning',
            wedstrijd_naam: wedstrijd.naam,
            organisatie_email: wedstrijd.organisator_email,
            warnings: capacityWarnings,
            auto_closed: shouldAutoClose,
          }),
        }).catch((e) => console.warn('capacity warning notification failed:', e));
      }
    } catch(e) {
      console.warn('notifyOrganisator error:', e);
    }

    return res.status(200).json({ ok: true, message: 'Inschrijving opgeslagen' });
  } catch (e) {
    console.error('inschrijvingen API error:', e);
    return res.status(500).json({ ok: false, error: 'INSERT_FAILED', message: e?.message || String(e) });
  }
}
