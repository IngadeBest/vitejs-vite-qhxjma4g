-- Migration Option B (Phase 1)
-- Non-destructive mapping: backup tables, add proeven.uuid, add _proef_uuid to proeven_items and try mapping.
-- This script STOPS after reporting unmapped_count. It DOES NOT DROP/RENAME columns.

BEGIN;

-- 0) Backups (safe snapshots)
CREATE TABLE IF NOT EXISTS proeven_backup AS TABLE proeven WITH NO DATA;
INSERT INTO proeven_backup SELECT * FROM proeven;

CREATE TABLE IF NOT EXISTS proeven_items_backup AS TABLE proeven_items WITH NO DATA;
INSERT INTO proeven_items_backup SELECT * FROM proeven_items;

-- 1) ensure pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) add uuid column to proeven and fill if empty
ALTER TABLE proeven ADD COLUMN IF NOT EXISTS uuid uuid;
UPDATE proeven SET uuid = gen_random_uuid() WHERE uuid IS NULL;

-- 3) helper temporary mapping (optional)
CREATE TEMP TABLE tmp_proeven_map AS
SELECT id, uuid FROM proeven;

-- 4) add temp uuid column on proeven_items
ALTER TABLE proeven_items ADD COLUMN IF NOT EXISTS _proef_uuid uuid;

-- 5) attempt mapping where proef_id looks numeric (e.g., '12' -> proeven.id = 12)
UPDATE proeven_items pi
SET _proef_uuid = p.uuid
FROM proeven p
WHERE pi._proef_uuid IS NULL
  AND pi.proef_id::text ~ '^[0-9]+$'
  AND p.id::text = pi.proef_id::text;

-- 6) attempt mapping where proef_id already equals a uuid string
UPDATE proeven_items pi
SET _proef_uuid = p.uuid
FROM proeven p
WHERE pi._proef_uuid IS NULL
  AND pi.proef_id::text = p.uuid::text;

-- 7) inspect unmapped rows count
SELECT COUNT(*) AS unmapped_count FROM proeven_items WHERE _proef_uuid IS NULL;

-- show a sample of unmapped rows for manual inspection
SELECT id, proef_id, nr, omschrijving FROM proeven_items WHERE _proef_uuid IS NULL LIMIT 50;

-- Also show a small sample of successful mappings
SELECT id, proef_id, _proef_uuid FROM proeven_items WHERE _proef_uuid IS NOT NULL LIMIT 50;

COMMIT;

-- End Phase 1. After you inspect the results, run Phase 2 to swap/rename/protect and add FK.
