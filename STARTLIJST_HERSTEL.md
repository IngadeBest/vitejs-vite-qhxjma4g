# Startlijsten: oorzaak, herstel en controle

## Status

De reparatie staat op `codex/startlijst-rechten-herstel`, gebaseerd op de actuele
`origin/main` (`55e343d`). De oorspronkelijke werkmap op
`Autorisatie-administratie` bevatte oudere code en lokale wijzigingen; die zijn
ongemoeid gelaten. Deze werkmap bevat de reparatie voor het actuele dashboard.

**Gepubliceerd op 19 september 2026.** Productiecommit `74a3d73` staat op
`main`; Vercel deployment `dpl_9XEKoDpy4djgjXinTZDNDmqdxgMK` is READY en gekoppeld
aan `app.workingpoint.nl`, `workingpoint.nl` en `www.workingpoint.nl`.
Beide nieuwe migrations zijn blijvend toegepast op `hpfixcuxayjkfyhqbbnn`.
Daarna zijn de SQL-roltests opnieuw uitgevoerd tegen de geïnstalleerde functies,
in een transactie met ROLLBACK; alle controles slaagden.

Vooraf is een afgeschermde lokale herstelkopie gemaakt in
`../herstelkopie-startlijsten-20260919/business-data-and-policies.json`.
Deze bevat de negen bedrijfstabellen, policies en grants en staat niet in Git.
SHA256: `7c664837c29835a3c4d728de1f04db244dcd93a62b4d28f35c237ed12f8c6886`.
Na publicatie zijn ALLE rijen en velden uit alle negen tabellen vergeleken met
deze kopie: exact gelijk. Aantallen: 148 inschrijvingen, 6 wedstrijden,
153 scores, 41 proeven, 24 ruiters, 2 admins, 0 wachtlijstregels,
0 legacy-startlijsten en 0 proeven_items. Geen testregels achtergebleven.
SERIAL/IDENTITY-reeksen kunnen wel oplopen door rollback-tests.
Dit bewijst behoud gedurende deze uitrol, niet dat vóór de eerste controle
nooit gegevens zijn gewijzigd door de eerdere fout.

De twee bevestigde beheeraccounts staan in `public.admins`:
`info@ingadebest.nl` en `info@jenniferdekiewit.nl`.

Het migratiescript weigert zonder expliciete bestandsnamen te starten.
De bestaande GitHub-workflow roept het zonder argumenten aan en stopt daarom
veilig met een fout, voordat SQL draait. De huidige GitHub-token mist de scope
om de workflow zelf te wijzigen; historische migraties worden niet herhaald.

## Exacte oorzaak

1. De actieve frontend gebruikte de publieke Supabase-client zonder beheerderslogin
   (`persistSession: false`). Een beheermenu of `app.`-subdomein is geen authenticatie.
2. RLS stond aan, maar `inschrijvingen` en `wedstrijden` hadden permissieve
   schrijfpoli­cies uitsluitend voor `anon`, met `USING/WITH CHECK (true)`.
   Ze hadden geen beheerpolicies voor `authenticated`. De anonieme browser mocht
   daardoor wel inschrijvingen wijzigen, terwijl een ingelogde admin geen passende
   policies had. Bij de eerste controle waren `auth.users` en `admins` leeg.
3. `wachtlijst` had juist alleen CRUD-grants voor `authenticated` en vier correcte
   adminpolicies. `anon` had geen tabelrechten. In de actuele
   `Deelnemers.jsx` deed afmelden eerst een UPDATE van de inschrijving en daarna
   een SELECT op `wachtlijst` om een vervanger te zoeken. **Die SELECT veroorzaakte
   `permission denied for table wachtlijst`. Het was niet een ontbrekende DELETE-policy.**
   De foutmelding zei ten onrechte dat afmelden mislukt was, terwijl de eerste
   UPDATE al kon zijn opgeslagen. Er zijn geen triggers op deze tabellen die deze
   wachtlijstactie veroorzaken; het was frontendlogica.
4. Opslaan negeerde fouten op `wedstrijden.startlijst_config`, controleerde niet of
   UPDATE werkelijk een rij raakte, overschreef andere configuratievelden zoals
   capaciteit, en bewaarde na INSERT de teruggegeven database-ID's niet. Een tweede
   opslag kon daardoor duplicaten invoegen.
5. Laden sorteerde eerst alfabetisch op klasse; `volgorde` was pas een laatste
   terugvaloptie. Het opgeslagen `rowOrder` werd niet toegepast. Bovendien kon een
   lege databaseuitslag oude deelnemers uit localStorage terugbrengen.
