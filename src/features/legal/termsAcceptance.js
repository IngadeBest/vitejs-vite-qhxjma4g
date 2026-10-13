export const TERMS_VERSION = '2026-10-07';
export const TERMS_URL = `/#/algemene-voorwaarden/${TERMS_VERSION}`;
export const PRIVACY_URL = '/#/privacy';
export function termsError(value) {
  if (value.terms_accepted !== true) return 'Lees de algemene voorwaarden en vink aan dat je hiermee akkoord gaat.';
  if (value.terms_version !== TERMS_VERSION) return 'De voorwaarden zijn gewijzigd. Open de actuele voorwaarden en bevestig je akkoord opnieuw.';
  return '';
}
// Only the server calls this for persistence. Never accept a timestamp from the browser.
export function acceptanceRecord(value, now = new Date()) {
  const error = termsError(value);
  if (error) throw new Error(error);
  return { terms_accepted: true, terms_version: TERMS_VERSION, terms_accepted_at: now.toISOString() };
}
