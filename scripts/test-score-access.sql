-- Run after both migrations and test-startlijst-rls.sql in the SAME rollback transaction.
SELECT set_config('request.jwt.claim.sub',admin_id::text,true) FROM wp_test_ids;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE w uuid; other_w uuid; volunteer uuid; p bigint; other_p bigint; score_id bigint; n integer;
BEGIN
  SELECT wedstrijd_id,other_wedstrijd_id,participant_id INTO w,other_w,volunteer FROM wp_test_ids;
  INSERT INTO public.proeven(naam,klasse,onderdeel,wedstrijd_id) VALUES('Test trial','WE0','Dressuur',w) RETURNING id INTO p;
  INSERT INTO public.proeven(naam,klasse,onderdeel,wedstrijd_id) VALUES('Other trial','WE0','Dressuur',other_w) RETURNING id INTO other_p;
  PERFORM set_config('request.jwt.claim.sub',volunteer::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',volunteer,'role','authenticated',
    'app_metadata',jsonb_build_object('score_wedstrijd_ids',jsonb_build_array(w)))::text,true);
  -- Start number 2 is the active second registration from the startlist test.
  INSERT INTO public.scores(proef_id,wedstrijd_id,ruiter_id,score) VALUES(p,w,2,72) RETURNING id INTO score_id;
  UPDATE public.scores SET score=75 WHERE id=score_id;
  IF NOT FOUND OR (SELECT score FROM public.scores WHERE id=score_id) <> 75 THEN RAISE EXCEPTION 'FAIL: volunteer save/read'; END IF;
  BEGIN
    INSERT INTO public.scores(proef_id,wedstrijd_id,ruiter_id,score) VALUES(other_p,other_w,2,99);
    RAISE EXCEPTION 'FAIL: score for another competition';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.scores SET proef_id=other_p,wedstrijd_id=other_w WHERE id=score_id;
    RAISE EXCEPTION 'FAIL: moved score to another competition';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.proeven SET wedstrijd_id=w WHERE id=other_p;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: volunteer moved trial'; END IF;
  UPDATE public.inschrijvingen SET volgorde=100 WHERE wedstrijd_id=w;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: volunteer reordered participants'; END IF;
  DELETE FROM public.inschrijvingen WHERE wedstrijd_id=w;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: volunteer deleted participants'; END IF;
  UPDATE public.wedstrijden SET startlijst_config='{}' WHERE id=w;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: volunteer changed configuration'; END IF;
  BEGIN
    PERFORM public.save_startlijst(w,'[]','{}','["",""]');
    RAISE EXCEPTION 'FAIL: volunteer startlist RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  DELETE FROM public.scores WHERE id=score_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL: volunteer cannot correct/remove score'; END IF;
  -- A participant putting the same scope in user_metadata must NOT gain access.
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',volunteer,'role','authenticated',
    'user_metadata',jsonb_build_object('score_wedstrijd_ids',jsonb_build_array(w)))::text,true);
  BEGIN
    INSERT INTO public.scores(proef_id,wedstrijd_id,ruiter_id,score) VALUES(p,w,2,99);
    RAISE EXCEPTION 'FAIL: forged user_metadata authorized';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END
$test$;
RESET ROLE;
DO $test$
BEGIN
  IF has_table_privilege('anon','public.scores','UPDATE') OR has_table_privilege('anon','public.scores','INSERT')
     OR has_table_privilege('anon','public.scores','DELETE') OR has_table_privilege('anon','public.proeven','UPDATE') THEN
    RAISE EXCEPTION 'FAIL: anonymous score/trial write';
  END IF;
END
$test$;
SELECT 'PASS: volunteer can enter/correct scores only for assigned competition; no startlist, registration, trial or admin writes; forged metadata denied' AS result;
