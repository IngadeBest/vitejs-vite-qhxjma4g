-- Migration: normalize startlijst_config
-- 1) convert legacy pauses arrays into object mapping: {"__default__": [...]}
-- 2) convert legacy trailOffset (minutes) into stijltrailStart (HH24:MI) using dressuurStart if present
-- 3) remove trailOffset key from JSON

BEGIN;

-- 1) Convert pauses arrays to object under __default__
UPDATE wedstrijden
SET startlijst_config = jsonb_set(startlijst_config, '{pauses}', jsonb_build_object('__default__', startlijst_config->'pauses'))
WHERE startlijst_config ? 'pauses' AND jsonb_typeof(startlijst_config->'pauses') = 'array';

-- 2) If both dressuurStart and trailOffset exist, compute stijltrailStart and remove trailOffset
UPDATE wedstrijden
SET startlijst_config = (
  (startlijst_config || jsonb_build_object('stijltrailStart', to_char(((startlijst_config->>'dressuurStart')::time + (COALESCE((startlijst_config->>'trailOffset')::int, 0) * interval '1 minute')), 'HH24:MI'))) - 'trailOffset'
)
WHERE startlijst_config ? 'trailOffset' AND startlijst_config ? 'dressuurStart';

-- 3) If trailOffset exists but no dressuurStart to compute from, set stijltrailStart to null and remove trailOffset
UPDATE wedstrijden
SET startlijst_config = (startlijst_config || jsonb_build_object('stijltrailStart', null)) - 'trailOffset'
WHERE startlijst_config ? 'trailOffset' AND NOT (startlijst_config ? 'dressuurStart');

COMMIT;
