-- Migration: add soft-cancel status for deelnemers in inschrijvingen

ALTER TABLE IF EXISTS inschrijvingen
  ADD COLUMN IF NOT EXISTS deelnemer_status text;

ALTER TABLE IF EXISTS inschrijvingen
  ADD COLUMN IF NOT EXISTS afgemeld_at timestamptz;

ALTER TABLE IF EXISTS inschrijvingen
  ADD COLUMN IF NOT EXISTS afgemeld_reden text;

UPDATE inschrijvingen
SET deelnemer_status = 'actief'
WHERE deelnemer_status IS NULL;

ALTER TABLE IF EXISTS inschrijvingen
  ALTER COLUMN deelnemer_status SET DEFAULT 'actief';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inschrijvingen_deelnemer_status_check'
  ) THEN
    ALTER TABLE inschrijvingen
      ADD CONSTRAINT inschrijvingen_deelnemer_status_check
      CHECK (deelnemer_status IN ('actief', 'afgemeld'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inschrijvingen_status
  ON inschrijvingen(wedstrijd_id, deelnemer_status);
