# Startlijst Fix - Database Migratie

## Probleem
Pauzes werden niet opgeslagen en volgorde werd door elkaar gegooid na opslaan/laden.

## Oplossing
1. **Pauzes opslaan**: Via `wedstrijden.startlijst_config` (jsonb kolom)
2. **Volgorde bewaren**: Nieuwe `volgorde` kolom in `inschrijvingen` tabel

## Migratie uitvoeren

### Stap 1: Voeg volgorde kolom toe
Voer dit uit in Supabase SQL Editor:

```sql
-- Run: migrations/2025-11-25_add_volgorde_to_inschrijvingen.sql
ALTER TABLE IF EXISTS inschrijvingen
  ADD COLUMN IF NOT EXISTS volgorde integer DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_inschrijvingen_volgorde 
  ON inschrijvingen(wedstrijd_id, volgorde);
```

### Stap 2: Controleer startlijst_config kolom
Deze zou al moeten bestaan (vanaf eerdere migratie), maar controleer:

```sql
-- Check of kolom bestaat
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'wedstrijden' 
  AND column_name = 'startlijst_config';
```

Als deze niet bestaat, voeg hem toe:

```sql
ALTER TABLE wedstrijden
  ADD COLUMN IF NOT EXISTS startlijst_config jsonb DEFAULT '{}'::jsonb;
```

## Wat is er opgelost?

### ✅ Pauzes worden nu opgeslagen
- Pauzes worden bewaard in `wedstrijden.startlijst_config.pauses`
- Inclusief positie, label en duur
- Worden automatisch hersteld bij laden

### ✅ Volgorde blijft behouden
- Elke entry krijgt een `volgorde` nummer bij opslaan
- Bij laden wordt gesorteerd op `volgorde` ipv `created_at`
- Geen chaos meer!

### ✅ Trail ombouwtijd
- Nieuwe instelling: 0-15 minuten extra tijd tussen trail deelnemers
- Voor het ombouwen van obstakels
- Dressuur blijft normaal interval gebruiken

### ✅ Config bewaard
- Dressuur/Trail starttijden
- Interval instellingen
- Per-klasse starttijden
- Trail ombouwtijd
- Alles wordt opgeslagen en hersteld

## Na de migratie

1. Refresh de pagina
2. Selecteer een wedstrijd
3. Voeg pauzes toe waar nodig
4. Stel trail ombouwtijd in (bijv. 5 min)
5. Klik "Opslaan"
6. Reload - alles is zoals je het achterliet! 🎉

## Technische details

**Opgeslagen in `startlijst_config`:**
```json
{
  "dressuurStart": "09:00",
  "trailStart": "13:00", 
  "interval": 6,
  "trailOmbouwtijd": 5,
  "pauzeMinuten": 15,
  "pauses": [
    {"id": "break_123", "label": "Koffiepauze", "duration": 15, "position": 12}
  ],
  "klasseStartTimes": {
    "WE0": {"dressuur": "09:00", "trail": "13:00"},
    "WE2": {"dressuur": "13:00", "trail": "17:00"}
  }
}
```

**Opgeslagen in `inschrijvingen`:**
- `volgorde`: integer (0, 1, 2, ...) voor correcte sortering
- Pauzes staan NIET in inschrijvingen (alleen in config)
