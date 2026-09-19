-- Run AFTER the migration, inside a transaction, with postgres privileges.
-- Caller must BEGIN and ROLLBACK. Fixtures never survive the test.
CREATE TEMP TABLE wp_test_ids AS SELECT gen_random_uuid() AS admin_id, gen_random_uuid() AS participant_id,
  gen_random_uuid() AS wedstrijd_id, gen_random_uuid() AS other_wedstrijd_id;
GRANT SELECT ON wp_test_ids TO authenticated, anon;
INSERT INTO auth.users(id) SELECT admin_id FROM wp_test_ids;
INSERT INTO public.admins(user_id) SELECT admin_id FROM wp_test_ids;
SELECT set_config('request.jwt.claim.sub',admin_id::text,true) FROM wp_test_ids;
SET LOCAL ROLE authenticated;

DO $test$
DECLARE w uuid; other_w uuid; saved jsonb; rows jsonb; id_a uuid; id_b uuid; wait_id integer;
  candidate_id uuid; n integer; before_config jsonb; outsider uuid;
BEGIN
  SELECT wedstrijd_id,other_wedstrijd_id,participant_id INTO w,other_w,outsider FROM wp_test_ids;
  INSERT INTO public.wedstrijden(id,naam,wachtlijst_enabled,startlijst_config)
    VALUES (w,'__startlijst_rollback_test__',true,'{"totaalMaximum":2,"capacities":{"WE0":2},"tarieven":{"basis":45}}'),
           (other_w,'__startlijst_rollback_other__',false,'{}');
  rows := '[{"id":"temp-a","type":"entry","ruiter":"Test A","paard":"Paard A","klasse":"WE0","startnummer":"1"},
            {"id":"temp-b","type":"entry","ruiter":"Test B","paard":"Paard B","klasse":"WE0","startnummer":"2"}]';
  saved := public.save_startlijst(w,rows,'{"dressuurStart":"09:00"}','["",""]');
  id_a := (saved->0->>'dbId')::uuid; id_b := (saved->1->>'dbId')::uuid;
  IF id_a IS NULL OR id_b IS NULL THEN RAISE EXCEPTION 'FAIL: new IDs not returned'; END IF;
  -- Reorder with a break and save again: no duplicates, config and order persisted together.
  rows := jsonb_build_array(saved->1,'{"id":"break-1","type":"break","duration":15}'::jsonb,saved->0);
  saved := public.save_startlijst(w,rows,'{"dressuurStart":"10:00"}','["",""]');
  IF (SELECT count(*) FROM public.inschrijvingen WHERE wedstrijd_id=w) <> 2 THEN RAISE EXCEPTION 'FAIL: duplicate/deleted entries'; END IF;
  IF (SELECT volgorde FROM public.inschrijvingen WHERE id=id_b) <> 0 OR
     (SELECT volgorde FROM public.inschrijvingen WHERE id=id_a) <> 2 THEN RAISE EXCEPTION 'FAIL: order'; END IF;
  SELECT startlijst_config INTO before_config FROM public.wedstrijden WHERE id=w;
  IF before_config->>'totaalMaximum' <> '2' OR before_config->'tarieven'->>'basis' <> '45'
     OR before_config->'rowOrder'->0->>'id' <> id_b::text THEN RAISE EXCEPTION 'FAIL: config preservation'; END IF;
  PERFORM public.save_startlijst(w,jsonb_build_array(saved->2,saved->0),'{}','["WE0",""]');
  SELECT startlijst_config INTO before_config FROM public.wedstrijden WHERE id=w;
  IF before_config->'rowOrder'->0->>'id' <> id_a::text OR
     (SELECT volgorde FROM public.inschrijvingen WHERE id=id_a) <> 0 THEN
    RAISE EXCEPTION 'FAIL: filtered order not reflected globally';
  END IF;
  -- Late failure must roll back earlier row updates AND settings.
  BEGIN
    PERFORM public.save_startlijst(w,jsonb_build_array((saved->0)||'{"ruiter":"must rollback"}',
      '{"type":"entry","ruiter":"invalid","paard":"","klasse":"WE0"}'::jsonb),'{}','["",""]');
    RAISE EXCEPTION 'FAIL: invalid save accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;
  IF (SELECT ruiter FROM public.inschrijvingen WHERE id=id_b) <> 'Test B' OR
     (SELECT startlijst_config FROM public.wedstrijden WHERE id=w) <> before_config THEN RAISE EXCEPTION 'FAIL: partial save'; END IF;
  BEGIN
    PERFORM public.save_startlijst(other_w,saved,'{}','["",""]');
    RAISE EXCEPTION 'FAIL: cross competition update';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;

  -- Sequence use, SELECT, UPDATE and DELETE policies of the waitlist.
  INSERT INTO public.wachtlijst(wedstrijd_id,klasse,ruiter,paard,email)
    VALUES(w,'WE0','Test C','Paard C','rollback@example.invalid') RETURNING id INTO wait_id;
  UPDATE public.wachtlijst SET opmerkingen='test' WHERE id=wait_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL: admin waitlist update'; END IF;
  -- Wrong candidate: cancellation must roll back.
  BEGIN
    PERFORM public.afmelden_deelnemer(w,id_a,-1);
    RAISE EXCEPTION 'FAIL: absent candidate accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  IF (SELECT deelnemer_status FROM public.inschrijvingen WHERE id=id_a) <> 'actief' THEN RAISE EXCEPTION 'FAIL: partial cancellation'; END IF;
  PERFORM public.afmelden_deelnemer(w,id_a,NULL);
  IF (SELECT count(*) FROM public.inschrijvingen WHERE id=id_a AND deelnemer_status='afgemeld') <> 1
     OR (SELECT count(*) FROM public.wachtlijst WHERE id=wait_id) <> 1 THEN RAISE EXCEPTION 'FAIL: cancellation deleted data'; END IF;
  UPDATE public.inschrijvingen SET deelnemer_status='actief',afgemeld_at=NULL,afgemeld_reden=NULL WHERE id=id_a;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL: reactivate'; END IF;
  PERFORM public.afmelden_deelnemer(w,id_a,wait_id);
  IF EXISTS (SELECT 1 FROM public.wachtlijst WHERE id=wait_id) OR
     (SELECT count(*) FROM public.inschrijvingen WHERE wedstrijd_id=w AND deelnemer_status='actief') <> 2 THEN
    RAISE EXCEPTION 'FAIL: atomic promotion';
  END IF;
  INSERT INTO public.wachtlijst(wedstrijd_id,klasse,ruiter,paard,email)
    VALUES(w,'WE0','Still waiting','Paard D','still-waiting@example.invalid') RETURNING id INTO wait_id;
  -- Ordinary participants cannot write directly or through RPCs, even with forged metadata.
  PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated','user_metadata',jsonb_build_object('role','admin'))::text,true);
  UPDATE public.inschrijvingen SET volgorde=99 WHERE wedstrijd_id=w;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: participant updated another entry'; END IF;
  DELETE FROM public.inschrijvingen WHERE wedstrijd_id=w;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: participant deleted entries'; END IF;
  UPDATE public.wedstrijden SET startlijst_config='{}' WHERE id=w;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: participant updated config'; END IF;
  UPDATE public.wachtlijst SET opmerkingen='unauthorized' WHERE id=wait_id;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: participant updated waitlist'; END IF;
  DELETE FROM public.wachtlijst WHERE id=wait_id;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: participant deleted waitlist'; END IF;
  BEGIN
    INSERT INTO public.inschrijvingen(wedstrijd_id,klasse,ruiter,paard,rubriek) VALUES(w,'WE0','bad','bad','Algemeen');
    RAISE EXCEPTION 'FAIL: participant insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.admins(user_id) VALUES(outsider);
    RAISE EXCEPTION 'FAIL: self elevation';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.save_startlijst(w,saved,'{}','["",""]');
    RAISE EXCEPTION 'FAIL: participant save RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.afmelden_deelnemer(w,id_b,NULL);
    RAISE EXCEPTION 'FAIL: participant cancellation RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.promoveer_wachtlijst(w,wait_id);
    RAISE EXCEPTION 'FAIL: participant promotion RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF EXISTS (SELECT 1 FROM public.wachtlijst WHERE wedstrijd_id=w) THEN RAISE EXCEPTION 'FAIL: waitlist exposure'; END IF;
END
$test$;
RESET ROLE;
DO $test$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN
    ('save_startlijst','afmelden_deelnemer','promoveer_wachtlijst','can_enter_scores') AND prosecdef) THEN
    RAISE EXCEPTION 'FAIL: definer bypass';
  END IF;
END
$test$;
SET LOCAL ROLE anon;
DO $test$
BEGIN
  IF has_table_privilege('anon','public.inschrijvingen','UPDATE') OR
     has_table_privilege('anon','public.inschrijvingen','DELETE') OR
     has_table_privilege('anon','public.wedstrijden','UPDATE') OR
     has_table_privilege('anon','public.wachtlijst','SELECT') OR
     has_function_privilege('anon','public.save_startlijst(uuid,jsonb,jsonb,text)','EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anonymous write/function/waitlist permission';
  END IF;
END
$test$;
RESET ROLE;
SELECT 'PASS: atomic save, reload data, cancellation, reactivation, promotion, rollback, admin/participant/anon RLS' AS result;
