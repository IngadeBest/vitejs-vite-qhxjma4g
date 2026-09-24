import { normalizeClass } from '@/rules/weh/classes';

export const protocolKey = (wedstrijdId, klasse) => `protocol_items_${wedstrijdId}_${normalizeClass(klasse)}_stijl`;
export const validItems = items => Array.isArray(items) && items.every(item => typeof item === 'string' && item.trim());

export function readLocalProtocol(storage, wedstrijdId, klasse) {
  const exact = protocolKey(wedstrijdId, klasse);
  const prefix = `protocol_items_${wedstrijdId}_`;
  const keys = [exact, ...Object.keys(storage).filter(key => key !== exact && key.startsWith(prefix)
    && /_(stijl|stijltrail)$/i.test(key)
    && normalizeClass(key.slice(prefix.length).replace(/_(stijl|stijltrail)$/i, '')) === normalizeClass(klasse))];
  for (const key of keys) {
    try { const value = JSON.parse(storage.getItem(key)); if (validItems(value)) return value; } catch { /* Keep other backups available. */ }
  }
  return null;
}

export async function saveProtocol(client, wedstrijdId, klasse, items, expected) {
  if (!validItems(items)) throw new Error('Ongeldige hindernissenlijst.');
  const {data, error} = await client.rpc('save_protocol_items', {
    p_wedstrijd_id: wedstrijdId, p_klasse: normalizeClass(klasse), p_items: items, p_expected: expected,
  });
  if (error) throw error;
  if (JSON.stringify(data) !== JSON.stringify(items)) throw new Error('Opslaan kon niet worden bevestigd.');
  return data;
}
