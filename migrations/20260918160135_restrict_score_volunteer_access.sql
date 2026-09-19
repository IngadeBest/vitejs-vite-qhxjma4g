-- Score volunteers are NOT admins. Their assigned UUIDs live in server-managed
-- auth.users.raw_app_meta_data.score_wedstrijd_ids, never editable user_metadata.
-- No volunteer is provisioned here: the owner must supply the account email first.
BEGIN;

ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proeven ENABLE ROW LEVEL SECURITY;

-- These public writes would bypass every scope check below (policies are OR-ed).
DROP POLICY IF EXISTS "public insert" ON public.scores;
DROP POLICY IF EXISTS "public update" ON public.scores;
DROP POLICY IF EXISTS "public delete" ON public.scores;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.scores;
DROP POLICY IF EXISTS sc_write ON public.scores;
DROP POLICY IF EXISTS sc_update ON public.scores;
-- A scorer must not be able to move a trial to their own competition to gain access.
DROP POLICY IF EXISTS "public insert" ON public.proeven;
DROP POLICY IF EXISTS "public update" ON public.proeven;
DROP POLICY IF EXISTS "public delete" ON public.proeven;

REVOKE ALL ON public.scores, public.proeven FROM anon, authenticated;
GRANT SELECT ON public.scores, public.proeven TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.scores, public.proeven TO authenticated;

DO $policies$
DECLARE t text; seq text;
BEGIN
  FOREACH t IN ARRAY ARRAY['scores','proeven'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((SELECT auth.uid()) IN (SELECT user_id FROM public.admins)) WITH CHECK ((SELECT auth.uid()) IN (SELECT user_id FROM public.admins))', t || '_admin_all', t);
    seq := pg_get_serial_sequence('public.' || t,'id');
    IF seq IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM anon, authenticated',seq);
      EXECUTE format('GRANT USAGE ON SEQUENCE %s TO authenticated',seq);
    END IF;
  END LOOP;
END
$policies$;

CREATE OR REPLACE FUNCTION public.can_enter_scores(p_wedstrijd_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $function$
  SELECT auth.uid() IS NOT NULL
    AND jsonb_typeof((SELECT auth.jwt())->'app_metadata'->'score_wedstrijd_ids') = 'array'
    AND COALESCE(((SELECT auth.jwt())->'app_metadata'->'score_wedstrijd_ids') ? p_wedstrijd_id::text,false);
$function$;
REVOKE ALL ON FUNCTION public.can_enter_scores(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_enter_scores(uuid) TO authenticated;

DROP POLICY IF EXISTS inschrijvingen_scorer_select ON public.inschrijvingen;
CREATE POLICY inschrijvingen_scorer_select ON public.inschrijvingen FOR SELECT TO authenticated
  USING (public.can_enter_scores(wedstrijd_id));

DROP POLICY IF EXISTS scores_scorer_select ON public.scores;
CREATE POLICY scores_scorer_select ON public.scores FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proeven p WHERE p.id = scores.proef_id AND public.can_enter_scores(p.wedstrijd_id)));

DROP POLICY IF EXISTS scores_scorer_insert ON public.scores;
CREATE POLICY scores_scorer_insert ON public.scores FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.proeven p JOIN public.inschrijvingen i ON i.wedstrijd_id = p.wedstrijd_id
    WHERE p.id = scores.proef_id AND public.can_enter_scores(p.wedstrijd_id)
      AND scores.wedstrijd_id = p.wedstrijd_id AND i.startnummer = scores.ruiter_id
      AND COALESCE(i.deelnemer_status,'actief') = 'actief'));

DROP POLICY IF EXISTS scores_scorer_update ON public.scores;
CREATE POLICY scores_scorer_update ON public.scores FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proeven p WHERE p.id = scores.proef_id AND public.can_enter_scores(p.wedstrijd_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.proeven p JOIN public.inschrijvingen i ON i.wedstrijd_id = p.wedstrijd_id
    WHERE p.id = scores.proef_id AND public.can_enter_scores(p.wedstrijd_id)
      AND scores.wedstrijd_id = p.wedstrijd_id AND i.startnummer = scores.ruiter_id
      AND COALESCE(i.deelnemer_status,'actief') = 'actief'));

DROP POLICY IF EXISTS scores_scorer_delete ON public.scores;
CREATE POLICY scores_scorer_delete ON public.scores FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proeven p WHERE p.id = scores.proef_id AND public.can_enter_scores(p.wedstrijd_id)));

COMMIT;
