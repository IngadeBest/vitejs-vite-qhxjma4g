import React from 'react';
import { Card } from '@/ui/card';
import { TERMS_URL, PRIVACY_URL } from './termsAcceptance';
import './legal.css';
export default function TermsAcceptanceCard({ accepted, onChange, error }) {
  return <Card className="reg-form-card wp-legal-acceptance">
    <h2><span>05</span> Voorwaarden &amp; privacy</h2>
    <p>Je inschrijving reserveert een plaats voor jou en je paard. Kun je toch niet deelnemen? Meld je dan zo snel mogelijk af. Afmelding, niet kunnen starten, uitsluiting of diskwalificatie geeft niet automatisch recht op terugbetaling van inschrijf- of eventuele stallingskosten. De voorwaarden van de organiserende organisatie en het geldende wedstrijdreglement zijn van toepassing.</p>
    <label className="wp-legal-check"><input type="checkbox" required checked={accepted} onChange={e => onChange(e.target.checked)} aria-invalid={!!error} aria-describedby={error ? 'terms-error' : undefined} /><span>Ik heb de <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">Algemene voorwaarden voor inschrijving via Working Point</a> gelezen en ga hiermee akkoord. *</span></label>
    {error && <p id="terms-error" className="wp-legal-error" role="alert">{error}</p>}
    <div className="wp-legal-privacy"><h3>Privacy</h3><p>We gebruiken je gegevens om je inschrijving en deelname aan de wedstrijd te verwerken. Contactgegevens en je volledige geboortedatum worden niet openbaar gepubliceerd. Lees in onze <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">privacyverklaring</a> welke gegevens we verwerken en waarom.</p></div>
    <small>De links openen in een nieuw tabblad. Je ingevulde gegevens blijven hier staan.</small>
  </Card>;
}
export function AcceptanceEvidence({ registration }) {
  if (!registration.terms_accepted || !registration.terms_accepted_at) return <p className="wp-legal-evidence">Geen voorwaardenacceptatie geregistreerd (bestaande of handmatige inschrijving).</p>;
  const date = new Date(registration.terms_accepted_at);
  return <p className="wp-legal-evidence">Voorwaarden geaccepteerd: {Number.isNaN(date.getTime()) ? 'datum onbekend' : new Intl.DateTimeFormat('nl-NL', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Amsterdam' }).format(date)} – versie {registration.terms_version}</p>;
}
