export const STALMATEN = { klein: 'Kleine stal', groot: 'Grote stal', geen_voorkeur: 'Geen voorkeur' };
export const emptyRegistrationDetails = { geboortedatum_ruiter: '', stokmaat_cm: '', stal_nodig: false, stalmaat: '' };
export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function riderAge(birth, wedstrijdDatum) {
  const reference = wedstrijdDatum?.slice(0,10) || todayKey();
  if (!validDate(birth) || !validDate(reference) || birth > reference) return null;
  return Number(reference.slice(0,4)) - Number(birth.slice(0,4)) - (reference.slice(5) < birth.slice(5) ? 1 : 0);
}
export function registrationErrors(form, { requireBirth = true } = {}) {
  const errors = {};
  if (!form.geboortedatum_ruiter) {
    if (requireBirth) errors.geboortedatum_ruiter = 'Vul de geboortedatum van de ruiter in.';
  } else if (!validDate(form.geboortedatum_ruiter) || form.geboortedatum_ruiter > todayKey()) {
    errors.geboortedatum_ruiter = 'Vul een geldige geboortedatum in die niet in de toekomst ligt.';
  }
  const hasHeight = form.stokmaat_cm !== '' && form.stokmaat_cm != null;
  if (hasHeight && (!['string','number'].includes(typeof form.stokmaat_cm) || !/^\d+(\.\d)?$/.test(String(form.stokmaat_cm)) || Number(form.stokmaat_cm) <= 0 || Number(form.stokmaat_cm) > 300)) {
    errors.stokmaat_cm = 'Vul een geldige stokmaat in cm in (meer dan 0 en maximaal 300).';
  } else if (form.stal_nodig === true && !hasHeight) errors.stokmaat_cm = 'Vul de stokmaat in cm in als je een stal aanvraagt.';
  if (form.stal_nodig != null && typeof form.stal_nodig !== 'boolean') errors.stal_nodig = 'Kies Ja of Nee voor stalling.';
  if (form.stal_nodig === true && !Object.hasOwn(STALMATEN, form.stalmaat)) errors.stalmaat = 'Kies welke stal je nodig hebt.';
  return errors;
}
export function registrationPayload(form, wedstrijdDatum) {
  return {
    geboortedatum_ruiter: form.geboortedatum_ruiter || null,
    leeftijd_ruiter: riderAge(form.geboortedatum_ruiter, wedstrijdDatum),
    stokmaat_cm: form.stokmaat_cm === '' || form.stokmaat_cm == null ? null : Number(form.stokmaat_cm),
    stal_nodig: form.stal_nodig ?? null,
    stalmaat: form.stal_nodig === true ? form.stalmaat : null,
  };
}
