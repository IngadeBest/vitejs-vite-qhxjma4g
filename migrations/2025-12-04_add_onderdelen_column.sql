-- Migratie: Voeg 'onderdelen' kolom toe aan inschrijvingen tabel
-- Datum: 2025-12-04
-- Doel: Opslaan welke onderdelen een deelnemer rijdt (dressuur/trail/speed)

-- Stap 1: Voeg JSONB kolom toe met default waarde
ALTER TABLE inschrijvingen 
ADD COLUMN IF NOT EXISTS onderdelen JSONB 
DEFAULT '{"dressuur": true, "trail": true, "speed": true}'::jsonb;

-- Stap 2: Update bestaande NULL waarden naar default
UPDATE inschrijvingen 
SET onderdelen = '{"dressuur": true, "trail": true, "speed": true}'::jsonb 
WHERE onderdelen IS NULL;

-- Verificatie query (uncomment to check):
-- SELECT id, ruiter, klasse, onderdelen FROM inschrijvingen LIMIT 10;

-- Rollback (als nodig):
-- ALTER TABLE inschrijvingen DROP COLUMN IF EXISTS onderdelen;
