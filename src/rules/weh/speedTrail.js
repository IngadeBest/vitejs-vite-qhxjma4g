import { requireClass } from './classes.js';
import { RulesReviewRequired } from './metadata.js';
import { speedTime } from './scoring.js';
// Every correction has a type; bonuses are never stored as negative penalties.
const event = (id, label, seconds, kind = 'penalty', extra = {}) => Object.freeze({ id, label, seconds, kind, source: 'Bijlage 6 p.98–99', ...extra });
export const SPEED_EVENTS = Object.freeze([
 event('barrel_down', 'Vat omgereden (per vat)', 5),
 event('bridge_part_down', 'Onderdeel brug omver/afgeworpen', 5),
 event('slalom_pole_down', 'Slalompaal omgereden (per paal)', 3),
 event('jump_part_down', 'Onderdeel sprong afgeworpen', 5),
 event('pen_part_down', 'Onderdeel pen omver/afgeworpen', 5),
 event('backward_part_down', 'Onderdeel achterwaarts L/slalom met beker omver', 3),
 event('gate_part_down', 'Onderdeel poort omver', 10, 'penalty', { excludes: ['gate_all_down'] }),
 event('gate_all_down', 'Hele poort omver', 30, 'penalty', { excludes: ['gate_part_down'] }),
 event('bell_part_down', 'Onderdeel L/gang met bel omver', 5),
 event('sideways_pole_down', 'Zijwaartse balk afgeworpen', 7),
 event('sideways_wrong_leg', 'Voor- of achterbeen verkeerde kant balk', 5),
 event('garrocha_pickup_barrel_down', 'Vat garrocha uitnemen omver', 5),
 event('garrocha_return_barrel_down', 'Vat na terugzetten garrocha omver', 5),
 event('ring_returned', 'Gestoken ring met garrocha in vat teruggezet', 5, 'bonus'),
 event('ring_holder_down', 'Ringhouder / stier omvergereden', 5, 'penalty', { source: 'Werkafspraak gebruiker (RR02); formulier p.68 +5, bijlage p.90/99 +10', decisionStatus: 'user_agreed_pending_weh', decisionNote: 'RR02: +5 sec afgesproken; bevestiging WEH volgt. Ringhouder en stier zijn hier één gebeurtenis, geen dubbele straf.' }),
 event('jug_table_down', 'Tafel met kan omver', 5, 'review', { reviewRequired: 'RR05: p.90 niet in speed, p.98 afgeraden' }),
 event('junior_gate_unclosed', 'Junioren: poort niet gesloten', 15, 'penalty', { classes: ['junior'], failedObstacle: true }),
 event('junior_backward_failed', 'Junioren: achterwaarts L/slalom niet correct', 15, 'penalty', { classes: ['junior'], failedObstacle: true }),
 event('junior_garrocha_returned', 'Junioren: gevallen garrocha teruggegeven', 15, 'penalty', { classes: ['junior'] }),
 event('junior_cup_failed', 'Junioren: omhangen niet correct', 15, 'penalty', { classes: ['junior'], failedObstacle: true }),
 event('masters_second_hand', 'Masters: tweede hand gebruikt / paard aangeraakt', 5, 'penalty', { classes: ['we4'], disqualifyAt: 3 }),
 ...[
  ['wrong_course_uncorrected', 'Niet gecorrigeerde verkeerde lijn/volgorde'],
  ['third_refusal', 'Derde weigering/vergissing'],
  ['bridge_not_taken', 'Brug niet genomen of niet door hoeven aangeraakt'],
  ['pen_left', 'Pen voortijdig met vier benen verlaten'],
  ['cup_not_replaced', 'Beker niet op juiste paal teruggezet'],
  ['corridor_left', 'Gang/L met vier benen verlaten of achterwaarts te vroeg beëindigd'],
  ['bell_not_rung', 'Bel niet hoorbaar geluid'],
  ['garrocha_not_replaced', 'Garrocha niet correct opgepakt/teruggezet'],
  ['fall', 'Val ruiter of paard'],
  ['gate_unclosed', 'Poort niet gesloten (Junioren: afzonderlijke +15 regel)'],
 ].map(([id, label]) => event(id, label, null, 'disqualification', id === 'gate_unclosed' ? { excludesClasses: ['junior'] } : {})),
]);
export function speedEventRules(klasse) {
 const c = requireClass(klasse);
 if (!c.speedTrailRuleSetId) throw new Error(`${c.naam} rijdt geen Speedtrail.`);
 return SPEED_EVENTS.filter(r => (!r.classes || r.classes.includes(c.code)) && !r.excludesClasses?.includes(c.code));
}
export function calculateSpeed(klasse, riddenTime, events = []) {
 const c = requireClass(klasse);
 if (!c.speedTrailRuleSetId) throw new Error(`${c.naam} rijdt geen Speedtrail.`);
 let penaltySeconds = 0, bonusSeconds = 0, status = 'completed';
 const counts = new Map(), failedObstacles = new Set();
 for (const entry of events) {
  const rule = SPEED_EVENTS.find(r => r.id === entry.id);
  if (!rule) throw new Error(`Onbekende speedcorrectie: ${entry.id}`);
  if (rule.kind === 'review') throw new RulesReviewRequired(rule.reviewRequired);
  if (rule.classes && !rule.classes.includes(c.code) || rule.excludesClasses?.includes(c.code)) throw new Error('Correctie past niet bij deze klasse.');
  const count = entry.count ?? 1;
  if (!Number.isInteger(count) || count < 1) throw new Error('Aantal fouten moet een positief geheel getal zijn.');
  if (rule.failedObstacle) {
   if (entry.obstacleNumber == null || count !== 1) throw new Error('Registreer iedere mislukte hindernis afzonderlijk met hindernisnummer.');
   failedObstacles.add(String(entry.obstacleNumber));
  }
  counts.set(rule.id, (counts.get(rule.id) || 0) + count);
  if (rule.kind === 'disqualification') status = 'disqualified';
  if (rule.kind === 'penalty') penaltySeconds += rule.seconds * count;
  if (rule.kind === 'bonus') bonusSeconds += rule.seconds * count;
  if (rule.disqualifyAt && counts.get(rule.id) >= rule.disqualifyAt) status = 'disqualified';
 }
 // Mutually exclusive alternatives are scoped to an obstacle, not the entire course.
 for (const e of events) {
  const rule = SPEED_EVENTS.find(r => r.id === e.id);
  if (rule.excludes?.some(id => events.some(other => other.id === id && other.obstacleNumber === e.obstacleNumber))) throw new Error('Hele poort en losse delen van dezelfde poort mogen niet dubbel geteld worden.');
 }
 if (c.code === 'junior' && failedObstacles.size > 2) status = 'disqualified';
 const finalTime = speedTime(riddenTime, penaltySeconds, bonusSeconds);
 return { riddenTime, penaltySeconds, bonusSeconds, finalTime: status === 'completed' ? finalTime : null, status, events };
}
