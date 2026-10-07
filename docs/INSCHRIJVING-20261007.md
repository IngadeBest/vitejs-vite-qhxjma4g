# Inschrijving: geboortedatum, stokmaat en stalling

## Vooraf onderzocht
- `src/features/inschrijven/pages/PublicInschrijven.jsx`: bestaand openbaar formulier, POST `/api/inschrijvingen`; bij volle wedstrijd/klasse POST `/api/wachtlijst`.
- `InschrijfFormulier.jsx`: bestaande handmatige invoer door beheer, rechtstreeks naar `inschrijvingen`. Ook bijgewerkt; geen tweede inschrijfflow toegevoegd.
- Supabase-tabellen `inschrijvingen` en `wachtlijst`: hadden `leeftijd_ruiter`, geen geboortedatum/stokmaat/stalaanvraag. Bestaande `stal_toewijzing` bevat de werkelijk toegewezen stal (JSON met `heeftStal` en `stalnummer`).
- `Deelnemers.jsx`: adminoverzicht en Wijzig-knop, desktop en mobiel. `DeelnemersInzage.jsx`: inzage voor wedstrijdmedewerkers.
- `WachtlijstBeheer.jsx` gebruikt `promoveer_wachtlijst`; ook `afmelden_deelnemer` kan die functie aanroepen. Doorplaatsen moest daarom de nieuwe gegevens meenemen.
- Startlijst, startlijstexports, scores en publieke uitslagen gebruiken expliciete kolomselecties/projecties. Deze berekeningen en exports zijn niet aangepast. Nieuwe geboortedata worden niet toegevoegd aan publieke uitslagen/exports.
- Bestaande Working Point `Card`, `Input`, `Button`, `Alert` en CSS hergebruikt. Het publieke formulier heeft lichte achtergrond, witte cards, donkerblauwe accenten, labels boven de velden en één kolom op mobiel. Op verzoek is ook de publieke navigatie volledig donkerblauw/wit; de eigen `reg-` CSS-prefix voorkomt vermenging met de beige proevenpagina.

## Opslag
Migratie: `supabase/migrations/20261007094643_registration_birth_height_stalls.sql`.
Toegepast op project Working Point (`hpfixcuxayjkfyhqbbnn`).

In beide tabellen:
- `geboortedatum_ruiter date` (bron voor leeftijd)
- `stokmaat_cm numeric(4,1)` (meer dan 0, maximaal 300)
- `stal_nodig boolean`
- `stalmaat text` (`klein`, `groot`, `geen_voorkeur`)

Alle nieuwe kolommen zijn nullable voor bestaande records; NULL betekent onbekend. Geen leeftijd omgezet naar een verzonnen geboortedatum. Nieuwe publieke en handmatige inschrijvingen eisen geboortedatum; de publieke API valideert dit ook. Nieuwe aanvragen zonder stal bewaren `false` en geen stalmaat. Een aanvraag met stal vereist zowel stokmaat als stalmaat, ook via databaseconstraints.

`leeftijd_ruiter` blijft bestaan voor oude afnemers; nieuwe waarden worden uitsluitend berekend uit geboortedatum, op de wedstrijddatum of bij ontbreken daarvan vandaag. Beheer toont de leeftijd opnieuw berekend; bestaande historische leeftijd zonder geboortedatum wordt niet gewijzigd. Er worden geen jeugdklassen automatisch gekozen.

`promoveer_wachtlijst` behoudt zijn transactie, capaciteitscontrole, rijlocks en beheerautorisatie. De functie kopieert nu ook de vier nieuwe velden en berekent leeftijd opnieuw op de wedstrijddatum.

## Beheer
Via **Deelnemers → Wijzig** kan de organisator geboortedatum, stokmaat, stalbehoefte en stalmaat aanpassen. Het overzicht toont de aanvraag met een badge. Toegewezen stal en stalnummer blijven apart onder **Toegewezen stal**. De update raakt geen startnummer, scores, omroepertekst, opmerkingen of stalnummer. Oude records kunnen worden aangepast zonder alsnog een geboortedatum te moeten invullen.

De wachtlijst toont dezelfde gegevens; het inzageoverzicht toont stalaanvraag en stokmaat. Geboortedatum blijft in beheer. Geen nieuw stalplanningssysteem gebouwd.

## Verificatie
- 227 tests geslaagd, inclusief bestaande startlijst-, score-, deelnemers-, protocol- en PDF-tests.
- Nieuwe tests: verplichte geboortedatum, ongeldige datums, verjaardag/leeftijd op wedstrijddatum, optionele hoogte zonder stal, verplichte hoogte/maat met stal, API-validatie en bewaren/herladen van beheerwijzigingen zonder gegevensverlies.
- Productiebuild geslaagd; bestaande waarschuwing over grote bundels blijft. Geen lint-script aanwezig; `git diff --check` geslaagd.
- Browser: vier secties, ontbrekende geboortedatum blokkeert, conditionele stalkeuzes en foutmeldingen, geen horizontale overflow bij 1280px en 390px.
- `scripts/verify_registration_details.sql` uitgevoerd in een teruggedraaide transactie met beheerdersrechten: insert/select roundtrip, stalmaatwijziging, databaseconstraints, oude records, geen stal zonder maat/hoogte en wachtlijstpromotie. Alle assertions geslaagd; geen testrecords achtergebleven.
- Publieke kolomrechten gecontroleerd: anon kan alleen id/wedstrijd_id/klasse lezen; `geboortedatum_ruiter` is niet publiek leesbaar. Geen RLS-beleid of leesrechten verruimd.
- Supabase advisor: geen melding over de gewijzigde tabellen/functie. Bestaande meldingen over afgesloten back-uptabellen, `v_klassen_labels`, wachtwoordbeveiliging en Postgres-versie vallen buiten deze wijziging. Zie [view-melding](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view), [wachtwoordbeveiliging](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) en [Postgres-upgrade](https://supabase.com/docs/guides/platform/upgrading).
