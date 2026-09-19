-- Run after test-startlijst-rls.sql in the same rollback transaction.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',admin_id::text,true),
  set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true) FROM wp_test_ids;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE w uuid; other_w uuid; participant uuid; a uuid; n integer; assignment jsonb := '{"heeftStal":true,"stalnummer":"12"}';
BEGIN
  SELECT wedstrijd_id,other_wedstrijd_id,participant_id INTO w,other_w,participant FROM wp_test_ids;
  SELECT id INTO a FROM public.inschrijvingen WHERE wedstrijd_id=w LIMIT 1;
  n := public.save_stal_toewijzingen(w,jsonb_build_object(a,jsonb_build_object('before',null,'after',assignment)));
  IF n <> 1 OR (SELECT stal_toewijzing FROM public.inschrijvingen WHERE id=a) <> assignment THEN RAISE EXCEPTION 'FAIL: stable save'; END IF;
  BEGIN
    PERFORM public.save_stal_toewijzingen(w,jsonb_build_object(a,jsonb_build_object('before',null,'after',assignment)));
    RAISE EXCEPTION 'FAIL: stale overwrite accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  BEGIN
    PERFORM public.save_stal_toewijzingen(other_w,jsonb_build_object(a,jsonb_build_object('before',assignment,'after',assignment)));
    RAISE EXCEPTION 'FAIL: wrong competition accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claim.sub',participant::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',participant,'role','authenticated',
    'app_metadata',jsonb_build_object('score_wedstrijd_ids',jsonb_build_array(w)))::text,true);
  IF (SELECT stal_toewijzing FROM public.inschrijvingen WHERE id=a) IS DISTINCT FROM assignment THEN RAISE EXCEPTION 'FAIL: scorer cannot see shared stall'; END IF;
  BEGIN
    PERFORM public.save_stal_toewijzingen(w,'{}');
    RAISE EXCEPTION 'FAIL: scorer can save stalls';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.inschrijvingen SET stal_toewijzing='{"heeftStal":false,"stalnummer":""}' WHERE id=a;
  IF FOUND THEN RAISE EXCEPTION 'FAIL: scorer direct update'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',participant,'role','authenticated')::text,true);
  IF EXISTS(SELECT 1 FROM public.inschrijvingen WHERE id=a) THEN RAISE EXCEPTION 'FAIL: ordinary participant can read stall'; END IF;
END;
$test$;
RESET ROLE;
SELECT 'PASS: admin saves shared stalls; stale writes rejected; scoped volunteer reads but cannot write; ordinary participant denied' AS result;
