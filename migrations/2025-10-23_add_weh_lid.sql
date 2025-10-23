-- Migration: add weh_lid boolean to inschrijvingen
BEGIN;

ALTER TABLE IF EXISTS inschrijvingen
  ADD COLUMN IF NOT EXISTS weh_lid boolean DEFAULT false;

COMMIT;
