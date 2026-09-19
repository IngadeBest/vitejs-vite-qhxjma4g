export const STAL_KEY = 'deelnemers_stal_toewijzingen_v1';

export function readLegacyStalls(wedstrijdId) {
  try { return JSON.parse(localStorage.getItem(STAL_KEY) || '{}')[wedstrijdId] || {}; }
  catch { return {}; }
}

export function normalizeStall(value) {
  return { heeftStal: value?.heeftStal === true, stalnummer: value?.heeftStal === true ? String(value.stalnummer || '').trim() : '' };
}

export function loadStalls(rows, legacy) {
  const saved = {}, draft = {};
  for (const row of rows) {
    saved[row.id] = row.stal_toewijzing ?? null;
    if (row.stal_toewijzing != null) draft[row.id] = normalizeStall(row.stal_toewijzing);
    else if (legacy[row.id]?.heeftStal) draft[row.id] = normalizeStall(legacy[row.id]);
  }
  return { saved, draft };
}

export function changedStalls(saved, draft) {
  return Object.fromEntries(Object.entries(draft).filter(([id, value]) =>
    Object.hasOwn(saved, id) && JSON.stringify(normalizeStall(value)) !== JSON.stringify(saved[id] == null ? null : normalizeStall(saved[id]))
  ).map(([id, value]) => [id, { before: saved[id], after: normalizeStall(value) }]));
}
