import { requireClass } from './classes.js';
export const AGE_CATEGORIES = Object.freeze({
  junioren: { maxCalendarAge: 16, minimumAge: null, source: '§1.2 p.5' },
  young_riders: { maxCalendarAge: 21, minimumAge: null, source: '§1.2 p.5' },
  senioren: { minimumAge: null, source: '§1.2 p.5: Junioren/YR mogen bij senioren' },
  jeugd: { maxAgeOnJanuary1: 17, separateSectionMinimumEntries: 3, organizerDecisionRequired: true, source: '§1.2 p.5' },
});
function dateParts(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('Gebruik een geldige datum (JJJJ-MM-DD).');
  const d = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw new Error('Ongeldige datum.');
  return value.split('-').map(Number);
}
export function eligibility({ klasse, rubriek, birthDate, horseBirthDate, competitionDate }) {
  const c = requireClass(klasse); const [year] = dateParts(competitionDate);
  const errors = [], review = [];
  if (birthDate) {
    const [y, m, d] = dateParts(birthDate);
    if (birthDate > competitionDate) errors.push('Geboortedatum ligt na wedstrijddatum.');
    const calendarAge = year - y;
    const ageJan1 = calendarAge - (m > 1 || d > 1 ? 1 : 0);
    const cat = AGE_CATEGORIES[c.division];
    if (cat?.maxCalendarAge != null && calendarAge > cat.maxCalendarAge) errors.push(`Leeftijd past niet bij ${c.naam}.`);
    if (String(rubriek).toLowerCase() === 'jeugd' && ageJan1 > 17) errors.push('Jeugdrubriek: maximaal 17 jaar op 1 januari.');
  } else if (c.division !== 'open' || String(rubriek).toLowerCase() === 'jeugd') review.push('Geboortedatum ontbreekt; leeftijd/peildatum niet verifieerbaar.');
  if (horseBirthDate) {
    const [y, m, d] = dateParts(horseBirthDate);
    if (year - y - (m > 1 || d > 1 ? 1 : 0) < c.minHorseAge) errors.push(`Paard moet op 1 januari minimaal ${c.minHorseAge} jaar zijn.`);
  } else review.push('Geboortedatum paard ontbreekt; minimumleeftijd niet verifieerbaar.');
  return { errors, review, valid: errors.length === 0 };
}
