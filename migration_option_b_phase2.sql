-- Migration Option B (Phase 2)
-- Swap temp column into place and add FK/index. Run ONLY after Phase 1 succeeded and unmapped_count = 0.

BEGIN;

-- Drop original proef_id (phase1 left a temp _proef_uuid)
ALTER TABLE proeven_items DROP COLUMN IF EXISTS proef_id;
-- Rename the temp uuid column into place
ALTER TABLE proeven_items RENAME COLUMN _proef_uuid TO proef_id;

-- Ensure indexes and constraints
CREATE UNIQUE INDEX IF NOT EXISTS ix_proeven_uuid ON proeven(uuid);
CREATE INDEX IF NOT EXISTS ix_proeven_items_proef_id ON proeven_items(proef_id);

-- Add FK to proeven(uuid)
ALTER TABLE proeven_items
  ADD CONSTRAINT fk_proevenitems_proef_uuid FOREIGN KEY (proef_id) REFERENCES proeven(uuid) ON DELETE CASCADE;

COMMIT;

-- End Phase 2
