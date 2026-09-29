# Actuele werkbasis — 29 september 2026

Werk voortaan in `protocollen-live`, branch `codex/scoreverwerking`.
De andere worktrees zijn bewaard als bronarchief; ontwikkel daar niet verder zonder
eerst te vergelijken met deze werkbasis. Ze zijn niet verwijderd of teruggezet.

## Veiligstelling en geschiedenis

- Backup: `../consolidatie-backup-20260929-092651/`.
- Iedere worktree heeft een archief van tracked en niet-genegeerde untracked
  bestanden, HEAD, status en patches voor werkmap/index. Genegeerde bestanden
  zoals lokale omgevingsbestanden en node_modules zijn niet gekopieerd; ze blijven
  op hun bestaande locatie staan. Dit is een codebackup, geen databasebackup.
- `repository.bundle` bevat de volledige lokale Git-historie en is geverifieerd.
- De lokale wijzigingen uit `protocollen-live` zijn aanvullend als stash bewaard
  met bericht `Consolidatie 2026-09-29: veiliggestelde lokale publieke uitslagen en los inschrijvingsconcept`.
  Deze stash niet integraal terugzetten: de publieke uitslagen staan al in main.
- GitHub-main gecontroleerd/opgehaald: `a567688`.
- Merge `21bfdd6` verbindt main met de bestaande scoreverwerkingsbranch.
  Alle vooraf bestaande lokale applicatiewijzigingen waren byte-identiek aan
  de overeenkomstige bestanden op main. Zowel SCOREVERWERKING.md als
  PUBLIEKE-UITSLAGEN.md zijn behouden.

## Gericht overgenomen

### Startlijst en deelnemers

- Alle eerdere transactionele startlijst-, afmeld-, wachtlijst- en stalreparaties
  blijven behouden. Geen DELETE-stap toegevoegd aan startlijst opslaan.
- Backupherstel richt zich op de geselecteerde wedstrijd, weigert onbekende
  klassen en behoudt rubriek (ook historische ` - Jeugd`-labels) en startnummer.
- De ongebruikte historische rollbackfunctie met een vast wedstrijd-ID is verwijderd.
- Centrale klasseherkenning en klasselijsten uit startlijst-herstel overgenomen;
  onbekende klassen worden niet onderling als gelijk behandeld.
- Klasse en rubriek afzonderlijk wijzigen in deelnemersbeheer; weergave en
  filters gebruiken dezelfde normalisatie. Bestaande scores blokkeren een
  klasse-/rubriekwijziging via deze editor. Alleen klasse, rubriek en paard worden
  bijgewerkt; overige inschrijfgegevens blijven behouden.
- Formulieren, uitslagselectoren en wedstrijdbeheer hergebruiken CLASS_OPTIONS.
  Publieke uitslagen/publicatiebeheer en de recentste scorevolgorde zijn behouden.

### Wachtwoordherstel

- Herstelpagina en eigen CSS uit app overgenomen en aangepast aan de huidige ingang.
- Herstelroutes worden vóór de normale router, wedstrijdcontext en domeinredirect
  afgehandeld. De drie bestaande padnamen worden ondersteund, ook als hashroute.
- Supabase-clientinitialisatie wordt afgewacht om een code niet tweemaal te
  verbruiken; PKCE-exchange is een terugval wanneer nog geen sessie bestaat.
- Verlopen links blijven geblokkeerd; fout bij opslaan geeft een herhaalbare melding.
- Lokale tests gebruiken gemockte Auth-antwoorden. Geen echte wachtwoorden
  gewijzigd, geen herstelmails verzonden of Auth-configuratie aangepast.

## Bewust niet overgenomen

