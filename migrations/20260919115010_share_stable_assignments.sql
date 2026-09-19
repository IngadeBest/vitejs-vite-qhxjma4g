BEGIN;
-- Nullable: existing registrations are not assigned or cleared by this migration.
ALTER TABLE public.inschrijvingen ADD COLUMN IF NOT EXISTS stal_toewijzing jsonb;

CREATE OR REPLACE FUNCTION public.save_stal_toewijzingen(p_wedstrijd_id uuid, p_changes jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE entry record; current_value jsonb; desired jsonb; total integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = (SELECT auth.uid())) THEN
    RAISE EXCEPTION 'Alleen beheerders mogen stallen wijzigen' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_changes) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Ongeldige stalwijzigingen' USING ERRCODE = '22023';
  END IF;
  -- Match the lock order used by startlist/cancellation RPCs.
  PERFORM 1 FROM public.wedstrijden WHERE id = p_wedstrijd_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wedstrijd niet gevonden'; END IF;
  FOR entry IN SELECT key, value FROM jsonb_each(p_changes) ORDER BY key LOOP
    desired := entry.value->'after';
    IF jsonb_typeof(entry.value) IS DISTINCT FROM 'object'
      OR NOT (entry.value ? 'before')
      OR jsonb_typeof(desired) IS DISTINCT FROM 'object'
      OR jsonb_typeof(desired->'heeftStal') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(desired->'stalnummer') IS DISTINCT FROM 'string'
      OR length(desired->>'stalnummer') > 80 THEN
      RAISE EXCEPTION 'Ongeldige staltoewijzing' USING ERRCODE = '22023';
    END IF;
    SELECT stal_toewijzing INTO current_value FROM public.inschrijvingen
      WHERE id = entry.key::uuid AND wedstrijd_id = p_wedstrijd_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Deelnemer hoort niet bij deze wedstrijd'; END IF;
    IF coalesce(current_value,'null'::jsonb) IS DISTINCT FROM entry.value->'before' THEN
      RAISE EXCEPTION 'Stalindeling is intussen gewijzigd. Ververs en controleer opnieuw.' USING ERRCODE = '40001';
    END IF;
    UPDATE public.inschrijvingen SET stal_toewijzing = jsonb_build_object(
      'heeftStal',(desired->>'heeftStal')::boolean,
      'stalnummer',CASE WHEN (desired->>'heeftStal')::boolean THEN btrim(desired->>'stalnummer') ELSE '' END)
      WHERE id = entry.key::uuid AND wedstrijd_id = p_wedstrijd_id;
    total := total + 1;
  END LOOP;
  RETURN total;
END;
$function$;
REVOKE ALL ON FUNCTION public.save_stal_toewijzingen(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_stal_toewijzingen(uuid,jsonb) TO authenticated;
-- Existing admin UPDATE and competition-scoped scorer SELECT policies apply.
COMMIT;
