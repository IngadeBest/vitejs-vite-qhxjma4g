# Scoreverwerking — 25 september 2026

Live versie: 8e65c07. Protocollen/PDF-opmaak ongewijzigd.

- Automatische selectie wanneer klasse/onderdeel precies één proef heeft.
- Dressuur/stijl: standaard alle jurycijfers; totaal met coëfficiënten en ingevoerde puntenaftrek. Lege velden zijn geen nullen. Handmatig totaalinvoer blijft beschikbaar.
- Details, status en revisie worden bij de score bewaard. Bijwerken weigert een verouderde revisie. Unieke index voorkomt dubbele scores per proef/startnummer.
- Speed: gereden tijd, straf en bonus afzonderlijk met reden; legacy eindtijd blijft bewerkbaar.
- Centrale rangschikking voor invoerscherm en einduitslag, aparte jeugdklasse, afgemelden uitgesloten, ontbrekende resultaten voorlopig, starteraantal vanuit dressuur, dressuur als tie-break.
- Database migratie 20260924131811_score_processing toegepast. Bestaande scores niet herschreven; bestaande RLS/rechten behouden.
- Proef 70 Onstwedde: foutieve onderdeelwaarde Dressuur gecorrigeerd naar Stijltrail, met controle op naam, maximum en ontbreken van scores.

Verificatie: 153 tests slagen, productiebuild slaagt. SQL transactionele test: opslaan/teruglezen, dubbele insert geweigerd, verouderde update raakt nul rijen, onjuiste speedtijd geweigerd. Alle SQL-testschrijfacties teruggedraaid. Vercel productie READY.

Visuele eindcontrole in Safari kon niet worden afgerond doordat de actieve browser tijdens de bediening veranderde. React-integratietests controleren automatische selectie, alle cijfers opslaan, onvolledige invoer weigeren en bewerken na conflict.

Gebruik: selecteer klasse en onderdeel, kies ruiter, vul cijfers en eventuele puntenaftrek in, klik Cijfers en score opslaan. Scores verversen en Uitslag verversen halen actuele centrale gegevens op.
