begin;

create table public.public_result_settings (
  wedstrijd_id uuid primary key references public.wedstrijden(id) on delete cascade,
  published boolean not null default false,
  finalized jsonb not null default '{}'::jsonb check (jsonb_typeof(finalized) = 'object')
);
alter table public.public_result_settings enable row level security;
revoke all on public.public_result_settings from public, anon, authenticated;
grant select, insert, update, delete on public.public_result_settings to authenticated;
grant all on public.public_result_settings to service_role;
create policy public_results_admin on public.public_result_settings
  for all to authenticated
  using ((select auth.uid()) in (select user_id from public.admins))
  with check ((select auth.uid()) in (select user_id from public.admins));

-- Public results go through the server allowlist. Raw scores must not bypass publication.
revoke select on public.scores from anon;
drop policy if exists sc_read on public.scores;

-- Retain only the columns used for registration counts, never names/contact details.
revoke select on public.inschrijvingen from anon;
grant select (id, wedstrijd_id, klasse) on public.inschrijvingen to anon;

comment on table public.public_result_settings is
  'Admin-only publication and explicit approval of result fingerprints. No anonymous table access.';
commit;
