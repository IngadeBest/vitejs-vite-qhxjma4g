// WEH 2026 v10 §1.2, §4.1. Keep division, technical level and test identity separate.
const definitions = [
  ['we0', 'WE0', 'Introductieklasse (WE0)', 'introductie', 4, 6, 8, 'open'],
  ['we1', 'WE1', 'WE1', 'beginners', 5, 6, 10, 'open'],
  ['we2', 'WE2', 'WE2', 'licht', 5, 8, 12, 'open'],
  ['we2p', 'WE2+', 'WE2+', 'licht', 5, 8, 12, 'open'],
  ['we3', 'WE3', 'WE3', 'gevorderden', 6, 10, 14, 'open'],
  ['we4', 'WE4', 'WE4', 'masters', 6, 12, 16, 'open'],
  ['junior', 'JR', 'Junioren', 'gevorderden', 6, null, null, 'junioren'],
  ['yr', 'YR', 'Young Riders', 'gevorderden', 6, null, null, 'young_riders'],
];
export const CLASSES = Object.freeze(definitions.map(([code, labelKey, naam, competitionLevel, minHorseAge, min, max, division]) => Object.freeze({
  code, labelKey, naam, label: naam, competitionLevel, division, minHorseAge, min, max,
  dressageTestId: `dressage_${code}`, styleTrailRuleSetId: `style_${code}`,
  speedTrailRuleSetId: ['we0', 'we1'].includes(code) ? null : `speed_${code}`,
  requiredComponents: Object.freeze(['Dressuur', 'Stijltrail', ...(['we0', 'we1'].includes(code) ? [] : ['Speedtrail'])]),
  cattleWork: code === 'junior' ? 'REVIEW REQUIRED' : ['we0', 'we1'].includes(code) ? false : 'optional_separate',
  reviewRequired: ['junior', 'yr'].includes(code) ? ['RR03', 'RR08', ...(code === 'junior' ? ['RR04', 'RR07'] : [])] : [],
})));
export const CLASS_OPTIONS = CLASSES.map(c => ({ code: c.code, label: c.label }));
const aliases = new Map();
const key = v => String(v ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
for (const c of CLASSES) for (const a of [c.code, c.labelKey, c.naam]) aliases.set(key(a), c.code);
for (const [a, code] of Object.entries({'0':'we0', introductie:'we0', introductieklasse:'we0', 'introductieklasse(we0)':'we0', weintro:'we0', we2plus:'we2p', juniors:'junior', jr:'junior', youngrider:'yr'})) aliases.set(key(a), code);
export function normalizeClass(value) { return aliases.get(key(String(value ?? '').replace(/\s*-\s*jeugd$/i, ''))) || null; }
export function getClass(value) { const code = normalizeClass(value); return CLASSES.find(c => c.code === code) || null; }
export function requireClass(value) { const c = getClass(value); if (!c) throw new Error(`Onbekende WEH-klasse: ${value ?? ''}`); return c; }
export function classLabel(value) {
  const c = getClass(value); if (!c) return String(value ?? '');
  return c.naam + (/\s*-\s*jeugd$/i.test(String(value)) ? ' - Jeugd' : '');
}
export function normalizeComponent(value) { return ({dressuur:'Dressuur', dressage:'Dressuur', stijl:'Stijltrail', stijltrail:'Stijltrail', speed:'Speedtrail', speedtrail:'Speedtrail', runderwerk:'Runderwerk'})[key(value)] || null; }
export function hasSpeed(value) { return Boolean(getClass(value)?.speedTrailRuleSetId); }
export function supportsComponent(klasse, onderdeel) { return Boolean(getClass(klasse)?.requiredComponents.includes(normalizeComponent(onderdeel))); }
export function entryIdentity(klasse, rubriek) {
  const c = requireClass(klasse);
  const youth = /\s*-\s*jeugd$/i.test(String(klasse)) || String(rubriek).toLowerCase() === 'jeugd';
  return { classCode: c.code, division: c.division, competitionLevel: c.competitionLevel,
    section: youth ? 'jeugd' : 'algemeen', dressageTestId: c.dressageTestId,
    styleTrailRuleSetId: c.styleTrailRuleSetId, speedTrailRuleSetId: c.speedTrailRuleSetId };
}
export function resultClassKey(klasse, rubriek) {
  const c = getClass(klasse); if (!c) return String(klasse ?? '').trim();
  return `${c.code}${entryIdentity(klasse, rubriek).section === 'jeugd' ? ' - jeugd' : ''}`;
}
