// shared helpers for startnummer offsets and formatting
export function klasseStartOffset(code) {
  switch((code || '').toLowerCase()) {
    case 'we0': return 1;
    case 'we1': return 101;
    case 'we2': return 201;
    case 'we3': return 301;
    case 'we4': return 401;
    case 'junior': return 501;
    case 'yr': return 601;
    case 'we2p': return 701;
    default: return 1;
  }
}

export function padStartnummer(v) {
  if (v == null) return '';
  const n = Number(v);
  if (!Number.isNaN(n)) return String(n).padStart(3, '0');
  return String(v).toString().slice(0,3).padStart(3,'0');
}

// lookupOffset supports optional wedstrijdConfig overrides
export function lookupOffset(klasse, rubriek, wedstrijdConfig) {
  // wedstrijdConfig.offsetOverrides expected shape: { "we2:jeugd": 801 }
  if (wedstrijdConfig && typeof wedstrijdConfig === 'object' && wedstrijdConfig.offsetOverrides && typeof wedstrijdConfig.offsetOverrides === 'object') {
    const key = `${klasse}:${rubriek || 'senior'}`;
    if (typeof wedstrijdConfig.offsetOverrides[key] !== 'undefined') return Number(wedstrijdConfig.offsetOverrides[key]);
  }
  // default: base offset + 0 for senior, +500 for jeugd
  const base = klasseStartOffset(klasse) || 1;
  if (rubriek === 'jeugd') return base + 500;
  return base;
}
