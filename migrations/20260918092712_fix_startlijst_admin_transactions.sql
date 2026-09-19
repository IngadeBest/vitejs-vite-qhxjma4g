-- Existing tables only. No registration, score or waitlist data is deleted.
-- Provision an Auth user and explicitly add its UUID to public.admins before rollout.
BEGIN;

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admins FROM anon, authenticated;
GRANT SELECT ON public.admins TO authenticated;
DROP POLICY IF EXISTS admins_self_read ON public.admins;
CREATE POLICY admins_self_read ON public.admins FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- These legacy policies authorized ALL anonymous visitors, not administrators.
DROP POLICY IF EXISTS ins_insert ON public.inschrijvingen;
DROP POLICY IF EXISTS ins_update ON public.inschrijvingen;
DROP POLICY IF EXISTS ins_delete ON public.inschrijvingen;
DROP POLICY IF EXISTS wed_write ON public.wedstrijden;
DROP POLICY IF EXISTS wed_update ON public.wedstrijden;
DROP POLICY IF EXISTS wedstrijden_delete ON public.wedstrijden;
DROP POLICY IF EXISTS sl_insert ON public.startlijsten;

DO $policies$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['inschrijvingen','wedstrijden','startlijsten','wachtlijst'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT auth.uid()) IN (SELECT user_id FROM public.admins))', t || '_admin_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) IN (SELECT user_id FROM public.admins))', t || '_admin_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT auth.uid()) IN (SELECT user_id FROM public.admins)) WITH CHECK ((SELECT auth.uid()) IN (SELECT user_id FROM public.admins))', t || '_admin_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT auth.uid()) IN (SELECT user_id FROM public.admins))', t || '_admin_delete', t);
  END LOOP;
END
$policies$;

-- Preserve existing public read access; public registration writes use the server API.
GRANT SELECT ON public.inschrijvingen, public.wedstrijden, public.startlijsten TO anon;
DROP POLICY IF EXISTS wedstrijden_public_read ON public.wedstrijden;
CREATE POLICY wedstrijden_public_read ON public.wedstrijden FOR SELECT TO authenticated USING (true);
-- The waitlist's SERIAL default requires sequence usage as well as INSERT privileges.
REVOKE ALL ON SEQUENCE public.wachtlijst_id_seq FROM anon, authenticated;
GRANT USAGE ON SEQUENCE public.wachtlijst_id_seq TO authenticated;

