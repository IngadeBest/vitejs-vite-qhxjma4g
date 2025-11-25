-- Migration: add volgorde column to inschrijvingen table
-- This preserves the order of entries in the startlijst
BEGIN;

ALTER TABLE IF EXISTS inschrijvingen
  ADD COLUMN IF NOT EXISTS volgorde integer DEFAULT NULL;

-- Create index for faster sorting
CREATE INDEX IF NOT EXISTS idx_inschrijvingen_volgorde 
  ON inschrijvingen(wedstrijd_id, volgorde);

COMMIT;
