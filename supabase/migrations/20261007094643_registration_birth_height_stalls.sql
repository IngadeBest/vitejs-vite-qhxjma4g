-- Additive: NULL means unknown for legacy entries; no birth dates are guessed.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.inschrijvingen
  ADD COLUMN geboortedatum_ruiter date,
  ADD COLUMN stokmaat_cm numeric(4,1),
  ADD COLUMN stal_nodig boolean,
  ADD COLUMN stalmaat text,
  ADD CONSTRAINT inschrijving_stokmaat_valid CHECK (stokmaat_cm > 0 AND stokmaat_cm <= 300),
  ADD CONSTRAINT inschrijving_stalmaat_valid CHECK (stalmaat IN ('klein','groot','geen_voorkeur')),
  ADD CONSTRAINT inschrijving_stal_complete CHECK (
    (stal_nodig IS TRUE AND stokmaat_cm IS NOT NULL AND stalmaat IS NOT NULL)
    OR (stal_nodig IS NOT TRUE AND stalmaat IS NULL));
ALTER TABLE public.wachtlijst
  ADD COLUMN geboortedatum_ruiter date,
  ADD COLUMN stokmaat_cm numeric(4,1),
  ADD COLUMN stal_nodig boolean,
  ADD COLUMN stalmaat text,
  ADD CONSTRAINT wachtlijst_stokmaat_valid CHECK (stokmaat_cm > 0 AND stokmaat_cm <= 300),
  ADD CONSTRAINT wachtlijst_stalmaat_valid CHECK (stalmaat IN ('klein','groot','geen_voorkeur')),
  ADD CONSTRAINT wachtlijst_stal_complete CHECK (
    (stal_nodig IS TRUE AND stokmaat_cm IS NOT NULL AND stalmaat IS NOT NULL)
    OR (stal_nodig IS NOT TRUE AND stalmaat IS NULL));
COMMENT ON COLUMN public.inschrijvingen.geboortedatum_ruiter IS 'Source for rider age; calculate at wedstrijd.datum where available. Legacy rows may be NULL.';
COMMENT ON COLUMN public.inschrijvingen.stal_nodig IS 'Participant request, separate from organisational stal_toewijzing. NULL = legacy unknown.';
COMMENT ON COLUMN public.inschrijvingen.stalmaat IS 'Requested size; organisation may adjust. klein / groot / geen_voorkeur.';
-- Existing anon SELECT privileges are limited to id, wedstrijd_id and klasse.
-- Do not grant access to new columns; preserve existing RLS and column privileges.

CREATE OR REPLACE FUNCTION public.promoveer_wachtlijst(p_wedstrijd_id uuid, p_wachtlijst_id integer)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE w public.wedstrijden%ROWTYPE; candidate public.wachtlijst%ROWTYPE; new_id uuid; total_count integer; class_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Alleen bevoegde beheerders mogen de wachtlijst beheren' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO w FROM public.wedstrijden WHERE id = p_wedstrijd_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wedstrijd niet gevonden'; END IF;
  SELECT * INTO candidate FROM public.wachtlijst WHERE id = p_wachtlijst_id AND wedstrijd_id = p_wedstrijd_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wachtlijstkandidaat is niet meer beschikbaar'; END IF;
  SELECT count(*), count(*) FILTER (WHERE klasse = candidate.klasse) INTO total_count,class_count
    FROM public.inschrijvingen WHERE wedstrijd_id = p_wedstrijd_id AND COALESCE(deelnemer_status,'actief') = 'actief';
  IF total_count >= NULLIF(w.startlijst_config->>'totaalMaximum','')::integer
     OR class_count >= NULLIF(w.startlijst_config->'capacities'->>candidate.klasse,'')::integer THEN
    RAISE EXCEPTION 'Wedstrijd of klasse is vol; kandidaat blijft op de wachtlijst';
  END IF;
  INSERT INTO public.inschrijvingen(wedstrijd_id,wedstrijd,klasse,ruiter,paard,email,telefoon,weh_lid,
    leeftijd_ruiter,geslacht_paard,omroeper,opmerkingen,rubriek,
    geboortedatum_ruiter,stokmaat_cm,stal_nodig,stalmaat)
  VALUES (w.id,w.naam,candidate.klasse,candidate.ruiter,candidate.paard,candidate.email,candidate.telefoon,
    candidate.weh_lid,
    CASE WHEN candidate.geboortedatum_ruiter IS NULL THEN candidate.leeftijd_ruiter
         ELSE EXTRACT(YEAR FROM age(COALESCE(w.datum::date,CURRENT_DATE),candidate.geboortedatum_ruiter))::integer END,
    candidate.geslacht_paard,candidate.omroeper,candidate.opmerkingen,'Algemeen',
    candidate.geboortedatum_ruiter,candidate.stokmaat_cm,candidate.stal_nodig,candidate.stalmaat)
  RETURNING id INTO new_id;
  DELETE FROM public.wachtlijst WHERE id = candidate.id AND wedstrijd_id = w.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wachtlijstkandidaat kon niet worden verwijderd'; END IF;
  RETURN new_id;
END
$function$;

REVOKE ALL ON FUNCTION public.promoveer_wachtlijst(uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promoveer_wachtlijst(uuid,integer) TO authenticated;
COMMIT;