CREATE OR REPLACE FUNCTION public.save_startlijst(
  p_wedstrijd_id uuid, p_rows jsonb, p_config jsonb, p_scope text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE
  old_config jsonb;
  row_data jsonb;
  entry_id uuid;
  saved_rows jsonb := '[]'::jsonb;
  pauses jsonb := '[]'::jsonb;
  row_order jsonb := '[]'::jsonb;
  settings jsonb;
  seen_ids uuid[] := ARRAY[]::uuid[];
  position integer := 0;
  global_order jsonb;
  merged_order jsonb := '[]'::jsonb;
  ordered_entries jsonb;
  order_item jsonb;
  next_entry integer := 0;
  scopes jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Alleen bevoegde beheerders mogen startlijsten opslaan' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_typeof(p_config) IS DISTINCT FROM 'object'
     OR p_scope IS NULL OR length(p_scope) > 200 THEN
    RAISE EXCEPTION 'Ongeldige startlijst';
  END IF;
  SELECT COALESCE(startlijst_config, '{}'::jsonb) INTO old_config
    FROM public.wedstrijden WHERE id = p_wedstrijd_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wedstrijd niet gevonden of geen beheerrechten'; END IF;
  global_order := old_config->'rowOrder';
  IF jsonb_typeof(global_order) IS DISTINCT FROM 'array' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'type','entry') ORDER BY volgorde NULLS LAST,klasse,created_at,id),'[]'::jsonb)
      INTO global_order FROM public.inschrijvingen WHERE wedstrijd_id=p_wedstrijd_id AND COALESCE(deelnemer_status,'actief')='actief';
  END IF;
  FOR row_data IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    IF row_data->>'type' = 'break' THEN
      pauses := pauses || jsonb_build_array(jsonb_build_object('id', row_data->>'id',
        'label', COALESCE(row_data->>'label','Pauze'), 'duration', COALESCE((row_data->>'duration')::integer,15), 'position',position));
    ELSIF row_data->>'type' = 'entry' THEN
      IF COALESCE(btrim(row_data->>'ruiter'),'') = '' OR COALESCE(btrim(row_data->>'paard'),'') = ''
         OR COALESCE(btrim(row_data->>'klasse'),'') = '' THEN
        RAISE EXCEPTION 'Vul voor iedere deelnemer ruiter, paard en klasse in';
      END IF;
      entry_id := NULLIF(row_data->>'dbId','')::uuid;
      IF entry_id IS NOT NULL THEN
        IF entry_id = ANY(seen_ids) THEN RAISE EXCEPTION 'Deelnemer staat dubbel in startlijst'; END IF;
        UPDATE public.inschrijvingen SET ruiter = btrim(row_data->>'ruiter'), paard = btrim(row_data->>'paard'),
          klasse = row_data->>'klasse', rubriek = COALESCE(NULLIF(row_data->>'rubriek',''),'Algemeen'),
          startnummer = NULLIF(row_data->>'startnummer','')::integer, volgorde = position
        WHERE id = entry_id AND wedstrijd_id = p_wedstrijd_id AND COALESCE(deelnemer_status,'actief') = 'actief';
        IF NOT FOUND THEN RAISE EXCEPTION 'Deelnemer is gewijzigd, afgemeld of niet toegankelijk; laad de startlijst opnieuw'; END IF;
      ELSE
        INSERT INTO public.inschrijvingen(wedstrijd_id,ruiter,paard,klasse,rubriek,startnummer,volgorde)
        VALUES (p_wedstrijd_id,btrim(row_data->>'ruiter'),btrim(row_data->>'paard'),row_data->>'klasse',
          COALESCE(NULLIF(row_data->>'rubriek',''),'Algemeen'),NULLIF(row_data->>'startnummer','')::integer,position)
        RETURNING id INTO entry_id;
      END IF;
      seen_ids := array_append(seen_ids,entry_id);
      row_data := row_data || jsonb_build_object('id',entry_id,'dbId',entry_id,'fromDB',true);
    ELSE
      RAISE EXCEPTION 'Onbekend rijtype';
    END IF;
    saved_rows := saved_rows || jsonb_build_array(row_data);
    row_order := row_order || jsonb_build_array(jsonb_build_object('id',row_data->>'id','type',row_data->>'type'));
    position := position + 1;
  END LOOP;
  -- Allow only scheduling settings; preserve capacity, pricing and unrelated configuration.
  SELECT COALESCE(jsonb_object_agg(key,value),'{}'::jsonb) INTO settings FROM jsonb_each(p_config)
    WHERE key IN ('dressuurStart','trailStart','interval','trailOmbouwtijd','pauzeMinuten','klasseStartTimes');
  settings := settings || jsonb_build_object('pauses',pauses,'rowOrder',row_order);
  -- A filtered reorder replaces only its participants' slots in the global list.
  -- It must also be visible after clearing the filter, without disturbing other classes.
  IF p_scope = '["",""]' THEN
    global_order := row_order;
  ELSE
    SELECT COALESCE(jsonb_agg(value),'[]'::jsonb) INTO ordered_entries FROM jsonb_array_elements(row_order)
      WHERE value->>'type'='entry';
    FOR order_item IN SELECT value FROM jsonb_array_elements(global_order) LOOP
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(ordered_entries) e WHERE e.value->>'id'=order_item->>'id') THEN
        merged_order := merged_order || jsonb_build_array(ordered_entries->next_entry);
        next_entry := next_entry+1;
      ELSE
        merged_order := merged_order || jsonb_build_array(order_item);
      END IF;
    END LOOP;
    WHILE next_entry < jsonb_array_length(ordered_entries) LOOP
      merged_order := merged_order || jsonb_build_array(ordered_entries->next_entry);
      next_entry := next_entry+1;
    END LOOP;
    global_order := merged_order;
  END IF;
  -- Invalidate stale overlapping order overrides; retain each filter's timing/pauses.
  SELECT COALESCE(jsonb_object_agg(key,value-'rowOrder'),'{}'::jsonb) INTO scopes
    FROM jsonb_each(COALESCE(old_config->'startlijstScopes','{}'::jsonb));
  old_config := jsonb_set(old_config, '{startlijstScopes}',
    scopes || jsonb_build_object(p_scope,settings));
  IF p_scope = '["",""]' THEN old_config := old_config || settings; END IF;
  old_config := old_config || jsonb_build_object('rowOrder',global_order);
  UPDATE public.inschrijvingen i SET volgorde=(r.ordinality-1)::integer
    FROM jsonb_array_elements(global_order) WITH ORDINALITY r(value,ordinality)
    WHERE i.wedstrijd_id=p_wedstrijd_id AND i.id::text=r.value->>'id' AND r.value->>'type'='entry';
  UPDATE public.wedstrijden SET startlijst_config = old_config WHERE id = p_wedstrijd_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Configuratie niet opgeslagen'; END IF;
  RETURN saved_rows;
