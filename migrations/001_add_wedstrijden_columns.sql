-- Migration: add allowed_klassen and klasse_categorieen to wedstrijden
-- Forward:
ALTER TABLE IF EXISTS wedstrijden
  ADD COLUMN IF NOT EXISTS allowed_klassen jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS klasse_categorieen jsonb DEFAULT '{}'::jsonb;

-- Rollback:
-- ALTER TABLE wedstrijden DROP COLUMN IF EXISTS allowed_klassen;
-- ALTER TABLE wedstrijden DROP COLUMN IF EXISTS klasse_categorieen;
