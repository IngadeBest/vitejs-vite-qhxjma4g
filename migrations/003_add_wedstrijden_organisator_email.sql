-- Migration: add organisator_email to wedstrijden
-- Forward:
ALTER TABLE IF EXISTS wedstrijden
  ADD COLUMN IF NOT EXISTS organisator_email varchar(255) DEFAULT NULL;

-- Rollback:
-- ALTER TABLE wedstrijden DROP COLUMN IF EXISTS organisator_email;
