// WEH 2026 v10 §2.3–2.5; totals stay unrounded until display.
export const SCORE_RANGE = Object.freeze({ min: 0, max: 10, step: 0.5 });
export const RESULT_STATUSES = Object.freeze(['completed', 'disqualified', 'eliminated', 'not_started', 'pending', 'hors_concours']);
export function assertMark(mark) {
  if (typeof mark !== 'number' || !Number.isFinite(mark) || mark < 0 || mark > 10 || !Number.isInteger(mark * 2)) throw new Error('Een cijfer moet 0–10 zijn in stappen van 0,5.');
  return mark;
}
export function weightedMaximum(items) { return items.reduce((sum, item) => sum + 10 * (item.coefficient ?? 1), 0); }
export function scoreMarks(items, marks, { mistakes = 0, deduction = 0 } = {}) {
  if (items.length !== marks.length) throw new Error('Het aantal cijfers klopt niet met het protocol.');
  if (!Number.isInteger(mistakes) || mistakes < 0 || mistakes > 3) throw new Error('Ongeldig aantal vergissingen.');
  if (!Number.isFinite(deduction) || deduction < 0 || !Number.isInteger(deduction * 2)) throw new Error('Ongeldige puntenaftrek.');
  const raw = items.reduce((sum, item, i) => sum + assertMark(marks[i]) * (item.coefficient ?? 1), 0);
  const penalties = Math.min(mistakes, 2) * 5 + deduction;
  const max = weightedMaximum(items);
  return { raw, penalties, score: mistakes === 3 ? null : raw - penalties, max,
    percentage: mistakes === 3 ? null : (raw - penalties) / max * 100,
    status: mistakes === 3 ? 'disqualified' : 'completed' };
}
export function parseTime(value) {
  const s = String(value ?? '').trim().replace(',', '.');
  if (!s) throw new Error('Vul een tijd in.');
  if (/^\d+(?:\.\d{1,2})?$/.test(s)) return Number(s);
  const m = s.match(/^(\d+):([0-5]\d)(?::(\d{2})|\.(\d{1,2}))?$/);
  if (!m) throw new Error('Gebruik seconden, mm:ss of mm:ss:hh (honderdsten).');
  return Number(m[1]) * 60 + Number(m[2]) + Number(m[3] || (m[4] || '').padEnd(2, '0')) / 100;
}
export function formatTime(seconds) {
  if (seconds == null) return '';
  if (!Number.isFinite(seconds)) return '—';
  const value = Math.round(Math.abs(seconds) * 100);
  return `${seconds < 0 ? '-' : ''}${String(Math.floor(value / 6000)).padStart(2, '0')}:${String(Math.floor(value / 100) % 60).padStart(2, '0')}:${String(value % 100).padStart(2, '0')}`;
}
export function speedTime(ridden, penaltySeconds = 0, bonusSeconds = 0) {
  for (const n of [ridden, penaltySeconds, bonusSeconds]) if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) throw new Error('Gereden tijd, straftijd en bonustijd moeten afzonderlijke niet-negatieve getallen zijn.');
  return Math.round((ridden + penaltySeconds - bonusSeconds) * 100) / 100;
}
export function placingPoints(place, dressageStarterCount) {
  if (!Number.isInteger(place) || place < 1 || !Number.isInteger(dressageStarterCount) || dressageStarterCount < place) throw new Error('Ongeldige plaats of deelnemersaantal.');
  return place === 1 ? dressageStarterCount + 1 : dressageStarterCount - place + 1;
}
export function resultStatus(score) {
  if (!score) return 'pending';
  if (score.result_status) {
    if (!RESULT_STATUSES.includes(score.result_status)) throw new Error('Onbekende resultaatstatus.');
    return score.result_status;
  }
  return score.dq ? 'disqualified' : score.score == null ? 'pending' : 'completed';
}