END
$function$;

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
    leeftijd_ruiter,geslacht_paard,omroeper,opmerkingen,rubriek)
  VALUES (w.id,w.naam,candidate.klasse,candidate.ruiter,candidate.paard,candidate.email,candidate.telefoon,
    candidate.weh_lid,candidate.leeftijd_ruiter,candidate.geslacht_paard,candidate.omroeper,candidate.opmerkingen,'Algemeen')
  RETURNING id INTO new_id;
  DELETE FROM public.wachtlijst WHERE id = candidate.id AND wedstrijd_id = w.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wachtlijstkandidaat kon niet worden verwijderd'; END IF;
  RETURN new_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.afmelden_deelnemer(p_wedstrijd_id uuid, p_deelnemer_id uuid, p_wachtlijst_id integer DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE entry_class text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Alleen bevoegde beheerders mogen deelnemers afmelden' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.wedstrijden WHERE id = p_wedstrijd_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wedstrijd niet gevonden'; END IF;
  UPDATE public.inschrijvingen SET deelnemer_status = 'afgemeld', afgemeld_at = now(),
    afgemeld_reden = 'Afgemeld via deelnemersbeheer'
    WHERE id = p_deelnemer_id AND wedstrijd_id = p_wedstrijd_id AND COALESCE(deelnemer_status,'actief') = 'actief'
    RETURNING klasse INTO entry_class;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deelnemer is niet meer actief; vernieuw de lijst'; END IF;
  IF p_wachtlijst_id IS NOT NULL THEN
    PERFORM 1 FROM public.wachtlijst WHERE id = p_wachtlijst_id AND wedstrijd_id = p_wedstrijd_id AND klasse = entry_class;
    IF NOT FOUND THEN RAISE EXCEPTION 'Wachtlijstkandidaat hoort niet bij deze wedstrijd en klasse'; END IF;
    PERFORM public.promoveer_wachtlijst(p_wedstrijd_id,p_wachtlijst_id);
  END IF;
END
$function$;

REVOKE ALL ON FUNCTION public.save_startlijst(uuid,jsonb,jsonb,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.promoveer_wachtlijst(uuid,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.afmelden_deelnemer(uuid,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_startlijst(uuid,jsonb,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promoveer_wachtlijst(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.afmelden_deelnemer(uuid,uuid,integer) TO authenticated;
COMMIT;
