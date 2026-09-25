import { requireClass, resultClassKey, normalizeComponent } from './classes.js';
import { placingPoints, resultStatus, formatTime } from './scoring.js';
// Missing input is pending, never evidence that the rider voluntarily did not start.
export function calculateStandings({ klasse, participants, tests, scores }) {
 const c = requireClass(klasse), classKey = resultClassKey(klasse);
 const components = c.requiredComponents;
 const selectedTests = tests.filter(t => resultClassKey(t.klasse, t.rubriek) === classKey);
 const testByComponent = new Map();
 for (const component of components) {
  const candidates = selectedTests.filter(t => normalizeComponent(t.onderdeel) === component);
  if (candidates.length > 1) throw new Error(`Meerdere proeven voor ${component}; kies expliciet welke voor het klassement geldt.`);
  testByComponent.set(component, candidates[0]);
 }
 const selected = participants.filter(p => (!p.deelnemer_status || p.deelnemer_status === 'actief') && resultClassKey(p.klasse, p.rubriek) === classKey);
 const ids = selected.map(p => String(p.id));
 if (new Set(ids).size !== ids.length) throw new Error('Dubbele startnummers: uitslag kan niet betrouwbaar worden gekoppeld.');
 const rows = selected.map(p => {
  const onderdelen = {};
  let eliminated = false;
  for (const component of components) {
   const test = testByComponent.get(component);
   const matches = test ? scores.filter(s => String(s.proef_id) === String(test.id) && String(s.ruiter_id) === String(p.id)) : [];
   if (matches.length > 1) throw new Error('Dubbele scores voor dezelfde deelnemer en proef.');
   const s = matches[0], recordedStatus = resultStatus(s);
   if (eliminated && recordedStatus === 'completed') throw new Error('Een deelnemer met eliminatie kan geen volgend onderdeel uitrijden; controleer de resultaatstatussen.');
   const hc = p.hors_concours || scores.some(entry => String(entry.ruiter_id) === String(p.id) && selectedTests.some(t=>String(t.id)===String(entry.proef_id)) && entry.result_status === 'hors_concours');
   const status = hc ? 'hors_concours' : eliminated ? 'eliminated' : recordedStatus;
   if (status === 'eliminated') eliminated = true;
   const value = s?.score == null ? null : Number(s.score);
   const max = Number(test?.max_score);
   if (status === 'completed' && (!Number.isFinite(value) || (component !== 'Speedtrail' && !(max > 0)))) throw new Error('Ongeldige score of ontbrekend proefmaximum.');
   const percentage = component === 'Speedtrail' || value == null || !(max > 0) ? null : value / max * 100;
   onderdelen[component] = { status, dq: status === 'disqualified', punten: value, tijd: value,
    percentage, plaatsingspunten: 0,
    scoreLabel: status !== 'completed' ? ({disqualified:'DQ', eliminated:'EL', not_started:'NS', pending:'Nog niet ingevoerd', hors_concours:'HC'})[status]
     : component === 'Speedtrail' ? formatTime(value) : `${value} (${percentage.toFixed(1)}%)` };
  }
  return { ...p, onderdelen, totaalpunten: 0, dqCount: Object.values(onderdelen).filter(s => s.status === 'disqualified').length };
 });
 const pending = rows.some(r => components.some(o => r.onderdelen[o].status === 'pending'));
 const n = rows.filter(r => !['not_started', 'pending', 'hors_concours'].includes(r.onderdelen.Dressuur.status)).length;
 for (const component of components) {
  const eligible = rows.filter(r => r.onderdelen[component].status === 'completed');
  const value = r => component === 'Speedtrail' ? r.onderdelen[component].tijd : r.onderdelen[component].percentage;
  eligible.sort((a,b) => component === 'Speedtrail' ? value(a)-value(b) : value(b)-value(a));
  let place = 0, previous;
  eligible.forEach((r,i) => {
   const v = value(r); if (i===0 || v!==previous) place = i+1;
   r.onderdelen[component].plaats = String(place);
   // Until all dressage statuses are recorded, N is not yet reliable.
   if (!rows.some(x => x.onderdelen.Dressuur.status === 'pending') && place <= n) r.onderdelen[component].plaatsingspunten = placingPoints(place,n);
   previous = v;
  });
 }
 function tier(r) {
  const statuses = components.map(o=>r.onderdelen[o].status);
  if (statuses.includes('hors_concours')) return 5;
  if (statuses.includes('eliminated')) return 3;
  if (statuses.includes('pending')) return 4;
  if (statuses.includes('not_started')) return 2;
  if (statuses.includes('disqualified')) return 1;
  return 0;
 }
 const dressageValue = r => r.onderdelen.Dressuur.status === 'completed' ? r.onderdelen.Dressuur.percentage : -Infinity;
 for (const r of rows) r.totaalpunten = components.reduce((s,o)=>s+r.onderdelen[o].plaatsingspunten,0);
 rows.sort((a,b) => tier(a)-tier(b) || b.totaalpunten-a.totaalpunten || dressageValue(b)-dressageValue(a));
 let place=1;
 rows.forEach((r,i)=>{
  const prev=rows[i-1];
  if (!prev || tier(r)!==tier(prev) || r.totaalpunten!==prev.totaalpunten || dressageValue(r)!==dressageValue(prev)) place=i+1;
  r.plaats = pending ? 'voorlopig' : tier(r)===5 ? 'HC' : String(place);
 });
 return { onderdelen: [...components], eindstand: rows, preliminary: pending, dressageStarterCount: n };
}
