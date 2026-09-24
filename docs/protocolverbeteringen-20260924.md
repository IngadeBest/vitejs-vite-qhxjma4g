# Protocolverbeteringen - 24 september 2026

De protocolgenerator gebruikt één PDF-builder voor preview, download en batchafdruk. De inhoud komt uit de gecontroleerde WEH-regels en officiële dressuurproeven (regelboek 2026 v10; brongegevens per proef in `src/rules/weh/dressageData.json`). WE0, WE1, WE2, WE2+, WE3, WE4, Junioren en Young Riders blijven aparte klassen.

- Volledige dressuurproeven, algemene cijfers en coëfficiënten; start en finish zijn geen scoreonderdelen.
- Speed: ringhouder/stier omvergereden +5 seconden als expliciete werkafspraak in afwachting van WEH. Straftijd, bonustijd en gereden tijd apart; diskwalificatieoverzicht op een afzonderlijke pagina.
- Opmaak: dressuur twee pagina's per proef, duidelijk gemarkeerde algemene cijfers, ruimte voor opmerkingen, totaalscore en handtekening bij elkaar, herhaalde ruitergegevens en paginanummering per deelnemer in batches.
- Startnummers met voorloopnullen; ontbrekende startnummers blijven leeg in plaats van verzonnen nummers te gebruiken.
- Deelnemers selecteerbaar op Jeugd of Algemeen/Senior. Selectie wordt gewist bij wisseling van wedstrijd, klasse of rubriek. Bij databasefouten worden oude lokale deelnemers niet teruggezet.
- Stijlonderdelen worden via `proeven.uuid` geladen, passend bij het UUID-type van `proeven_items.proef_id`.
- Bestaande lokale parcoursopslag is nu expliciet aangeduid als opslag op dit apparaat. Deze release voegt geen centrale parcoursopslag of wedstrijdproeven toe.

Organisator heeft op 24 september expliciet bevestigd: Junioren en Young Riders gebruiken voor stijl hetzelfde protocol en dezelfde vijf algemene cijfers als WE2/WE2+/WE3/WE4. Deze werkafspraak heft de RR08-blokkade voor de protocolgenerator op; bij twaalf hindernissen is het maximum 170 punten. Dit is geen nieuwe officiële WEH-bevestiging van de nog open minimale/maximale hindernisaantallen (RR03). De afwijkende titel van de Young Riders-bron is niet overgenomen; geen vier-teugeleis toegevoegd.

Verificatie: 132 tests in 10 bestanden, productiebuild en diffcontrole geslaagd. Tien voorbeeld-PDF's met samen 19 pagina's gerenderd en visueel gecontroleerd. Tests dekken volledige proefinhoud/maxima, twee pagina's per dressuurproef, batchidentiteit, Jeugd-selectie, UUID-koppeling en uitsluiten van verouderde lokale deelnemers bij verbindingsfouten.

Deze release wijzigt geen bestaande inschrijvingen, startlijsten, proeven of scores en voert geen databasemigratie uit.
