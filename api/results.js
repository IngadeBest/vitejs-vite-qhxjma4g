import { createClient } from '@supabase/supabase-js';
import { buildResults, readAll } from '../server/publicResults.js';

export function createResultsHandler(getClient) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }
    const { eventId, preview } = req.query || {};
    if (typeof eventId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) {
      return res.status(400).json({ error: 'INVALID_EVENT' });
    }
    try {
      const client = getClient();
      const isPreview = preview === '1';
      if (isPreview) {
        const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
        if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
        const { data, error } = await client.auth.getUser(token);
        if (error || !data?.user) return res.status(401).json({ error: 'UNAUTHORIZED' });
        const admin = await client.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
        if (admin.error) throw admin.error;
        if (!admin.data) return res.status(403).json({ error: 'FORBIDDEN' });
      }
      async function settings() {
        const result = await client.from('public_result_settings').select('published,finalized').eq('wedstrijd_id', eventId).maybeSingle();
        if (result.error) throw result.error;
        return result.data || { published: false, finalized: {} };
      }
      const initial = await settings();
      if (!initial.published && !isPreview) return res.status(200).json({ published: false });
      const event = await client.from('wedstrijden').select('naam,datum,locatie').eq('id', eventId).maybeSingle();
      if (event.error) throw event.error;
      if (!event.data) return res.status(200).json({ published: false });
      const [entries, tests, scores] = await Promise.all(['inschrijvingen','proeven','scores'].map(t => readAll(client,t,eventId)));
      // Recheck after loading so withdrawing publication also clears a polling client.
      const current = await settings();
      if (!current.published && !isPreview) return res.status(200).json({ published: false });
      return res.status(200).json({ published: current.published, event: {naam:event.data.naam,datum:event.data.datum,locatie:event.data.locatie},
        ...buildResults({entries,tests,scores,finalized:current.finalized,preview:isPreview}),
        ...(isPreview ? { finalized: current.finalized } : {}),
      });
    } catch {
      return res.status(503).json({ error: 'RESULTS_UNAVAILABLE' });
    }
  };
}

let serverClient;
export default createResultsHandler(() => {
  if (!serverClient) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
    if (!url || !key) throw new Error('Server configuration missing');
    serverClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return serverClient;
});
