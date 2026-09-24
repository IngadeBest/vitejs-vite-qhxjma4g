export const startlijstScope = (klasse, rubriek) => JSON.stringify([klasse || '', rubriek || '']);

export function configForScope(config, scope) {
  const scoped = config?.startlijstScopes?.[scope];
  return scoped ? { ...config, ...scoped } : config || {};
}

export function sortStartlijst(entries, config = {}) {
  const order = new Map((config.rowOrder || []).map((row, index) => [String(row.id), index]));
  return [...entries].sort((a, b) => {
    const rank = (row) => order.has(String(row.id)) ? order.get(String(row.id)) : (row.volgorde ?? Infinity);
    return rank(a) - rank(b) || String(a.klasse || '').localeCompare(String(b.klasse || '')) ||
      String(a.created_at || '').localeCompare(String(b.created_at || '')) || String(a.id).localeCompare(String(b.id));
  });
}

export async function saveStartlijst(client, wedstrijdId, rows, config, scope) {
  const { data, error } = await client.rpc('save_startlijst', {
    p_wedstrijd_id: wedstrijdId,
    p_rows: rows,
    p_config: config,
    p_scope: scope,
  });
  if (error) throw error;
  if (!Array.isArray(data) || data.length !== rows.length) {
    throw new Error('Opslaan kon niet worden bevestigd. Laad de startlijst opnieuw.');
  }
  return data.map(row => row.type === 'entry'
    ? { ...row, startnummer: formatStartnummer(row.startnummer) } : row);
}
export function formatStartnummer(value) {
  if (value == null || value === '') return '';
  const text = String(value).trim();
  return /^\d+$/.test(text) ? text.padStart(3, '0') : text;
}
