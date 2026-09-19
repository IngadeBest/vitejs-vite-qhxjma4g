-- Run with psql -v score_email='the-chosen-address' -v wedstrijd_id='the-chosen-uuid'
-- after creating/verifying this user via Supabase Auth. This does not send email.
BEGIN;
SELECT set_config('workingpoint.score_email', :'score_email', true);
SELECT set_config('workingpoint.wedstrijd_id', :'wedstrijd_id', true);
DO $setup$
DECLARE target_id uuid; target_wedstrijd uuid := current_setting('workingpoint.wedstrijd_id')::uuid;
BEGIN
  SELECT id INTO target_id FROM auth.users
    WHERE lower(email) = lower(current_setting('workingpoint.score_email')) AND email_confirmed_at IS NOT NULL;
  IF target_id IS NULL THEN RAISE EXCEPTION 'Maak eerst het Auth-account aan en bevestig het e-mailadres'; END IF;
  IF EXISTS (SELECT 1 FROM public.admins WHERE user_id=target_id) THEN
    RAISE EXCEPTION 'Gebruik een apart vrijwilligersaccount, geen bestaand beheeraccount';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.wedstrijden WHERE id=target_wedstrijd) THEN
    RAISE EXCEPTION 'Wedstrijd niet gevonden';
  END IF;
  UPDATE auth.users SET raw_app_meta_data = COALESCE(raw_app_meta_data,'{}'::jsonb) ||
    jsonb_build_object('score_wedstrijd_ids',jsonb_build_array(target_wedstrijd)), updated_at=now()
    WHERE id=target_id;
END
$setup$;
COMMIT;
-- Log out and back in to obtain a JWT containing the new trusted app_metadata.
