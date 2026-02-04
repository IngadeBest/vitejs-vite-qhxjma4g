import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

const supabaseServer = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) 
  : null;

export default async function handler(req, res) {
  if (req.method === 'GET' && req.query?.ping) {
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'POST') {
    return handleWachtlijstAdd(req, res);
  }

  if (req.method === 'GET') {
    return handleWachtlijstGet(req, res);
  }

  return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
}

async function handleWachtlijstAdd(req, res) {
  const b = req.body || {};
  const wedstrijd_id = b.wedstrijd_id;

  if (!wedstrijd_id) {
    return res.status(400).json({ ok: false, error: 'NO_WEDSTRIJD_ID' });
  }

  if (!supabaseServer) {
    return res.status(500).json({ 
      ok: false, 
      error: 'NO_SUPABASE_SERVER', 
      message: 'Server credentials not configured' 
    });
  }

  try {
    // Verify wedstrijd exists and has wachtlijst enabled
    const { data: wedstrijd, error: wErr } = await supabaseServer
      .from('wedstrijden')
      .select('id, naam, wachtlijst_enabled, organisator_email')
      .eq('id', wedstrijd_id)
      .single();

    if (wErr || !wedstrijd) {
      return res.status(404).json({ 
        ok: false, 
        error: 'WEDSTRIJD_NOT_FOUND' 
      });
    }

    if (!wedstrijd.wachtlijst_enabled) {
      return res.status(400).json({ 
        ok: false, 
        error: 'WACHTLIJST_NOT_ENABLED',
        message: 'Wachtlijst is niet ingeschakeld voor deze wedstrijd' 
      });
    }

    // Check if person is already on waitlist
    const { data: existing } = await supabaseServer
      .from('wachtlijst')
      .select('id')
      .eq('wedstrijd_id', wedstrijd_id)
      .eq('klasse', b.klasse)
      .eq('email', b.email)
      .eq('ruiter', b.ruiter)
      .eq('paard', b.paard)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ 
        ok: false, 
        error: 'ALREADY_ON_WAITLIST',
        message: 'Je staat al op de wachtlijst voor deze klasse' 
      });
    }

    // Add to waitlist
    const payload = {
      wedstrijd_id,
      klasse: b.klasse,
      ruiter: b.ruiter,
      paard: b.paard,
      email: b.email,
      telefoon: b.telefoon || null,
      weh_lid: b.weh_lid || false,
      leeftijd_ruiter: b.leeftijd_ruiter || null,
      geslacht_paard: b.geslacht_paard || null,
      omroeper: b.omroeper || null,
      opmerkingen: b.opmerkingen || null,
    };

    const { error: insertErr } = await supabaseServer
      .from('wachtlijst')
      .insert(payload);

    if (insertErr) {
      console.error('Wachtlijst insert error:', insertErr);
      return res.status(500).json({ 
        ok: false, 
        error: 'INSERT_FAILED',
        message: insertErr.message 
      });
    }

    // Notify organisator
    try {
      const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
      await fetch(base + '/api/notifyOrganisator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'wachtlijst',
          wedstrijd_naam: wedstrijd.naam,
          organisatie_email: wedstrijd.organisator_email,
          klasse: b.klasse,
          ruiter: b.ruiter,
          paard: b.paard,
          email: b.email,
          weh_lid: b.weh_lid,
        }),
      }).catch(e => console.warn('notifyOrganisator failed:', e));
    } catch (e) {
      console.warn('Notification error:', e);
    }

    return res.status(200).json({ 
      ok: true, 
      message: 'Je bent toegevoegd aan de wachtlijst' 
    });

  } catch (e) {
    console.error('wachtlijst API error:', e);
    return res.status(500).json({ 
      ok: false, 
      error: 'SERVER_ERROR',
      message: e?.message || String(e) 
    });
  }
}

async function handleWachtlijstGet(req, res) {
  const wedstrijd_id = req.query.wedstrijd_id;

  if (!wedstrijd_id) {
    return res.status(400).json({ ok: false, error: 'NO_WEDSTRIJD_ID' });
  }

  if (!supabaseServer) {
    return res.status(500).json({ 
      ok: false, 
      error: 'NO_SUPABASE_SERVER' 
    });
  }

  try {
    const { data, error } = await supabaseServer
      .from('wachtlijst')
      .select('*')
      .eq('wedstrijd_id', wedstrijd_id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Wachtlijst fetch error:', error);
      return res.status(500).json({ 
        ok: false, 
        error: 'FETCH_FAILED',
        message: error.message 
      });
    }

    return res.status(200).json({ ok: true, data });

  } catch (e) {
    console.error('wachtlijst GET error:', e);
    return res.status(500).json({ 
      ok: false, 
      error: 'SERVER_ERROR',
      message: e?.message || String(e) 
    });
  }
}
