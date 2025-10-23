-- Migration: add startlijst_config jsonb to wedstrijden
-- Run in your Postgres (psql or Supabase SQL editor)
BEGIN;

ALTER TABLE IF EXISTS wedstrijden
  ADD COLUMN IF NOT EXISTS startlijst_config jsonb DEFAULT '{}'::jsonb;

-- Optional backfill example: give existing wedstrijden a default schedule if empty
-- Backfill: leave stijltrailStart empty by default (admins can set it in the UI)
UPDATE wedstrijden
SET startlijst_config = jsonb_build_object(
  'dressuurStart', '09:00',
  'interval', 7,
  'stijltrailStart', null,
  'pauses', '[]'
)
WHERE COALESCE(startlijst_config::text, '') = '{}'::text;

COMMIT;
