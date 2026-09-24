import { getClass, normalizeComponent, supportsComponent } from './classes.js';
import { dressageMaximum } from './dressage.js';
import { styleMaximum, styleRules } from './styleTrail.js';
export function validateTest({ klasse, onderdeel, max_score, obstacleCount, dressageTestId }) {
 const errors = [], review = [], c = getClass(klasse), component = normalizeComponent(onderdeel);
 if (!c) return { errors: ['Onbekende WEH-klasse.'], review, valid: false };
 if (!supportsComponent(klasse, onderdeel)) errors.push('Onderdeel niet toegestaan voor deze klasse.');
 if (component === 'Dressuur') {
  if (dressageTestId && dressageTestId !== c.dressageTestId) errors.push('Dressuurproef hoort niet bij deze klasse.');
  if (Number(max_score) !== dressageMaximum(klasse)) errors.push(`Officiële maximumscore is ${dressageMaximum(klasse)}.`);
 }
 if (component === 'Stijltrail') {
  if (obstacleCount != null) {
   try { if (Number(max_score) !== styleMaximum(klasse, obstacleCount)) errors.push('Maximumscore klopt niet met het aantal hindernissen en algemene punten.'); }
   catch (e) { (e.name === 'RulesReviewRequired' ? review : errors).push(e.message); }
  } else {
   const rules = styleRules(klasse);
   if (!rules.generalPoints) review.push('REVIEW REQUIRED — RR08: algemene stijlpunten niet vastgesteld.');
   else {
    const impliedCount = Number(max_score) / 10 - rules.generalPoints.length;
    try { styleMaximum(klasse, impliedCount); } catch (e) { errors.push(e.message); }
    review.push('Hindernissen en varianten vereisen daarnaast controle van het parcours.');
   }
  }
 }
 return { errors, review, valid: errors.length === 0 };
}
export function validateTotal({ klasse, onderdeel, score, max_score }) {
 const test = validateTest({ klasse, onderdeel, max_score });
 const errors = [...test.errors];
 if (typeof score !== 'number' || !Number.isFinite(score)) errors.push('Score moet een geldig getal zijn.');
 else if (normalizeComponent(onderdeel) !== 'Speedtrail') {
  if (!(Number(max_score) > 0) || score > Number(max_score) || !Number.isInteger(score * 2)) errors.push('Ongeldige totaalscore: controleer maximum, halve punten en aftrek.');
 }
 return { ...test, errors, valid: errors.length === 0 };
}
