-- Transactional integration test: no test records or email notifications remain.
BEGIN;
SET LOCAL lock_timeout = '5s';
SELECT set_config('request.jwt.claim.sub',(SELECT user_id::text FROM public.admins LIMIT 1),true) IS NOT NULL AS test_admin_set;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE event_id uuid; entry_id uuid; candidate_id integer; promoted_id uuid; r public.inschrijvingen%ROWTYPE;
        accepted_time timestamptz := '2026-10-07T12:32:00Z';
BEGIN
  INSERT INTO public.wedstrijden(naam,datum,status) VALUES ('Terms verification (rollback)','2027-10-01','gesloten') RETURNING id INTO event_id;
  INSERT INTO public.inschrijvingen(wedstrijd_id,ruiter,paard,klasse,rubriek,terms_accepted,terms_version,terms_accepted_at)
    VALUES(event_id,'Test','Pony','we1','Algemeen',true,'2026-10-07',accepted_time) RETURNING id INTO entry_id;
  SELECT * INTO STRICT r FROM public.inschrijvingen WHERE id=entry_id;
  IF r.terms_accepted IS NOT TRUE OR r.terms_version IS DISTINCT FROM '2026-10-07' OR r.terms_accepted_at IS DISTINCT FROM accepted_time THEN RAISE EXCEPTION 'Acceptance roundtrip failed'; END IF;
  UPDATE public.inschrijvingen SET stokmaat_cm=170,stal_nodig=true,stalmaat='groot' WHERE id=entry_id;
  SELECT * INTO STRICT r FROM public.inschrijvingen WHERE id=entry_id;
  IF r.terms_accepted_at IS DISTINCT FROM accepted_time OR r.terms_version IS DISTINCT FROM '2026-10-07' THEN RAISE EXCEPTION 'Admin edit lost acceptance'; END IF;
  BEGIN
    UPDATE public.inschrijvingen SET terms_accepted_at=NULL WHERE id=entry_id;
    RAISE EXCEPTION 'Incomplete acceptance allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO public.inschrijvingen(wedstrijd_id,ruiter,paard,klasse,rubriek)
    VALUES(event_id,'Legacy','Pony','we1','Algemeen') RETURNING id INTO entry_id;
  UPDATE public.inschrijvingen SET opmerkingen='Historical row still editable' WHERE id=entry_id;
  SELECT * INTO STRICT r FROM public.inschrijvingen WHERE id=entry_id;
  IF r.terms_accepted IS NOT NULL OR r.terms_version IS NOT NULL OR r.terms_accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Historical acceptance fabricated'; END IF;
  INSERT INTO public.wachtlijst(wedstrijd_id,ruiter,paard,klasse,email,terms_accepted,terms_version,terms_accepted_at)
    VALUES(event_id,'Waitlist','Pony','we1','test@example.invalid',true,'2026-10-07',accepted_time) RETURNING id INTO candidate_id;
  SELECT public.promoveer_wachtlijst(event_id,candidate_id) INTO promoted_id;
  SELECT * INTO STRICT r FROM public.inschrijvingen WHERE id=promoted_id;
  IF r.terms_accepted IS NOT TRUE OR r.terms_version IS DISTINCT FROM '2026-10-07' OR r.terms_accepted_at IS DISTINCT FROM accepted_time THEN RAISE EXCEPTION 'Promotion lost original acceptance'; END IF;
  INSERT INTO public.wachtlijst(wedstrijd_id,ruiter,paard,klasse,email)
    VALUES(event_id,'Legacy waitlist','Pony','we1','test@example.invalid') RETURNING id INTO candidate_id;
  SELECT public.promoveer_wachtlijst(event_id,candidate_id) INTO promoted_id;
  SELECT * INTO STRICT r FROM public.inschrijvingen WHERE id=promoted_id;
  IF r.terms_accepted IS NOT NULL OR r.terms_version IS NOT NULL OR r.terms_accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Legacy promotion fabricated acceptance'; END IF;
END $test$;
SELECT 'Acceptance reload, admin edit, incomplete evidence rejection, legacy rows and both waitlist promotions passed; test rows rolled back.' AS verification;
ROLLBACK;
