BEGIN;
SET LOCAL lock_timeout = '5s';
SELECT set_config('request.jwt.claim.sub',(SELECT user_id::text FROM public.admins LIMIT 1),true) IS NOT NULL AS test_admin_set;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE event_id uuid; entry_id uuid; candidate_id integer; promoted_id uuid; row_data public.inschrijvingen%ROWTYPE;
BEGIN
  INSERT INTO public.wedstrijden(naam,datum,status) VALUES ('Registration verification (rollback)','2027-10-01','gesloten') RETURNING id INTO event_id;
  INSERT INTO public.inschrijvingen(wedstrijd_id,ruiter,paard,klasse,rubriek,geboortedatum_ruiter,stokmaat_cm,stal_nodig,stalmaat,opmerkingen,startnummer)
    VALUES(event_id,'Test','Pony','we1','Algemeen','2010-10-08',148.5,true,'klein','Behouden',101) RETURNING id INTO entry_id;
  SELECT * INTO STRICT row_data FROM public.inschrijvingen WHERE id=entry_id;
  IF row_data.geboortedatum_ruiter <> '2010-10-08'::date OR row_data.stokmaat_cm<>148.5 OR row_data.stal_nodig IS NOT TRUE OR row_data.stalmaat<>'klein' THEN RAISE EXCEPTION 'Roundtrip failed'; END IF;
  UPDATE public.inschrijvingen SET stalmaat='groot' WHERE id=entry_id;
  SELECT * INTO STRICT row_data FROM public.inschrijvingen WHERE id=entry_id;
  IF row_data.stalmaat<>'groot' OR row_data.opmerkingen<>'Behouden' OR row_data.startnummer<>101 THEN RAISE EXCEPTION 'Admin edit lost values'; END IF;
  BEGIN
    UPDATE public.inschrijvingen SET stokmaat_cm=NULL WHERE id=entry_id;
    RAISE EXCEPTION 'Missing height accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.inschrijvingen SET stalmaat=NULL WHERE id=entry_id;
    RAISE EXCEPTION 'Missing size accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO public.inschrijvingen(wedstrijd_id,ruiter,paard,klasse,rubriek,geboortedatum_ruiter,stal_nodig)
    VALUES(event_id,'Without stall','Pony','we1','Algemeen','2010-10-08',false);
  INSERT INTO public.inschrijvingen(wedstrijd_id,ruiter,paard,klasse,rubriek)
    VALUES(event_id,'Legacy','Pony','we1','Algemeen');
  UPDATE public.inschrijvingen SET opmerkingen='Legacy still editable' WHERE wedstrijd_id=event_id AND ruiter='Legacy';
  INSERT INTO public.wachtlijst(wedstrijd_id,ruiter,paard,klasse,email,geboortedatum_ruiter,stokmaat_cm,stal_nodig,stalmaat)
    VALUES(event_id,'Waitlist','Pony','we1','test@example.invalid','2010-10-08',170,true,'geen_voorkeur') RETURNING id INTO candidate_id;
  SELECT public.promoveer_wachtlijst(event_id,candidate_id) INTO promoted_id;
  SELECT * INTO STRICT row_data FROM public.inschrijvingen WHERE id=promoted_id;
  IF row_data.geboortedatum_ruiter<>'2010-10-08'::date OR row_data.leeftijd_ruiter<>16 OR row_data.stokmaat_cm<>170 OR row_data.stalmaat<>'geen_voorkeur' OR row_data.stal_nodig IS NOT TRUE THEN RAISE EXCEPTION 'Promotion lost details'; END IF;
  IF EXISTS(SELECT 1 FROM public.wachtlijst WHERE id=candidate_id) THEN RAISE EXCEPTION 'Promotion did not remove waitlist row'; END IF;
END $test$;
SELECT 'Roundtrip, admin edit, conditional constraints, legacy edit and waitlist promotion passed; all test rows rolled back.' AS verification;
ROLLBACK;
