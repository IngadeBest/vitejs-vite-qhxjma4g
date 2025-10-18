-- Migration: add leeftijd_ruiter and geslacht_paard to inschrijvingen
-- Forward:
ALTER TABLE IF EXISTS inschrijvingen
  ADD COLUMN IF NOT EXISTS leeftijd_ruiter integer,
  ADD COLUMN IF NOT EXISTS geslacht_paard varchar(10) DEFAULT NULL;

-- Optional: add a check constraint to limit values for geslacht_paard
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'inschrijvingen' AND tc.constraint_name = 'inschrijvingen_geslacht_check'
  ) THEN
    ALTER TABLE inschrijvingen
      ADD CONSTRAINT inschrijvingen_geslacht_check CHECK (geslacht_paard IS NULL OR geslacht_paard IN ('merrie','ruin','hengst'));
  END IF;
END $$;

-- Rollback:
-- ALTER TABLE inschrijvingen DROP CONSTRAINT IF EXISTS inschrijvingen_geslacht_check;
-- ALTER TABLE inschrijvingen DROP COLUMN IF EXISTS leeftijd_ruiter;
-- ALTER TABLE inschrijvingen DROP COLUMN IF EXISTS geslacht_paard;
