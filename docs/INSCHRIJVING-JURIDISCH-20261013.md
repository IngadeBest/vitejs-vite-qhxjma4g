# Openbare voorwaarden en privacy — controle 13 oktober 2026

## Oorzaak en bestaande implementatie
De productieversie op Vercel en GitHub main waren nog d57a421 (blauwe huisstijl). De juridische pagina's, routes, acceptatiekaart, API-validatie en beheerweergave stonden alleen lokaal en waren niet gecommit/gepubliceerd. Supabase bevat de akkoordvelden op beide tabellen al.

## Aangevuld
- Direct onder de formuliertitel openbare links naar voorwaarden en privacy, in nieuwe tabs.
- Bestaande kaart hergebruikt als 05 Voorwaarden & privacy na Stalling.
- Bestaande verplichte voorwaardencheckbox en inline validatie behouden, zonder privacytoestemming.
- Beide API's controleren true plus actuele versie; het tijdstip wordt serverzijdig bepaald.
- Privacytekst bijgewerkt met de door de eigenaar vastgestelde termijnen en mijn.host. Nog niet ingerichte automatische opschoning en open afspraken blijven expliciet vermeld.

## Opslag en compatibiliteit
inschrijvingen en wachtlijst gebruiken terms_accepted, terms_version en terms_accepted_at. Migration 20261007103253_registration_terms_acceptance.sql was al toegepast; geen dubbele velden of nieuwe migration nodig. De beheerweergave toont het oorspronkelijke akkoord. Bestaande/handmatige records mogen null houden; er wordt geen historisch akkoord verzonnen. Wachtlijstpromotie kopieert versie en tijdstip.

## Verificatie
- 241 tests in 27 bestanden geslaagd; productiebuild geslaagd. Bestaande jsPDF/chunkwaarschuwingen en DOM-waarschuwing startlijst, geen nieuwe buildfouten. Geen lintscript aanwezig.
- Tests omvatten ontbrekend/onjuist/verouderd akkoord, vervalst clienttijdstip, wachtlijst, legacy-records, deelnemerwijzigingen en startlijst opslaan/herladen.
- Supabase transactie-test daadwerkelijk uitgevoerd en teruggedraaid: opslaan/herladen akkoord, beheerwijziging, onvolledig bewijs afwijzen, oude records en beide soorten wachtlijstpromotie geslaagd. Geen testinschrijvingen of e-mails achtergelaten.
- Anonieme INSERT-rechten op beide tabellen zijn false; publiek kan API-validatie niet omzeilen via rechtstreeks invoegen.
- Browser lokaal: links direct zichtbaar, voorwaarden in aparte tab geopend en naam behouden, document toegankelijk zonder login, inline foutmelding zonder akkoord. Desktop en smalle weergave visueel bekeken; effectieve smalle browserbreedte was 509px.
- Een echte positieve inschrijving via de productieknop (inclusief mail naar organisator) is niet uitgevoerd. Formulier/API zijn geautomatiseerd getest; databaseopslag afzonderlijk op Supabase met rollback.

## Afzonderlijk open
Automatische bewaartermijnen, opschoning van back-ups/logs/mail en verdere verwerkersafspraken zijn niet afgerond. De eerder voorbereide retention-migration, cron en resultaatwijzigingen horen niet bij deze gerichte publicatie. De private retention-functie bestaat nog niet in productie.
