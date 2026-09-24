# Startlijst Onstwedde, herstel 24 september 2026

Referentie: door organisator aangeleverde afbeelding van de startlijst, gegenereerd op 21 september 2026 om 10:18:22.

De schermteller `#` reset ten onrechte na een pauze. Deze telt nu door per klasse, zonder de vaste startnummers te veranderen. Regressietest: WE0 11 → pauze 15 minuten → 12, met 14:32 / 18:02 voor de twaalfde start bij een volledige lijst.

Te herstellen instellingen: interval 7 minuten; Young Riders 09:00/11:00, Junioren 09:07/11:20, WE2+ 09:14/11:27, WE2 09:21/11:35, WE1 09:56/12:25, WE0 13:00/16:30. Eerste pauze 10 minuten na WE1; tweede pauze 15 minuten na Tineke Oldenkamp.

Organisator bevestigt dat Cynthia de Laet, Marit Sijtsema en Marloes Westerveld afgemeld blijven. Hun plaatsen worden niet teruggezet. Door de afmelding voor de tweede pauze schuift die pauze één rij naar voren (positie 21 inclusief eerste pauze); Harry start om 14:25/17:55, met vast startnummer 012 en volgnummer 11.

Oorspronkelijke databaseconfiguratie vóór herstel (wedstrijd 5e679d18-40a0-420a-b274-149681d52c5c):

```json
{"pauses":{"__default__":[{"id":"break_1781505524695","label":"Pauze","duration":10,"position":10},{"id":"break_1789456270440","label":"Pauze","duration":10,"position":22}]},"interval":7,"alternates":{},"capacities":{},"jeugdAllowed":{"we0":true},"dressuurStart":"09:00","totaalMaximum":34,"offsetOverrides":{},"stijltrailStart":null}
```

Validatie: 48 tests geslaagd, productiebuild geslaagd. De SQL-correctie bewaart overige configuratie en wijzigt geen inschrijvingen of scores.