6. De oudere lokale checkout had aanvullend een gevaarlijke verwijderstap na INSERT.
   Die staat niet meer in actuele `main`; de reparatie bouwt op actuele `main`.

Een ontbrekende table grant geeft al een fout voordat RLS een rij kan beoordelen.
UPDATE heeft daarnaast SELECT-toegang nodig. Zie de
[officiële Supabase-uitleg](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Tabellen en betekenis van verwijderen

| Tabel | Gebruik |
| --- | --- |
| `inschrijvingen` | Bron van actieve deelnemers; deelnemergegevens, `volgorde`, `deelnemer_status`, afmeldtijd en reden. Toevoegen is INSERT, afmelden/heractiveren is UPDATE. |
| `wedstrijden` | Wedstrijdgegevens; pauzes, tijden en rijvolgorde in JSONB `startlijst_config`. |
| `wachtlijst` | Losse kandidaten; SELECT voor mogelijke vervanger, DELETE uitsluitend bij expliciete verwijdering of geslaagde promotie. |
| `admins` | Expliciete beheerautorisatie via Auth-user UUID; gebruikers kunnen zichzelf niet toevoegen. |
| `startlijsten` | Bestaande legacytabel; de huidige Startlijst-component leest/schrijft deze niet. Anonieme INSERT is wel ingetrokken. |
| `scores`, `proeven` | Aanvulling voor het gevraagde vrijwilligersaccount; een score hoort via `proef_id` bij een wedstrijd. |

De bestaande flow is bewust behouden: **afmelden is de deelnemer uit de actieve
wedstrijddeelname en daarmee uit de startlijst halen, zonder de inschrijving te
wissen**. Heractiveren gebruikt dezelfde rij/UUID. Dit is geen losse
"verbergen op startlijst"-functie. Historische inschrijfgegevens en bestaande
scores blijven staan. Startlijst opslaan verwijdert nooit deelnemers die niet in
de zichtbare/gefilterde lijst staan.

Bij afmelden wordt alleen bij een ingeschakelde wachtlijst een kandidaat opgezocht.
De beheerder kiest of die wordt gepromoveerd. Zonder promotie wordt niets uit
`wachtlijst` verwijderd. Bij promotie gebeuren de afmelding, de nieuwe inschrijving
en de wachtlijstverwijdering in één transactie. Capaciteit telt uitsluitend actieve
inschrijvingen. Een fout rolt de hele actie terug.

## Nieuwe schrijfflow

De browser leest nog rechtstreeks via Supabase en schrijft via Supabase-RPC's:

- `save_startlijst(uuid,jsonb,jsonb,text)`: slaat deelnemers, ID's, volgorde,
  pauzes en configuratie atomair op; behoudt andere velden. Filtercombinaties
  bewaren eigen pauzes/rijvolgorde in `startlijst_config.startlijstScopes`.
- `afmelden_deelnemer(uuid,uuid,integer)`: afmelden met optionele promotie.
- `promoveer_wachtlijst(uuid,integer)`: promotie met capaciteitcontrole en rollback.

Alle drie gebruiken **SECURITY INVOKER**, een vaste lege `search_path`, een
expliciete admincontrole en RLS. Er is geen service-role sleutel in de browser.
Heractiveren blijft een directe, op wedstrijd én UUID begrensde UPDATE, met
`select('id').single()` zodat nul gewijzigde rijen geen stil succes opleveren.
Het bestaande service-role GET-endpoint `/api/wachtlijst` controleert nu eveneens
het Bearer-token en `admins`; publiek inschrijven blijft via de bestaande API lopen.

## Rechten en policies

`20260918092712_fix_startlijst_admin_transactions.sql`:

- Verwijdert `ins_insert`, `ins_update`, `ins_delete`, `wed_write`, `wed_update`,
  `wedstrijden_delete` en `sl_insert` (anonieme schrijftoegang).
- Behoudt de bestaande publieke SELECT-policies (`ins_read`, `wed_read`, `sl_read`).
- Maakt/hermaakt `admins_self_read` en voor elk van `inschrijvingen`, `wedstrijden`,
  `startlijsten`, `wachtlijst` de vier policies `<tabel>_admin_select`,
  `<tabel>_admin_insert`, `<tabel>_admin_update`, `<tabel>_admin_delete`.
- UPDATE bevat zowel USING als WITH CHECK. Alle beheerchecks gebruiken
  `auth.uid()` en de bestaande tabel `admins`.
- Voegt `wedstrijden_public_read` voor authenticated toe voor de wedstrijdselector.
- Verwijdert overbodige TRUNCATE/TRIGGER/REFERENCES-grants voor browserrollen;
  authenticated krijgt alleen CRUD waar nodig. `wachtlijst_id_seq` krijgt USAGE.
- RLS blijft aan. Geen nieuwe tabellen en geen massawijziging van wedstrijddata.

`20260918160135_restrict_score_volunteer_access.sql`:

- Verwijdert brede publieke schrijfpoli­cies op `scores` en `proeven` en trekt
  anonieme schrijftoegang in. Anders zouden die policies de wedstrijdbeperking
  via permissieve OR-combinatie omzeilen.
- Voegt `scores_admin_all`, `proeven_admin_all`, `inschrijvingen_scorer_select`
  en `scores_scorer_select/insert/update/delete` toe.
- `can_enter_scores(uuid)` is SECURITY INVOKER en leest uitsluitend de door de
  server beheerde `app_metadata.score_wedstrijd_ids` uit het JWT.
- De vrijwilliger kan alleen scores voor een toegewezen wedstrijd invoeren,
  corrigeren of verwijderen. INSERT/UPDATE controleren ook dat proef, wedstrijd
  en actief startnummer bij elkaar horen. Een vrijwilliger kan geen proeven
  verplaatsen, deelnemers muteren, startlijst-RPC gebruiken of admins toevoegen.
- Gewone deelnemers zonder die claim hebben geen beheerschrijfrechten.

Admins zijn hier globale beheerders, volgens het reeds bestaande model.
Er is geen organisatie-lidmaatschapstabel en een contactadres in
`wedstrijden.organisator_email` geeft niet automatisch beheerrechten.

## Inloggen en vrijwilligersaccount

- Beheerders: `https://app.workingpoint.nl` (live).
- Vrijwilliger: `https://app.workingpoint.nl/#/scores`. Deze route heeft een eigen
  selector met alleen toegewezen wedstrijden, zonder vooraf een beheerpagina te
  hoeven openen. Andere beheerlinks verlenen geen toegang.
- Openbare deelnemers hoeven niet in te loggen voor het openbare inschrijfformulier.
- Sessies blijven bewaard na verversen; uitloggen is beschikbaar.
- Er is nog **geen vrijwilligersaccount aangemaakt**, omdat het e-mailadres nog
  niet gekozen is. Beide beheerders kunnen intussen ook scores invoeren.

Zodra dat adres bekend is: maak/bevestig het account in Supabase Auth en voer als
databasebeheerder `scripts/provision-score-account.sql` uit met `score_email` en
`wedstrijd_id` als psql-variabelen. Dit script kent alleen de scorerclaim toe, geen
`admins`-lidmaatschap. De accountgegevens/wachtwoorden horen niet in de repository.
Uitloggen/inloggen is nodig om nieuwe claims op te halen. Intrekken van metadata
beëindigt niet onmiddellijk een bestaand JWT; beëindig ook de sessies en houd
rekening met de geldigheidsduur van al uitgegeven access tokens.

## Uitgevoerde tests

- 38 Vitest-tests geslaagd, waaronder echte React-componenttests met een
  gesimuleerde Supabase-client: openen, klassevolgorde wijzigen, opslaan,
  opnieuw mounten/verversen, lege lijst zonder oude cache, correcte foutmelding,
  admin/deelnemer/vrijwilliger-routecontrole en tokenrefresh zonder editorverlies.
- Productiebuild geslaagd; bestaande PDF/bundelgroottewaarschuwingen blijven.
- Echte Postgres-tests met `SET LOCAL ROLE authenticated/anon` en JWT-claims:
  admin CRUD, permanente IDs, order/config, behoud capaciteit, rollback bij fout,
  soft-afmelden, heractiveren, optionele promotie, verkeerde wedstrijd geweigerd,
  deelnemerswrite geweigerd, zelfpromotie geweigerd, vervalste user_metadata geweigerd.
- Aanvullende echte Postgres-tests voor de scorevrijwilliger: eigen wedstrijd
  toegestaan; andere wedstrijd, startlijst, inschrijvingen en proeven muteren verboden.
- Browser: lokale én live beheerlogin en scorelogin renderen correct, zonder consolefouten. Het openbare inschrijfformulier opent zonder login.
- **Niet uitgevoerd:** volledige browseracceptatie met de echte wachtwoorden
  van beide beheerders. Er zijn geen
  wachtwoorden opgevraagd en geen fictief vrijwilligersaccount aangemaakt.

Herhaal lokaal met `npm run test:run` en `npm run build`.
De databasecontrole kan met `DATABASE_URL=... bash scripts/test-startlijst-rls.sh`.
De wrapper voert beide migrations en beide SQL-tests uit in één rollbacktransactie.

De Supabase Security Advisor is ook gelezen. De bestaande meldingen over
`v_klassen_labels`, Auth-instellingen en Postgres-versie vallen buiten deze reparatie.
De afgesloten backuptabellen hebben bewust geen publieke policies.
Zie [Supabase database-linter](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view).

## Zelf testen na uitrollen

De twee migrations en de frontend zijn al uitgerold; voer ze niet opnieuw uit.
Gebruik voor eigen controles een testwedstrijd, zodat wedstrijdgegevens intact blijven.

1. Log met elk beheeraccount in op app.workingpoint.nl en kies een testwedstrijd.
2. Open Startlijst, verander de volgorde over minstens twee klassen, voeg een pauze
   toe en sla op. Ververs: volgorde, tijden en pauze moeten gelijk zijn.
3. Voeg via de bestaande flow een testdeelnemer toe en sla twee keer op: er mag
   maar één inschrijving ontstaan. Controleer ook dat capaciteitinstellingen blijven.
4. Ga vanuit de Startlijst via **Beheer** naar Deelnemers. Meld een testdeelnemer af;
   die verdwijnt uit de actieve startlijst maar blijft als afgemeld bewaard.
5. Heractiveer die deelnemer en ververs Startlijst: dezelfde inschrijving keert terug.
6. Test met een lege/uitgeschakelde wachtlijst, en met één testkandidaat. Kies eerst
   geen promotie (wachtlijst blijft), daarna wel (precies één promotie). Bij een
   fout mag geen halve afmelding of dubbele inschrijving ontstaan.
7. Controleer dat een gewoon account en uitgelogde browser geen beheer kunnen
   uitvoeren, ook niet via directe Supabase-verzoeken. SQL-tests dekken dit af.
8. Na aanmaken van het vrijwilligersaccount: open `/#/scores`, kies de toegewezen
   wedstrijd en voer/corrigeer een testscore. Startlijst/Deelnemers moeten blokkeren.
9. Controleer meldingen: geen `permission denied` in geldige beheeracties en geen
   succesmelding als een wijziging niet daadwerkelijk bevestigd is.

## Gewijzigde bestanden

Applicatie:
`src/App.jsx`, `src/lib/supabaseClient.js`, `src/features/auth/AdminGate.jsx`,
`src/features/startlijst/pages/Startlijst.jsx`, `src/features/startlijst/startlijstPersistence.js`,
`src/features/deelnemers/pages/Deelnemers.jsx`, `src/features/wachtlijst/pages/WachtlijstBeheer.jsx`,
`src/features/scoring/pages/ScoreInvoer.jsx`, `src/features/scoring/pages/ScoreWerkplek.jsx`,
`api/wachtlijst.js`.

Migraties/test/documentatie:
de twee migrations hierboven, `scripts/run_migrations.sh`, `scripts/test-startlijst-rls.sql`,
`scripts/test-score-access.sql`, `scripts/test-startlijst-rls.sh`,
`scripts/provision-score-account.sql`, `src/features/auth/AdminGate.test.jsx`,
`src/features/startlijst/startlijstPersistence.test.js`,
`src/features/startlijst/pages/Startlijst.test.jsx` en dit verslag.

## Secretariaattoegang 19 september 2026

Het bevestigde account wedstrijdsecretariaat@workingpoint.nl heeft inmiddels
scoretoegang voor Onstwedde (26 september 2026), zonder admins-lidmaatschap.
De routes /deelnemers en /uitslagen staan nu ook open voor toegewezen scorers:
deelnemers alleen bekijken, uitslagen bekijken/exporteren. De scope-selectie
mount geen pagina voor een andere wedstrijd; RLS blijft de databasegrens.
Live rolcontrole: 55 zichtbare inschrijvingen, 0 uit andere wedstrijden.
Stallen staan nog in de bestaande lokale browseropslag: de inzage toont dat
uitdrukkelijk en presenteert ontbrekende lokale gegevens niet als 'geen stal'.
Centrale opslag is nog niet toegevoegd. Er zijn geen nieuwe RLS-policies nodig.
