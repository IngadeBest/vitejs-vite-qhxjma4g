# Publieke uitslagen

De publieke route `/results/:eventId` is onafhankelijk van login, wedstrijdcontext en beheerbundel. Een Vercel rewrite maakt ook rechtstreeks openen mogelijk. De pagina haalt elke 20 seconden `/api/results` op. Ontpubliceren en verbindingsfouten verwijderen eerder geladen resultaten; er worden geen uitslagen lokaal opgeslagen.

De API gebruikt de bestaande `calculateStandings` en deelnemers/proefnormalisatie van het dashboard. Geen tweede scoreberekening. Alleen expliciete resultaatvelden worden teruggegeven. Lege onderdelen blijven verborgen, jeugd staat apart, gelijke plaatsen blijven behouden. Definities met conflicterende proeven worden niet gerangschikt.

In Wedstrijdbeheer staan publicatie, publieke link, kopiëren, QR-code, PNG-download en printen. Definitief maken gebeurt per proef. Goedkeuring wordt gekoppeld aan een SHA-256 van de relevante klassegegevens. Een wijziging in score, deelnemer of proef maakt de goedkeuring ongeldig; de organisatie moet de gewijzigde klasse opnieuw goedkeuren. Dit voorkomt dat gewijzigde tussenstanden als goedgekeurde einduitslag worden getoond.

## Database en runtime

Migratie: `supabase/migrations/20260925155938_public_results.sql`.

- `public_result_settings`: standaard niet gepubliceerd; RLS alleen voor bestaande admins.
- Geen anonieme toegang tot ruwe scores.
- Anonieme inschrijvingslezers mogen alleen id/wedstrijd_id/klasse lezen voor de bestaande capaciteitstellingen. Namen, contactgegevens en opmerkingen zijn afgeschermd.
- Server vereist `SUPABASE_URL` (of bestaande `VITE_SUPABASE_URL`) en `SUPABASE_SERVICE_ROLE_KEY` (of bestaande `SUPABASE_KEY`). De serversleutel mag nooit een VITE-prefix krijgen.
- Beheervoorbeeld controleert het toegangstoken via Supabase Auth en de bestaande admin-tabel. Geen admincontrole via bewerkbare gebruikersmetadata.
- Responses hebben `no-store`; intrekken van publicatie wordt opnieuw gecontroleerd na het lezen van scores.

## Verificatie

- 178 regressietests geslaagd op de nieuwste inlogversie; productiebuild geslaagd.
- Nieuwe tests: gelijke plaatsen, speedvolgorde, privacyvelden, jeugd, lege proeven, statussen, definitieve goedkeuring en gewijzigde scores, paginering, publicatie intrekken, admincontrole, polling en herstel na netwerkfouten/time-outs.
- Migratie uitgevoerd in tijdelijke PGlite-database: anon weigering, toegestane inschrijftelling, adminbeheer, niet-admin weigering, service-toegang en cascade gecontroleerd.
- Publieke browserweergave met fixturegegevens gecontroleerd op 390 en 320 px; geen horizontale overflow, onderdeelkeuze en strafseconden zichtbaar; alleen publieke API-aanroepen.
- Onstwedde A4-poster en PNG: QR uit zowel PNG als gerenderde PDF succesvol gedecodeerd naar de permanente event-URL.

## Live-uitrol 26 september 2026

- Migratie toegepast en privileges live gecontroleerd: anon heeft geen toegang tot ruwe scores, e-mail of publicatie-instellingen; inschrijftellingen blijven toegestaan.
- Onstwedde (26-09-2026) gepubliceerd, overige wedstrijden standaard niet gepubliceerd.
- Release `ad1adcc`; routecorrectie `fdbf67d`: met Vercel `cleanUrls` moet de rewrite naar `/` wijzen. De oorspronkelijke `/index.html` gaf op productie een 404.
- Exacte geprinte QR-link na herstel HTTP 200, in verse browser zonder account: wedstrijdnaam en actuele resultaten zichtbaar, geen beheerheader, 390 px breed zonder overflow.
- Publieke API getest met echte Onstwedde-data: gepubliceerde wedstrijd, vijf dressuursecties, geen rangschikkingsfouten; bestaande 178 tests en productiebuild geslaagd.

## Totaal klassement

De publieke pagina opent per klasse met Totaal. Rangorde, plaatsen en totale plaatsingspunten worden rechtstreeks uit dezelfde `calculateStandings`-uitkomst als het dashboard geprojecteerd. Iedere combinatie toont ook het resultaat en de plaatsingspunten per onderdeel. Ontbrekende scores houden totaalplaatsen voorlopig. Het totaal is pas definitief wanneer alle vereiste onderdelen voor de klasse definitief zijn goedgekeurd. De bestaande QR-code en URL blijven geldig.