| Bronwerk | Besluit / reden |
| --- | --- |
| app: onderhoudssluiting cd79567 | Zou inschrijven ongewenst sluiten. |
| app: e1f78d4 integraal | Wachtlijstrechten en transacties zijn later anders opgelost; oude API niet terugbrengen. De ontbrekende historische beveiligingsmigratie niet blind opnieuw uitvoeren. |
| app: oude startlijstopslag | Bevat DELETE-logica die deelnemers kan wissen; vervangen door huidige RPC-flow. |
| app: Supabase-sessieconfiguratie/protocolnormalisatie | Functioneel al verwerkt. |
| startlijst-live-fix | Alle commits al opgenomen; schone werkmap. |
| startlijst-herstel: protocol/PDF/calculator/regelmodules die identiek zijn | Al verwerkt; niet opnieuw kopiëren. |
| startlijst-herstel: oudere scoreData, ScoreInvoer en rankings | Zouden serverimports en recente sorteringscorrecties terugdraaien. |
| startlijst-herstel: 20260921131115_weh_score_details.sql | Opgevolgd door 20260924131811_score_processing.sql; constraintnamen overlappen. Niet uitvoeren. |
| startlijst-herstel: inschrijvings-API-validatie/duplicaten/capaciteit | Bewaard voor de uitgestelde inschrijvingsverbetering; verandert bestaand gedrag. |
| startlijst-herstel: proefinstellingen | Nog inhoudelijk beoordelen: vaste dressuurmaxima en nieuwe validatieblokkades. |
| startlijst-herstel: trailgenerator, JSON-generator en gegenereerde data | Nog inhoudelijk beoordelen: strengere exportvalidatie en open regels voor Junioren/YR kunnen bestaande exports blokkeren. Niet los van elkaar overnemen. |
| startlijst-herstel: oud lokaal wedstrijddashboard | Afzonderlijk oud scherm; geen vereiste voor de actuele beheerflow. |
| WEH_RULEBOOK_AUDIT.md | Historische audit met inmiddels deels achterhaalde blokkades; bewaard bij de bron en in de backup. |
| registrationDetails.js van 28 september | Ongebruikt inschrijvingsconcept, uitsluitend in backup/stash; geen geboortedatum-/staluitbreiding geactiveerd. |

## Verificatie en grenzen

- Beginstand na merge: 184 bestaande tests geslaagd.
- Eindstand: 202 tests geslaagd, inclusief nieuwe tests voor backupherstel,
  onbekende klassefilters, klasse/rubriek wijzigen en opnieuw laden, behoud van
  andere inschrijfvelden, blokkeren bij bestaande scores, transactioneel afmelden,
  RPC-fouten, herstelroutes, verlopen links en herhalen na een netwerkfout.
- Bestaande regressies voor volgorde, pauzes, voorloopnullen, opnieuw opslaan met
  dezelfde IDs, lege lijst zonder cacheherstel, scoreverwerking en PDF's slagen.
- Productiebuild geslaagd. Bestaande waarschuwing voor grote bundels blijft bestaan;
  dit bewijst niet dat de eerder gemelde tijdelijke vertraging hierdoor kwam.
- Browser: lokale herstelpagina op desktop en 390px mobiel, geen horizontale
  documentoverflow of Vite-overlay; login/startpagina en navigatie naar Uitslagen
  werken zonder JavaScript-fouten. Geen echte beheerlogin of PDF-export met live
  gegevens uitgevoerd; PDF-regressies en gegevensmutaties zijn lokaal getest.
- Geen lintscript aanwezig. `git diff --check` geslaagd.
- Geen databasewijzigingen of migraties uitgevoerd; geen nieuwe live SQL-roltests.
- Geen push of deployment uitgevoerd. Productie gebruikt nog de bestaande release.

## Verder werken

De actieve lokale basis is samengebracht en kan gericht worden gepubliceerd na
releasecontrole. Eerst eventuele proef-/parcourskeuzes beoordelen wanneer die
nodig zijn; de afgesproken inschrijvingsverbetering is een afzonderlijk vervolg.
Voer historische migratiemappen nooit in hun geheel opnieuw uit.
