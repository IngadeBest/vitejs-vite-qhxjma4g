-- Migration: add manual start/trail timestamp columns to inschrijvingen
BEGIN;

ALTER TABLE IF EXISTS inschrijvingen
  ADD COLUMN IF NOT EXISTS starttijd_manual timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trailtijd_manual timestamptz DEFAULT NULL;

COMMIT;
